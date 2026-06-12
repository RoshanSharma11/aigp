import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { FileDependency, FileGraph } from "@agent-layer/core";

import {
  IGNORED_DIRECTORY_NAMES,
  isControllerFile,
  isDtoFile,
  isEntityFile,
  isTypeScriptSourceFile,
  resolveWithinRoot,
  toPosixPath,
  toProjectRelativePath,
} from "./paths.js";
import { resolvePathAlias, type TsConfigResolution } from "./tsconfig.js";

const IMPORT_SPECIFIER_PATTERN =
  /(?:import\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?|export\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+)\s+from\s+)['"]([^'"]+)['"]/g;

const EXPORT_DECLARATION_PATTERN =
  /^export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/gm;

const globToRegExp = (globPattern: string): RegExp => {
  const normalizedPattern = toPosixPath(globPattern);
  let regex = "^";

  for (let index = 0; index < normalizedPattern.length; index += 1) {
    const character = normalizedPattern[index];

    if (character === undefined) {
      continue;
    }

    if (character === "*") {
      if (normalizedPattern[index + 1] === "*") {
        if (normalizedPattern[index + 2] === "/") {
          regex += "(?:.*/)?";
          index += 2;
        } else {
          regex += ".*";
          index += 1;
        }

        continue;
      }

      regex += "[^/]*";
      continue;
    }

    regex += character.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }

  return new RegExp(`${regex}$`);
};

const matchesAnyPattern = (
  relativePath: string,
  patterns: readonly string[],
): boolean => patterns.some((pattern) => globToRegExp(pattern).test(relativePath));

const shouldSkipDirectory = (
  directoryName: string,
  tsConfig: TsConfigResolution,
): boolean =>
  IGNORED_DIRECTORY_NAMES.has(directoryName) ||
  tsConfig.exclude.some((pattern) => globToRegExp(pattern).test(directoryName));

export interface ClassifiedProjectFiles {
  readonly sourceFiles: readonly string[];
  readonly routeFiles: readonly string[];
  readonly dtoFiles: readonly string[];
  readonly entityFiles: readonly string[];
}

const collectSourceFiles = async (
  rootPath: string,
  tsConfig: TsConfigResolution,
): Promise<readonly string[]> => {
  const sourceFiles: string[] = [];

  const visitDirectory = async (directoryPath: string): Promise<void> => {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry.name, tsConfig)) {
          await visitDirectory(absolutePath);
        }

        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = toProjectRelativePath(rootPath, absolutePath);

      if (
        !isTypeScriptSourceFile(relativePath) ||
        !matchesAnyPattern(relativePath, tsConfig.include)
      ) {
        continue;
      }

      sourceFiles.push(relativePath);
    }
  };

  await visitDirectory(resolveWithinRoot(rootPath));

  return sourceFiles.sort();
};

export const classifyProjectFiles = (
  sourceFiles: readonly string[],
): ClassifiedProjectFiles => ({
  sourceFiles,
  routeFiles: sourceFiles.filter(isControllerFile),
  dtoFiles: sourceFiles.filter(isDtoFile),
  entityFiles: sourceFiles.filter(isEntityFile),
});

export const listProjectSourceFiles = async (
  rootPath: string,
  tsConfig: TsConfigResolution,
): Promise<readonly string[]> => collectSourceFiles(rootPath, tsConfig);

const extractImportSpecifiers = (source: string): readonly string[] => {
  const specifiers = new Set<string>();

  for (const match of source.matchAll(IMPORT_SPECIFIER_PATTERN)) {
    const specifier = match[1];

    if (specifier !== undefined) {
      specifiers.add(specifier);
    }
  }

  return [...specifiers];
};

const extractExportNames = (source: string): readonly string[] => {
  const exportNames = new Set<string>();

  for (const match of source.matchAll(EXPORT_DECLARATION_PATTERN)) {
    const exportName = match[1];

    if (exportName !== undefined) {
      exportNames.add(exportName);
    }
  }

  return [...exportNames];
};

const resolveTypeScriptFile = async (
  candidatePath: string,
): Promise<string | null> => {
  if (candidatePath.endsWith(".ts") && (await fileExists(candidatePath))) {
    return candidatePath;
  }

  if (candidatePath.endsWith(".js")) {
    const tsPath = `${candidatePath.slice(0, -3)}.ts`;

    if (await fileExists(tsPath)) {
      return tsPath;
    }
  }

  const tsCandidate = `${candidatePath}.ts`;

  if (await fileExists(tsCandidate)) {
    return tsCandidate;
  }

  const indexCandidate = path.join(candidatePath, "index.ts");

  if (await fileExists(indexCandidate)) {
    return indexCandidate;
  }

  return null;
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const resolveImportToProjectPath = async (
  rootPath: string,
  fromFile: string,
  specifier: string,
  tsConfig: TsConfigResolution,
  sourceFileSet: ReadonlySet<string>,
): Promise<string | null> => {
  if (specifier.startsWith(".")) {
    const fromAbsolutePath = resolveWithinRoot(rootPath, fromFile);
    const resolvedAbsolutePath = path.resolve(
      path.dirname(fromAbsolutePath),
      specifier,
    );
    const resolvedProjectPath = await resolveTypeScriptFile(resolvedAbsolutePath);

    if (resolvedProjectPath === null) {
      return null;
    }

    const relativePath = toProjectRelativePath(rootPath, resolvedProjectPath);

    return sourceFileSet.has(relativePath) ? relativePath : null;
  }

  const aliasedPath = resolvePathAlias(specifier, tsConfig);

  if (aliasedPath === null || tsConfig.baseUrl === undefined) {
    return null;
  }

  const resolvedAbsolutePath = path.resolve(tsConfig.baseUrl, aliasedPath);
  const resolvedProjectPath = await resolveTypeScriptFile(resolvedAbsolutePath);

  if (resolvedProjectPath === null) {
    return null;
  }

  const relativePath = toProjectRelativePath(rootPath, resolvedProjectPath);

  return sourceFileSet.has(relativePath) ? relativePath : null;
};

export const buildFileGraph = async (
  rootPath: string,
  sourceFiles: readonly string[],
  tsConfig: TsConfigResolution,
): Promise<FileGraph> => {
  const sourceFileSet = new Set(sourceFiles);
  const nodes: FileDependency[] = [];

  for (const sourceFile of sourceFiles) {
    const absolutePath = resolveWithinRoot(rootPath, sourceFile);
    const source = await readFile(absolutePath, "utf8");
    const importSpecifiers = extractImportSpecifiers(source);
    const resolvedImports: string[] = [];
    const externalImports: string[] = [];

    for (const specifier of importSpecifiers) {
      const resolvedImport = await resolveImportToProjectPath(
        rootPath,
        sourceFile,
        specifier,
        tsConfig,
        sourceFileSet,
      );

      if (resolvedImport === null) {
        externalImports.push(specifier);
        continue;
      }

      resolvedImports.push(resolvedImport);
    }

    nodes.push({
      path: sourceFile,
      imports: [...resolvedImports, ...externalImports].sort(),
      exports: [...extractExportNames(source)].sort(),
    });
  }

  return {
    nodes: nodes.sort((left, right) => left.path.localeCompare(right.path)),
  };
};

export const scanProjectFiles = async (
  rootPath: string,
  tsConfig: TsConfigResolution,
): Promise<ClassifiedProjectFiles> => {
  const sourceFiles = await listProjectSourceFiles(rootPath, tsConfig);
  return classifyProjectFiles(sourceFiles);
};

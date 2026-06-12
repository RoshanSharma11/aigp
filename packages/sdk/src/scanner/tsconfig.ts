import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { resolveWithinRoot, toPosixPath } from "./paths.js";

interface TsConfigDocument {
  readonly extends?: string;
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
  readonly compilerOptions?: {
    readonly baseUrl?: string;
    readonly paths?: Readonly<Record<string, readonly string[]>>;
    readonly rootDir?: string;
  };
}

export interface TsConfigResolution {
  readonly tsconfigPath?: string;
  readonly baseUrl?: string;
  readonly paths: Readonly<Record<string, readonly string[]>>;
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly rootDir?: string;
}

const DEFAULT_INCLUDE = ["**/*.ts"] as const;
const DEFAULT_EXCLUDE = ["node_modules", "dist"] as const;

const TSCONFIG_CANDIDATES = [
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.build.json",
  "jsconfig.json",
] as const;

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const readJsonFile = async (filePath: string): Promise<unknown> => {
  const rawContents = await readFile(filePath, "utf8");
  return JSON.parse(rawContents) as unknown;
};

const asTsConfigDocument = (value: unknown): TsConfigDocument | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as TsConfigDocument;
};

const mergeCompilerOptions = (
  parent: TsConfigDocument["compilerOptions"],
  child: TsConfigDocument["compilerOptions"],
): TsConfigDocument["compilerOptions"] => ({
  ...parent,
  ...child,
  paths: {
    ...parent?.paths,
    ...child?.paths,
  },
});

const loadTsConfigDocument = async (
  configPath: string,
): Promise<TsConfigDocument> => {
  const parsed = asTsConfigDocument(await readJsonFile(configPath));

  if (parsed === null) {
    throw new Error(`Invalid tsconfig file: ${configPath}`);
  }

  if (parsed.extends === undefined) {
    return parsed;
  }

  const parentPath = path.resolve(path.dirname(configPath), parsed.extends);
  const resolvedParent = await loadTsConfigDocument(parentPath);
  const include = parsed.include ?? resolvedParent.include;
  const exclude = parsed.exclude ?? resolvedParent.exclude;
  const mergedCompilerOptions = mergeCompilerOptions(
    resolvedParent.compilerOptions,
    parsed.compilerOptions,
  );

  return {
    extends: parsed.extends,
    ...(include === undefined ? {} : { include }),
    ...(exclude === undefined ? {} : { exclude }),
    ...(mergedCompilerOptions === undefined
      ? {}
      : { compilerOptions: mergedCompilerOptions }),
  };
};

const findTsConfigPath = async (rootPath: string): Promise<string | undefined> => {
  for (const candidate of TSCONFIG_CANDIDATES) {
    const candidatePath = resolveWithinRoot(rootPath, candidate);

    if (await fileExists(candidatePath)) {
      return candidatePath;
    }
  }

  return undefined;
};

export const resolveTsConfig = async (
  rootPath: string,
): Promise<TsConfigResolution> => {
  const tsconfigPath = await findTsConfigPath(rootPath);

  if (tsconfigPath === undefined) {
    return {
      paths: {},
      include: [...DEFAULT_INCLUDE],
      exclude: [...DEFAULT_EXCLUDE],
    };
  }

  const document = await loadTsConfigDocument(tsconfigPath);
  const compilerOptions = document.compilerOptions ?? {};
  const baseUrl = compilerOptions.baseUrl
    ? toPosixPath(
        path.resolve(path.dirname(tsconfigPath), compilerOptions.baseUrl),
      )
    : undefined;

  const rootDir = compilerOptions.rootDir
    ? toPosixPath(
        path.resolve(path.dirname(tsconfigPath), compilerOptions.rootDir),
      )
    : undefined;

  return {
    tsconfigPath,
    paths: compilerOptions.paths ?? {},
    include: document.include ?? [...DEFAULT_INCLUDE],
    exclude: document.exclude ?? [...DEFAULT_EXCLUDE],
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(rootDir === undefined ? {} : { rootDir }),
  };
};

export const resolvePathAlias = (
  specifier: string,
  tsConfig: TsConfigResolution,
): string | null => {
  for (const [pattern, replacements] of Object.entries(tsConfig.paths)) {
    const wildcardIndex = pattern.indexOf("*");

    if (wildcardIndex === -1) {
      if (specifier === pattern && replacements[0] !== undefined) {
        return replacements[0];
      }

      continue;
    }

    const prefix = pattern.slice(0, wildcardIndex);
    const suffix = pattern.slice(wildcardIndex + 1);

    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) {
      continue;
    }

    const matchedSegment = specifier.slice(
      prefix.length,
      specifier.length - suffix.length,
    );
    const replacement = replacements[0];

    if (replacement === undefined) {
      continue;
    }

    return replacement.replace("*", matchedSegment);
  }

  return null;
};

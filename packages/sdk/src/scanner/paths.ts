import path from "node:path";

export const IGNORED_DIRECTORY_NAMES = new Set([
  ".agent-layer",
  ".git",
  "coverage",
  "dist",
  "node_modules",
]);

export const toPosixPath = (filePath: string): string =>
  filePath.split(path.sep).join("/");

export const toProjectRelativePath = (
  rootPath: string,
  absolutePath: string,
): string => {
  const relativePath = path.relative(rootPath, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Path escapes project root: ${absolutePath}`);
  }

  return toPosixPath(relativePath);
};

export const resolveWithinRoot = (
  rootPath: string,
  ...segments: string[]
): string => {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(resolvedRoot, ...segments);
  const relativePath = path.relative(resolvedRoot, resolvedTarget);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Path escapes project root: ${resolvedTarget}`);
  }

  return resolvedTarget;
};

export const isTypeScriptSourceFile = (filePath: string): boolean => {
  const normalized = toPosixPath(filePath);

  return (
    normalized.endsWith(".ts") &&
    !normalized.endsWith(".d.ts") &&
    !normalized.endsWith(".test.ts")
  );
};

export const isControllerFile = (filePath: string): boolean =>
  filePath.endsWith(".controller.ts");

export const isDtoFile = (filePath: string): boolean => filePath.endsWith(".dto.ts");

export const isEntityFile = (filePath: string): boolean =>
  filePath.endsWith(".entity.ts");

export const isModuleFile = (filePath: string): boolean =>
  filePath.endsWith(".module.ts");

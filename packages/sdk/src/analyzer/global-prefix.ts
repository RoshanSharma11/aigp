import { readFileSync } from "node:fs";
import path from "node:path";

const GLOBAL_PREFIX_PATTERN =
  /setGlobalPrefix\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/u;

const ENTRY_FILE_CANDIDATES = [
  "src/main.ts",
  "src/bootstrap.ts",
  "main.ts",
] as const;

export const detectGlobalPrefix = (
  rootPath: string,
  sourceFiles: readonly string[],
): string | undefined => {
  const candidateFiles = [
    ...new Set([
      ...sourceFiles.filter(
        (filePath) =>
          filePath.endsWith("/main.ts") ||
          filePath.endsWith("/bootstrap.ts") ||
          filePath.endsWith("main.ts"),
      ),
      ...ENTRY_FILE_CANDIDATES,
    ]),
  ];

  for (const relativePath of candidateFiles) {
    const absolutePath = path.join(rootPath, relativePath);
    let source: string;

    try {
      source = readFileSync(absolutePath, "utf8");
    } catch {
      continue;
    }
    const match = GLOBAL_PREFIX_PATTERN.exec(source);

    if (match?.[1] !== undefined) {
      return match[1];
    }
  }

  return undefined;
};

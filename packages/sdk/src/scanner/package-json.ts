import { readFile } from "node:fs/promises";
import path from "node:path";

interface PackageJsonShape {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

export const hasPackageDependency = (
  packageJson: PackageJsonShape,
  dependencyName: string,
): boolean => {
  const sections = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
  ];

  return sections.some((section) => section?.[dependencyName] !== undefined);
};

export const readRootPackageJson = async (
  rootPath: string,
): Promise<PackageJsonShape | null> => {
  const packageJsonPath = path.join(rootPath, "package.json");

  try {
    const rawContents = await readFile(packageJsonPath, "utf8");
    const parsed: unknown = JSON.parse(rawContents);

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    return parsed as PackageJsonShape;
  } catch {
    return null;
  }
};

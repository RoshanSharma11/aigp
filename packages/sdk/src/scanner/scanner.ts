import type { ScanContext } from "@agent-layer/core";

import { detectFramework } from "./detector.js";
import { buildFileGraph, scanProjectFiles } from "./file-graph.js";
import { resolveTsConfig } from "./tsconfig.js";

export const scanProject = async (rootPath: string): Promise<ScanContext> => {
  const [framework, tsConfig] = await Promise.all([
    detectFramework(rootPath),
    resolveTsConfig(rootPath),
  ]);

  const classifiedFiles = await scanProjectFiles(rootPath, tsConfig);
  const fileGraph = await buildFileGraph(
    rootPath,
    classifiedFiles.sourceFiles,
    tsConfig,
  );

  const context: ScanContext = {
    rootPath,
    framework,
    routeFiles: classifiedFiles.routeFiles,
    dtoFiles: classifiedFiles.dtoFiles,
    entityFiles: classifiedFiles.entityFiles,
    fileGraph,
    ...(tsConfig.tsconfigPath === undefined
      ? {}
      : { tsconfigPath: tsConfig.tsconfigPath }),
  };

  return context;
};

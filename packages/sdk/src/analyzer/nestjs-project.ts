import path from "node:path";

import type { RawRoute, ScanContext } from "@agent-layer/core";
import { type MethodDeclaration, Project } from "ts-morph";

export const createNestJsAnalysisProject = (ctx: ScanContext): Project => {
  const project = new Project({
    ...(ctx.tsconfigPath !== undefined
      ? { tsConfigFilePath: ctx.tsconfigPath }
      : {}),
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  });

  const filesToLoad = [
    ...new Set([
      ...ctx.routeFiles,
      ...ctx.dtoFiles,
      ...ctx.entityFiles,
      ...ctx.fileGraph.nodes.map((node) => node.path),
    ]),
  ];

  for (const relativePath of filesToLoad) {
    project.addSourceFileAtPath(path.join(ctx.rootPath, relativePath));
  }

  return project;
};

export const findHandlerMethod = (
  ctx: ScanContext,
  route: RawRoute,
  project: Project,
): MethodDeclaration | undefined => {
  const sourceFile = project.getSourceFile(
    path.join(ctx.rootPath, route.sourceLocation.filePath),
  );

  if (sourceFile === undefined) {
    return undefined;
  }

  const controllerClass = sourceFile.getClass(route.controllerName);

  if (controllerClass === undefined) {
    return undefined;
  }

  return controllerClass.getMethod(route.handlerName);
};

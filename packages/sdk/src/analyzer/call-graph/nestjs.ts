import path from "node:path";

import type {
  CallGraphNode,
  RawRoute,
  RouteCallGraphInfo,
  ScanContext,
} from "@agent-layer/core";
import {
  type ClassDeclaration,
  type MethodDeclaration,
  type Node,
  Project,
  SyntaxKind,
} from "ts-morph";

import {
  createNestJsAnalysisProject,
  findHandlerMethod,
} from "../nestjs-project.js";

const MAX_CALL_GRAPH_HOPS = 3;

interface ResolvedCall {
  readonly className: string;
  readonly methodName: string;
  readonly propertyName?: string;
}

const classifyCallKind = (
  className: string,
): CallGraphNode["kind"] => {
  if (className.endsWith("Repository")) {
    return "repository";
  }

  if (className.endsWith("Service")) {
    return "service";
  }

  return "helper";
};

const formatCallGraphName = (
  className: string,
  methodName: string,
): string => `${className}.${methodName}`;

const resolveInjectedPropertyTypeName = (
  classDeclaration: ClassDeclaration,
  propertyName: string,
): string | undefined => {
  const constructor = classDeclaration.getConstructors()[0];

  if (constructor !== undefined) {
    const constructorParameter = constructor
      .getParameters()
      .find((parameter) => parameter.getName() === propertyName);

    if (constructorParameter !== undefined) {
      return constructorParameter.getType().getSymbol()?.getName();
    }
  }

  const propertyDeclaration = classDeclaration.getProperty(propertyName);

  if (propertyDeclaration !== undefined) {
    return propertyDeclaration.getType().getSymbol()?.getName();
  }

  return undefined;
};

const parseThisPropertyCall = (node: Node): ResolvedCall | undefined => {
  if (node.getKind() !== SyntaxKind.CallExpression) {
    return undefined;
  }

  const callExpression = node.asKindOrThrow(SyntaxKind.CallExpression);
  const expression = callExpression.getExpression();

  if (expression.getKind() !== SyntaxKind.PropertyAccessExpression) {
    return undefined;
  }

  const methodAccess = expression.asKindOrThrow(
    SyntaxKind.PropertyAccessExpression,
  );
  const methodName = methodAccess.getName();
  const receiverExpression = methodAccess.getExpression();

  if (receiverExpression.getKind() !== SyntaxKind.PropertyAccessExpression) {
    return undefined;
  }

  const serviceAccess = receiverExpression.asKindOrThrow(
    SyntaxKind.PropertyAccessExpression,
  );

  if (serviceAccess.getExpression().getKind() !== SyntaxKind.ThisKeyword) {
    return undefined;
  }

  return {
    className: "",
    methodName,
    propertyName: serviceAccess.getName(),
  };
};

const toPosixRelativePath = (rootPath: string, absolutePath: string): string =>
  path.relative(rootPath, absolutePath).split(path.sep).join("/");

const collectThisPropertyCalls = (
  methodDeclaration: MethodDeclaration,
): readonly ResolvedCall[] => {
  const calls: ResolvedCall[] = [];

  methodDeclaration.forEachDescendant((node) => {
    const parsedCall = parseThisPropertyCall(node);

    if (parsedCall === undefined) {
      return;
    }

    calls.push(parsedCall);
  });

  return calls;
};

const findClassDeclaration = (
  project: Project,
  ctx: ScanContext,
  className: string,
): { readonly classDeclaration: ClassDeclaration; readonly filePath: string } | undefined => {
  for (const sourceFile of project.getSourceFiles()) {
    const classDeclaration = sourceFile.getClass(className);

    if (classDeclaration !== undefined) {
      return {
        classDeclaration,
        filePath: toPosixRelativePath(ctx.rootPath, sourceFile.getFilePath()),
      };
    }
  }

  return undefined;
};

const collectEntityNamesFromMethod = (
  methodDeclaration: MethodDeclaration,
  ctx: ScanContext,
): readonly string[] => {
  const entityNames = new Set<string>();

  methodDeclaration.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.NewExpression) {
      const newExpression = node.asKindOrThrow(SyntaxKind.NewExpression);
      const expression = newExpression.getExpression();
      const entityName = expression.getText().trim();

      if (entityName.endsWith("Entity")) {
        entityNames.add(entityName);
      }
    }

    if (node.getKind() === SyntaxKind.Identifier) {
      const identifier = node.asKindOrThrow(SyntaxKind.Identifier);
      const identifierName = identifier.getText();

      if (
        identifierName.endsWith("Entity") &&
        ctx.entityFiles.some((entityFile) =>
          entityFile.toLowerCase().includes(identifierName.replace(/Entity$/u, "").toLowerCase()),
        )
      ) {
        entityNames.add(identifierName);
      }
    }
  });

  const returnTypeName = methodDeclaration
    .getReturnType()
    .getSymbol()
    ?.getName();

  if (
    returnTypeName !== undefined &&
    returnTypeName.endsWith("Entity") &&
    !returnTypeName.includes("[]")
  ) {
    entityNames.add(returnTypeName.replace(/\[\]$/u, ""));
  }

  return [...entityNames];
};

const traceMethodCalls = (
  project: Project,
  ctx: ScanContext,
  ownerClass: ClassDeclaration,
  methodName: string,
  filePath: string,
  hop: number,
  visited: Set<string>,
): { readonly callChain: CallGraphNode[]; readonly databaseEntities: string[] } => {
  if (hop >= MAX_CALL_GRAPH_HOPS) {
    return { callChain: [], databaseEntities: [] };
  }

  const methodDeclaration = ownerClass.getMethod(methodName);

  if (methodDeclaration === undefined) {
    return { callChain: [], databaseEntities: [] };
  }

  const className = ownerClass.getName() ?? "Unknown";
  const visitKey = `${className}.${methodName}@${filePath}`;

  if (visited.has(visitKey)) {
    return { callChain: [], databaseEntities: [] };
  }

  visited.add(visitKey);

  const callChain: CallGraphNode[] = [
    {
      name: formatCallGraphName(className, methodName),
      filePath,
      kind: classifyCallKind(className),
    },
  ];
  const databaseEntities = [...collectEntityNamesFromMethod(methodDeclaration, ctx)];

  for (const resolvedCall of collectThisPropertyCalls(methodDeclaration)) {
    const propertyName = resolvedCall.propertyName;

    if (propertyName === undefined) {
      continue;
    }

    const dependencyClassName = resolveInjectedPropertyTypeName(
      ownerClass,
      propertyName,
    );

    if (dependencyClassName === undefined) {
      continue;
    }

    const dependencyClass = findClassDeclaration(
      project,
      ctx,
      dependencyClassName,
    );

    if (dependencyClass === undefined) {
      continue;
    }

    const nestedTrace = traceMethodCalls(
      project,
      ctx,
      dependencyClass.classDeclaration,
      resolvedCall.methodName,
      dependencyClass.filePath,
      hop + 1,
      visited,
    );

    callChain.push(...nestedTrace.callChain);
    databaseEntities.push(...nestedTrace.databaseEntities);
  }

  return { callChain, databaseEntities };
};

export const extractNestJsCallGraph = (
  ctx: ScanContext,
  route: RawRoute,
): RouteCallGraphInfo => {
  const project = createNestJsAnalysisProject(ctx);
  const handlerMethod = findHandlerMethod(ctx, route, project);

  if (handlerMethod === undefined) {
    return {
      callChain: [],
      databaseEntities: [],
      sourceCode: "",
    };
  }

  const handlerSourceFile = handlerMethod.getSourceFile();
  const handlerFilePath = toPosixRelativePath(
    ctx.rootPath,
    handlerSourceFile.getFilePath(),
  );
  const controllerClass = handlerSourceFile.getClass(route.controllerName);

  if (controllerClass === undefined) {
    return {
      callChain: [],
      databaseEntities: [],
      sourceCode: handlerMethod.getText(),
    };
  }

  const callChain: CallGraphNode[] = [
    {
      name: route.handlerName,
      filePath: handlerFilePath,
      kind: "handler",
    },
  ];
  const databaseEntities: string[] = [];
  const visited = new Set<string>();

  for (const resolvedCall of collectThisPropertyCalls(handlerMethod)) {
    const propertyName = resolvedCall.propertyName;

    if (propertyName === undefined) {
      continue;
    }

    const serviceClassName = resolveInjectedPropertyTypeName(
      controllerClass,
      propertyName,
    );

    if (serviceClassName === undefined) {
      continue;
    }

    const serviceClass = findClassDeclaration(project, ctx, serviceClassName);

    if (serviceClass === undefined) {
      continue;
    }

    const nestedTrace = traceMethodCalls(
      project,
      ctx,
      serviceClass.classDeclaration,
      resolvedCall.methodName,
      serviceClass.filePath,
      1,
      visited,
    );

    callChain.push(...nestedTrace.callChain);
    databaseEntities.push(...nestedTrace.databaseEntities);
  }

  databaseEntities.push(
    ...collectEntityNamesFromMethod(handlerMethod, ctx),
  );

  return {
    callChain,
    databaseEntities: [...new Set(databaseEntities)],
    sourceCode: handlerMethod.getText().trim(),
  };
};

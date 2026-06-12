import path from "node:path";

import type {
  HttpMethod,
  MiddlewareInfo,
  RawRoute,
  ScanContext,
  SourceLocation,
} from "@agent-layer/core";
import {
  type ClassDeclaration,
  type Decorator,
  type MethodDeclaration,
  Project,
  SyntaxKind,
} from "ts-morph";

import { detectGlobalPrefix } from "../global-prefix.js";
import { buildRouteId, joinRoutePaths } from "../path-utils.js";

const HTTP_METHOD_DECORATORS: Readonly<Record<string, HttpMethod>> = {
  Get: "GET",
  Post: "POST",
  Put: "PUT",
  Patch: "PATCH",
  Delete: "DELETE",
  Options: "OPTIONS",
  Head: "HEAD",
};

const MIDDLEWARE_DECORATORS = new Set(["UseGuards", "UseInterceptors"]);

type RouteExtractionContext = {
  readonly globalPrefix: string | undefined;
};

const getDecoratorName = (decorator: Decorator): string | undefined => {
  const expression = decorator.getExpression();

  if (expression.getKind() === SyntaxKind.CallExpression) {
    const callExpression = expression.asKindOrThrow(SyntaxKind.CallExpression);
    const callee = callExpression.getExpression();

    if (callee.getKind() === SyntaxKind.Identifier) {
      return callee.getText();
    }
  }

  if (expression.getKind() === SyntaxKind.Identifier) {
    return expression.getText();
  }

  return undefined;
};

const getDecoratorStringArgument = (decorator: Decorator): string | undefined => {
  const expression = decorator.getExpression();

  if (expression.getKind() !== SyntaxKind.CallExpression) {
    return undefined;
  }

  const callExpression = expression.asKindOrThrow(SyntaxKind.CallExpression);
  const firstArgument = callExpression.getArguments()[0];

  if (firstArgument === undefined) {
    return undefined;
  }

  if (firstArgument.getKind() === SyntaxKind.StringLiteral) {
    return firstArgument.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();
  }

  if (firstArgument.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
    return firstArgument
      .asKindOrThrow(SyntaxKind.NoSubstitutionTemplateLiteral)
      .getLiteralText();
  }

  return undefined;
};

const getDecoratorIdentifierArguments = (
  decorator: Decorator,
): readonly string[] => {
  const expression = decorator.getExpression();

  if (expression.getKind() !== SyntaxKind.CallExpression) {
    return [];
  }

  const callExpression = expression.asKindOrThrow(SyntaxKind.CallExpression);

  return callExpression
    .getArguments()
    .map((argument) => argument.getText().trim())
    .filter((argumentText) => argumentText.length > 0);
};

const toMiddlewareInfo = (
  decorator: Decorator,
  source: MiddlewareInfo["source"],
): MiddlewareInfo | undefined => {
  const decoratorName = getDecoratorName(decorator);

  if (decoratorName === undefined || !MIDDLEWARE_DECORATORS.has(decoratorName)) {
    return undefined;
  }

  const argumentsList = getDecoratorIdentifierArguments(decorator);
  const middlewareName = argumentsList[0] ?? decoratorName;

  return {
    name: middlewareName,
    source,
    ...(argumentsList.length > 0 ? { arguments: argumentsList } : {}),
  };
};

const collectMiddleware = (
  decorators: readonly Decorator[],
  source: MiddlewareInfo["source"],
): readonly MiddlewareInfo[] =>
  decorators
    .map((decorator) => toMiddlewareInfo(decorator, source))
    .filter((middleware): middleware is MiddlewareInfo => middleware !== undefined);

const getControllerBasePath = (classDeclaration: ClassDeclaration): string => {
  const controllerDecorator = classDeclaration
    .getDecorators()
    .find((decorator) => getDecoratorName(decorator) === "Controller");

  if (controllerDecorator === undefined) {
    return "";
  }

  return getDecoratorStringArgument(controllerDecorator) ?? "";
};

const getHttpRouteDecorators = (
  methodDeclaration: MethodDeclaration,
): readonly { readonly decorator: Decorator; readonly method: HttpMethod }[] =>
  methodDeclaration
    .getDecorators()
    .map((decorator) => {
      const decoratorName = getDecoratorName(decorator);

      if (decoratorName === undefined) {
        return undefined;
      }

      const httpMethod = HTTP_METHOD_DECORATORS[decoratorName];

      if (httpMethod === undefined) {
        return undefined;
      }

      return {
        decorator,
        method: httpMethod,
      };
    })
    .filter(
      (
        routeDecorator,
      ): routeDecorator is {
        readonly decorator: Decorator;
        readonly method: HttpMethod;
      } => routeDecorator !== undefined,
    );

const toSourceLocation = (
  methodDeclaration: MethodDeclaration,
  relativeFilePath: string,
): SourceLocation => {
  const sourceFile = methodDeclaration.getSourceFile();
  const { line, column } = sourceFile.getLineAndColumnAtPos(
    methodDeclaration.getStart(),
  );

  return {
    filePath: relativeFilePath,
    line,
    column,
  };
};

const extractRoutesFromController = (
  classDeclaration: ClassDeclaration,
  relativeFilePath: string,
  extractionContext: RouteExtractionContext,
): RawRoute[] => {
  const controllerName = classDeclaration.getName();

  if (controllerName === undefined) {
    return [];
  }

  const controllerBasePath = getControllerBasePath(classDeclaration);
  const controllerMiddleware = collectMiddleware(
    classDeclaration.getDecorators(),
    "controller",
  );

  return classDeclaration.getMethods().flatMap((methodDeclaration) => {
    const handlerName = methodDeclaration.getName();
    const handlerMiddleware = collectMiddleware(
      methodDeclaration.getDecorators(),
      "handler",
    );
    const middleware = [...controllerMiddleware, ...handlerMiddleware];

    return getHttpRouteDecorators(methodDeclaration).map(
      ({ decorator, method }) => {
        const methodPath = getDecoratorStringArgument(decorator) ?? "";
        const routePath = joinRoutePaths(
          extractionContext.globalPrefix,
          controllerBasePath,
          methodPath,
        );

        return {
          id: buildRouteId(controllerName, handlerName, method, routePath),
          framework: "nestjs" as const,
          method,
          path: routePath,
          controllerName,
          handlerName,
          sourceLocation: toSourceLocation(methodDeclaration, relativeFilePath),
          middleware,
        };
      },
    );
  });
};

const createTsMorphProject = (ctx: ScanContext): Project => {
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

  for (const relativePath of ctx.routeFiles) {
    project.addSourceFileAtPath(path.join(ctx.rootPath, relativePath));
  }

  return project;
};

export const extractNestJsRoutes = (ctx: ScanContext): RawRoute[] => {
  const sourceFiles = [
    ...ctx.routeFiles,
    ...ctx.dtoFiles,
    ...ctx.entityFiles,
  ];
  const globalPrefix = detectGlobalPrefix(ctx.rootPath, sourceFiles);
  const extractionContext: RouteExtractionContext = { globalPrefix };
  const project = createTsMorphProject(ctx);
  const routes: RawRoute[] = [];

  for (const relativeFilePath of ctx.routeFiles) {
    const sourceFile = project.getSourceFile(
      path.join(ctx.rootPath, relativeFilePath),
    );

    if (sourceFile === undefined) {
      continue;
    }

    for (const classDeclaration of sourceFile.getClasses()) {
      const hasControllerDecorator = classDeclaration
        .getDecorators()
        .some((decorator) => getDecoratorName(decorator) === "Controller");

      if (!hasControllerDecorator) {
        continue;
      }

      routes.push(
        ...extractRoutesFromController(
          classDeclaration,
          relativeFilePath,
          extractionContext,
        ),
      );
    }
  }

  return routes.sort((left, right) => {
    const pathComparison = left.path.localeCompare(right.path);

    if (pathComparison !== 0) {
      return pathComparison;
    }

    return left.method.localeCompare(right.method);
  });
};

export const extractNestJsMiddleware = (
  route: RawRoute,
): readonly MiddlewareInfo[] => route.middleware;

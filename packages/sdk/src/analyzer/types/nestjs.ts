import type { JsonSchema, RawRoute, RouteTypeInfo, ScanContext, TypeInfo } from "@agent-layer/core";
import {
  type MethodDeclaration,
  type ParameterDeclaration,
  SyntaxKind,
  type Type,
} from "ts-morph";

import {
  createNestJsAnalysisProject,
  findHandlerMethod,
} from "../nestjs-project.js";
import { typeReferenceToJsonSchema } from "./dto-to-schema.js";

const PARAMETER_DECORATORS = new Set(["Body", "Query", "Param"]);

const isJsonSchemaObject = (
  schema: JsonSchema,
): schema is Record<string, JsonSchema> & {
  readonly type?: string;
  readonly properties?: Record<string, JsonSchema>;
} =>
  typeof schema === "object" && schema !== null && !Array.isArray(schema);

const isEmptySchema = (schema: JsonSchema): boolean => {
  if (!isJsonSchemaObject(schema)) {
    return true;
  }

  return Object.keys(schema).length === 0;
};

const getDecoratorName = (decoratorName: string): string =>
  decoratorName.replace(/^@/u, "").split("(")[0] ?? decoratorName;

const getParameterDecoratorName = (
  parameter: ParameterDeclaration,
): string | undefined => {
  for (const decorator of parameter.getDecorators()) {
    const name = getDecoratorName(decorator.getText());

    if (PARAMETER_DECORATORS.has(name)) {
      return name;
    }
  }

  return undefined;
};

const getParamDecoratorKey = (
  parameter: ParameterDeclaration,
): string | undefined => {
  const paramDecorator = parameter
    .getDecorators()
    .find((decorator) => getDecoratorName(decorator.getText()) === "Param");

  if (paramDecorator === undefined) {
    return undefined;
  }

  const match = /Param\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/u.exec(
    paramDecorator.getText(),
  );

  return match?.[1] ?? parameter.getName();
};

const mergeRequestSchemas = (
  requestParts: readonly JsonSchema[],
): JsonSchema | undefined => {
  if (requestParts.length === 0) {
    return undefined;
  }

  if (requestParts.length === 1) {
    return requestParts[0];
  }

  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const schema of requestParts) {
    if (
      !isJsonSchemaObject(schema) ||
      schema.type !== "object" ||
      schema.properties === undefined ||
      !isJsonSchemaObject(schema.properties)
    ) {
      continue;
    }

    for (const [propertyName, propertySchema] of Object.entries(
      schema.properties,
    )) {
      properties[propertyName] = propertySchema;
      required.push(propertyName);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
};

const buildRequestTypeInfo = (
  methodDeclaration: MethodDeclaration,
): TypeInfo | undefined => {
  const sourceFile = methodDeclaration.getSourceFile();
  const requestParts: JsonSchema[] = [];

  for (const parameter of methodDeclaration.getParameters()) {
    const decoratorName = getParameterDecoratorName(parameter);

    if (decoratorName === undefined) {
      continue;
    }

    const parameterType = parameter.getType();

    if (decoratorName === "Body" || decoratorName === "Query") {
      requestParts.push(typeReferenceToJsonSchema(parameterType, sourceFile));
      continue;
    }

    if (decoratorName === "Param") {
      const paramKey = getParamDecoratorKey(parameter);

      if (paramKey === undefined) {
        continue;
      }

      requestParts.push({
        type: "object",
        properties: {
          [paramKey]: typeReferenceToJsonSchema(parameterType, sourceFile),
        },
        required: [paramKey],
      });
    }
  }

  const mergedSchema = mergeRequestSchemas(requestParts);

  if (mergedSchema === undefined) {
    return undefined;
  }

  const primaryParameter = methodDeclaration
    .getParameters()
    .find((parameter) => getParameterDecoratorName(parameter) !== undefined);
  const typeName = primaryParameter?.getType().getSymbol()?.getName();

  return {
    ...(typeName !== undefined ? { typeName } : {}),
    schema: mergedSchema,
    isArray: false,
  };
};

const unwrapReturnType = (returnType: Type): { readonly type: Type; readonly isArray: boolean } => {
  if (returnType.isArray()) {
    const elementType = returnType.getArrayElementType();

    if (elementType !== undefined) {
      return { type: elementType, isArray: true };
    }
  }

  if (returnType.isUnion()) {
    const nonUndefinedTypes = returnType
      .getUnionTypes()
      .filter((unionType) => !unionType.isUndefined());

    if (nonUndefinedTypes.length === 1 && nonUndefinedTypes[0] !== undefined) {
      return unwrapReturnType(nonUndefinedTypes[0]);
    }
  }

  return { type: returnType, isArray: false };
};

const buildResponseTypeInfo = (
  methodDeclaration: MethodDeclaration,
): TypeInfo | undefined => {
  const sourceFile = methodDeclaration.getSourceFile();
  const returnType = methodDeclaration.getReturnType();
  const { type, isArray } = unwrapReturnType(returnType);
  const schema = typeReferenceToJsonSchema(type, sourceFile);

  if (isEmptySchema(schema)) {
    return undefined;
  }

  const typeName = type.getSymbol()?.getName();

  return {
    ...(typeName !== undefined ? { typeName } : {}),
    schema: isArray
      ? {
          type: "array",
          items: schema,
        }
      : schema,
    isArray,
  };
};

const isEntityType = (
  typeName: string | undefined,
  ctx: ScanContext,
): boolean => {
  if (typeName === undefined) {
    return false;
  }

  return ctx.entityFiles.some((entityFile) =>
    entityFile.toLowerCase().includes(typeName.replace(/Entity$/u, "").toLowerCase()),
  );
};

const collectDatabaseEntities = (
  responseTypeInfo: TypeInfo | undefined,
  ctx: ScanContext,
): readonly string[] => {
  const typeName = responseTypeInfo?.typeName;

  if (typeName === undefined) {
    return [];
  }

  if (!isEntityType(typeName, ctx) && !typeName.endsWith("Entity")) {
    return [];
  }

  return [typeName];
};

export const extractNestJsRouteTypes = (
  ctx: ScanContext,
  route: RawRoute,
): RouteTypeInfo => {
  const project = createNestJsAnalysisProject(ctx);
  const methodDeclaration = findHandlerMethod(ctx, route, project);

  if (methodDeclaration === undefined) {
    return { databaseEntities: [] };
  }

  const request = buildRequestTypeInfo(methodDeclaration);
  const response = buildResponseTypeInfo(methodDeclaration);
  const databaseEntities = collectDatabaseEntities(response, ctx);

  return {
    ...(request !== undefined ? { request } : {}),
    ...(response !== undefined ? { response } : {}),
    databaseEntities,
  };
};

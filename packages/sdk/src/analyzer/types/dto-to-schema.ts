import type { JsonSchema } from "@agent-layer/core";
import {
  type ClassDeclaration,
  type Decorator,
  type InterfaceDeclaration,
  type PropertyDeclaration,
  type PropertySignature,
  type SourceFile,
  SyntaxKind,
  type Type,
} from "ts-morph";

type PropertyLike = PropertyDeclaration | PropertySignature;
type DeclarationLike = ClassDeclaration | InterfaceDeclaration;

const CLASS_VALIDATOR_TYPE_MAP: Readonly<
  Record<string, (argument?: string) => JsonSchema>
> = {
  IsString: () => ({ type: "string" }),
  IsInt: () => ({ type: "integer" }),
  IsNumber: () => ({ type: "number" }),
  IsBoolean: () => ({ type: "boolean" }),
  IsEmail: () => ({ type: "string", format: "email" }),
  IsEnum: () => ({ type: "string" }),
  MinLength: (argument) => ({
    type: "string",
    minLength: Number(argument),
  }),
  Min: (argument) => ({
    minimum: Number(argument),
  }),
  Max: (argument) => ({
    maximum: Number(argument),
  }),
};

const mergeSchemas = (
  base: JsonSchema,
  extension: JsonSchema,
): JsonSchema => {
  if (
    typeof base !== "object" ||
    base === null ||
    Array.isArray(base) ||
    typeof extension !== "object" ||
    extension === null ||
    Array.isArray(extension)
  ) {
    return extension;
  }

  return {
    ...base,
    ...extension,
  };
};

const getDecoratorName = (decoratorText: string): string =>
  decoratorText.replace(/^@/u, "").split("(")[0] ?? decoratorText;

const getDecoratorArgument = (decoratorText: string): string | undefined => {
  const match = /\(\s*([^)]+?)\s*\)/u.exec(decoratorText);
  return match?.[1]?.trim();
};

const getPropertyDecorators = (property: PropertyLike): readonly Decorator[] => {
  if (property.getKind() === SyntaxKind.PropertyDeclaration) {
    return property.asKindOrThrow(SyntaxKind.PropertyDeclaration).getDecorators();
  }

  return [];
};

const applyClassValidatorDecorators = (
  property: PropertyLike,
  baseSchema: JsonSchema,
): JsonSchema => {
  let schema = baseSchema;

  for (const decorator of getPropertyDecorators(property)) {
    const decoratorText = decorator.getText();
    const decoratorName = getDecoratorName(decoratorText);
    const mapper = CLASS_VALIDATOR_TYPE_MAP[decoratorName];

    if (mapper === undefined) {
      continue;
    }

    schema = mergeSchemas(schema, mapper(getDecoratorArgument(decoratorText)));
  }

  return schema;
};

const isOptionalProperty = (property: PropertyLike): boolean => {
  if (property.hasQuestionToken()) {
    return true;
  }

  return getPropertyDecorators(property).some(
    (decorator) => getDecoratorName(decorator.getText()) === "IsOptional",
  );
};

const declarationToObjectSchema = (
  declaration: DeclarationLike,
  sourceFile: SourceFile,
  visited: Set<string>,
): JsonSchema => {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const property of declaration.getProperties()) {
    const propertyName = property.getName();
    const propertySchema = applyClassValidatorDecorators(
      property,
      typeToJsonSchema(property.getType(), sourceFile, visited),
    );

    properties[propertyName] = propertySchema;

    if (!isOptionalProperty(property)) {
      required.push(propertyName);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
};

const typeToJsonSchema = (
  type: Type,
  sourceFile: SourceFile,
  visited: Set<string>,
): JsonSchema => {
  if (type.isArray()) {
    const elementType = type.getArrayElementType();

    return {
      type: "array",
      items:
        elementType === undefined
          ? {}
          : typeToJsonSchema(elementType, sourceFile, visited),
    };
  }

  if (type.isUnion()) {
    const nonUndefinedTypes = type
      .getUnionTypes()
      .filter((unionType) => !unionType.isUndefined());

    if (nonUndefinedTypes.length === 1 && nonUndefinedTypes[0] !== undefined) {
      return typeToJsonSchema(nonUndefinedTypes[0], sourceFile, visited);
    }
  }

  const symbol = type.getSymbol();
  const typeName = symbol?.getName();

  if (typeName !== undefined && visited.has(typeName)) {
    return { type: "object" };
  }

  if (type.isString() || type.isStringLiteral()) {
    return { type: "string" };
  }

  if (type.isBoolean() || type.isBooleanLiteral()) {
    return { type: "boolean" };
  }

  if (type.isNumber() || type.isNumberLiteral()) {
    return { type: "number" };
  }

  if (typeName !== undefined) {
    const declaration = symbol?.getDeclarations()[0];

    if (declaration?.getKind() === SyntaxKind.ClassDeclaration) {
      const nextVisited = new Set(visited);
      nextVisited.add(typeName);

      return declarationToObjectSchema(
        declaration.asKindOrThrow(SyntaxKind.ClassDeclaration),
        sourceFile,
        nextVisited,
      );
    }

    if (declaration?.getKind() === SyntaxKind.InterfaceDeclaration) {
      const nextVisited = new Set(visited);
      nextVisited.add(typeName);

      return declarationToObjectSchema(
        declaration.asKindOrThrow(SyntaxKind.InterfaceDeclaration),
        sourceFile,
        nextVisited,
      );
    }
  }

  return {};
};

export const classDeclarationToJsonSchema = (
  className: string,
  sourceFile: SourceFile,
): JsonSchema | undefined => {
  const classDeclaration = sourceFile.getClass(className);

  if (classDeclaration === undefined) {
    return undefined;
  }

  return declarationToObjectSchema(classDeclaration, sourceFile, new Set());
};

export const typeReferenceToJsonSchema = (
  type: Type,
  sourceFile: SourceFile,
): JsonSchema => typeToJsonSchema(type, sourceFile, new Set());

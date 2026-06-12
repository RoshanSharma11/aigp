export interface JsonSchemaObject {
  readonly [key: string]: JsonSchema;
}

export interface JsonSchemaArray extends ReadonlyArray<JsonSchema> {}

export type JsonSchemaPrimitive = string | number | boolean | null;

export type JsonSchema =
  | JsonSchemaPrimitive
  | JsonSchemaObject
  | JsonSchemaArray;

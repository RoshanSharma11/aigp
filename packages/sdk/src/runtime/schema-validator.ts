import { Ajv, type ErrorObject } from "ajv";

import type { JsonSchema } from "@agent-layer/core";

export interface SchemaValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateSchema: false,
});

const formatValidationErrors = (errors: readonly ErrorObject[]): readonly string[] =>
  errors.map((error) => {
    const path = error.instancePath.length > 0 ? error.instancePath : "/";
    return `${path}: ${error.message ?? "validation failed"}`;
  });

export const validateJsonSchema = (
  schema: JsonSchema,
  data: unknown,
): SchemaValidationResult => {
  const validate = ajv.compile(schema as Record<string, unknown>);
  const valid = validate(data) === true;

  if (valid) {
    return {
      valid: true,
      errors: [],
    };
  }

  return {
    valid: false,
    errors: formatValidationErrors(validate.errors ?? []),
  };
};

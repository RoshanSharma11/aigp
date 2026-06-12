import type { JsonSchema } from "@agent-layer/core";

import { describe, expect, it } from "vitest";

import { validateJsonSchema } from "./schema-validator.js";

describe("schema validator", () => {
  it("should accept values matching a JSON Schema", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
    };

    const result = validateJsonSchema(schema, { query: "shoes" });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should reject values that violate a JSON Schema", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
    };

    const result = validateJsonSchema(schema, { query: 42 });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

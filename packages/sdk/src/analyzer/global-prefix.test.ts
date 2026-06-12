import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { detectGlobalPrefix } from "./global-prefix.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

describe("detectGlobalPrefix", () => {
  it("should detect a simple setGlobalPrefix call", () => {
    const prefix = detectGlobalPrefix("/tmp/project", ["src/main.ts"]);

    expect(prefix).toBeUndefined();
  });

  it("should detect setGlobalPrefix when exclude options are provided", () => {
    const prefix = detectGlobalPrefix(fixtureRoot, ["src/main.ts"]);

    expect(prefix).toBe("api");
  });
});

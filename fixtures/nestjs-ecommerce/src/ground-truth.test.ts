import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

interface GroundTruthRoute {
  readonly id: string;
  readonly path: string;
}

interface GroundTruthDocument {
  readonly fixture: string;
  readonly routes: readonly GroundTruthRoute[];
}

describe("nestjs ecommerce ground truth", () => {
  it("should describe the expected fixture routes", async () => {
    const documentPath = path.resolve(
      process.cwd(),
      "fixtures/nestjs-ecommerce/ground-truth.json"
    );
    const document = JSON.parse(
      await readFile(documentPath, "utf8")
    ) as GroundTruthDocument;

    expect(document.fixture).toBe("nestjs-ecommerce");
    expect(document.routes).toHaveLength(7);
    expect(document.routes.map((route) => route.id)).toContain("cart_add_item");
    expect(document.routes.every((route) => route.path.startsWith("/api/"))).toBe(
      true
    );
  });
});

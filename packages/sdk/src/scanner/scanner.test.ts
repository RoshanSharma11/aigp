import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { scanProjectFiles, buildFileGraph } from "./file-graph.js";
import { scanProject } from "./scanner.js";
import { resolvePathAlias, resolveTsConfig } from "./tsconfig.js";

const tempDirectories: string[] = [];

const createTempDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(tmpdir(), "agent-layer-scanner-"));
  tempDirectories.push(directory);
  return directory;
};

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("project scanner", () => {
  it("should list all controller files in the ecommerce fixture", async () => {
    const context = await scanProject(fixtureRoot);

    expect(context.framework).toBe("nestjs");
    expect(context.routeFiles).toEqual([
      "src/auth/auth.controller.ts",
      "src/cart/cart.controller.ts",
      "src/products/products.controller.ts",
    ]);
  });

  it("should classify dto and entity files in the ecommerce fixture", async () => {
    const context = await scanProject(fixtureRoot);

    expect(context.dtoFiles).toEqual([
      "src/auth/dto/login.dto.ts",
      "src/cart/dto/add-cart-item.dto.ts",
      "src/cart/dto/update-cart-item.dto.ts",
      "src/products/dto/search-products-query.dto.ts",
    ]);
    expect(context.entityFiles).toEqual([
      "src/auth/entities/session.entity.ts",
      "src/cart/entities/cart.entity.ts",
      "src/products/entities/product.entity.ts",
    ]);
  });

  it("should resolve the fixture tsconfig path", async () => {
    const context = await scanProject(fixtureRoot);

    expect(context.tsconfigPath).toBe(
      path.join(fixtureRoot, "tsconfig.json"),
    );
  });

  it("should build an import dependency graph for project files", async () => {
    const context = await scanProject(fixtureRoot);
    const productsController = context.fileGraph.nodes.find(
      (node) => node.path === "src/products/products.controller.ts",
    );

    expect(productsController).toBeDefined();
    expect(productsController?.imports).toEqual([
      "@nestjs/common",
      "src/products/dto/search-products-query.dto.ts",
      "src/products/entities/product.entity.ts",
      "src/products/products.service.ts",
    ]);
    expect(productsController?.exports).toEqual(["ProductsController"]);
  });

  it("should produce a serializable ScanContext", async () => {
    const context = await scanProject(fixtureRoot);

    expect(() => JSON.stringify(context)).not.toThrow();
    expect(JSON.parse(JSON.stringify(context))).toEqual(context);
  });

  it("should skip dist and node_modules directories", async () => {
    const rootPath = await createTempDirectory();

    await mkdir(path.join(rootPath, "src"), { recursive: true });
    await mkdir(path.join(rootPath, "dist"), { recursive: true });
    await mkdir(path.join(rootPath, "node_modules/pkg"), { recursive: true });
    await writeFile(
      path.join(rootPath, "tsconfig.json"),
      JSON.stringify({ include: ["src/**/*.ts"] }),
      "utf8",
    );
    await writeFile(
      path.join(rootPath, "src/app.controller.ts"),
      "export class AppController {}",
      "utf8",
    );
    await writeFile(
      path.join(rootPath, "dist/app.controller.ts"),
      "export class DistController {}",
      "utf8",
    );
    await writeFile(
      path.join(rootPath, "node_modules/pkg/app.controller.ts"),
      "export class NodeModulesController {}",
      "utf8",
    );

    const tsConfig = await resolveTsConfig(rootPath);
    const classifiedFiles = await scanProjectFiles(rootPath, tsConfig);

    expect(classifiedFiles.routeFiles).toEqual(["src/app.controller.ts"]);
  });
});

describe("tsconfig resolution", () => {
  it("should resolve path aliases from compilerOptions.paths", () => {
    const tsConfig = {
      baseUrl: "/app/src",
      paths: {
        "@app/*": ["modules/*"],
      },
      include: ["src/**/*.ts"],
      exclude: ["node_modules"],
    };

    expect(resolvePathAlias("@app/users/service", tsConfig)).toBe(
      "modules/users/service",
    );
  });
});

describe("file graph builder", () => {
  it("should resolve relative imports with .js specifiers to .ts files", async () => {
    const rootPath = await createTempDirectory();

    await mkdir(path.join(rootPath, "src/cart"), { recursive: true });
    await writeFile(
      path.join(rootPath, "tsconfig.json"),
      JSON.stringify({ include: ["src/**/*.ts"] }),
      "utf8",
    );
    await writeFile(
      path.join(rootPath, "src/cart/cart.service.ts"),
      "export class CartService {}",
      "utf8",
    );
    await writeFile(
      path.join(rootPath, "src/cart/cart.controller.ts"),
      [
        "import { CartService } from './cart.service.js';",
        "export class CartController {}",
      ].join("\n"),
      "utf8",
    );

    const tsConfig = await resolveTsConfig(rootPath);
    const classifiedFiles = await scanProjectFiles(rootPath, tsConfig);
    const fileGraph = await buildFileGraph(
      rootPath,
      classifiedFiles.sourceFiles,
      tsConfig,
    );
    const controllerNode = fileGraph.nodes.find(
      (node) => node.path === "src/cart/cart.controller.ts",
    );

    expect(controllerNode?.imports).toEqual(["src/cart/cart.service.ts"]);
  });
});

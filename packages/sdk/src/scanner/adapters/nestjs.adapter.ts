import type {
  MiddlewareInfo,
  RawRoute,
  RouteCallGraphInfo,
  RouteTypeInfo,
  ScanContext,
} from "@agent-layer/core";

import { extractNestJsCallGraph } from "../../analyzer/call-graph/nestjs.js";
import {
  extractNestJsMiddleware,
  extractNestJsRoutes,
} from "../../analyzer/tree-sitter/nestjs.js";
import { extractNestJsRouteTypes } from "../../analyzer/types/nestjs.js";
import {
  hasPackageDependency,
  readRootPackageJson,
} from "../package-json.js";
import type { FrameworkAdapter } from "./types.js";

const NESTJS_CORE_PACKAGE = "@nestjs/core";

export const nestJsFrameworkAdapter: FrameworkAdapter = {
  name: "nestjs",

  async detect(root: string): Promise<boolean> {
    const packageJson = await readRootPackageJson(root);

    if (packageJson === null) {
      return false;
    }

    return hasPackageDependency(packageJson, NESTJS_CORE_PACKAGE);
  },

  extractRoutes(ctx: ScanContext): RawRoute[] {
    return extractNestJsRoutes(ctx);
  },

  extractTypes(ctx: ScanContext, route: RawRoute): RouteTypeInfo {
    return extractNestJsRouteTypes(ctx, route);
  },

  extractCallGraph(ctx: ScanContext, route: RawRoute): RouteCallGraphInfo {
    return extractNestJsCallGraph(ctx, route);
  },

  extractMiddleware(_ctx: ScanContext, route: RawRoute): MiddlewareInfo[] {
    return [...extractNestJsMiddleware(route)];
  },
};

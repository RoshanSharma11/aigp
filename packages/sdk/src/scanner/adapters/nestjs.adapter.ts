import type {
  MiddlewareInfo,
  RawRoute,
  ScanContext,
  TypeInfo,
} from "@agent-layer/core";

import {
  hasPackageDependency,
  readRootPackageJson,
} from "../package-json.js";
import type { FrameworkAdapter } from "./types.js";

const NESTJS_CORE_PACKAGE = "@nestjs/core";

const notImplemented = (method: string): never => {
  throw new Error(`NestJS adapter ${method} is not implemented yet`);
};

export const nestJsFrameworkAdapter: FrameworkAdapter = {
  name: "nestjs",

  async detect(root: string): Promise<boolean> {
    const packageJson = await readRootPackageJson(root);

    if (packageJson === null) {
      return false;
    }

    return hasPackageDependency(packageJson, NESTJS_CORE_PACKAGE);
  },

  extractRoutes(_ctx: ScanContext): RawRoute[] {
    return notImplemented("extractRoutes");
  },

  extractTypes(_ctx: ScanContext, _route: RawRoute): TypeInfo {
    return notImplemented("extractTypes");
  },

  extractMiddleware(_ctx: ScanContext, _route: RawRoute): MiddlewareInfo[] {
    return notImplemented("extractMiddleware");
  },
};

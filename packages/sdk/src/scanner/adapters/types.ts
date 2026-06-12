import type {
  MiddlewareInfo,
  RawRoute,
  RouteCallGraphInfo,
  RouteTypeInfo,
  ScanContext,
} from "@agent-layer/core";

export type FrameworkName = "nestjs";

export interface FrameworkAdapter {
  readonly name: FrameworkName;
  detect(root: string): Promise<boolean>;
  extractRoutes(ctx: ScanContext): RawRoute[];
  extractTypes(ctx: ScanContext, route: RawRoute): RouteTypeInfo;
  extractCallGraph(ctx: ScanContext, route: RawRoute): RouteCallGraphInfo;
  extractMiddleware(ctx: ScanContext, route: RawRoute): MiddlewareInfo[];
}

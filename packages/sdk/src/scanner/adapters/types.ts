import type {
  MiddlewareInfo,
  RawRoute,
  ScanContext,
  TypeInfo,
} from "@agent-layer/core";

export type FrameworkName = "nestjs";

export interface FrameworkAdapter {
  readonly name: FrameworkName;
  detect(root: string): Promise<boolean>;
  extractRoutes(ctx: ScanContext): RawRoute[];
  extractTypes(ctx: ScanContext, route: RawRoute): TypeInfo;
  extractMiddleware(ctx: ScanContext, route: RawRoute): MiddlewareInfo[];
}

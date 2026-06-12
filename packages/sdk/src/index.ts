export interface SdkModuleMarker {
  readonly name: "@agent-layer/sdk";
}

export const SDK_MODULE_MARKER: SdkModuleMarker = {
  name: "@agent-layer/sdk",
};

export type { FrameworkAdapter, FrameworkName } from "./scanner/adapters/types.js";
export { nestJsFrameworkAdapter } from "./scanner/adapters/nestjs.adapter.js";
export {
  detectAdapter,
  getRegisteredAdapters,
} from "./scanner/adapters/registry.js";
export {
  detectFramework,
  type DetectedFramework,
} from "./scanner/detector.js";

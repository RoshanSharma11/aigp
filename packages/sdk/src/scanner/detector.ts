import { detectAdapter } from "./adapters/registry.js";
import type { FrameworkName } from "./adapters/types.js";

export type DetectedFramework = FrameworkName | "unknown";

export const detectFramework = async (
  root: string,
): Promise<DetectedFramework> => {
  const adapter = await detectAdapter(root);
  return adapter?.name ?? "unknown";
};

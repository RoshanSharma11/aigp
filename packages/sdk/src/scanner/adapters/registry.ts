import { nestJsFrameworkAdapter } from "./nestjs.adapter.js";
import type { FrameworkAdapter } from "./types.js";

const REGISTERED_ADAPTERS: readonly FrameworkAdapter[] = [
  nestJsFrameworkAdapter,
];

export const getRegisteredAdapters = (): readonly FrameworkAdapter[] =>
  REGISTERED_ADAPTERS;

export const detectAdapter = async (
  root: string,
): Promise<FrameworkAdapter | null> => {
  for (const adapter of REGISTERED_ADAPTERS) {
    if (await adapter.detect(root)) {
      return adapter;
    }
  }

  return null;
};

import type { Capability } from "@agent-layer/core";

export const AGENT_LAYER_MODULE_OPTIONS = Symbol("AGENT_LAYER_MODULE_OPTIONS");
export const INTERNAL_ROUTE_PROXY = Symbol("INTERNAL_ROUTE_PROXY");

export interface AgentLayerModuleOptions {
  readonly rootPath?: string | undefined;
  readonly baseUrl: string;
  readonly internalBaseUrl?: string | undefined;
  readonly agentPrefix?: string | undefined;
  readonly wellKnownPrefix?: string | undefined;
  readonly agentName?: string | undefined;
  readonly agentDescription?: string | undefined;
  readonly capabilities?: readonly Capability[] | undefined;
}

export const DEFAULT_WELL_KNOWN_CONTROLLER_PATH = ".well-known";

export const resolveWellKnownControllerPath = (
  wellKnownPrefix?: string | undefined,
): string => {
  const prefix = wellKnownPrefix ?? "/.well-known";
  const normalized = prefix.startsWith("/") ? prefix.slice(1) : prefix;

  return normalized.length > 0 ? normalized : DEFAULT_WELL_KNOWN_CONTROLLER_PATH;
};

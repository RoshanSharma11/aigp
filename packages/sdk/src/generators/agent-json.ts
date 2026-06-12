import type { Capability } from "@agent-layer/core";

import {
  buildCapabilitiesListEndpoint,
  buildCapabilityEndpoint,
  joinUrl,
  resolveWellKnownPrefix,
  type DiscoveryGeneratorContext,
} from "./types.js";

export const AGENT_JSON_SPEC_VERSION = "1.0.0";

export interface AgentJsonCapabilitySummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly endpoint: string;
  readonly defaultOperation: string;
  readonly requiresAuth: boolean;
  readonly sideEffects: Capability["sideEffects"];
}

export interface AgentJsonDocument {
  readonly $schema: "https://agent-layer.dev/schemas/agent.json";
  readonly specVersion: typeof AGENT_JSON_SPEC_VERSION;
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly generatedAt: string;
  readonly capabilitiesEndpoint: string;
  readonly capabilities: readonly AgentJsonCapabilitySummary[];
  readonly links: {
    readonly agentCard: string;
    readonly openApi: string;
    readonly mcpTools: string;
  };
}

const summarizeCapability = (
  capability: Capability,
  context: DiscoveryGeneratorContext,
): AgentJsonCapabilitySummary => ({
  id: capability.id,
  name: capability.name,
  description: capability.description,
  category: capability.category,
  endpoint: buildCapabilityEndpoint(context, capability.id),
  defaultOperation: capability.defaultOperation,
  requiresAuth: capability.requiresAuth,
  sideEffects: capability.sideEffects,
});

export const generateAgentJson = (
  capabilities: readonly Capability[],
  context: DiscoveryGeneratorContext,
): AgentJsonDocument => {
  const wellKnownPrefix = resolveWellKnownPrefix(context);

  return {
    $schema: "https://agent-layer.dev/schemas/agent.json",
    specVersion: AGENT_JSON_SPEC_VERSION,
    name: context.agentName ?? "Agent Layer",
    description:
      context.agentDescription ??
      "Discover and invoke curated business capabilities exposed by this application.",
    url: context.baseUrl,
    generatedAt: context.generatedAt,
    capabilitiesEndpoint: buildCapabilitiesListEndpoint(context),
    capabilities: capabilities.map((capability) =>
      summarizeCapability(capability, context),
    ),
    links: {
      agentCard: joinUrl(context.baseUrl, `${wellKnownPrefix}/agent-card.json`),
      openApi: joinUrl(context.baseUrl, `${wellKnownPrefix}/openapi.json`),
      mcpTools: joinUrl(context.baseUrl, `${wellKnownPrefix}/mcp-tools.json`),
    },
  };
};

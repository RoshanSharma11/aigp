import type { Capability } from "@agent-layer/core";

import { buildCapabilitiesListEndpoint, type DiscoveryGeneratorContext } from "./types.js";

export const AGENT_CARD_SPEC_VERSION = "1.0.0";

export interface AgentCardSkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
}

export interface AgentCardDocument {
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly version: typeof AGENT_CARD_SPEC_VERSION;
  readonly generatedAt: string;
  readonly capabilitiesEndpoint: string;
  readonly skills: readonly AgentCardSkill[];
  readonly authentication: {
    readonly schemes: readonly string[];
  };
}

const toSkill = (capability: Capability): AgentCardSkill => ({
  id: capability.id,
  name: capability.name,
  description: capability.description,
  tags: [capability.category],
});

export const generateAgentCard = (
  capabilities: readonly Capability[],
  context: DiscoveryGeneratorContext,
): AgentCardDocument => {
  const requiresAuth = capabilities.some((capability) => capability.requiresAuth);

  return {
    name: context.agentName ?? "Agent Layer",
    description:
      context.agentDescription ??
      "Discover and invoke curated business capabilities exposed by this application.",
    url: context.baseUrl,
    version: AGENT_CARD_SPEC_VERSION,
    generatedAt: context.generatedAt,
    capabilitiesEndpoint: buildCapabilitiesListEndpoint(context),
    skills: capabilities.map(toSkill),
    authentication: {
      schemes: requiresAuth ? ["bearer"] : [],
    },
  };
};

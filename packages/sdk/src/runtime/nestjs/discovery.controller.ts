import { Controller, Get, Header, Inject } from "@nestjs/common";

import { generateAgentCard } from "../../generators/agent-card.js";
import { generateAgentJson } from "../../generators/agent-json.js";
import { generateOpenApi } from "../../generators/openapi.js";
import type { DiscoveryGeneratorContext } from "../../generators/types.js";
import { CapabilityRegistryService } from "./capability-registry.service.js";
import {
  AGENT_LAYER_MODULE_OPTIONS,
  type AgentLayerModuleOptions,
  DEFAULT_WELL_KNOWN_CONTROLLER_PATH,
} from "./tokens.js";

@Controller(DEFAULT_WELL_KNOWN_CONTROLLER_PATH)
export class DiscoveryController {
  private readonly context: DiscoveryGeneratorContext;

  constructor(
    @Inject(CapabilityRegistryService)
    private readonly capabilityRegistry: CapabilityRegistryService,
    @Inject(AGENT_LAYER_MODULE_OPTIONS)
    options: AgentLayerModuleOptions,
  ) {
    this.context = {
      baseUrl: options.baseUrl,
      generatedAt: new Date().toISOString(),
      ...(options.agentPrefix !== undefined ? { agentPrefix: options.agentPrefix } : {}),
      ...(options.wellKnownPrefix !== undefined
        ? { wellKnownPrefix: options.wellKnownPrefix }
        : {}),
      ...(options.agentName !== undefined ? { agentName: options.agentName } : {}),
      ...(options.agentDescription !== undefined
        ? { agentDescription: options.agentDescription }
        : {}),
    };
  }

  private buildContext(): DiscoveryGeneratorContext {
    return {
      ...this.context,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get("agent.json")
  @Header("Content-Type", "application/json")
  getAgentJson() {
    return generateAgentJson(
      this.capabilityRegistry.getApprovedCapabilities(),
      this.buildContext(),
    );
  }

  @Get("agent-card.json")
  @Header("Content-Type", "application/json")
  getAgentCard() {
    return generateAgentCard(
      this.capabilityRegistry.getApprovedCapabilities(),
      this.buildContext(),
    );
  }

  @Get("openapi.json")
  @Header("Content-Type", "application/json")
  getOpenApi() {
    return generateOpenApi(
      this.capabilityRegistry.getApprovedCapabilities(),
      this.buildContext(),
    );
  }
}

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";

import type { Capability } from "@agent-layer/core";

import { summarizeCapability } from "../../generators/agent-json.js";
import type { DiscoveryGeneratorContext } from "../../generators/types.js";
import type { CapabilityExecutionRequest, CapabilityExecutionResult } from "../types.js";
import { CapabilityGuard } from "./capability.guard.js";
import { CapabilityRegistryService } from "./capability-registry.service.js";
import { ExecutorService } from "./executor.service.js";
import {
  AGENT_LAYER_MODULE_OPTIONS,
  type AgentLayerModuleOptions,
} from "./tokens.js";

@Controller("agent/capabilities")
export class CapabilityController {
  private readonly context: DiscoveryGeneratorContext;

  constructor(
    @Inject(CapabilityRegistryService)
    private readonly capabilityRegistry: CapabilityRegistryService,
    @Inject(ExecutorService)
    private readonly executorService: ExecutorService,
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

  @Get()
  listCapabilities() {
    return this.capabilityRegistry
      .getApprovedCapabilities()
      .map((capability) => summarizeCapability(capability, this.buildContext()));
  }

  @Get(":id")
  @UseGuards(CapabilityGuard)
  getCapability(@Param("id") capabilityId: string): Capability {
    return this.capabilityRegistry.getCapability(capabilityId)!;
  }

  @Post(":id")
  @HttpCode(200)
  @UseGuards(CapabilityGuard)
  async executeCapability(
    @Param("id") capabilityId: string,
    @Body() body: CapabilityExecutionRequest,
    @Headers("authorization") authorization?: string | undefined,
  ): Promise<CapabilityExecutionResult> {
    return this.executorService.execute(capabilityId, body, authorization);
  }
}

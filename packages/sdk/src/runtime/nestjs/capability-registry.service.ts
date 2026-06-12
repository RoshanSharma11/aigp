import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import type { Capability } from "@agent-layer/core";

import { filterApprovedCapabilities } from "../../builder/merger.js";
import { loadPublishedCapabilities } from "../../store/reader.js";
import { AGENT_LAYER_MODULE_OPTIONS, type AgentLayerModuleOptions } from "./tokens.js";

@Injectable()
export class CapabilityRegistryService implements OnModuleInit {
  private approvedCapabilities: readonly Capability[] = [];

  constructor(
    @Inject(AGENT_LAYER_MODULE_OPTIONS)
    private readonly options: AgentLayerModuleOptions,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.options.capabilities !== undefined) {
      this.approvedCapabilities = [...filterApprovedCapabilities(this.options.capabilities)];
      return;
    }

    const rootPath = this.options.rootPath ?? process.cwd();
    const loaded = await loadPublishedCapabilities(rootPath);
    this.approvedCapabilities = loaded.approvedCapabilities;
  }

  getApprovedCapabilities(): readonly Capability[] {
    return this.approvedCapabilities;
  }

  getCapability(capabilityId: string): Capability | undefined {
    return this.approvedCapabilities.find(
      (capability) => capability.id === capabilityId,
    );
  }
}

import { DynamicModule, Module } from "@nestjs/common";

import { CapabilityController } from "./capability.controller.js";
import { CapabilityGuard } from "./capability.guard.js";
import { CapabilityRegistryService } from "./capability-registry.service.js";
import { DiscoveryController } from "./discovery.controller.js";
import { ExecutorService } from "./executor.service.js";
import { ExpressInternalRouteProxy } from "./internal-route-proxy.js";
import {
  AGENT_LAYER_MODULE_OPTIONS,
  INTERNAL_ROUTE_PROXY,
  type AgentLayerModuleOptions,
} from "./tokens.js";

@Module({})
export class AgentLayerModule {
  static forRoot(options: AgentLayerModuleOptions): DynamicModule {
    return {
      module: AgentLayerModule,
      controllers: [DiscoveryController, CapabilityController],
      providers: [
        {
          provide: AGENT_LAYER_MODULE_OPTIONS,
          useValue: options,
        },
        CapabilityRegistryService,
        ExecutorService,
        CapabilityGuard,
        ExpressInternalRouteProxy,
        {
          provide: INTERNAL_ROUTE_PROXY,
          useExisting: ExpressInternalRouteProxy,
        },
      ],
      exports: [CapabilityRegistryService, ExecutorService],
    };
  }
}

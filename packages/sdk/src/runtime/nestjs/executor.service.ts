import { Inject, Injectable } from "@nestjs/common";

import type { CapabilityExecutionRequest, CapabilityExecutionResult } from "../types.js";
import { executeCapability } from "../executor.js";
import { CapabilityRegistryService } from "./capability-registry.service.js";
import { INTERNAL_ROUTE_PROXY } from "./tokens.js";
import type { InternalRouteProxy } from "../types.js";

@Injectable()
export class ExecutorService {
  constructor(
    @Inject(CapabilityRegistryService)
    private readonly capabilityRegistry: CapabilityRegistryService,
    @Inject(INTERNAL_ROUTE_PROXY)
    private readonly routeProxy: InternalRouteProxy,
  ) {}

  async execute(
    capabilityId: string,
    request: CapabilityExecutionRequest,
    authorization?: string | undefined,
  ): Promise<CapabilityExecutionResult> {
    const capability = this.capabilityRegistry.getCapability(capabilityId);

    if (!capability) {
      const executedAt = new Date().toISOString();

      return {
        capabilityId,
        operation: request.operation ?? "",
        success: false,
        error: {
          code: "CAPABILITY_NOT_FOUND",
          message: `Capability "${capabilityId}" is not available`,
        },
        metadata: {
          executedAt,
          httpMethod: "GET",
          httpPath: "/",
          httpStatus: 0,
        },
      };
    }

    return executeCapability(
      capability,
      request,
      this.routeProxy,
      authorization,
    );
  }
}

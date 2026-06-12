import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CapabilityRegistryService } from "./capability-registry.service.js";

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    @Inject(CapabilityRegistryService)
    private readonly capabilityRegistry: CapabilityRegistryService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ params: { id?: string } }>();
    const capabilityId = request.params.id;

    if (capabilityId === undefined || capabilityId.length === 0) {
      throw new NotFoundException("Capability id is required");
    }

    const capability = this.capabilityRegistry.getCapability(capabilityId);

    if (capability === undefined) {
      throw new NotFoundException(`Capability "${capabilityId}" is not available`);
    }

    if (capability.status !== "approved") {
      throw new ForbiddenException(
        `Capability "${capabilityId}" is not approved for agent access`,
      );
    }

    if (capability.needsHumanReview) {
      throw new ForbiddenException(
        `Capability "${capabilityId}" is pending human review`,
      );
    }

    return true;
  }
}

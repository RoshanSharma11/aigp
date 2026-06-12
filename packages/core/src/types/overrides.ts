import type { Capability } from "./capability.js";

export interface CapabilityOverride extends Partial<Capability> {
  readonly id: string;
}

export interface OverridesArtifact {
  readonly version: string;
  readonly updatedAt: string;
  readonly capabilities: readonly CapabilityOverride[];
}

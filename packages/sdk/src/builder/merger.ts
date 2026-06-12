import type { Capability, CapabilityOverride } from "@agent-layer/core";

const applyOptionalOverride = <Key extends keyof Capability>(
  capability: Capability,
  override: CapabilityOverride,
  key: Key,
): Capability[Key] => {
  const value = override[key];

  if (value === undefined) {
    return capability[key];
  }

  return value as Capability[Key];
};

export const mergeCapabilityOverride = (
  capability: Capability,
  override: CapabilityOverride,
): Capability => {
  if (override.id !== capability.id) {
    return capability;
  }

  const merged: Capability = {
    id: capability.id,
    name: applyOptionalOverride(capability, override, "name"),
    description: applyOptionalOverride(capability, override, "description"),
    category: applyOptionalOverride(capability, override, "category"),
    operations: capability.operations,
    defaultOperation: applyOptionalOverride(capability, override, "defaultOperation"),
    inputSchema: applyOptionalOverride(capability, override, "inputSchema"),
    outputSchema: applyOptionalOverride(capability, override, "outputSchema"),
    sideEffects: applyOptionalOverride(capability, override, "sideEffects"),
    requiresAuth: applyOptionalOverride(capability, override, "requiresAuth"),
    reversible: applyOptionalOverride(capability, override, "reversible"),
    confirmationRequired: applyOptionalOverride(
      capability,
      override,
      "confirmationRequired",
    ),
    riskLevel: applyOptionalOverride(capability, override, "riskLevel"),
    confidence: applyOptionalOverride(capability, override, "confidence"),
    needsHumanReview: applyOptionalOverride(capability, override, "needsHumanReview"),
    sourceRoutes: applyOptionalOverride(capability, override, "sourceRoutes"),
    status: applyOptionalOverride(capability, override, "status"),
  };

  const prerequisites = applyOptionalOverride(capability, override, "prerequisites");
  const followedBy = applyOptionalOverride(capability, override, "followedBy");

  return {
    ...merged,
    ...(prerequisites !== undefined ? { prerequisites } : {}),
    ...(followedBy !== undefined ? { followedBy } : {}),
  };
};

export const mergeCapabilityOverrides = (
  capabilities: readonly Capability[],
  overrides: readonly CapabilityOverride[],
): Capability[] => {
  const overrideById = new Map(
    overrides.map((override) => [override.id, override] as const),
  );

  return capabilities.map((capability) => {
    const override = overrideById.get(capability.id);

    if (override === undefined) {
      return capability;
    }

    return mergeCapabilityOverride(capability, override);
  });
};

export const filterApprovedCapabilities = (
  capabilities: readonly Capability[],
): Capability[] =>
  capabilities.filter((capability) => capability.status === "approved");

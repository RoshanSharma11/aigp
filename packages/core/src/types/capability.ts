import type { JsonSchema } from "./json-schema.js";

export type CapabilitySideEffects =
  | "read"
  | "write"
  | "delete"
  | "transactional";

export type RiskLevel = "low" | "medium" | "high";

export type CapabilityStatus = "draft" | "approved" | "disabled";

export interface CapabilityOperation {
  readonly id: string;
  readonly description: string;
  readonly httpMethod: string;
  readonly httpPath: string;
  readonly inputSchema: JsonSchema;
  readonly outputSchema: JsonSchema;
  readonly sideEffects: Exclude<CapabilitySideEffects, "transactional">;
}

export interface Capability {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly operations: readonly CapabilityOperation[];
  readonly defaultOperation: string;
  readonly inputSchema: JsonSchema;
  readonly outputSchema: JsonSchema;
  readonly sideEffects: CapabilitySideEffects;
  readonly requiresAuth: boolean;
  readonly prerequisites?: readonly string[];
  readonly followedBy?: readonly string[];
  readonly reversible: boolean;
  readonly confirmationRequired: boolean;
  readonly riskLevel: RiskLevel;
  readonly confidence: number;
  readonly needsHumanReview: boolean;
  readonly sourceRoutes: readonly string[];
  readonly status: CapabilityStatus;
}

export interface CapabilitiesArtifact {
  readonly version: string;
  readonly generatedAt: string;
  readonly capabilities: readonly Capability[];
}

import { z } from "zod";

export const DOMAIN_PROMPT_VERSION = "v1" as const;

export interface DomainClassificationInput {
  readonly packageName: string;
  readonly entityNames: readonly string[];
  readonly routePrefixes: readonly string[];
}

export const domainClassificationSchema = z.object({
  domain: z
    .string()
    .min(1)
    .describe(
      "Short snake_case domain label (e.g. ecommerce, saas, healthcare)",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in the domain classification from 0 to 1"),
  primaryEntities: z
    .array(z.string().min(1))
    .min(1)
    .describe("Core business entities inferred from the API surface"),
  suggestedCategories: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      "High-level capability categories for grouping routes (e.g. catalog, cart, auth)",
    ),
});

export type DomainClassificationResult = z.infer<
  typeof domainClassificationSchema
>;

export const buildDomainClassificationSystemPrompt = (): string =>
  [
    "You classify the business domain of a backend API from structural metadata.",
    "Respond with JSON only. No markdown fences or commentary.",
    "",
    "Infer the domain from entity names, route prefixes, and package name.",
    "Use snake_case for the domain label (e.g. ecommerce, saas, fintech).",
    "primaryEntities should list the most important business nouns.",
    "suggestedCategories should be short grouping labels for later capability clustering.",
    "Prefer precision: if uncertain, lower confidence rather than guessing an exotic domain.",
  ].join("\n");

export const buildDomainClassificationUserPrompt = (
  input: DomainClassificationInput,
): string =>
  [
    `package_name: ${input.packageName}`,
    `entity_names: ${input.entityNames.join(", ")}`,
    `route_prefixes: ${input.routePrefixes.join(", ")}`,
  ].join("\n");

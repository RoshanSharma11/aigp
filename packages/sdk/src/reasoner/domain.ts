import type { RouteGraphNode } from "@agent-layer/core";

import type { LlmClient } from "./llm/client.js";
import {
  buildDomainClassificationSystemPrompt,
  buildDomainClassificationUserPrompt,
  domainClassificationSchema,
  type DomainClassificationInput,
  type DomainClassificationResult,
} from "./prompts/domain.v1.js";

const DOMAIN_CLASSIFICATION_STAGE = "domain-classification";

const sortUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const extractRoutePrefixes = (
  paths: readonly string[],
): readonly string[] => {
  const prefixes = new Set<string>();

  for (const routePath of paths) {
    const segments = routePath.split("/").filter((segment) => segment.length > 0);

    if (segments.length >= 2) {
      prefixes.add(`/${segments.slice(0, 2).join("/")}`);
      continue;
    }

    if (segments.length === 1) {
      prefixes.add(`/${segments[0]}`);
    }
  }

  return sortUnique([...prefixes]);
};

export const extractEntityNames = (
  routeGraph: readonly RouteGraphNode[],
): readonly string[] =>
  sortUnique(routeGraph.flatMap((node) => node.databaseEntities));

export const buildDomainClassificationInput = (
  routeGraph: readonly RouteGraphNode[],
  packageName: string,
): DomainClassificationInput => ({
  packageName,
  entityNames: extractEntityNames(routeGraph),
  routePrefixes: extractRoutePrefixes(
    routeGraph.map((node) => node.route.path),
  ),
});

export interface ClassifyDomainOptions {
  readonly temperature?: number | undefined;
}

export const classifyDomain = async (
  input: DomainClassificationInput,
  client: LlmClient,
  options: ClassifyDomainOptions = {},
): Promise<DomainClassificationResult> =>
  client.completeJson({
    system: buildDomainClassificationSystemPrompt(),
    user: buildDomainClassificationUserPrompt(input),
    schema: domainClassificationSchema,
    ...(options.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
  });

export const classifyDomainFromRouteGraph = async (
  routeGraph: readonly RouteGraphNode[],
  packageName: string,
  client: LlmClient,
  options: ClassifyDomainOptions = {},
): Promise<DomainClassificationResult> =>
  classifyDomain(
    buildDomainClassificationInput(routeGraph, packageName),
    client,
    options,
  );

export { DOMAIN_CLASSIFICATION_STAGE };

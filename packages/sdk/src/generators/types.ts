export const DEFAULT_AGENT_PREFIX = "/agent";
export const DEFAULT_WELL_KNOWN_PREFIX = "/.well-known";

export interface DiscoveryGeneratorContext {
  readonly baseUrl: string;
  readonly agentPrefix?: string | undefined;
  readonly wellKnownPrefix?: string | undefined;
  readonly generatedAt: string;
  readonly agentName?: string | undefined;
  readonly agentDescription?: string | undefined;
}

export const joinUrl = (baseUrl: string, pathname: string): string => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  return `${normalizedBase}${normalizedPath}`;
};

export const resolveAgentPrefix = (context: DiscoveryGeneratorContext): string =>
  context.agentPrefix ?? DEFAULT_AGENT_PREFIX;

export const resolveWellKnownPrefix = (
  context: DiscoveryGeneratorContext,
): string => context.wellKnownPrefix ?? DEFAULT_WELL_KNOWN_PREFIX;

export const buildCapabilityEndpoint = (
  context: DiscoveryGeneratorContext,
  capabilityId: string,
): string => joinUrl(context.baseUrl, `${resolveAgentPrefix(context)}/capabilities/${capabilityId}`);

export const buildCapabilitiesListEndpoint = (
  context: DiscoveryGeneratorContext,
): string => joinUrl(context.baseUrl, `${resolveAgentPrefix(context)}/capabilities`);

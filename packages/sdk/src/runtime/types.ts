export interface CapabilityExecutionRequest {
  readonly operation?: string | undefined;
  readonly input?: unknown;
}

export interface CapabilityExecutionError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface CapabilityExecutionMetadata {
  readonly executedAt: string;
  readonly httpMethod: string;
  readonly httpPath: string;
  readonly httpStatus: number;
}

export interface CapabilityExecutionResult {
  readonly capabilityId: string;
  readonly operation: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: CapabilityExecutionError;
  readonly metadata: CapabilityExecutionMetadata;
}

export interface InternalRouteRequest {
  readonly method: string;
  readonly path: string;
  readonly query?: Record<string, unknown> | undefined;
  readonly body?: unknown;
  readonly headers?: Record<string, string> | undefined;
}

export interface InternalRouteResponse {
  readonly status: number;
  readonly body: unknown;
}

export interface InternalRouteProxy {
  execute(request: InternalRouteRequest): Promise<InternalRouteResponse>;
}

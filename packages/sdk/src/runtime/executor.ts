import type { Capability, CapabilityOperation } from "@agent-layer/core";

import { RuntimeError } from "./errors.js";
import { validateJsonSchema } from "./schema-validator.js";
import type {
  CapabilityExecutionError,
  CapabilityExecutionMetadata,
  CapabilityExecutionRequest,
  CapabilityExecutionResult,
  InternalRouteProxy,
  InternalRouteRequest,
} from "./types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const resolveCapabilityOperation = (
  capability: Capability,
  operationId?: string | undefined,
): CapabilityOperation => {
  const targetOperationId = operationId ?? capability.defaultOperation;
  const operation = capability.operations.find(
    (candidate) => candidate.id === targetOperationId,
  );

  if (!operation) {
    throw new RuntimeError(
      `Operation "${targetOperationId}" is not defined for capability "${capability.id}"`,
      {
        code: "OPERATION_NOT_FOUND",
        context: {
          capabilityId: capability.id,
          operationId: targetOperationId,
          availableOperations: capability.operations.map((candidate) => candidate.id),
        },
      },
    );
  }

  return operation;
};

const buildRouteUrl = (
  path: string,
  query?: Record<string, unknown> | undefined,
): string => {
  if (!query || Object.keys(query).length === 0) {
    return path;
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, String(item));
      }
      continue;
    }

    searchParams.append(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `${path}?${queryString}` : path;
};

export const buildInternalRouteRequest = (
  operation: CapabilityOperation,
  input: unknown,
  authorization?: string | undefined,
): InternalRouteRequest => {
  const headers: Record<string, string> = {};
  const method = operation.httpMethod.toUpperCase();

  if (authorization !== undefined && authorization.length > 0) {
    headers.authorization = authorization;
  }

  if (method === "GET" || method === "DELETE") {
    return {
      method,
      path: operation.httpPath,
      query: isRecord(input) ? input : {},
      headers,
    };
  }

  return {
    method,
    path: operation.httpPath,
    body: input ?? {},
    headers: {
      ...headers,
      "content-type": "application/json",
    },
  };
};

const buildExecutionMetadata = (
  operation: CapabilityOperation,
  httpStatus: number,
  executedAt: string,
): CapabilityExecutionMetadata => ({
  executedAt,
  httpMethod: operation.httpMethod.toUpperCase(),
  httpPath: operation.httpPath,
  httpStatus,
});

const buildFailureResult = (
  capabilityId: string,
  operationId: string,
  error: CapabilityExecutionError,
  metadata: CapabilityExecutionMetadata,
): CapabilityExecutionResult => ({
  capabilityId,
  operation: operationId,
  success: false,
  error,
  metadata,
});

const parseProxyResponseBody = (body: unknown): unknown => {
  if (typeof body === "string") {
    const trimmed = body.trim();

    if (trimmed.length === 0) {
      return null;
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return body;
    }
  }

  return body;
};

export const executeCapability = async (
  capability: Capability,
  request: CapabilityExecutionRequest,
  proxy: InternalRouteProxy,
  authorization?: string | undefined,
): Promise<CapabilityExecutionResult> => {
  const executedAt = new Date().toISOString();
  let operation: CapabilityOperation;

  try {
    operation = resolveCapabilityOperation(capability, request.operation);
  } catch (error) {
    const runtimeError =
      error instanceof RuntimeError
        ? error
        : new RuntimeError("Failed to resolve capability operation", {
            code: "OPERATION_RESOLUTION_FAILED",
            cause: error,
          });

    return buildFailureResult(
      capability.id,
      request.operation ?? capability.defaultOperation,
      {
        code: runtimeError.code,
        message: runtimeError.message,
        details: runtimeError.context,
      },
      buildExecutionMetadata(
        {
          id: request.operation ?? capability.defaultOperation,
          description: "",
          httpMethod: "GET",
          httpPath: "/",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          sideEffects: "read",
        },
        0,
        executedAt,
      ),
    );
  }

  const metadataBase = buildExecutionMetadata(operation, 0, executedAt);
  const inputValidation = validateJsonSchema(operation.inputSchema, request.input ?? {});

  if (!inputValidation.valid) {
    return buildFailureResult(capability.id, operation.id, {
      code: "INPUT_VALIDATION_FAILED",
      message: "Capability input failed JSON Schema validation",
      details: inputValidation.errors,
    }, metadataBase);
  }

  const routeRequest = buildInternalRouteRequest(
    operation,
    request.input ?? {},
    authorization,
  );

  let proxyResponse;

  try {
    proxyResponse = await proxy.execute({
      ...routeRequest,
      path: buildRouteUrl(routeRequest.path, routeRequest.query),
      query: undefined,
    });
  } catch (error) {
    return buildFailureResult(capability.id, operation.id, {
      code: "ROUTE_PROXY_FAILED",
      message: "Failed to proxy request to internal route",
      details: error instanceof Error ? error.message : String(error),
    }, metadataBase);
  }

  const metadata = buildExecutionMetadata(
    operation,
    proxyResponse.status,
    executedAt,
  );

  if (proxyResponse.status < 200 || proxyResponse.status >= 300) {
    return buildFailureResult(capability.id, operation.id, {
      code: "ROUTE_EXECUTION_FAILED",
      message: `Internal route returned HTTP ${proxyResponse.status}`,
      details: parseProxyResponseBody(proxyResponse.body),
    }, metadata);
  }

  const responseData = parseProxyResponseBody(proxyResponse.body);
  const outputValidation = validateJsonSchema(operation.outputSchema, responseData);

  if (!outputValidation.valid) {
    return buildFailureResult(capability.id, operation.id, {
      code: "OUTPUT_VALIDATION_FAILED",
      message: "Internal route response failed JSON Schema validation",
      details: outputValidation.errors,
    }, metadata);
  }

  return {
    capabilityId: capability.id,
    operation: operation.id,
    success: true,
    data: responseData,
    metadata,
  };
};

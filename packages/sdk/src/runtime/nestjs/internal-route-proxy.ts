import { HttpAdapterHost } from "@nestjs/core";
import { Inject, Injectable, Optional } from "@nestjs/common";

import { RuntimeError } from "../errors.js";
import type {
  InternalRouteProxy,
  InternalRouteRequest,
  InternalRouteResponse,
} from "../types.js";
import {
  AGENT_LAYER_MODULE_OPTIONS,
  type AgentLayerModuleOptions,
} from "./tokens.js";

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return text;
  }
};

const buildTargetUrl = (baseUrl: string, path: string): string => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
};

const resolveListeningBaseUrl = (
  httpAdapterHost: HttpAdapterHost,
): string | undefined => {
  const server = httpAdapterHost.httpAdapter.getHttpServer();
  const address = server.address();

  if (address === null || typeof address === "string") {
    return undefined;
  }

  return `http://127.0.0.1:${address.port}`;
};

@Injectable()
export class ExpressInternalRouteProxy implements InternalRouteProxy {
  constructor(
    @Inject(HttpAdapterHost)
    private readonly httpAdapterHost: HttpAdapterHost,
    @Optional()
    @Inject(AGENT_LAYER_MODULE_OPTIONS)
    private readonly options?: AgentLayerModuleOptions,
  ) {}

  async execute(request: InternalRouteRequest): Promise<InternalRouteResponse> {
    const baseUrl =
      this.options?.internalBaseUrl ?? resolveListeningBaseUrl(this.httpAdapterHost);

    if (baseUrl === undefined) {
      throw new RuntimeError(
        "Cannot proxy to internal route because the HTTP server is not listening",
        {
          code: "SERVER_NOT_LISTENING",
        },
      );
    }

    const method = request.method.toUpperCase();
    const headers = new Headers(request.headers ?? {});
    const targetUrl = buildTargetUrl(baseUrl, request.path);
    const init: RequestInit = {
      method,
      headers,
    };

    if (request.body !== undefined && method !== "GET" && method !== "DELETE") {
      init.body = JSON.stringify(request.body);
      headers.set("content-type", headers.get("content-type") ?? "application/json");
    }

    const response = await fetch(targetUrl, init);

    return {
      status: response.status,
      body: await parseResponseBody(response),
    };
  }
}

export class StaticInternalRouteProxy implements InternalRouteProxy {
  private readonly handler: (
    request: InternalRouteRequest,
  ) => Promise<InternalRouteResponse> | InternalRouteResponse;

  constructor(
    handler: (
      request: InternalRouteRequest,
    ) => Promise<InternalRouteResponse> | InternalRouteResponse,
  ) {
    this.handler = handler;
  }

  execute(request: InternalRouteRequest): Promise<InternalRouteResponse> {
    return Promise.resolve(this.handler(request));
  }
}

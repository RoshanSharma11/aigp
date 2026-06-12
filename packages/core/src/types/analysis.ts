import type { JsonSchema } from "./json-schema.js";

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

export interface SourceLocation {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
}

export interface MiddlewareInfo {
  readonly name: string;
  readonly source: "controller" | "handler" | "global";
  readonly arguments?: readonly string[];
}

export interface TypeInfo {
  readonly typeName?: string;
  readonly schema: JsonSchema;
  readonly isArray: boolean;
}

export interface RouteTypeInfo {
  readonly request?: TypeInfo;
  readonly response?: TypeInfo;
  readonly databaseEntities: readonly string[];
}

export interface RouteCallGraphInfo {
  readonly callChain: readonly CallGraphNode[];
  readonly databaseEntities: readonly string[];
  readonly sourceCode: string;
}

export interface RawRoute {
  readonly id: string;
  readonly framework: "nestjs";
  readonly method: HttpMethod;
  readonly path: string;
  readonly controllerName: string;
  readonly handlerName: string;
  readonly sourceLocation: SourceLocation;
  readonly middleware: readonly MiddlewareInfo[];
}

export interface FileDependency {
  readonly path: string;
  readonly imports: readonly string[];
  readonly exports: readonly string[];
}

export interface FileGraph {
  readonly nodes: readonly FileDependency[];
}

export interface ScanContext {
  readonly rootPath: string;
  readonly framework: "nestjs" | "unknown";
  readonly routeFiles: readonly string[];
  readonly dtoFiles: readonly string[];
  readonly entityFiles: readonly string[];
  readonly fileGraph: FileGraph;
  readonly tsconfigPath?: string;
}

export interface CallGraphNode {
  readonly name: string;
  readonly filePath: string;
  readonly kind: "handler" | "service" | "repository" | "helper";
}

export interface RouteGraphNode {
  readonly route: RawRoute;
  readonly requestSchema?: JsonSchema;
  readonly responseSchema?: JsonSchema;
  readonly middleware: readonly MiddlewareInfo[];
  readonly callChain: readonly CallGraphNode[];
  readonly databaseEntities: readonly string[];
  readonly sourceCode?: string;
}

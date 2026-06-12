export class StoreError extends Error {
  readonly code: string;
  readonly context: Record<string, string> | undefined;

  constructor(
    message: string,
    options: {
      code?: string;
      context?: Record<string, string>;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "StoreError";
    this.code = options.code ?? "STORE_ERROR";
    this.context = options.context;
  }
}

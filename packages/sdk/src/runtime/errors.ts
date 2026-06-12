export class RuntimeError extends Error {
  readonly code: string;
  readonly context?: Readonly<Record<string, unknown>> | undefined;

  constructor(
    message: string,
    options: {
      readonly code: string;
      readonly context?: Readonly<Record<string, unknown>> | undefined;
      readonly cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "RuntimeError";
    this.code = options.code;
    this.context = options.context;
  }
}

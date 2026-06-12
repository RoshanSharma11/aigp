import path from "node:path";

import {
  runStaticAnalysis,
  writeRouteGraphArtifact,
} from "../analyzer/route-graph.js";

export interface AnalyzeCommandOptions {
  readonly rootPath: string;
  readonly staticOnly: boolean;
  readonly json: boolean;
}

export interface AnalyzeCommandResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

const ANALYZE_FLAGS = new Set([
  "--static-only",
  "--json",
  "--verbose",
  "--help",
  "-h",
]);

export const parseAnalyzeCommandOptions = (
  args: readonly string[],
  cwd: string = process.cwd(),
):
  | { readonly ok: true; readonly options: AnalyzeCommandOptions }
  | { readonly ok: false; readonly message: string; readonly exitCode: number } => {
  if (args.includes("--help") || args.includes("-h")) {
    return {
      ok: false,
      message: [
        "agent-layer analyze [path] --static-only [--json]",
        "",
        "Run static analysis (no LLM) and write .agent-layer/route-graph.json",
      ].join("\n"),
      exitCode: 0,
    };
  }

  if (!args.includes("--static-only")) {
    return {
      ok: false,
      message:
        "analyze requires --static-only until the full LLM pipeline is available",
      exitCode: 2,
    };
  }

  const positionalArguments = args.filter((argument) => {
    if (argument.startsWith("--")) {
      return false;
    }

    if (argument.startsWith("-")) {
      return false;
    }

    return !ANALYZE_FLAGS.has(argument);
  });

  const unknownFlags = args.filter(
    (argument) =>
      argument.startsWith("--") &&
      !ANALYZE_FLAGS.has(argument) &&
      !argument.startsWith("--config"),
  );

  if (unknownFlags.length > 0) {
    return {
      ok: false,
      message: `Unknown analyze flag: ${unknownFlags[0]}`,
      exitCode: 2,
    };
  }

  if (positionalArguments.length > 1) {
    return {
      ok: false,
      message: "analyze accepts at most one project path argument",
      exitCode: 2,
    };
  }

  return {
    ok: true,
    options: {
      rootPath: path.resolve(positionalArguments[0] ?? cwd),
      staticOnly: true,
      json: args.includes("--json"),
    },
  };
};

export const runAnalyzeCommand = async (
  args: readonly string[],
  cwd: string = process.cwd(),
): Promise<AnalyzeCommandResult> => {
  const parsed = parseAnalyzeCommandOptions(args, cwd);

  if (!parsed.ok) {
    return {
      exitCode: parsed.exitCode,
      stderr: `${parsed.message}\n`,
      stdout: "",
    };
  }

  const analysisResult = await runStaticAnalysis(parsed.options.rootPath);
  const artifactPath = await writeRouteGraphArtifact(
    parsed.options.rootPath,
    analysisResult.routeGraph,
    analysisResult.meta.generatedAt,
  );

  const stderrLines = [
    `Static analysis complete: ${analysisResult.meta.routeCount} routes, ${analysisResult.meta.warningCount} warnings`,
    `Wrote ${artifactPath}`,
  ];

  for (const warning of analysisResult.warnings) {
    const location = warning.route ?? warning.file ?? "project";
    stderrLines.push(`warning [${warning.code}] ${location}: ${warning.message}`);
  }

  return {
    exitCode: 0,
    stderr: `${stderrLines.join("\n")}\n`,
    stdout: parsed.options.json
      ? `${JSON.stringify(analysisResult, null, 2)}\n`
      : "",
  };
};

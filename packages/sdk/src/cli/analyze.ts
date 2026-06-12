import path from "node:path";

import {
  ConfigError,
  createDefaultAgentLayerConfig,
  loadAgentLayerConfig,
  type AgentLayerConfig,
} from "@agent-layer/core";

import {
  runFullAnalysis,
  runStaticAnalysisWithArtifacts,
} from "../analyze/pipeline.js";
import {
  evaluateCapabilityPrecision,
  formatCapabilityEvalReport,
  loadGroundTruth,
  resolveGroundTruthPath,
} from "../eval/precision.js";
import {
  runStaticAnalysis,
  writeRouteGraphArtifact,
} from "../analyzer/route-graph.js";
import type { LlmProvider } from "../reasoner/llm/types.js";

export interface AnalyzeCommandOptions {
  readonly rootPath: string;
  readonly staticOnly: boolean;
  readonly eval: boolean;
  readonly json: boolean;
}

export interface AnalyzeCommandHooks {
  readonly llmProvider?: LlmProvider | undefined;
  readonly config?: AgentLayerConfig | undefined;
}

export interface AnalyzeCommandResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

const ANALYZE_FLAGS = new Set([
  "--static-only",
  "--eval",
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
        "agent-layer analyze [path] [--static-only] [--eval] [--json]",
        "",
        "Run capability analysis and write .agent-layer artifacts",
        "  --static-only  Static RouteGraph only (no LLM)",
        "  --eval         Compare output against ground-truth.json",
        "  --json         Emit structured JSON to stdout",
      ].join("\n"),
      exitCode: 0,
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
      staticOnly: args.includes("--static-only"),
      eval: args.includes("--eval"),
      json: args.includes("--json"),
    },
  };
};

const resolveConfig = async (
  rootPath: string,
  hooks: AnalyzeCommandHooks | undefined,
): Promise<AgentLayerConfig> => {
  if (hooks?.config !== undefined) {
    return hooks.config;
  }

  try {
    return await loadAgentLayerConfig(rootPath);
  } catch (error) {
    if (error instanceof ConfigError && error.code === "CONFIG_NOT_FOUND") {
      return createDefaultAgentLayerConfig();
    }

    throw error;
  }
};

export const runAnalyzeCommand = async (
  args: readonly string[],
  cwd: string = process.cwd(),
  hooks: AnalyzeCommandHooks = {},
): Promise<AnalyzeCommandResult> => {
  const parsed = parseAnalyzeCommandOptions(args, cwd);

  if (!parsed.ok) {
    return {
      exitCode: parsed.exitCode,
      stderr: `${parsed.message}\n`,
      stdout: "",
    };
  }

  if (parsed.options.staticOnly) {
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
  }

  const config = await resolveConfig(parsed.options.rootPath, hooks);
  const analysisResult = await runFullAnalysis(parsed.options.rootPath, {
    config,
    ...(hooks.llmProvider !== undefined ? { llmProvider: hooks.llmProvider } : {}),
    writeArtifacts: true,
  });

  const stderrLines = [
    `Analysis complete: ${analysisResult.meta.routeCount} routes → ${analysisResult.meta.capabilityCount} capabilities`,
    `Pending review entries: ${analysisResult.pendingReview.entries.length}`,
    `LLM cost (USD): ${analysisResult.meta.llmCostUsd.toFixed(4)}`,
  ];

  if (analysisResult.artifactPaths !== undefined) {
    stderrLines.push(`Wrote ${analysisResult.artifactPaths.capabilitiesDraftPath}`);
    stderrLines.push(`Wrote ${analysisResult.artifactPaths.pendingReviewPath}`);
    stderrLines.push(`Wrote ${analysisResult.artifactPaths.analysisMetaPath}`);

    if (analysisResult.artifactPaths.routeGraphPath !== undefined) {
      stderrLines.push(`Wrote ${analysisResult.artifactPaths.routeGraphPath}`);
    }
  }

  for (const warning of analysisResult.warnings) {
    const location = warning.route ?? warning.file ?? "project";
    stderrLines.push(`warning [${warning.code}] ${location}: ${warning.message}`);
  }

  let exitCode = 0;
  let evalPayload: ReturnType<typeof evaluateCapabilityPrecision> | undefined;

  if (parsed.options.eval) {
    const groundTruthPath = resolveGroundTruthPath(parsed.options.rootPath);
    const groundTruth = await loadGroundTruth(groundTruthPath);
    evalPayload = evaluateCapabilityPrecision(
      analysisResult.capabilities,
      groundTruth,
    );
    stderrLines.push(formatCapabilityEvalReport(evalPayload));

    if (!evalPayload.passesPrecisionGate) {
      exitCode = 1;
    }
  }

  const stdoutPayload = parsed.options.json
    ? {
        ...analysisResult,
        ...(evalPayload !== undefined ? { eval: evalPayload } : {}),
      }
    : undefined;

  return {
    exitCode,
    stderr: `${stderrLines.join("\n")}\n`,
    stdout: stdoutPayload !== undefined ? `${JSON.stringify(stdoutPayload, null, 2)}\n` : "",
  };
};

export { runStaticAnalysisWithArtifacts };

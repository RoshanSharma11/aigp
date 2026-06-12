import path from "node:path";

import { runDoctorChecks } from "./doctor.js";
import { diffCapabilitiesSincePublish } from "../store/validate.js";
import { validateProjectArtifacts } from "../store/validate.js";
import { StoreError } from "../store/errors.js";

export interface UtilityCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

const UTILITY_FLAGS = new Set(["--json", "--help", "-h", "--verbose"]);

const parseUtilityPath = (
  args: readonly string[],
  cwd: string = process.cwd(),
): string => {
  const positionalArguments = args.filter(
    (argument) => !argument.startsWith("-") && !UTILITY_FLAGS.has(argument),
  );

  return path.resolve(positionalArguments[0] ?? cwd);
};

export const runValidateCommand = async (
  args: readonly string[],
  cwd: string = process.cwd(),
): Promise<UtilityCommandResult> => {
  if (args.includes("--help") || args.includes("-h")) {
    return {
      exitCode: 0,
      stdout: "",
      stderr: "agent-layer validate [path] [--json]\n\nSchema-check .agent-layer artifacts\n",
    };
  }

  const jsonOutput = args.includes("--json");
  const rootPath = parseUtilityPath(args, cwd);

  try {
    const result = await validateProjectArtifacts(rootPath);

    if (jsonOutput) {
      return {
        exitCode: result.valid ? 0 : 1,
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
      };
    }

    const lines = [
      result.valid ? "All artifacts valid" : "Artifact validation failed",
      ...result.issues.map((issue) => `- ${issue.file}: ${issue.message}`),
    ];

    return {
      exitCode: result.valid ? 0 : 1,
      stdout: "",
      stderr: `${lines.join("\n")}\n`,
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${error instanceof Error ? error.message : "Validation failed"}\n`,
    };
  }
};

export const runDiffCommand = async (
  args: readonly string[],
  cwd: string = process.cwd(),
): Promise<UtilityCommandResult> => {
  if (args.includes("--help") || args.includes("-h")) {
    return {
      exitCode: 0,
      stdout: "",
      stderr:
        "agent-layer diff [path] [--json]\n\nShow capability changes between draft and published artifacts\n",
    };
  }

  const jsonOutput = args.includes("--json");
  const rootPath = parseUtilityPath(args, cwd);

  try {
    const result = await diffCapabilitiesSincePublish(rootPath);
    const meaningfulChanges = result.changes.filter((change) => change.changeType !== "unchanged");

    if (jsonOutput) {
      return {
        exitCode: 0,
        stdout: `${JSON.stringify({ ...result, changes: meaningfulChanges }, null, 2)}\n`,
        stderr: "",
      };
    }

    const lines = [
      `Draft: ${result.draftCount} capabilities | Published: ${result.publishedCount} capabilities`,
      "",
      ...meaningfulChanges.map((change) => {
        if (change.changeType === "changed") {
          return `${change.id}: changed (${change.fields?.join(", ") ?? "fields"})`;
        }

        return `${change.id}: ${change.changeType}`;
      }),
    ];

    if (meaningfulChanges.length === 0) {
      lines.push("No changes since last publish");
    }

    return {
      exitCode: 0,
      stdout: "",
      stderr: `${lines.join("\n")}\n`,
    };
  } catch (error) {
    if (error instanceof StoreError) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${error.message}\n`,
      };
    }

    throw error;
  }
};

export const runDoctorCommand = async (
  args: readonly string[],
  cwd: string = process.cwd(),
): Promise<UtilityCommandResult> => {
  if (args.includes("--help") || args.includes("-h")) {
    return {
      exitCode: 0,
      stdout: "",
      stderr:
        "agent-layer doctor [path] [--json]\n\nCheck config, framework detection, and artifact health\n",
    };
  }

  const jsonOutput = args.includes("--json");
  const rootPath = parseUtilityPath(args, cwd);
  const result = await runDoctorChecks(rootPath);

  if (jsonOutput) {
    return {
      exitCode: result.healthy ? 0 : 1,
      stdout: `${JSON.stringify(result, null, 2)}\n`,
      stderr: "",
    };
  }

  const lines = [
    result.healthy ? "Doctor: all critical checks passed" : "Doctor: issues found",
    "",
    ...result.checks.map((check) => `[${check.status}] ${check.name}: ${check.message}`),
  ];

  return {
    exitCode: result.healthy ? 0 : 1,
    stdout: "",
    stderr: `${lines.join("\n")}\n`,
  };
};

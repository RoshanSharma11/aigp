import path from "node:path";

import type { CapabilityOverride } from "@agent-layer/core";

import {
  approveCapabilities,
  editCapabilityReview,
  listReviewItems,
  rejectCapabilities,
  type ReviewItem,
} from "../store/review.js";
import { StoreError } from "../store/errors.js";

export interface ReviewCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

const REVIEW_FLAGS = new Set(["--json", "--help", "-h", "--verbose"]);

const EDIT_FIELD_FLAGS = new Set([
  "--name",
  "--description",
  "--category",
  "--status",
  "--confidence",
  "--needs-human-review",
  "--risk-level",
  "--requires-auth",
]);

const isPathArgument = (argument: string): boolean =>
  argument === "." ||
  argument.startsWith("./") ||
  argument.startsWith("../") ||
  path.isAbsolute(argument) ||
  argument.includes("/");

const parseReviewPath = (
  args: readonly string[],
  cwd: string = process.cwd(),
): { readonly path: string; readonly remainingArgs: readonly string[] } => {
  const positionalArguments = args.filter(
    (argument) => !argument.startsWith("-") && !REVIEW_FLAGS.has(argument),
  );

  const lastArgument = positionalArguments.at(-1);
  const pathArgument =
    lastArgument !== undefined && isPathArgument(lastArgument) ? lastArgument : undefined;
  const remainingArgs =
    pathArgument === undefined
      ? positionalArguments
      : positionalArguments.slice(0, positionalArguments.length - 1);

  return {
    path: path.resolve(pathArgument ?? cwd),
    remainingArgs,
  };
};

const formatReviewItemLine = (item: ReviewItem): string => {
  const flags = [
    item.status,
    item.needsHumanReview ? "needs_review" : null,
    item.hasOverride ? "override" : null,
  ]
    .filter((value) => value !== null)
    .join(", ");

  const reasons =
    item.pendingReasons.length > 0 ? ` — ${item.pendingReasons.join("; ")}` : "";

  return `${item.id} (${item.name}) [${flags}] confidence=${item.confidence.toFixed(2)}${reasons}`;
};

const parseEditFields = (
  args: readonly string[],
  capabilityId: string,
): CapabilityOverride | { readonly error: string } => {
  const jsonFlagIndex = args.indexOf("--json");

  if (jsonFlagIndex >= 0) {
    const jsonPayload = args[jsonFlagIndex + 1];

    if (jsonPayload === undefined) {
      return { error: "review edit requires a JSON payload after --json" };
    }

    try {
      const parsed = JSON.parse(jsonPayload) as CapabilityOverride;

      return {
        ...parsed,
        id: capabilityId,
      };
    } catch {
      return { error: "review edit --json payload must be valid JSON" };
    }
  }

  const fields: {
    id: string;
    name?: string;
    description?: string;
    category?: string;
    status?: CapabilityOverride["status"];
    confidence?: number;
    needsHumanReview?: boolean;
    riskLevel?: CapabilityOverride["riskLevel"];
    requiresAuth?: boolean;
  } = { id: capabilityId };

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];

    if (flag === undefined || !EDIT_FIELD_FLAGS.has(flag)) {
      continue;
    }

    const value = args[index + 1];

    if (value === undefined) {
      return { error: `${flag} requires a value` };
    }

    switch (flag) {
      case "--name":
        fields.name = value;
        break;
      case "--description":
        fields.description = value;
        break;
      case "--category":
        fields.category = value;
        break;
      case "--status":
        if (value !== "draft" && value !== "approved" && value !== "disabled") {
          return { error: "--status must be draft, approved, or disabled" };
        }
        fields.status = value;
        break;
      case "--confidence":
        fields.confidence = Number(value);
        break;
      case "--needs-human-review":
        fields.needsHumanReview = value === "true";
        break;
      case "--risk-level":
        if (value !== "low" && value !== "medium" && value !== "high") {
          return { error: "--risk-level must be low, medium, or high" };
        }
        fields.riskLevel = value;
        break;
      case "--requires-auth":
        fields.requiresAuth = value === "true";
        break;
      default:
        break;
    }
  }

  if (Object.keys(fields).length === 1) {
    return { error: "review edit requires at least one field flag or --json" };
  }

  return fields as CapabilityOverride;
};

export const runReviewCommand = async (
  args: readonly string[],
  cwd: string = process.cwd(),
): Promise<ReviewCommandResult> => {
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    return {
      exitCode: 0,
      stdout: "",
      stderr: [
        "agent-layer review <subcommand> [path] [options]",
        "",
        "Subcommands:",
        "  list                     List draft capabilities and review status",
        "  approve <id> [ids...]      Approve capabilities via overrides.json",
        "  reject <id> [ids...]       Reject capabilities (status disabled)",
        "  edit <id> [field flags]    Edit capability fields in overrides.json",
        "",
        "Options:",
        "  --json                     JSON output (list) or JSON payload (edit)",
        "",
        "Edit field flags:",
        "  --name, --description, --category, --status, --confidence,",
        "  --needs-human-review, --risk-level, --requires-auth",
      ].join("\n"),
    };
  }

  const jsonOutput = args.includes("--json");
  const filteredArgs = args.filter((argument) => !REVIEW_FLAGS.has(argument));
  const [subcommand, ...subcommandArgs] = filteredArgs;

  if (subcommand === undefined) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "review requires a subcommand: list, approve, reject, or edit\n",
    };
  }

  const { path: rootPath, remainingArgs } = parseReviewPath(subcommandArgs, cwd);

  try {
    switch (subcommand) {
      case "list": {
        const result = await listReviewItems(rootPath);

        if (jsonOutput) {
          return {
            exitCode: 0,
            stdout: `${JSON.stringify(result, null, 2)}\n`,
            stderr: "",
          };
        }

        const lines = [
          `Review queue (${result.items.length} capabilities)`,
          `Approved: ${result.approvedCount} | Pending review: ${result.pendingCount} | Draft: ${result.draftCount} | Disabled: ${result.disabledCount}`,
          "",
          ...result.items.map(formatReviewItemLine),
        ];

        return {
          exitCode: 0,
          stdout: "",
          stderr: `${lines.join("\n")}\n`,
        };
      }
      case "approve": {
        const capabilityIds = remainingArgs;

        if (capabilityIds.length === 0) {
          return {
            exitCode: 2,
            stdout: "",
            stderr: "review approve requires at least one capability id\n",
          };
        }

        const result = await approveCapabilities(rootPath, capabilityIds);

        return {
          exitCode: 0,
          stdout: jsonOutput ? `${JSON.stringify(result, null, 2)}\n` : "",
          stderr: `Approved ${result.approvedIds.length} capabilities in ${result.artifactPath}\n`,
        };
      }
      case "reject": {
        const capabilityIds = remainingArgs;

        if (capabilityIds.length === 0) {
          return {
            exitCode: 2,
            stdout: "",
            stderr: "review reject requires at least one capability id\n",
          };
        }

        const result = await rejectCapabilities(rootPath, capabilityIds);

        return {
          exitCode: 0,
          stdout: jsonOutput ? `${JSON.stringify(result, null, 2)}\n` : "",
          stderr: `Rejected ${result.rejectedIds.length} capabilities in ${result.artifactPath}\n`,
        };
      }
      case "edit": {
        const [capabilityId, ...editArgs] = remainingArgs;

        if (capabilityId === undefined) {
          return {
            exitCode: 2,
            stdout: "",
            stderr: "review edit requires a capability id\n",
          };
        }

        const parsedFields = parseEditFields(editArgs, capabilityId);

        if ("error" in parsedFields) {
          return {
            exitCode: 2,
            stdout: "",
            stderr: `${parsedFields.error}\n`,
          };
        }

        const result = await editCapabilityReview(rootPath, capabilityId, parsedFields);

        return {
          exitCode: 0,
          stdout: jsonOutput ? `${JSON.stringify(result, null, 2)}\n` : "",
          stderr: `Updated override for ${capabilityId} in ${result.artifactPath}\n`,
        };
      }
      default:
        return {
          exitCode: 2,
          stdout: "",
          stderr: `Unknown review subcommand: ${subcommand}\n`,
        };
    }
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

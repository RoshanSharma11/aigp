import { LlmError } from "./errors.js";

const JSON_FENCE_PATTERN = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/;

export const extractJsonContent = (raw: string): string => {
  const trimmed = raw.trim();
  const fenced = JSON_FENCE_PATTERN.exec(trimmed);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return trimmed;
};

export const parseJsonContent = (raw: string): unknown => {
  const content = extractJsonContent(raw);

  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    throw new LlmError("LLM response is not valid JSON", {
      code: "LLM_INVALID_JSON",
      cause: error,
    });
  }
};

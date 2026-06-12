import { describe, expect, it } from "vitest";

import { formatHelpText, runCli } from "./index.js";

describe("agent-layer CLI", () => {
  it("should print help text when no arguments are provided", () => {
    expect(runCli([])).toBe(formatHelpText());
  });

  it("should print help text for the help flag", () => {
    expect(runCli(["--help"])).toBe(formatHelpText());
  });

  it("should print a helpful fallback for unknown commands", () => {
    expect(runCli(["ship-it"])).toContain("Unknown command: ship-it");
  });
});

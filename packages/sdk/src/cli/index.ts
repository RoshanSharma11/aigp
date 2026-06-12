import { runAnalyzeCommand } from "./analyze.js";

const HELP_TEXT = `agent-layer <command> [options] [path]

Commands: analyze, validate, diff, serve-mcp, doctor, review
Global flags: --verbose, --config <path>, --help`;

export const formatHelpText = (): string => HELP_TEXT;

const isCliEntrypoint = (argvEntry: string | undefined): boolean => {
  if (!argvEntry) {
    return false;
  }

  return (
    argvEntry.endsWith("/agent-layer") ||
    argvEntry.endsWith("/index.js") ||
    argvEntry.endsWith("/index.cjs")
  );
};

export const runCli = (argv: readonly string[]): string => {
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    return formatHelpText();
  }

  return `Unknown command: ${argv[0]}\n\n${formatHelpText()}`;
};

export const runCliAsync = async (
  argv: readonly string[],
): Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }> => {
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    return {
      exitCode: 0,
      stdout: `${formatHelpText()}\n`,
      stderr: "",
    };
  }

  const [command, ...commandArgs] = argv;

  if (command === "analyze") {
    const result = await runAnalyzeCommand(commandArgs);
    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  return {
    exitCode: 1,
    stdout: "",
    stderr: `${runCli(argv)}\n`,
  };
};

if (isCliEntrypoint(process.argv[1])) {
  void runCliAsync(process.argv.slice(2)).then((result) => {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
  });
}

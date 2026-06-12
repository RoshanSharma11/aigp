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

if (isCliEntrypoint(process.argv[1])) {
  process.stdout.write(`${runCli(process.argv.slice(2))}\n`);
}

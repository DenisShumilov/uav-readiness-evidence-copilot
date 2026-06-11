import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runReadinessDemo } from "../../../scripts/demoReadiness";
import { expectedInputContracts, parseByodDirectory } from "./byod";
import {
  evaluateBundle,
  formatTerminalReport,
  sarifBaseUriFor,
  writeOutputs,
  type CheckOutputs
} from "./report";

type CliOptions = CheckOutputs & {
  minScore?: number;
  quiet: boolean;
};

type CliIO = {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
};

export async function runCli(
  argv = process.argv.slice(2),
  io: CliIO = { stdout: process.stdout, stderr: process.stderr }
): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    io.stdout.write(helpText());
    return 0;
  }

  if (command === "--version" || command === "-v") {
    io.stdout.write("0.8.1\n");
    return 0;
  }

  if (command === "demo") {
    return runDemo(rest, io);
  }

  if (command === "check") {
    return runCheck(rest, io);
  }

  io.stderr.write(`Unknown command: ${command}\n\n${helpText()}`);
  return 2;
}

function runDemo(args: string[], io: CliIO): number {
  const { options, errors } = parseOptions(args);
  if (errors.length > 0 || options.minScore !== undefined || options.json || options.sarif || options.md) {
    io.stderr.write(`Invalid demo options.\n\n${helpText()}`);
    return 2;
  }

  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const result = runReadinessDemo({
    fixtureDir: join(packageRoot, "examples", "demo-uav-readiness")
  });
  if (!options.quiet) {
    io.stdout.write(`Demo readiness score: ${result.readinessScore}/100\n`);
    io.stdout.write(`Wrote output to: ${result.outputDir}\n`);
  }
  return 0;
}

function runCheck(args: string[], io: CliIO): number {
  const dir = args[0];
  if (!dir || dir.startsWith("-")) {
    io.stderr.write(`Missing directory for check.\n\n${helpText()}`);
    return 2;
  }

  const { options, errors } = parseOptions(args.slice(1));
  if (errors.length > 0) {
    io.stderr.write(`${errors.join("\n")}\n\n${helpText()}`);
    return 2;
  }

  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    io.stderr.write(`Input directory does not exist: ${dir}\n`);
    return 2;
  }

  try {
    const parsed = parseByodDirectory(dir);
    const result = evaluateBundle(parsed.bundle, sarifBaseUriFor(dir));
    writeOutputs(result, options);

    if (!options.quiet) {
      io.stdout.write(
        formatTerminalReport(
          parsed.ingestSummary,
          parsed.bundle.evidenceClaims,
          result.assessment,
          process.stdout.isTTY
        )
      );
      if (!parsed.ingestSummary.some((item) => item.status === "parsed")) {
        io.stdout.write(firstTouchHelp());
      }
      if (options.minScore === undefined) {
        io.stdout.write(
          "Analysis completed; exit code 0 reports completion, not readiness. Add --min-score <n> to gate CI (exit 1 below n).\n"
        );
      }
    }

    if (
      options.minScore !== undefined &&
      result.assessment.readinessScore < options.minScore
    ) {
      if (!options.quiet) {
        io.stderr.write(
          `Score ${result.assessment.readinessScore} is below --min-score ${options.minScore}.\n`
        );
      }
      return 1;
    }

    return 0;
  } catch (error) {
    io.stderr.write(
      `${error instanceof Error ? error.message : "Unknown CLI failure"}\n`
    );
    return 2;
  }
}

function parseOptions(args: string[]): {
  options: CliOptions;
  errors: string[];
} {
  const options: CliOptions = { quiet: false };
  const errors: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--quiet") {
      options.quiet = true;
      continue;
    }

    if (arg === "--json" || arg === "--sarif" || arg === "--md") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        errors.push(`${arg} requires a file path`);
        continue;
      }
      if (arg === "--json") options.json = value;
      if (arg === "--sarif") options.sarif = value;
      if (arg === "--md") options.md = value;
      index += 1;
      continue;
    }

    if (arg === "--min-score") {
      const value = args[index + 1];
      const parsed = Number(value);
      if (!value || !Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        errors.push("--min-score requires an integer from 0 to 100");
        continue;
      }
      options.minScore = parsed;
      index += 1;
      continue;
    }

    errors.push(`Unknown option: ${arg}`);
  }

  return { options, errors };
}

function helpText(): string {
  return [
    "uav-readiness",
    "",
    "Usage:",
    "  uav-readiness check <dir> [--json <file>] [--sarif <file>] [--md <file>] [--min-score <n>] [--quiet]",
    "  uav-readiness demo [--quiet]",
    "",
    "Supported input contracts:",
    ...expectedInputContracts.map((line) => `  - ${line}`),
    "",
    "Missing or unparsable inputs do not crash the check. They create locked claims:",
    "  no evidence -> locked",
    "",
    "Exit codes:",
    "  0  check passed",
    "  1  score is below --min-score",
    "  2  usage or parse setup error",
    ""
  ].join("\n");
}

function firstTouchHelp(): string {
  return [
    "",
    "No supported inputs parsed.",
    "Expected input contracts:",
    ...expectedInputContracts.map((line) => `  - ${line}`),
    "",
    "For instant output on the bundled strict bundle, run:",
    "  uav-readiness demo",
    ""
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}

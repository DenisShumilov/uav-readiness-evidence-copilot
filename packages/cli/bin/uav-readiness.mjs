#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "src", "cli.ts");
const require = createRequire(import.meta.url);
const tsxLoader = pathToFileURL(require.resolve("tsx")).href;
const result = spawnSync(
  process.execPath,
  ["--import", tsxLoader, cli, ...process.argv.slice(2)],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);

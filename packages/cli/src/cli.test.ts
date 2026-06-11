import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const bin = join(process.cwd(), "packages", "cli", "bin", "uav-readiness.mjs");
const fixture = join(
  process.cwd(),
  "packages",
  "cli",
  "test-fixtures",
  "byod-sample"
);

function runCli(args: string[]) {
  return spawnSync(process.execPath, [bin, ...args], {
    encoding: "utf8"
  });
}

describe("uav-readiness CLI", () => {
  it("runs a BYOD fixture and writes requested outputs", () => {
    const out = mkdtempSync(join(tmpdir(), "uav-readiness-cli-"));
    const json = join(out, "assessment.json");
    const sarif = join(out, "readiness.sarif");
    const md = join(out, "readiness.md");
    const result = runCli([
      "check",
      fixture,
      "--json",
      json,
      "--sarif",
      sarif,
      "--md",
      md
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Ingest summary");
    expect(result.stdout).toContain("Claims by status");
    expect(existsSync(json)).toBe(true);
    expect(existsSync(sarif)).toBe(true);
    expect(existsSync(md)).toBe(true);
    expect(JSON.parse(readFileSync(json, "utf8")).readinessScore).toBeGreaterThan(
      1
    );
  });

  it("uses --min-score as a CI gate", () => {
    const high = runCli([
      "check",
      fixture,
      "--min-score",
      "99",
      "--quiet"
    ]);
    const low = runCli([
      "check",
      fixture,
      "--min-score",
      "1",
      "--quiet"
    ]);

    expect(high.status).toBe(1);
    expect(low.status).toBe(0);
  });

  it("returns usage exit code 2 for invalid flags", () => {
    const result = runCli(["check", fixture, "--min-score", "not-a-number"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--min-score");
  });
});

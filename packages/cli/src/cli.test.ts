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
    expect(result.stdout).not.toContain("No supported inputs parsed.");
    expect(existsSync(json)).toBe(true);
    expect(existsSync(sarif)).toBe(true);
    expect(existsSync(md)).toBe(true);
    expect(JSON.parse(readFileSync(json, "utf8")).readinessScore).toBeGreaterThan(
      1
    );

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

  it("prints input contracts and a demo pointer when every file is skipped", () => {
    const dir = mkdtempSync(join(tmpdir(), "uav-readiness-empty-"));
    const result = runCli(["check", dir]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No supported inputs parsed.");
    expect(result.stdout).toContain(
      "BOM CSV headers: item_id,item_name,category,quantity,revision,record_status,evidence_id,notes"
    );
    expect(result.stdout).toContain("Manual Markdown:");
    expect(result.stdout).toContain("Test-log CSV headers:");
    expect(result.stdout).toContain("QA-notes Markdown:");
    expect(result.stdout).toContain("uav-readiness demo");
  });

  it("returns usage exit code 2 for invalid flags", () => {
    const result = runCli(["check", fixture, "--min-score", "not-a-number"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--min-score");
  });
});

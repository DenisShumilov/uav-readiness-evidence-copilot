import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runReadinessDemo } from "../../../scripts/demoReadiness";

const fixtureDir = join(process.cwd(), "examples", "demo-uav-readiness");
const unsafePattern =
  /\b(mission|payload|targeting|weapon|route|waypoint|telemetry|target|coordinates|coordinate|gps|frequency|frequencies|mavlink|px4|ardupilot|strike|attack|evasion|evade|countermeasure)\b/i;

describe("demo readiness CLI", () => {
  it("writes demo readiness outputs", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-output-"));
    const result = runReadinessDemo({ fixtureDir, outputDir });

    expect(result.files).toEqual([
      "readiness-report.md",
      "evidence-graph.json",
      "readiness-assessment.json"
    ]);
    expect(existsSync(join(outputDir, "readiness-report.md"))).toBe(true);
    expect(existsSync(join(outputDir, "evidence-graph.json"))).toBe(true);
    expect(existsSync(join(outputDir, "readiness-assessment.json"))).toBe(true);
  });

  it("keeps generated report inside safe wording", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-output-"));
    runReadinessDemo({ fixtureDir, outputDir });
    const report = readFileSync(join(outputDir, "readiness-report.md"), "utf8");

    expect(report).not.toMatch(unsafePattern);
    expect(report).toContain("documentation readiness only");
  });
});

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runReadinessDemo } from "../../../scripts/demoReadiness";

const fixtureDir = join(
  process.cwd(),
  "examples",
  "demo-maintenance-readiness"
);
const unsafePattern =
  /\b(mission|payload|targeting|weapon|route|waypoint|telemetry|target|coordinates|coordinate|gps|frequency|frequencies|mavlink|px4|ardupilot|strike|attack|evasion|evade|countermeasure)\b/i;

describe("maintenance readiness demo (second synthetic bundle)", () => {
  it("scores the mostly-organized package at 80/100", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "maintenance-output-"));
    const result = runReadinessDemo({ fixtureDir, outputDir });

    expect(result.readinessScore).toBe(80);
    expect(existsSync(join(outputDir, "readiness-assessment.json"))).toBe(true);

    const assessment = JSON.parse(
      readFileSync(join(outputDir, "readiness-assessment.json"), "utf8")
    ) as {
      summary: {
        verifiedCount: number;
        partialCount: number;
        lockedCount: number;
      };
    };
    expect(assessment.summary.verifiedCount).toBe(14);
    expect(assessment.summary.partialCount).toBe(2);
    expect(assessment.summary.lockedCount).toBe(1);
  });

  it("keeps the generated report inside safe wording", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "maintenance-output-"));
    runReadinessDemo({ fixtureDir, outputDir });
    const report = readFileSync(
      join(outputDir, "readiness-report.md"),
      "utf8"
    );

    expect(report).not.toMatch(unsafePattern);
    expect(report).toContain("documentation readiness only");
  });
});

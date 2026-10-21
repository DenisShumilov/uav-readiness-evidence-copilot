import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runReadinessDemo } from "../../../scripts/demoReadiness";

const fixtureDir = join(process.cwd(), "examples", "demo-tdp-supplier-package");

describe("TDP-style supplier package demo (fourth synthetic bundle)", () => {
  it("scores the supplier package at 49/100 with a derived conflict", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "tdp-output-"));
    const result = runReadinessDemo({ fixtureDir, outputDir });

    expect(result.readinessScore).toBe(49);

    const assessment = JSON.parse(
      readFileSync(join(outputDir, "readiness-assessment.json"), "utf8")
    ) as {
      readinessScore: number;
      summary: {
        verifiedCount: number;
        partialCount: number;
        lockedCount: number;
        conflictCount: number;
      };
    };

    expect(assessment.summary.verifiedCount).toBe(9);
    expect(assessment.summary.partialCount).toBe(1);
    expect(assessment.summary.lockedCount).toBe(2);
    expect(assessment.summary.conflictCount).toBe(1);

    const report = readFileSync(join(outputDir, "readiness-report.md"), "utf8");
    expect(report).toContain("documentation readiness only");
  });
});

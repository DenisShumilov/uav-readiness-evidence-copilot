import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runReadinessDemo } from "../../../scripts/demoReadiness";

const fixtureDir = join(process.cwd(), "examples", "demo-conflict-readiness");
const unsafePattern =
  /\b(mission|payload|targeting|weapon|route|waypoint|telemetry|target|coordinates|coordinate|gps|frequency|frequencies|mavlink|px4|ardupilot|strike|attack|evasion|evade|countermeasure)\b/i;

describe("conflict readiness demo (conflict gate)", () => {
  it("caps the verdict in the Blocked band when a claim is in conflict", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "conflict-output-"));
    const result = runReadinessDemo({ fixtureDir, outputDir });

    expect(result.readinessScore).toBe(49);

    const assessment = JSON.parse(
      readFileSync(join(outputDir, "readiness-assessment.json"), "utf8")
    ) as {
      readinessScore: number;
      formula: { deductions: Array<{ total: number }> };
      summary: { conflictCount: number };
    };

    expect(assessment.summary.conflictCount).toBe(1);

    // The gate caps the score below what the raw deductions alone would give.
    const rawScore =
      100 -
      assessment.formula.deductions.reduce(
        (total, deduction) => total + deduction.total,
        0
      );
    expect(rawScore).toBeGreaterThan(assessment.readinessScore);
  });

  it("derives the conflict by comparing revisions across documents, not from a hand-typed status", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "conflict-output-"));
    runReadinessDemo({ fixtureDir, outputDir });
    const graph = JSON.parse(
      readFileSync(join(outputDir, "evidence-graph.json"), "utf8")
    ) as {
      evidenceClaims: Array<{
        id: string;
        status: string;
        evidenceSourceIds: string[];
        lockReason?: string;
      }>;
    };

    const derived = graph.evidenceClaims.find((c) =>
      c.id.startsWith("claim.crosscheck")
    );
    expect(derived).toBeDefined();
    expect(derived?.status).toBe("conflict");
    expect(derived?.evidenceSourceIds.length).toBe(2);
    expect(derived?.lockReason).toContain("TM-3");
    expect(derived?.lockReason).toContain("TM-2");
  });

  it("keeps the generated report inside safe wording", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "conflict-output-"));
    runReadinessDemo({ fixtureDir, outputDir });
    const report = readFileSync(
      join(outputDir, "readiness-report.md"),
      "utf8"
    );

    expect(report).not.toMatch(unsafePattern);
    expect(report).toContain("documentation readiness only");
  });
});

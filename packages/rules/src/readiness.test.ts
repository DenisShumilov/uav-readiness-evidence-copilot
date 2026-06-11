import { describe, expect, it } from "vitest";
import { parseDemoBundle } from "@uav-readiness/parsers";
import { evaluateReadiness } from "./readiness";

describe("evaluateReadiness", () => {
  it("calculates an explainable readiness score", () => {
    const assessment = evaluateReadiness(parseDemoBundle());

    expect(assessment.readinessScore).toBeGreaterThanOrEqual(0);
    expect(assessment.readinessScore).toBeLessThanOrEqual(100);
    expect(assessment.formula.base).toBe(100);
    expect(assessment.formula.deductions.length).toBeGreaterThan(0);
    expect(assessment.summary.explanation).toContain("documentation readiness");
  });

  it("reports locked critical items without inventing evidence", () => {
    const assessment = evaluateReadiness(parseDemoBundle());

    expect(assessment.lockedCriticalItems.length).toBeGreaterThan(0);
    expect(
      assessment.lockedCriticalItems.every((item) => item.reason.length > 0)
    ).toBe(true);
  });

  it("penalizes missing safe artifacts", () => {
    const bundle = parseDemoBundle();
    const withoutManual = {
      ...bundle,
      artifacts: bundle.artifacts.filter((artifact) => artifact.kind !== "manual")
    };
    const assessment = evaluateReadiness(withoutManual);

    expect(assessment.summary.missingArtifacts).toContain("manual");
    expect(
      assessment.formula.deductions.some(
        (deduction) => deduction.reason === "missing safe artifacts"
      )
    ).toBe(true);
  });
});

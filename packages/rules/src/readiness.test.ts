import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDemoBundle } from "@uav-readiness/parsers";
import { evaluateReadiness } from "./readiness";

describe("evaluateReadiness", () => {
  it("calculates an explainable readiness score and reproduces the 4 demo scores (44, 80, 49, 49)", () => {
    const assessment = evaluateReadiness(parseDemoBundle());

    expect(assessment.readinessScore).toBe(44);
    expect(assessment.formula.base).toBe(100);
    expect(assessment.formula.deductions.length).toBeGreaterThan(0);
    expect(assessment.summary.explanation).toContain("documentation readiness");

    const maintenanceScore = evaluateReadiness(
      parseDemoBundle(join(process.cwd(), "examples", "demo-maintenance-readiness"))
    ).readinessScore;
    const conflictScore = evaluateReadiness(
      parseDemoBundle(join(process.cwd(), "examples", "demo-conflict-readiness"))
    ).readinessScore;
    const tdpScore = evaluateReadiness(
      parseDemoBundle(join(process.cwd(), "examples", "demo-tdp-supplier-package"))
    ).readinessScore;

    expect([
      assessment.readinessScore,
      maintenanceScore,
      conflictScore,
      tdpScore
    ]).toEqual([44, 80, 49, 49]);
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

  it("forces readinessScore to 0 when evidenceClaims is empty", () => {
    const bundle = parseDemoBundle();
    const emptyBundle = {
      ...bundle,
      bomItems: [],
      evidenceSources: [],
      evidenceClaims: [],
      evidenceLocks: [],
      qaItems: [],
      readinessFindings: []
    };
    const assessment = evaluateReadiness(emptyBundle);

    expect(assessment.readinessScore).toBe(0);
    expect(assessment.warnings).toContain(
      "No verifiable evidence claims or valid artifact-backed sources found in bundle; readiness cannot be established (score forced to 0)."
    );
    expect(
      assessment.lockedCriticalItems.some(
        (item) => item.id === "bundle.no-evidence"
      )
    ).toBe(true);
    expect(assessment.summary.explanation).toContain(
      "Readiness score is 0 because the bundle contains no verified or partially verified artifact-backed evidence claims"
    );
  });

  it("forces readinessScore to 0 when artifacts is empty even if sources and claims exist", () => {
    const bundle = parseDemoBundle();
    const noArtifactsBundle = {
      ...bundle,
      artifacts: []
    };
    const assessment = evaluateReadiness(noArtifactsBundle);

    expect(assessment.readinessScore).toBe(0);
    expect(assessment.summary.verifiedCount).toBe(0);
    expect(assessment.warnings).toContain(
      "No verifiable evidence claims or valid artifact-backed sources found in bundle; readiness cannot be established (score forced to 0)."
    );
    expect(assessment.summary.explanation).toContain(
      "UNVERIFIED / insufficient data, not a proven physical failure of the vehicle"
    );
  });

  it("forces readinessScore to 0 when bundle contains only locked claims", () => {
    const bundle = parseDemoBundle();
    const lockedOnlyClaims = bundle.evidenceClaims.filter(
      (claim) => claim.status === "locked"
    );
    const lockedOnlyBundle = {
      ...bundle,
      bomItems: [],
      evidenceClaims: lockedOnlyClaims,
      evidenceLocks: [],
      qaItems: [],
      readinessFindings: []
    };
    const assessment = evaluateReadiness(lockedOnlyBundle);

    expect(assessment.readinessScore).toBe(0);
    expect(assessment.summary.verifiedCount).toBe(0);
    expect(assessment.summary.partialCount).toBe(0);
    expect(assessment.warnings).toContain(
      "No verifiable evidence claims or valid artifact-backed sources found in bundle; readiness cannot be established (score forced to 0)."
    );
  });
});

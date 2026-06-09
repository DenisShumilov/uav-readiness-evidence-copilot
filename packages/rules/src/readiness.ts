import type {
  DemoBundle,
  EvidenceClaim,
  ReadinessFinding
} from "../../core/src/schemas";
import { deriveEvidenceStatuses, type DerivedStatus } from "./deriveStatus";

const expectedArtifactKinds = ["bom", "manual", "test_log", "qa_notes"] as const;

/**
 * Per-category deduction weights and caps. This object is the SINGLE SOURCE OF
 * TRUTH for the scoring formula; the interactive site mirrors these numbers and
 * a parity test (packages/qa/src/siteParity.test.ts) asserts they stay in sync.
 */
export const DEDUCTION_CONFIG = {
  lockedCritical: { reason: "locked critical evidence", pointsEach: 6, cap: 48 },
  conflict: { reason: "conflicting evidence", pointsEach: 8, cap: 24 },
  partial: { reason: "partial evidence", pointsEach: 3, cap: 24 },
  warning: { reason: "warnings", pointsEach: 2, cap: 16 },
  missingArtifact: { reason: "missing safe artifacts", pointsEach: 10, cap: 30 }
} as const;

/**
 * A contradiction on a critical claim cannot yield a positive verdict: once any
 * conflict is present the score is capped into the "Blocked" band.
 */
export const CONFLICT_CEILING = 49;

export type ReadinessDeduction = {
  reason: string;
  count: number;
  pointsEach: number;
  total: number;
};

export type LockedCriticalItem = {
  id: string;
  reason: string;
};

export type EngineAdjustment = {
  claimId: string;
  assertedStatus: string;
  derivedStatus: string;
  reason: string;
};

export type ReadinessAssessment = {
  readinessScore: number;
  formula: {
    base: number;
    deductions: ReadinessDeduction[];
  };
  findings: ReadinessFinding[];
  warnings: string[];
  lockedCriticalItems: LockedCriticalItem[];
  /**
   * Claims where the engine's derived status differs from the reviewer-typed
   * status — i.e. where the tool overrode a human label from the evidence.
   */
  engineAdjustments: EngineAdjustment[];
  summary: {
    verifiedCount: number;
    partialCount: number;
    lockedCount: number;
    conflictCount: number;
    engineAdjustedCount: number;
    missingArtifacts: string[];
    explanation: string;
  };
};

export function evaluateReadiness(bundle: DemoBundle): ReadinessAssessment {
  const claimsById = new Map(
    bundle.evidenceClaims.map((claim) => [claim.id, claim])
  );
  // The engine independently re-derives every status from the evidence rather
  // than trusting the reviewer's status column (see deriveStatus.ts).
  const derived = deriveEvidenceStatuses(
    bundle.evidenceClaims,
    bundle.evidenceSources,
    bundle.qaItems
  );

  const counts = countStatuses(derived);
  const missingArtifacts = findMissingArtifacts(bundle);
  const lockedCriticalItems = buildLockedCriticalItems(derived, claimsById);
  const engineAdjustments = derived
    .filter((entry) => entry.changed)
    .map((entry) => ({
      claimId: entry.claimId,
      assertedStatus: entry.assertedStatus,
      derivedStatus: entry.derivedStatus,
      reason: entry.reason
    }));
  const warnings = buildWarnings(derived, engineAdjustments, bundle.readinessFindings);

  const deductions = buildDeductions(
    counts.partialCount,
    lockedCriticalItems.length,
    warnings.length,
    missingArtifacts.length,
    counts.conflictCount
  );
  const deductionTotal = deductions.reduce(
    (total, deduction) => total + deduction.total,
    0
  );
  const conflictCeiling = counts.conflictCount > 0 ? CONFLICT_CEILING : 100;
  const score = Math.min(conflictCeiling, Math.max(0, 100 - deductionTotal));

  return {
    readinessScore: score,
    formula: {
      base: 100,
      deductions
    },
    findings: bundle.readinessFindings,
    warnings,
    lockedCriticalItems,
    engineAdjustments,
    summary: {
      verifiedCount: counts.verifiedCount,
      partialCount: counts.partialCount,
      lockedCount: counts.lockedCount,
      conflictCount: counts.conflictCount,
      engineAdjustedCount: engineAdjustments.length,
      missingArtifacts,
      explanation:
        "Score is documentation readiness only: 100 minus capped deductions for locked, conflicting, partial, warning, and missing-artifact evidence. Statuses are derived by the engine from the evidence (locked when a source is missing, graded from test outcomes, conflict from cross-document disagreement), not read from the reviewer's status column. A conflict on a critical claim caps the verdict in the Blocked band."
    }
  };
}

function countStatuses(derived: DerivedStatus[]) {
  return {
    verifiedCount: derived.filter((d) => d.derivedStatus === "verified").length,
    partialCount: derived.filter((d) => d.derivedStatus === "partial").length,
    lockedCount: derived.filter((d) => d.derivedStatus === "locked").length,
    conflictCount: derived.filter((d) => d.derivedStatus === "conflict").length
  };
}

function findMissingArtifacts(bundle: DemoBundle): string[] {
  const presentKinds = new Set(bundle.artifacts.map((artifact) => artifact.kind));
  return expectedArtifactKinds.filter((kind) => !presentKinds.has(kind));
}

function buildWarnings(
  derived: DerivedStatus[],
  engineAdjustments: EngineAdjustment[],
  findings: ReadinessFinding[]
): string[] {
  const warningFindings = findings
    .filter(
      (finding) =>
        finding.severity === "warning" ||
        finding.status === "blocked" ||
        finding.status === "not_tested"
    )
    .map((finding) => `${finding.id}: ${finding.title}`);
  const partialWarnings = derived
    .filter((entry) => entry.derivedStatus === "partial")
    .map((entry) => `${entry.claimId}: partial evidence`);
  const adjustmentWarnings = engineAdjustments.map(
    (entry) =>
      `${entry.claimId}: engine downgraded reviewer status ${entry.assertedStatus} -> ${entry.derivedStatus}`
  );

  return [...warningFindings, ...partialWarnings, ...adjustmentWarnings];
}

function buildLockedCriticalItems(
  derived: DerivedStatus[],
  claimsById: Map<string, EvidenceClaim>
): LockedCriticalItem[] {
  return derived
    .filter((entry) => entry.derivedStatus === "locked")
    .map((entry) => ({
      id: entry.claimId,
      reason:
        claimsById.get(entry.claimId)?.lockReason ??
        entry.reason ??
        "Evidence is missing"
    }));
}

function buildDeductions(
  partialCount: number,
  lockedCriticalCount: number,
  warningCount: number,
  missingArtifactCount: number,
  conflictCount: number
): ReadinessDeduction[] {
  // Per-category caps keep one noisy bucket from dominating the whole score.
  return [
    makeDeduction(DEDUCTION_CONFIG.lockedCritical, lockedCriticalCount),
    makeDeduction(DEDUCTION_CONFIG.conflict, conflictCount),
    makeDeduction(DEDUCTION_CONFIG.partial, partialCount),
    makeDeduction(DEDUCTION_CONFIG.warning, warningCount),
    makeDeduction(DEDUCTION_CONFIG.missingArtifact, missingArtifactCount)
  ].filter((deduction) => deduction.count > 0);
}

function makeDeduction(
  config: { reason: string; pointsEach: number; cap: number },
  count: number
): ReadinessDeduction {
  return {
    reason: config.reason,
    count,
    pointsEach: config.pointsEach,
    total: Math.min(count * config.pointsEach, config.cap)
  };
}

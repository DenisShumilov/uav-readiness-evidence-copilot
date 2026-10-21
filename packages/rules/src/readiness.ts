import {
  EvidenceStatusSchema,
  ReadinessFindingSchema,
  findMalformedRevisionMentions,
  type DemoBundle,
  type EvidenceClaim,
  type EvidenceSource,
  type ReadinessFinding
} from "@uav-readiness/core";
import { z } from "zod";
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

export const ReadinessDeductionSchema = z
  .object({
    reason: z.string(),
    count: z.number().int().min(0),
    pointsEach: z.number().int().min(0),
    total: z.number().int().min(0)
  })
  .strict();

export const LockedCriticalItemSchema = z
  .object({
    id: z.string().min(1),
    reason: z.string().min(1)
  })
  .strict();

export const EngineAdjustmentSchema = z
  .object({
    claimId: z.string().min(1),
    assertedStatus: EvidenceStatusSchema,
    derivedStatus: EvidenceStatusSchema,
    reason: z.string().min(1)
  })
  .strict();

export const ReadinessAssessmentSchema = z
  .object({
    readinessScore: z.number().int().min(0).max(100),
    formula: z
      .object({
        base: z.literal(100),
        deductions: z.array(ReadinessDeductionSchema)
      })
      .strict(),
    findings: z.array(ReadinessFindingSchema),
    warnings: z.array(z.string()),
    lockedCriticalItems: z.array(LockedCriticalItemSchema),
    /**
     * Claims where the engine's derived status differs from the reviewer-typed
     * status — i.e. where the tool overrode a human label from the evidence.
     */
    engineAdjustments: z.array(EngineAdjustmentSchema),
    summary: z
      .object({
        verifiedCount: z.number().int().min(0),
        partialCount: z.number().int().min(0),
        lockedCount: z.number().int().min(0),
        conflictCount: z.number().int().min(0),
        engineAdjustedCount: z.number().int().min(0),
        missingArtifacts: z.array(z.string()),
        explanation: z.string().min(1)
      })
      .strict()
  })
  .strict();

export type ReadinessAssessment = z.infer<typeof ReadinessAssessmentSchema>;

export type ReadinessScoreCounts = {
  partialCount: number;
  lockedCriticalCount: number;
  warningCount: number;
  missingArtifactCount: number;
  conflictCount: number;
};

export type ReadinessScoreResult = {
  score: number;
  deductions: ReadinessDeduction[];
};

const NO_EVIDENCE_WARNING =
  "No verifiable evidence claims or valid artifact-backed sources found in bundle; readiness cannot be established (score forced to 0).";

export function evaluateReadiness(bundle: DemoBundle): ReadinessAssessment {
  const claimsById = new Map(
    bundle.evidenceClaims.map((claim) => [claim.id, claim])
  );
  const artifactIds = new Set(bundle.artifacts.map((a) => a.id));
  const validSources = bundle.evidenceSources.filter(
    (s) =>
      artifactIds.has(s.artifactId) &&
      Boolean(s.label && s.label.trim().length > 0) &&
      Boolean(s.excerpt && s.excerpt.trim().length > 0)
  );

  // The engine independently re-derives every status from the evidence rather
  // than trusting the reviewer's status column (see deriveStatus.ts).
  const derived = deriveEvidenceStatuses(
    bundle.evidenceClaims,
    validSources,
    bundle.qaItems
  );

  const counts = countStatuses(derived);
  const verifiedCount = counts.verifiedCount;
  const partialCount = counts.partialCount;
  const hasNoEvidence =
    bundle.evidenceClaims.length === 0 ||
    bundle.evidenceSources.length === 0 ||
    validSources.length === 0 ||
    (verifiedCount === 0 && partialCount === 0);

  const missingArtifacts = findMissingArtifacts(bundle);
  const lockedCriticalItems = buildLockedCriticalItems(
    derived,
    claimsById,
    bundle,
    hasNoEvidence
  );
  const engineAdjustments = derived
    .filter((entry) => entry.changed)
    .map((entry) => ({
      claimId: entry.claimId,
      assertedStatus: entry.assertedStatus,
      derivedStatus: entry.derivedStatus,
      reason: entry.reason
    }));
  const warnings = buildWarnings(
    derived,
    engineAdjustments,
    bundle.readinessFindings,
    bundle.evidenceSources,
    bundle.evidenceClaims,
    hasNoEvidence
  );

  const { deductions, score: rawScore } = scoreFromCounts({
    partialCount: counts.partialCount,
    lockedCriticalCount: lockedCriticalItems.length,
    warningCount: warnings.length,
    missingArtifactCount: missingArtifacts.length,
    conflictCount: counts.conflictCount
  });

  const ceiling = counts.conflictCount > 0 ? CONFLICT_CEILING : 100;
  const readinessScore = hasNoEvidence ? 0 : Math.min(rawScore, ceiling);

  const assessment: ReadinessAssessment = {
    readinessScore,
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
      explanation: buildExplanation(hasNoEvidence)
    }
  };

  return ReadinessAssessmentSchema.parse(assessment);
}

export function scoreFromCounts(
  counts: ReadinessScoreCounts
): ReadinessScoreResult {
  for (const [key, value] of Object.entries(counts)) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new RangeError(
        `Invalid readiness count for ${key}: expected a finite non-negative integer, got ${String(value)}`
      );
    }
  }

  const deductions = buildDeductions(
    counts.partialCount,
    counts.lockedCriticalCount,
    counts.warningCount,
    counts.missingArtifactCount,
    counts.conflictCount
  );
  const deductionTotal = deductions.reduce(
    (total, deduction) => total + deduction.total,
    0
  );
  const conflictCeiling = counts.conflictCount > 0 ? CONFLICT_CEILING : 100;
  const score = Math.min(conflictCeiling, Math.max(0, 100 - deductionTotal));

  return { score, deductions };
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
  findings: ReadinessFinding[],
  sources: EvidenceSource[],
  claims: EvidenceClaim[],
  hasNoEvidence: boolean
): string[] {
  const warningFindings = findings
    .filter(
      (finding) =>
        finding.severity === "warning" ||
        finding.severity === "critical" ||
        finding.status === "blocked" ||
        finding.status === "not_tested" ||
        finding.status === "fail"
    )
    .map((finding) => `${finding.id}: ${finding.title}`);
  const partialWarnings = derived
    .filter((entry) => entry.derivedStatus === "partial")
    .map((entry) => `${entry.claimId}: partial evidence`);
  const adjustmentWarnings = engineAdjustments.map(
    (entry) =>
      `${entry.claimId}: engine downgraded reviewer status ${entry.assertedStatus} -> ${entry.derivedStatus}`
  );
  const malformedWarnings = findMalformedRevisionMentions(sources).map(
    (mention) =>
      `${mention.sourceId}: malformed revision declaration in ${mention.label}`
  );

  const combined = [
    ...warningFindings,
    ...partialWarnings,
    ...adjustmentWarnings,
    ...malformedWarnings
  ];

  if (
    (hasNoEvidence || claims.length === 0) &&
    !combined.includes(NO_EVIDENCE_WARNING)
  ) {
    combined.push(NO_EVIDENCE_WARNING);
  }

  return combined;
}

function buildLockedCriticalItems(
  derived: DerivedStatus[],
  claimsById: Map<string, EvidenceClaim>,
  bundle: DemoBundle,
  hasNoEvidence: boolean
): LockedCriticalItem[] {
  const items: LockedCriticalItem[] = derived
    .filter((entry) => entry.derivedStatus === "locked")
    .map((entry) => ({
      id: entry.claimId,
      reason:
        claimsById.get(entry.claimId)?.lockReason ??
        entry.reason ??
        "Evidence is missing"
    }));

  const seenIds = new Set(items.map((item) => item.id));
  for (const finding of bundle.readinessFindings) {
    if (
      finding.severity === "critical" &&
      finding.status !== "pass" &&
      !seenIds.has(finding.id)
    ) {
      items.push({
        id: finding.id,
        reason: finding.explanation || finding.title
      });
      seenIds.add(finding.id);
    }
  }

  if (
    hasNoEvidence &&
    (items.length === 0 || bundle.evidenceClaims.length === 0) &&
    !seenIds.has("bundle.no-evidence")
  ) {
    items.push({
      id: "bundle.no-evidence",
      reason:
        "Bundle contains zero verifiable claims or artifact-backed sources; readiness score is 0 (UNVERIFIED / NOT EVALUATED)."
    });
  }

  return items;
}

function buildExplanation(hasNoEvidence: boolean): string {
  const base =
    "Score is documentation readiness only: 100 minus capped deductions for locked, conflicting, partial, warning, and missing-artifact evidence. Statuses are derived by the engine from the evidence (locked when a source is missing, graded from test outcomes, conflict from cross-document disagreement), not read from the reviewer's status column. Derived partial claims intentionally count in the partial bucket and also create a warning, so weak evidence compounds without changing the formula weights. A conflict on a critical claim caps the verdict in the Blocked band.";
  if (!hasNoEvidence) {
    return base;
  }
  return `${base} Readiness score is 0 because the bundle contains no verified or partially verified artifact-backed evidence claims (UNVERIFIED / insufficient data, not a proven physical failure of the vehicle).`;
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

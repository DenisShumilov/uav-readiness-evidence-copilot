import type { DemoBundle } from "@uav-readiness/core";
import type { ReadinessAssessment } from "@uav-readiness/rules";

/**
 * Methodological note: A `verified` status with `derivation: "reviewer_upper_bound"`
 * indicates that a linked artifact-backed evidence source is present and no
 * contradiction or failing test outcome was detected against the author-asserted
 * status; it is not an automatic physical proof of the truth of the content.
 */
export const TRACEABILITY_METHODOLOGY_NOTE =
  'Methodological note: A "verified" status with derivation "reviewer_upper_bound" indicates that a linked artifact-backed source is present and no contradiction was detected against the author-asserted status, not an automatic physical proof of content truth.';

export type TraceabilityMatrixRow = {
  requirement: string;
  evidence: string;
  check: string;
  status: string;
  risk: string;
};

const NEGATIVE_NUMBER_PATTERN = /^[ \t]*-(?:\d+\.?\d*|\.\d+)$/;

export function generateTraceabilityMatrix(
  bundle: DemoBundle,
  assessment: ReadinessAssessment
): string {
  const rows = buildTraceabilityRows(bundle, assessment);
  const header = ["requirement", "evidence", "check", "status", "risk"];

  return [
    header.join(","),
    ...rows.map((row) =>
      [
        row.requirement,
        row.evidence,
        row.check,
        row.status,
        row.risk
      ]
        .map(csvCell)
        .join(",")
    )
  ].join("\n") + "\n";
}

export function buildTraceabilityRows(
  bundle: DemoBundle,
  assessment: ReadinessAssessment
): TraceabilityMatrixRow[] {
  const qaByClaimId = new Map<string, string>();
  bundle.qaItems.forEach((item) => {
    item.evidenceClaimIds.forEach((claimId) => {
      qaByClaimId.set(claimId, item.question);
    });
  });

  const lockedByClaimId = new Map(
    assessment.lockedCriticalItems.map((item) => [item.id, item.reason])
  );
  const adjustedByClaimId = new Map(
    assessment.engineAdjustments.map((item) => [item.claimId, item])
  );

  return bundle.evidenceClaims.map((claim) => {
    const adjustment = adjustedByClaimId.get(claim.id);
    const status =
      adjustment?.derivedStatus ??
      (lockedByClaimId.has(claim.id) ? "locked" : claim.status);

    return {
      requirement: claim.statement,
      evidence:
        claim.evidenceSourceIds.length > 0
          ? claim.evidenceSourceIds.join(";")
          : "missing",
      check: qaByClaimId.get(claim.id) ?? "documentation review",
      status,
      risk:
        status === "locked"
          ? lockedByClaimId.get(claim.id) ??
            adjustment?.reason ??
            claim.lockReason ??
            "missing evidence"
          : status === "conflict"
            ? claim.lockReason ?? adjustment?.reason ?? "conflicting evidence"
            : status === "partial"
              ? adjustment?.reason ?? "partial evidence"
              : "none (reviewer_upper_bound: linked source present and no contradiction detected; not an automatic physical proof of content)"
    };
  });
}

export function csvCell(value: string): string {
  const needsFormulaGuard =
    /^[ \t]*[=+\-@\t\r]/.test(value) && !NEGATIVE_NUMBER_PATTERN.test(value);
  const safeValue = needsFormulaGuard ? `'${value}` : value;
  const escaped = safeValue.replace(/"/g, '""');
  return needsFormulaGuard || /[",\r\n]/.test(escaped)
    ? `"${escaped}"`
    : escaped;
}

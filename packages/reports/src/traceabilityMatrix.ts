import type { DemoBundle } from "@uav-readiness/core";
import type { ReadinessAssessment } from "@uav-readiness/rules";

export type TraceabilityMatrixRow = {
  requirement: string;
  evidence: string;
  check: string;
  status: string;
  risk: string;
};

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
              : "none"
    };
  });
}

function csvCell(value: string): string {
  const needsFormulaGuard = /^[ \t]*[=+\-@\t\r]/.test(value);
  const safeValue = needsFormulaGuard ? `'${value}` : value;
  const escaped = safeValue.replace(/"/g, '""');
  return needsFormulaGuard || /[",\r\n]/.test(escaped)
    ? `"${escaped}"`
    : escaped;
}

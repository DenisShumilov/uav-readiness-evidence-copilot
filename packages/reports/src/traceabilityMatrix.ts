import type { DemoBundle } from "../../core/src/schemas";
import type { ReadinessAssessment } from "../../rules/src/readiness";

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

  return bundle.evidenceClaims.map((claim) => ({
    requirement: claim.statement,
    evidence:
      claim.evidenceSourceIds.length > 0
        ? claim.evidenceSourceIds.join(";")
        : "missing",
    check: qaByClaimId.get(claim.id) ?? "documentation review",
    status: claim.status,
    risk:
      claim.status === "locked"
        ? lockedByClaimId.get(claim.id) ?? claim.lockReason ?? "missing evidence"
        : claim.status === "partial"
          ? "partial evidence"
          : "none"
  }));
}

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

import type {
  EvidenceClaim,
  EvidenceSource,
  EvidenceStatus,
  QAItem
} from "@uav-readiness/core";

// Structural inputs so the SAME derivation runs on the synthetic demo bundle AND
// on real, non-operational evidence (e.g. the self-audit over the repo's own
// docs) without forcing real data through the `synthetic: true` schema literal.
export type DerivableClaim = Pick<
  EvidenceClaim,
  "id" | "status" | "claimType" | "evidenceSourceIds"
>;
export type DerivableSource = Pick<EvidenceSource, "id">;
export type DerivableQaItem = Pick<QAItem, "status" | "evidenceClaimIds">;

/**
 * The engine's INDEPENDENT verdict on each claim.
 *
 * The parsers ingest a reviewer-written status column (an assertion). This
 * module does NOT trust that column blindly: it re-derives a status from the
 * structure of the evidence and may only ever make the verdict MORE
 * conservative than the reviewer claimed — it never inflates a status. Three
 * signals are genuinely derived from content, not read from the label:
 *
 *   1. no / dangling evidence  -> locked    (a claim whose linked sources do not
 *                                            exist cannot be supported)
 *   2. logged test outcome     -> status    (a `test_record` claim is graded by
 *                                            its own pass / warning / blocked
 *                                            result, so a "verified" label on a
 *                                            failing check is overridden)
 *   3. cross-document conflict -> conflict   (already derived in core/crossCheck)
 *
 * For every other claim the reviewer's asserted status is accepted only as an
 * UPPER BOUND once the evidence-presence gate passes. Documentation QA only;
 * none of this touches operational data.
 */

// Optimism ladder. The engine may move a claim DOWN this ladder (more
// conservative) but never UP past the reviewer's assertion. `conflict` sits
// below `locked` because a proven contradiction is the strongest block.
const OPTIMISM: Record<EvidenceStatus, number> = {
  conflict: -1,
  locked: 0,
  partial: 1,
  verified: 2
};

export type StatusDerivation =
  | "no_evidence"
  | "dangling_evidence"
  | "test_outcome"
  | "cross_document_conflict"
  | "reviewer_upper_bound";

export type DerivedStatus = {
  claimId: string;
  /** The status a human reviewer wrote in the source document. */
  assertedStatus: EvidenceStatus;
  /** The status the engine derived from the structure of the evidence. */
  derivedStatus: EvidenceStatus;
  derivation: StatusDerivation;
  /** True when the engine's verdict differs from the reviewer's label. */
  changed: boolean;
  reason: string;
};

export function deriveEvidenceStatuses(
  claims: DerivableClaim[],
  sources: DerivableSource[],
  qaItems: DerivableQaItem[] = []
): DerivedStatus[] {
  const sourceIds = new Set(sources.map((source) => source.id));
  const qaByClaim = new Map<string, DerivableQaItem[]>();

  for (const item of qaItems) {
    for (const claimId of item.evidenceClaimIds) {
      const bucket = qaByClaim.get(claimId);
      if (bucket) {
        bucket.push(item);
      } else {
        qaByClaim.set(claimId, [item]);
      }
    }
  }

  return claims.map((claim) =>
    deriveOne(claim, sourceIds, qaByClaim.get(claim.id) ?? [])
  );
}

function deriveOne(
  claim: DerivableClaim,
  sourceIds: Set<string>,
  qaItems: DerivableQaItem[]
): DerivedStatus {
  const asserted = claim.status;

  // A conflict is itself an engine derivation (core/crossCheck) — keep it.
  if (asserted === "conflict") {
    return mark(
      claim,
      "conflict",
      "cross_document_conflict",
      "Derived from a cross-document revision disagreement"
    );
  }

  // The linked evidence must actually exist. An empty or dangling reference
  // means the claim is unsupported, regardless of the label a reviewer typed.
  const referenced = claim.evidenceSourceIds;
  const resolvable = referenced.filter((id) => sourceIds.has(id));
  if (referenced.length === 0) {
    return mark(claim, "locked", "no_evidence", "No evidence source is linked");
  }
  if (resolvable.length === 0) {
    return mark(
      claim,
      "locked",
      "dangling_evidence",
      `Linked evidence (${referenced.join(", ")}) was not produced by any parsed artifact`
    );
  }

  // A test record is graded by its OWN logged outcome, not its status column:
  // a "verified" label on a check that actually failed is overridden here.
  if (claim.claimType === "test_record" && qaItems.length > 0) {
    const fromTest = worstOf(qaItems.map((item) => statusFromQa(item.status)));
    return mark(
      claim,
      moreConservative(fromTest, asserted),
      "test_outcome",
      `Graded from the logged test outcome (${qaItems
        .map((item) => item.status)
        .join(", ")})`
    );
  }

  // Otherwise the reviewer's status stands, but only as an upper bound the
  // engine will not inflate (evidence presence was already checked above).
  return mark(
    claim,
    asserted,
    "reviewer_upper_bound",
    "Reviewer status accepted; evidence is present"
  );
}

function statusFromQa(status: DerivableQaItem["status"]): EvidenceStatus {
  switch (status) {
    case "pass":
      return "verified";
    case "not_tested":
      return "partial";
    case "blocked":
    case "fail":
    default:
      return "locked";
  }
}

function worstOf(statuses: EvidenceStatus[]): EvidenceStatus {
  return statuses.reduce<EvidenceStatus>(
    (worst, next) => (OPTIMISM[next] < OPTIMISM[worst] ? next : worst),
    "verified"
  );
}

function moreConservative(a: EvidenceStatus, b: EvidenceStatus): EvidenceStatus {
  return OPTIMISM[a] <= OPTIMISM[b] ? a : b;
}

function mark(
  claim: DerivableClaim,
  derivedStatus: EvidenceStatus,
  derivation: StatusDerivation,
  reason: string
): DerivedStatus {
  return {
    claimId: claim.id,
    assertedStatus: claim.status,
    derivedStatus,
    derivation,
    changed: derivedStatus !== claim.status,
    reason
  };
}

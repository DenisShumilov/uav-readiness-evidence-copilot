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
export type DerivableQaItem = Pick<QAItem, "status" | "evidenceClaimIds"> & {
  id?: string;
};

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
  | "reviewer_upper_bound"
  | "verbatim";

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
  const referenced = claim.evidenceSourceIds;
  const resolvable = referenced.filter((id) => sourceIds.has(id));
  const missing = referenced.filter((id) => !sourceIds.has(id));
  const missingSuffix =
    missing.length > 0
      ? ` (missing evidence source(s): ${missing.join(", ")})`
      : "";

  let qaMatch: DerivableQaItem | undefined;
  let fromTest: EvidenceStatus | undefined;
  if (qaItems.length > 0) {
    for (const item of qaItems) {
      const next = statusFromQa(item.status);
      if (!fromTest || OPTIMISM[next] < OPTIMISM[fromTest]) {
        fromTest = next;
        qaMatch = item;
      }
    }
  }

  if (asserted === "conflict") {
    return mark(
      claim,
      "conflict",
      "verbatim",
      "Asserted conflict preserved conservatively" + missingSuffix
    );
  }

  if (fromTest === "locked" && qaMatch) {
    return mark(
      claim,
      "locked",
      "test_outcome",
      "Locked by " +
        qaMatch.status +
        " test outcome (" +
        (qaMatch.id ?? "qa") +
        ")" +
        missingSuffix
    );
  }

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

  if (asserted === "locked") {
    return mark(
      claim,
      "locked",
      missing.length > 0 ? "dangling_evidence" : "verbatim",
      "Asserted locked status preserved" + missingSuffix
    );
  }

  if (missing.length > 0) {
    return mark(
      claim,
      moreConservative(
        "partial",
        fromTest ? moreConservative(fromTest, asserted) : asserted
      ),
      "dangling_evidence",
      "Downgraded to partial because evidence source(s) are missing or lack valid artifact excerpts: " +
        missing.join(", ") +
        "."
    );
  }

  if (fromTest) {
    const combined = moreConservative(fromTest, asserted);
    return mark(
      claim,
      combined,
      "test_outcome",
      `Graded from the logged test outcome (${qaItems
        .map((item) => item.status)
        .join(", ")})`
    );
  }

  return mark(
    claim,
    asserted,
    "reviewer_upper_bound",
    asserted === "verified"
      ? "Author-asserted verified status retained as upper bound (linked source reference present; content not independently proven by engine)."
      : "Asserted status (" + asserted + ") retained as reviewer upper bound."
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

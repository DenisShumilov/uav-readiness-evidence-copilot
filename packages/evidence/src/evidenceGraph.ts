import {
  EvidenceGraphSchema,
  type DemoBundle,
  type EvidenceClaim,
  type EvidenceGraph,
  type EvidenceLock,
  type EvidenceSource,
  type EvidenceStatus,
  type QAItem
} from "@uav-readiness/core";

export type EvidenceGraphSummary = {
  totalClaims: number;
  totalSources: number;
  totalLocks: number;
  verifiedCount: number;
  partialCount: number;
  lockedCount: number;
  conflictCount: number;
};

export type BuiltEvidenceGraph = {
  evidenceGraph: EvidenceGraph;
  evidenceSources: EvidenceSource[];
  evidenceClaims: EvidenceClaim[];
  evidenceLocks: EvidenceLock[];
  summary: EvidenceGraphSummary;
};

const OPTIMISM: Record<EvidenceStatus, number> = {
  conflict: -1,
  locked: 0,
  partial: 1,
  verified: 2
};

export function buildEvidenceGraphFromBundle(
  bundle: DemoBundle,
  generatedAt = new Date().toISOString()
): BuiltEvidenceGraph {
  const artifactIds = new Set(bundle.artifacts.map((artifact) => artifact.id));
  const rawSources = uniqueById(bundle.evidenceSources);
  const evidenceSources = rawSources.filter(
    (source) =>
      artifactIds.has(source.artifactId) &&
      Boolean(source.label && source.label.trim().length > 0) &&
      Boolean(source.excerpt && source.excerpt.trim().length > 0)
  );
  const evidenceClaims = deriveGraphClaims(
    uniqueById(bundle.evidenceClaims),
    evidenceSources,
    bundle.qaItems
  );
  const evidenceLocks = uniqueById(bundle.evidenceLocks);
  const synthetic =
    bundle.artifacts.length > 0 &&
    bundle.artifacts.every((artifact) => artifact.synthetic);

  const evidenceGraph = EvidenceGraphSchema.parse({
    id: "graph.demo-bundle",
    artifactIds: uniqueStrings(bundle.artifacts.map((artifact) => artifact.id)),
    evidenceSourceIds: evidenceSources.map((source) => source.id),
    evidenceClaimIds: evidenceClaims.map((claim) => claim.id),
    links: buildLinks(evidenceClaims, evidenceSources),
    generatedAt,
    synthetic
  });

  return {
    evidenceGraph,
    evidenceSources,
    evidenceClaims,
    evidenceLocks,
    summary: summarizeClaims(evidenceClaims, evidenceSources, evidenceLocks)
  };
}

export const buildEvidenceGraph = buildEvidenceGraphFromBundle;

function deriveGraphClaims(
  claims: EvidenceClaim[],
  sources: EvidenceSource[],
  qaItems: QAItem[]
): EvidenceClaim[] {
  const sourceIds = new Set(sources.map((source) => source.id));
  const qaByClaim = new Map<string, QAItem[]>();

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

  return claims.map((claim) => {
    const asserted = claim.status;
    const referenced = claim.evidenceSourceIds;
    const resolvable = referenced.filter((id) => sourceIds.has(id));
    const missing = referenced.filter((id) => !sourceIds.has(id));
    const missingSuffix =
      missing.length > 0
        ? ` (missing evidence source(s): ${missing.join(", ")})`
        : "";

    const linkedQa = qaByClaim.get(claim.id) ?? [];
    let qaMatch: QAItem | undefined;
    let fromTest: EvidenceStatus | undefined;
    if (linkedQa.length > 0) {
      for (const item of linkedQa) {
        const next = statusFromQa(item.status);
        if (!fromTest || OPTIMISM[next] < OPTIMISM[fromTest]) {
          fromTest = next;
          qaMatch = item;
        }
      }
    }

    if (asserted === "conflict") {
      return {
        ...claim,
        status: "conflict",
        lockReason:
          claim.lockReason ??
          `Asserted conflict preserved conservatively${missingSuffix}`
      };
    }

    if (fromTest === "locked" && qaMatch) {
      return {
        ...claim,
        status: "locked",
        lockReason:
          claim.lockReason ??
          `Locked by ${qaMatch.status} test outcome (${qaMatch.id})${missingSuffix}`
      };
    }

    if (referenced.length === 0) {
      return {
        ...claim,
        status: "locked",
        lockReason: claim.lockReason ?? "No evidence source is linked"
      };
    }

    if (resolvable.length === 0) {
      return {
        ...claim,
        status: "locked",
        lockReason:
          claim.lockReason ??
          `Linked evidence (${referenced.join(", ")}) was not produced by any parsed artifact`
      };
    }

    if (asserted === "locked") {
      return {
        ...claim,
        status: "locked",
        lockReason:
          claim.lockReason ??
          `Asserted locked status preserved${missingSuffix}`
      };
    }

    if (missing.length > 0) {
      const status = moreConservative(
        "partial",
        fromTest ? moreConservative(fromTest, asserted) : asserted
      );
      return {
        ...claim,
        status,
        lockReason:
          status === "locked"
            ? claim.lockReason ??
              `Downgraded to partial because evidence source(s) are missing or lack valid artifact excerpts: ${missing.join(", ")}.`
            : claim.lockReason
      };
    }

    if (fromTest) {
      const status = moreConservative(fromTest, asserted);
      return {
        ...claim,
        status,
        lockReason:
          status === "locked"
            ? claim.lockReason ??
              `Graded from the logged test outcome (${linkedQa
                .map((item) => item.status)
                .join(", ")})`
            : claim.lockReason
      };
    }

    return claim;
  });
}

function statusFromQa(status: QAItem["status"]): EvidenceStatus {
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

function buildLinks(
  claims: EvidenceClaim[],
  sources: EvidenceSource[]
): EvidenceGraph["links"] {
  const sourceIds = new Set(sources.map((source) => source.id));

  return claims.flatMap((claim) => {
    if (claim.status === "locked") {
      return [];
    }
    return claim.evidenceSourceIds
      .filter((sourceId) => sourceIds.has(sourceId))
      .map((sourceId) => ({
        claimId: claim.id,
        evidenceSourceId: sourceId,
        relation:
          claim.status === "conflict"
            ? "conflicts"
            : claim.status === "partial"
              ? "partially_supports"
              : "supports"
      }));
  });
}

function summarizeClaims(
  claims: EvidenceClaim[],
  sources: EvidenceSource[],
  locks: EvidenceLock[]
): EvidenceGraphSummary {
  return {
    totalClaims: claims.length,
    totalSources: sources.length,
    totalLocks: locks.length,
    verifiedCount: claims.filter((claim) => claim.status === "verified").length,
    partialCount: claims.filter((claim) => claim.status === "partial").length,
    lockedCount: claims.filter((claim) => claim.status === "locked").length,
    conflictCount: claims.filter((claim) => claim.status === "conflict").length
  };
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>();

  items.forEach((item) => {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  });

  return [...byId.values()];
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items)];
}

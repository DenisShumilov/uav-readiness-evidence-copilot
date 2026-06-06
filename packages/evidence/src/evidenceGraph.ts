import {
  EvidenceGraphSchema,
  type DemoBundle,
  type EvidenceClaim,
  type EvidenceGraph,
  type EvidenceLock,
  type EvidenceSource
} from "../../core/src/schemas";

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

export function buildEvidenceGraphFromBundle(
  bundle: DemoBundle,
  generatedAt = new Date().toISOString()
): BuiltEvidenceGraph {
  const evidenceSources = uniqueById(bundle.evidenceSources);
  const evidenceClaims = uniqueById(bundle.evidenceClaims);
  const evidenceLocks = uniqueById(bundle.evidenceLocks);

  const evidenceGraph = EvidenceGraphSchema.parse({
    id: "graph.demo-bundle",
    artifactIds: uniqueStrings(bundle.artifacts.map((artifact) => artifact.id)),
    evidenceSourceIds: evidenceSources.map((source) => source.id),
    evidenceClaimIds: evidenceClaims.map((claim) => claim.id),
    links: buildLinks(evidenceClaims, evidenceSources),
    generatedAt,
    synthetic: true
  });

  return {
    evidenceGraph,
    evidenceSources,
    evidenceClaims,
    evidenceLocks,
    summary: summarizeClaims(evidenceClaims, evidenceSources, evidenceLocks)
  };
}

function buildLinks(
  claims: EvidenceClaim[],
  sources: EvidenceSource[]
): EvidenceGraph["links"] {
  const sourceIds = new Set(sources.map((source) => source.id));

  return claims.flatMap((claim) =>
    claim.evidenceSourceIds
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
      }))
  );
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

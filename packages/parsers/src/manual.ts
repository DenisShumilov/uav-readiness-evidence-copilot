import {
  ArtifactSchema,
  EvidenceClaimSchema,
  EvidenceSourceSchema,
  EvidenceStatusSchema,
  type Artifact,
  type EvidenceClaim,
  type EvidenceSource
} from "@uav-readiness/core";
import {
  allocateDisambiguatedEvidenceId,
  type DisambiguationSourceFields
} from "./disambiguate";
import { extractMarkdownTable, toSafeIdPart } from "./text";

const MANUAL_ARTIFACT_ID = "artifact.demo-manual";

export type ManualParseOptions = {
  requireSyntheticBanner?: boolean;
  synthetic?: boolean;
};

export type ParsedManualMd = {
  artifact: Artifact;
  evidenceSources: EvidenceSource[];
  evidenceClaims: EvidenceClaim[];
};

export function parseManualMd(
  markdown: string,
  options?: ManualParseOptions
): ParsedManualMd {
  const requireSyntheticBanner = options?.requireSyntheticBanner ?? true;
  const hasBanner = markdown.includes("SYNTHETIC DEMO");
  if (requireSyntheticBanner && !hasBanner) {
    throw new Error("Manual fixture must be marked synthetic");
  }
  const synthetic = options?.synthetic ?? hasBanner;

  const rows = extractMarkdownTable(
    markdown,
    "| Claim | Status | Evidence |"
  ).map((cells, index) => {
    if (cells.length !== 3) {
      throw new Error(`Invalid manual evidence row ${index + 1}`);
    }

    const status = EvidenceStatusSchema.parse(cells[1]);
    const evidenceId = normalizeEvidenceId(cells[2]);
    const finalStatus = evidenceId ? status : "locked";

    return {
      claim: cells[0],
      status: finalStatus,
      evidenceId
    };
  });

  const artifact = ArtifactSchema.parse({
    id: MANUAL_ARTIFACT_ID,
    kind: "manual",
    filename: "demo_manual.md",
    description: "Synthetic manual fixture for documentation QA review",
    synthetic
  });

  const reservedRawIds = new Set(
    rows
      .map((row) => row.evidenceId)
      .filter((id): id is string => Boolean(id))
  );
  const usedSourcesById = new Map<string, DisambiguationSourceFields>();
  const usedIds = new Set<string>();
  const evidenceSources: EvidenceSource[] = [];
  const evidenceClaims: EvidenceClaim[] = [];

  rows.forEach((row, index) => {
    let finalEvidenceId: string | undefined;
    if (row.evidenceId) {
      const label = `Manual evidence for ${row.claim}`;
      const excerpt = row.claim;
      const { finalId, deduplicated } = allocateDisambiguatedEvidenceId({
        rawId: row.evidenceId,
        rowNumber: index + 1,
        suffixTag: "manual",
        candidateSource: {
          artifactId: MANUAL_ARTIFACT_ID,
          label,
          sourceType: "document",
          excerpt
        },
        usedSourcesById,
        usedIds,
        reservedRawIds
      });
      finalEvidenceId = finalId;

      if (!deduplicated) {
        evidenceSources.push(
          EvidenceSourceSchema.parse({
            id: finalId,
            artifactId: MANUAL_ARTIFACT_ID,
            label,
            sourceType: "document",
            excerpt,
            confidence: row.status === "verified" ? "high" : "medium",
            synthetic
          })
        );
      }
    }

    evidenceClaims.push(
      EvidenceClaimSchema.parse({
        id: `claim.manual.${toSafeIdPart(row.claim)}`,
        statement:
          row.status === "locked"
            ? `${row.claim} requires supporting evidence`
            : row.claim,
        claimType: getManualClaimType(row.claim),
        status: row.status,
        evidenceSourceIds: finalEvidenceId ? [finalEvidenceId] : [],
        lockReason:
          row.status === "locked"
            ? "Manual evidence row has no supporting evidence id"
            : undefined
      })
    );
  });

  return {
    artifact,
    evidenceSources,
    evidenceClaims
  };
}

function normalizeEvidenceId(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" || trimmed.toLowerCase() === "none" ? undefined : trimmed;
}

function getManualClaimType(
  claim: string
): "artifact_presence" | "component_record" | "wiring_documentation" {
  const normalized = claim.toLowerCase();
  if (normalized.includes("manual")) {
    return "artifact_presence";
  }

  if (normalized.includes("connector")) {
    return "wiring_documentation";
  }

  return "component_record";
}

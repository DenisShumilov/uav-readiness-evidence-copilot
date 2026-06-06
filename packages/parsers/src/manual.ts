import {
  ArtifactSchema,
  EvidenceClaimSchema,
  EvidenceSourceSchema,
  EvidenceStatusSchema,
  type Artifact,
  type EvidenceClaim,
  type EvidenceSource
} from "../../core/src/schemas";
import { extractMarkdownTable, toSafeIdPart } from "./text";

const MANUAL_ARTIFACT_ID = "artifact.demo-manual";

export type ParsedManualMd = {
  artifact: Artifact;
  evidenceSources: EvidenceSource[];
  evidenceClaims: EvidenceClaim[];
};

export function parseManualMd(markdown: string): ParsedManualMd {
  if (!markdown.includes("SYNTHETIC DEMO")) {
    throw new Error("Manual fixture must be marked synthetic");
  }

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
    synthetic: true
  });

  return {
    artifact,
    evidenceSources: rows
      .filter((row) => row.evidenceId)
      .map((row) =>
        EvidenceSourceSchema.parse({
          id: row.evidenceId,
          artifactId: MANUAL_ARTIFACT_ID,
          label: `Manual evidence for ${row.claim}`,
          sourceType: "document",
          excerpt: row.claim,
          confidence: row.status === "verified" ? "high" : "medium",
          synthetic: true
        })
      ),
    evidenceClaims: rows.map((row) =>
      EvidenceClaimSchema.parse({
        id: `claim.manual.${toSafeIdPart(row.claim)}`,
        statement:
          row.status === "locked"
            ? `${row.claim} requires supporting evidence`
            : row.claim,
        claimType: getManualClaimType(row.claim),
        status: row.status,
        evidenceSourceIds: row.evidenceId ? [row.evidenceId] : [],
        lockReason:
          row.status === "locked"
            ? "Manual evidence row has no supporting evidence id"
            : undefined
      })
    )
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

import {
  ArtifactSchema,
  EvidenceClaimSchema,
  EvidenceLockSchema,
  EvidenceSourceSchema,
  EvidenceStatusSchema,
  FindingSeveritySchema,
  ReadinessFindingSchema,
  SafeIdSchema,
  SafeTextSchema,
  type Artifact,
  type EvidenceClaim,
  type EvidenceLock,
  type EvidenceSource,
  type ReadinessFinding
} from "@uav-readiness/core";
import {
  extractMarkdownField,
  extractMarkdownTable,
  toSafeIdPart
} from "./text";

const QA_NOTES_ARTIFACT_ID = "artifact.qa-notes";

export type ParsedQaNotesMd = {
  artifact: Artifact;
  evidenceSources: EvidenceSource[];
  evidenceClaims: EvidenceClaim[];
  evidenceLocks: EvidenceLock[];
  readinessFindings: ReadinessFinding[];
};

export function parseQaNotesMd(markdown: string): ParsedQaNotesMd {
  if (!markdown.includes("SYNTHETIC DEMO")) {
    throw new Error("QA notes fixture must be marked synthetic");
  }

  const rows = extractMarkdownTable(
    markdown,
    "| Evidence ID | Status | Meaning |"
  ).map((cells, index) => {
    if (cells.length !== 3) {
      throw new Error(`Invalid QA notes evidence row ${index + 1}`);
    }

    return {
      evidenceId: SafeIdSchema.parse(cells[0]),
      status: EvidenceStatusSchema.parse(cells[1]),
      meaning: SafeTextSchema.parse(cells[2])
    };
  });

  const findingId = SafeIdSchema.parse(extractMarkdownField(markdown, "Finding ID"));
  const severity = FindingSeveritySchema.parse(
    extractMarkdownField(markdown, "Status")
  );
  const reason = SafeTextSchema.parse(extractMarkdownField(markdown, "Reason"));
  const impact = SafeTextSchema.parse(extractMarkdownField(markdown, "Impact"));

  const artifact = ArtifactSchema.parse({
    id: QA_NOTES_ARTIFACT_ID,
    kind: "qa_notes",
    filename: "qa_notes.md",
    description: "Synthetic QA notes fixture for evidence review",
    synthetic: true
  });

  const evidenceSources = rows
    .filter((row) => row.status !== "locked")
    .map((row) =>
      EvidenceSourceSchema.parse({
        id: row.evidenceId,
        artifactId: QA_NOTES_ARTIFACT_ID,
        label: `QA evidence ${row.evidenceId}`,
        sourceType: "note",
        excerpt: row.meaning,
        confidence: row.status === "verified" ? "high" : "medium",
        synthetic: true
      })
    );

  const evidenceClaims = rows.map((row) =>
    EvidenceClaimSchema.parse({
      id: `claim.qa.${toSafeIdPart(row.evidenceId)}`,
      statement:
        row.status === "locked"
          ? `${row.evidenceId} requires supporting evidence`
          : row.meaning,
      claimType: "qa_note",
      status: row.status,
      evidenceSourceIds: row.status === "locked" ? [] : [row.evidenceId],
      lockReason: row.status === "locked" ? row.meaning : undefined
    })
  );

  const evidenceLocks = rows
    .filter((row) => row.status === "locked")
    .map((row) =>
      EvidenceLockSchema.parse({
        id: `lock.${toSafeIdPart(row.evidenceId)}`,
        claimId: `claim.qa.${toSafeIdPart(row.evidenceId)}`,
        reason: row.meaning,
        missingEvidence: [row.meaning],
        severity: "warning",
        status: "locked"
      })
    );

  const readinessFindings = [
    ReadinessFindingSchema.parse({
      id: findingId,
      title: "Traceability warning",
      category: "traceability",
      severity,
      status: "blocked",
      evidenceClaimIds: evidenceClaims.map((claim) => claim.id),
      lockIds: evidenceLocks.map((lock) => lock.id),
      explanation: `${reason} ${impact}`
    })
  ];

  return {
    artifact,
    evidenceSources,
    evidenceClaims,
    evidenceLocks,
    readinessFindings
  };
}

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
  const structuredRevisions = extractStructuredRevisionLines(markdown);

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

  const nonLockedRows = rows.filter((row) => row.status !== "locked");
  const hasExplicitRevisionRow = nonLockedRows.some((row) =>
    row.meaning.toLowerCase().includes("revision")
  );
  const evidenceSources = nonLockedRows.map((row, index) => {
    const attachStructuredRevisions =
      structuredRevisions.length > 0 &&
      (hasExplicitRevisionRow
        ? row.meaning.toLowerCase().includes("revision")
        : index === nonLockedRows.length - 1);
    return EvidenceSourceSchema.parse({
      id: row.evidenceId,
      artifactId: QA_NOTES_ARTIFACT_ID,
      label: `QA evidence ${row.evidenceId}`,
      sourceType: "note",
      excerpt: attachStructuredRevisions
        ? `${structuredRevisions.join("\n")}\n${row.meaning}`
        : row.meaning,
      confidence: row.status === "verified" ? "high" : "medium",
      synthetic: true
    });
  });

  if (evidenceSources.length === 0 && structuredRevisions.length > 0) {
    evidenceSources.push(
      EvidenceSourceSchema.parse({
        id: "ev.qa.revision",
        artifactId: QA_NOTES_ARTIFACT_ID,
        label: "QA revision declaration",
        sourceType: "note",
        excerpt: structuredRevisions.join("\n"),
        confidence: "high",
        synthetic: true
      })
    );
  }

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

function extractStructuredRevisionLines(markdown: string): string[] {
  return [...markdown.matchAll(/^Revision:\s*([a-z0-9-]+)\s*=\s*([a-z0-9.-]+)\s*$/gim)]
    .map((match) => SafeTextSchema.parse(`Revision: ${match[1]}=${match[2]}`));
}

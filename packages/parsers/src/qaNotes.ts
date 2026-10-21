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
  allocateDisambiguatedEvidenceId,
  type DisambiguationSourceFields
} from "./disambiguate";
import {
  extractMarkdownField,
  extractMarkdownTable,
  toSafeIdPart
} from "./text";

const QA_NOTES_ARTIFACT_ID = "artifact.qa-notes";

export type QaNotesParseOptions = {
  requireSyntheticBanner?: boolean;
  synthetic?: boolean;
};

export type ParsedQaNotesMd = {
  artifact: Artifact;
  evidenceSources: EvidenceSource[];
  evidenceClaims: EvidenceClaim[];
  evidenceLocks: EvidenceLock[];
  readinessFindings: ReadinessFinding[];
};

export function parseQaNotesMd(
  markdown: string,
  options?: QaNotesParseOptions
): ParsedQaNotesMd {
  const requireSyntheticBanner = options?.requireSyntheticBanner ?? true;
  const hasBanner = markdown.includes("SYNTHETIC DEMO");
  if (requireSyntheticBanner && !hasBanner) {
    throw new Error("QA notes fixture must be marked synthetic");
  }
  const synthetic = options?.synthetic ?? hasBanner;

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
    synthetic
  });

  const nonLockedRows = rows.filter((row) => row.status !== "locked");
  const hasExplicitRevisionRow = nonLockedRows.some((row) =>
    row.meaning.toLowerCase().includes("revision")
  );
  const lastNonLockedIndex = rows.reduce(
    (last, row, idx) => (row.status !== "locked" ? idx : last),
    -1
  );

  const reservedRawIds = new Set(
    rows
      .filter((row) => row.status !== "locked")
      .map((row) => row.evidenceId)
  );
  if (nonLockedRows.length === 0 && structuredRevisions.length > 0) {
    reservedRawIds.add("ev.qa.revision");
  }

  const usedSourcesById = new Map<string, DisambiguationSourceFields>();
  const usedIds = new Set<string>();
  const evidenceSources: EvidenceSource[] = [];
  const evidenceClaims: EvidenceClaim[] = [];
  const evidenceLocks: EvidenceLock[] = [];

  rows.forEach((row, index) => {
    let finalEvidenceId = row.evidenceId;
    if (row.status !== "locked") {
      const attachStructuredRevisions =
        structuredRevisions.length > 0 &&
        (hasExplicitRevisionRow
          ? row.meaning.toLowerCase().includes("revision")
          : index === lastNonLockedIndex);
      const excerpt = attachStructuredRevisions
        ? `${structuredRevisions.join("\n")}\n${row.meaning}`
        : row.meaning;
      const label = `QA evidence ${row.evidenceId}`;
      const { finalId, deduplicated } = allocateDisambiguatedEvidenceId({
        rawId: row.evidenceId,
        rowNumber: index + 1,
        suffixTag: "qa-notes",
        candidateSource: {
          artifactId: QA_NOTES_ARTIFACT_ID,
          label,
          sourceType: "note",
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
            artifactId: QA_NOTES_ARTIFACT_ID,
            label: `QA evidence ${finalId}`,
            sourceType: "note",
            excerpt,
            confidence: row.status === "verified" ? "high" : "medium",
            synthetic
          })
        );
      }
    }

    const claimId = `claim.qa.${toSafeIdPart(finalEvidenceId)}`;
    evidenceClaims.push(
      EvidenceClaimSchema.parse({
        id: claimId,
        statement:
          row.status === "locked"
            ? `${row.evidenceId} requires supporting evidence`
            : row.meaning,
        claimType: "qa_note",
        status: row.status,
        evidenceSourceIds: row.status === "locked" ? [] : [finalEvidenceId],
        lockReason: row.status === "locked" ? row.meaning : undefined
      })
    );

    if (row.status === "locked") {
      evidenceLocks.push(
        EvidenceLockSchema.parse({
          id: `lock.${toSafeIdPart(finalEvidenceId)}`,
          claimId,
          reason: row.meaning,
          missingEvidence: [row.meaning],
          severity: "warning",
          status: "locked"
        })
      );
    }
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
        synthetic
      })
    );
  }

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

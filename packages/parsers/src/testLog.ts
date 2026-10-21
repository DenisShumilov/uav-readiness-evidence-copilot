import { z } from "zod";
import {
  ArtifactSchema,
  EvidenceClaimSchema,
  EvidenceSourceSchema,
  EvidenceStatusSchema,
  QAItemSchema,
  ReadinessFindingSchema,
  SafeIdSchema,
  SafeTextSchema,
  type Artifact,
  type EvidenceClaim,
  type EvidenceSource,
  type QAItem,
  type ReadinessFinding
} from "@uav-readiness/core";
import { parseCsvRows } from "./csv";
import {
  allocateDisambiguatedEvidenceId,
  type DisambiguationSourceFields
} from "./disambiguate";
import { toSafeIdPart } from "./text";

const TEST_LOG_ARTIFACT_ID = "artifact.test-log";

export type TestLogParseOptions = {
  requireSyntheticBanner?: boolean;
  synthetic?: boolean;
};

const TestLogRowSchema = z
  .object({
    check_id: SafeIdSchema,
    check_name: SafeTextSchema.max(160),
    check_type: z.enum(["documentation", "bench_documentation", "qa_review"]),
    result: z.enum(["pass", "warning", "blocked", "fail"]),
    evidence_status: EvidenceStatusSchema,
    evidence_id: z
      .string()
      .trim()
      .refine((value) => value === "" || SafeIdSchema.safeParse(value).success, {
        message: "Evidence id must be empty or a safe identifier"
      }),
    notes: SafeTextSchema.max(240)
  })
  .strict();

const expectedHeaders = [
  "check_id",
  "check_name",
  "check_type",
  "result",
  "evidence_status",
  "evidence_id",
  "notes"
];

type TestLogRow = z.infer<typeof TestLogRowSchema>;

export type ParsedTestLogCsv = {
  artifact: Artifact;
  evidenceSources: EvidenceSource[];
  evidenceClaims: EvidenceClaim[];
  qaItems: QAItem[];
  readinessFindings: ReadinessFinding[];
};

export function parseTestLogCsv(
  csvText: string,
  options?: TestLogParseOptions
): ParsedTestLogCsv {
  const synthetic = options?.synthetic ?? true;
  const rows = parseCsvRows(csvText, expectedHeaders, "Test log").map(
    (row, index) => {
      const parsed = TestLogRowSchema.safeParse(row);
      if (!parsed.success) {
        throw new Error(`Invalid test log row ${index + 1}: ${parsed.error.message}`);
      }

      return parsed.data;
    }
  );

  const artifact = ArtifactSchema.parse({
    id: TEST_LOG_ARTIFACT_ID,
    kind: "test_log",
    filename: "test_log.csv",
    description: "Synthetic QA test log fixture",
    synthetic
  });

  const reservedRawIds = new Set(
    rows.map((row) => row.evidence_id).filter((id) => id !== "")
  );
  const usedSourcesById = new Map<string, DisambiguationSourceFields>();
  const usedIds = new Set<string>();
  const evidenceSources: EvidenceSource[] = [];
  const evidenceClaims: EvidenceClaim[] = [];

  rows.forEach((row, index) => {
    let finalEvidenceId = "";
    if (row.evidence_id !== "") {
      const label = `Test log evidence for ${row.check_name}`;
      const excerpt = row.notes;
      const { finalId, deduplicated } = allocateDisambiguatedEvidenceId({
        rawId: row.evidence_id,
        rowNumber: index + 1,
        suffixTag: "test-log",
        candidateSource: {
          artifactId: TEST_LOG_ARTIFACT_ID,
          label,
          sourceType: "log",
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
            artifactId: TEST_LOG_ARTIFACT_ID,
            label,
            sourceType: "log",
            excerpt,
            confidence: row.evidence_status === "verified" ? "high" : "medium",
            synthetic
          })
        );
      }
    }

    evidenceClaims.push(buildEvidenceClaim(row, finalEvidenceId));
  });

  return {
    artifact,
    evidenceSources,
    evidenceClaims,
    qaItems: rows.map(buildQAItem),
    readinessFindings: rows.map(buildReadinessFinding)
  };
}

function buildEvidenceClaim(
  row: TestLogRow,
  finalEvidenceId: string
): EvidenceClaim {
  const evidenceSourceIds = finalEvidenceId ? [finalEvidenceId] : [];
  const status = evidenceSourceIds.length === 0 ? "locked" : row.evidence_status;

  return EvidenceClaimSchema.parse({
    id: `claim.test.${toSafeIdPart(row.check_id)}`,
    statement:
      status === "locked"
        ? `${row.check_name} requires supporting evidence`
        : `${row.check_name} has supporting test evidence`,
    claimType: "test_record",
    status,
    evidenceSourceIds,
    lockReason:
      status === "locked"
        ? row.notes || "Test log row has no supporting evidence id"
        : undefined
  });
}

function buildQAItem(row: TestLogRow): QAItem {
  return QAItemSchema.parse({
    id: `qa.${toSafeIdPart(row.check_id)}`,
    question: row.check_name,
    status: mapQAStatus(row.result),
    evidenceClaimIds: [`claim.test.${toSafeIdPart(row.check_id)}`],
    ownerRole: "QA reviewer"
  });
}

function buildReadinessFinding(row: TestLogRow): ReadinessFinding {
  return ReadinessFindingSchema.parse({
    id: `finding.test.${toSafeIdPart(row.check_id)}`,
    title: row.check_name,
    category: row.result === "pass" ? "artifact_completeness" : "qa_process",
    severity: row.result === "pass" ? "info" : "warning",
    status: mapQAStatus(row.result),
    evidenceClaimIds: [`claim.test.${toSafeIdPart(row.check_id)}`],
    lockIds: [],
    explanation: row.notes
  });
}

function mapQAStatus(result: TestLogRow["result"]): "pass" | "fail" | "blocked" | "not_tested" {
  if (result === "warning") {
    return "not_tested";
  }

  return result;
}

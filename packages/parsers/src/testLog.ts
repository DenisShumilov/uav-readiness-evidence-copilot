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
} from "../../core/src/schemas";
import { parseCsvRows } from "./csv";
import { toSafeIdPart } from "./text";

const TEST_LOG_ARTIFACT_ID = "artifact.test-log";

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

export function parseTestLogCsv(csvText: string): ParsedTestLogCsv {
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
    synthetic: true
  });

  return {
    artifact,
    evidenceSources: rows
      .filter((row) => row.evidence_id !== "")
      .map(buildEvidenceSource),
    evidenceClaims: rows.map(buildEvidenceClaim),
    qaItems: rows.map(buildQAItem),
    readinessFindings: rows.map(buildReadinessFinding)
  };
}

function buildEvidenceSource(row: TestLogRow): EvidenceSource {
  return EvidenceSourceSchema.parse({
    id: row.evidence_id,
    artifactId: TEST_LOG_ARTIFACT_ID,
    label: `Test log evidence for ${row.check_name}`,
    sourceType: "log",
    excerpt: row.notes,
    confidence: row.evidence_status === "verified" ? "high" : "medium",
    synthetic: true
  });
}

function buildEvidenceClaim(row: TestLogRow): EvidenceClaim {
  const evidenceSourceIds = row.evidence_id ? [row.evidence_id] : [];
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

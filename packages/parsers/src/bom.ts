import { z } from "zod";
import {
  ArtifactSchema,
  BOMItemSchema,
  EvidenceClaimSchema,
  EvidenceSourceSchema,
  EvidenceStatusSchema,
  SafeIdSchema,
  SafeTextSchema,
  type Artifact,
  type BOMItem,
  type EvidenceClaim,
  type EvidenceSource
} from "@uav-readiness/core";
import { parseCsvRows } from "./csv";

const BOM_ARTIFACT_ID = "artifact.bom";
const BOM_FILENAME = "BOM.csv";

const BOMCsvRowSchema = z
  .object({
    item_id: SafeIdSchema,
    item_name: SafeTextSchema.max(160),
    category: z.enum([
      "frame",
      "power",
      "compute",
      "sensor",
      "cable",
      "fastener",
      "documentation",
      "other"
    ]),
    quantity: z.coerce.number().int().positive(),
    record_status: EvidenceStatusSchema,
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
  "item_id",
  "item_name",
  "category",
  "quantity",
  "record_status",
  "evidence_id",
  "notes"
];

type BOMCsvRow = z.infer<typeof BOMCsvRowSchema>;

export type ParsedBOMCsv = {
  artifact: Artifact;
  bomItems: BOMItem[];
  evidenceSources: EvidenceSource[];
  evidenceClaims: EvidenceClaim[];
};

export function parseBOMCsv(csvText: string): ParsedBOMCsv {
  const rows = parseCsvRows(csvText, expectedHeaders, "BOM").map((row, index) => {
    const parsed = BOMCsvRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new Error(`Invalid BOM row ${index + 1}: ${parsed.error.message}`);
    }

    return parsed.data;
  });

  const artifact = ArtifactSchema.parse({
    id: BOM_ARTIFACT_ID,
    kind: "bom",
    filename: BOM_FILENAME,
    description: "Synthetic BOM fixture for documentation QA review",
    synthetic: true
  });

  const bomItems = rows.map((row) => buildBOMItem(row));
  const evidenceSources = rows
    .filter((row) => row.evidence_id !== "")
    .map((row) => buildEvidenceSource(row));
  const evidenceClaims = rows.map((row) => buildEvidenceClaim(row));

  return {
    artifact,
    bomItems,
    evidenceSources,
    evidenceClaims
  };
}

function buildBOMItem(row: BOMCsvRow): BOMItem {
  const evidenceSourceIds = row.evidence_id ? [row.evidence_id] : [];
  const status = evidenceSourceIds.length === 0 ? "locked" : row.record_status;

  return BOMItemSchema.parse({
    id: row.item_id,
    artifactId: BOM_ARTIFACT_ID,
    name: row.item_name,
    category: row.category,
    quantity: row.quantity,
    evidenceSourceIds,
    status
  });
}

function buildEvidenceSource(row: BOMCsvRow): EvidenceSource {
  return EvidenceSourceSchema.parse({
    id: row.evidence_id,
    artifactId: BOM_ARTIFACT_ID,
    label: `BOM row for ${row.item_name}`,
    sourceType: "table",
    excerpt: row.notes,
    confidence: row.record_status === "verified" ? "high" : "medium",
    synthetic: true
  });
}

function buildEvidenceClaim(row: BOMCsvRow): EvidenceClaim {
  const evidenceSourceIds = row.evidence_id ? [row.evidence_id] : [];
  const status = evidenceSourceIds.length === 0 ? "locked" : row.record_status;

  return EvidenceClaimSchema.parse({
    id: `claim.${row.item_id.toLowerCase()}`,
    statement:
      status === "locked"
        ? `${row.item_name} requires supporting evidence`
        : `${row.item_name} appears in the synthetic BOM`,
    claimType: "component_record",
    status,
    evidenceSourceIds,
    lockReason:
      status === "locked"
        ? row.notes || "No supporting evidence id is present"
        : undefined
  });
}

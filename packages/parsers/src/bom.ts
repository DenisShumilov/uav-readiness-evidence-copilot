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
import {
  allocateDisambiguatedEvidenceId,
  type DisambiguationSourceFields
} from "./disambiguate";

const BOM_ARTIFACT_ID = "artifact.bom";
const BOM_FILENAME = "BOM.csv";

export type BOMParseOptions = {
  requireSyntheticBanner?: boolean;
  synthetic?: boolean;
};

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
    revision: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || /^[a-z0-9-]+\s*=\s*[a-z0-9.-]+$/i.test(value),
        {
          message: "Revision must be empty or use subject=value"
        }
      ),
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
  "revision",
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

export function parseBOMCsv(
  csvText: string,
  options?: BOMParseOptions
): ParsedBOMCsv {
  const synthetic = options?.synthetic ?? true;
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
    description: synthetic
      ? "Synthetic BOM fixture for documentation QA review"
      : "User-provided BOM artifact for documentation QA review",
    synthetic
  });

  const reservedRawIds = new Set(
    rows.map((row) => row.evidence_id).filter((id) => id !== "")
  );
  const usedSourcesById = new Map<string, DisambiguationSourceFields>();
  const usedIds = new Set<string>();
  const evidenceSources: EvidenceSource[] = [];
  const bomItems: BOMItem[] = [];
  const evidenceClaims: EvidenceClaim[] = [];

  rows.forEach((row, index) => {
    let finalEvidenceId = "";
    if (row.evidence_id !== "") {
      const excerpt = row.revision
        ? `Revision: ${row.revision}\n${row.notes}`
        : row.notes;
      const label = `BOM row for ${row.item_name}`;
      const { finalId, deduplicated } = allocateDisambiguatedEvidenceId({
        rawId: row.evidence_id,
        rowNumber: index + 1,
        suffixTag: "bom",
        candidateSource: {
          artifactId: BOM_ARTIFACT_ID,
          label,
          sourceType: "table",
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
            artifactId: BOM_ARTIFACT_ID,
            label,
            sourceType: "table",
            excerpt,
            confidence: row.record_status === "verified" ? "high" : "medium",
            synthetic
          })
        );
      }
    }

    bomItems.push(buildBOMItem(row, finalEvidenceId));
    evidenceClaims.push(buildEvidenceClaim(row, finalEvidenceId));
  });

  return {
    artifact,
    bomItems,
    evidenceSources,
    evidenceClaims
  };
}

function buildBOMItem(row: BOMCsvRow, finalEvidenceId: string): BOMItem {
  const evidenceSourceIds = finalEvidenceId ? [finalEvidenceId] : [];
  const status = evidenceSourceIds.length === 0 ? "locked" : row.record_status;

  return BOMItemSchema.parse({
    id: row.item_id,
    artifactId: BOM_ARTIFACT_ID,
    name: row.item_name,
    category: row.category,
    quantity: row.quantity,
    version: row.revision || undefined,
    evidenceSourceIds,
    status
  });
}

function buildEvidenceClaim(
  row: BOMCsvRow,
  finalEvidenceId: string
): EvidenceClaim {
  const evidenceSourceIds = finalEvidenceId ? [finalEvidenceId] : [];
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

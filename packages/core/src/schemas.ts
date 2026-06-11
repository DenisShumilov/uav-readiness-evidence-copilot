import { z } from "zod";

const forbiddenOperationalTerms = [
  "route",
  "waypoint",
  "mission",
  "target",
  "targeting",
  "telemetry",
  "payload",
  "payloadselect",
  "strike",
  "attack",
  "evade",
  "evasion",
  "countermeasure",
  "coordinate",
  "coordinates",
  "gps",
  "mavlink",
  "px4",
  "ardupilot"
] as const;

const forbiddenOperationalPattern = new RegExp(
  `\\b(${forbiddenOperationalTerms.join("|")})\\b`,
  "i"
);

export const EvidenceStatusSchema = z.enum([
  "verified",
  "partial",
  "locked",
  "conflict"
]);

export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

export const FindingSeveritySchema = z.enum([
  "info",
  "warning",
  "critical"
]);

export const QAStatusSchema = z.enum([
  "pass",
  "fail",
  "blocked",
  "not_tested"
]);

export const SafeTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine((value) => !forbiddenOperationalPattern.test(value), {
    message: "Text contains blocked operational UAV terminology"
  });

export const SafeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9_.:-]*$/i)
  .refine((value) => !forbiddenOperationalPattern.test(value), {
    message: "Identifier contains blocked operational UAV terminology"
  });

export const ArtifactSchema = z
  .object({
    id: SafeIdSchema,
    kind: z.enum([
      "bom",
      "manual",
      "wiring_notes",
      "config_dump",
      "test_log",
      "qa_notes",
      "generated_report",
      "generated_matrix",
      "generated_deck"
    ]),
    filename: SafeTextSchema.max(240),
    description: SafeTextSchema.optional(),
    synthetic: z.literal(true),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 file hash")
      .optional(),
    createdAt: z.string().datetime({ offset: true }).optional()
  })
  .strict();

export const BOMItemSchema = z
  .object({
    id: SafeIdSchema,
    artifactId: SafeIdSchema,
    name: SafeTextSchema.max(160),
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
    quantity: z.number().int().positive(),
    version: SafeTextSchema.max(80).optional(),
    evidenceSourceIds: z.array(SafeIdSchema).default([]),
    status: EvidenceStatusSchema
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "verified" && value.evidenceSourceIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["evidenceSourceIds"],
        message: "Verified BOM items require at least one evidence source"
      });
    }
  });

export const EvidenceSourceSchema = z
  .object({
    id: SafeIdSchema,
    artifactId: SafeIdSchema,
    label: SafeTextSchema.max(160),
    sourceType: z.enum([
      "document",
      "table",
      "note",
      "log",
      "checklist",
      "generated"
    ]),
    excerpt: SafeTextSchema.optional(),
    confidence: z.enum(["low", "medium", "high"]),
    synthetic: z.literal(true)
  })
  .strict();

export const EvidenceClaimSchema = z
  .object({
    id: SafeIdSchema,
    statement: SafeTextSchema,
    claimType: z.enum([
      "artifact_presence",
      "component_record",
      "wiring_documentation",
      "config_documentation",
      "test_record",
      "qa_note",
      "training_record",
      "maintenance_record",
      "safety_boundary"
    ]),
    status: EvidenceStatusSchema,
    evidenceSourceIds: z.array(SafeIdSchema).default([]),
    lockReason: SafeTextSchema.optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "verified" && value.evidenceSourceIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["evidenceSourceIds"],
        message: "Verified claims require at least one evidence source"
      });
    }

    if (value.status === "locked" && !value.lockReason) {
      ctx.addIssue({
        code: "custom",
        path: ["lockReason"],
        message: "Locked claims require a lock reason"
      });
    }
  });

export const EvidenceGraphSchema = z
  .object({
    id: SafeIdSchema,
    artifactIds: z.array(SafeIdSchema),
    evidenceSourceIds: z.array(SafeIdSchema),
    evidenceClaimIds: z.array(SafeIdSchema),
    links: z.array(
      z
        .object({
          claimId: SafeIdSchema,
          evidenceSourceId: SafeIdSchema,
          relation: z.enum(["supports", "partially_supports", "conflicts"])
        })
        .strict()
    ),
    generatedAt: z.string().datetime({ offset: true }),
    synthetic: z.literal(true)
  })
  .strict()
  .superRefine((value, ctx) => {
    const claimIds = new Set(value.evidenceClaimIds);
    const sourceIds = new Set(value.evidenceSourceIds);

    value.links.forEach((link, index) => {
      if (!claimIds.has(link.claimId)) {
        ctx.addIssue({
          code: "custom",
          path: ["links", index, "claimId"],
          message: "Graph link references an unknown claim"
        });
      }

      if (!sourceIds.has(link.evidenceSourceId)) {
        ctx.addIssue({
          code: "custom",
          path: ["links", index, "evidenceSourceId"],
          message: "Graph link references an unknown evidence source"
        });
      }
    });
  });

export const EvidenceLockSchema = z
  .object({
    id: SafeIdSchema,
    claimId: SafeIdSchema,
    reason: SafeTextSchema,
    missingEvidence: z.array(SafeTextSchema.max(160)).default([]),
    severity: FindingSeveritySchema,
    status: z.literal("locked")
  })
  .strict();

export const ReadinessFindingSchema = z
  .object({
    id: SafeIdSchema,
    title: SafeTextSchema.max(160),
    category: z.enum([
      "artifact_completeness",
      "evidence_quality",
      "traceability",
      "safety_boundary",
      "qa_process"
    ]),
    severity: FindingSeveritySchema,
    status: QAStatusSchema,
    evidenceClaimIds: z.array(SafeIdSchema).default([]),
    lockIds: z.array(SafeIdSchema).default([]),
    explanation: SafeTextSchema
  })
  .strict();

export const QAItemSchema = z
  .object({
    id: SafeIdSchema,
    question: SafeTextSchema.max(240),
    status: QAStatusSchema,
    evidenceClaimIds: z.array(SafeIdSchema).default([]),
    ownerRole: SafeTextSchema.max(80).optional()
  })
  .strict();

export const DemoBundleSchema = z
  .object({
    artifacts: z.array(ArtifactSchema),
    bomItems: z.array(BOMItemSchema),
    evidenceSources: z.array(EvidenceSourceSchema),
    evidenceClaims: z.array(EvidenceClaimSchema),
    evidenceLocks: z.array(EvidenceLockSchema),
    qaItems: z.array(QAItemSchema),
    readinessFindings: z.array(ReadinessFindingSchema)
  })
  .strict()
  .superRefine((value, ctx) => {
    addUniqueIdIssues("artifacts", value.artifacts, ctx);
    addUniqueIdIssues("bomItems", value.bomItems, ctx);
    addUniqueIdIssues("evidenceSources", value.evidenceSources, ctx);
    addUniqueIdIssues("evidenceClaims", value.evidenceClaims, ctx);
    addUniqueIdIssues("evidenceLocks", value.evidenceLocks, ctx);
    addUniqueIdIssues("qaItems", value.qaItems, ctx);
    addUniqueIdIssues("readinessFindings", value.readinessFindings, ctx);
  });

function addUniqueIdIssues(
  path: string,
  items: Array<{ id: string }>,
  ctx: z.RefinementCtx
) {
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      ctx.addIssue({
        code: "custom",
        path: [path, index, "id"],
        message: `Duplicate id: ${item.id}`
      });
    }

    seen.add(item.id);
  });
}

export type Artifact = z.infer<typeof ArtifactSchema>;
export type BOMItem = z.infer<typeof BOMItemSchema>;
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;
export type EvidenceClaim = z.infer<typeof EvidenceClaimSchema>;
export type EvidenceGraph = z.infer<typeof EvidenceGraphSchema>;
export type EvidenceLock = z.infer<typeof EvidenceLockSchema>;
export type ReadinessFinding = z.infer<typeof ReadinessFindingSchema>;
export type QAItem = z.infer<typeof QAItemSchema>;
export type DemoBundle = z.infer<typeof DemoBundleSchema>;

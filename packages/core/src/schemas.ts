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
    synthetic: z.boolean(),
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
    excerpt: SafeTextSchema,
    confidence: z.enum(["low", "medium", "high"]),
    synthetic: z.boolean()
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

export const EvidenceGraphNodeSchema = z
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
    synthetic: z.boolean()
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

export const BuiltEvidenceGraphSchema = z
  .object({
    evidenceGraph: EvidenceGraphNodeSchema,
    evidenceSources: z.array(EvidenceSourceSchema),
    evidenceClaims: z.array(EvidenceClaimSchema),
    evidenceLocks: z.array(EvidenceLockSchema),
    summary: z
      .object({
        totalClaims: z.number().int().min(0),
        totalSources: z.number().int().min(0),
        totalLocks: z.number().int().min(0),
        verifiedCount: z.number().int().min(0),
        partialCount: z.number().int().min(0),
        lockedCount: z.number().int().min(0),
        conflictCount: z.number().int().min(0)
      })
      .strict()
  })
  .strict();

export const EvidenceGraphSchema = z.custom<
  z.infer<typeof EvidenceGraphNodeSchema>
>().transform((val, ctx) => {
  if (typeof val === "object" && val !== null && "evidenceGraph" in val) {
    const parsed = BuiltEvidenceGraphSchema.safeParse(val);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message
        });
      }
      return z.NEVER;
    }
    return parsed.data as unknown as z.infer<typeof EvidenceGraphNodeSchema>;
  }
  const parsed = EvidenceGraphNodeSchema.safeParse(val);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: "custom",
        path: issue.path,
        message: issue.message
      });
    }
    return z.NEVER;
  }
  return parsed.data;
});

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

    const artifactIds = new Set(value.artifacts.map((a) => a.id));
    const sourceIds = new Set(value.evidenceSources.map((s) => s.id));
    const claimIds = new Set(value.evidenceClaims.map((c) => c.id));
    const lockIds = new Set(value.evidenceLocks.map((l) => l.id));

    value.evidenceSources.forEach((source, index) => {
      if (!artifactIds.has(source.artifactId)) {
        ctx.addIssue({
          code: "custom",
          path: ["evidenceSources", index, "artifactId"],
          message: `Evidence source ${source.id} references unknown artifactId: ${source.artifactId}`
        });
      }
    });

    value.bomItems.forEach((item, index) => {
      if (!artifactIds.has(item.artifactId)) {
        ctx.addIssue({
          code: "custom",
          path: ["bomItems", index, "artifactId"],
          message: `BOM item ${item.id} references unknown artifactId: ${item.artifactId}`
        });
      }
      item.evidenceSourceIds.forEach((sourceId, sourceIdx) => {
        if (!sourceIds.has(sourceId)) {
          ctx.addIssue({
            code: "custom",
            path: ["bomItems", index, "evidenceSourceIds", sourceIdx],
            message: `BOM item ${item.id} references unknown evidenceSourceId: ${sourceId}`
          });
        }
      });
    });

    value.evidenceLocks.forEach((lock, index) => {
      if (!claimIds.has(lock.claimId)) {
        ctx.addIssue({
          code: "custom",
          path: ["evidenceLocks", index, "claimId"],
          message: `Evidence lock ${lock.id} references unknown claimId: ${lock.claimId}`
        });
      }
    });

    value.qaItems.forEach((qaItem, index) => {
      qaItem.evidenceClaimIds.forEach((claimId, claimIdx) => {
        if (!claimIds.has(claimId)) {
          ctx.addIssue({
            code: "custom",
            path: ["qaItems", index, "evidenceClaimIds", claimIdx],
            message: `QA item ${qaItem.id} references unknown evidenceClaimId: ${claimId}`
          });
        }
      });
    });

    value.readinessFindings.forEach((finding, index) => {
      finding.evidenceClaimIds.forEach((claimId, claimIdx) => {
        if (!claimIds.has(claimId)) {
          ctx.addIssue({
            code: "custom",
            path: ["readinessFindings", index, "evidenceClaimIds", claimIdx],
            message: `Readiness finding ${finding.id} references unknown evidenceClaimId: ${claimId}`
          });
        }
      });
      finding.lockIds.forEach((lockId, lockIdx) => {
        if (!lockIds.has(lockId)) {
          ctx.addIssue({
            code: "custom",
            path: ["readinessFindings", index, "lockIds", lockIdx],
            message: `Readiness finding ${finding.id} references unknown lockId: ${lockId}`
          });
        }
      });
    });
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

export const ReadinessDeductionSchema = z
  .object({
    reason: z.string(),
    count: z.number().int().min(0),
    pointsEach: z.number().int().min(0),
    total: z.number().int().min(0)
  })
  .strict();

export const LockedCriticalItemSchema = z
  .object({
    id: z.string().min(1),
    reason: z.string().min(1)
  })
  .strict();

export const EngineAdjustmentSchema = z
  .object({
    claimId: z.string().min(1),
    assertedStatus: EvidenceStatusSchema,
    derivedStatus: EvidenceStatusSchema,
    reason: z.string().min(1)
  })
  .strict();

export const ReadinessAssessmentSchema = z
  .object({
    readinessScore: z.number().int().min(0).max(100),
    formula: z
      .object({
        base: z.literal(100),
        deductions: z.array(ReadinessDeductionSchema)
      })
      .strict(),
    findings: z.array(ReadinessFindingSchema),
    warnings: z.array(z.string()),
    lockedCriticalItems: z.array(LockedCriticalItemSchema),
    engineAdjustments: z.array(EngineAdjustmentSchema),
    summary: z
      .object({
        verifiedCount: z.number().int().min(0),
        partialCount: z.number().int().min(0),
        lockedCount: z.number().int().min(0),
        conflictCount: z.number().int().min(0),
        engineAdjustedCount: z.number().int().min(0),
        missingArtifacts: z.array(z.string()),
        explanation: z.string().min(1)
      })
      .strict()
  })
  .strict();

export type Artifact = z.infer<typeof ArtifactSchema>;
export type BOMItem = z.infer<typeof BOMItemSchema>;
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;
export type EvidenceClaim = z.infer<typeof EvidenceClaimSchema>;
export type EvidenceGraph = z.infer<typeof EvidenceGraphNodeSchema>;
export type EvidenceLock = z.infer<typeof EvidenceLockSchema>;
export type ReadinessFinding = z.infer<typeof ReadinessFindingSchema>;
export type QAItem = z.infer<typeof QAItemSchema>;
export type DemoBundle = z.infer<typeof DemoBundleSchema>;
export type ReadinessAssessment = z.infer<typeof ReadinessAssessmentSchema>;

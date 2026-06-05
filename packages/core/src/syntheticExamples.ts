import type { ExportBundle } from "./schemas";

const createdAt = "2026-06-05T09:00:00.000Z";

export const syntheticExportBundle = {
  id: "bundle.demo-readiness-001",
  generatedAt: createdAt,
  artifacts: [
    {
      id: "artifact.bom",
      kind: "bom",
      filename: "BOM.csv",
      description: "Synthetic list of demo engineering parts",
      synthetic: true,
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      createdAt
    },
    {
      id: "artifact.qa-notes",
      kind: "qa_notes",
      filename: "qa_notes.md",
      description: "Synthetic QA notes for documentation review",
      synthetic: true,
      sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      createdAt
    },
    {
      id: "artifact.wiring-notes",
      kind: "wiring_notes",
      filename: "wiring_notes.yaml",
      description: "Synthetic documentation notes for connector review",
      synthetic: true,
      sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      createdAt
    }
  ],
  bomItems: [
    {
      id: "bom.frame-plate",
      artifactId: "artifact.bom",
      name: "Demo frame plate",
      category: "frame",
      quantity: 1,
      version: "training-v1",
      evidenceSourceIds: ["source.bom-row-1"],
      status: "verified"
    },
    {
      id: "bom.compute-board",
      artifactId: "artifact.bom",
      name: "Training compute board",
      category: "compute",
      quantity: 1,
      version: "training-v1",
      evidenceSourceIds: [],
      status: "locked"
    }
  ],
  evidenceSources: [
    {
      id: "source.bom-row-1",
      artifactId: "artifact.bom",
      label: "BOM row for frame plate",
      sourceType: "table",
      excerpt: "Frame plate listed with quantity one",
      confidence: "high",
      synthetic: true
    },
    {
      id: "source.qa-note-1",
      artifactId: "artifact.qa-notes",
      label: "QA note about missing board evidence",
      sourceType: "note",
      excerpt: "Compute board record needs a supporting source",
      confidence: "medium",
      synthetic: true
    },
    {
      id: "source.wiring-note-1",
      artifactId: "artifact.wiring-notes",
      label: "Connector documentation note",
      sourceType: "document",
      excerpt: "Training connector A is documented as a non-operational example",
      confidence: "medium",
      synthetic: true
    }
  ],
  evidenceClaims: [
    {
      id: "claim.bom-present",
      statement: "Synthetic BOM file is present",
      claimType: "artifact_presence",
      status: "verified",
      evidenceSourceIds: ["source.bom-row-1"]
    },
    {
      id: "claim.compute-board-record",
      statement: "Compute board record needs more supporting evidence",
      claimType: "component_record",
      status: "locked",
      evidenceSourceIds: [],
      lockReason: "Supporting source is missing for this training component"
    },
    {
      id: "claim.connector-doc",
      statement: "Connector documentation is supported by a synthetic note",
      claimType: "wiring_documentation",
      status: "partial",
      evidenceSourceIds: ["source.wiring-note-1"]
    }
  ],
  evidenceGraph: {
    id: "graph.demo-readiness",
    artifactIds: ["artifact.bom", "artifact.qa-notes", "artifact.wiring-notes"],
    evidenceSourceIds: [
      "source.bom-row-1",
      "source.qa-note-1",
      "source.wiring-note-1"
    ],
    evidenceClaimIds: [
      "claim.bom-present",
      "claim.compute-board-record",
      "claim.connector-doc"
    ],
    links: [
      {
        claimId: "claim.bom-present",
        evidenceSourceId: "source.bom-row-1",
        relation: "supports"
      },
      {
        claimId: "claim.connector-doc",
        evidenceSourceId: "source.wiring-note-1",
        relation: "partially_supports"
      }
    ],
    generatedAt: createdAt,
    synthetic: true
  },
  evidenceLocks: [
    {
      id: "lock.compute-board-record",
      claimId: "claim.compute-board-record",
      reason: "Component record does not yet have a supporting source",
      missingEvidence: ["Supporting source for compute board record"],
      severity: "warning",
      status: "locked"
    }
  ],
  wiringManifest: {
    id: "wiring.demo-doc-only",
    artifactId: "artifact.wiring-notes",
    scope: "documentation_only",
    documentationOnly: true,
    connections: [
      {
        id: "connection.training-a",
        fromLabel: "Training connector A",
        toLabel: "Training board input",
        description: "Non-operational connector documentation example",
        status: "partial",
        evidenceSourceId: "source.wiring-note-1"
      },
      {
        id: "connection.training-b",
        fromLabel: "Training connector B",
        toLabel: "Training board review point",
        description: "Documentation example waiting for supporting source",
        status: "locked"
      }
    ]
  },
  readinessFindings: [
    {
      id: "finding.bom-present",
      title: "BOM artifact is present",
      category: "artifact_completeness",
      severity: "info",
      status: "pass",
      evidenceClaimIds: ["claim.bom-present"],
      lockIds: [],
      explanation: "The synthetic BOM artifact has a supporting evidence source"
    },
    {
      id: "finding.compute-board-locked",
      title: "Compute board record is locked",
      category: "evidence_quality",
      severity: "warning",
      status: "blocked",
      evidenceClaimIds: ["claim.compute-board-record"],
      lockIds: ["lock.compute-board-record"],
      explanation: "The component record stays locked until evidence is added"
    }
  ],
  qaItems: [
    {
      id: "qa.bom-present",
      question: "Does the package include a synthetic BOM artifact?",
      status: "pass",
      evidenceClaimIds: ["claim.bom-present"],
      ownerRole: "QA reviewer"
    },
    {
      id: "qa.lock-check",
      question: "Do unsupported claims stay locked?",
      status: "pass",
      evidenceClaimIds: ["claim.compute-board-record"],
      ownerRole: "Evidence reviewer"
    }
  ],
  traceabilityRows: [
    {
      requirementId: "req.artifact-bom",
      requirement: "Demo package should include a synthetic BOM artifact",
      evidenceClaimId: "claim.bom-present",
      evidenceSourceIds: ["source.bom-row-1"],
      qaItemId: "qa.bom-present",
      status: "verified"
    },
    {
      requirementId: "req.no-fake-evidence",
      requirement: "Unsupported component records should remain locked",
      evidenceClaimId: "claim.compute-board-record",
      evidenceSourceIds: [],
      qaItemId: "qa.lock-check",
      status: "locked"
    }
  ],
  readinessReport: {
    id: "report.demo-readiness",
    title: "Synthetic Documentation Readiness Report",
    generatedAt: createdAt,
    synthetic: true,
    score: {
      value: 62,
      interpretation: "documentation_readiness_only"
    },
    findingIds: ["finding.bom-present", "finding.compute-board-locked"],
    summary: "Synthetic package has a present BOM and one locked component record",
    limitations: [
      "This score only describes documentation readiness",
      "Synthetic data is not valid for real operation"
    ]
  },
  safety: {
    documentationOnly: true,
    syntheticOnly: true,
    noOperationalUse: true
  }
} satisfies ExportBundle;

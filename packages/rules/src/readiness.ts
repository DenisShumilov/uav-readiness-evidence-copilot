import type { DemoBundle, ReadinessFinding } from "../../core/src/schemas";
import {
  buildEvidenceGraphFromBundle,
  type BuiltEvidenceGraph
} from "../../evidence/src/evidenceGraph";

const expectedArtifactKinds = ["bom", "manual", "test_log", "qa_notes"] as const;

export type ReadinessDeduction = {
  reason: string;
  count: number;
  pointsEach: number;
  total: number;
};

export type LockedCriticalItem = {
  id: string;
  reason: string;
};

export type ReadinessAssessment = {
  readinessScore: number;
  formula: {
    base: number;
    deductions: ReadinessDeduction[];
  };
  findings: ReadinessFinding[];
  warnings: string[];
  lockedCriticalItems: LockedCriticalItem[];
  summary: {
    verifiedCount: number;
    partialCount: number;
    lockedCount: number;
    conflictCount: number;
    missingArtifacts: string[];
    explanation: string;
  };
};

export function evaluateReadiness(
  input: DemoBundle | BuiltEvidenceGraph
): ReadinessAssessment {
  const graph = isBuiltEvidenceGraph(input)
    ? input
    : buildEvidenceGraphFromBundle(input);
  const missingArtifacts = isBuiltEvidenceGraph(input)
    ? []
    : findMissingArtifacts(input);
  const warnings = buildWarnings(graph, input);
  const lockedCriticalItems = buildLockedCriticalItems(graph);
  const deductions = buildDeductions(
    graph.summary.partialCount,
    lockedCriticalItems.length,
    warnings.length,
    missingArtifacts.length
  );
  const score = Math.max(
    0,
    100 - deductions.reduce((total, deduction) => total + deduction.total, 0)
  );

  return {
    readinessScore: score,
    formula: {
      base: 100,
      deductions
    },
    findings: isBuiltEvidenceGraph(input) ? [] : input.readinessFindings,
    warnings,
    lockedCriticalItems,
    summary: {
      verifiedCount: graph.summary.verifiedCount,
      partialCount: graph.summary.partialCount,
      lockedCount: graph.summary.lockedCount,
      conflictCount: graph.summary.conflictCount,
      missingArtifacts,
      explanation:
        "Score is documentation readiness only: 100 minus locked, partial, warning, and missing artifact deductions."
    }
  };
}

function isBuiltEvidenceGraph(
  input: DemoBundle | BuiltEvidenceGraph
): input is BuiltEvidenceGraph {
  return "summary" in input && "evidenceGraph" in input;
}

function findMissingArtifacts(bundle: DemoBundle): string[] {
  const presentKinds = new Set(bundle.artifacts.map((artifact) => artifact.kind));
  return expectedArtifactKinds.filter((kind) => !presentKinds.has(kind));
}

function buildWarnings(
  graph: BuiltEvidenceGraph,
  input: DemoBundle | BuiltEvidenceGraph
): string[] {
  const warningFindings = isBuiltEvidenceGraph(input)
    ? []
    : input.readinessFindings
        .filter(
          (finding) =>
            finding.severity === "warning" ||
            finding.status === "blocked" ||
            finding.status === "not_tested"
        )
        .map((finding) => `${finding.id}: ${finding.title}`);
  const partialWarnings = graph.evidenceClaims
    .filter((claim) => claim.status === "partial")
    .map((claim) => `${claim.id}: partial evidence`);

  return [...warningFindings, ...partialWarnings];
}

function buildLockedCriticalItems(
  graph: BuiltEvidenceGraph
): LockedCriticalItem[] {
  return graph.evidenceClaims
    .filter((claim) => claim.status === "locked")
    .map((claim) => ({
      id: claim.id,
      reason: claim.lockReason ?? "Evidence is missing"
    }));
}

function buildDeductions(
  partialCount: number,
  lockedCriticalCount: number,
  warningCount: number,
  missingArtifactCount: number
): ReadinessDeduction[] {
  return [
    makeDeduction("locked critical evidence", lockedCriticalCount, 6),
    makeDeduction("partial evidence", partialCount, 3),
    makeDeduction("warnings", warningCount, 2),
    makeDeduction("missing safe artifacts", missingArtifactCount, 10)
  ].filter((deduction) => deduction.count > 0);
}

function makeDeduction(
  reason: string,
  count: number,
  pointsEach: number
): ReadinessDeduction {
  return {
    reason,
    count,
    pointsEach,
    total: count * pointsEach
  };
}

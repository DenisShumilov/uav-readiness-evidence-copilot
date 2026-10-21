import type { DemoBundle } from "@uav-readiness/core";
import type { BuiltEvidenceGraph } from "@uav-readiness/evidence";
import type { ReadinessAssessment } from "@uav-readiness/rules";

/**
 * Emits the readiness review as SARIF 2.1.0 (Static Analysis Results Interchange Format),
 * the standard format GitHub can ingest as code-scanning alerts. Locked and conflicting
 * claims become errors; partial evidence and process warnings become warnings.
 *
 * This is a documentation-QA report only. It contains no operational content.
 */

type SarifLevel = "error" | "warning" | "note";

const EXAMPLE_DIR = "examples/demo-uav-readiness/";

const RULES = [
  {
    id: "DOC-LOCK-001",
    name: "Claim locked: supporting evidence is missing",
    shortDescription: "A documentation claim has no supporting evidence and stays locked."
  },
  {
    id: "EVID-CONFLICT-001",
    name: "Conflicting documentation evidence",
    shortDescription: "Two sources disagree, so the claim cannot be verified."
  },
  {
    id: "EVID-PARTIAL-001",
    name: "Partial evidence",
    shortDescription: "A claim has some evidence, but not enough to be verified."
  },
  {
    id: "DOC-WARN-001",
    name: "Documentation process warning",
    shortDescription: "A review or traceability warning that lowers documentation readiness."
  }
] as const;

type SarifResult = {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: Array<{
    physicalLocation: { artifactLocation: { uri: string } };
  }>;
};

export function generateReadinessSarif(
  bundle: DemoBundle,
  graph: BuiltEvidenceGraph,
  assessment: ReadinessAssessment,
  exampleDir: string = EXAMPLE_DIR
): string {
  const filenameByArtifactId = new Map(
    bundle.artifacts.map((artifact) => [artifact.id, artifact.filename])
  );
  const filenameByKind = new Map(
    bundle.artifacts.map((artifact) => [artifact.kind, artifact.filename])
  );
  const artifactIdBySourceId = new Map(
    bundle.evidenceSources.map((source) => [source.id, source.artifactId])
  );
  const bomClaimIds = new Set(
    bundle.bomItems.map((item) => `claim.${item.id.toLowerCase()}`)
  );
  const adjustmentsByClaimId = new Map(
    assessment.engineAdjustments.map((adj) => [adj.claimId, adj])
  );
  const locksByClaimId = new Map(
    assessment.lockedCriticalItems.map((item) => [item.id, item.reason])
  );

  const qaNotesArtifact = bundle.artifacts.find(
    (artifact) => artifact.kind === "qa_notes"
  );
  const qaNotesUri = encodeSarifUri(
    qaNotesArtifact
      ? `${exampleDir}${qaNotesArtifact.filename}`
      : `${exampleDir}qa_notes.md`
  );

  function uriForClaim(claim: {
    id: string;
    claimType?: string;
    evidenceSourceIds: string[];
  }): string {
    for (const sourceId of claim.evidenceSourceIds) {
      const artifactId = artifactIdBySourceId.get(sourceId);
      const filename = artifactId
        ? filenameByArtifactId.get(artifactId)
        : undefined;
      if (filename) {
        return encodeSarifUri(`${exampleDir}${filename}`);
      }
    }
    return uriFromClaim(claim, exampleDir, filenameByKind, bomClaimIds);
  }

  const claimResults: SarifResult[] = graph.evidenceClaims.flatMap((claim) => {
    const uri = uriForClaim(claim);
    const adj = adjustmentsByClaimId.get(claim.id);
    const effectiveStatus =
      adj?.derivedStatus ??
      (locksByClaimId.has(claim.id) ? "locked" : claim.status);
    const effectiveReason =
      claim.lockReason ??
      locksByClaimId.get(claim.id) ??
      adj?.reason ??
      "evidence is missing";

    if (effectiveStatus === "locked") {
      return [
        makeResult(
          "DOC-LOCK-001",
          "error",
          `${claim.statement} — ${effectiveReason} (claim ${claim.id})`,
          uri
        )
      ];
    }
    if (effectiveStatus === "conflict") {
      return [
        makeResult(
          "EVID-CONFLICT-001",
          "error",
          `${claim.statement} — sources conflict (claim ${claim.id})`,
          uri
        )
      ];
    }
    if (effectiveStatus === "partial") {
      return [
        makeResult(
          "EVID-PARTIAL-001",
          "warning",
          `${claim.statement} — partial evidence (claim ${claim.id})`,
          uri
        )
      ];
    }
    return [];
  });

  const claimsById = new Map(
    graph.evidenceClaims.map((claim) => [claim.id, claim])
  );

  function uriForWarning(warning: string): string {
    const prefix = warning.split(":")[0]?.trim() ?? "";
    if (prefix.startsWith("finding.test.")) {
      const testFilename = filenameByKind.get("test_log");
      return encodeSarifUri(
        testFilename ? `${exampleDir}${testFilename}` : `${exampleDir}test_log.csv`
      );
    }
    if (prefix.startsWith("finding.missing.")) {
      return encodeSarifUri(exampleDir);
    }
    if (claimsById.has(prefix)) {
      return uriForClaim(claimsById.get(prefix)!);
    }
    if (artifactIdBySourceId.has(prefix)) {
      const artifactId = artifactIdBySourceId.get(prefix)!;
      const filename = filenameByArtifactId.get(artifactId);
      if (filename) {
        return encodeSarifUri(`${exampleDir}${filename}`);
      }
    }
    return qaNotesUri;
  }

  // Process/traceability warnings that are not already covered by partial-claim results.
  const processResults: SarifResult[] = assessment.warnings
    .filter((warning) => !/: partial evidence$/.test(warning))
    .map((warning) =>
      makeResult("DOC-WARN-001", "warning", warning, uriForWarning(warning))
    );

  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "uav-readiness-evidence-copilot",
            informationUri:
              "https://github.com/DenisShumilov/uav-readiness-evidence-copilot",
            version: "0.8.1",
            rules: RULES.map((rule) => ({
              id: rule.id,
              name: rule.name,
              shortDescription: { text: rule.shortDescription }
            }))
          }
        },
        properties: {
          readinessScore: assessment.readinessScore,
          synthetic: true,
          note: "Documentation QA only. No operational UAV capability."
        },
        results: [...claimResults, ...processResults]
      }
    ]
  };

  return JSON.stringify(sarif, null, 2);
}

function makeResult(
  ruleId: string,
  level: SarifLevel,
  text: string,
  uri: string
): SarifResult {
  return {
    ruleId,
    level,
    message: { text },
    locations: [{ physicalLocation: { artifactLocation: { uri } } }]
  };
}

function uriFromClaim(
  claim: { id: string; claimType?: string },
  exampleDir: string,
  filenameByKind: Map<string, string>,
  bomClaimIds: Set<string>
): string {
  const { id, claimType } = claim;
  if (id.startsWith("claim.missing.")) {
    return encodeSarifUri(exampleDir);
  }
  if (id.startsWith("claim.test") || claimType === "test_record") {
    const file = filenameByKind.get("test_log") ?? "test_log.csv";
    return encodeSarifUri(`${exampleDir}${file}`);
  }
  if (id.startsWith("claim.manual")) {
    const file = filenameByKind.get("manual") ?? "demo_manual.md";
    return encodeSarifUri(`${exampleDir}${file}`);
  }
  if (id.startsWith("claim.qa") || claimType === "qa_note") {
    const file = filenameByKind.get("qa_notes") ?? "qa_notes.md";
    return encodeSarifUri(`${exampleDir}${file}`);
  }
  if (
    bomClaimIds.has(id) ||
    claimType === "component_record" ||
    id.startsWith("claim.comp") ||
    id.startsWith("claim.doc")
  ) {
    const file = filenameByKind.get("bom") ?? "BOM.csv";
    return encodeSarifUri(`${exampleDir}${file}`);
  }
  return encodeSarifUri(exampleDir);
}

function encodeSarifUri(rawPath: string): string {
  const normalized = rawPath.replaceAll("\\", "/");
  return normalized
    .split("/")
    .map((segment) => {
      if (segment === "" || segment === "." || segment === "..") {
        return segment;
      }
      return encodeURIComponent(segment);
    })
    .join("/");
}

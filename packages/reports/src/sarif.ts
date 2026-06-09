import type { DemoBundle } from "../../core/src/schemas";
import type { BuiltEvidenceGraph } from "../../evidence/src/evidenceGraph";
import type { ReadinessAssessment } from "../../rules/src/readiness";

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
  const artifactIdBySourceId = new Map(
    bundle.evidenceSources.map((source) => [source.id, source.artifactId])
  );

  function uriForClaim(claim: {
    id: string;
    evidenceSourceIds: string[];
  }): string {
    const sourceId = claim.evidenceSourceIds[0];
    if (sourceId) {
      const artifactId = artifactIdBySourceId.get(sourceId);
      const filename = artifactId
        ? filenameByArtifactId.get(artifactId)
        : undefined;
      if (filename) {
        return `${exampleDir}${filename}`;
      }
    }
    return uriFromClaimId(claim.id, exampleDir);
  }

  const claimResults: SarifResult[] = graph.evidenceClaims.flatMap((claim) => {
    const uri = uriForClaim(claim);
    if (claim.status === "locked") {
      return [
        makeResult(
          "DOC-LOCK-001",
          "error",
          `${claim.statement} — ${claim.lockReason ?? "evidence is missing"} (claim ${claim.id})`,
          uri
        )
      ];
    }
    if (claim.status === "conflict") {
      return [
        makeResult(
          "EVID-CONFLICT-001",
          "error",
          `${claim.statement} — sources conflict (claim ${claim.id})`,
          uri
        )
      ];
    }
    if (claim.status === "partial") {
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

  // Process/traceability warnings that are not already covered by partial-claim results.
  const processResults: SarifResult[] = assessment.warnings
    .filter((warning) => !/: partial evidence$/.test(warning))
    .map((warning) =>
      makeResult("DOC-WARN-001", "warning", warning, `${exampleDir}qa_notes.md`)
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
            version: "0.1.0",
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

function uriFromClaimId(id: string, exampleDir: string): string {
  if (id.startsWith("claim.test")) return `${exampleDir}test_log.csv`;
  if (id.startsWith("claim.manual")) return `${exampleDir}demo_manual.md`;
  if (id.startsWith("claim.qa")) return `${exampleDir}qa_notes.md`;
  if (id.startsWith("claim.comp") || id.startsWith("claim.doc")) {
    return `${exampleDir}BOM.csv`;
  }
  return exampleDir;
}

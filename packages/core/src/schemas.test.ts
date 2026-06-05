import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ArtifactSchema,
  BOMItemSchema,
  EvidenceClaimSchema,
  EvidenceGraphSchema,
  ExportBundleSchema,
  WiringManifestSchema
} from "./schemas";
import { syntheticExportBundle } from "./syntheticExamples";

describe("Phase 2 schemas", () => {
  it("accepts the synthetic export bundle", () => {
    expect(() => ExportBundleSchema.parse(syntheticExportBundle)).not.toThrow();
  });

  it("rejects operational terminology in artifact text", () => {
    const unsafeArtifact = {
      id: "artifact.safe-id",
      kind: "manual",
      filename: "mission-plan.md",
      synthetic: true
    };

    expect(() => ArtifactSchema.parse(unsafeArtifact)).toThrow(
      /blocked operational/i
    );
  });

  it("allows safety documentation to mention blocked terms as prohibitions", () => {
    const safetyDoc = readFileSync("docs/safety-boundaries.md", "utf8");

    expect(safetyDoc).toContain("No mission planning");
    expect(safetyDoc).toContain("payload");
  });

  it("rejects unknown operational fields", () => {
    const unsafeClaim = {
      id: "claim.safe-id",
      statement: "Documentation note is present",
      claimType: "qa_note",
      status: "verified",
      evidenceSourceIds: ["source.qa-note-1"],
      payloadSelect: true
    };

    expect(() => EvidenceClaimSchema.parse(unsafeClaim)).toThrow();
  });

  it("keeps verified claims from passing without evidence", () => {
    const unsupportedClaim = {
      id: "claim.unsupported",
      statement: "QA note is present",
      claimType: "qa_note",
      status: "verified",
      evidenceSourceIds: []
    };

    expect(() => EvidenceClaimSchema.parse(unsupportedClaim)).toThrow(
      /require at least one evidence source/i
    );
  });

  it("requires locked claims to explain the lock", () => {
    const unexplainedLock = {
      id: "claim.locked-without-reason",
      statement: "Component record is not supported yet",
      claimType: "component_record",
      status: "locked",
      evidenceSourceIds: []
    };

    expect(() => EvidenceClaimSchema.parse(unexplainedLock)).toThrow(
      /lock reason/i
    );
  });

  it("keeps BOM items locked when evidence is missing", () => {
    const unsupportedBomItem = {
      id: "bom.training-part",
      artifactId: "artifact.bom",
      name: "Training part",
      category: "frame",
      quantity: 1,
      evidenceSourceIds: [],
      status: "verified"
    };

    expect(() => BOMItemSchema.parse(unsupportedBomItem)).toThrow(
      /require at least one evidence source/i
    );
  });

  it("keeps wiring documentation locked without supporting evidence", () => {
    const unsafeWiringManifest = {
      id: "wiring.demo",
      artifactId: "artifact.wiring-notes",
      scope: "documentation_only",
      documentationOnly: true,
      connections: [
        {
          id: "connection.demo",
          fromLabel: "Training connector",
          toLabel: "Training board",
          description: "Documentation note",
          status: "verified"
        }
      ]
    };

    expect(() => WiringManifestSchema.parse(unsafeWiringManifest)).toThrow(
      /requires evidence/i
    );
  });

  it("rejects graph links to unknown sources", () => {
    const graph = {
      ...syntheticExportBundle.evidenceGraph,
      links: [
        {
          claimId: "claim.bom-present",
          evidenceSourceId: "source.missing",
          relation: "supports"
        }
      ]
    };

    expect(() => EvidenceGraphSchema.parse(graph)).toThrow(
      /unknown evidence source/i
    );
  });

  it("requires bundles to stay synthetic and documentation-only", () => {
    const unsafeBundle = {
      ...syntheticExportBundle,
      safety: {
        documentationOnly: true,
        syntheticOnly: false,
        noOperationalUse: true
      }
    };

    expect(() => ExportBundleSchema.parse(unsafeBundle)).toThrow();
  });
});

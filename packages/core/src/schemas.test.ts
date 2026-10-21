import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ArtifactSchema,
  BOMItemSchema,
  EvidenceClaimSchema,
  EvidenceGraphSchema
} from "./schemas";

describe("Phase 2 schemas", () => {
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

  it("rejects graph links to unknown sources", () => {
    const graph = {
      id: "graph.demo-readiness",
      artifactIds: ["artifact.bom"],
      evidenceSourceIds: ["source.bom-row-1"],
      evidenceClaimIds: ["claim.bom-present"],
      links: [
        {
          claimId: "claim.bom-present",
          evidenceSourceId: "source.missing",
          relation: "supports"
        }
      ],
      generatedAt: "2026-06-05T09:00:00.000Z",
      synthetic: true
    };

    expect(() => EvidenceGraphSchema.parse(graph)).toThrow(
      /unknown evidence source/i
    );
  });
});

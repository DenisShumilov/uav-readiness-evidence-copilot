import { describe, expect, it } from "vitest";
import { detectCrossDocumentConflicts } from "./crossCheck";
import { EvidenceSourceSchema, type EvidenceSource } from "./schemas";

function source(id: string, excerpt: string): EvidenceSource {
  return EvidenceSourceSchema.parse({
    id,
    artifactId: "artifact.demo",
    label: id,
    sourceType: "note",
    excerpt,
    confidence: "medium",
    synthetic: true
  });
}

describe("detectCrossDocumentConflicts", () => {
  it("derives a conflict when two documents declare different revisions for one subject", () => {
    const conflicts = detectCrossDocumentConflicts([
      source("S1", "Document index lists rev:training-manual=TM-3"),
      source("S2", "Audit note records rev:training-manual=TM-2")
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].status).toBe("conflict");
    expect(conflicts[0].id).toBe("claim.crosscheck.training-manual");
    expect([...conflicts[0].evidenceSourceIds].sort()).toEqual(["S1", "S2"]);
    expect(conflicts[0].lockReason).toContain("TM-3");
    expect(conflicts[0].lockReason).toContain("TM-2");
  });

  it("derives no conflict when documents agree on the value", () => {
    const conflicts = detectCrossDocumentConflicts([
      source("S1", "rev:training-manual=TM-3"),
      source("S2", "rev:training-manual=tm-3")
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it("ignores sources without revision tokens", () => {
    const conflicts = detectCrossDocumentConflicts([
      source("S1", "an ordinary note with no declared revision"),
      source("S2", "another ordinary note")
    ]);
    expect(conflicts).toHaveLength(0);
  });
});

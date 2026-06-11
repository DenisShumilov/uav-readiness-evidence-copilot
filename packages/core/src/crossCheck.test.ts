import { describe, expect, it } from "vitest";
import {
  detectCrossDocumentConflicts,
  findMalformedRevisionMentions
} from "./crossCheck";
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
  it("derives a conflict when two documents declare different structured revisions for one subject", () => {
    const conflicts = detectCrossDocumentConflicts([
      source("S1", "Revision: training-manual=TM-3\nDocument index row"),
      source("S2", "Revision: training-manual=TM-2\nAudit note row")
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].status).toBe("conflict");
    expect(conflicts[0].id).toBe("claim.crosscheck.training-manual");
    expect([...conflicts[0].evidenceSourceIds].sort()).toEqual(["S1", "S2"]);
    expect(conflicts[0].lockReason).toContain("TM-3");
    expect(conflicts[0].lockReason).toContain("TM-2");
  });

  it("derives no conflict when structured revision declarations agree on the value", () => {
    const conflicts = detectCrossDocumentConflicts([
      source("S1", "Revision: training-manual=TM-3"),
      source("S2", "Revision: training-manual=tm-3")
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it("ignores sources without revision declarations", () => {
    const conflicts = detectCrossDocumentConflicts([
      source("S1", "an ordinary note with no declared revision"),
      source("S2", "another ordinary note")
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it("tolerates whitespace around the token (natural phrasing still parses)", () => {
    const conflicts = detectCrossDocumentConflicts([
      source("S1", "Index lists rev: training-manual = TM-3"),
      source("S2", "Audit records rev:training-manual=TM-2")
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe("claim.crosscheck.training-manual");
  });

  it("treats formatting-different values as distinct revisions by design", () => {
    const conflicts = detectCrossDocumentConflicts([
      source("S1", "rev:training-manual=TM-3"),
      source("S2", "rev:training-manual=TM3")
    ]);
    expect(conflicts).toHaveLength(1);
  });
});

describe("findMalformedRevisionMentions", () => {
  it("flags a revision attempt that does not satisfy the token contract", () => {
    const mentions = findMalformedRevisionMentions([
      source("S1", "rev:training-manual"), // missing =value
      source("S2", "rev= TM-3") // missing subject
    ]);
    expect(mentions.map((m) => m.sourceId).sort()).toEqual(["S1", "S2"]);
  });

  it("does not flag well-formed tokens or ordinary review prose", () => {
    const mentions = findMalformedRevisionMentions([
      source("S1", "rev:training-manual=TM-3"),
      source("S2", "The reviewer reviewed the revision history of the manual")
    ]);
    expect(mentions).toHaveLength(0);
  });

  it("flags a source that mixes a valid token with a malformed attempt", () => {
    const mentions = findMalformedRevisionMentions([
      source("S1", "rev:training-manual=TM-3 and also rev:packet (no value)")
    ]);
    expect(mentions.map((m) => m.sourceId)).toEqual(["S1"]);
  });
});

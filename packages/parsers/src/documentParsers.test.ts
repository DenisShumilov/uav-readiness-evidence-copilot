import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseManualMd } from "./manual";
import { parseQaNotesMd } from "./qaNotes";
import { parseTestLogCsv } from "./testLog";

const fixtureDir = join(process.cwd(), "examples", "demo-uav-readiness");

describe("parseManualMd", () => {
  it("parses the valid synthetic manual fixture", () => {
    const parsed = parseManualMd(
      readFileSync(join(fixtureDir, "demo_manual.md"), "utf8")
    );

    expect(parsed.artifact.kind).toBe("manual");
    expect(parsed.evidenceSources).toHaveLength(2);
    expect(parsed.evidenceClaims).toHaveLength(3);
  });

  it("keeps manual rows without evidence locked", () => {
    const parsed = parseManualMd(`
# Demo Manual

SYNTHETIC DEMO - EDUCATIONAL ONLY - NOT FOR REAL USE

| Claim | Status | Evidence |
|---|---|---|
| Review note needs support | verified | none |
`);

    expect(parsed.evidenceClaims[0].status).toBe("locked");
    expect(parsed.evidenceClaims[0].evidenceSourceIds).toEqual([]);
  });

  it("rejects unsafe manual keywords", () => {
    expect(() =>
      parseManualMd(`
# Demo Manual

SYNTHETIC DEMO - EDUCATIONAL ONLY - NOT FOR REAL USE

| Claim | Status | Evidence |
|---|---|---|
| Targeting note exists | verified | EV-BAD-001 |
`)
    ).toThrow(/blocked operational/i);
  });
});

describe("parseTestLogCsv", () => {
  const header =
    "check_id,check_name,check_type,result,evidence_status,evidence_id,notes";

  it("parses the valid synthetic test log fixture", () => {
    const parsed = parseTestLogCsv(
      readFileSync(join(fixtureDir, "test_log.csv"), "utf8")
    );

    expect(parsed.artifact.kind).toBe("test_log");
    expect(parsed.evidenceSources).toHaveLength(4);
    expect(parsed.evidenceClaims).toHaveLength(5);
    expect(parsed.qaItems).toHaveLength(5);
    expect(parsed.readinessFindings).toHaveLength(5);
  });

  it("keeps test log rows without evidence locked", () => {
    const parsed = parseTestLogCsv(
      [
        header,
        "CHECK-LOCK-001,Review owner present,qa_review,blocked,verified,,Owner is missing"
      ].join("\n")
    );

    expect(parsed.evidenceSources).toEqual([]);
    expect(parsed.evidenceClaims[0].status).toBe("locked");
    expect(parsed.qaItems[0].status).toBe("blocked");
  });

  it("rejects unsafe test log keywords", () => {
    expect(() =>
      parseTestLogCsv(
        [
          header,
          "CHECK-BAD-001,Payload review,documentation,pass,verified,EV-BAD-001,Unsafe word should fail"
        ].join("\n")
      )
    ).toThrow(/blocked operational/i);
  });

  it("rejects invalid test log rows", () => {
    expect(() =>
      parseTestLogCsv(
        [
          header,
          "CHECK-BAD-001,Review owner present,unknown_type,pass,verified,EV-BAD-001,Invalid check type"
        ].join("\n")
      )
    ).toThrow();
  });
});

describe("parseQaNotesMd", () => {
  it("parses the valid synthetic QA notes fixture", () => {
    const parsed = parseQaNotesMd(
      readFileSync(join(fixtureDir, "qa_notes.md"), "utf8")
    );

    expect(parsed.artifact.kind).toBe("qa_notes");
    expect(parsed.evidenceSources).toHaveLength(3);
    expect(parsed.evidenceClaims).toHaveLength(5);
    expect(parsed.evidenceLocks).toHaveLength(2);
    expect(parsed.readinessFindings).toHaveLength(1);
  });

  it("keeps QA notes rows without usable evidence locked", () => {
    const parsed = parseQaNotesMd(`
# QA Notes

SYNTHETIC DEMO - EDUCATIONAL ONLY - NOT FOR REAL USE

| Evidence ID | Status | Meaning |
|---|---|---|
| EV-LOCK-001 | locked | Source is missing |

Finding ID: WARN-TRACE-001

Status: warning

Reason: source is missing

Impact: review is incomplete
`);

    expect(parsed.evidenceSources).toEqual([]);
    expect(parsed.evidenceClaims[0].status).toBe("locked");
    expect(parsed.evidenceLocks[0].status).toBe("locked");
  });

  it("rejects unsafe QA notes keywords", () => {
    expect(() =>
      parseQaNotesMd(`
# QA Notes

SYNTHETIC DEMO - EDUCATIONAL ONLY - NOT FOR REAL USE

| Evidence ID | Status | Meaning |
|---|---|---|
| EV-BAD-001 | verified | Payload note is present |

Finding ID: WARN-TRACE-001

Status: warning

Reason: unsafe word should fail

Impact: review is incomplete
`)
    ).toThrow(/blocked operational/i);
  });
});

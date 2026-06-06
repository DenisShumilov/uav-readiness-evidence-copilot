import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { parseDemoBundle } from "./demoBundle";

const fixtureDir = join(process.cwd(), "examples", "demo-uav-readiness");

describe("parseDemoBundle", () => {
  it("parses safe demo fixtures into one bundle", () => {
    const bundle = parseDemoBundle(fixtureDir);

    expect(bundle.artifacts.map((artifact) => artifact.kind)).toEqual([
      "bom",
      "manual",
      "test_log",
      "qa_notes"
    ]);
    expect(bundle.bomItems).toHaveLength(4);
    expect(bundle.evidenceSources.length).toBeGreaterThan(0);
    expect(bundle.evidenceClaims.length).toBeGreaterThan(0);
    expect(bundle.evidenceLocks).toHaveLength(2);
    expect(bundle.qaItems).toHaveLength(5);
    expect(bundle.readinessFindings).toHaveLength(6);
  });

  it("keeps missing evidence locked across the bundle", () => {
    const bundle = parseDemoBundle(fixtureDir);
    const lockedClaims = bundle.evidenceClaims.filter(
      (claim) => claim.status === "locked"
    );

    expect(lockedClaims.length).toBeGreaterThan(0);
    expect(
      lockedClaims.every(
        (claim) => claim.evidenceSourceIds.length === 0 && claim.lockReason
      )
    ).toBe(true);
  });

  it("does not read wiring or config fixtures in this batch", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "demo-bundle-"));
    writeFixture(tempDir, "BOM.csv", "item_id,item_name,category,quantity,record_status,evidence_id,notes\nCOMP-001,Training frame,frame,1,verified,EV-BOM-001,Synthetic row");
    writeFixture(tempDir, "demo_manual.md", "# Demo Manual\n\nSYNTHETIC DEMO - EDUCATIONAL ONLY - NOT FOR REAL USE\n\n| Claim | Status | Evidence |\n|---|---|---|\n| Synthetic manual exists | verified | EV-MAN-001 |");
    writeFixture(tempDir, "test_log.csv", "check_id,check_name,check_type,result,evidence_status,evidence_id,notes\nCHECK-001,Manual summary present,documentation,pass,verified,EV-MAN-001,Synthetic check");
    writeFixture(tempDir, "qa_notes.md", "# QA Notes\n\nSYNTHETIC DEMO - EDUCATIONAL ONLY - NOT FOR REAL USE\n\n| Evidence ID | Status | Meaning |\n|---|---|---|\n| EV-QA-001 | verified | QA note exists |\n\nFinding ID: WARN-TRACE-001\n\nStatus: warning\n\nReason: review note exists\n\nImpact: review can continue");
    writeFixture(tempDir, "wiring_notes.yaml", "this: should_not_be_read");
    writeFixture(tempDir, "config_dump.txt", "this=should_not_be_read");

    const bundle = parseDemoBundle(tempDir);

    expect(bundle.artifacts.map((artifact) => artifact.kind)).toEqual([
      "bom",
      "manual",
      "test_log",
      "qa_notes"
    ]);
  });
});

function writeFixture(dir: string, filename: string, content: string) {
  writeFileSync(join(dir, filename), content, "utf8");
}

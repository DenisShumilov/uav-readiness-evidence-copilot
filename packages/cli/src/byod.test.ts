import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectSupportedInputKind, parseByodDirectory } from "./byod";

describe("BYOD input detection", () => {
  it("detects supported inputs from headers and markdown sections", () => {
    expect(
      detectSupportedInputKind(
        "parts.csv",
        "item_id,item_name,category,quantity,revision,record_status,evidence_id,notes\n"
      )
    ).toBe("bom");
    expect(
      detectSupportedInputKind(
        "checks.csv",
        "check_id,check_name,check_type,result,evidence_status,evidence_id,notes\n"
      )
    ).toBe("test_log");
    expect(
      detectSupportedInputKind(
        "manual.md",
        "SYNTHETIC DEMO\n\n| Claim | Status | Evidence |\n"
      )
    ).toBe("manual");
    expect(
      detectSupportedInputKind(
        "notes.md",
        "SYNTHETIC DEMO\n\n| Evidence ID | Status | Meaning |\n"
      )
    ).toBe("qa_notes");
    expect(detectSupportedInputKind("readme.md", "# Notes\n")).toBeUndefined();
  });

  it("creates locked claims when supported inputs are missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "byod-missing-"));
    writeFileSync(
      join(dir, "BOM.csv"),
      [
        "item_id,item_name,category,quantity,revision,record_status,evidence_id,notes",
        "COMP-001,Training frame,frame,1,,verified,EV-BOM-001,Synthetic row"
      ].join("\n"),
      "utf8"
    );

    const result = parseByodDirectory(dir);
    const lockedMissingClaims = result.bundle.evidenceClaims
      .filter((claim) => claim.id.startsWith("claim.missing."))
      .map((claim) => claim.id);

    expect(lockedMissingClaims).toEqual([
      "claim.missing.manual",
      "claim.missing.test_log",
      "claim.missing.qa_notes"
    ]);
    expect(result.ingestSummary.some((item) => item.status === "locked")).toBe(
      true
    );
  });

  it("parses a BYOD directory without SYNTHETIC DEMO banner and marks artifacts/sources synthetic: false", () => {
    const dir = mkdtempSync(join(tmpdir(), "byod-real-"));
    writeFileSync(
      join(dir, "BOM.csv"),
      [
        "item_id,item_name,category,quantity,revision,record_status,evidence_id,notes",
        "COMP-001,Bench frame assembly,frame,1,,verified,EV-SHARED,Verified frame row"
      ].join("\n"),
      "utf8"
    );
    writeFileSync(
      join(dir, "manual.md"),
      [
        "# Bench Manual",
        "",
        "| Claim | Status | Evidence |",
        "|---|---|---|",
        "| Bench manual exists | verified | EV-SHARED |"
      ].join("\n"),
      "utf8"
    );
    writeFileSync(
      join(dir, "test_log.csv"),
      [
        "check_id,check_name,check_type,result,evidence_status,evidence_id,notes",
        "CHECK-001,Bench check pass,documentation,pass,verified,EV-SHARED.demo-manual,Reserved raw id in test log"
      ].join("\n"),
      "utf8"
    );
    writeFileSync(
      join(dir, "qa_notes.md"),
      [
        "# QA Notes",
        "",
        "| Evidence ID | Status | Meaning |",
        "|---|---|---|",
        "| EV-QA-001 | verified | QA review note complete |",
        "",
        "Finding ID: WARN-TRACE-001",
        "Status: info",
        "Reason: All notes reviewed",
        "Impact: Ready for review"
      ].join("\n"),
      "utf8"
    );

    const result = parseByodDirectory(dir);

    expect(result.bundle.artifacts.every((a) => a.synthetic === false)).toBe(
      true
    );
    expect(
      result.bundle.evidenceSources.every((s) => s.synthetic === false)
    ).toBe(true);
    // Cross-file collision on EV-SHARED avoids reserved raw ID EV-SHARED.demo-manual:
    const sourceIds = result.bundle.evidenceSources.map((s) => s.id);
    expect(sourceIds).toContain("EV-SHARED");
    expect(sourceIds).toContain("EV-SHARED.demo-manual");
    expect(sourceIds).toContain("EV-SHARED.demo-manual-2");
  });
});

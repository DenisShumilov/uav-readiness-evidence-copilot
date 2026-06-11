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
});

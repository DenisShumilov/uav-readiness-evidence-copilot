import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBOMCsv } from "./bom";

const fixturePath = join(
  process.cwd(),
  "examples",
  "demo-uav-readiness",
  "BOM.csv"
);

const header =
  "item_id,item_name,category,quantity,record_status,evidence_id,notes";

describe("parseBOMCsv", () => {
  it("parses the valid synthetic BOM fixture", () => {
    const parsed = parseBOMCsv(readFileSync(fixturePath, "utf8"));

    expect(parsed.artifact.kind).toBe("bom");
    expect(parsed.artifact.synthetic).toBe(true);
    expect(parsed.bomItems).toHaveLength(4);
    expect(parsed.evidenceSources).toHaveLength(3);
    expect(parsed.evidenceClaims).toHaveLength(4);
  });

  it("keeps rows without evidence locked", () => {
    const csv = [
      header,
      "COMP-LOCK-001,Training review part,other,1,verified,,Missing source keeps this locked"
    ].join("\n");

    const parsed = parseBOMCsv(csv);

    expect(parsed.bomItems[0].status).toBe("locked");
    expect(parsed.bomItems[0].evidenceSourceIds).toEqual([]);
    expect(parsed.evidenceSources).toEqual([]);
    expect(parsed.evidenceClaims[0].status).toBe("locked");
    expect(parsed.evidenceClaims[0].lockReason).toBe(
      "Missing source keeps this locked"
    );
  });

  it("rejects unsafe operational keywords", () => {
    const csv = [
      header,
      "COMP-UNSAFE-001,Training payload adapter,other,1,verified,EV-UNSAFE-001,Unsafe word should fail"
    ].join("\n");

    expect(() => parseBOMCsv(csv)).toThrow(/blocked operational/i);
  });

  it("rejects invalid rows", () => {
    const csv = [
      header,
      "COMP-BAD-001,Training invalid part,other,0,verified,EV-BAD-001,Quantity must be positive"
    ].join("\n");

    expect(() => parseBOMCsv(csv)).toThrow();
  });
});

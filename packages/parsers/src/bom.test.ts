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
  "item_id,item_name,category,quantity,revision,record_status,evidence_id,notes";

describe("parseBOMCsv", () => {
  it("parses the valid synthetic BOM fixture", () => {
    const parsed = parseBOMCsv(readFileSync(fixturePath, "utf8"));

    expect(parsed.artifact.kind).toBe("bom");
    expect(parsed.artifact.synthetic).toBe(true);
    expect(parsed.bomItems).toHaveLength(4);
    expect(parsed.evidenceSources).toHaveLength(3);
    expect(parsed.evidenceClaims).toHaveLength(4);
    const withRevision = parseBOMCsv(
      [
        header,
        "DOC-INDEX-001,Training document index,documentation,1,training-manual=TM-3,verified,EV-BOM-001,Document index row"
      ].join("\n")
    );

    expect(withRevision.bomItems[0].version).toBe("training-manual=TM-3");
    expect(withRevision.evidenceSources[0].excerpt).toContain(
      "Revision: training-manual=TM-3"
    );
  });

  it("keeps rows without evidence locked", () => {
    const csv = [
      header,
      "COMP-LOCK-001,Training review part,other,1,,verified,,Missing source keeps this locked"
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
      "COMP-UNSAFE-001,Training payload adapter,other,1,,verified,EV-UNSAFE-001,Unsafe word should fail"
    ].join("\n");

    expect(() => parseBOMCsv(csv)).toThrow(/blocked operational/i);
  });

  it("rejects invalid rows", () => {
    const csv = [
      header,
      "COMP-BAD-001,Training invalid part,other,0,,verified,EV-BAD-001,Quantity must be positive"
    ].join("\n");

    expect(() => parseBOMCsv(csv)).toThrow();
  });

  it("deduplicates identical intra-file evidence IDs and disambiguates conflicting duplicates with row suffixes", () => {
    const csv = [
      header,
      "COMP-001,Training frame,frame,1,,verified,EV-DUP-001,First row note",
      "COMP-002,Training frame,frame,1,,verified,EV-DUP-001,First row note",
      "COMP-003,Training mount,frame,1,,verified,EV-DUP-001,Conflicting row note",
      "COMP-004,Training bracket,frame,1,,verified,EV-DUP-001.bom-r3,Reserved raw ID row"
    ].join("\n");

    const parsed = parseBOMCsv(csv);

    expect(parsed.bomItems[0].evidenceSourceIds).toEqual(["EV-DUP-001"]);
    expect(parsed.bomItems[1].evidenceSourceIds).toEqual(["EV-DUP-001"]);
    expect(parsed.bomItems[2].evidenceSourceIds).toEqual(["EV-DUP-001.bom-r3-2"]);
    expect(parsed.bomItems[3].evidenceSourceIds).toEqual(["EV-DUP-001.bom-r3"]);
    expect(parsed.evidenceSources.map((s) => s.id)).toEqual([
      "EV-DUP-001",
      "EV-DUP-001.bom-r3-2",
      "EV-DUP-001.bom-r3"
    ]);
    expect(parsed.evidenceClaims[2].evidenceSourceIds).toEqual([
      "EV-DUP-001.bom-r3-2"
    ]);
  });

  it("bounds disambiguated IDs to <= 64 characters for base IDs <= 64 characters", () => {
    const longBaseId = `EV-${"A".repeat(60)}`; // 63 chars
    const csv = [
      header,
      `COMP-001,Training frame,frame,1,,verified,${longBaseId},Note A`,
      `COMP-002,Training mount,frame,1,,verified,${longBaseId},Note B`
    ].join("\n");

    const parsed = parseBOMCsv(csv);
    expect(parsed.evidenceSources).toHaveLength(2);
    expect(parsed.evidenceSources[1].id.length).toBeLessThanOrEqual(64);
    expect(parsed.evidenceSources[1].id).toMatch(/\.bom-r2$/);
  });
});

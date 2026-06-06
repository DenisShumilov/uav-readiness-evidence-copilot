import { describe, expect, it } from "vitest";
import { parseDemoBundle } from "../../parsers/src/demoBundle";
import { evaluateReadiness } from "../../rules/src/readiness";
import {
  buildTraceabilityRows,
  generateTraceabilityMatrix
} from "./traceabilityMatrix";

describe("generateTraceabilityMatrix", () => {
  it("exports requirement to evidence to check rows", () => {
    const bundle = parseDemoBundle();
    const assessment = evaluateReadiness(bundle);
    const csv = generateTraceabilityMatrix(bundle, assessment);

    expect(csv).toContain("requirement,evidence,check,status,risk");
    expect(csv).toContain("synthetic BOM");
    expect(csv).toContain("partial evidence");
    expect(csv).toContain("missing");
  });

  it("marks locked claims as missing evidence", () => {
    const bundle = parseDemoBundle();
    const assessment = evaluateReadiness(bundle);
    const rows = buildTraceabilityRows(bundle, assessment);
    const lockedRows = rows.filter((row) => row.status === "locked");

    expect(lockedRows.length).toBeGreaterThan(0);
    expect(lockedRows.every((row) => row.evidence === "missing")).toBe(true);
    expect(lockedRows.every((row) => row.risk !== "none")).toBe(true);
  });
});

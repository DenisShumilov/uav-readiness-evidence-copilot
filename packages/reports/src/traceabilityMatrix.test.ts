import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { parseDemoBundle } from "@uav-readiness/parsers";
import { evaluateReadiness } from "@uav-readiness/rules";
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

    const conflictBundle = parseDemoBundle(
      join(process.cwd(), "examples", "demo-conflict-readiness")
    );
    const conflictAssessment = evaluateReadiness(conflictBundle);
    const conflictRows = buildTraceabilityRows(conflictBundle, conflictAssessment)
      .filter((row) => row.status === "conflict");

    expect(conflictRows).toHaveLength(1);
    expect(conflictRows[0].risk).toContain("Conflicting training manual revision");
    expect(conflictRows[0].risk).toContain("TM-3");
    expect(conflictRows[0].risk).toContain("TM-2");
  });
});

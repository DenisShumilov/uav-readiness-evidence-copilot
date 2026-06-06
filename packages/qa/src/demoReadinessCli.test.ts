import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runReadinessDemo } from "../../../scripts/demoReadiness";

const fixtureDir = join(process.cwd(), "examples", "demo-uav-readiness");
const unsafePattern =
  /\b(mission|payload|targeting|weapon|route|waypoint|telemetry|target|coordinates|coordinate|gps|frequency|frequencies|mavlink|px4|ardupilot|strike|attack|evasion|evade|countermeasure)\b/i;

describe("demo readiness CLI", () => {
  it("writes demo readiness outputs", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-output-"));
    const result = runReadinessDemo({ fixtureDir, outputDir });

    expect(result.files).toEqual([
      "readiness-report.md",
      "evidence-graph.json",
      "readiness-assessment.json",
      "traceability-matrix.csv",
      "artifact-hashes.json"
    ]);
    expect(existsSync(join(outputDir, "readiness-report.md"))).toBe(true);
    expect(existsSync(join(outputDir, "evidence-graph.json"))).toBe(true);
    expect(existsSync(join(outputDir, "readiness-assessment.json"))).toBe(true);
    expect(existsSync(join(outputDir, "traceability-matrix.csv"))).toBe(true);
    expect(existsSync(join(outputDir, "artifact-hashes.json"))).toBe(true);
  });

  it("keeps generated report inside safe wording", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-output-"));
    runReadinessDemo({ fixtureDir, outputDir });
    const report = readFileSync(join(outputDir, "readiness-report.md"), "utf8");

    expect(report).not.toMatch(unsafePattern);
    expect(report).toContain("documentation readiness only");
  });

  it("writes traceability and hash content", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-output-"));
    runReadinessDemo({ fixtureDir, outputDir });
    const traceability = readFileSync(
      join(outputDir, "traceability-matrix.csv"),
      "utf8"
    );
    const hashes = JSON.parse(
      readFileSync(join(outputDir, "artifact-hashes.json"), "utf8")
    ) as { artifacts: Array<{ sha256: string }> };

    expect(traceability).toContain("requirement,evidence,check,status,risk");
    expect(hashes.artifacts).toHaveLength(4);
    expect(hashes.artifacts[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

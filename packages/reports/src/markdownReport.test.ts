import { describe, expect, it } from "vitest";
import { buildEvidenceGraphFromBundle } from "@uav-readiness/evidence";
import { parseDemoBundle } from "@uav-readiness/parsers";
import { evaluateReadiness } from "@uav-readiness/rules";
import { generateReadinessReportMarkdown } from "./markdownReport";

describe("generateReadinessReportMarkdown", () => {
  it("generates a readable demo readiness report", () => {
    const bundle = parseDemoBundle();
    const graph = buildEvidenceGraphFromBundle(
      bundle,
      "2026-06-06T00:00:00.000Z"
    );
    const assessment = evaluateReadiness(bundle);
    const markdown = generateReadinessReportMarkdown(bundle, graph, assessment);

    expect(markdown).toContain("# UAV Readiness & Evidence Copilot - Demo Report");
    expect(markdown).toContain("Score: **");
    expect(markdown).toContain("## Artifact Summary");
    expect(markdown).toContain("## Evidence Summary");
    expect(markdown).toContain("## Locked Steps");
    expect(markdown).toContain("## Safety Boundary");
  });

  it("includes locked items and warnings", () => {
    const bundle = parseDemoBundle();
    const graph = buildEvidenceGraphFromBundle(
      bundle,
      "2026-06-06T00:00:00.000Z"
    );
    const assessment = evaluateReadiness(bundle);
    const markdown = generateReadinessReportMarkdown(bundle, graph, assessment);

    expect(markdown).toContain("Board record needs a supporting source");
    expect(markdown).toContain("partial evidence");
  });

  it("states the report is documentation readiness only", () => {
    const bundle = parseDemoBundle();
    const graph = buildEvidenceGraphFromBundle(
      bundle,
      "2026-06-06T00:00:00.000Z"
    );
    const assessment = evaluateReadiness(bundle);
    const markdown = generateReadinessReportMarkdown(bundle, graph, assessment);

    expect(markdown).toContain("documentation readiness only");
    expect(markdown).toContain("not approval for real use");
  });
});

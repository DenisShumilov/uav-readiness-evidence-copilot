import { describe, expect, it } from "vitest";
import { buildEvidenceGraphFromBundle } from "@uav-readiness/evidence";
import { parseDemoBundle } from "@uav-readiness/parsers";
import { evaluateReadiness } from "@uav-readiness/rules";
import { generateReadinessReportMarkdown } from "./markdownReport";
import { sanitizeHref, sanitizeMarkdownInline } from "./markdown";

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
    expect(markdown).toContain("reviewer_upper_bound");
  });

  it("emits an honest non-synthetic banner and sanitizes href parentheses", () => {
    const bundle = parseDemoBundle();
    const nonSyntheticBundle = {
      ...bundle,
      artifacts: bundle.artifacts.map((a) => ({ ...a, synthetic: false })),
      evidenceSources: bundle.evidenceSources.map((s) => ({
        ...s,
        synthetic: false
      }))
    };
    const graph = buildEvidenceGraphFromBundle(
      nonSyntheticBundle,
      "2026-06-06T00:00:00.000Z"
    );
    const assessment = evaluateReadiness(nonSyntheticBundle);
    const markdown = generateReadinessReportMarkdown(
      nonSyntheticBundle,
      graph,
      assessment
    );

    expect(markdown).not.toContain(
      "SYNTHETIC DEMO - EDUCATIONAL ONLY - NOT FOR REAL USE"
    );
    expect(markdown).toContain("NON-SYNTHETIC");
    expect(markdown).toContain(
      "# UAV Readiness & Evidence Copilot - Assessment Report"
    );
    expect(markdown).not.toContain("Keep demo data synthetic");
    expect(sanitizeHref("report(v1).md")).toBe("report%28v1%29.md");
    expect(sanitizeMarkdownInline("line1\n#heading")).toBe("line1 \\#heading");
  });
});

import { buildEvidenceGraphFromBundle } from "../../evidence/src/evidenceGraph";
import { parseDemoBundle } from "../../parsers/src/demoBundle";
import { evaluateReadiness } from "../../rules/src/readiness";
import { generatePortfolioDemoMarkdown } from "./portfolioDemo";
import { describe, expect, it } from "vitest";

describe("generatePortfolioDemoMarkdown", () => {
  it("summarizes the demo in a recruiter-friendly page", () => {
    const bundle = parseDemoBundle();
    const graph = buildEvidenceGraphFromBundle(
      bundle,
      "2026-01-01T00:00:00.000Z"
    );
    const assessment = evaluateReadiness(bundle);
    const markdown = generatePortfolioDemoMarkdown(bundle, graph, assessment, [
      "readiness-report.md",
      "portfolio-demo.md"
    ]);

    expect(markdown).toContain("# UAV Readiness & Evidence Copilot");
    expect(markdown).toContain(`**${assessment.readinessScore}/100**`);
    expect(markdown).toContain(`- Verified: ${graph.summary.verifiedCount}`);
    expect(markdown).toContain("## What This Shows Employers");
    expect(markdown).toContain("[portfolio-demo.md](portfolio-demo.md)");
  });

  it("keeps locked evidence visible instead of hiding it", () => {
    const bundle = parseDemoBundle();
    const graph = buildEvidenceGraphFromBundle(bundle);
    const assessment = evaluateReadiness(bundle);
    const markdown = generatePortfolioDemoMarkdown(bundle, graph, assessment, [
      "portfolio-demo.md"
    ]);

    expect(assessment.lockedCriticalItems.length).toBeGreaterThan(0);
    expect(markdown).toContain("## Locked Items");
    expect(markdown).toContain(assessment.lockedCriticalItems[0].id);
  });
});

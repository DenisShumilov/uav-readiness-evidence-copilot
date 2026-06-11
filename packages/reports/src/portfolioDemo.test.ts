import { buildEvidenceGraphFromBundle } from "@uav-readiness/evidence";
import { parseDemoBundle } from "@uav-readiness/parsers";
import { evaluateReadiness } from "@uav-readiness/rules";
import {
  generatePortfolioDemoHtml,
  generatePortfolioDemoMarkdown
} from "./portfolioDemo";
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

  it("renders a static HTML demo page for a browser", () => {
    const bundle = parseDemoBundle();
    const graph = buildEvidenceGraphFromBundle(bundle);
    const assessment = evaluateReadiness(bundle);
    const html = generatePortfolioDemoHtml(bundle, graph, assessment, [
      "readiness-report.md",
      "portfolio-demo.html"
    ]);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>UAV Readiness & Evidence Copilot</title>");
    expect(html).toContain(`aria-label="Readiness score ${assessment.readinessScore} out of 100"`);
    expect(html).toContain("Traceability Preview");
    expect(html).toContain("Locked Steps");
    expect(html).toContain("Safety Boundary");
    expect(html).toContain("No mission planning. No payload. No live drone control.");
    expect(html).toContain("portfolio-demo.html");
  });

  it("renders a Ukrainian static HTML demo page", () => {
    const bundle = parseDemoBundle();
    const graph = buildEvidenceGraphFromBundle(bundle);
    const assessment = evaluateReadiness(bundle);
    const html = generatePortfolioDemoHtml(bundle, graph, assessment, [
      "portfolio-demo.uk.html"
    ], "uk");

    expect(html).toContain('<html lang="uk">');
    expect(html).toContain("Простими словами");
    expect(html).toContain("Оцінка готовності показує стан документації");
    expect(html).toContain("Доказ — це підтвердження");
    expect(html).toContain("Заблоковано означає");
    expect(html).toContain("Підтверджено");
    expect(html).toContain("Немає роботи з корисним навантаженням");
    expect(html).toContain("portfolio-demo.en.html");
  });

  it("renders score and counters from the assessment data", () => {
    const bundle = parseDemoBundle();
    const graph = buildEvidenceGraphFromBundle(bundle);
    const assessment = evaluateReadiness(bundle);
    const html = generatePortfolioDemoHtml(bundle, graph, assessment, [
      "portfolio-demo.html"
    ]);

    expect(html).toContain(`aria-label="Readiness score ${assessment.readinessScore} out of 100"`);
    expect(html).toContain(`<b class="verified">${graph.summary.verifiedCount}</b>`);
    expect(html).toContain(`<b class="partial">${graph.summary.partialCount}</b>`);
    expect(html).toContain(`<b class="locked">${graph.summary.lockedCount}</b>`);
  });
});

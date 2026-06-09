import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildEvidenceGraphFromBundle } from "../packages/evidence/src/evidenceGraph";
import { parseDemoBundle } from "../packages/parsers/src/demoBundle";
import { generateArtifactHashes } from "../packages/reports/src/artifactHashes";
import { generateReadinessReportMarkdown } from "../packages/reports/src/markdownReport";
import {
  generatePortfolioDemoHtml,
  generatePortfolioDemoMarkdown
} from "../packages/reports/src/portfolioDemo";
import { generateTraceabilityMatrix } from "../packages/reports/src/traceabilityMatrix";
import { generateReadinessSarif } from "../packages/reports/src/sarif";
import { evaluateReadiness } from "../packages/rules/src/readiness";

export type RunReadinessDemoOptions = {
  fixtureDir?: string;
  outputDir?: string;
};

export function runReadinessDemo(options: RunReadinessDemoOptions = {}) {
  const fixtureDir =
    options.fixtureDir ?? join(process.cwd(), "examples", "demo-uav-readiness");
  const outputDir = options.outputDir ?? join(fixtureDir, "output");

  const bundle = parseDemoBundle(fixtureDir);
  const evidenceGraph = buildEvidenceGraphFromBundle(bundle);
  const readinessAssessment = evaluateReadiness(bundle);
  const traceabilityMatrix = generateTraceabilityMatrix(
    bundle,
    readinessAssessment
  );
  const artifactHashes = generateArtifactHashes(fixtureDir);
  const markdown = generateReadinessReportMarkdown(
    bundle,
    evidenceGraph,
    readinessAssessment
  );
  const files = [
    "readiness-report.md",
    "evidence-graph.json",
    "readiness-assessment.json",
    "traceability-matrix.csv",
    "artifact-hashes.json",
    "readiness.sarif",
    "portfolio-demo.md",
    "portfolio-demo.html",
    "portfolio-demo.en.html",
    "portfolio-demo.uk.html"
  ];
  const portfolioDemo = generatePortfolioDemoMarkdown(
    bundle,
    evidenceGraph,
    readinessAssessment,
    files
  );
  const portfolioDemoHtml = generatePortfolioDemoHtml(
    bundle,
    evidenceGraph,
    readinessAssessment,
    files
  );
  const portfolioDemoHtmlEn = generatePortfolioDemoHtml(
    bundle,
    evidenceGraph,
    readinessAssessment,
    files,
    "en"
  );
  const portfolioDemoHtmlUk = generatePortfolioDemoHtml(
    bundle,
    evidenceGraph,
    readinessAssessment,
    files,
    "uk"
  );

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "readiness-report.md"), markdown, "utf8");
  writeFileSync(
    join(outputDir, "evidence-graph.json"),
    JSON.stringify(evidenceGraph, null, 2),
    "utf8"
  );
  writeFileSync(
    join(outputDir, "readiness-assessment.json"),
    JSON.stringify(readinessAssessment, null, 2),
    "utf8"
  );
  writeFileSync(
    join(outputDir, "traceability-matrix.csv"),
    traceabilityMatrix,
    "utf8"
  );
  writeFileSync(
    join(outputDir, "artifact-hashes.json"),
    JSON.stringify(artifactHashes, null, 2),
    "utf8"
  );
  writeFileSync(
    join(outputDir, "readiness.sarif"),
    generateReadinessSarif(bundle, evidenceGraph, readinessAssessment),
    "utf8"
  );
  writeFileSync(join(outputDir, "portfolio-demo.md"), portfolioDemo, "utf8");
  writeFileSync(
    join(outputDir, "portfolio-demo.html"),
    portfolioDemoHtml,
    "utf8"
  );
  writeFileSync(
    join(outputDir, "portfolio-demo.en.html"),
    portfolioDemoHtmlEn,
    "utf8"
  );
  writeFileSync(
    join(outputDir, "portfolio-demo.uk.html"),
    portfolioDemoHtmlUk,
    "utf8"
  );

  return {
    outputDir,
    readinessScore: readinessAssessment.readinessScore,
    files
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runReadinessDemo();
  console.log(`Demo readiness score: ${result.readinessScore}/100`);
  console.log(`Wrote output to: ${result.outputDir}`);
}

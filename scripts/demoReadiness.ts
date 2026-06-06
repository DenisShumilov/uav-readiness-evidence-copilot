import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildEvidenceGraphFromBundle } from "../packages/evidence/src/evidenceGraph";
import { parseDemoBundle } from "../packages/parsers/src/demoBundle";
import { generateReadinessReportMarkdown } from "../packages/reports/src/markdownReport";
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
  const markdown = generateReadinessReportMarkdown(
    bundle,
    evidenceGraph,
    readinessAssessment
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

  return {
    outputDir,
    readinessScore: readinessAssessment.readinessScore,
    files: [
      "readiness-report.md",
      "evidence-graph.json",
      "readiness-assessment.json"
    ]
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runReadinessDemo();
  console.log(`Demo readiness score: ${result.readinessScore}/100`);
  console.log(`Wrote output to: ${result.outputDir}`);
}

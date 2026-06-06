import type { DemoBundle } from "../../core/src/schemas";
import type { BuiltEvidenceGraph } from "../../evidence/src/evidenceGraph";
import type { ReadinessAssessment } from "../../rules/src/readiness";

export function generatePortfolioDemoMarkdown(
  bundle: DemoBundle,
  graph: BuiltEvidenceGraph,
  assessment: ReadinessAssessment,
  outputFiles: string[]
): string {
  const lines = [
    "# UAV Readiness & Evidence Copilot",
    "",
    "Portfolio demo: synthetic documentation readiness review for safe engineering QA.",
    "",
    "This demo shows how the project reads safe example files, checks evidence, keeps missing proof locked, and writes a recruiter-friendly summary.",
    "",
    "## Readiness Score",
    "",
    `**${assessment.readinessScore}/100**`,
    "",
    "## Evidence Status",
    "",
    `- Verified: ${graph.summary.verifiedCount}`,
    `- Partial: ${graph.summary.partialCount}`,
    `- Locked: ${graph.summary.lockedCount}`,
    "",
    "## Warnings",
    "",
    ...formatList(assessment.warnings),
    "",
    "## Locked Items",
    "",
    ...formatList(
      assessment.lockedCriticalItems.map((item) => `${item.id}: ${item.reason}`)
    ),
    "",
    "## Output Files",
    "",
    ...outputFiles.map((file) => `- [${file}](${file})`),
    "",
    "## What This Shows Employers",
    "",
    "- Safe AI-assisted engineering workflow design.",
    "- Evidence-first thinking: missing proof stays locked.",
    "- Practical TypeScript modules, tests, CLI output, and clear documentation.",
    "- Portfolio-ready delivery that can be understood in 30 seconds.",
    "",
    "## Safety Note",
    "",
    "This is a synthetic documentation demo only. It does not connect to live systems or operate real equipment.",
    ""
  ];

  return `${lines.join("\n")}`;
}

function formatList(items: string[]): string[] {
  if (items.length === 0) {
    return ["- None"];
  }

  return items.map((item) => `- ${item}`);
}

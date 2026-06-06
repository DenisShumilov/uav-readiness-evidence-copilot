import type { DemoBundle } from "../../core/src/schemas";
import type { BuiltEvidenceGraph } from "../../evidence/src/evidenceGraph";
import type { ReadinessAssessment } from "../../rules/src/readiness";

export function generateReadinessReportMarkdown(
  bundle: DemoBundle,
  graph: BuiltEvidenceGraph,
  assessment: ReadinessAssessment
): string {
  const lines = [
    "# UAV Readiness & Evidence Copilot - Demo Report",
    "",
    "SYNTHETIC DEMO - EDUCATIONAL ONLY - NOT FOR REAL USE",
    "",
    "## Readiness Score",
    "",
    `Score: **${assessment.readinessScore}/100**`,
    "",
    assessment.summary.explanation,
    "",
    "## Artifact Summary",
    "",
    ...bundle.artifacts.map(
      (artifact) => `- ${artifact.filename}: ${artifact.kind}`
    ),
    "",
    "## Evidence Summary",
    "",
    `- Verified: ${graph.summary.verifiedCount}`,
    `- Partial: ${graph.summary.partialCount}`,
    `- Locked: ${graph.summary.lockedCount}`,
    `- Conflict: ${graph.summary.conflictCount}`,
    "",
    "## Locked Steps",
    "",
    ...formatList(
      assessment.lockedCriticalItems.map(
        (item) => `${item.id}: ${item.reason}`
      )
    ),
    "",
    "## Warnings",
    "",
    ...formatList(assessment.warnings),
    "",
    "## QA Checklist Summary",
    "",
    ...bundle.qaItems.map((item) => `- ${item.status}: ${item.question}`),
    "",
    "## Next Safe Actions",
    "",
    "- Add missing supporting sources for locked items.",
    "- Review partial evidence before marking anything verified.",
    "- Keep demo data synthetic and documentation-only.",
    "",
    "## Safety Boundary",
    "",
    "This report is documentation readiness only. It is not approval for real use."
  ];

  return `${lines.join("\n")}\n`;
}

function formatList(items: string[]): string[] {
  if (items.length === 0) {
    return ["- None"];
  }

  return items.map((item) => `- ${item}`);
}

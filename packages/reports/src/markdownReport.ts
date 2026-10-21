import type { DemoBundle } from "@uav-readiness/core";
import type { BuiltEvidenceGraph } from "@uav-readiness/evidence";
import type { ReadinessAssessment } from "@uav-readiness/rules";

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
      (artifact) =>
        `- ${sanitizeMarkdownInline(artifact.filename)}: ${sanitizeMarkdownInline(artifact.kind)}`
    ),
    "",
    "## Evidence Summary",
    "",
    `- Verified: ${assessment.summary.verifiedCount}`,
    `- Partial: ${assessment.summary.partialCount}`,
    `- Locked: ${assessment.summary.lockedCount}`,
    `- Conflict: ${assessment.summary.conflictCount}`,
    "",
    "## Locked Steps",
    "",
    ...formatList(
      assessment.lockedCriticalItems.map(
        (item) =>
          `${sanitizeMarkdownInline(item.id)}: ${sanitizeMarkdownInline(item.reason)}`
      )
    ),
    "",
    "## Warnings",
    "",
    ...formatList(assessment.warnings.map(sanitizeMarkdownInline)),
    "",
    "## QA Checklist Summary",
    "",
    ...bundle.qaItems.map(
      (item) =>
        `- ${sanitizeMarkdownInline(item.status)}: ${sanitizeMarkdownInline(item.question)}`
    ),
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

function sanitizeMarkdownInline(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/([#`[\]<>|])/g, "\\$1");
}

import type { DemoBundle } from "@uav-readiness/core";
import type { BuiltEvidenceGraph } from "@uav-readiness/evidence";
import type { ReadinessAssessment } from "@uav-readiness/rules";
import { sanitizeMarkdownInline } from "./markdown";

export const READINESS_METHODOLOGY_NOTE =
  "Methodological note: A verified status with derivation reviewer_upper_bound indicates that a linked artifact-backed evidence source is present and no contradiction or failing test outcome was detected against the author-asserted status; it is not an automatic physical proof of the truth of the content.";

export function generateReadinessReportMarkdown(
  bundle: DemoBundle,
  graph: BuiltEvidenceGraph,
  assessment: ReadinessAssessment
): string {
  const isSynthetic =
    graph.evidenceGraph?.synthetic ??
    (graph as { synthetic?: boolean }).synthetic ??
    (bundle.artifacts.length > 0 &&
      bundle.artifacts.every((artifact) => artifact.synthetic));

  const banner = isSynthetic
    ? "SYNTHETIC DEMO - EDUCATIONAL ONLY - NOT FOR REAL USE"
    : "USER-PROVIDED ARTIFACT BUNDLE (NON-SYNTHETIC) - DOCUMENTATION QA ONLY - NOT FOR REAL USE";

  const lines = [
    "# UAV Readiness & Evidence Copilot - Demo Report",
    "",
    banner,
    "",
    "## Readiness Score",
    "",
    `Score: **${assessment.readinessScore}/100**`,
    "",
    sanitizeMarkdownInline(assessment.summary.explanation),
    "",
    READINESS_METHODOLOGY_NOTE,
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

import { dirname, relative, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildEvidenceGraphFromBundle } from "@uav-readiness/evidence";
import {
  generateReadinessReportMarkdown,
  generateReadinessSarif
} from "@uav-readiness/reports";
import {
  ReadinessAssessmentSchema,
  evaluateReadiness,
  type ReadinessAssessment
} from "@uav-readiness/rules";
import type { DemoBundle, EvidenceClaim, EvidenceStatus } from "@uav-readiness/core";
import type { BuiltEvidenceGraph } from "@uav-readiness/evidence";
import type { IngestSummaryItem } from "./byod";

export type CheckOutputs = {
  json?: string;
  sarif?: string;
  md?: string;
};

export type CheckResult = {
  graph: BuiltEvidenceGraph;
  assessment: ReadinessAssessment;
  markdown: string;
  sarif: string;
};

export function evaluateBundle(
  bundle: DemoBundle,
  sarifBaseUri: string
): CheckResult {
  const graph = buildEvidenceGraphFromBundle(bundle);
  const assessment = ReadinessAssessmentSchema.parse(evaluateReadiness(bundle));
  const markdown = generateReadinessReportMarkdown(bundle, graph, assessment);
  const sarif = generateReadinessSarif(bundle, graph, assessment, sarifBaseUri);

  return { graph, assessment, markdown, sarif };
}

export function writeOutputs(
  result: CheckResult,
  outputs: CheckOutputs
): void {
  if (outputs.json) {
    writeUtf8(
      outputs.json,
      `${JSON.stringify(ReadinessAssessmentSchema.parse(result.assessment), null, 2)}\n`
    );
  }
  if (outputs.sarif) {
    writeUtf8(outputs.sarif, result.sarif);
  }
  if (outputs.md) {
    writeUtf8(outputs.md, result.markdown);
  }
}

export function formatTerminalReport(
  ingestSummary: IngestSummaryItem[],
  claims: EvidenceClaim[],
  assessment: ReadinessAssessment,
  colorEnabled = true
): string {
  const lines = [
    c("Ingest summary", "bold", colorEnabled),
    ...ingestSummary.map((item) => formatIngestItem(item, colorEnabled)),
    "",
    c("Claims by status", "bold", colorEnabled),
    ...formatClaimsByStatus(claims, colorEnabled),
    "",
    c("Formula", "bold", colorEnabled),
    formatFormula(assessment),
    "",
    c("Score", "bold", colorEnabled),
    `${scoreColor(`${assessment.readinessScore}/100`, assessment.readinessScore, colorEnabled)} (${bandForScore(assessment.readinessScore)})`
  ];

  return `${lines.join("\n")}\n`;
}

export function sarifBaseUriFor(inputDir: string): string {
  const rel = relative(process.cwd(), resolve(inputDir));
  const normalized = (rel || ".").replaceAll("\\", "/");
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function formatIngestItem(
  item: IngestSummaryItem,
  colorEnabled: boolean
): string {
  const status =
    item.status === "parsed"
      ? c("parsed", "green", colorEnabled)
      : item.status === "locked"
        ? c("locked", "red", colorEnabled)
        : c("skipped", "dim", colorEnabled);
  const kind = item.kind ? ` (${item.kind})` : "";
  return `  [${status}] ${item.file}${kind}: ${item.reason}`;
}

function formatClaimsByStatus(
  claims: EvidenceClaim[],
  colorEnabled: boolean
): string[] {
  const statuses: EvidenceStatus[] = ["verified", "partial", "locked", "conflict"];
  const lines: string[] = [];

  for (const status of statuses) {
    const group = claims.filter((claim) => claim.status === status);
    lines.push(`  ${statusLabel(status, colorEnabled)} (${group.length})`);
    if (group.length === 0) {
      lines.push("    none");
      continue;
    }
    for (const claim of group) {
      const reason = claim.lockReason ? ` - ${claim.lockReason}` : "";
      lines.push(`    ${claim.id}: ${claim.statement}${reason}`);
    }
  }

  return lines;
}

function formatFormula(assessment: ReadinessAssessment): string {
  const deductions = assessment.formula.deductions;
  if (deductions.length === 0) {
    return "  100 = 100";
  }

  const terms = deductions.map(
    (deduction) => `${deduction.total} (${deduction.reason})`
  );
  return `  100 - ${terms.join(" - ")} = ${assessment.readinessScore}`;
}

function statusLabel(status: EvidenceStatus, colorEnabled: boolean): string {
  switch (status) {
    case "verified":
      return c(status, "green", colorEnabled);
    case "partial":
      return c(status, "yellow", colorEnabled);
    case "locked":
      return c(status, "red", colorEnabled);
    case "conflict":
      return c(status, "magenta", colorEnabled);
  }
}

function scoreColor(text: string, score: number, colorEnabled: boolean): string {
  if (score >= 70) return c(text, "green", colorEnabled);
  if (score >= 50) return c(text, "yellow", colorEnabled);
  return c(text, "red", colorEnabled);
}

export function bandForScore(score: number): string {
  if (score >= 85) return "Strong package";
  if (score >= 70) return "Reviewable, incomplete";
  if (score >= 50) return "Confidence reduced";
  return "Blocked";
}

function writeUtf8(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

type Color = "bold" | "dim" | "green" | "yellow" | "red" | "magenta";

const codes: Record<Color, string> = {
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  magenta: "\u001b[35m"
};

function c(text: string, color: Color, enabled: boolean): string {
  return enabled ? `${codes[color]}${text}\u001b[0m` : text;
}

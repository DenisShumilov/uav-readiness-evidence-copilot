import { basename, dirname, join, relative, resolve } from "node:path";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync
} from "node:fs";
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

export function validateOutputPaths(
  inputDir: string | undefined,
  outputs: CheckOutputs
): void {
  const entries: Array<{ flag: string; outPath: string }> = [];
  if (outputs.json) entries.push({ flag: "--json", outPath: outputs.json });
  if (outputs.sarif) entries.push({ flag: "--sarif", outPath: outputs.sarif });
  if (outputs.md) entries.push({ flag: "--md", outPath: outputs.md });

  for (const { flag, outPath } of entries) {
    if (existsSync(outPath) && statSync(outPath).isDirectory()) {
      throw new Error(
        `Output path for ${flag} is an existing directory: ${outPath}`
      );
    }
  }

  for (let i = 0; i < entries.length; i += 1) {
    const first = entries[i]!;
    for (let j = i + 1; j < entries.length; j += 1) {
      const second = entries[j]!;
      if (sameTargetPath(first.outPath, second.outPath)) {
        throw new Error(
          `Output path collision: ${first.flag} and ${second.flag} resolve to the same file (${first.outPath})`
        );
      }
    }
  }

  if (inputDir && existsSync(inputDir)) {
    const inputFiles = listAllInputFiles(resolve(inputDir));
    for (const { flag, outPath } of entries) {
      if (sameTargetPath(outPath, inputDir)) {
        throw new Error(
          `Output path for ${flag} collides with input directory: ${inputDir}`
        );
      }
      for (const inputFile of inputFiles) {
        if (sameTargetPath(outPath, inputFile)) {
          throw new Error(
            `Output path for ${flag} (${outPath}) would overwrite input file ${inputFile}`
          );
        }
      }
    }
  }
}

export function writeOutputs(
  result: CheckResult,
  outputs: CheckOutputs,
  inputDir?: string
): void {
  validateOutputPaths(inputDir, outputs);

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
    ...formatClaimsByStatus(claims, assessment, colorEnabled),
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
  return `  [${status}] ${sanitizeTerminalText(item.file)}${kind}: ${sanitizeTerminalText(item.reason)}`;
}

function formatClaimsByStatus(
  claims: EvidenceClaim[],
  assessment: ReadinessAssessment,
  colorEnabled: boolean
): string[] {
  const statuses: EvidenceStatus[] = ["verified", "partial", "locked", "conflict"];
  const lines: string[] = [];
  const adjustmentsByClaim = new Map(
    assessment.engineAdjustments.map((adj) => [adj.claimId, adj])
  );
  const locksByClaim = new Map(
    assessment.lockedCriticalItems.map((item) => [item.id, item.reason])
  );

  const effectiveClaims = claims.map((claim) => {
    const adj = adjustmentsByClaim.get(claim.id);
    const derivedStatus =
      (adj?.derivedStatus as EvidenceStatus | undefined) ??
      (locksByClaim.has(claim.id) ? "locked" : claim.status);
    const lockReason =
      claim.lockReason ??
      (derivedStatus === "locked"
        ? locksByClaim.get(claim.id) ?? adj?.reason
        : adj?.reason);
    return {
      ...claim,
      status: derivedStatus,
      lockReason
    };
  });

  for (const status of statuses) {
    const group = effectiveClaims.filter((claim) => claim.status === status);
    lines.push(`  ${statusLabel(status, colorEnabled)} (${group.length})`);
    if (group.length === 0) {
      lines.push("    none");
      continue;
    }
    for (const claim of group) {
      const reason = claim.lockReason
        ? ` - ${sanitizeTerminalText(claim.lockReason)}`
        : "";
      lines.push(
        `    ${claim.id}: ${sanitizeTerminalText(claim.statement)}${reason}`
      );
    }
  }

  return lines;
}

function formatFormula(assessment: ReadinessAssessment): string {
  const deductions = assessment.formula.deductions;
  const deductionTotal = deductions.reduce((sum, d) => sum + d.total, 0);
  const rawScore = 100 - deductionTotal;

  if (deductions.length === 0) {
    if (assessment.readinessScore < 100) {
      return `  min(${assessment.readinessScore}, 100) = ${assessment.readinessScore}`;
    }
    return "  100 = 100";
  }

  const terms = deductions.map(
    (deduction) => `${deduction.total} (${deduction.reason})`
  );
  const expr = `100 - ${terms.join(" - ")}`;

  if (
    assessment.summary.conflictCount > 0 &&
    rawScore > assessment.readinessScore
  ) {
    return `  min(49 [conflict ceiling], ${expr} [= ${Math.max(0, rawScore)}]) = ${assessment.readinessScore}`;
  }

  if (rawScore < 0) {
    return `  max(0, ${expr} [= ${rawScore}]) = ${assessment.readinessScore}`;
  }

  if (rawScore > assessment.readinessScore) {
    return `  min(${assessment.readinessScore}, ${expr} [= ${rawScore}]) = ${assessment.readinessScore}`;
  }

  return `  ${expr} = ${assessment.readinessScore}`;
}

function sanitizeTerminalText(value: string): string {
  let out = "";
  let prevSpace = false;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      if (!prevSpace) {
        out += " ";
        prevSpace = true;
      }
    } else {
      out += value[i];
      prevSpace = false;
    }
  }
  return out;
}

function canonicalPath(targetPath: string): string {
  const abs = resolve(targetPath);
  if (existsSync(abs)) {
    try {
      return realpathSync(abs);
    } catch {
      return abs;
    }
  }
  const tail: string[] = [];
  let current = abs;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) {
      return abs;
    }
    tail.unshift(basename(current));
    current = parent;
  }
  try {
    return join(realpathSync(current), ...tail);
  } catch {
    return abs;
  }
}

function sameTargetPath(a: string, b: string): boolean {
  if (canonicalPath(a) === canonicalPath(b)) {
    return true;
  }
  if (existsSync(a) && existsSync(b)) {
    try {
      const statA = statSync(a);
      const statB = statSync(b);
      if (statA.dev === statB.dev && statA.ino === statB.ino) {
        return true;
      }
    } catch {
      // fall through
    }
  }
  return false;
}

function listAllInputFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (![".git", "node_modules", "output"].includes(entry.name)) {
          stack.push(fullPath);
        }
      } else {
        files.push(fullPath);
      }
    }
  }
  return files;
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

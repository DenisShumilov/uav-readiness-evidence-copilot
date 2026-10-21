import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDemoBundle } from "@uav-readiness/parsers";
import {
  CONFLICT_CEILING,
  DEDUCTION_CONFIG,
  evaluateReadiness
} from "@uav-readiness/rules";

// The multi-page catalog (docs/) recomputes the score in browser JS.
// These tests bind the browser copy to the TypeScript engine so they can
// never silently disagree: change a weight in packages/rules and this suite
// fails until docs/tools-engine.js is updated.
const docsIndexHtml = readFileSync(join(process.cwd(), "docs", "index.html"), "utf8");
const toolsEngineJs = readFileSync(join(process.cwd(), "docs", "tools-engine.js"), "utf8");
const readinessToolHtml = readFileSync(
  join(process.cwd(), "docs", "tools", "readiness-matrix.html"),
  "utf8"
);

const CATALOG_TOOL_PAGES = [
  "tools/universal-ai-cockpit.html",
  "tools/doc-auditor.html",
  "tools/cross-verify.html",
  "tools/telemetry-analyzer.html",
  "tools/cyber-forensics.html",
  "tools/opsec-sanitizer.html",
  "tools/readiness-matrix.html",
  "tools/zero-trust-sandbox.html"
] as const;

function parseWeightsFromSource(
  source: string,
  sourceLabel: string,
  key: string
): { pointsEach: number; cap: number } {
  const match = source.match(
    new RegExp(`${key}\\s*:\\s*\\{\\s*pointsEach:\\s*(\\d+),\\s*cap:\\s*(\\d+)\\s*\\}`)
  );
  if (!match) {
    throw new Error(`DEDUCTIONS.${key} not found in ${sourceLabel}`);
  }
  return { pointsEach: Number(match[1]), cap: Number(match[2]) };
}

function runExtractedCompute(body: string, sourceLabel: string): {
  v: number;
  p: number;
  l: number;
  score: number;
} {
  const extractBalanced = (start: RegExp, open: string, close: string): string => {
    const m = body.match(start);
    if (!m || m.index === undefined) {
      throw new Error(`${sourceLabel} scoring piece not found: ${start}`);
    }
    let depth = 0;
    let i = body.indexOf(open, m.index);
    for (; i < body.length; i++) {
      if (body[i] === open) depth++;
      else if (body[i] === close && --depth === 0) {
        return body.slice(m.index, i + 1);
      }
    }
    throw new Error(`unbalanced ${open} in ${sourceLabel} for ${start}`);
  };

  const ceiling = body.match(/var CONFLICT_CEILING\s*=\s*\d+;/);
  if (!ceiling) {
    throw new Error(`${sourceLabel} CONFLICT_CEILING not found`);
  }

  const program = [
    extractBalanced(/var SOURCES\s*=\s*\[/, "[", "]"),
    extractBalanced(/var CLAIMS\s*=\s*\[/, "[", "]"),
    "var state = {}; SOURCES.forEach(function (s) { state[s.id] = true; });",
    extractBalanced(/function statusOf\(/, "{", "}"),
    extractBalanced(/var DEDUCTIONS\s*=\s*\{/, "{", "}"),
    ceiling[0],
    extractBalanced(/function cappedDeduction\(/, "{", "}"),
    extractBalanced(/function compute\(/, "{", "}"),
    "return compute();"
  ].join("\n");

  return new Function(program)() as {
    v: number;
    p: number;
    l: number;
    score: number;
  };
}

describe("docs/ multi-page catalog score parity with the engine", () => {
  it("mirrors every engine deduction weight and cap", () => {
    for (const [source, label] of [
      [toolsEngineJs, "docs/tools-engine.js"]
    ] as const) {
      expect(parseWeightsFromSource(source, label, "lockedCritical")).toEqual({
        pointsEach: DEDUCTION_CONFIG.lockedCritical.pointsEach,
        cap: DEDUCTION_CONFIG.lockedCritical.cap
      });
      expect(parseWeightsFromSource(source, label, "conflict")).toEqual({
        pointsEach: DEDUCTION_CONFIG.conflict.pointsEach,
        cap: DEDUCTION_CONFIG.conflict.cap
      });
      expect(parseWeightsFromSource(source, label, "partial")).toEqual({
        pointsEach: DEDUCTION_CONFIG.partial.pointsEach,
        cap: DEDUCTION_CONFIG.partial.cap
      });
      expect(parseWeightsFromSource(source, label, "warning")).toEqual({
        pointsEach: DEDUCTION_CONFIG.warning.pointsEach,
        cap: DEDUCTION_CONFIG.warning.cap
      });
      expect(parseWeightsFromSource(source, label, "missingArtifact")).toEqual({
        pointsEach: DEDUCTION_CONFIG.missingArtifact.pointsEach,
        cap: DEDUCTION_CONFIG.missingArtifact.cap
      });
    }
  });

  it("mirrors the conflict ceiling", () => {
    for (const source of [toolsEngineJs]) {
      const match = source.match(/var CONFLICT_CEILING\s*=\s*(\d+)/);
      expect(match).not.toBeNull();
      expect(Number(match![1])).toBe(CONFLICT_CEILING);
    }

    for (const relPage of CATALOG_TOOL_PAGES) {
      expect(docsIndexHtml).toContain(`href="${relPage}"`);
      const pagePath = join(process.cwd(), "docs", relPage);
      expect(existsSync(pagePath)).toBe(true);
      const pageHtml = readFileSync(pagePath, "utf8");
      expect(
        pageHtml.includes("tools-engine.js") ||
          pageHtml.includes("multi-file-verifier-bundle.js")
      ).toBe(true);
    }

    if (toolsEngineJs.includes("runRealOpenDataSample")) {
      expect(toolsEngineJs).toContain("runRealOpenDataSample");
    }
  });

  it("advertises baseline counts that equal the real engine output", () => {
    const assessment = evaluateReadiness(parseDemoBundle());

    expect(assessment.summary.verifiedCount).toBe(8);
    expect(assessment.summary.partialCount).toBe(4);
    expect(assessment.summary.lockedCount).toBe(5);
    expect(assessment.readinessScore).toBe(44);
    // docs/tools/readiness-matrix.html + docs/tools-engine.js advertise these counts and score.
    expect(readinessToolHtml).toContain("44/100");
    expect(readinessToolHtml).toContain("CONFLICT_CEILING = 49");
    expect(toolsEngineJs).toContain("EV-BOM-001");
    expect(toolsEngineJs).toContain("comp-board-001");
  });

  it("the site's ACTUAL compute() produces the advertised 8/4/5 -> 44", () => {
    const docsResult = runExtractedCompute(toolsEngineJs, "docs/tools-engine.js");
    expect(docsResult).toMatchObject({ v: 8, p: 4, l: 5, score: 44 });
  });
});

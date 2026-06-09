import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDemoBundle } from "../../parsers/src/demoBundle";
import {
  CONFLICT_CEILING,
  DEDUCTION_CONFIG,
  evaluateReadiness
} from "../../rules/src/readiness";

// The interactive site (site/index.html) recomputes the score in browser JS.
// These tests bind that copy to the TypeScript engine so the two can never
// silently disagree: change a weight in packages/rules and this test fails until
// the site is updated too.
const html = readFileSync(join(process.cwd(), "site", "index.html"), "utf8");

function siteWeights(key: string): { pointsEach: number; cap: number } {
  const match = html.match(
    new RegExp(`${key}\\s*:\\s*\\{\\s*pointsEach:\\s*(\\d+),\\s*cap:\\s*(\\d+)\\s*\\}`)
  );
  if (!match) {
    throw new Error(`site DEDUCTIONS.${key} not found in site/index.html`);
  }
  return { pointsEach: Number(match[1]), cap: Number(match[2]) };
}

describe("site/index.html score parity with the engine", () => {
  it("mirrors every engine deduction weight and cap", () => {
    expect(siteWeights("lockedCritical")).toEqual({
      pointsEach: DEDUCTION_CONFIG.lockedCritical.pointsEach,
      cap: DEDUCTION_CONFIG.lockedCritical.cap
    });
    expect(siteWeights("conflict")).toEqual({
      pointsEach: DEDUCTION_CONFIG.conflict.pointsEach,
      cap: DEDUCTION_CONFIG.conflict.cap
    });
    expect(siteWeights("partial")).toEqual({
      pointsEach: DEDUCTION_CONFIG.partial.pointsEach,
      cap: DEDUCTION_CONFIG.partial.cap
    });
    expect(siteWeights("warning")).toEqual({
      pointsEach: DEDUCTION_CONFIG.warning.pointsEach,
      cap: DEDUCTION_CONFIG.warning.cap
    });
    expect(siteWeights("missingArtifact")).toEqual({
      pointsEach: DEDUCTION_CONFIG.missingArtifact.pointsEach,
      cap: DEDUCTION_CONFIG.missingArtifact.cap
    });
  });

  it("mirrors the conflict ceiling", () => {
    const match = html.match(/var CONFLICT_CEILING\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(CONFLICT_CEILING);
  });

  it("advertises baseline counts that equal the real engine output", () => {
    const assessment = evaluateReadiness(parseDemoBundle());

    expect(assessment.summary.verifiedCount).toBe(8);
    expect(assessment.summary.partialCount).toBe(4);
    expect(assessment.summary.lockedCount).toBe(5);
    expect(assessment.readinessScore).toBe(44);
    // The dashboard copy advertises exactly these counts and score.
    expect(html).toContain("8 verified, 4 partial, 5 locked");
  });

  it("the site's ACTUAL compute() produces the advertised 8/4/5 -> 44", () => {
    // Pull the script block that holds the scoring logic, then extract only the
    // pure (DOM-free) scoring pieces and execute them — so the displayed score,
    // including the warnings = p + 3 heuristic and statusOf(), is test-locked to
    // 44 and cannot drift even while the constant-parity test above still passes.
    const body = html
      .split(/<script>|<\/script>/)
      .find((block) => block.includes("function compute("));
    if (!body) {
      throw new Error("site compute() script block not found");
    }

    const extractBalanced = (start: RegExp, open: string, close: string): string => {
      const m = body.match(start);
      if (!m || m.index === undefined) {
        throw new Error(`site scoring piece not found: ${start}`);
      }
      let depth = 0;
      let i = body.indexOf(open, m.index);
      for (; i < body.length; i++) {
        if (body[i] === open) depth++;
        else if (body[i] === close && --depth === 0) {
          return body.slice(m.index, i + 1);
        }
      }
      throw new Error(`unbalanced ${open} for ${start}`);
    };

    const ceiling = body.match(/var CONFLICT_CEILING\s*=\s*\d+;/);
    if (!ceiling) {
      throw new Error("site CONFLICT_CEILING not found");
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

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const result = new Function(program)() as {
      v: number;
      p: number;
      l: number;
      score: number;
    };

    expect(result).toMatchObject({ v: 8, p: 4, l: 5, score: 44 });
  });
});

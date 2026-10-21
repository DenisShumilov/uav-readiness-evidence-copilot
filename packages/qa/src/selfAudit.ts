import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deriveEvidenceStatuses,
  evaluateReadiness,
  scoreFromCounts,
  type DerivableClaim,
  type DerivableQaItem,
  type DerivableSource
} from "@uav-readiness/rules";
import { parseDemoBundle } from "@uav-readiness/parsers";

/**
 * Self-audit: point the REAL engine at this repo's own documentation.
 *
 * Unlike the synthetic demo bundles (whose reviewer labels were authored to
 * already agree with the engine), these checks run on real, non-operational
 * repo content the engine did NOT author. Each doc claim is asserted "verified"
 * (the docs state it confidently); the engine independently grades it from a
 * real check (does the documented number match the engine's own output? does a
 * bilingual twin exist? does a referenced asset/link resolve?) and OVERRIDES the
 * claim to locked when reality disagrees. A clean repo scores ~100 with zero
 * overrides — an honest result that becomes a CI-enforced anti-drift guard.
 * Documentation QA only; no operational data is read.
 */

export type SelfAuditCheck = {
  id: string;
  description: string;
  /** outcome check: the engine grades a real pass/fail comparison */
  outcome?: "pass" | "fail";
  /** existence check: does the referenced evidence resolve? */
  hasEvidence?: boolean;
  detail: string;
};

export type SelfAuditResult = {
  documentationReadinessScore: number;
  summary: {
    total: number;
    verified: number;
    partial: number;
    locked: number;
    conflict: number;
    engineAdjustedCount: number;
  };
  checks: Array<{
    id: string;
    description: string;
    asserted: "verified";
    derived: string;
    ok: boolean;
    detail: string;
  }>;
  overrides: Array<{ id: string; from: string; to: string; reason: string }>;
};

const CHECK_SOURCE_PREFIX = "selfaudit.src.";

/** Pure: turn real checks into evidence and run the real derivation + score. */
export function scoreSelfAudit(checks: SelfAuditCheck[]): SelfAuditResult {
  if (checks.length === 0) {
    return {
      documentationReadinessScore: 0,
      summary: {
        total: 0,
        verified: 0,
        partial: 0,
        locked: 0,
        conflict: 0,
        engineAdjustedCount: 0
      },
      checks: [],
      overrides: []
    };
  }

  const claims: DerivableClaim[] = [];
  const sources: DerivableSource[] = [];
  const qaItems: DerivableQaItem[] = [];

  for (const check of checks) {
    const claimId = `claim.selfaudit.${check.id}`;
    if (check.outcome) {
      // Graded by a real logged outcome — reuses the engine's test_outcome rule:
      // a documented claim whose check FAILS is overridden from verified -> locked.
      const sourceId = `${CHECK_SOURCE_PREFIX}${check.id}`;
      sources.push({ id: sourceId });
      claims.push({
        id: claimId,
        status: "verified",
        claimType: "test_record",
        evidenceSourceIds: [sourceId]
      });
      qaItems.push({
        status: check.outcome === "pass" ? "pass" : "fail",
        evidenceClaimIds: [claimId]
      });
    } else {
      // Existence check — reuses the engine's no-evidence rule: a documented
      // claim with no resolvable evidence is overridden from verified -> locked.
      const hasEvidence = check.hasEvidence === true;
      const sourceId = `${CHECK_SOURCE_PREFIX}${check.id}`;
      if (hasEvidence) {
        sources.push({ id: sourceId });
      }
      claims.push({
        id: claimId,
        status: "verified",
        claimType: "config_documentation",
        evidenceSourceIds: hasEvidence ? [sourceId] : []
      });
    }
  }

  const derived = deriveEvidenceStatuses(claims, sources, qaItems);
  const byClaim = new Map(derived.map((d) => [d.claimId, d]));

  const count = (status: string) =>
    derived.filter((d) => d.derivedStatus === status).length;
  const lockedCount = count("locked");
  const partialCount = count("partial");
  const conflictCount = count("conflict");
  const overrides = derived.filter((d) => d.changed);

  const { score } = scoreFromCounts({
    partialCount,
    lockedCriticalCount: lockedCount,
    warningCount: overrides.length,
    missingArtifactCount: 0,
    conflictCount
  });

  return {
    documentationReadinessScore: score,
    summary: {
      total: derived.length,
      verified: count("verified"),
      partial: partialCount,
      locked: lockedCount,
      conflict: conflictCount,
      engineAdjustedCount: overrides.length
    },
    checks: checks.map((check) => {
      const d = byClaim.get(`claim.selfaudit.${check.id}`)!;
      return {
        id: check.id,
        description: check.description,
        asserted: "verified" as const,
        derived: d.derivedStatus,
        ok: d.derivedStatus === "verified",
        detail: check.detail
      };
    }),
    overrides: overrides.map((o) => ({
      id: o.claimId.replace("claim.selfaudit.", ""),
      from: o.assertedStatus,
      to: o.derivedStatus,
      reason: o.reason
    }))
  };
}

/** Gather REAL checks from the repo (engine output vs prose, twins, links, assets). */
export function gatherSelfAuditChecks(repoRoot = process.cwd()): SelfAuditCheck[] {
  const read = (rel: string) =>
    existsSync(join(repoRoot, rel)) ? readFileSync(join(repoRoot, rel), "utf8") : "";
  const checks: SelfAuditCheck[] = [];

  // 1. Documented demo scores must equal what the engine actually computes.
  const demos: Array<{
    id: string;
    dir: string;
    doc: string;
    marker: string;
  }> = [
    {
      id: "score-readiness",
      dir: "examples/demo-uav-readiness",
      doc: "docs/scoring.en.md",
      marker: "demo-uav-readiness"
    },
    {
      id: "score-maintenance",
      dir: "examples/demo-maintenance-readiness",
      doc: "README.md",
      marker: "examples/demo-maintenance-readiness"
    },
    {
      id: "score-conflict",
      dir: "examples/demo-conflict-readiness",
      doc: "README.md",
      marker: "examples/demo-conflict-readiness"
    },
    {
      id: "score-tdp",
      dir: "examples/demo-tdp-supplier-package",
      doc: "README.md",
      marker: "examples/demo-tdp-supplier-package"
    }
  ];
  for (const demo of demos) {
    const demoPath = join(repoRoot, demo.dir);
    let score: number | undefined;
    try {
      score = evaluateReadiness(parseDemoBundle(demoPath)).readinessScore;
    } catch {
      score = undefined;
    }
    const docText = read(demo.doc);
    const stated =
      score !== undefined && statesDemoScore(docText, demo.doc, demo.marker, score);
    checks.push({
      id: demo.id,
      description: `${demo.dir} score ${score ?? "unparseable"}/100 is stated in ${demo.doc}`,
      outcome: stated ? "pass" : "fail",
      detail: stated
        ? `engine computes ${score}/100 and ${demo.doc} states it for ${demo.marker}`
        : `engine computes ${score ?? "unparseable"}/100 but ${demo.doc} does not state it for ${demo.marker} (stale docs)`
    });
  }

  // 2. Formal JSON Schemas must exist on disk and parse as valid JSON objects.
  const schemaFiles = [
    "schemas/evidence-graph.schema.json",
    "schemas/readiness-assessment.schema.json"
  ];
  const invalidSchemas = schemaFiles.filter((rel) => {
    const raw = read(rel);
    if (!raw) return true;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return typeof parsed !== "object" || parsed === null || !("$schema" in parsed);
    } catch {
      return true;
    }
  });
  checks.push({
    id: "schemas-valid",
    description: "formal JSON Schema files exist and parse cleanly",
    hasEvidence: invalidSchemas.length === 0,
    detail:
      invalidSchemas.length === 0
        ? "all JSON schemas present and valid"
        : `missing or invalid schema: ${invalidSchemas.join(", ")}`
  });

  // 3. All 8 catalog tool pages in docs/tools/*.html must exist on disk.
  const catalogToolPages = [
    "docs/tools/universal-ai-cockpit.html",
    "docs/tools/doc-auditor.html",
    "docs/tools/cross-verify.html",
    "docs/tools/telemetry-analyzer.html",
    "docs/tools/cyber-forensics.html",
    "docs/tools/opsec-sanitizer.html",
    "docs/tools/readiness-matrix.html",
    "docs/tools/zero-trust-sandbox.html"
  ];
  const missingToolPages = catalogToolPages.filter(
    (rel) => !existsSync(join(repoRoot, rel))
  );
  checks.push({
    id: "catalog-tools-exist",
    description: "all 8 interactive catalog tool pages exist in docs/tools/",
    hasEvidence: missingToolPages.length === 0,
    detail:
      missingToolPages.length === 0
        ? "all 8 catalog tool pages present"
        : `missing tool pages: ${missingToolPages.join(", ")}`
  });

  // 4. Every docs/<name>.md has an English twin <name>.en.md and vice versa.
  const docsDir = join(repoRoot, "docs");
  const docFiles = existsSync(docsDir)
    ? readdirSync(docsDir).filter((f) => f.endsWith(".md"))
    : [];
  const missingTwins = docFiles.filter((f) => {
    const twin = f.endsWith(".en.md")
      ? f.replace(/\.en\.md$/, ".md")
      : f.replace(/\.md$/, ".en.md");
    return !docFiles.includes(twin);
  });
  checks.push({
    id: "bilingual-twins",
    description: "every docs/*.md has its bilingual twin",
    hasEvidence: missingTwins.length === 0,
    detail: missingTwins.length === 0 ? "all twins present" : `missing: ${missingTwins.join(", ")}`
  });

  // 5. Referenced social card asset resolves and is a valid PNG image.
  const assets = [
    "docs/social-card.png"
  ];
  const invalidAssets = assets.filter((a) => !isValidPngAsset(join(repoRoot, a)));
  checks.push({
    id: "referenced-assets",
    description: "README/site referenced assets exist on disk",
    hasEvidence: invalidAssets.length === 0,
    detail:
      invalidAssets.length === 0
        ? "all assets present and valid PNGs"
        : `missing or invalid PNG: ${invalidAssets.join(", ")}`
  });

  // 6. Release-download tags in the live site must not drift from README.md (including when both are 0 / videos removed).
  const readmeReleaseTags = releaseTags(read("README.md"));
  const siteReleaseTags = releaseTags(read("docs/index.html"));
  const readmeTagSet = new Set(readmeReleaseTags);
  const siteTagSet = new Set(siteReleaseTags);
  const tagsMatch =
    readmeTagSet.size === siteTagSet.size &&
    [...siteTagSet].every((tag) => readmeTagSet.has(tag)) &&
    [...readmeTagSet].every((tag) => siteTagSet.has(tag));
  checks.push({
    id: "site-release-tags",
    description: "site release-download tags match README.md release tags",
    outcome: tagsMatch ? "pass" : "fail",
    detail: tagsMatch
      ? `release tag(s): ${[...siteTagSet].join(", ") || "none (videos removed)"}`
      : `README.md tags: ${[...readmeTagSet].join(", ") || "none"}; site tags: ${[...siteTagSet].join(", ") || "none"}`
  });

  // 7. README test count must be derived from the real Vitest suite, not guessed.
  const testCount = countVitestCases(repoRoot);
  const readmeTestCount =
    documentedCount(read("README.md"), "тестів") ??
    documentedCount(read("README.md"), "tests");
  const readmeUkTestCount =
    documentedCount(read("README.uk.md"), "тестів") ??
    documentedCount(read("README.uk.md"), "tests");
  const readmeEnTestCount =
    documentedCount(read("README.en.md"), "tests") ??
    documentedCount(read("README.en.md"), "тестів");
  const testsMatch =
    readmeTestCount === testCount &&
    readmeUkTestCount === testCount &&
    readmeEnTestCount === testCount;
  checks.push({
    id: "count-tests",
    description: `README by-the-numbers strip states ${testCount} tests`,
    outcome: testsMatch ? "pass" : "fail",
    detail: testsMatch
      ? `derived Vitest test cases: ${testCount}`
      : `derived Vitest test cases: ${testCount}; README.md states ${readmeTestCount ?? "none"}; README.uk.md states ${readmeUkTestCount ?? "none"}; README.en.md states ${readmeEnTestCount ?? "none"}`
  });

  // 8. Root bilingual READMEs (README.md, README.uk.md, README.en.md) must exist and be non-empty.
  const rootReadmeFiles = ["README.md", "README.uk.md", "README.en.md"];
  const missingRootReadmes = rootReadmeFiles.filter(
    (rel) => read(rel).trim().length < 200
  );
  checks.push({
    id: "readme-bilingual-root",
    description: "root README.md, README.uk.md, and README.en.md exist and are substantive",
    hasEvidence: missingRootReadmes.length === 0,
    detail:
      missingRootReadmes.length === 0
        ? "all 3 root README files present and substantive"
        : `missing or stub root README: ${missingRootReadmes.join(", ")}`
  });

  // 9. No phantom engine paths (opsec_sanitizer.py, prozorro_radar.py, hil_simulator.py, #capsule=) in docs.
  const mdFilesToScan = [
    ...rootReadmeFiles,
    ...docFiles.map((f) => `docs/${f}`)
  ];
  const phantomPattern =
    /\b(?:opsec_sanitizer\.py|prozorro_radar\.py|hil_simulator\.py)\b|#capsule=/i;
  const filesWithPhantoms = mdFilesToScan.filter((rel) =>
    phantomPattern.test(read(rel))
  );
  checks.push({
    id: "no-phantom-engine-paths",
    description: "no phantom engine filenames or legacy #capsule= anchors in README*.md and docs/*.md",
    outcome: filesWithPhantoms.length === 0 ? "pass" : "fail",
    detail:
      filesWithPhantoms.length === 0
        ? "zero phantom paths or legacy #capsule= anchors found"
        : `found phantom references in: ${filesWithPhantoms.join(", ")}`
  });

  // 10. Commercial pilot honesty: no "2–3 дні" / "2-3 days" promises and all 4 KPI formulas present.
  const pilotSurfaces = [
    "README.md",
    "README.uk.md",
    "README.en.md",
    "docs/architecture.md",
    "docs/architecture.en.md",
    "docs/index.html",
    "docs/tools/universal-ai-cockpit.html"
  ];
  const forbiddenPilotPattern = /2[–-]3\s*(?:дн|day)/i;
  const surfacesWithForbiddenPilot = pilotSurfaces.filter((rel) =>
    forbiddenPilotPattern.test(read(rel))
  );
  const kpiRequiredSurfaces = [
    "README.md",
    "README.en.md",
    "docs/index.html",
    "docs/tools/universal-ai-cockpit.html"
  ];
  const missingKpiFormulas = kpiRequiredSurfaces.filter((rel) => {
    const txt = read(rel);
    return (
      !txt.includes("TP / (TP + FN)") ||
      !txt.includes("FP / (TP + FP)") ||
      !txt.includes("UNVERIFIED / Total") ||
      !txt.includes("T_before")
    );
  });
  const pilotHonest =
    surfacesWithForbiddenPilot.length === 0 && missingKpiFormulas.length === 0;
  checks.push({
    id: "commercial-pilot-honesty",
    description: "no 2-3 day pilot promises and all 4 hold-out KPI formulas are stated",
    outcome: pilotHonest ? "pass" : "fail",
    detail: pilotHonest
      ? "zero 2-3 day promises and all 4 KPI formulas present across surfaces"
      : `forbidden pilot text in: [${surfacesWithForbiddenPilot.join(", ")}]; missing KPI formulas in: [${missingKpiFormulas.join(", ")}]`
  });

  return checks;
}

export function runSelfAudit(repoRoot = process.cwd()): SelfAuditResult {
  return scoreSelfAudit(gatherSelfAuditChecks(repoRoot));
}

function releaseTags(text: string): string[] {
  return [...text.matchAll(/releases\/download\/([^/]+)/g)].map(
    (match) => match[1]
  );
}

function documentedCount(text: string, label: string): number | undefined {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`\\*\\*(\\d+)\\*\\* ${escapedLabel}`));
  return match ? Number(match[1]) : undefined;
}

function statesDemoScore(
  docText: string,
  docName: string,
  marker: string,
  score: number
): boolean {
  if (!docText || !docText.includes(marker)) {
    return false;
  }
  const scorePattern = new RegExp(`(?:^|\\D)${score}\\s*/\\s*100(?:\\D|$)`);
  const lines = docText.split(/\r?\n/);
  if (docName === "README.md") {
    return lines.some(
      (line) => line.includes(marker) && scorePattern.test(line)
    );
  }
  return lines.some((line) => scorePattern.test(line));
}

function isValidPngAsset(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }
  try {
    const buf = readFileSync(filePath);
    return (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  } catch {
    return false;
  }
}

function countVitestCases(repoRoot: string): number {
  const packagesRoot = join(repoRoot, "packages");
  if (!existsSync(packagesRoot)) {
    return 0;
  }
  return listTestFiles(packagesRoot)
    .map((file) => readFileSync(file, "utf8"))
    .reduce((total, text) => total + countTestCasesInText(text), 0);
}

function countTestCasesInText(rawText: string): number {
  const text = stripComments(rawText);
  const normalCases = [...text.matchAll(/(^|[^\w.])(?:it|test)\s*\(/gm)].length;
  const eachCases = [...text.matchAll(/(^|[^\w.])(?:it|test)\.each\((\w+)\)/gm)]
    .reduce((total, match) => total + countConstArrayItems(text, match[2]), 0);

  return normalCases + eachCases;
}

function stripComments(text: string): string {
  let out = "";
  let i = 0;
  let mode: "code" | "line" | "block" | "single" | "double" | "template" =
    "code";

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (mode === "line") {
      if (ch === "\n") {
        out += "\n";
        mode = "code";
      }
      i += 1;
      continue;
    }

    if (mode === "block") {
      if (ch === "*" && next === "/") {
        i += 2;
        mode = "code";
        continue;
      }
      if (ch === "\n") {
        out += "\n";
      }
      i += 1;
      continue;
    }

    if (mode === "single" || mode === "double" || mode === "template") {
      const quote =
        mode === "single" ? "'" : mode === "double" ? '"' : "`";
      if (ch === "\\") {
        out += text.slice(i, i + 2);
        i += 2;
        continue;
      }
      out += ch;
      if (ch === quote) {
        mode = "code";
      }
      i += 1;
      continue;
    }

    if (ch === "/" && next === "/") {
      mode = "line";
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      mode = "block";
      i += 2;
      continue;
    }
    if (ch === "'") {
      mode = "single";
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      mode = "double";
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "`") {
      mode = "template";
      out += ch;
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function countConstArrayItems(text: string, name: string): number {
  const match = text.match(
    new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*(?:as\\s+const)?\\s*;`)
  );
  if (!match) {
    return 1;
  }

  return [...match[1].matchAll(/(["'`])(?:(?!\1).)+\1/g)].length;
}

function listTestFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if ([".git", "node_modules", "output", "coverage", "dist"].includes(entry.name)) {
        continue;
      }

      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".test.ts")) {
        files.push(path);
      }
    }
  }

  return files.sort();
}

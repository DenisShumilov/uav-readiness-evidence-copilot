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
  const demos: Array<{ id: string; dir: string; doc: string }> = [
    { id: "score-readiness", dir: "examples/demo-uav-readiness", doc: "docs/scoring.en.md" },
    { id: "score-maintenance", dir: "examples/demo-maintenance-readiness", doc: "README.md" },
    { id: "score-conflict", dir: "examples/demo-conflict-readiness", doc: "README.md" },
    { id: "score-tdp", dir: "examples/demo-tdp-supplier-package", doc: "README.md" }
  ];
  for (const demo of demos) {
    const score = evaluateReadiness(
      parseDemoBundle(join(repoRoot, demo.dir))
    ).readinessScore;
    const docText = read(demo.doc);
    const stated = docText.includes(`${score}/100`);
    checks.push({
      id: demo.id,
      description: `${demo.dir} score ${score}/100 is stated in ${demo.doc}`,
      outcome: stated ? "pass" : "fail",
      detail: stated
        ? `engine computes ${score}/100 and the docs say so`
        : `engine computes ${score}/100 but ${demo.doc} does not state it (stale docs)`
    });
  }

  // 2. Documented scaffold counts must equal the real file counts.
  const agentDir = join(repoRoot, "meta/ai-workflows/.claude/agents");
  const skillDir = join(repoRoot, "meta/ai-workflows/.claude/skills");
  const agentCount = existsSync(agentDir)
    ? readdirSync(agentDir).filter((f) => f.endsWith(".md")).length
    : 0;
  const skillCount = existsSync(skillDir)
    ? readdirSync(skillDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length
    : 0;
  const scaffold = read("docs/scaffold.en.md");
  for (const [id, label, real] of [
    ["count-agents", "agents", agentCount],
    ["count-skills", "skills", skillCount]
  ] as const) {
    const stated = scaffold.includes(`${real} ${label}`) || scaffold.includes(`${real} specialist agents`);
    checks.push({
      id,
      description: `docs/scaffold claims ${real} ${label} and ${real} files exist`,
      outcome: stated ? "pass" : "fail",
      detail: `real ${label} files: ${real}; docs state it: ${stated}`
    });
  }

  // 3. Every docs/<name>.md has an English twin <name>.en.md and vice versa.
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

  // 4. Referenced hero + social assets resolve.
  const assets = ["docs/assets/hero-dashboard.png", "site/social-card.png"];
  const missingAssets = assets.filter((a) => !existsSync(join(repoRoot, a)));
  checks.push({
    id: "referenced-assets",
    description: "README/site referenced assets exist on disk",
    hasEvidence: missingAssets.length === 0,
    detail: missingAssets.length === 0 ? "all assets present" : `missing: ${missingAssets.join(", ")}`
  });

  // 5. Release-download tags in the live site must not drift from README.md.
  const readmeReleaseTags = releaseTags(read("README.md"));
  const siteReleaseTags = releaseTags(read("site/index.html"));
  const readmeTagSet = new Set(readmeReleaseTags);
  const siteTagSet = new Set(siteReleaseTags);
  const tagsMatch =
    readmeTagSet.size > 0 &&
    siteTagSet.size > 0 &&
    [...siteTagSet].every((tag) => readmeTagSet.has(tag)) &&
    [...readmeTagSet].every((tag) => siteTagSet.has(tag));
  checks.push({
    id: "site-release-tags",
    description: "site release-download tags match README.md release tags",
    outcome: tagsMatch ? "pass" : "fail",
    detail: tagsMatch
      ? `release tag(s): ${[...siteTagSet].join(", ")}`
      : `README.md tags: ${[...readmeTagSet].join(", ") || "none"}; site tags: ${[...siteTagSet].join(", ") || "none"}`
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

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EvidenceClaimSchema,
  EvidenceSourceSchema,
  QAItemSchema,
  type EvidenceClaim,
  type EvidenceSource,
  type QAItem
} from "@uav-readiness/core";
import { parseDemoBundle } from "@uav-readiness/parsers";
import { deriveEvidenceStatuses } from "./deriveStatus";
import { evaluateReadiness } from "./readiness";

const DEMO_DIRS = [
  "demo-uav-readiness",
  "demo-maintenance-readiness",
  "demo-conflict-readiness",
  "demo-tdp-supplier-package"
];

function source(id: string): EvidenceSource {
  return EvidenceSourceSchema.parse({
    id,
    artifactId: "artifact.test",
    label: `source ${id}`,
    sourceType: "log",
    excerpt: "synthetic excerpt",
    confidence: "high",
    synthetic: true
  });
}

function claim(
  overrides: Partial<EvidenceClaim> & {
    id: string;
    status: EvidenceClaim["status"];
  }
): EvidenceClaim {
  return EvidenceClaimSchema.parse({
    statement: "synthetic claim",
    claimType: "test_record",
    evidenceSourceIds: [],
    ...overrides
  });
}

function qa(claimId: string, status: QAItem["status"]): QAItem {
  return QAItemSchema.parse({
    id: `qa.${claimId.replace(/[^a-z0-9]/gi, "-")}`,
    question: "synthetic check",
    status,
    evidenceClaimIds: [claimId],
    ownerRole: "QA reviewer"
  });
}

describe("deriveEvidenceStatuses (engine derives status from evidence, not the label)", () => {
  it("overrides a reviewer 'verified' when the logged test outcome failed", () => {
    const c = claim({ id: "claim.t1", status: "verified", evidenceSourceIds: ["ev-1"] });
    const [derived] = deriveEvidenceStatuses([c], [source("ev-1")], [qa("claim.t1", "fail")]);

    expect(derived.assertedStatus).toBe("verified");
    expect(derived.derivedStatus).toBe("locked");
    expect(derived.derivation).toBe("test_outcome");
    expect(derived.changed).toBe(true);
    expect(derived.reason).toContain("Locked by fail test outcome");
  });

  it("downgrades 'verified' to 'partial' when the test result is not a pass (not_tested)", () => {
    const c = claim({ id: "claim.t2", status: "verified", evidenceSourceIds: ["ev-1"] });
    const [derived] = deriveEvidenceStatuses([c], [source("ev-1")], [qa("claim.t2", "not_tested")]);

    expect(derived.derivedStatus).toBe("partial");
    expect(derived.changed).toBe(true);
  });

  it("locks a claim whose evidence reference does not resolve (dangling)", () => {
    const c = claim({
      id: "claim.d1",
      status: "verified",
      claimType: "component_record",
      evidenceSourceIds: ["ev-missing"]
    });
    // No source with id "ev-missing" is supplied.
    const [derived] = deriveEvidenceStatuses([c], [source("ev-present")], []);

    expect(derived.derivedStatus).toBe("locked");
    expect(derived.derivation).toBe("dangling_evidence");
    expect(derived.changed).toBe(true);
  });

  it("never INFLATES: a passing test cannot raise a reviewer's 'partial'", () => {
    const c = claim({ id: "claim.t3", status: "partial", evidenceSourceIds: ["ev-1"] });
    const [derived] = deriveEvidenceStatuses([c], [source("ev-1")], [qa("claim.t3", "pass")]);

    expect(derived.derivedStatus).toBe("partial");
    expect(derived.changed).toBe(false);
  });

  it("preserves an asserted or cross-check conflict conservatively even with missing sources", () => {
    const c = claim({
      id: "claim.crosscheck.training-manual",
      status: "conflict",
      claimType: "config_documentation",
      evidenceSourceIds: ["ev-1", "ev-2"],
      lockReason: "documents disagree"
    });
    const [derived] = deriveEvidenceStatuses([c], [source("ev-1"), source("ev-2")], []);

    expect(derived.derivedStatus).toBe("conflict");
    expect(derived.derivation).toBe("verbatim");
    expect(derived.reason).toContain("Asserted conflict preserved conservatively");

    const conflictWithMissing = claim({
      id: "claim.doc-1",
      status: "conflict",
      claimType: "component_record",
      evidenceSourceIds: ["ev-1", "ev-missing"]
    });
    const [derivedMissing] = deriveEvidenceStatuses([conflictWithMissing], [source("ev-1")], []);
    expect(derivedMissing.derivedStatus).toBe("conflict");
    expect(derivedMissing.derivation).toBe("verbatim");
    expect(derivedMissing.reason).toContain("missing evidence source(s): ev-missing");
  });

  it("prioritizes failing test outcome (locked) over partial missing evidence", () => {
    const c = claim({
      id: "claim.t-compound",
      status: "verified",
      evidenceSourceIds: ["ev-1", "ev-missing"]
    });
    const [derived] = deriveEvidenceStatuses(
      [c],
      [source("ev-1")],
      [qa("claim.t-compound", "fail")]
    );

    expect(derived.derivedStatus).toBe("locked");
    expect(derived.derivation).toBe("test_outcome");
    expect(derived.reason).toContain("Locked by fail test outcome");
    expect(derived.reason).toContain("missing evidence source(s): ev-missing");
  });

  it("preserves asserted locked status when partial sources are missing", () => {
    const c = claim({
      id: "claim.locked-with-source",
      status: "locked",
      evidenceSourceIds: ["ev-1", "ev-missing"],
      lockReason: "Explicit reviewer lock"
    });
    const [derived] = deriveEvidenceStatuses(
      [c],
      [source("ev-1")],
      [qa("claim.locked-with-source", "not_tested")]
    );

    expect(derived.derivedStatus).toBe("locked");
    expect(derived.derivation).toBe("dangling_evidence");
    expect(derived.reason).toContain("Asserted locked status preserved");
    expect(derived.reason).toContain("missing evidence source(s): ev-missing");
  });
});

describe("derivation reproduces the demo verdicts (numbers are derived, not coincidental)", () => {
  it.each(DEMO_DIRS)("derived status equals the reviewer label for every claim in %s", (dir) => {
    const bundle = parseDemoBundle(join(process.cwd(), "examples", dir));
    const derived = deriveEvidenceStatuses(
      bundle.evidenceClaims,
      bundle.evidenceSources,
      bundle.qaItems
    );

    // The demo fixtures are internally consistent, so the engine independently
    // arrives at exactly the reviewer's verdict — which is WHY 44/80/49 hold.
    for (const entry of derived) {
      expect(entry.derivedStatus, `${entry.claimId}`).toBe(entry.assertedStatus);
    }
    expect(evaluateReadiness(bundle).summary.engineAdjustedCount).toBe(0);
  });
});

describe("evaluateReadiness end-to-end override", () => {
  it("drops the score and records an adjustment when a 'verified' check actually fails", () => {
    const bundle = parseDemoBundle();
    const tampered = {
      ...bundle,
      qaItems: bundle.qaItems.map((item) =>
        item.status === "pass" ? { ...item, status: "fail" as const } : item
      )
    };

    const base = evaluateReadiness(bundle);
    const after = evaluateReadiness(tampered);

    expect(base.readinessScore).toBe(44);
    expect(base.engineAdjustments).toHaveLength(0);
    expect(after.engineAdjustments.length).toBeGreaterThan(0);
    expect(after.engineAdjustments.some((a) => a.derivedStatus === "locked")).toBe(true);
    expect(after.readinessScore).toBeLessThan(base.readinessScore);
  });
});

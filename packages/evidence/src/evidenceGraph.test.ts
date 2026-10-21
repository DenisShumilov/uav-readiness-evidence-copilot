import { describe, expect, it } from "vitest";
import { parseDemoBundle } from "@uav-readiness/parsers";
import { buildEvidenceGraphFromBundle } from "./evidenceGraph";

describe("buildEvidenceGraphFromBundle", () => {
  it("builds a deterministic evidence graph summary", () => {
    const bundle = parseDemoBundle();
    const built = buildEvidenceGraphFromBundle(
      bundle,
      "2026-06-06T00:00:00.000Z"
    );

    expect(built.evidenceGraph.synthetic).toBe(true);
    expect(built.summary.totalClaims).toBe(bundle.evidenceClaims.length);
    expect(built.summary.totalSources).toBe(bundle.evidenceSources.length);
    expect(built.summary.totalLocks).toBe(bundle.evidenceLocks.length);
    expect(built.summary.verifiedCount).toBeGreaterThan(0);
    expect(built.summary.partialCount).toBeGreaterThan(0);
    expect(built.summary.lockedCount).toBeGreaterThan(0);
  });

  it("does not invent links for locked claims without evidence", () => {
    const bundle = parseDemoBundle();
    const built = buildEvidenceGraphFromBundle(
      bundle,
      "2026-06-06T00:00:00.000Z"
    );
    const lockedClaimIds = new Set(
      built.evidenceClaims
        .filter((claim) => claim.status === "locked")
        .map((claim) => claim.id)
    );

    expect(
      built.evidenceGraph.links.some((link) => lockedClaimIds.has(link.claimId))
    ).toBe(false);
  });

  it("deduplicates evidence sources by id", () => {
    const bundle = parseDemoBundle();
    const duplicatedBundle = {
      ...bundle,
      evidenceSources: [...bundle.evidenceSources, bundle.evidenceSources[0]]
    };
    const built = buildEvidenceGraphFromBundle(
      duplicatedBundle,
      "2026-06-06T00:00:00.000Z"
    );

    expect(built.evidenceSources).toHaveLength(bundle.evidenceSources.length);
  });

  it("applies the status priority matrix and dynamic synthetic flag", () => {
    const bundle = parseDemoBundle();
    const nonSyntheticBundle = {
      ...bundle,
      artifacts: bundle.artifacts.map((a) => ({ ...a, synthetic: false })),
      evidenceSources: bundle.evidenceSources.map((s) => ({
        ...s,
        synthetic: false
      })),
      evidenceClaims: [
        ...bundle.evidenceClaims,
        {
          id: "claim.test.compound-fail",
          statement: "Compound check with missing source and failing test",
          claimType: "test_record" as const,
          status: "verified" as const,
          evidenceSourceIds: ["EV-BOM-001", "EV-MISSING-999"]
        }
      ],
      qaItems: [
        ...bundle.qaItems,
        {
          id: "qa.compound-fail",
          question: "Compound check fails",
          status: "fail" as const,
          evidenceClaimIds: ["claim.test.compound-fail"],
          ownerRole: "QA reviewer"
        }
      ]
    };

    const built = buildEvidenceGraphFromBundle(
      nonSyntheticBundle,
      "2026-06-06T00:00:00.000Z"
    );

    expect(built.evidenceGraph.synthetic).toBe(false);
    const compoundClaim = built.evidenceClaims.find(
      (c) => c.id === "claim.test.compound-fail"
    );
    expect(compoundClaim?.status).toBe("locked");
    expect(compoundClaim?.lockReason).toContain(
      "Locked by fail test outcome (qa.compound-fail)"
    );
  });
});

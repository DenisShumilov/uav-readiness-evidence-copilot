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
});

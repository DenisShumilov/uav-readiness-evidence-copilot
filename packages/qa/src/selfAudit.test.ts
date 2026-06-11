import { describe, expect, it } from "vitest";
import { runSelfAudit, scoreSelfAudit, type SelfAuditCheck } from "./selfAudit";

describe("self-audit runs the real engine on the repo's own real content", () => {
  it("scores the repo's documentation and stays consistent (CI anti-drift guard)", () => {
    const result = runSelfAudit();

    expect(result.summary.total).toBe(9);
    // The engine runs on REAL content it did not author. A clean repo scores 100
    // with zero overrides — and if a doc later drifts from the engine's own
    // output (a stale score, a missing twin, a dead asset), this fails on purpose.
    expect(result.documentationReadinessScore).toBe(100);
    expect(result.summary.engineAdjustedCount).toBe(0);
  });

  it("OVERRIDES a documented claim whose real check fails (catches drift)", () => {
    const checks: SelfAuditCheck[] = [
      { id: "good", description: "a backed claim", outcome: "pass", detail: "" },
      { id: "stale-number", description: "docs assert a stale score", outcome: "fail", detail: "" }
    ];
    const result = scoreSelfAudit(checks);

    expect(result.summary.engineAdjustedCount).toBe(1);
    expect(result.overrides[0]).toMatchObject({
      id: "stale-number",
      from: "verified",
      to: "locked"
    });
    expect(result.documentationReadinessScore).toBeLessThan(100);
  });

  it("OVERRIDES a documented existence claim with no resolvable evidence", () => {
    const result = scoreSelfAudit([
      { id: "missing-twin", description: "claims a twin that is absent", hasEvidence: false, detail: "" }
    ]);

    expect(result.checks[0]).toMatchObject({ derived: "locked", ok: false });
    expect(result.summary.engineAdjustedCount).toBe(1);
  });

  it("does not inflate: passing / existing claims stay verified", () => {
    const result = scoreSelfAudit([
      { id: "ok-outcome", description: "", outcome: "pass", detail: "" },
      { id: "ok-exists", description: "", hasEvidence: true, detail: "" }
    ]);

    expect(result.summary.verified).toBe(2);
    expect(result.summary.engineAdjustedCount).toBe(0);
    expect(result.documentationReadinessScore).toBe(100);
  });
});

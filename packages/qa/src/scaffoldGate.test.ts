import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The runtime scaffold gate wired into .claude/settings.json. These tests prove
// the "intelligence is in the scaffold" thesis is enforced at runtime (a tool
// call is actually blocked), not merely asserted in prose.
const hook = join(
  process.cwd(),
  "meta",
  "ai-workflows",
  "hooks",
  "scaffold-gate.mjs"
);

function runGate(
  toolInput: Record<string, string>,
  toolName = "Write"
): { status: number | null; stderr: string; log: string } {
  const logFile = join(
    mkdtempSync(join(tmpdir(), "scaffold-gate-")),
    "activity.log"
  );
  const result = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
    env: {
      ...process.env,
      SCAFFOLD_ACTIVITY_LOG: logFile,
      SCAFFOLD_FAKE_TS: "2026-01-01T00:00:00Z"
    },
    encoding: "utf8"
  });
  let log = "";
  try {
    log = readFileSync(logFile, "utf8");
  } catch {
    log = "";
  }
  return { status: result.status, stderr: result.stderr ?? "", log };
}

describe("scaffold-gate PreToolUse hook (runtime safety boundary)", () => {
  it("ALLOWS a documentation-QA edit and records it in the activity log", () => {
    const r = runGate({
      file_path: "docs/readiness.en.md",
      content: "Clarify the readiness scoring section."
    });

    expect(r.status).toBe(0);
    expect(r.log).toContain("\tALLOW\t");
  });

  it("DENIES a tool call that introduces operational UAV terminology", () => {
    const r = runGate({
      file_path: "docs/plan.md",
      content: "Add a mission route with waypoints and telemetry."
    });

    expect(r.status).toBe(2);
    expect(r.stderr).toContain("DENY");
    expect(r.stderr.toLowerCase()).toContain("safety boundary");
    expect(r.log).toContain("\tDENY\t");
  });

  it("DENIES a Bash command that references operational control", () => {
    const r = runGate({ command: "echo 'set payload targeting now'" }, "Bash");

    expect(r.status).toBe(2);
  });
});

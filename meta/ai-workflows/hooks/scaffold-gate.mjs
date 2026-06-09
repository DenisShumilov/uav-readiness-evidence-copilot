#!/usr/bin/env node
// PreToolUse scaffold gate for the UAV Readiness & Evidence Copilot.
//
// This is the RUNTIME teeth behind the project's thesis ("the intelligence is
// in the scaffold, not the model"). Wired via .claude/settings.json, it runs
// BEFORE every Edit / Write / Bash tool call in this repo, logs the call, and
// DENIES any call that would introduce operational UAV terminology — enforcing
// the documentation-QA-only safety boundary as a hard runtime rule, not just a
// prompt. It turns the scaffold from an asserted policy into a measurable,
// testable gate (see packages/qa/src/scaffoldGate.test.ts and the committed
// scaffold-activity.sample.log).
//
// Hook contract: Claude Code passes the tool call as JSON on stdin. Exit 0 to
// ALLOW; print a reason to stderr and exit 2 to DENY (Claude Code blocks the
// call and shows the reason to the model).

import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Mirrors forbiddenOperationalTerms in packages/core/src/schemas.ts. The schema
// remains the authoritative type-level gate; this is the runtime twin.
const FORBIDDEN = [
  "route", "waypoint", "mission", "target", "targeting", "telemetry",
  "payload", "payloadselect", "strike", "attack", "evade", "evasion",
  "countermeasure", "coordinate", "coordinates", "gps", "mavlink", "px4",
  "ardupilot"
];
const FORBIDDEN_RE = new RegExp(`\\b(${FORBIDDEN.join("|")})\\b`, "i");

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let input = {};
try {
  input = JSON.parse(readStdin() || "{}");
} catch {
  input = {};
}

const toolName = input.tool_name ?? input.toolName ?? "unknown";
const ti = input.tool_input ?? input.toolInput ?? {};
// Inspect the parts of a tool call that could carry text into the repo
// (including a Bash command's free-text `description`).
const haystack = [
  ti.file_path,
  ti.command,
  ti.description,
  ti.content,
  ti.new_string,
  ti.old_string,
  typeof ti === "string" ? ti : ""
]
  .filter(Boolean)
  .join("\n");

const logPath =
  process.env.SCAFFOLD_ACTIVITY_LOG ??
  join(process.cwd(), "meta", "ai-workflows", "scaffold-activity.log");
const ts = process.env.SCAFFOLD_FAKE_TS ?? new Date().toISOString();

const match = haystack.match(FORBIDDEN_RE);
const decision = match ? "DENY" : "ALLOW";
const subject = (ti.file_path || ti.command || "").toString().slice(0, 80);

try {
  appendFileSync(logPath, `${ts}\t${toolName}\t${decision}\t${subject}\n`);
} catch {
  // Logging is best-effort; never let it block the gate decision.
}

if (match) {
  process.stderr.write(
    `scaffold-gate: DENY — operational UAV term "${match[0]}" violates the ` +
      `documentation-QA-only safety boundary. This project does not handle ` +
      `drone control, routing, telemetry, payload, or targeting.\n`
  );
  process.exit(2);
}

process.exit(0);

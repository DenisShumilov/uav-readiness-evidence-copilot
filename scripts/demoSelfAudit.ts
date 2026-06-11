import { pathToFileURL } from "node:url";
import { runSelfAudit } from "@uav-readiness/qa";

export function printSelfAudit() {
  const result = runSelfAudit();

  console.log(
    `Documentation self-audit score: ${result.documentationReadinessScore}/100`
  );
  console.log(
    `Checks: ${result.summary.verified} verified, ${result.summary.partial} partial, ` +
      `${result.summary.locked} locked, ${result.summary.conflict} conflict ` +
      `(${result.summary.total} total)`
  );
  console.log(
    `Engine overrides (a documented claim disagreed with reality): ${result.summary.engineAdjustedCount}`
  );
  console.log("");
  for (const check of result.checks) {
    console.log(
      `  ${check.ok ? "OK  " : "FAIL"} [${check.derived}] ${check.description}`
    );
    if (!check.ok) {
      console.log(`        -> ${check.detail}`);
    }
  }
  if (result.overrides.length > 0) {
    console.log("");
    console.log("Engine overrode these documented claims:");
    for (const o of result.overrides) {
      console.log(`  - ${o.id}: ${o.from} -> ${o.to} (${o.reason})`);
    }
  }

  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = printSelfAudit();
  // Fail the build if the docs have drifted from the engine's own output.
  if (result.summary.engineAdjustedCount > 0) {
    console.error(
      `\nSelf-audit FAILED: ${result.summary.engineAdjustedCount} documented claim(s) no longer match reality.`
    );
    process.exit(1);
  }
}

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runReadinessDemo } from "./demoReadiness";

const fixtureDir = join(process.cwd(), "examples", "demo-conflict-readiness");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runReadinessDemo({ fixtureDir });
  console.log(`Conflict readiness score: ${result.readinessScore}/100`);
  console.log(`Wrote output to: ${result.outputDir}`);
}

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { AnySchema } from "ajv";
import { describe, expect, it } from "vitest";
import { runReadinessDemo } from "../../../scripts/demoReadiness";

function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("generated output JSON Schemas", () => {
  it("validates demo JSON outputs against the committed schemas", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "uav-readiness-output-"));
    const result = runReadinessDemo({ outputDir });
    const ajv = new Ajv2020({ allErrors: true });
    addFormats(ajv);

    for (const [schemaFile, outputFile] of [
      ["schemas/evidence-graph.schema.json", "evidence-graph.json"],
      ["schemas/readiness-assessment.schema.json", "readiness-assessment.json"]
    ] as const) {
      const schema = readJson<AnySchema>(join(process.cwd(), schemaFile));
      const output = readJson(join(result.outputDir, outputFile));
      const validate = ajv.compile(schema);

      expect(validate(output), JSON.stringify(validate.errors, null, 2)).toBe(
        true
      );
    }
  });
});

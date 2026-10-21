import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { AnySchema } from "ajv";
import { describe, expect, it } from "vitest";
import {
  EvidenceGraphSchema,
  ReadinessAssessmentSchema
} from "@uav-readiness/core";
import { parseByodDirectory } from "../../cli/src/byod";
import { buildEvidenceGraph } from "@uav-readiness/evidence";
import { evaluateReadiness } from "@uav-readiness/rules";
import { runReadinessDemo } from "../../../scripts/demoReadiness";

function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8"));
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function compileValidator(schemaRelPath: string) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = readJson<AnySchema>(join(process.cwd(), schemaRelPath));
  return ajv.compile(schema);
}

describe("generated output JSON Schemas (Zod <-> Ajv 2020-12 parity + 12 negative mutations)", () => {
  const demoFixtures = [
    "examples/demo-uav-readiness",
    "examples/demo-maintenance-readiness",
    "examples/demo-conflict-readiness",
    "examples/demo-tdp-supplier-package"
  ] as const;

  it("validates all 4 canonical demo bundles and BYOD outputs against both Zod and Ajv JSON Schemas", () => {
    const validateGraph = compileValidator("schemas/evidence-graph.schema.json");
    const validateAssessment = compileValidator(
      "schemas/readiness-assessment.schema.json"
    );

    for (const relDir of demoFixtures) {
      const outputDir = mkdtempSync(join(tmpdir(), "uav-readiness-output-"));
      const fixtureDir = join(process.cwd(), relDir);
      const result = runReadinessDemo({ fixtureDir, outputDir });

      const graphJson = readJson(join(result.outputDir, "evidence-graph.json"));
      const assessmentJson = readJson(
        join(result.outputDir, "readiness-assessment.json")
      );

      expect(
        validateGraph(graphJson),
        `${relDir} evidence-graph Ajv errors: ${JSON.stringify(validateGraph.errors)}`
      ).toBe(true);
      expect(EvidenceGraphSchema.safeParse(graphJson).success).toBe(true);

      expect(
        validateAssessment(assessmentJson),
        `${relDir} readiness-assessment Ajv errors: ${JSON.stringify(validateAssessment.errors)}`
      ).toBe(true);
      expect(ReadinessAssessmentSchema.safeParse(assessmentJson).success).toBe(
        true
      );
    }

    // Also validate BYOD fixture output against both Zod and Ajv
    const byodFixtureDir = join(
      process.cwd(),
      "packages/cli/test-fixtures/byod-sample"
    );
    const byodParsed = parseByodDirectory(byodFixtureDir);
    const byodAssessment = evaluateReadiness(byodParsed.bundle);
    const byodGraph = buildEvidenceGraph(byodParsed.bundle);

    expect(
      validateAssessment(byodAssessment),
      `BYOD assessment Ajv errors: ${JSON.stringify(validateAssessment.errors)}`
    ).toBe(true);
    expect(ReadinessAssessmentSchema.safeParse(byodAssessment).success).toBe(
      true
    );

    expect(
      validateGraph(byodGraph),
      `BYOD graph Ajv errors: ${JSON.stringify(validateGraph.errors)}`
    ).toBe(true);
    expect(EvidenceGraphSchema.safeParse(byodGraph).success).toBe(true);
  });

  describe("6 isolated negative mutations for readiness-assessment.schema.json", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "uav-schema-neg-assess-"));
    const demoResult = runReadinessDemo({ outputDir });
    const validAssessment = readJson<Record<string, unknown>>(
      join(demoResult.outputDir, "readiness-assessment.json")
    );
    const validateAssessment = compileValidator(
      "schemas/readiness-assessment.schema.json"
    );

    it("1. rejects missing required field (delete clone.findings)", () => {
      const clone = deepClone(validAssessment);
      delete clone.findings;
      expect(ReadinessAssessmentSchema.safeParse(clone).success).toBe(false);
      expect(validateAssessment(clone)).toBe(false);
      expect((validateAssessment.errors ?? []).map((e) => e.keyword)).toContain(
        "required"
      );
    });

    it("2. rejects wrong field type (readinessScore as string)", () => {
      const clone = deepClone(validAssessment);
      clone.readinessScore = "44";
      expect(ReadinessAssessmentSchema.safeParse(clone).success).toBe(false);
      expect(validateAssessment(clone)).toBe(false);
      expect((validateAssessment.errors ?? []).map((e) => e.keyword)).toContain(
        "type"
      );
    });

    it("3. rejects corrupted nested item (delete findings[0].severity)", () => {
      const clone = deepClone(validAssessment);
      const findings = clone.findings as Array<Record<string, unknown>>;
      delete findings[0].severity;
      expect(ReadinessAssessmentSchema.safeParse(clone).success).toBe(false);
      expect(validateAssessment(clone)).toBe(false);
      expect((validateAssessment.errors ?? []).map((e) => e.keyword)).toContain(
        "required"
      );
    });

    it("4. rejects unknown additional property (unexpectedExtraField)", () => {
      const clone = deepClone(validAssessment);
      clone.unexpectedExtraField = 123;
      expect(ReadinessAssessmentSchema.safeParse(clone).success).toBe(false);
      expect(validateAssessment(clone)).toBe(false);
      expect((validateAssessment.errors ?? []).map((e) => e.keyword)).toContain(
        "additionalProperties"
      );
    });

    it("5. rejects invalid enum value (findings[0].severity = 'ultra')", () => {
      const clone = deepClone(validAssessment);
      const findings = clone.findings as Array<Record<string, unknown>>;
      findings[0].severity = "ultra";
      expect(ReadinessAssessmentSchema.safeParse(clone).success).toBe(false);
      expect(validateAssessment(clone)).toBe(false);
      expect((validateAssessment.errors ?? []).map((e) => e.keyword)).toContain(
        "enum"
      );
    });

    it("6. rejects out-of-bounds numeric values (readinessScore = 101 and -1)", () => {
      const cloneHigh = deepClone(validAssessment);
      cloneHigh.readinessScore = 101;
      expect(ReadinessAssessmentSchema.safeParse(cloneHigh).success).toBe(false);
      expect(validateAssessment(cloneHigh)).toBe(false);
      expect((validateAssessment.errors ?? []).map((e) => e.keyword)).toContain(
        "maximum"
      );

      const cloneLow = deepClone(validAssessment);
      cloneLow.readinessScore = -1;
      expect(ReadinessAssessmentSchema.safeParse(cloneLow).success).toBe(false);
      expect(validateAssessment(cloneLow)).toBe(false);
      expect((validateAssessment.errors ?? []).map((e) => e.keyword)).toContain(
        "minimum"
      );
    });
  });

  describe("6 isolated negative mutations for evidence-graph.schema.json", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "uav-schema-neg-graph-"));
    const demoResult = runReadinessDemo({ outputDir });
    const validGraph = readJson<Record<string, unknown>>(
      join(demoResult.outputDir, "evidence-graph.json")
    );
    const validateGraph = compileValidator("schemas/evidence-graph.schema.json");

    it("1. rejects missing required field (delete summary.totalSources)", () => {
      const clone = deepClone(validGraph);
      const summary = clone.summary as Record<string, unknown>;
      delete summary.totalSources;
      expect(EvidenceGraphSchema.safeParse(clone).success).toBe(false);
      expect(validateGraph(clone)).toBe(false);
      expect((validateGraph.errors ?? []).map((e) => e.keyword)).toContain(
        "required"
      );
    });

    it("2. rejects wrong field type (evidenceGraph.synthetic as string)", () => {
      const clone = deepClone(validGraph);
      const graphObj = clone.evidenceGraph as Record<string, unknown>;
      graphObj.synthetic = "true";
      expect(EvidenceGraphSchema.safeParse(clone).success).toBe(false);
      expect(validateGraph(clone)).toBe(false);
      expect((validateGraph.errors ?? []).map((e) => e.keyword)).toContain(
        "type"
      );
    });

    it("3. rejects corrupted nested item (delete evidenceSources[0].excerpt)", () => {
      const clone = deepClone(validGraph);
      const sources = clone.evidenceSources as Array<Record<string, unknown>>;
      delete sources[0].excerpt;
      expect(EvidenceGraphSchema.safeParse(clone).success).toBe(false);
      expect(validateGraph(clone)).toBe(false);
      expect((validateGraph.errors ?? []).map((e) => e.keyword)).toContain(
        "required"
      );
    });

    it("4. rejects unknown additional property (unexpectedExtraField)", () => {
      const clone = deepClone(validGraph);
      clone.unexpectedExtraField = 123;
      expect(EvidenceGraphSchema.safeParse(clone).success).toBe(false);
      expect(validateGraph(clone)).toBe(false);
      expect((validateGraph.errors ?? []).map((e) => e.keyword)).toContain(
        "additionalProperties"
      );
    });

    it("5. rejects invalid enum value (evidenceClaims[0].status = 'unknown_status')", () => {
      const clone = deepClone(validGraph);
      const claims = clone.evidenceClaims as Array<Record<string, unknown>>;
      claims[0].status = "unknown_status";
      expect(EvidenceGraphSchema.safeParse(clone).success).toBe(false);
      expect(validateGraph(clone)).toBe(false);
      expect((validateGraph.errors ?? []).map((e) => e.keyword)).toContain(
        "enum"
      );
    });

    it("6. rejects out-of-bounds numeric value (summary.verifiedCount = -1)", () => {
      const clone = deepClone(validGraph);
      const summary = clone.summary as Record<string, unknown>;
      summary.verifiedCount = -1;
      expect(EvidenceGraphSchema.safeParse(clone).success).toBe(false);
      expect(validateGraph(clone)).toBe(false);
      expect((validateGraph.errors ?? []).map((e) => e.keyword)).toContain(
        "minimum"
      );
    });

    it("7. F11: rejects whitespace in identifier fields (evidenceGraph.id = 'bad id')", () => {
      const clone = deepClone(validGraph);
      const graphObj = clone.evidenceGraph as Record<string, unknown>;
      graphObj.id = "bad id";
      expect(EvidenceGraphSchema.safeParse(clone).success).toBe(false);
      expect(validateGraph(clone)).toBe(false);
      expect((validateGraph.errors ?? []).map((e) => e.keyword)).toContain(
        "pattern"
      );
    });

    it("8. F11: rejects verified claim with empty evidenceSourceIds", () => {
      const clone = deepClone(validGraph);
      const claims = clone.evidenceClaims as Array<Record<string, unknown>>;
      const verifiedClaim = claims.find((c) => c.status === "verified") ?? claims[0];
      verifiedClaim.status = "verified";
      verifiedClaim.evidenceSourceIds = [];
      expect(EvidenceGraphSchema.safeParse(clone).success).toBe(false);
      expect(validateGraph(clone)).toBe(false);
      expect((validateGraph.errors ?? []).map((e) => e.keyword)).toContain(
        "minItems"
      );
    });

    it("9. F11: rejects locked claim without lockReason", () => {
      const clone = deepClone(validGraph);
      const claims = clone.evidenceClaims as Array<Record<string, unknown>>;
      const lockedClaim = claims.find((c) => c.status === "locked") ?? claims[0];
      lockedClaim.status = "locked";
      delete lockedClaim.lockReason;
      expect(EvidenceGraphSchema.safeParse(clone).success).toBe(false);
      expect(validateGraph(clone)).toBe(false);
      expect((validateGraph.errors ?? []).map((e) => e.keyword)).toContain(
        "required"
      );
    });
  });
});

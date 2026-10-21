import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runReadinessDemo } from "../../../scripts/demoReadiness";

const fixtureDir = join(process.cwd(), "examples", "demo-uav-readiness");
const unsafePattern =
  /\b(mission|payload|targeting|weapon|route|waypoint|telemetry|target|coordinates|coordinate|gps|frequency|frequencies|mavlink|px4|ardupilot|strike|attack|evasion|evade|countermeasure)\b/i;
const allowedSafetyBoundary =
  /<div class="panel wide note boundary">[\s\S]*?<\/div>/;

describe("demo readiness CLI", () => {
  it("writes demo readiness outputs", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-output-"));
    const result = runReadinessDemo({ fixtureDir, outputDir });

    expect(result.readinessScore).toBe(44);
    expect(result.files).toEqual([
      "readiness-report.md",
      "evidence-graph.json",
      "readiness-assessment.json",
      "traceability-matrix.csv",
      "artifact-hashes.json",
      "readiness.sarif",
      "engineering-review.md",
      "engineering-review.html",
      "engineering-review.en.html",
      "engineering-review.uk.html"
    ]);
    expect(existsSync(join(outputDir, "readiness-report.md"))).toBe(true);
    expect(existsSync(join(outputDir, "evidence-graph.json"))).toBe(true);
    expect(existsSync(join(outputDir, "readiness-assessment.json"))).toBe(true);
    expect(existsSync(join(outputDir, "traceability-matrix.csv"))).toBe(true);
    expect(existsSync(join(outputDir, "artifact-hashes.json"))).toBe(true);
    expect(existsSync(join(outputDir, "readiness.sarif"))).toBe(true);
    expect(existsSync(join(outputDir, "engineering-review.md"))).toBe(true);
    expect(existsSync(join(outputDir, "engineering-review.html"))).toBe(true);
    expect(existsSync(join(outputDir, "engineering-review.en.html"))).toBe(true);
    expect(existsSync(join(outputDir, "engineering-review.uk.html"))).toBe(true);
  });

  it("keeps generated report inside safe wording", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-output-"));
    runReadinessDemo({ fixtureDir, outputDir });
    const report = readFileSync(join(outputDir, "readiness-report.md"), "utf8");

    expect(report).not.toMatch(unsafePattern);
    expect(report).toContain("documentation readiness only");
  });

  it("writes traceability and hash content", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-output-"));
    runReadinessDemo({ fixtureDir, outputDir });
    const traceability = readFileSync(
      join(outputDir, "traceability-matrix.csv"),
      "utf8"
    );
    const hashes = JSON.parse(
      readFileSync(join(outputDir, "artifact-hashes.json"), "utf8")
    ) as { artifacts: Array<{ sha256: string }> };

    expect(traceability).toContain("requirement,evidence,check,status,risk");
    expect(hashes.artifacts).toHaveLength(4);
    expect(hashes.artifacts[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("writes an engineering demonstration page", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-output-"));
    runReadinessDemo({ fixtureDir, outputDir });
    const reviewDemo = readFileSync(
      join(outputDir, "engineering-review.md"),
      "utf8"
    );

    expect(reviewDemo).toContain("# UAV Readiness & Evidence Copilot");
    expect(reviewDemo).toContain("## Engineering Capabilities & Verification Architecture");
    expect(reviewDemo).toContain("engineering-review.md");
  });

  it("writes a static engineering review HTML page", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-output-"));
    runReadinessDemo({ fixtureDir, outputDir });
    const reviewDemoHtml = readFileSync(
      join(outputDir, "engineering-review.html"),
      "utf8"
    );

    expect(reviewDemoHtml).toContain("<!doctype html>");
    expect(reviewDemoHtml).toContain("Readiness score");
    expect(reviewDemoHtml).toContain("Locked Steps");
    expect(reviewDemoHtml).toContain("Safety Boundary");
    expect(reviewDemoHtml).toContain("No mission planning. No payload. No live drone control.");

    const htmlWithoutSafetyBoundary = reviewDemoHtml.replace(
      allowedSafetyBoundary,
      ""
    );
    expect(htmlWithoutSafetyBoundary).not.toMatch(unsafePattern);
  });

  it("writes bilingual engineering review HTML pages", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-output-"));
    runReadinessDemo({ fixtureDir, outputDir });
    const english = readFileSync(
      join(outputDir, "engineering-review.en.html"),
      "utf8"
    );
    const ukrainian = readFileSync(
      join(outputDir, "engineering-review.uk.html"),
      "utf8"
    );

    expect(english).toContain('<html lang="en">');
    expect(english).toContain("Plain-English Meaning");
    expect(ukrainian).toContain('<html lang="uk">');
    expect(ukrainian).toContain("Простими словами");

    const ukrainianWithoutSafetyBoundary = ukrainian.replace(
      allowedSafetyBoundary,
      ""
    );
    expect(ukrainianWithoutSafetyBoundary).not.toMatch(unsafePattern);
  });
});

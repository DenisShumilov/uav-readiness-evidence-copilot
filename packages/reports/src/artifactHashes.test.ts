import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateArtifactHashes } from "./artifactHashes";

const fixtureDir = join(process.cwd(), "examples", "demo-uav-readiness");

describe("generateArtifactHashes", () => {
  it("creates stable sha256 hashes for input artifacts", () => {
    const manifest = generateArtifactHashes(
      fixtureDir,
      "2026-06-06T00:00:00.000Z"
    );

    expect(manifest.algorithm).toBe("sha256");
    expect(manifest.artifacts).toHaveLength(4);
    expect(
      manifest.artifacts.every((artifact) => /^[a-f0-9]{64}$/.test(artifact.sha256))
    ).toBe(true);
    expect(manifest.artifacts.every((artifact) => artifact.bytes > 0)).toBe(true);
  });

  it("changes hash when file content changes", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "hash-fixtures-"));
    writeAllRequiredFixtures(tempDir, "first");
    const first = generateArtifactHashes(tempDir, "2026-06-06T00:00:00.000Z");
    writeAllRequiredFixtures(tempDir, "second");
    const second = generateArtifactHashes(tempDir, "2026-06-06T00:00:00.000Z");

    expect(first.artifacts[0].sha256).not.toBe(second.artifacts[0].sha256);
  });
});

function writeAllRequiredFixtures(dir: string, marker: string) {
  writeFileSync(join(dir, "BOM.csv"), `bom-${marker}`, "utf8");
  writeFileSync(join(dir, "demo_manual.md"), `manual-${marker}`, "utf8");
  writeFileSync(join(dir, "test_log.csv"), `test-${marker}`, "utf8");
  writeFileSync(join(dir, "qa_notes.md"), `qa-${marker}`, "utf8");
}

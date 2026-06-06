import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ArtifactHashEntry = {
  filename: string;
  sha256: string;
  bytes: number;
};

export type ArtifactHashManifest = {
  generatedAt: string;
  algorithm: "sha256";
  artifacts: ArtifactHashEntry[];
};

const inputArtifactFilenames = [
  "BOM.csv",
  "demo_manual.md",
  "test_log.csv",
  "qa_notes.md"
] as const;

export function generateArtifactHashes(
  fixtureDir: string,
  generatedAt = new Date().toISOString()
): ArtifactHashManifest {
  return {
    generatedAt,
    algorithm: "sha256",
    artifacts: inputArtifactFilenames.map((filename) =>
      hashFile(fixtureDir, filename)
    )
  };
}

function hashFile(fixtureDir: string, filename: string): ArtifactHashEntry {
  const content = readFileSync(join(fixtureDir, filename));
  const sha256 = createHash("sha256").update(content).digest("hex");

  return {
    filename,
    sha256,
    bytes: content.byteLength
  };
}

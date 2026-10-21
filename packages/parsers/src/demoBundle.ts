import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DemoBundleSchema,
  detectCrossDocumentConflicts,
  type BOMItem,
  type DemoBundle,
  type EvidenceClaim,
  type EvidenceSource
} from "@uav-readiness/core";
import { parseBOMCsv } from "./bom";
import { parseManualMd } from "./manual";
import { parseQaNotesMd } from "./qaNotes";
import { parseTestLogCsv } from "./testLog";

export function parseDemoBundle(
  fixtureDir = join(process.cwd(), "examples", "demo-uav-readiness")
): DemoBundle {
  const bom = parseBOMCsv(readFixture(fixtureDir, "BOM.csv"));
  const manual = parseManualMd(readFixture(fixtureDir, "demo_manual.md"));
  const testLog = parseTestLogCsv(readFixture(fixtureDir, "test_log.csv"));
  const qaNotes = parseQaNotesMd(readFixture(fixtureDir, "qa_notes.md"));

  const merged = mergeParsedParts([bom, manual, testLog, qaNotes]);
  const evidenceSources = merged.evidenceSources;
  const evidenceClaims = [
    ...merged.evidenceClaims,
    // Derived by real cross-document analysis (compares declared revisions across
    // documents), not read from a hand-typed status column:
    ...detectCrossDocumentConflicts(evidenceSources)
  ];

  return DemoBundleSchema.parse({
    artifacts: [bom.artifact, manual.artifact, testLog.artifact, qaNotes.artifact],
    bomItems: merged.bomItems,
    evidenceSources,
    evidenceClaims,
    evidenceLocks: qaNotes.evidenceLocks,
    qaItems: testLog.qaItems,
    readinessFindings: [
      ...testLog.readinessFindings,
      ...qaNotes.readinessFindings
    ]
  });
}

function readFixture(fixtureDir: string, filename: string): string {
  return readFileSync(join(fixtureDir, filename), "utf8");
}

type MergeablePart = {
  bomItems?: BOMItem[];
  evidenceSources: EvidenceSource[];
  evidenceClaims: EvidenceClaim[];
};

function mergeParsedParts(parts: MergeablePart[]): {
  bomItems: BOMItem[];
  evidenceSources: EvidenceSource[];
  evidenceClaims: EvidenceClaim[];
} {
  const byId = new Map<string, EvidenceSource>();
  const allBomItems: BOMItem[] = [];
  const allClaims: EvidenceClaim[] = [];

  for (const part of parts) {
    const renamedInPart = new Map<string, string>();

    for (const source of part.evidenceSources) {
      if (!byId.has(source.id)) {
        byId.set(source.id, source);
        continue;
      }

      const existing = byId.get(source.id)!;
      if (
        existing.artifactId === source.artifactId &&
        existing.excerpt === source.excerpt &&
        existing.label === source.label &&
        existing.sourceType === source.sourceType
      ) {
        continue;
      }

      const suffix = source.artifactId.replace(/^artifact\./, "") || "dup";
      let candidateId = `${source.id}.${suffix}`;
      let counter = 2;
      while (byId.has(candidateId)) {
        candidateId = `${source.id}.${suffix}-${counter}`;
        counter += 1;
      }

      const disambiguated: EvidenceSource = {
        ...source,
        id: candidateId
      };
      byId.set(candidateId, disambiguated);
      renamedInPart.set(source.id, candidateId);
    }

    if (part.bomItems) {
      for (const item of part.bomItems) {
        allBomItems.push({
          ...item,
          evidenceSourceIds: item.evidenceSourceIds.map(
            (id) => renamedInPart.get(id) ?? id
          )
        });
      }
    }

    for (const claim of part.evidenceClaims) {
      allClaims.push({
        ...claim,
        evidenceSourceIds: claim.evidenceSourceIds.map(
          (id) => renamedInPart.get(id) ?? id
        )
      });
    }
  }

  return {
    bomItems: allBomItems,
    evidenceSources: [...byId.values()],
    evidenceClaims: allClaims
  };
}

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
import { buildBoundedEvidenceId, isSameEvidenceSource } from "./disambiguate";
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

export type MergeablePart = {
  bomItems?: BOMItem[];
  evidenceSources: EvidenceSource[];
  evidenceClaims: EvidenceClaim[];
};

export function mergeParsedParts(parts: MergeablePart[]): {
  bomItems: BOMItem[];
  evidenceSources: EvidenceSource[];
  evidenceClaims: EvidenceClaim[];
} {
  const reservedGlobalIds = new Set(
    parts.flatMap((part) => part.evidenceSources.map((source) => source.id))
  );
  const byId = new Map<string, EvidenceSource>();
  const allBomItems: BOMItem[] = [];
  const allClaims: EvidenceClaim[] = [];

  for (const part of parts) {
    const resolvedInPart = new Map<string, string[]>();
    const pushResolved = (rawId: string, finalId: string) => {
      const queue = resolvedInPart.get(rawId);
      if (queue) {
        queue.push(finalId);
      } else {
        resolvedInPart.set(rawId, [finalId]);
      }
    };

    for (const source of part.evidenceSources) {
      if (!byId.has(source.id)) {
        byId.set(source.id, source);
        pushResolved(source.id, source.id);
        continue;
      }

      const existing = byId.get(source.id)!;
      if (isSameEvidenceSource(existing, source)) {
        pushResolved(source.id, source.id);
        continue;
      }

      const suffix = source.artifactId.replace(/^artifact\./, "") || "dup";
      const maxLen = source.id.length <= 64 ? 64 : 120;
      const baseSuffix = `.${suffix}`;
      let candidateId = buildBoundedEvidenceId(source.id, baseSuffix, maxLen);
      let counter = 2;
      while (byId.has(candidateId) || reservedGlobalIds.has(candidateId)) {
        candidateId = buildBoundedEvidenceId(
          source.id,
          `${baseSuffix}-${counter}`,
          maxLen
        );
        counter += 1;
      }

      const disambiguated: EvidenceSource = {
        ...source,
        id: candidateId
      };
      byId.set(candidateId, disambiguated);
      pushResolved(source.id, candidateId);
    }

    const bomCursors = new Map<string, number>();
    const resolveForBom = (rawId: string): string => {
      const queue = resolvedInPart.get(rawId);
      if (!queue || queue.length === 0) {
        return rawId;
      }
      const idx = bomCursors.get(rawId) ?? 0;
      bomCursors.set(rawId, idx + 1);
      return queue[Math.min(idx, queue.length - 1)]!;
    };

    if (part.bomItems) {
      for (const item of part.bomItems) {
        allBomItems.push({
          ...item,
          evidenceSourceIds: item.evidenceSourceIds.map(resolveForBom)
        });
      }
    }

    const claimCursors = new Map<string, number>();
    const resolveForClaim = (rawId: string): string => {
      const queue = resolvedInPart.get(rawId);
      if (!queue || queue.length === 0) {
        return rawId;
      }
      const idx = claimCursors.get(rawId) ?? 0;
      claimCursors.set(rawId, idx + 1);
      return queue[Math.min(idx, queue.length - 1)]!;
    };

    for (const claim of part.evidenceClaims) {
      allClaims.push({
        ...claim,
        evidenceSourceIds: claim.evidenceSourceIds.map(resolveForClaim)
      });
    }
  }

  return {
    bomItems: allBomItems,
    evidenceSources: [...byId.values()],
    evidenceClaims: allClaims
  };
}

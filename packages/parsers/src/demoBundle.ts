import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DemoBundleSchema,
  type DemoBundle,
  type EvidenceSource
} from "../../core/src/schemas";
import { detectCrossDocumentConflicts } from "../../core/src/crossCheck";
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

  const evidenceSources = mergeEvidenceSources([
    ...bom.evidenceSources,
    ...manual.evidenceSources,
    ...testLog.evidenceSources,
    ...qaNotes.evidenceSources
  ]);
  const evidenceClaims = [
    ...bom.evidenceClaims,
    ...manual.evidenceClaims,
    ...testLog.evidenceClaims,
    ...qaNotes.evidenceClaims,
    // Derived by real cross-document analysis (compares declared revisions across
    // documents), not read from a hand-typed status column:
    ...detectCrossDocumentConflicts(evidenceSources)
  ];

  return DemoBundleSchema.parse({
    artifacts: [bom.artifact, manual.artifact, testLog.artifact, qaNotes.artifact],
    bomItems: bom.bomItems,
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

function mergeEvidenceSources(sources: EvidenceSource[]): EvidenceSource[] {
  const byId = new Map<string, EvidenceSource>();

  sources.forEach((source) => {
    if (!byId.has(source.id)) {
      byId.set(source.id, source);
    }
  });

  return [...byId.values()];
}

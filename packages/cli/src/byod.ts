import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync
} from "node:fs";
import { extname, relative, resolve } from "node:path";
import {
  ArtifactSchema,
  DemoBundleSchema,
  EvidenceClaimSchema,
  EvidenceLockSchema,
  ReadinessFindingSchema,
  detectCrossDocumentConflicts,
  type DemoBundle,
  type EvidenceClaim,
  type EvidenceLock,
  type EvidenceSource,
  type ReadinessFinding
} from "@uav-readiness/core";
import {
  parseBOMCsv,
  parseManualMd,
  parseQaNotesMd,
  parseTestLogCsv
} from "@uav-readiness/parsers";

export const supportedInputKinds = [
  "bom",
  "manual",
  "test_log",
  "qa_notes"
] as const;

export type SupportedInputKind = (typeof supportedInputKinds)[number];

export type IngestStatus = "parsed" | "skipped" | "locked";

export type IngestSummaryItem = {
  file: string;
  kind?: SupportedInputKind;
  status: IngestStatus;
  reason: string;
};

export type ByodParseResult = {
  bundle: DemoBundle;
  ingestSummary: IngestSummaryItem[];
};

type ParsedKind = {
  artifacts: DemoBundle["artifacts"];
  bomItems: DemoBundle["bomItems"];
  evidenceSources: EvidenceSource[];
  evidenceClaims: EvidenceClaim[];
  evidenceLocks: EvidenceLock[];
  qaItems: DemoBundle["qaItems"];
  readinessFindings: ReadinessFinding[];
};

const expectedCsvHeaders = {
  bom: [
    "item_id",
    "item_name",
    "category",
    "quantity",
    "record_status",
    "evidence_id",
    "notes"
  ],
  test_log: [
    "check_id",
    "check_name",
    "check_type",
    "result",
    "evidence_status",
    "evidence_id",
    "notes"
  ]
} as const;

export const expectedInputContracts = [
  "BOM CSV headers: item_id,item_name,category,quantity,record_status,evidence_id,notes",
  "Manual Markdown: SYNTHETIC DEMO line and a | Claim | Status | Evidence | table",
  "Test-log CSV headers: check_id,check_name,check_type,result,evidence_status,evidence_id,notes",
  "QA-notes Markdown: SYNTHETIC DEMO line, a | Evidence ID | Status | Meaning | table, and Finding ID/Status/Reason/Impact fields"
] as const;

const maxCandidateBytes = 1_000_000;

export function detectSupportedInputKind(
  filename: string,
  content: string
): SupportedInputKind | undefined {
  const extension = extname(filename).toLowerCase();
  if (extension === ".csv") {
    const header = firstMeaningfulLine(content);
    if (hasHeaders(header, expectedCsvHeaders.bom)) {
      return "bom";
    }
    if (hasHeaders(header, expectedCsvHeaders.test_log)) {
      return "test_log";
    }
  }

  if (extension === ".md") {
    if (content.includes("| Evidence ID | Status | Meaning |")) {
      return "qa_notes";
    }
    if (content.includes("| Claim | Status | Evidence |")) {
      return "manual";
    }
  }

  return undefined;
}

export function parseByodDirectory(inputDir: string): ByodParseResult {
  const root = resolve(inputDir);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  const summary: IngestSummaryItem[] = [];
  const parsedKinds = new Set<SupportedInputKind>();
  const parseFailures = new Set<SupportedInputKind>();
  const parsedParts: ParsedKind[] = [];

  for (const filePath of listCandidateFiles(root)) {
    const rel = slash(relative(root, filePath));
    const size = statSync(filePath).size;
    if (size > maxCandidateBytes) {
      summary.push({
        file: rel,
        status: "skipped",
        reason: "candidate is larger than the CLI safety limit"
      });
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    const kind = detectSupportedInputKind(rel, content);
    if (!kind) {
      summary.push({
        file: rel,
        status: "skipped",
        reason: "not one of the four documented input contracts"
      });
      continue;
    }

    if (parsedKinds.has(kind)) {
      summary.push({
        file: rel,
        kind,
        status: "skipped",
        reason: `already parsed a ${labelForKind(kind)} input`
      });
      continue;
    }

    try {
      parsedParts.push(parseOne(kind, content, rel));
      parsedKinds.add(kind);
      summary.push({
        file: rel,
        kind,
        status: "parsed",
        reason: `parsed as ${labelForKind(kind)}`
      });
    } catch {
      parseFailures.add(kind);
      summary.push({
        file: rel,
        kind,
        status: "skipped",
        reason: `recognized as ${labelForKind(kind)} but did not match the documented contract`
      });
    }
  }

  for (const kind of supportedInputKinds) {
    if (!parsedKinds.has(kind)) {
      parsedParts.push(buildLockedMissingInput(kind));
      summary.push({
        file: `(missing ${labelForKind(kind)})`,
        kind,
        status: "locked",
        reason: parseFailures.has(kind)
          ? "detected files could not be parsed; no evidence -> locked"
          : "no supported file was found; no evidence -> locked"
      });
    }
  }

  const evidenceSources = mergeEvidenceSources(
    parsedParts.flatMap((part) => part.evidenceSources)
  );
  const evidenceClaims = [
    ...parsedParts.flatMap((part) => part.evidenceClaims),
    ...detectCrossDocumentConflicts(evidenceSources)
  ];

  return {
    ingestSummary: summary,
    bundle: DemoBundleSchema.parse({
      artifacts: parsedParts.flatMap((part) => part.artifacts),
      bomItems: parsedParts.flatMap((part) => part.bomItems),
      evidenceSources,
      evidenceClaims,
      evidenceLocks: parsedParts.flatMap((part) => part.evidenceLocks),
      qaItems: parsedParts.flatMap((part) => part.qaItems),
      readinessFindings: parsedParts.flatMap((part) => part.readinessFindings)
    })
  };
}

function parseOne(
  kind: SupportedInputKind,
  content: string,
  filename: string
): ParsedKind {
  if (kind === "bom") {
    const parsed = parseBOMCsv(content);
    return {
      artifacts: [withFilename(parsed.artifact, filename)],
      bomItems: parsed.bomItems,
      evidenceSources: parsed.evidenceSources,
      evidenceClaims: parsed.evidenceClaims,
      evidenceLocks: [],
      qaItems: [],
      readinessFindings: []
    };
  }

  if (kind === "manual") {
    const parsed = parseManualMd(content);
    return {
      artifacts: [withFilename(parsed.artifact, filename)],
      bomItems: [],
      evidenceSources: parsed.evidenceSources,
      evidenceClaims: parsed.evidenceClaims,
      evidenceLocks: [],
      qaItems: [],
      readinessFindings: []
    };
  }

  if (kind === "test_log") {
    const parsed = parseTestLogCsv(content);
    return {
      artifacts: [withFilename(parsed.artifact, filename)],
      bomItems: [],
      evidenceSources: parsed.evidenceSources,
      evidenceClaims: parsed.evidenceClaims,
      evidenceLocks: [],
      qaItems: parsed.qaItems,
      readinessFindings: parsed.readinessFindings
    };
  }

  const parsed = parseQaNotesMd(content);
  return {
    artifacts: [withFilename(parsed.artifact, filename)],
    bomItems: [],
    evidenceSources: parsed.evidenceSources,
    evidenceClaims: parsed.evidenceClaims,
    evidenceLocks: parsed.evidenceLocks,
    qaItems: [],
    readinessFindings: parsed.readinessFindings
  };
}

function withFilename<T extends DemoBundle["artifacts"][number]>(
  artifact: T,
  filename: string
): T {
  return ArtifactSchema.parse({ ...artifact, filename }) as T;
}

function buildLockedMissingInput(kind: SupportedInputKind): ParsedKind {
  const label = labelForKind(kind);
  const claimId = `claim.missing.${kind}`;
  const lockId = `lock.missing.${kind}`;
  const claim = EvidenceClaimSchema.parse({
    id: claimId,
    statement: `${label} input requires parseable documentation evidence`,
    claimType: "artifact_presence",
    status: "locked",
    evidenceSourceIds: [],
    lockReason: `No parseable ${label} input was found; no evidence -> locked`
  });
  const lock = EvidenceLockSchema.parse({
    id: lockId,
    claimId,
    reason: claim.lockReason,
    missingEvidence: [label],
    severity: "warning",
    status: "locked"
  });
  const finding = ReadinessFindingSchema.parse({
    id: `finding.missing.${kind}`,
    title: `${label} input missing or skipped`,
    category: "artifact_completeness",
    severity: "warning",
    status: "blocked",
    evidenceClaimIds: [claimId],
    lockIds: [lockId],
    explanation: "Add a supported documentation file or keep the claim locked."
  });

  return {
    artifacts: [],
    bomItems: [],
    evidenceSources: [],
    evidenceClaims: [claim],
    evidenceLocks: [lock],
    qaItems: [],
    readinessFindings: [finding]
  };
}

function listCandidateFiles(root: string): string[] {
  const found: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (![".git", "node_modules", "output"].includes(entry.name)) {
          stack.push(path);
        }
        continue;
      }

      if (entry.isFile() && [".csv", ".md"].includes(extname(entry.name).toLowerCase())) {
        found.push(path);
      }
    }
  }

  return found.sort((a, b) => slash(relative(root, a)).localeCompare(slash(relative(root, b))));
}

function firstMeaningfulLine(content: string): string {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";
}

function hasHeaders(
  line: string,
  expected: readonly string[]
): boolean {
  const headers = line.split(",").map((header) => header.trim().toLowerCase());
  return expected.every((header) => headers.includes(header));
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

export function labelForKind(kind: SupportedInputKind): string {
  switch (kind) {
    case "bom":
      return "BOM";
    case "manual":
      return "manual";
    case "test_log":
      return "test log";
    case "qa_notes":
      return "QA notes";
  }
}

function slash(value: string): string {
  return value.replaceAll("\\", "/");
}

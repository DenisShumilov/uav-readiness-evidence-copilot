import type { EvidenceSource } from "@uav-readiness/core";

export type DisambiguationSourceFields = Pick<
  EvidenceSource,
  "artifactId" | "label" | "sourceType" | "excerpt"
>;

export type AllocateDisambiguatedEvidenceIdArgs = {
  rawId: string;
  rowNumber: number;
  suffixTag: string;
  candidateSource: DisambiguationSourceFields;
  usedSourcesById: Map<string, DisambiguationSourceFields>;
  usedIds: Set<string>;
  reservedRawIds: ReadonlySet<string>;
};

export type AllocateDisambiguatedEvidenceIdResult = {
  finalId: string;
  deduplicated: boolean;
};

export function isSameEvidenceSource(
  a: DisambiguationSourceFields,
  b: DisambiguationSourceFields
): boolean {
  return (
    a.artifactId === b.artifactId &&
    a.label === b.label &&
    a.sourceType === b.sourceType &&
    (a.excerpt ?? "") === (b.excerpt ?? "")
  );
}

export function buildBoundedEvidenceId(
  baseId: string,
  suffix: string,
  maxLen = baseId.length <= 64 ? 64 : 120
): string {
  if (baseId.length + suffix.length <= maxLen) {
    return `${baseId}${suffix}`;
  }
  const allowedBaseLen = Math.max(1, maxLen - suffix.length);
  const sliced = baseId.slice(0, allowedBaseLen);
  const trimmed = sliced.replace(/[._:-]+$/, "") || sliced;
  return `${trimmed}${suffix}`;
}

export function allocateDisambiguatedEvidenceId(
  args: AllocateDisambiguatedEvidenceIdArgs
): AllocateDisambiguatedEvidenceIdResult {
  const {
    rawId,
    rowNumber,
    suffixTag,
    candidateSource,
    usedSourcesById,
    usedIds,
    reservedRawIds
  } = args;

  const existing = usedSourcesById.get(rawId);
  if (!existing && !usedIds.has(rawId)) {
    usedIds.add(rawId);
    usedSourcesById.set(rawId, candidateSource);
    return { finalId: rawId, deduplicated: false };
  }

  if (existing && isSameEvidenceSource(existing, candidateSource)) {
    return { finalId: rawId, deduplicated: true };
  }

  const maxLen = rawId.length <= 64 ? 64 : 120;
  const baseSuffix = `.${suffixTag}-r${rowNumber}`;
  let candidate = buildBoundedEvidenceId(rawId, baseSuffix, maxLen);
  let counter = 2;

  while (usedIds.has(candidate) || reservedRawIds.has(candidate)) {
    candidate = buildBoundedEvidenceId(
      rawId,
      `${baseSuffix}-${counter}`,
      maxLen
    );
    counter += 1;
  }

  usedIds.add(candidate);
  usedSourcesById.set(candidate, candidateSource);
  return { finalId: candidate, deduplicated: false };
}

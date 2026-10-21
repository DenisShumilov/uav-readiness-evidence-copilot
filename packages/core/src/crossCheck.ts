import {
  EvidenceClaimSchema,
  type EvidenceClaim,
  type EvidenceSource
} from "./schemas";

/**
 * Real cross-document analysis.
 *
 * Scans evidence-source text for structured revision declarations and DERIVES
 * a `conflict` claim when the same subject is given different values by
 * different source documents. The conflict status is computed by comparing the
 * documents — it is never read from a hand-typed status column. Documentation
 * QA only; this does not touch operational data.
 *
 * PREFERRED INPUT CONTRACT — a structured revision declaration is written as a
 * standalone line:
 *
 *     Revision: <subject>=<value>
 *
 * FALLBACK INPUT CONTRACT — older free-text declarations are still accepted as:
 *
 *     rev:<subject>=<value>
 *
 * where `<subject>` is `[a-z0-9-]+` and `<value>` is `[a-z0-9.-]+`. Surrounding
 * whitespace is tolerated (`rev: training-manual = TM-3` parses the same as
 * `rev:training-manual=TM-3`). Subjects are compared case-insensitively and
 * values case-insensitively; two different values for one subject are a
 * conflict. Values are compared as exact normalized strings, so `TM-3` and
 * `TM3` are treated as DIFFERENT revisions by design (a formatting difference
 * is itself worth surfacing in a documentation review).
 *
 * Text that attempts a revision declaration (`rev:` / `rev=`) but does not match
 * the contract is reported by {@link findMalformedRevisionMentions} so the
 * fail-open case is visible rather than silently dropped.
 */
const STRUCTURED_REVISION_LINE = /^Revision:\s*([a-z0-9-]+)\s*=\s*([a-z0-9.-]+)\s*$/gim;
const REVISION_TOKEN = /\brev:\s*([a-z0-9-]+)\s*=\s*([a-z0-9.-]+)(?=$|[\s,;)\]}"'])/gi;

// A revision-token *attempt*: `rev:` / `rev=` or `Revision:` / `revision=`.
// This deliberately does NOT match ordinary prose words "review", "reviewer",
// "revision" (those are followed by letters/spaces, not `:` or `=`).
const LEGACY_REVISION_ATTEMPT = /\brev\s*[:=]/gi;
const STRUCTURED_REVISION_ATTEMPT = /\brevision\s*[:=]/gi;

export function detectCrossDocumentConflicts(
  sources: EvidenceSource[]
): EvidenceClaim[] {
  // subject -> (normalized value -> set of source ids that declared it)
  const bySubject = new Map<string, Map<string, Set<string>>>();

  for (const source of sources) {
    const text = `${source.label}\n${source.excerpt ?? ""}`;
    for (const declaration of revisionDeclarations(text)) {
      const subject = declaration.subject.toLowerCase();
      const value = declaration.value.toUpperCase();
      if (!bySubject.has(subject)) {
        bySubject.set(subject, new Map());
      }
      const values = bySubject.get(subject)!;
      if (!values.has(value)) {
        values.set(value, new Set());
      }
      values.get(value)!.add(source.id);
    }
  }

  const conflicts: EvidenceClaim[] = [];
  for (const [subject, values] of bySubject) {
    // One agreed value across all documents -> no conflict.
    if (values.size < 2) {
      continue;
    }
    const label = subject.replace(/-/g, " ");
    const distinctValues = [...values.keys()];
    const sourceIds = [
      ...new Set([...values.values()].flatMap((set) => [...set]))
    ];

    conflicts.push(
      EvidenceClaimSchema.parse({
        id: `claim.crosscheck.${subject}`,
        statement: `Documents disagree about the ${label} revision`,
        claimType: "config_documentation",
        status: "conflict",
        evidenceSourceIds: sourceIds,
        lockReason: `Conflicting ${label} revision across sources: ${distinctValues.join(" vs ")}`
      })
    );
  }

  return conflicts;
}

function revisionDeclarations(text: string): Array<{ subject: string; value: string }> {
  const structured = [...text.matchAll(STRUCTURED_REVISION_LINE)].map((match) => ({
    subject: match[1],
    value: match[2]
  }));
  const legacy = [...text.matchAll(REVISION_TOKEN)].map((match) => ({
    subject: match[1],
    value: match[2]
  }));

  return [...structured, ...legacy];
}

export type MalformedRevisionMention = {
  sourceId: string;
  label: string;
};

/**
 * Finds sources that try to declare a revision (`rev:` / `rev=` / `Revision:`)
 * but do not satisfy the token contract, so a malformed declaration surfaces as
 * a warning instead of failing open silently.
 */
export function findMalformedRevisionMentions(
  sources: EvidenceSource[]
): MalformedRevisionMention[] {
  const mentions: MalformedRevisionMention[] = [];

  for (const source of sources) {
    const text = `${source.label}\n${source.excerpt ?? ""}`;
    const legacyAttempts = (text.match(LEGACY_REVISION_ATTEMPT) ?? []).length;
    const structuredAttempts = (text.match(STRUCTURED_REVISION_ATTEMPT) ?? []).length;
    if (legacyAttempts === 0 && structuredAttempts === 0) {
      continue;
    }

    const validLegacy = [...text.matchAll(REVISION_TOKEN)].length;
    const validStructured = [...text.matchAll(STRUCTURED_REVISION_LINE)].length;
    if (legacyAttempts > validLegacy || structuredAttempts > validStructured) {
      mentions.push({ sourceId: source.id, label: source.label });
    }
  }

  return mentions;
}

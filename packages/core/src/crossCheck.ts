import {
  EvidenceClaimSchema,
  type EvidenceClaim,
  type EvidenceSource
} from "./schemas";

/**
 * Real cross-document analysis.
 *
 * Scans evidence-source text for declared revision tokens and DERIVES a
 * `conflict` claim when the same subject is given different values by different
 * source documents. The conflict status is computed by comparing the documents
 * — it is never read from a hand-typed status column. Documentation QA only;
 * this does not touch operational data.
 *
 * INPUT CONTRACT — a revision declaration is written as:
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
const REVISION_TOKEN = /rev:\s*([a-z0-9-]+)\s*=\s*([a-z0-9.-]+)/gi;

// A revision-token *attempt*: `rev:` or `rev=`. This deliberately does NOT match
// the prose words "review", "reviewer", "revision" (those are `rev` + a letter,
// not `rev` + `:`/`=`), so it only fires on malformed declarations.
const REVISION_ATTEMPT = /\brev[:=]/i;

export function detectCrossDocumentConflicts(
  sources: EvidenceSource[]
): EvidenceClaim[] {
  // subject -> (normalized value -> set of source ids that declared it)
  const bySubject = new Map<string, Map<string, Set<string>>>();

  for (const source of sources) {
    const text = `${source.label} ${source.excerpt ?? ""}`;
    for (const match of text.matchAll(REVISION_TOKEN)) {
      const subject = match[1].toLowerCase();
      const value = match[2].toUpperCase();
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

export type MalformedRevisionMention = {
  sourceId: string;
  label: string;
};

/**
 * Finds sources that try to declare a revision (`rev:` / `rev=`) but do not
 * satisfy the token contract, so a malformed declaration surfaces as a warning
 * instead of failing open silently.
 */
export function findMalformedRevisionMentions(
  sources: EvidenceSource[]
): MalformedRevisionMention[] {
  const mentions: MalformedRevisionMention[] = [];

  for (const source of sources) {
    const text = `${source.label} ${source.excerpt ?? ""}`;
    if (!REVISION_ATTEMPT.test(text)) {
      continue;
    }
    // Compare the number of revision *attempts* to the number of well-formed
    // tokens: this also flags a source that mixes a valid token with a
    // malformed one (counting attempts, not "has at least one valid token").
    const attempts = (text.match(/\brev[:=]/gi) ?? []).length;
    const valid = [...text.matchAll(REVISION_TOKEN)].length;
    if (attempts > valid) {
      mentions.push({ sourceId: source.id, label: source.label });
    }
  }

  return mentions;
}

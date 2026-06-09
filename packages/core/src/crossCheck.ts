import {
  EvidenceClaimSchema,
  type EvidenceClaim,
  type EvidenceSource
} from "./schemas";

/**
 * Real cross-document analysis.
 *
 * Scans evidence-source text for declared revision tokens of the form
 * `rev:<subject>=<value>` and DERIVES a `conflict` claim when the same subject
 * is given different values by different source documents. The conflict status
 * is computed by comparing the documents — it is never read from a hand-typed
 * status column. Documentation QA only; this does not touch operational data.
 */
const REVISION_TOKEN = /rev:([a-z0-9-]+)=([a-z0-9.-]+)/gi;

export function detectCrossDocumentConflicts(
  sources: EvidenceSource[]
): EvidenceClaim[] {
  // subject -> (normalized value -> set of source ids that declared it)
  const bySubject = new Map<string, Map<string, Set<string>>>();

  for (const source of sources) {
    const text = `${source.label} ${source.excerpt}`;
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

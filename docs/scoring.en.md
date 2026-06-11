# How the documentation readiness score works

*[Українською](scoring.md) · English*

> The score measures the **completeness and trustworthiness of the documentation evidence chain** —
> not real-world or operational readiness. A high score never means "approved to operate."

## The formula

Every claim in the evidence graph has one status: `verified`, `partial`, `locked`, or `conflict`.
The score starts at 100 and deducts points for what weakens trust in the record:

```text
score = 100
      − 6  × (locked critical claims)       capped at 48
      − 8  × (conflicting claims)           capped at 24
      − 3  × (partial claims)               capped at 24
      − 2  × (warnings)                     capped at 16
      − 10 × (missing required artifacts)   capped at 30

score = clamp(score, 0, 100)
if any critical claim is in conflict → score is capped at 49 (Blocked)
```

The weights reflect how much each issue hurts trust: a **conflict** (sources actively disagree) and
a **locked** claim (no supporting evidence) hurt most, a **partial** claim (some evidence, not
enough) hurts less, and a process **warning** is the lightest signal.

Derived `partial` claims compound intentionally: they deduct once in the `partial` bucket and also
create an automatic warning, because weak evidence is both an evidence-quality gap and a review item.

## Ingested labels vs engine-derived status

The synthetic inputs carry a reviewer-written `Status` column. The engine treats that column as an
**assertion to check, not a fact to copy**. For every claim it independently re-derives a status from
the structure of the evidence (`packages/rules/src/deriveStatus.ts`) and may only ever make the
verdict **more conservative** than the reviewer claimed — it never inflates a status:

- **No / dangling evidence → `locked`.** A claim whose linked source does not exist cannot be
  supported, whatever the column says.
- **Test-record claims are graded by their own logged outcome.** A check marked `verified` whose test
  result is `fail`/`blocked` is overridden to `locked`; a `warning` result (ingested as `not_tested`)
  becomes `partial`.
- **Cross-document contradiction → `conflict`.** Structured revision declarations are compared across
  documents (`packages/core/src/crossCheck.ts`): a BOM `revision` cell and a QA-notes `Revision:
  subject=value` line are the preferred path, while legacy `rev:subject=value` free-text tokens remain
  a fallback. The disagreement is derived, never typed.

For every other claim the reviewer's status is accepted only as an **upper bound** once the
evidence-presence gate passes. When the documents are internally consistent (as in the demos) the
engine arrives at exactly the reviewer's verdict — which is *why* the demo numbers reproduce — but
`evaluateReadiness` reports an `engineAdjustments` list whenever its verdict and the reviewer's label
diverge. The override is covered by tests (`packages/rules/src/deriveStatus.test.ts`): a `verified`
row whose check actually fails drops the score and records an adjustment.

## Worked example (the live demo)

The synthetic demo package produces:

| Deduction | Count | Points each | Total |
|---|---:|---:|---:|
| Locked critical claims | 5 | 6 | −30 |
| Partial claims | 4 | 3 | −12 |
| Warnings | 7 | 2 | −14 |
| **Readiness score** | | | **44 / 100** |

So the headline `44/100` is not a vibe — it is `100 − 30 − 12 − 14`, fully reproducible with
`npm run demo:readiness`.

## How to read the bands

| Band | Range | Plain meaning |
|---|---:|---|
| Strong package | 85–100 | Documentation is well structured and mostly evidenced (still **not** operational readiness). |
| Reviewable, incomplete | 70–84 | Usable for review, but gaps remain before serious sign-off. |
| Confidence reduced | 50–69 | The evidence chain is useful, but partials/gaps lower trust. |
| Blocked | 0–49 | Missing proof or contradictions block a positive conclusion. |

The demo sits in **Blocked (44)** on purpose: it is a strict tool, so unsupported claims are not
inflated — they stay locked. A low number here is a sign of **honesty**, not weakness.

## Why low scores are a feature

The core rule of this project is `no evidence → locked`. The score is designed so that the only way
to raise it is to **add real evidence**, not to soften the rules. That is exactly the engineering
discipline the project is meant to demonstrate.

## Guards

The formula has guards so the number stays principled even as the data changes:

- **Per-category caps** — no single bucket can sink the score on its own.
- **Conflict gate** — if any critical claim is in conflict, the verdict is capped in the Blocked
  band until the contradiction is resolved. (A contradiction can never read as "ready".)
- **Floor of zero** — the score never goes negative.

These run in the tool today. The original `demo-uav-readiness` package has no conflicts and hits no
caps, so the worked example above is unaffected (still 44/100). The `demo-conflict-readiness` bundle
deliberately triggers the conflict gate and is capped at 49/100.

# How the documentation readiness score works

> The score measures the **completeness and trustworthiness of the documentation evidence chain** —
> not real-world or operational readiness. A high score never means "approved to operate."

**Простими словами:** оцінка готовності — це про якість і повноту *документів і доказів*, а не дозвіл
щось робити в реальності. Низька оцінка означає, що паперам бракує підтверджень, а не що проєкт сирий.

## The formula

Every claim in the evidence graph has one status: `verified`, `partial`, `locked`, or `conflict`.
The score starts at 100 and deducts points for what weakens trust in the record:

```text
score = 100
      − 6 × (locked critical claims)
      − 3 × (partial claims)
      − 2 × (warnings)

score = clamp(score, 0, 100)
```

The weights reflect how much each issue hurts trust: a **locked** claim (no supporting evidence at
all) hurts most, a **partial** claim (some evidence, not enough) hurts less, and a process
**warning** is the lightest signal.

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

## Planned refinement

A future revision (tracked in research notes) will move to fully orthogonal buckets with per-category
caps and treat `conflict` as a hard gate (a contradiction on a critical claim cannot yield a positive
verdict). That change will also be transparent and documented here. Until then, the formula above is
the exact one the tool runs.

**Простими словами:** єдиний чесний спосіб підняти оцінку — додати справжній доказ, а не пом'якшити
правила. У цьому й сенс.

# Where this maps in real documentation practice

*[Українською](standards.md) · English*

> **Scope disclaimer**
>
> Educational mapping of publicly known documentation categories only. This is **not** a
> certification or compliance tool. Synthetic demo data only. Not operationally valid.
>
> Лише синтетичні демо-дані. Не є операційно достовірними.

Defense engineering reviews are often evidence-package reviews: reviewers ask which documents exist,
which claims are backed by records, which revisions disagree, and which gaps must stay blocked until
evidence appears. This project is a toy-scale rehearsal of that discipline. It demonstrates
documentation completeness and consistency checks, not any real authorization or certification result.

## Educational crosswalk

| Engine concept | Public documentation-practice counterpart |
|---|---|
| BOM parsing | TDP parts and drawing indexes, in the broad MIL-STD-31000 family sense |
| `test_log` evidence grading | Acceptance and verification records |
| Traceability-matrix CSV | Requirements traceability |
| Conflict gate | Cross-document consistency review before sign-off |
| `no evidence -> locked` | "No credit without a verification record" culture, familiar from DO-178C-style reviews |
| Readiness bands | Documentation-maturity gates in design reviews |
| SARIF export | Findings feeding a review-board queue |

This is a category-level map. It does not reproduce standard text, clause wording, controlled content,
or acceptance criteria.

## STANAG 4671 category-level fit

UAV airworthiness frameworks such as NATO STANAG 4671 anchor certification processes that require
such artifact families for a review context. At a public, high-level category view, those families
can include system descriptions, configuration records, requirements evidence, verification records,
conformity evidence, change records, and continued-documentation records.

For light UAS under ~150 kg — the class the fictional NORDWING-7 kit would sit in — NATO STANAG 4703
plays the analogous role to 4671. The point here stays category-level documentation practice, not a
claim that any demo file satisfies either standard.

This tool demonstrates a narrower question: how the presence, traceability, and consistency of such
artifact categories could be machine-checked in a synthetic folder. It does **not** decide whether a
real evidence package satisfies any standard, and it does not claim STANAG 4671, MIL-STD-31000, or
DO-178C compliance.

## Ukrainian Engineering Documentation Standards Context (ESKD / DSTU)

In the local document auditor rules (`engines/defdoc_ai/defdoc_auditor.py`), Ukrainian ESKD standards serve as reference guidelines for title-block metadata and Technical Specifications (TU) section structure:

- **ДСТУ ГОСТ 2.104:2006** (*Unified system for design documentation. Basic inscriptions*, enacted in Ukraine by Derzhspozhyvstandart Order No. 373 dated 26.12.2006) — referenced for checking completeness of product passport metadata and revision tables;
- **ДСТУ ГОСТ 2.114-97 (ГОСТ 2.114-95)** (*Unified system for design documentation. Technical specifications*, validity in Ukraine renewed by SE "UkrNDNC" Order No. 22 dated 26.02.2026 for the period `01.03.2026` to `25.11.2027`) — referenced for Technical Specifications (TU) section structure and tabular cross-checks against acceptance test protocols (PMV).

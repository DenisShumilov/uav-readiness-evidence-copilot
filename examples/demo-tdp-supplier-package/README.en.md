# Technical Data Package (TDP)-style supplier package demo

*[Українською](README.md) · English*

Synthetic demo data only. Not operationally valid.

Лише синтетичні демо-дані. Не є операційно достовірними.

Educational mapping of publicly known documentation categories only. This is **not** a certification
or compliance tool.

A **fourth** synthetic bundle framed as the review worksheet a documentation team prepares from an
incoming supplier package for a fictional small UAS airframe kit: `NORDWING-7 trainer airframe kit`.
The scenario is recognizable to defense-tech documentation teams, but every row is fake and static.

## Run

```powershell
npm run demo:tdp
```

Output is written to `examples/demo-tdp-supplier-package/output/` (not committed).

## What it shows

The visible worksheet files live in `input/`:

- `vendor_BOM.csv`
- `acceptance_test_log.csv`
- `qa_inspection_notes.md`
- `manual_excerpt.md`

The same content is mirrored to the parser's four current root filenames (`BOM.csv`,
`test_log.csv`, `qa_notes.md`, `demo_manual.md`) so this bundle uses the existing parsers with no new
parser code.

Planted review findings:

- two unevidenced worksheet claims stay `locked`;
- the fastener set lot certificate cross-reference stays `partial` because the certificate references
  a lot id absent from the BOM index;
- the worksheet BOM `revision` cell says `nordwing-kit=R03`, while the QA notes line says
  `Revision: nordwing-kit=R02`, so the conflict gate fires.

Expected verdict: **49/100 (Blocked)**. The score is about documentation completeness and
consistency only; it is not a real approval result.

Labeling policy: every file is synthetic demo data only and not operationally valid.

Standards context: see [Where this maps in real documentation practice](../../docs/standards.en.md).

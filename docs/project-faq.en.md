# Project FAQ

*[Українською](project-faq.md) · English*

## What is the UAV Readiness & Evidence Copilot?

The UAV Readiness & Evidence Copilot is a safe tool for reviewing UAV and robotics engineering documentation. It reads training files and generates an evidence-backed review package: a text report, an evidence map, a traceability matrix, digital file fingerprints, and a demo page.

## Who is this project for?

For engineering, QA, documentation, and internal teams that need to quickly check whether claims are backed by evidence.

## Which files does the current MVP read?

The current MVP (Minimum Viable Product) reads only four training input files:

- `BOM.csv`
- `demo_manual.md`
- `test_log.csv`
- `qa_notes.md`

Future training files live in `examples/demo-uav-readiness/future-fixtures/`, but the current MVP does not read them yet.

## What does the project generate?

The demo command generates:

- demo pages;
- a text report on documentation readiness;
- a JSON file with the evidence map;
- a JSON file with the documentation readiness score;
- a CSV file with the traceability matrix;
- a file with digital fingerprints of the input files.

## What is the main rule?

The main rule:

```text
No evidence -> locked.
```

If the tool does not find evidence for a claim, it leaves that claim locked and does not invent an answer.

## Why can the readiness score in the demo be low?

The demo deliberately includes verified, partial, warning, and locked examples. A lower score shows that the tool is strict and does not pass off incomplete evidence as full readiness.

## What does the project not do?

It does not control drones or robots, does not process live data from systems, does not generate routes or movement points, does not support payload operation, targeting, or tactical advice, and does not connect to real aircraft, radio modules, sensors, or field systems.

## Is the data real?

No. All demo data is for training, static, and not taken from real-world use.

## How do I run it?

```powershell
npm install
npm run demo:readiness
```

Open:

```text
examples/demo-uav-readiness/output/portfolio-demo.html
```

## How is quality verified?

The repository uses TypeScript, Zod, Vitest, npm audit, and GitHub Actions. Local checks:

```powershell
npm run typecheck
npm test
npm audit --audit-level=moderate
```

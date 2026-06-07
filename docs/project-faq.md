# Project FAQ

## What is UAV Readiness & Evidence Copilot?

UAV Readiness & Evidence Copilot is a safe documentation QA tool for synthetic UAV and robotics engineering artifacts. It turns demo files into evidence-backed outputs: readiness report, evidence graph, traceability CSV, artifact hashes, and a static portfolio page.

## Who is it for?

The project is designed for engineering, QA, documentation, and internal-tooling teams that need to review whether claims are supported by evidence.

## What data does the MVP parse?

The current MVP parses only four synthetic input files:

- `BOM.csv`
- `demo_manual.md`
- `test_log.csv`
- `qa_notes.md`

Future-only fixtures are stored under `examples/demo-uav-readiness/future-fixtures/` and are not parsed by the current MVP.

## What does the project generate?

The demo command generates:

- static portfolio demo pages;
- markdown readiness report;
- evidence graph JSON;
- readiness assessment JSON;
- traceability matrix CSV;
- artifact hash manifest.

## What is the core rule?

The core rule is:

```text
No evidence -> locked.
```

If the tool cannot find evidence for a claim, it keeps that claim locked instead of guessing.

## Why can the readiness score be low in the demo?

The demo intentionally includes verified, partial, warning, and locked examples. A lower score shows that the tool is strict and does not pretend missing evidence is complete.

## What does the project not do?

It does not control drones or robots, process live telemetry, generate routes or waypoints, support payload operation, support targeting, provide tactical advice, or connect to real aircraft, radios, sensors, or field systems.

## Is the data real?

No. All demo data is synthetic, static, and educational.

## How do I run it?

```powershell
npm install
npm run demo:readiness
```

Open:

```text
examples/demo-uav-readiness/output/portfolio-demo.html
```

## How is quality checked?

The repository uses TypeScript, Zod, Vitest, npm audit, and GitHub Actions CI. Local checks are:

```powershell
npm run typecheck
npm test
npm audit --audit-level=moderate
```

# UAV Readiness & Evidence Copilot

[Українська версія](README.md)

[![CI](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/actions/workflows/ci.yml/badge.svg)](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/actions/workflows/ci.yml)

Evidence-first QA workspace for UAV and robotics engineering documentation.

UAV Readiness & Evidence Copilot turns synthetic engineering artifacts into an evidence-backed readiness package: parsed inputs, evidence graph, locked findings, traceability CSV, artifact hashes, markdown report, and static portfolio demo.

## Demo Video

Final demo videos are published through GitHub Releases, not committed as binary files.

- [English MP4 demo](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/download/v0.1.0-demo-video/uav-readiness-demo.en.final.mp4)
- [Ukrainian MP4 demo](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/download/v0.1.0-demo-video/uav-readiness-demo.uk.final.mp4)
- [Release page](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/tag/v0.1.0-demo-video)

## Demo Screenshot

![Portfolio demo screenshot](docs/assets/demo-screenshot.png)

## What It Does

- Parses 4 synthetic documentation inputs.
- Builds an evidence graph for claims, sources, and locks.
- Shows verified, partial, and locked evidence.
- Calculates a documentation readiness score.
- Generates markdown, JSON, CSV, and static HTML outputs.
- Runs through TypeScript, Vitest, npm audit, and GitHub Actions CI.

## Why It Matters

Engineering teams often have scattered documents, logs, and QA notes, but need a fast way to see what is actually supported by evidence.

This project demonstrates a safe internal-tool workflow for documentation readiness, audit preparation, and handoff review.

Core rule:

```text
No evidence -> locked.
```

## Safety Boundaries

This is a documentation, QA, and portfolio project only.

It does not control drones or robots, process live telemetry, generate routes or waypoints, support payload operation, support targeting, provide tactical advice, or connect to real aircraft, radios, sensors, or field systems.

All demo data is synthetic, static, and educational.

## Quick Start

```powershell
npm install
npm run demo:readiness
```

Open:

```text
examples/demo-uav-readiness/output/portfolio-demo.html
```

Run checks:

```powershell
npm run typecheck
npm test
npm audit --audit-level=moderate
```

## Inputs

Active parsed inputs:

- `BOM.csv`
- `demo_manual.md`
- `test_log.csv`
- `qa_notes.md`

Future-only fixtures:

- `future-fixtures/wiring_notes.yaml`
- `future-fixtures/config_dump.txt`

The current MVP parses only the active inputs.

## Outputs

Generated outputs live in:

```text
examples/demo-uav-readiness/output/
```

Current outputs:

- `portfolio-demo.html`
- `portfolio-demo.en.html`
- `portfolio-demo.uk.html`
- `readiness-report.md`
- `evidence-graph.json`
- `readiness-assessment.json`
- `traceability-matrix.csv`
- `artifact-hashes.json`

## Architecture

```text
synthetic demo artifacts
  -> parsers
  -> schemas
  -> evidence graph
  -> readiness rules
  -> reports and portfolio outputs
```

See [docs/architecture.md](docs/architecture.md) for the detailed data flow.

## Tech Stack

- TypeScript
- Zod
- Vitest
- tsx
- Node.js
- Playwright
- ffmpeg
- GitHub Actions

## Documentation

- [Project FAQ](docs/project-faq.md)
- [Architecture](docs/architecture.md)
- [Safety boundaries](docs/safety-boundaries.md)
- [Evidence model](docs/evidence-model.md)
- [Demo data policy](docs/demo-data-policy.md)
- [Glossary](docs/glossary.md)

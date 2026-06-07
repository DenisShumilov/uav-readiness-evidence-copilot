# UAV Readiness & Evidence Copilot

[![CI](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/actions/workflows/ci.yml/badge.svg)](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/actions/workflows/ci.yml)

[Українська версія](README.uk.md)

Evidence-first QA workspace for UAV and robotics engineering documentation.

UAV Readiness & Evidence Copilot turns synthetic engineering artifacts into an evidence-backed readiness package: parsed inputs, evidence graph, locked findings, traceability CSV, artifact hashes, markdown report, and recruiter-friendly portfolio demo.

## Demo Video

Final demo videos are published through GitHub Releases, not committed as binary files.

- [English MP4 demo](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/download/v0.1.0-demo-video/uav-readiness-demo.en.final.mp4)
- [Ukrainian MP4 demo](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/download/v0.1.0-demo-video/uav-readiness-demo.uk.final.mp4)
- [Release page](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/tag/v0.1.0-demo-video)
- [Video generation details](demo-video/README.md)

## Demo Screenshot

![Portfolio demo screenshot](docs/assets/demo-screenshot.png)

## What It Demonstrates

- Evidence-first engineering QA workflow
- TypeScript data modeling with Zod schemas
- Safe parsers for synthetic documentation artifacts
- Evidence graph and locked-step handling
- Readiness scoring with explainable rules
- Traceability matrix and artifact hash generation
- Markdown and static HTML portfolio outputs
- GitHub Actions CI for typecheck, tests, and audit

## Why It Matters

Engineering teams need fast ways to see which documentation claims are supported, incomplete, or blocked. This project demonstrates a safe internal-tool workflow for documentation readiness, audit preparation, and handoff review.

The core rule is:

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

Synthetic demo inputs live in:

```text
examples/demo-uav-readiness/
```

Active parsed inputs:

- `BOM.csv`
- `demo_manual.md`
- `test_log.csv`
- `qa_notes.md`

Planned future fixtures:

- `future-fixtures/wiring_notes.yaml`
- `future-fixtures/config_dump.txt`

Only documentation-safe synthetic inputs are parsed in the current MVP.

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

Main folders:

- `packages/core/`
- `packages/parsers/`
- `packages/evidence/`
- `packages/rules/`
- `packages/reports/`
- `packages/qa/`
- `examples/demo-uav-readiness/`
- `demo-video/`
- `docs/`

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
- [Concept glossary](docs/explain-like-new.md)
- [Demo video pipeline](demo-video/README.md)
- [Roadmap](docs/roadmap.md)
- [Release checklist](docs/release-checklist.md)

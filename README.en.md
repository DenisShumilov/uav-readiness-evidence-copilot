# UAV Readiness & Evidence Copilot

[Українська версія](README.md)

> Evidence-first QA for UAV / robotics engineering documentation: evidence graph, locked findings, readiness score, traceability.
>
> **The intelligence is in the scaffold, not the model.**

[![CI](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/actions/workflows/ci.yml/badge.svg)](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/live-demo-2556c7)](https://denisshumilov.github.io/uav-readiness-evidence-copilot/)
[![License: MIT](https://img.shields.io/badge/license-MIT-1d7f58.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-monorepo-3178C6)](#tech-stack)
[![Tests: Vitest](https://img.shields.io/badge/tests-Vitest-6E9F18)](#tech-stack)

<p align="center">
  <a href="https://denisshumilov.github.io/uav-readiness-evidence-copilot/">
    <img src="docs/assets/hero-dashboard.png" alt="Live demo page: 44/100 readiness score, evidence map, and the thesis 'The intelligence is in the scaffold, not the model'" width="100%" />
  </a>
</p>

**Live demo:** https://denisshumilov.github.io/uav-readiness-evidence-copilot/ — an interactive dashboard: toggle evidence sources and watch the readiness score recompute while claims turn `locked`.

UAV Readiness & Evidence Copilot turns synthetic engineering artifacts into an evidence-backed readiness package: parsed inputs, evidence graph, locked findings, traceability CSV, artifact hashes, markdown report, and a static portfolio demo. It is built not by one model, but by a scaffold of rules, roles, and checks around it.

## TL;DR

- Parses 4 synthetic inputs (BOM, manual, test log, QA notes).
- Builds an evidence graph for claims, sources, and locks.
- Never invents confirmation: **no evidence -> locked**.
- Computes a documentation readiness score with explainable rules.
- Exports a report, JSON, traceability CSV, artifact hashes, and a demo page.
- The point: reliability comes from the scaffold (rules, roles, checks), not the model.

## Demo Video

Final demo videos are published through GitHub Releases, not committed as binary files.

- [Online demo page](https://denisshumilov.github.io/uav-readiness-evidence-copilot/)
- [Ukrainian MP4 demo](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/download/v0.5.0-demo-video/uav-readiness-demo.uk.final.mp4)
- [English MP4 demo](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/download/v0.5.0-demo-video/uav-readiness-demo.en.final.mp4)
- [Demo video release v5 (live interactive site)](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/tag/v0.5.0-demo-video)

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

The strict safety boundary here is a **strength, not a disclaimer**: it shows engineering discipline and scope control. This is a documentation, QA, and portfolio project only.

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

## Three demo bundles

- `npm run demo:readiness` — the strict `demo-uav-readiness` bundle (**44/100**, "not ready"): many gaps and locked items.
- `npm run demo:maintenance` — the mostly-organized `demo-maintenance-readiness` bundle (**80/100**, "reviewable, but incomplete"): same pipeline, different document shape, different result.
- `npm run demo:conflict` — the `demo-conflict-readiness` bundle (**49/100**): almost fully evidenced, but one **contradiction** between sources — the conflict gate caps the verdict in the Blocked band (deductions alone would give ~90).

This shows the tool generalizes and never rubber-stamps a score — it keeps claims `partial`/`locked` and refuses a "ready" verdict when sources disagree.

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

Generated outputs are created locally by `npm run demo:readiness` in:

```text
examples/demo-uav-readiness/output/
```

This folder is not committed to the repository. For public viewing, use the online demo page and GitHub Release MP4 videos.

Current outputs:

- `portfolio-demo.md`
- `portfolio-demo.html`
- `portfolio-demo.en.html`
- `portfolio-demo.uk.html`
- `readiness-report.md`
- `evidence-graph.json`
- `readiness-assessment.json`
- `traceability-matrix.csv`
- `artifact-hashes.json`
- `readiness.sarif` — SARIF 2.1.0 (GitHub code scanning format)

## Architecture

```text
synthetic demo artifacts
  -> parsers
  -> schemas
  -> evidence graph
  -> readiness rules
  -> reports and portfolio outputs
```

See [docs/architecture.en.md](docs/architecture.en.md) for the detailed data flow.

## How it was built — a scaffold of 10 agents

This repo was built not by one model, but by a **scaffold**: persistent rules in [AGENTS.md](AGENTS.md), 10 specialist agents, 7 reusable skills, and mandatory gates (doubt gate, red-team, evidence lock, self-review).

Full write-up with a diagram, role table, and a real safety-agent refusal: **[docs/scaffold.en.md](docs/scaffold.en.md)**.

Core thesis: **the intelligence is in the scaffold around the model, not in the model itself.**

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

- [How it was built — a scaffold of 10 agents](docs/scaffold.en.md)
- [AGENTS.md — the rules core](AGENTS.md)
- [How the readiness score works](docs/scoring.en.md)
- [Output schemas & SARIF](schemas/README.md)
- [Project FAQ](docs/project-faq.en.md)
- [Architecture](docs/architecture.en.md)
- [Safety boundaries](docs/safety-boundaries.en.md)
- [Evidence model](docs/evidence-model.en.md)
- [Demo data policy](docs/demo-data-policy.en.md)
- [Glossary](docs/glossary.en.md)

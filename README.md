# UAV Readiness & Evidence Copilot

[English version](README.en.md)

[![CI](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/actions/workflows/ci.yml/badge.svg)](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/actions/workflows/ci.yml)

QA-інструмент для UAV та robotics документації, побудований навколо принципу evidence-first.

UAV Readiness & Evidence Copilot читає синтетичні інженерні документи, будує evidence graph, показує locked findings, рахує readiness score і генерує готовий пакет для review: traceability CSV, artifact hashes, markdown report та static portfolio demo.

## Demo Video

Фінальні demo videos опубліковані через GitHub Releases, а не збережені як важкі binary files у репозиторії.

- [English MP4 demo](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/download/v0.1.0-demo-video/uav-readiness-demo.en.final.mp4)
- [Ukrainian MP4 demo](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/download/v0.1.0-demo-video/uav-readiness-demo.uk.final.mp4)
- [Release page](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/tag/v0.1.0-demo-video)

## Demo Screenshot

![Portfolio demo screenshot українською](docs/assets/demo-screenshot.uk.png)

## Що робить

- Читає 4 synthetic documentation inputs.
- Будує evidence graph для claims, sources і locks.
- Показує verified, partial і locked evidence.
- Рахує documentation readiness score.
- Генерує markdown, JSON, CSV і static HTML outputs.
- Перевіряється через TypeScript, Vitest, npm audit і GitHub Actions CI.

## Чому це важливо

Engineering teams часто мають багато документів, logs і QA notes, але не завжди швидко бачать, що реально підтверджено доказами.

Цей проєкт демонструє safe internal-tool workflow для documentation readiness, audit preparation і handoff review.

Core rule:

```text
No evidence -> locked.
```

## Safety Boundaries

Це тільки documentation, QA і portfolio project.

Проєкт не керує дронами або роботами, не обробляє live telemetry, не генерує routes або waypoints, не підтримує payload operation, targeting, tactical advice і не підключається до real aircraft, radios, sensors або field systems.

Усі demo data synthetic, static і educational.

## Quick Start

```powershell
npm install
npm run demo:readiness
```

Open:

```text
examples/demo-uav-readiness/output/portfolio-demo.uk.html
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

Поточний MVP читає тільки active parsed inputs.

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

Core stack:

- TypeScript
- Zod
- Vitest
- tsx
- Node.js
- GitHub Actions

Demo media stack:

- Playwright
- ffmpeg

## Documentation

- [Project FAQ](docs/project-faq.md)
- [Architecture](docs/architecture.md)
- [Safety boundaries](docs/safety-boundaries.md)
- [Evidence model](docs/evidence-model.md)
- [Demo data policy](docs/demo-data-policy.md)
- [Glossary](docs/glossary.md)

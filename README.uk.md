# UAV Readiness & Evidence Copilot

[English README](README.md)

Evidence-first QA workspace для безпечної UAV/robotics інженерної документації.

Проєкт перетворює synthetic demo artifacts (фейкові навчальні файли) у readiness package (пакет готовності): parsed inputs, evidence graph, locked findings, traceability CSV, artifact hashes, markdown report і portfolio demo.

## Demo Video

Фінальний demo формат — MP4, не GIF. Відео доступні через GitHub Release, а не зберігаються як важкі binary files у repo.

- [English MP4 demo](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/download/v0.1.0-demo-video/uav-readiness-demo.en.final.mp4)
- [Ukrainian MP4 demo](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/download/v0.1.0-demo-video/uav-readiness-demo.uk.final.mp4)
- [Release page](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/tag/v0.1.0-demo-video)

## Demo Screenshot

![Portfolio demo screenshot українською](docs/assets/demo-screenshot.uk.png)

## Що показує проєкт

- evidence-first QA workflow;
- TypeScript data modeling із Zod schemas;
- safe parsers для synthetic documentation artifacts;
- evidence graph і locked-step logic;
- readiness score з простими правилами;
- traceability matrix і artifact hashes;
- markdown/static HTML portfolio outputs;
- GitHub Actions CI для typecheck, tests і audit.

## Чому це корисно

Команді треба швидко бачити, які твердження підтверджені доказами, які неповні, а які заблоковані. Проєкт показує безпечний internal-tool workflow для documentation readiness, audit preparation і handoff review.

Головне правило:

```text
No evidence -> locked.
```

## Safety Boundaries

Це тільки documentation, QA і portfolio project.

Проєкт не керує дронами або роботами, не обробляє live telemetry, не генерує маршрути, не працює з payload, targeting, tactical advice або реальними польовими системами.

Усі demo data synthetic, static і educational.

## Quick Start

```powershell
npm install
npm run demo:readiness
```

Відкрити:

```text
examples/demo-uav-readiness/output/portfolio-demo.uk.html
```

Перевірки:

```powershell
npm run typecheck
npm test
npm audit --audit-level=moderate
```

## Video Pipeline

Перегенерувати локальні MP4:

```powershell
npm run demo:readiness
npm run demo:video:record:hq
npm run demo:video:build
npm run demo:video:voiceover
npm run demo:video:merge
npm run demo:video:qa
```

Локальні MP4 ignored by Git:

```text
demo-video/videos/final/uav-readiness-demo.en.final.mp4
demo-video/videos/final/uav-readiness-demo.uk.final.mp4
```

GIF лишається тільки optional preview.

## Portfolio Materials

- [Final interview pack українською](docs/final-interview-pack.uk.md)
- [Portfolio package українською](docs/final-portfolio-package.uk.md)
- [Словник понять](docs/explain-like-new.md)
- [Demo video pipeline](demo-video/README.md)

# UAV Readiness & Evidence Copilot

[English version](README.en.md)

[![CI](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/actions/workflows/ci.yml/badge.svg)](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/actions/workflows/ci.yml)

Інструмент для перевірки інженерної документації UAV та robotics з фокусом на доказах.

UAV Readiness & Evidence Copilot читає навчальні файли, будує карту доказів, показує заблоковані висновки, рахує оцінку готовності документації і генерує пакет перевірки з доказами: матрицю простежуваності, цифрові відбитки файлів, текстовий звіт та демо-сторінку.

## Демо-відео

Фінальні MP4-відео опубліковані через GitHub Release, а не зберігаються як важкі файли в репозиторії.

- [Онлайн-сторінка демо](https://denisshumilov.github.io/uav-readiness-evidence-copilot/)
- [Українське MP4-демо](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/download/v0.3.0-demo-video/uav-readiness-demo.uk.final.mp4)
- [Англійське MP4-демо](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/download/v0.2.0-demo-video/uav-readiness-demo.en.final.mp4)
- [Реліз українського демо v3](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/tag/v0.3.0-demo-video)
- [Реліз англійського демо](https://github.com/DenisShumilov/uav-readiness-evidence-copilot/releases/tag/v0.2.0-demo-video)

## Скриншот демо

![Скриншот української демо-сторінки](docs/assets/demo-screenshot.uk.png)

## Що робить

- Читає 4 навчальні вхідні файли.
- Будує карту доказів для тверджень, джерел і блокувань.
- Показує підтверджені, часткові та заблоковані докази.
- Рахує оцінку готовності документації.
- Генерує текстовий звіт, JSON, CSV і HTML-сторінки.
- Перевіряється через TypeScript, Vitest, npm audit і GitHub Actions.

## Чому це важливо

Інженерні команди часто мають багато документів, логів і нотаток якості, але не завжди швидко бачать, що реально підтверджено доказами.

Цей проєкт демонструє безпечний внутрішній інструмент для перевірки готовності документації, підготовки до аудиту та передачі матеріалів на рецензування.

Головне правило:

```text
Немає доказу -> заблоковано.
```

## Межі безпеки

Це тільки проєкт для документації, QA і портфоліо.

Проєкт не керує дронами або роботами, не обробляє живі дані з систем, не генерує маршрути або точки руху, не підтримує роботу з корисним навантаженням, наведення, тактичні поради і не підключається до реальних літальних апаратів, радіомодулів, сенсорів або польових систем.

Усі демо-дані навчальні, статичні й не взяті з реального використання.

## Швидкий запуск

```powershell
npm install
npm run demo:readiness
```

Відкрити:

```text
examples/demo-uav-readiness/output/portfolio-demo.uk.html
```

Запустити перевірки:

```powershell
npm run typecheck
npm test
npm audit --audit-level=moderate
```

## Вхідні файли

Активні вхідні файли, які читає MVP:

- `BOM.csv`
- `demo_manual.md`
- `test_log.csv`
- `qa_notes.md`

Майбутні навчальні файли, які поточний MVP ще не читає:

- `future-fixtures/wiring_notes.yaml`
- `future-fixtures/config_dump.txt`

## Результати

Згенеровані результати зберігаються тут:

```text
examples/demo-uav-readiness/output/
```

Поточні результати:

- `portfolio-demo.html`
- `portfolio-demo.en.html`
- `portfolio-demo.uk.html`
- `readiness-report.md`
- `evidence-graph.json`
- `readiness-assessment.json`
- `traceability-matrix.csv`
- `artifact-hashes.json`

## Архітектура

```text
навчальні демо-файли
  -> читачі файлів
  -> правила даних
  -> карта доказів
  -> правила оцінки готовності
  -> звіти та демо-сторінки
```

Детальна схема потоку даних: [docs/architecture.md](docs/architecture.md).

## Технології

Основні технології:

- TypeScript
- Zod
- Vitest
- tsx
- Node.js
- GitHub Actions

Технології для демо-відео:

- Playwright
- ffmpeg

## Документація

- [FAQ про проєкт](docs/project-faq.md)
- [Архітектура](docs/architecture.md)
- [Межі безпеки](docs/safety-boundaries.md)
- [Модель доказів](docs/evidence-model.md)
- [Політика демо-даних](docs/demo-data-policy.md)
- [Словник понять](docs/glossary.md)

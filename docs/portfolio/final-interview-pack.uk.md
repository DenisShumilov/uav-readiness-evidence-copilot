# Final interview pack - українською

## 30-секундний pitch

UAV Readiness & Evidence Copilot — це safe TypeScript QA tool для engineering documentation. Він читає чотири active synthetic demo inputs, зв'язує claims із evidence, тримає missing proof у locked, рахує documentation readiness score і генерує reports, traceability, hashes, static demo pages та GitHub Release MP4 demos.

## 10-секундний pitch

Це safe evidence checker для UAV engineering documentation, не drone control tool.

## Що я реально зробив

- TypeScript schemas для project data.
- Parsers для чотирьох safe synthetic demo inputs: BOM, manual, test log і QA notes.
- Evidence graph builder.
- Readiness rules engine.
- Markdown, JSON, CSV, hash і static HTML outputs.
- English та Ukrainian demo pages.
- CLI command: `npm run demo:readiness`.
- Automated tests з Vitest.
- GitHub Actions CI.
- Demo video storyboard, voiceover scripts і GitHub Release MP4 demos.

## Що я НЕ робив

- Не підключав real drones.
- Не робив drone control.
- Не аналізував live data.
- Не генерував routes.
- Не робив targeting support.
- Не робив payload handling.
- Не заявляв production deployment.
- Не писав, що цим користується реальна компанія.

## Чому це безпечно

Проєкт використовує тільки synthetic demo data.

Він обмежений documentation QA, evidence tracking, traceability і reporting.

Головне правило:

```text
No evidence -> locked.
```

Простими словами: якщо немає доказу, claim не можна позначати як verified.

## 10 питань і короткі відповіді

1. Що це за проєкт?
Safe QA tool для engineering documentation та evidence tracking.

2. Яку проблему він вирішує?
Допомагає побачити, які claims мають proof, а які ні.

3. Що таке parser?
Parser = код, який читає файл і дістає корисні structured data.

4. Що таке evidence graph?
Evidence graph = карта, яка зв'язує claims із proof.

5. Що таке locked step?
Locked step = крок, який заблокований, бо доказу немає.

6. Що таке readiness score?
Це оцінка готовності документації, не дозвіл на real-world operation.

7. Що таке traceability matrix?
Це таблиця: requirement -> evidence -> check -> status -> risk.

8. Що таке artifact hash?
Це цифровий відбиток файлу, щоб розуміти, який файл перевіряли.

9. Які технології використані?
TypeScript, Zod, Vitest, Node.js, CLI scripts, Markdown/JSON/CSV outputs, static HTML і GitHub Actions.

10. Що покращити далі?
Зробити demo video/GIF, safer documentation-only parsers і optional dashboard UI, якщо він лишиться в safety boundaries.

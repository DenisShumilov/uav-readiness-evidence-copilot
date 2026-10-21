# Схеми виводу

*[English](README.md) · Українською*

Схеми JSON (JSON Schemas, draft 2020-12), що описують машиночитані виводи команди `npm run demo:readiness`. Вони документують контракт виводу (output contract — формат вихідних даних) і можуть використовуватися для валідації згенерованих файлів у CI або в подальших інструментах.

- [`readiness-assessment.schema.json`](readiness-assessment.schema.json) — структура файлу `readiness-assessment.json` (лише готовність документації, ніколи не операційна готовність).
- [`evidence-graph.schema.json`](evidence-graph.schema.json) — структура файлу `evidence-graph.json`.

Перевірка також експортується у форматі **SARIF 2.1.0** (`readiness.sarif`) — стандартному форматі результатів статичного аналізу (static analysis), який GitHub може приймати як сповіщення сканування коду (code-scanning alerts).

Усі дані синтетичні та статичні. Проєкт лишається в межах контролю якості документації (QA), доказовості, простежуваності (traceability) та звітності про готовність.

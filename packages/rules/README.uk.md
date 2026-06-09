# packages/rules

*[English](README.md) · Українською*

> Пояснювані правила готовності (readiness rules) для контролю якості документації (documentation QA).

Частина монорепозиторію [UAV Readiness & Evidence Copilot](../../README.md).

## Що містить

- `evaluateReadiness` — оцінка зі 100 балів мінус обмежені (capped) відрахування за заблоковані (locked), конфліктні (conflicting), часткові (partial) та попереджувальні (warning) докази, а також за відсутні артефакти (artifacts)
- бар'єр конфліктів (conflict gate), що обмежує вердикт у смузі «Заблоковано» (Blocked band)

## Межі безпеки

Правила описують лише готовність документації — ніколи операційні, маршрутні (route), щодо корисного навантаження (payload), наведення на ціль (targeting) чи тактичні (tactical) правила.

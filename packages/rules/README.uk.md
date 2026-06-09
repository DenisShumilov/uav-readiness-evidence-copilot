# packages/rules

*[English](README.md) · Українською*

Пояснювані правила готовності (readiness rules) для контролю якості документації (documentation QA).

## Реалізовано

- `evaluateReadiness`

## Підрахунок балів

Оцінка починається зі 100 балів і віднімає бали за заблоковані критичні докази (locked critical evidence), часткові твердження (partial claims), попередження (warnings) та відсутні активні артефакти (active artifacts).

## Сфера застосування

Правила описують лише готовність документації (documentation readiness). Вони не повинні ставати операційними правилами для БПЛА (UAV), маршрутів (route), корисного навантаження (payload), наведення на ціль (targeting) чи тактики (tactical).

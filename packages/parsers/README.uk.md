# packages/parsers

*[English](README.md) · Українською*

> Безпечні парсери (parsers — модулі розбору вхідних даних) для активних синтетичних демонстраційних вхідних даних.

Частина монорепозиторію [UAV Readiness & Evidence Copilot](../../README.md).

## Що містить

- `parseBOMCsv`, `parseManualMd`, `parseTestLogCsv`, `parseQaNotesMd`
- `parseDemoBundle` — збирає повний демонстраційний пакет (demo bundle)
- MVP (minimum viable product — мінімально життєздатний продукт) не розбирає `future-fixtures/wiring_notes.yaml` чи `future-fixtures/config_dump.txt`

## Межі безпеки

Непідтверджені свідчення (evidence — докази відповідності) залишаються зі статусом `locked` (заблоковано); парсери ніколи не домислюють відсутні докази та не зчитують реальні операційні дані БПЛА (безпілотний літальний апарат, UAV).

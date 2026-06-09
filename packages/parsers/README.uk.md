# packages/parsers

*[English](README.md) · Українською*

Безпечні парсери (parsers — модулі розбору вхідних даних) для активних синтетичних демонстраційних вхідних даних.

## Активні парсери

- `parseBOMCsv`
- `parseManualMd`
- `parseTestLogCsv`
- `parseQaNotesMd`
- `parseDemoBundle`

Поточна MVP (minimum viable product — мінімально життєздатний продукт) не розбирає `future-fixtures/wiring_notes.yaml` чи `future-fixtures/config_dump.txt`.

## Правило безпеки

Непідтверджені свідчення (evidence — докази відповідності) залишаються зі статусом `locked` (заблоковано); парсери не повинні домислювати відсутні докази чи зчитувати реальні операційні дані БПЛА (безпілотний літальний апарат).

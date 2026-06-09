# packages/evidence

*[English](README.md) · Українською*

Конструктор графа доказів (evidence graph) для розібраного демонстраційного пакета (parsed demo bundle).

## Реалізовано

- `buildEvidenceGraphFromBundle`

Граф з'єднує артефакти (artifacts), джерела доказів (evidence sources), твердження доказів (evidence claims) та блокування доказів (evidence locks). Основне правило: `No evidence -> locked` (немає доказів -> заблоковано).

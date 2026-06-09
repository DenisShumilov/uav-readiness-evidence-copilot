# packages/evidence

*[English](README.md) · Українською*

> Будує граф доказів (evidence graph) з розібраного демонстраційного пакета (parsed demo bundle).

Частина монорепозиторію [UAV Readiness & Evidence Copilot](../../README.md).

## Що містить

- `buildEvidenceGraphFromBundle` — пов'язує артефакти (artifacts), джерела доказів (evidence sources), твердження (claims) та блокування (locks)

## Межі безпеки

Забезпечує дотримання основного правила `No evidence → locked`; він ніколи не додумує відсутні докази (missing proof).

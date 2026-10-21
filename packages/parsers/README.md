# packages/parsers

*[Українською](README.uk.md) · English*

> Safe parsers for the active synthetic demonstration inputs.

Part of the [UAV Readiness & Evidence Copilot](../../README.md) monorepo.

## What it contains

- `parseBOMCsv`, `parseManualMd`, `parseTestLogCsv`, `parseQaNotesMd`
- `parseDemoBundle` — assembles and validates a complete demonstration bundle
- Does not parse `future-fixtures/wiring_notes.yaml` or `future-fixtures/config_dump.txt`

## Safety boundaries

Unsupported or unverified evidence remains `locked`; parsers never invent missing evidence or ingest real operational UAV data.

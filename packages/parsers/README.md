# packages/parsers

*English · [Українською](README.uk.md)*

> Safe parsers for the active synthetic demo inputs.

Part of the [UAV Readiness & Evidence Copilot](../../README.md) monorepo.

## What it provides

- `parseBOMCsv`, `parseManualMd`, `parseTestLogCsv`, `parseQaNotesMd`
- `parseDemoBundle` — assembles the full demo bundle
- the MVP does not parse `future-fixtures/wiring_notes.yaml` or `future-fixtures/config_dump.txt`

## Safety scope

Unsupported evidence stays `locked`; parsers never infer missing proof or read real operational UAV data.

# packages/parsers

*English · [Українською](README.uk.md)*

Safe parsers for the active synthetic demo inputs.

## Active parsers

- `parseBOMCsv`
- `parseManualMd`
- `parseTestLogCsv`
- `parseQaNotesMd`
- `parseDemoBundle`

The current MVP does not parse `future-fixtures/wiring_notes.yaml` or `future-fixtures/config_dump.txt`.

## Safety rule

Unsupported evidence stays `locked`; parsers must not infer missing proof or read real operational UAV data.

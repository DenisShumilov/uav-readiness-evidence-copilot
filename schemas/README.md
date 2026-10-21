# Output Schemas

*[Українською](README.uk.md) · English*

JSON Schemas (draft 2020-12) describing the machine-readable outputs of `npm run demo:readiness`. They document the output contract and can be used to validate generated files in CI or downstream tooling.

- [`readiness-assessment.schema.json`](readiness-assessment.schema.json) — structure of `readiness-assessment.json` (documentation readiness only, never operational readiness).
- [`evidence-graph.schema.json`](evidence-graph.schema.json) — structure of `evidence-graph.json`.

The check also exports **SARIF 2.1.0** (`readiness.sarif`) — the standard static analysis format that GitHub can ingest as code-scanning alerts.

All data is synthetic and static. The project remains strictly within documentation QA, evidence tracking, traceability, and readiness reporting.

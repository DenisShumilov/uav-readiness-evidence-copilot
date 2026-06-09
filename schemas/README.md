# Output schemas

*English · [Українською](README.uk.md)*

JSON Schemas (draft 2020-12) describing the machine-readable outputs of `npm run demo:readiness`. They document the output contract and can be used to validate generated files in CI or downstream tools.

- [`readiness-assessment.schema.json`](readiness-assessment.schema.json) — shape of `readiness-assessment.json` (documentation readiness only, never operational readiness).
- [`evidence-graph.schema.json`](evidence-graph.schema.json) — shape of `evidence-graph.json`.

The review is also exported as **SARIF 2.1.0** (`readiness.sarif`), the standard static-analysis results format that GitHub can ingest as code-scanning alerts.

All data is synthetic and static. The project stays within documentation QA, evidence, traceability, and readiness reporting.

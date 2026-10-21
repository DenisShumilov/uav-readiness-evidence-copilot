# packages/reports

*[Українською](README.uk.md) · English*

> Report and export generators for the documentation readiness workflow.

Part of the [UAV Readiness & Evidence Copilot](../../README.md) monorepo.

## What it contains

- Readiness report in Markdown (`generateMarkdownReport`)
- Engineering review summary pages in bilingual HTML and Markdown (`generateEngineeringReviewHtml`, `generateEngineeringReviewMarkdown`)
- Traceability matrix in CSV (`generateTraceabilityMatrix`)
- Artifact SHA-256 hash manifest (`generateArtifactHashes`)
- Static analysis export in SARIF 2.1.0 (`generateSarifReport`)

## Safety boundaries

Reports describe documentation readiness only — never operational readiness.

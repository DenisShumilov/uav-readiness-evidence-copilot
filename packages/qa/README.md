# packages/qa

*[Українською](README.uk.md) · English*

> End-to-end smoke tests and repository self-audit checks for the readiness assessment CLI and documentation parity.

Part of the [UAV Readiness & Evidence Copilot](../../README.md) monorepo.

## What it contains

- Verifies that the demo workflow generates the expected Markdown report, evidence graph, readiness assessment, traceability matrix CSV, artifact hashes, SARIF 2.1.0, and bilingual HTML/Markdown engineering review outputs
- Verifies repository parity checks (`selfAudit.ts`) and cross-surface score consistency (`siteParity.test.ts`)

## Safety boundaries

Tests enforce the documentation QA boundary and reject unsafe operational terminology. `No evidence → locked`.

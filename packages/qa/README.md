# packages/qa

*English · [Українською](README.uk.md)*

> End-to-end smoke tests for the demo readiness CLI flow.

Part of the [UAV Readiness & Evidence Copilot](../../README.md) monorepo.

## What it provides

- Verifies the demo command generates the expected report, evidence graph, readiness assessment, traceability matrix, artifact hashes, SARIF, and portfolio demo outputs
- Asserts the generated report stays inside safe wording

## Safety scope

Tests guard the documentation-QA scope and reject unsafe operational wording. `No evidence → locked`.

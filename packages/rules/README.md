# packages/rules

*[Українською](README.uk.md) · English*

> Explainable readiness rules and status derivation for documentation QA.

Part of the [UAV Readiness & Evidence Copilot](../../README.md) monorepo.

## What it contains

- `deriveEvidenceStatuses` — independently re-derives claim statuses from evidence presence, test outcomes, and cross-document revision checks
- `evaluateReadiness` — computes the score from 100 minus capped deductions for locked, conflicting, partial, warning, and missing-artifact counts
- Conflict and zero-evidence gates that cap the verdict in the `Blocked` band

## Safety boundaries

Rules evaluate documentation readiness only — never operational, routing, payload, targeting, or tactical rules.

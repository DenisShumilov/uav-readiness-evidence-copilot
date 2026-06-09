# packages/rules

*English · [Українською](README.uk.md)*

> Explainable readiness rules for documentation QA.

Part of the [UAV Readiness & Evidence Copilot](../../README.en.md) monorepo.

## What it provides

- `evaluateReadiness` — score from 100 minus capped deductions for locked, conflicting, partial, and warning evidence, plus missing artifacts
- a conflict gate that caps the verdict in the Blocked band

## Safety scope

Rules describe documentation readiness only — never operational, route, payload, targeting, or tactical rules.

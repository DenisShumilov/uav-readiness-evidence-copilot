# packages/evidence

*[Українською](README.uk.md) · English*

> Builds the evidence graph from a parsed documentation bundle.

Part of the [UAV Readiness & Evidence Copilot](../../README.md) monorepo.

## What it contains

- `buildEvidenceGraphFromBundle` — links artifacts, evidence sources, claims (with engine-derived statuses), and locks

## Safety boundaries

Enforces the core rule `No evidence → locked`; it never fabricates missing proof.

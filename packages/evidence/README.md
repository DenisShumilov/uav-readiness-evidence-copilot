# packages/evidence

*English · [Українською](README.uk.md)*

> Builds the evidence graph from a parsed demo bundle.

Part of the [UAV Readiness & Evidence Copilot](../../README.en.md) monorepo.

## What it provides

- `buildEvidenceGraphFromBundle` — links artifacts, evidence sources, claims, and locks

## Safety scope

Enforces the core rule `No evidence → locked`; it never infers missing proof.

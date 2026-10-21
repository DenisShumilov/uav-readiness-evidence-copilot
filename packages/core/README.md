# packages/core

*[Українською](README.uk.md) · English*

> Shared TypeScript/Zod schemas for the documentation readiness data model.

Part of the [UAV Readiness & Evidence Copilot](../../README.md) monorepo.

## What it contains

- Zod schemas for artifacts, evidence sources, claims, links, and locks
- QA items, readiness findings, and the `DemoBundle` schema with cross-reference validation
- Cross-document revision conflict checks for documentation QA

## Safety boundaries

Schemas describe documentation and paperwork shapes only — never operational systems. `No evidence → locked`.

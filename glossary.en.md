# Glossary

*[Українською](glossary.md) · English*

This is a concise engineering glossary of terms used across the verification suite and repository.

## Core Terms

- **manual** — the instruction manual or technical datasheet for a subsystem or component.
- **pinout** — a connector or board contact assignment map.
- **BOM** — Bill of Materials (structured component list).
- **TDP** — Technical Data Package, a structured set of engineering records and indexes.
- **STANAG** — NATO Standardization Agreement.
- **config dump** — an exported controller or testbench parameter file.
- **evidence** — verifiable proof extracted from a protocol, table, binary log, or signature container.
- **evidence graph** — a deterministic graph linking engineering claims to their primary evidence sources.
- **traceability** — end-to-end linkage across `requirement → evidence → check → status`.
- **parser** — deterministic byte-level or structural extraction code.
- **schema** — formal structural validation rules (JSON Schema / Zod).
- **fixture** — a reference test file used for reproducible engineering verification.
- **artifact** — an ingested engineering file, binary log, or generated verification output.
- **readiness score** — a deterministic `0–100` score measuring evidence chain completeness.
- **QA** — engineering quality assurance and verification.
- **CLI** — command-line interface for batch execution and CI pipelines.
- **locked** — blocked status assigned when supporting evidence is missing or a logged test fails (`No evidence → locked`).
- **conflict** — an active contradiction between two sources or revisions (`CONFLICT_CEILING = 49`).
- **synthetic** — non-operational test data containing zero sensitive or field information.
- **OOXML** — Office Open XML (`.docx`, `.xlsx`) ZIP containers holding XML trees for text, tables, formulas, and revision IDs.
- **SI vector (7D)** — a 7-dimensional International System of Units vector $[M, L, T, I, \Theta, N, J]$ used to enforce dimensional homogeneity.
- **DataFlash / ULog / MAVLink / UBX** — binary flight telemetry and GNSS receiver protocols (`ArduPilot`, `PX4`, `u-blox`).
- **ASN.1 DER / CMS SignedData** — binary cryptographic signature containers (`.p7s`, `DSTU 4145-2002`).
- **CEP** — Circular Error Probable metric for navigation and ballistic dispersion analysis.
- **SHA-256 / AES-256-GCM** — cryptographic digest for artifact integrity and authenticated encryption for zero-server report sharing.
- **SARIF 2.1.0** — Static Analysis Results Interchange Format for automated CI/CD reporting.

## Terminology Clarity Rule

Whenever a technical abbreviation or status code appears in a verification report, it is paired with a clear explanation of its physical or documentary meaning:

`locked (blocked: missing primary test protocol reference)`

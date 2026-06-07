# Roadmap

This roadmap keeps the repository focused on one story: documentation QA, evidence tracking, traceability, and readiness reporting.

## Near Term

- Keep the published demo video current.
- Add optional static dashboard view.
- Add remaining safe documentation-only parsers.
- Add richer traceability and evidence-quality reports.
- Keep safety boundaries and synthetic-data policy strict.

## Safety Rule

Future work must stay documentation-only.

Do not add:

- drone control;
- live telemetry processing;
- route or waypoint generation;
- payload workflows;
- targeting workflows;
- tactical recommendations;
- real UAV operational data.

## Agent Plugin Policy

Agent plugins, MCP servers, hooks, monitors, and LSP tools may be considered only when they clearly help documentation QA, evidence, testing, reporting, or portfolio presentation.

External plugins require explicit user confirmation before installation.

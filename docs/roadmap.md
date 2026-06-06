# Roadmap

This roadmap keeps the repository focused on one story: documentation QA, evidence tracking, traceability, and readiness reporting.

## Near Term

- Use the published demo video in outreach and portfolio materials.
- Add optional static dashboard view.
- Add remaining safe documentation-only parsers.
- Add richer traceability and evidence-quality reports.
- Keep safety boundaries and synthetic-data policy strict.

## Optional Repository Cleanup

These changes can improve presentation later, but are intentionally not part of the current lightweight sprint:

- Move `.claude/` and `AGENTS.md` into `meta/ai-workflows/` or a private internal workflow repo.
- Move `demo-video/` into `media/demo-video/` if the media pipeline starts distracting from the core app.
- Keep portfolio/outreach material under `docs/portfolio/`.
- Review whether `packages/qa/` should stay as CLI smoke-test support or move under `tests/cli/`.
- Review whether `packages/deck/` should remain as a future placeholder or be represented only in the roadmap.

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

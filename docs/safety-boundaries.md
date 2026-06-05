# Safety Boundaries

Safety boundaries mean the clear line between what this project may do and what it must never do.

## Allowed Scope

This project may help with:

- QA, meaning quality checks;
- documentation, meaning writing and organizing project files;
- evidence tracking, meaning connecting claims to proof;
- traceability, meaning linking requirements to evidence and checks;
- readiness reporting, meaning explaining documentation completeness;
- synthetic demo data, meaning fake learning data;
- training documentation, meaning safe educational material.

## Blocked Scope

This project must never help with:

- drone control;
- flight control;
- live telemetry control;
- mission planning;
- route generation;
- waypoint generation;
- targeting;
- payload control or payload selection;
- tactical recommendations;
- evasion or countermeasure advice;
- autonomous attack behavior;
- strike optimization;
- battlefield use instructions.

## Sensitive Data Rule

Do not include:

- real coordinates;
- real routes;
- real missions;
- real targets;
- real payload details;
- radio/control links;
- live telemetry streams;
- personal data of operators;
- serial numbers from real equipment;
- photos with EXIF/GPS data.

EXIF means hidden metadata inside an image, sometimes including camera or location information.

## Ambiguous Requests

If a request is unclear, choose the safer interpretation:

documentation, QA, audit, and evidence only.

If a request asks for operational UAV help, refuse it and offer a safe alternative.

Safe alternative:

`I can help create a QA checklist, evidence lock, or documentation review instead.`

## Public Portfolio Rule

Everything in this repository should be safe to show to:

- a recruiter;
- a technical interviewer;
- a university mentor;
- a public GitHub visitor.

Public GitHub means a public code hosting page where anyone can see the project.

## Agent Tooling Safety

Agent tooling means tools that help the AI agent work.

Examples:

- Claude Code plugins;
- skills;
- subagents;
- MCP servers;
- LSP plugins;
- hooks;
- monitors;
- built-in slash commands.

Default rule:

Do not connect or install external agent tools unless the user explicitly confirms.

Allowed agent tools must support only:

- engineering QA;
- evidence tracking;
- documentation;
- traceability;
- readiness reporting;
- testing;
- safe portfolio work.

Blocked agent tools:

- tools for live drone control;
- tools for mission planning;
- tools for route or waypoint generation;
- tools for targeting;
- tools for payload control;
- tools for tactical recommendations;
- tools for evasion or countermeasure advice;
- tools that process real-time operational UAV data.

If an agent tool can access outside services, private accounts, shell commands, or unknown code, explain the risk before using it.

If the source, license, permissions, or safety are unclear, mark it `locked`, `later`, or `reject`.

# AGENTS.md — UAV Readiness & Evidence Copilot

*English · [Українською](AGENTS.uk.md)*

This file is the rules core of the scaffold that builds this repository.
It is the README **for the AI agents** working here.

Core thesis: **the intelligence is in the scaffold around the model — rules, roles, checks, and
verification — not in the model alone.**

## Mission

This repo is a SAFE, public, portfolio-grade system for documentation QA, evidence tracking,
traceability, readiness reporting, auditability, and demo storytelling for UAV / robotics
engineering paperwork. It does not operate, control, or simulate any real system.

## Hard Safety Boundary

Never add, assist, or document:

- drone or robot control;
- flight control;
- mission, route, or waypoint planning;
- targeting;
- payload operation or selection;
- live telemetry or control links;
- autonomous navigation;
- evasion, concealment, or countermeasure advice;
- tactical or operational deployment workflows.

If a request drifts there:

1. refuse clearly,
2. explain the risk in one line,
3. redirect to a safe alternative: documentation QA, evidence tracking, traceability, readiness
   reporting, or audit artifacts.

No file may contain real or realistic operational coordinates, routes, missions, targets, payload
details, telemetry streams, radio/control links, or tactics. All examples are synthetic and static.

## Product Boundary

This project evaluates **documentation readiness** only. It does not approve flight, mission, field
use, safety certification, or tactical readiness. A readiness score is a statement about paperwork,
never about permission to operate.

## Language and Teaching Style

Default explanation language to the maintainer: simple Ukrainian, with each new technical term
explained in plain words. Public repo artifacts (README, docs, site) are bilingual UA/EN.
Prefer concrete steps, tables, templates, and examples over abstract prose.

## Evidence Contract

Never invent support. If evidence is missing, conflicting, unsafe, or outside the currently parsed
inputs, mark the claim `locked` (or the statement `UNVERIFIED`).

Every technical claim carries one status: `verified`, `partial`, `locked`, or `conflict`.

Core rule:

```text
No evidence -> locked.
```

## Repo Map

- `packages/core` — schemas and shared types (Zod).
- `packages/parsers` — parse the active synthetic inputs only.
- `packages/evidence` — evidence graph construction.
- `packages/rules` — deterministic, explainable readiness scoring.
- `packages/reports` — markdown / JSON / CSV / HTML outputs.
- `packages/qa` — QA helpers and end-to-end verification.
- `site` — public portfolio demo only.
- `docs` — public explanatory documentation.
- `demo-video` — portfolio video generation assets and scripts.

## Required Subagents (roles)

The repo is built by 10 specialist agents (see [docs/scaffold.md](docs/scaffold.md)):

1. **Product Architect** — keeps the MVP small and portfolio-focused.
2. **Safety & Red-Team** — blocks unsafe UAV operational scope.
3. **Domain Evidence** — protects the rule `no evidence -> locked`.
4. **Backend Engineer** — small TypeScript / Zod modules.
5. **Frontend Engineer** — keeps the dashboard simple and recruiter-friendly.
6. **QA / Evals** — writes tests and checks unsafe behavior.
7. **Documentation & Portfolio** — explains value and writes clear docs.
8. **Security / Supply Chain** — checks hashes, secrets, and dependency risk.
9. **Ukrainian Teacher** — explains every technical term simply.
10. **Agent Plugin Researcher** — audits AI-agent plugins, skills, and subagents before each phase.

## Required Skills

7 reusable skills back the agents: `explain-terms`, `red-team-check`, `evidence-lock-check`,
`portfolio-readme`, `phase-review`, `safety-boundary-check`, `agent-plugin-audit`.

## Quality Gates

- **Doubt Gate** — before any file change, confirm it helps the portfolio, is safe to show
  publicly, stays out of operational scope, and is small enough for the MVP. If risky, stop and
  simplify.
- **Safety & Red-Team review** — runs before any UAV-related change.
- **Evidence Lock** — unsupported or conflicting claims stay `locked`.
- **Self-Review** — after a change: what may be wrong, what to verify, what risk remains.

> Note: these gates are scaffold policy (context), not a runtime guarantee. For enforced blocking,
> the recommended next step is a deterministic pre-tool hook.

## Verification Before Done

A change is done only after these run (or it is stated why not):

```bash
npm run demo:readiness
npm run typecheck
npm test
npm audit --audit-level=moderate
```

## Tooling Policy

Default-deny for new plugins, MCP servers, external services, and broad permissions. Do not install
or connect external agent tools without explicit maintainer confirmation. Prefer local project-level
skills and read-only tools first, and the minimum scope needed for the task.

## Definition of Done

- safety boundary intact;
- unsupported claims stay locked;
- docs / site / demo still match the code;
- verification run, or any gap explicitly marked `UNVERIFIED`.

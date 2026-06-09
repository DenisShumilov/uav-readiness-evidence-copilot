# The scaffold that built this repo

> The real, inspectable artifacts behind the claim **"built by a scaffold of 10 agents + 7 skills."**
> These are the project-level AI-agent instructions used while developing the repository — not part
> of the runtime product. Open them: the scaffold is verifiable, not just prose.

- **Rules core:** [`AGENTS.md`](AGENTS.md) — scope, safety boundary, evidence contract, output format,
  required roles/skills, doubt gate. (A condensed public version is the repo-root [`AGENTS.md`](../../AGENTS.md).)
- A narrative walk-through with diagram and a real refusal example: [`docs/scaffold.md`](../../docs/scaffold.md).

## The 10 specialist agents (`.claude/agents/`)

| # | Agent | File |
|---|---|---|
| 01 | Product Architect | [`product-architect.md`](.claude/agents/product-architect.md) |
| 02 | Safety & Red-Team | [`safety-red-team.md`](.claude/agents/safety-red-team.md) |
| 03 | Domain Evidence | [`domain-evidence.md`](.claude/agents/domain-evidence.md) |
| 04 | Backend Engineer | [`backend-engineer.md`](.claude/agents/backend-engineer.md) |
| 05 | Frontend Engineer | [`frontend-engineer.md`](.claude/agents/frontend-engineer.md) |
| 06 | QA / Evals | [`qa-evals.md`](.claude/agents/qa-evals.md) |
| 07 | Documentation & Portfolio | [`docs-portfolio.md`](.claude/agents/docs-portfolio.md) |
| 08 | Security / Supply Chain | [`security-supply-chain.md`](.claude/agents/security-supply-chain.md) |
| 09 | Ukrainian Teacher | [`ukrainian-teacher.md`](.claude/agents/ukrainian-teacher.md) |
| 10 | Agent Plugin Researcher | [`agent-plugin-researcher.md`](.claude/agents/agent-plugin-researcher.md) |

Each file is a real subagent definition (role, model, allowed tools, and behavior) in the
[Claude Code / Agent SDK](https://docs.claude.com/en/docs/claude-code) subagent format.

## The 7 reusable skills (`.claude/skills/`)

| Skill | File |
|---|---|
| explain-terms | [`SKILL.md`](.claude/skills/explain-terms/SKILL.md) |
| red-team-check | [`SKILL.md`](.claude/skills/red-team-check/SKILL.md) |
| evidence-lock-check | [`SKILL.md`](.claude/skills/evidence-lock-check/SKILL.md) |
| portfolio-readme | [`SKILL.md`](.claude/skills/portfolio-readme/SKILL.md) |
| phase-review | [`SKILL.md`](.claude/skills/phase-review/SKILL.md) |
| safety-boundary-check | [`SKILL.md`](.claude/skills/safety-boundary-check/SKILL.md) |
| agent-plugin-audit | [`SKILL.md`](.claude/skills/agent-plugin-audit/SKILL.md) |

## What these are (and aren't)

- **Are:** role-based subagent + skill definitions I designed and used to build this repo with a
  consistent safety boundary, an evidence-locking discipline, and a red-team gate. The "intelligence"
  of the workflow lives here — in the rules, roles, and checks — not in any single model call.
- **Aren't:** autonomous always-on services. They are instruction artifacts (prompts / configuration)
  for an agentic coding tool. The repo-root `AGENTS.md` notes these gates are scaffold *policy*
  (context), not a runtime guarantee.

These files are not part of the runtime product; they are kept under `meta/` so the repository root
stays focused on the product, while the scaffold remains public and verifiable.

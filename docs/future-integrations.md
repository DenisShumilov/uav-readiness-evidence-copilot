# Future Integrations

Future integrations means tools we may connect later, after safety review.

This document is about AI-agent workflow tools, not npm packages.

## Simple Difference

- plugin = набір інструментів для агента.
- skill = рецепт для агента.
- subagent = спеціаліст із роллю.
- npm package = деталь для коду.

An AI-agent plugin helps the agent work.

An npm package helps the app code work.

## Agent Plugin Research

Before every new phase, run Agent Plugin Research.

Agent Plugin Research means checking which AI-agent tools can help the next phase without adding unsafe scope or unnecessary complexity.

Check:

- Claude Code plugins;
- project-level skills;
- project-level subagents;
- MCP servers;
- LSP/code intelligence plugins;
- hooks;
- monitors;
- built-in skills such as `/code-review`, `/debug`, `/batch`, `/loop`, `/run`, `/verify` if available;
- local project plugins.

Do not install external plugins without explicit user confirmation.

## Plugin Recommendation Matrix

Use this format:

| Tool / Plugin | Type | Навіщо | MVP чи later | Ризик | Рішення |
|---|---|---|---|---|---|

Type can be:

- Claude plugin;
- skill;
- subagent;
- MCP server;
- LSP plugin;
- hook;
- monitor;
- built-in skill;
- local project plugin.

Decision can be:

- install now;
- create local;
- use built-in;
- later;
- reject;
- locked.

## Safety Rules

- Do not install external plugins without user confirmation.
- Do not connect tools that enable live drone control, mission planning, targeting, payload control, tactical advice, or real-time operational use.
- Allowed tools must support only engineering QA, evidence, documentation, traceability, readiness, testing, and reporting.
- If a plugin gives access to external systems or shell commands, explain the risks first.
- If license or source is unclear, reject or ask the user.
- If a plugin does not help a 30-second demo, mark it later or reject.
- If a simple local skill is enough, prefer local skill.

## Current Phase 2 Recommendation

Phase 2 should use:

- project-level skills;
- project-level subagents;
- Claude Code with `claude-opus-4-8` and `--effort max`;
- local read-only CLI checks where needed.

Phase 2 should not use:

- external Claude plugins;
- Google MCP auth;
- live integrations;
- hooks;
- monitors;
- marketplace installs;
- UI skills;
- ultrareview before Git exists.

Reason:

Phase 2 is schemas-only, meaning only rules for data shape. It does not need external tools.

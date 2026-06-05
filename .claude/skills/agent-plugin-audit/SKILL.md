---
name: agent-plugin-audit
description: Before each phase, audit AI-agent plugins, skills, subagents, MCP servers, LSP plugins, hooks, monitors, and built-in skills. Produces a Plugin Recommendation Matrix.
license: MIT
metadata:
  version: "0.1.0"
---

# Agent Plugin Audit

Use before every new phase.

Plugin here means an AI-agent workflow plugin, not an npm package.

Simple difference:

- plugin = набір інструментів для агента;
- skill = рецепт для агента;
- subagent = спеціаліст із роллю;
- npm package = деталь для коду.

## Check Available Tools

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

## Safety Rules

- Do not install external plugins without explicit user confirmation.
- Prefer local skills over external plugins when enough.
- Do not connect anything that can enable live drone control, mission planning, targeting, payload control, tactical advice, or real-time operational use.
- Allowed tools must support only engineering QA, evidence, documentation, traceability, readiness, testing, or reporting.
- If a plugin gives external access or shell access, explain risk first.
- If license, source, permissions, or safety are unclear, reject or ask the user.
- If it does not help a 30-second demo, mark it later or reject.

## Plugin Recommendation Matrix

Return this table:

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

For external plugins, include:

- name;
- what it does;
- why it helps;
- whether it is safe;
- whether it is free/open-source;
- risks;
- MVP or later;
- install command;
- whether user confirmation is required.

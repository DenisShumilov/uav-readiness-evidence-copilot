# Glossary

*[Українською](glossary.md) · English*

This is a short glossary of the project's terms.

The project rule is simple: whenever a technical word appears, it should be explained in plain language.

## Core terms

- **manual** — the instruction sheet or technical datasheet for a part.
- **pinout** — a map of the contacts on a board.
- **BOM** — a bill of materials (a list of parts).
- **config dump** — a file with settings.
- **evidence** — proof.
- **evidence graph** — a map of evidence: what is linked to what, and what backs it up.
- **traceability** — the ability to follow a chain, that is, the link "requirement → evidence → check".
- **parser** — code that reads a file and extracts data from it.
- **schema** — the rules for what the data should look like.
- **fixture** — a sample test file used for learning.
- **artifact** — a file we uploaded or generated.
- **readiness score** — a rating of how ready the documentation is.
- **QA** — quality assurance (a quality check).
- **CLI** — running something through the command line.
- **repo** — a project folder under Git.
- **package** — a separate part of the code, or a module.
- **subagent** — a separate helper with a specific role.
- **skill** — a ready-made instruction for the agent.
- **red-team** — a critical review of risks.
- **self-review** — a self-check after the work is done.
- **locked** — blocked, because there is no evidence.
- **synthetic** — for learning, fake, not from real use.
- **scaffold** — the project skeleton: folders, rules, and base files that help you stay on track.
- **runtime logic** — code that actually performs an action.
- **telemetry** — live data from a system, for example status or sensors.
- **MVP** — the first small version of the project.
- **Zod** — a library for validating data in TypeScript.
- **TypeScript** — JavaScript with types, that is, code with clearer rules.
- **markdown** — a simple format for text documents.
- **YAML** — a data format that looks like an indented list.
- **JSON** — a data format made of keys and values.
- **CSV** — a table stored in a text file.
- **PPTX** — a PowerPoint presentation file.
- **hash** — a digital fingerprint of a file.
- **integrity** — the wholeness of a file, that is, the file has not been changed unnoticed.
- **validation** — a check that the data follows the rules.
- **dependency** — an external library or tool the project relies on.
- **metadata** — service data about a file, for example a date or hidden information.
- **structured data** — data with a clear shape, for example a table or JSON.
- **AI-agent plugin** — a set of capabilities for an AI agent: tools, skills, connections, or commands.
- **Claude Code plugin** — a plugin for Claude Code that can add skills, commands, or integrations.
- **built-in skill** — a built-in skill that is already present in the system.
- **MCP server** — a bridge between an AI agent and an external service or tool.
- **LSP plugin** — a tool for code hints and checks in the editor.
- **hook** — an automatic action that runs at a certain moment, for example before a commit.
- **monitor** — a watcher that regularly checks the state of something.
- **npm package** — a code library for a JavaScript or TypeScript project.
- **plugin bloat** — too many plugins that give little value and add risk.
- **marketplace** — a catalog where you can find and install plugins.
- **install now** — it can be installed now, after the user confirms.
- **create local** — it is better to make a local skill or agent in the project.
- **use built-in** — use what is already available.
- **later** — defer to a future phase.
- **reject** — do not use.

## The explanation rule

When writing to the user, you should not say only:

`parser`

It is better to write it like this:

`parser (code that reads a file and extracts data from it)`

If a term is repeated many times, explain it at least on its first appearance in the response.

## Do not confuse

- **plugin** — a set of tools for the agent.
- **skill** — a recipe or instruction for the agent.
- **subagent** — a helper with a specific role.
- **npm package** — a library for the code.

A simple rule:

An AI-agent plugin helps the agent work. An npm package helps the application's code work.

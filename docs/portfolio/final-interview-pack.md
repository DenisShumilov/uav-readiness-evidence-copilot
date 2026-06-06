# Final interview pack

## 30-second pitch

UAV Readiness & Evidence Copilot is a safe TypeScript QA tool for engineering documentation. It reads synthetic UAV-related demo files, connects claims to evidence, keeps missing proof locked, calculates a documentation readiness score, and generates reports, traceability output, hashes, and a static demo page.

## 10-second pitch

It is a safe evidence checker for UAV engineering documentation, not a drone control tool.

## What I actually built

- TypeScript schemas for project data.
- Parsers for safe synthetic demo files.
- Evidence graph builder.
- Readiness rules engine.
- Markdown, JSON, CSV, hash, and static HTML outputs.
- CLI command: `npm run demo:readiness`.
- Automated tests with Vitest.
- GitHub Actions CI.
- README screenshot and portfolio docs.

## What I did not build

- No real drone integrations.
- No drone control.
- No live telemetry analysis.
- No route generation.
- No targeting support.
- No payload handling.
- No production deployment.
- No claim that a real company uses it.

## Why it is safe

The project uses synthetic demo data only.

It is limited to documentation QA, evidence tracking, traceability, and reporting.

The core rule is:

```text
No evidence -> locked.
```

Simple meaning: if the tool cannot point to proof, it must not pretend the claim is verified.

## Why it helps a UAV / miltech team

Teams need clear handoff and review workflows.

This project shows how to turn scattered documentation into a readable package:

- what is verified;
- what is partial;
- what is locked;
- what evidence exists;
- what should be reviewed next.

It helps with engineering QA and documentation readiness, not operational use.

## 10 questions and short answers

1. What is this project?

It is a safe QA tool for engineering documentation and evidence tracking.

2. What problem does it solve?

It helps teams see which documentation claims are supported by proof and which are not.

3. What is a parser?

A parser is code that reads a file and extracts useful structured data.

4. What is an evidence graph?

It is a map that connects claims to the evidence that supports them.

5. What is a locked step?

A locked step is blocked because evidence is missing.

6. What is the readiness score?

It is a documentation readiness score, not approval for real-world operation.

7. What is a traceability matrix?

It is a table linking requirement -> evidence -> check -> status -> risk.

8. What is an artifact hash?

It is a digital fingerprint of a file, used to identify what was reviewed.

9. What technologies did you use?

TypeScript, Zod, Vitest, Node.js, CLI scripts, Markdown/JSON/CSV outputs, static HTML, and GitHub Actions.

10. What would you improve next?

I would add a short demo video/GIF, safer documentation-only parsers, and optionally a dashboard UI if it stays within the same safety boundaries.

## Short recruiter explanation

This is a portfolio-ready engineering QA tool. It shows TypeScript, testing, documentation automation, safety thinking, and a clear product demo.

## Short engineer explanation

It is a small TypeScript pipeline: synthetic input artifacts -> parsers -> schemas -> evidence graph -> rules engine -> report outputs -> static demo page.

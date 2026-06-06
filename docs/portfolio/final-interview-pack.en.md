# Final interview pack - English

## 30-second pitch

UAV Readiness & Evidence Copilot is a safe TypeScript QA tool for engineering documentation. It reads four active synthetic demo inputs, connects claims to evidence, keeps missing proof locked, calculates a documentation readiness score, and generates reports, traceability output, hashes, static demo pages, and GitHub Release MP4 demos.

## 10-second pitch

It is a safe evidence checker for UAV engineering documentation, not a drone control tool.

## What I actually built

- TypeScript schemas for project data.
- Parsers for four safe synthetic demo inputs: BOM, manual, test log, and QA notes.
- Evidence graph builder.
- Readiness rules engine.
- Markdown, JSON, CSV, hash, and static HTML outputs.
- English and Ukrainian demo pages.
- CLI command: `npm run demo:readiness`.
- Automated tests with Vitest.
- GitHub Actions CI.
- Demo video storyboards, voiceover scripts, and GitHub Release MP4 demos.

## What I did not build

- No real drone integrations.
- No drone control.
- No live data analysis.
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
A short demo video/GIF, safer documentation-only parsers, and optionally a dashboard UI if it stays within safety boundaries.

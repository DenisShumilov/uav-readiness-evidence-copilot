# Interview cheat sheet

## What this project is

UAV Readiness & Evidence Copilot is a safe documentation QA tool.

Simple meaning: it checks engineering paperwork, evidence, and review notes. It does not operate real equipment.

## What problem it solves

Engineering teams can have many scattered files: part lists, notes, test logs, and review comments.

This project turns those files into a clearer readiness package: what is verified, what is partial, and what is locked because proof is missing.

## Key terms

- Parser = code that reads a file and extracts useful data.
- Evidence graph = a map of claims and the proof connected to them.
- Locked step = a step that stays blocked because proof is missing.
- Readiness score = a simple score for documentation readiness, not real-world approval.
- Traceability matrix = a table that links requirement -> evidence -> check -> status -> risk.
- Artifact hash = a digital fingerprint of a file.
- QA = quality assurance, meaning checking quality and completeness.

## What to say in an interview

Say:

> I built a safe TypeScript tool that reads synthetic UAV engineering documentation, connects claims to evidence, keeps missing proof locked, and generates a readiness package with reports, traceability, hashes, tests, and a static portfolio demo.

Then add:

> The most important design rule is: no evidence means locked. The tool does not control drones, plan operations, or use live data. It is only for safe documentation QA.

## 10 possible questions and short answers

1. What does this project do?

It checks synthetic engineering documents and creates a readiness report.

2. Why is it useful?

It helps teams see what documentation is complete and what is missing.

3. What is a parser?

A parser is code that reads a file and pulls out structured data.

4. What is an evidence graph?

It is a map that shows which claims are supported by which proof.

5. What does locked mean?

Locked means the project refuses to mark something as true because proof is missing.

6. What is the readiness score?

It is a documentation readiness score, not approval to operate equipment.

7. What is traceability?

Traceability means linking a requirement to evidence and then to a check.

8. What is an artifact hash?

It is a digital fingerprint that helps identify which file was reviewed.

9. What did you build technically?

TypeScript schemas, parsers, evidence graph builder, rules engine, report generators, CLI command, tests, and static HTML demo.

10. How did you keep it safe?

I limited the project to synthetic documentation QA and blocked operational UAV features.

## What not to say

Do not describe this as an operational UAV system.

Do not claim it proves real-world readiness.

Do not say it handles live data or controls equipment.

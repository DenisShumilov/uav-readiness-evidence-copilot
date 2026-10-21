# Contributing

*[Українською](CONTRIBUTING.uk.md) · English*

Thank you for improving UAV Readiness & Evidence Copilot.

This project is a safe, public engineering verification suite for documentation QA, evidence tracking, traceability, and readiness reporting.

## Safe Contribution Scope

Allowed:

- documentation quality improvements;
- synthetic demonstration data improvements;
- parser, schema, evidence, rule, report, and test improvements;
- verification suite presentation improvements;
- safety boundary clarifications.

Not allowed:

- operational UAV control features;
- real-world control integrations;
- live system data processing;
- route or waypoint generation;
- payload operation;
- targeting support;
- tactical advice.

## Development Checks

Before opening a pull request, run:

```bash
npm run demo:readiness
npm run typecheck
npm test
npm audit --audit-level=moderate
```

## Evidence Rule

Core rule:

```text
No evidence -> locked.
```

Do not mark claims as `verified` unless supporting evidence exists in the safe synthetic data or tests.

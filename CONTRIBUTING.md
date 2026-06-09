# Contributing

*English · [Українською](CONTRIBUTING.uk.md)*

Thanks for improving UAV Readiness & Evidence Copilot.

This project is a safe, public portfolio demo for documentation QA, evidence tracking, traceability, and readiness reporting.

## Safe contribution scope

Allowed:

- documentation quality improvements;
- synthetic demo data improvements;
- parser, schema, evidence, rules, report, and test improvements;
- portfolio presentation improvements;
- safety boundary clarifications.

Not allowed:

- operational UAV control features;
- real-world control integrations;
- live system data processing;
- route or waypoint generation;
- payload handling;
- targeting support;
- tactical advice.

## Development checks

Before opening a pull request, run:

```powershell
npm run demo:readiness
npm run typecheck
npm test
npm audit --audit-level=moderate
```

## Evidence rule

Core rule:

```text
No evidence -> locked.
```

Do not mark claims as verified unless supporting evidence exists in safe demo data or tests.

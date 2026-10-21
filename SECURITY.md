# Security Policy

*[Українською](SECURITY.uk.md) · English*

## Project Scope

This repository is a safe offline engineering verification project for documentation QA.

It does not require API keys, cloud credentials, real hardware access, or live integrations.

## Reporting Issues

If you discover a security issue, open a GitHub issue describing:

- the affected file or workflow;
- what could go wrong;
- reproduction steps using synthetic data only;
- a proposed safe fix, if known.

Do not include secrets, private data, real operational data, or sensitive system details in public issues.

## Safety Boundaries

This project must remain limited to documentation QA, evidence tracking, traceability, testing, and reporting.

Do not add features for:

- operational UAV control;
- real-world control integrations;
- live system data processing;
- route or waypoint generation;
- payload operation;
- targeting support;
- tactical advice.

## Dependency Checks

Before a public release or dependency update, run:

```bash
npm audit --audit-level=moderate
```

Keep dependencies minimal. Prefer local code and tests over unnecessary external tools.

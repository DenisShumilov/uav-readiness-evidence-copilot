# Security Policy

## Project scope

This repository is a safe, offline documentation QA portfolio project.

It does not require API keys, cloud credentials, real equipment access, or live integrations.

## Reporting issues

If you find a security issue, open a GitHub issue with:

- affected file or workflow;
- what could go wrong;
- steps to reproduce using synthetic data only;
- suggested safe fix, if known.

Do not include secrets, private data, real operational data, or sensitive system details in public issues.

## Safety boundaries

This project must remain limited to documentation QA, evidence tracking, traceability, testing, and reporting.

Do not add features for:

- operational UAV control;
- real-world control integrations;
- live system data processing;
- route or waypoint generation;
- payload handling;
- targeting support;
- tactical advice.

## Dependency checks

Before public release or dependency changes, run:

```powershell
npm audit --audit-level=moderate
```

Keep dependencies minimal. Prefer local code and tests over unnecessary external tools.

# Safety Boundaries

*[Українською](safety-boundaries.md) · English*

Safety boundaries mean the clear line between what this project may do and what it must never do.

## Allowed Scope

This project may help with:

- QA, meaning quality checks;
- documentation, meaning writing and organizing project files;
- evidence tracking, meaning connecting claims to proof;
- traceability, meaning linking requirements to evidence and checks;
- readiness reporting, meaning explaining documentation completeness;
- synthetic demo data, meaning fake learning data;
- training documentation, meaning safe educational material.

## Blocked Scope

This project must never help with:

- drone control;
- flight control;
- live telemetry control;
- mission planning;
- route generation;
- waypoint generation;
- targeting;
- payload control or payload selection;
- tactical recommendations;
- evasion or countermeasure advice;
- autonomous attack behavior;
- strike optimization;
- battlefield use instructions.

## Keyword Context Rule

Unsafe keywords such as `mission`, `payload`, `targeting`, `route`, `waypoint`, and `telemetry` are blocked in user/demo input artifacts.

Active input artifact means a file the current MVP reads as project data, such as `BOM.csv`, `demo_manual.md`, `test_log.csv`, or `qa_notes.md`.

Future fixtures such as `future-fixtures/wiring_notes.yaml` and `future-fixtures/config_dump.txt` are kept for later documentation-only parser work and are not read by the current MVP.

Safety documentation may mention unsafe keywords only as prohibited items.

Allowed safety documentation example:

`No mission planning.`

Blocked demo/input example:

`mission plan details`

Simple meaning:

Docs may say what is forbidden. Demo data must not contain operational content.

## Sensitive Data Rule

Do not include:

- real coordinates;
- real routes;
- real missions;
- real targets;
- real payload details;
- radio/control links;
- live telemetry streams;
- personal data of operators;
- serial numbers from real equipment;
- photos with EXIF/GPS data.

EXIF means hidden metadata inside an image, sometimes including camera or location information.

## Ambiguous Requests

If a request is unclear, choose the safer interpretation:

documentation, QA, audit, and evidence only.

If a request asks for operational UAV help, refuse it and offer a safe alternative.

Safe alternative:

`I can help create a QA checklist, evidence lock, or documentation review instead.`

## Public Verification Rule

Everything in this repository is designed to be safe for:

- an engineering review;
- a technical documentation audit;
- an academic or testbench review;
- a public GitHub verification check.

## Verification Tooling Isolation

All verification modules run locally without external cloud calls.

Default rule:

Do not connect external network services when auditing engineering packages.

Allowed verification modules support only:

- engineering QA;
- evidence tracking;
- documentation audit;
- traceability;
- readiness reporting;
- automated testing;
- local cryptographic integrity checks.

Blocked modules:

- modules for live drone control;
- modules for mission planning;
- modules for route or waypoint generation;
- modules for targeting;
- modules for payload control;
- modules for tactical recommendations;
- modules for evasion or countermeasure advice;
- modules that control hardware in real time.

If the source, schema, or integrity of an artifact is unverified, mark it `locked`.

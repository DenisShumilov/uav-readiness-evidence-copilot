# UAV Readiness & Evidence Copilot

Safe portfolio project for UAV engineering QA, evidence tracking, traceability, and readiness documentation.

Simple meaning:

- UAV = drone or unmanned aerial vehicle.
- QA = quality assurance, meaning checking that engineering work is complete and reliable.
- evidence = proof, such as a document, note, table, or log.
- traceability = the link "requirement -> evidence -> check".
- readiness = documentation readiness, not flight permission.

## 30-second demo

Run:

```powershell
npm run demo:readiness
```

Open:

```text
examples/demo-uav-readiness/output/portfolio-demo.md
```

This page shows the project name, readiness score, evidence status, warnings, locked items, generated output files, and why the demo matters to an employer.

Simple meaning: the recruiter can see in one page that this project checks files, connects evidence to claims, refuses unsupported claims, and produces useful documentation.

## What This Project Is

This project is an offline workspace for organizing engineering artifacts and producing readiness documentation.

Artifact means a file we receive or generate, such as a BOM, manual, QA note, report, or checklist.

Planned safe inputs:

- `BOM.csv` = list of parts;
- `demo_manual.md` = safe demo instruction document;
- `wiring_notes.yaml` = structured wiring notes, only if supported by evidence;
- `config_dump.txt` = settings file;
- `test_log.csv` = test record;
- `qa_notes.md` = quality notes.

Planned safe outputs:

- `readiness-report.md` = written readiness summary;
- `qa-checklist.md` = quality checklist;
- `traceability-matrix.csv` = table linking requirement, evidence, and check;
- `evidence-graph.json` = map of evidence links;
- `evidence-locks.json` = list of blocked claims;
- `wiring-manifest.yaml` = wiring summary only when evidence supports it;
- `artifact-hashes.json` = file hashes for integrity;
- `training-deck.pptx` = simple training slides.

## What This Project Is Not

This project is not:

- a drone control tool;
- a mission planning tool;
- a route planner;
- a targeting tool;
- a payload tool;
- a live telemetry tool;
- a tactical assistant;
- a weapon system.

If evidence is missing, the system must say `locked`, meaning blocked because there is no proof.

## Phase 1 Status

Phase 1 creates only the safe foundation:

- persistent rules in `AGENTS.md`;
- documentation in `docs/`;
- project-level Claude agents in `.claude/agents/`;
- project-level Claude skills in `.claude/skills/`;
- placeholder package folders in `packages/`;
- a safe demo folder in `examples/demo-uav-readiness/`.

There is no app logic yet.

## Repository Structure

```text
.
|-- AGENTS.md
|-- README.md
|-- docs/
|-- .claude/
|   |-- agents/
|   `-- skills/
|-- packages/
|   |-- core/
|   |-- parsers/
|   |-- evidence/
|   |-- rules/
|   |-- reports/
|   |-- deck/
|   `-- qa/
`-- examples/
    `-- demo-uav-readiness/
```

Repo means the project folder that can later be tracked with Git.

Package means a separate project module. In Phase 1, packages are only placeholders.

## Core Safety Rule

No evidence -> locked.

Simple meaning: if the project cannot point to a source file, it must not pretend that a claim is true.

## Next Phase

Phase 2 should add schemas, meaning rules for what the data must look like, using TypeScript and Zod.

No parser, dashboard, report generator, or deck generator should be added until the safety and evidence rules stay clear.

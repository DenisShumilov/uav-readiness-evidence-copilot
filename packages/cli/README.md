# packages/cli

*English · [Українською](README.uk.md)*

> CLI for running the documentation readiness engine on a folder of supported docs.

Part of the [UAV Readiness & Evidence Copilot](../../README.md) monorepo.

## Commands

```bash
uav-readiness check <dir>
uav-readiness demo
```

`check` scans `.csv` and `.md` files for the four supported input contracts:

- BOM CSV: `item_id,item_name,category,quantity,record_status,evidence_id,notes`
- manual Markdown: `SYNTHETIC DEMO` line and a `| Claim | Status | Evidence |` table
- test-log CSV: `check_id,check_name,check_type,result,evidence_status,evidence_id,notes`
- QA-notes Markdown: `SYNTHETIC DEMO` line, a `| Evidence ID | Status | Meaning |` table, and `Finding ID` / `Status` / `Reason` / `Impact` fields

Unsupported files are skipped and reported. Missing or unparsable supported inputs do not crash the
CLI; they create `locked` claims, because `no evidence -> locked`.

## Outputs

```bash
uav-readiness check ./docs --json out/readiness.json --sarif out/readiness.sarif --md out/readiness.md --min-score 70
```

- `--json` writes the validated readiness assessment.
- `--sarif` writes GitHub code-scanning SARIF.
- `--md` writes the markdown report.
- `--min-score` exits `1` when the score is below the gate.
- `--quiet` keeps CI logs short.

## Safety scope

This CLI reads static documentation files, derives evidence status, and writes reports. It does not
operate or approve any real system.

# packages/cli

*[Українською](README.uk.md) · English*

> Command-line interface (CLI) for running the documentation readiness engine on a directory of supported documents.

Part of the [UAV Readiness & Evidence Copilot](../../README.md) monorepo.

## Commands

```bash
uav-readiness check <dir>
uav-readiness demo
```

`check` scans `.csv` and `.md` files for the four supported input contracts:

- BOM CSV: `item_id,item_name,category,quantity,revision,record_status,evidence_id,notes`
- Markdown manual: `SYNTHETIC DEMO` marker and `| Claim | Status | Evidence |` table
- Test-log CSV: `check_id,check_name,check_type,result,evidence_status,evidence_id,notes`
- QA-notes Markdown: `SYNTHETIC DEMO` marker, `| Evidence ID | Status | Meaning |` table, and `Finding ID` / `Status` / `Reason` / `Impact` fields

Unsupported files are skipped and listed in the ingest summary. Missing or unparseable supported inputs do not crash the CLI; they create claims with status `locked` under `no evidence -> locked`.

## Outputs

```bash
uav-readiness check ./docs --json out/readiness.json --sarif out/readiness.sarif --md out/readiness.md --min-score 70
```

- `--json` writes the validated readiness assessment JSON.
- `--sarif` writes SARIF 2.1.0 (for GitHub code scanning).
- `--md` writes a Markdown report.
- `--min-score` exits with code `1` when the readiness score is below the threshold.
- `--quiet` suppresses standard terminal output for CI logs.

## Safety boundaries

This CLI reads static documentation files, derives evidence statuses, and writes reports. It does not operate, control, or approve any real-world system.

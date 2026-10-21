# Project FAQ (`v2.5.0`)

*[Українською](project-faq.md) · English*

## What is the UAV Readiness & Evidence Copilot?

**UAV Readiness & Evidence Copilot (`v2.5.0`)** is a suite of local, deterministic tools for cross-checking UAV engineering and acceptance documentation bundles, spreadsheets, and test logs. The system detects discrepancies between requirements and protocols, links every finding to exact source coordinates, and explicitly flags anything that could not be verified automatically (`UNVERIFIED` / `locked`).

## Who is this project for?

For engineering teams, quality control (QC / VTK) departments, design bureaus, compliance reviewers, and technical documentation specialists who need to rapidly cross-check a file bundle before testing or delivery.

## What are the three contours of `v2.5.0` and which files do they read?

1. **Browser Local UI (`docs/*.js`, `docs/index.html`, `docs/tools/universal-ai-cockpit.html`):**
   - reads `.docx`, `.xlsx`, `.csv`, `.tsv`, `.pdf` (vector `/FlateDecode` and the fixed `560 × 220 px` wet-stamped raster reference template), `.p7s` (`ASN.1 DER CMS SignedData`), binary flight logs `.bin`, `.ulg`, `.tlog`, `.ubx`, `.nmea`, and `.param` configuration files;
   - performs cross-document physical unit normalization via 7D SI vectors, audits cached Excel formula values (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT` and `+`, `-`, `*`, `/`), validates `.p7s` `CMS SignedData` structure and `SignerInfo.sid` binding (without performing mathematical signature verification in browser offline mode — `CRYPTO: UNVERIFIED`), and packages `#diag=` encrypted diagnostic capsules (`AES-256-GCM`).
2. **Standalone Python Byte-Level CLI Engines (`engines/defdoc_ai/`, `engines/telemetry_ew/`):**
   - read `.docx`, `.xlsx`, `.md`, `.txt`, and binary telemetry logs `.bin`, `.ulg`, `.tlog`, `.ubx`, `.nmea`, `.csv`, `.gz` (up to `64 MiB`);
   - cross-check TU tables against PMV protocols and flight logs, and apply pattern-based OPSEC redaction across defined sensitive categories.
3. **Typed TypeScript Core & CLI (`packages/*`, `uav-readiness` binary):**
   - operates on a strict 4-file evidence bundle contract: `BOM.csv`, `demo_manual.md`, `test_log.csv`, `qa_notes.md`;
   - supports both synthetic demo bundles (`examples/demo-*`) and user-provided bundles (`synthetic: false`, omitting the `SYNTHETIC DEMO` banner).

## What does the project generate?

Depending on the selected contour, the system generates:

- a 4-column problem-first inspection table (`Parameter | Result / Status | Sources | Next Action`) and an encrypted `#diag=` capsule in the browser;
- a Markdown readiness or audit report (`readiness-report.md` or `.audit.md`);
- a JSON evidence graph (`evidence-graph.json`, validated against JSON Schema Draft 2020-12);
- a JSON readiness assessment (`readiness-assessment.json`, `0–100` scale with `CONFLICT_CEILING = 49`);
- a CSV traceability matrix (`traceability-matrix.csv` with CSV formula injection protection);
- a SHA-256 input artifact manifest (`artifact-hashes.json`) and a `SARIF 2.1.0` report (`readiness.sarif`).

## What is the main rule?

```text
No evidence -> locked (UNVERIFIED).
```

If the tool cannot find a paired source for a claim, encounters an unsupported formula, or cannot deterministically verify a parameter, it explicitly marks the item as `UNVERIFIED` or `locked` and never passes unverified data as `PASS`.

## What sample data is included in the repository?

The provenance of all sample and control files is documented in `docs/real-samples/PROVENANCE.json` and `docs/demo-data-policy.en.md`:
- `examples/demo-*` — synthetic training bundles used to verify deterministic scores (`44/100`, `80/100`, and `49/100`);
- `docs/real-samples/` — verbatim open-source and public procurement artifacts (Prozorro, PX4, ArduPilot, pyubx2) alongside derived control fixtures (`07_Prozorro_UAV_Protocol_DJI_Matrice_4T.xlsx`, `09_Real_UAV_Readiness_Matrix_BOM.csv`, `10_Stamped_PMV_Protocol_Scan_VP_MOU.pdf`) containing intentionally injected discrepancies to demonstrate conflict detection.

## What does the project not do?

It does not control drones or robots, does not process live in-flight telemetry, does not generate routes or waypoints, does not support payload or targeting operations, and never connects to flight hardware. The `0–100` score measures completeness and consistency of the provided documentation bundle, not physical airworthiness.

## How do I run and verify it?

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm test
npm run qa:self-audit
npm run demo:readiness
python3 engines/defdoc_ai/defdoc_auditor.py --self-test
python3 engines/telemetry_ew/telemetry_analyzer.py --self-test
```

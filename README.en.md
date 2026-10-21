# UAV Readiness & Evidence Copilot (`v2.5.0`) — Engineering Breakdown & System Architecture

*[Українською](README.md) · English · [Live Web Testbench](https://denisshumilov.github.io/uav-readiness-evidence-copilot/)*

![Verification Testbench Overview](docs/social-card.png)

> **I automate technical documentation bundle verification tailored to your company's workflows.**
> I build local tools for cross-checking technical documents and tables. They find discrepancies, point to the exact source of every finding, and explicitly flag what could not be verified. We start with one specific workflow of yours and an agreed set of sample files.

> **System Purpose (`v2.5.0`):** deterministic local verification of UAV engineering and acceptance documentation (`.docx`, `.xlsx`, `.pdf`, `.p7s`), byte-level inspection of binary flight telemetry logs (`.bin`, `.ulg`, `.tlog`, `.ubx`, `.nmea`), OPSEC de-identification of test-range coordinates and PII, and formal `0–100` assessment of evidence package completeness and consistency.
>
> **Safety & Epistemic Boundary (`No evidence → locked / UNVERIFIED`):** the system operates strictly on documentation, tables, and recorded log files. It never connects to flight hardware, never plans routes, and never controls vehicles. Missing evidence (`locked` or `0/100` on an empty bundle) means **"INSUFFICIENT DATA / UNVERIFIED (NOT EVALUATED) — the score measures completeness and consistency of the provided evidence bundle, not physical airworthiness of the vehicle."**

---

## 1. Architectural Separation: Live Web Testbench ⇄ GitHub Repository

1. **[Live Web Testbench (`https://denisshumilov.github.io/uav-readiness-evidence-copilot/`)](https://denisshumilov.github.io/uav-readiness-evidence-copilot/)** — a client-side inspection interface built around **Two-Tier Result Presentation**:
   - **Tier 1 (Automated local verification in seconds linked to exact source coordinates):** overall evidence completeness score (`0–100`), gate status (`READY` / `REQUIRES REMEDIATION` / `BLOCKED` / `UNVERIFIED`), critical contradiction count, and a prioritized 4-column problem-first matrix (`Parameter | Result / Status | Sources | Next Action`).
   - **Tier 2 (On-Demand Byte-Level Specification):** expandable technical disclosure blocks (`<details>`) exposing raw OOXML nodes, 7D SI dimension vectors, binary telemetry frame slices, `ASN.1 DER` certificate trees, and `SHA-256` artifact manifests.
2. **This GitHub Repository (`uav-readiness-evidence-copilot`, release `v2.5.0`)** — the complete engineering whitepaper and reference implementation:
   - documents the mathematical formulations and parser invariants across all 6 subsystems;
   - contains the full source code for the client-side JS/WASM modules (`docs/`), standalone Python byte-level auditors (`engines/`), and the typed TypeScript readiness monorepo (`packages/`);
   - enforces cross-surface determinism via **127** tests in Vitest (`packages/qa/`) plus standalone Python regression suites and Playwright Chromium E2E checks.

---

## 2. Repository Map — Where Everything Lives

```text
uav-readiness-evidence-copilot/
├── docs/                                   # Client-side web testbench, standalone JS/WASM modules & technical docs
│   ├── index.html                          # Main verification testbench hub (8 interactive local browser tools)
│   ├── tools/                              # Standalone verification tool pages (including universal-ai-cockpit.html)
│   ├── tools-engine.js                     # Deterministic readiness scoring, cross-check & parser engine
│   ├── multi-file-verifier-bundle.js       # Multi-artifact cross-verifier (.docx + .xlsx + .pdf + .bin + .p7s)
│   ├── browser-isolation-runtime.js        # Environment isolation diagnostics & capability probes
│   ├── pdf-scan-ocr-engine.js              # Beer-Lambert chromatic stamp drop-out & local matrix OCR engine
│   ├── encrypted-report-share.js           # Zero-server report capsule (AES-256-GCM + PBKDF2 in URL #diag=)
│   ├── coi-airgap-enclave-sw.js            # Cross-Origin Isolated Service Worker (COOP/COEP + strict CSP)
│   ├── architecture.md / .en.md            # Deep-tech architectural breakdown & dataflow specification
│   ├── scoring.md / .en.md                 # Mathematical model of the 0–100 readiness score & caps
│   ├── engineering-basis.md / .en.md       # Metrological basis, regulatory context & timing protocols
│   ├── evidence-model.md / .en.md          # Evidence graph model & status derivation rules
│   ├── safety-boundaries.md / .en.md       # Strict operational safety and isolation boundaries
│   └── standards.md / .en.md               # Engineering documentation standards reference (DSTU GOST, STANAG)
│
├── engines/                                # Standalone Python byte-level inspection engines (stdlib only)
│   ├── defdoc_ai/                          # Byte-level OOXML document auditor & OPSEC sanitizer
│   │   ├── defdoc_auditor.py               # Orchestrator for TU (.docx), PMV (.xlsx) & passport verification (v2.5.0)
│   │   ├── document_intake.py              # In-memory OOXML parser, Excel formula AST evaluator & 7D SI vectors
│   │   ├── sanitize_doc.py                 # Client-side PII/OPSEC de-identifier for .docx, .xlsx, .md (v2.5.0)
│   │   └── test_client_intake.py           # 22 client intake & security regression tests
│   └── telemetry_ew/                       # Binary flight telemetry analyzer
│       ├── telemetry_analyzer.py           # Binary parser for DataFlash (.bin), PX4 (.ulg), MAVLink, UBX, NMEA
│       ├── sanitize_telemetry.py           # Coordinate translation scrubber for binary & text flight logs
│       └── test_readiness.py               # 22 binary telemetry parser regression tests
│
├── packages/                               # TypeScript monorepo (deterministic 0–100 readiness core, v2.5.0)
│   ├── core/                               # Domain types, Zod schemas & cross-document revision conflict detector
│   ├── parsers/                            # Deterministic parsers for BOM.csv, manuals (.md), test logs, QA notes & ID disambiguation
│   ├── evidence/                           # Directed evidence graph builder (requirement → source → check)
│   ├── rules/                              # Status derivation (deriveEvidenceStatuses) & scoring (CONFLICT_CEILING = 49)
│   ├── reports/                            # Markdown, bilingual HTML, CSV traceability, SHA-256 & SARIF 2.1.0 exporters
│   ├── cli/                                # `uav-readiness` CLI binary for local batch audits and CI/CD gates
│   └── qa/                                 # End-to-end CLI tests, Ajv JSON Schema checks, Playwright E2E & selfAudit
│
├── examples/                               # Reference evidence bundles for deterministic verification
│   ├── demo-uav-readiness/                 # Baseline incomplete evidence bundle (deterministic score: 44/100)
│   ├── demo-maintenance-readiness/         # Maintenance verification bundle (deterministic score: 80/100)
│   ├── demo-conflict-readiness/            # Cross-document revision conflict bundle (capped at: 49/100)
│   └── demo-tdp-supplier-package/          # Supplier TDP bundle with connector spec conflict (capped at: 49/100)
│
└── schemas/                                # Formal JSON Schema specifications (Draft 2020-12)
    ├── evidence-graph.schema.json          # Structural contract for evidence-graph.json
    └── readiness-assessment.schema.json    # Structural contract for readiness-assessment.json
```

---

## 3. Three-Contour Capability Matrix (`Browser Local UI` vs `Python CLI Engines` vs `TypeScript Core & CLI`)

| Contour | Input Formats & Structure | What Is Actually Verified | Generated Output | Honest Engineering Boundaries | Verification Command / Test |
|---|---|---|---|---|---|
| **1. Browser Local UI (`docs/*.js`, `docs/index.html`, `universal-ai-cockpit.html`)** | `.docx`, `.xlsx`, `.csv`, `.tsv`, `.pdf` (raster reference template `560×220 px` + vector `/FlateDecode`), `.p7s` (`ASN.1 DER`), `.bin`, `.ulg`, `.tlog`, `.ubx`, `.nmea`, `.c/.cpp/.py/.lua` | Cross-document spec collisions (7D SI vectors), Excel formula cache (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT` and `+`, `-`, `*`, `/`), wet-stamp drop-out & fixed-grid `560×220 px` Hamming glyph classification, `CMS SignedData` (`.p7s`) RFC 5652 structure via `SignerInfo.sid`, binary log headers/CRCs, `SHA-256` duplicates | 4-column problem-first matrix (`Parameter \| Result / Status \| Sources \| Next Action`), `#diag=` encrypted capsule (`AES-256-GCM` + 128-bit CSPRNG secret), Markdown/CSV/JSON exports | Browser offline mode does NOT perform mathematical `DSTU 4145-2002` curve verification or live OCSP/CRL queries (`UNVERIFIED_CRYPTO`); browser OCR targets the fixed `560×220 px` reference template (arbitrary scans → `UNVERIFIED`); pattern-based OPSEC redaction requires human review before external sharing; a single 2-column file without a second source yields `SINGLE_SOURCE_UNVERIFIED` | `npm test` (`siteParity.test.ts`, `browserIntegration.test.ts`, `browserE2E.test.ts` on Playwright Chromium) |
| **2. Python CLI Engines (`engines/defdoc_ai/*`, `engines/telemetry_ew/*`)** | `.docx`, `.xlsx`, `.md`, `.txt` + binary logs `.bin`, `.ulg`, `.tlog`, `.ubx`, `.nmea`, `.csv`, `.gz` (up to `64 MiB`, ZIP limit `128 MiB`) | `<w:tbl>` tables with `gridSpan`/`vMerge`, intervals, `±` tolerances, BOM kit counts, PMV vs binary flight log cross-check, `Fletcher-8` / `CRC-16/MCRF4XX` / `XOR` checksums, PII tokenization (`leaked_pii_tokens_remaining = 0`) | Markdown audit report (`.audit.md`), sanitized `.sanitized.docx/.xlsx`, JSON de-identification & telemetry stats, 4-file bundle for TypeScript Core | Does not infer contradictions from unstructured free prose without tables or custom columns lacking SI units/operators (`UNVERIFIED`); outputs descriptive telemetry statistics without causal EW claims | `python3 engines/defdoc_ai/defdoc_auditor.py --self-test`, `--test-client`, `--benchmark`, `sanitize_doc.py --json-stats`, `telemetry_analyzer.py --self-test` |
| **3. TypeScript Core & CLI (`packages/core`, `parsers`, `rules`, `evidence`, `reports`, `cli`)** | Strict 4-file evidence bundle contract: `BOM.csv`, `demo_manual.md`, `test_log.csv`, `qa_notes.md` (supports both synthetic demo and real BYOD folders without `SYNTHETIC DEMO` banner) | Non-empty artifact & excerpt backing for every claim, dangling evidence detection, test outcome gating (`fail`/`blocked` → `locked`), `subject=value` revision conflicts (`CONFLICT_CEILING = 49`), `Zero-Evidence Ceiling = 0` | `readiness-assessment.json`, `evidence-graph.json`, `readiness-report.md`, `traceability-matrix.csv` (with CSV formula injection guard), `artifact-hashes.json`, `readiness.sarif` (`SARIF 2.1.0`) | Evaluates documentation completeness and consistency only (not airworthiness); `verified` (`reviewer_upper_bound`) indicates linked source presence without detected contradiction | `npm test`, `npm run qa:self-audit`, `npm run demo:readiness`, `npm run demo:conflict`, `npm run demo:lock`, `npm run demo:pack` |

---

## 4. Engineering Pilot on a Single Agreed Process (Service Positioning & Evaluation Metrics)

> **I automate technical documentation bundle verification tailored to your company's workflows.**
> I build local tools for cross-checking technical documents and tables. They find discrepancies, point to the exact source of every finding, and explicitly flag what could not be verified. We start with one specific workflow of yours and an agreed set of sample files.

### 6 Fixed Pilot Stages
1. **Single Process**: selecting one specific engineering cross-check workflow (e.g., TU ↔ PMV ↔ BOM specification).
2. **Agreed Inputs**: fixing supported formats and table structures on de-identified sample files.
3. **Rules**: formalizing tolerances, SI units, and blocking conditions (`FAIL` / `LOCKED` / `UNVERIFIED`).
4. **Required Output**: aligning on report layout, traceability matrix, and `#diag=` encrypted capsule format.
5. **Hold-out Set Validation**: validating on unseen files not used during rule calibration.
6. **Code, Tests, and Guide Handover**: delivering the standalone package, automated test suite, and documentation to the customer's team.

*Timeline and pricing are determined after reviewing de-identified samples and task boundaries.*

### 4 Pilot Evaluation Metrics (Measured on the Hold-Out Set)
1. **Discrepancy Recall**: `TP / (TP + FN)` — fraction of true discrepancies in the hold-out bundle detected and linked to source coordinates.
2. **False Discovery Rate**: `FP / (TP + FP)` — fraction of false alarms among all raised warnings.
3. **Unverified Rate**: `UNVERIFIED / Total` — fraction of items or files transparently deferred to human review as unsupported or incomplete.
4. **Total Engineer Workflow Time (`T_before` vs `T_after`)**: comparison of end-to-end manual review time before deployment (`T_before`) against tool-assisted workflow time **including human review and verification of the generated report** (`T_after`).

*Zero-denominator rule: if the denominator of any metric equals `0` (for example, `TP + FN = 0`), the metric is reported as **"undefined on this dataset"** (`не визначено на цьому наборі`) and is never interpreted as `100%` or `0%`.*

### Complete End-to-End Verification Cycle Example (From Input Files to Corrected Report)

1. **Initial Files (`Input`):** an engineer loads the public technical requirements `06_Prozorro_UAV_TechVymogy_DJI_Matrice_4T.docx` (verbatim from Prozorro) and the control test protocol `07_Prozorro_UAV_Protocol_DJI_Matrice_4T.xlsx` (derived from `06` with 2 intentionally injected discrepancies per `docs/real-samples/PROVENANCE.json`).
2. **Detected Discrepancies (`Before Fix`):** the engine aligns 47 parameter pairs via 7D SI vectors and flags **2 discrepancies**:
   - `Standard Battery Voltage`: requirements state `14.76 V`, protocol states `15.40 V` (`Δ = +0.64 V`, status `FAIL`);
   - `Maximum Horizontal Flight Speed`: requirements state `21 m/s`, protocol states `18.5 m/s` (`Δ = -2.5 m/s`, status `FAIL`).
3. **Exact Source Coordinates (`Provenance`):**
   - `06_Prozorro_UAV_TechVymogy_DJI_Matrice_4T.docx (word/document.xml: table 2, row 21)` ⇄ `07_Prozorro_UAV_Protocol_DJI_Matrice_4T.xlsx (sheet1.xml!row 20 (A20,B20,C20))`;
   - `06_Prozorro_UAV_TechVymogy_DJI_Matrice_4T.docx (word/document.xml: table 2, row 10)` ⇄ `07_Prozorro_UAV_Protocol_DJI_Matrice_4T.xlsx (sheet1.xml!row 9 (A9,B9,C9))`.
4. **Deferred to Human Review (`UNVERIFIED`):** single-source procurement quantity `DJI Matrice 4T — 55 kits` (present only in table 1 of requirements without a paired row in the test protocol) and compound 3D dimension strings without a single scalar SI rule are explicitly marked `UNVERIFIED`.
5. **Engineer Action (`Remediation`):** the engineer checks cells `C20` and `C9` in `07_Prozorro_UAV_Protocol_DJI_Matrice_4T.xlsx` against the bench log (`4S LiHV 14.76 V` and `21 m/s`), updates the protocol values (or records a formal deviation), and reloads the pair.
6. **Re-Verification (`After Fix`):** both parameters transition from `FAIL` to `PASS` (`0` discrepancies between requirements and protocol), and the updated report and `#diag=` capsule record the new SHA-256 digests.

---

## 5. Reference Bundles & Quick Start Commands

| Reference Bundle | Scenario | Verified / Partial / Locked / Conflict | Deterministic Score |
|---|---|---|---|
| `examples/demo-uav-readiness` | Baseline incomplete evidence bundle (`5 locked`, `4 partial`, `7 warnings`) | `8 / 4 / 5 / 0` | **44/100** (`Blocked`) |
| `examples/demo-maintenance-readiness` | Maintenance verification bundle (`2 partial`, `4 warnings`) | `8 / 2 / 0 / 0` | **80/100** (`Reviewable`) |
| `examples/demo-conflict-readiness` | Cross-document revision conflict between `BOM.csv` and `qa_notes.md` (`CONFLICT_CEILING`) | `8 / 0 / 0 / 1` | **49/100** (`Blocked by Conflict Ceiling`) |
| `examples/demo-tdp-supplier-package` | Supplier TDP bundle with connector spec conflict (`CONFLICT_CEILING`) | `7 / 1 / 0 / 1` | **49/100** (`Blocked by Conflict Ceiling`) |

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm test
npm run qa:self-audit
npm run demo:readiness
npm run demo:conflict
npm run demo:lock
npm run demo:pack

python3 engines/defdoc_ai/defdoc_auditor.py --self-test
python3 engines/defdoc_ai/defdoc_auditor.py --test-client
python3 engines/defdoc_ai/defdoc_auditor.py --benchmark
python3 engines/defdoc_ai/sanitize_doc.py --json-stats
python3 engines/telemetry_ew/telemetry_analyzer.py --self-test
```

## License

Released under the [MIT License](LICENSE).

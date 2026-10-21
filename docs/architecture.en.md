# System Architecture & Deep-Tech Subsystem Breakdown (`v2.5.0`)

*[Українською](architecture.md) · English · [Main Repository README](../README.en.md)*

> Розробляю локальні інструменти для звірки технічних документів і таблиць. Вони знаходять розбіжності, показують джерела висновків та окремо позначають те, що не вдалося перевірити. Починаємо з одного вашого процесу й узгодженого набору файлів.

This document details the internal engineering architecture of **UAV Readiness & Evidence Copilot (`v2.5.0`)**: the separation between the live browser testbench and this source repository, the complete repository map, the Three-Contour Capability Matrix, the mathematical foundations of the 6 core verification subsystems, and the deterministic `0–100` readiness evaluation pipeline.

---

## 1. Architectural Separation: Live Web Testbench ⇄ GitHub Repository

1. **[Live Web Testbench (`https://denisshumilov.github.io/uav-readiness-evidence-copilot/`)](https://denisshumilov.github.io/uav-readiness-evidence-copilot/)** — a client-side inspection interface built around **Two-Tier Result Presentation**:
   - **Tier 1 (Automated local verification in seconds linked to exact source coordinates):** presents overall readiness score (`0–100`), gate verdict (`READY` / `REQUIRES REMEDIATION` / `BLOCKED` / `UNVERIFIED`), critical contradiction count, and a prioritized 4-column problem-first matrix (`Параметр | Результат / статус | Джерела | Наступна дія`).
   - **Tier 2 (On-Demand Byte-Level Specification):** expandable technical disclosure blocks (`<details>`) exposing raw OOXML nodes, 7D SI dimension vectors, binary telemetry frame slices, `ASN.1 DER` certificate trees, and `SHA-256` artifact manifests.
2. **This GitHub Repository (`uav-readiness-evidence-copilot`, release `v2.5.0`)** — the complete engineering whitepaper and reference implementation:
   - documents the mathematical formulations and parser invariants across all 6 subsystems;
   - contains the full source code for the client-side JS/WASM modules (`docs/`), standalone Python byte-level auditors (`engines/`), and the typed TypeScript readiness monorepo (`packages/`);
   - enforces cross-surface determinism via **89** Vitest test cases (`packages/qa/src/siteParity.test.ts` and `selfAudit.ts`) plus standalone Python regression suites and Playwright Chromium E2E tests.

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
| **1. Browser Local UI (`docs/*.js`, `docs/index.html`, `universal-ai-cockpit.html`)** | `.docx`, `.xlsx`, `.csv`, `.tsv`, `.pdf` (raster scan `560×220` + vector `/FlateDecode`), `.p7s` (`ASN.1 DER`), `.bin`, `.ulg`, `.tlog`, `.ubx`, `.nmea`, `.c/.cpp/.py/.lua` | Cross-document spec collisions (7D SI vectors), Excel formula cache (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT` and `+`, `-`, `*`, `/`), wet-stamp drop-out & WASM OCR, `CMS SignedData` (`.p7s`) structure via `SignerInfo.sid`, binary log headers/CRCs, `SHA-256` duplicates | 4-column problem-first matrix (`Параметр \| Результат / статус \| Джерела \| Наступна дія`), `#diag=` encrypted capsule (`AES-256-GCM` + 128-bit CSPRNG secret), Markdown/CSV/JSON exports | Browser offline mode does NOT perform mathematical `DSTU 4145-2002` curve verification or live OCSP/CRL queries (`UNVERIFIED_CRYPTO`); OCR targets aligned scans; a single 2-column file without a second source yields `SINGLE_SOURCE_UNVERIFIED` | `npm test` (`siteParity.test.ts`, `browserIntegration.test.ts`, `browserE2E.test.ts` on Playwright Chromium) |
| **2. Python CLI Engines (`engines/defdoc_ai/*`, `engines/telemetry_ew/*`)** | `.docx`, `.xlsx`, `.md`, `.txt` + binary logs `.bin`, `.ulg`, `.tlog`, `.ubx`, `.nmea`, `.csv`, `.gz` (up to `64 MiB`, ZIP limit `128 MiB`) | `<w:tbl>` tables with `gridSpan`/`vMerge`, intervals, `±` tolerances, BOM kit counts, PMV vs binary flight log cross-check, `Fletcher-8` / `CRC-16/MCRF4XX` / `XOR` checksums, PII tokenization (`leaked_pii_tokens_remaining = 0`) | Markdown audit report (`.audit.md`), sanitized `.sanitized.docx/.xlsx`, JSON de-identification & telemetry stats, 4-file bundle for TypeScript Core | Does not infer contradictions from unstructured free prose without tables or custom columns lacking SI units/operators (`UNVERIFIED`); outputs descriptive telemetry statistics without causal EW claims | `python3 engines/defdoc_ai/defdoc_auditor.py --self-test`, `--test-client`, `--benchmark`, `sanitize_doc.py --json-stats`, `telemetry_analyzer.py --self-test` |
| **3. TypeScript Core & CLI (`packages/core`, `parsers`, `rules`, `evidence`, `reports`, `cli`)** | Strict 4-file evidence bundle contract: `BOM.csv`, `demo_manual.md`, `test_log.csv`, `qa_notes.md` (supports both synthetic demo and real BYOD folders without `SYNTHETIC DEMO` banner) | Non-empty artifact & excerpt backing for every claim, dangling evidence detection, test outcome gating (`fail`/`blocked` → `locked`), `subject=value` revision conflicts (`CONFLICT_CEILING = 49`), `Zero-Evidence Ceiling = 0` | `readiness-assessment.json`, `evidence-graph.json`, `readiness-report.md`, `traceability-matrix.csv` (with CSV formula injection guard), `artifact-hashes.json`, `readiness.sarif` (`SARIF 2.1.0`) | Evaluates documentation completeness and consistency only (not airworthiness); `verified` (`reviewer_upper_bound`) indicates linked source presence without detected contradiction | `npm test`, `npm run qa:self-audit`, `npm run demo:readiness`, `npm run demo:conflict`, `npm run demo:lock`, `npm run demo:pack` |

---

## 4. Engineering Breakdown of the 6 Subsystems

### Subsystem 1: Byte-Level OOXML Parsing (`.docx`/`.xlsx`), 7D SI Dimensional Vectors & Excel Formula Cache Verification
- Reconstructs `<w:tbl>` grids with `<w:gridSpan>` and `<w:vMerge>` and inspects `w:rsidR` editing sessions.
- Independently evaluates supported Excel formula ASTs (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, and arithmetic operators `+`, `-`, `*`, `/`) against cached `<v>` values.
- Normalizes physical quantities to 7D SI dimension vectors $\vec{d} = [M, L, T, I, \Theta, N, J] \in \mathbb{Z}^7$.

### Subsystem 2: Beer-Lambert Chromatic Stamp Drop-Out & Local Scanned PDF Recognition
- Computes optical density $OD_c = -\log_{10}(\max(I_c, 1)/I_{0,c})$, projects out blue/violet wet stamp ink, and performs dynamic glyph matrix OCR with row `bbox` coordinates and dynamic delta calculation.

### Subsystem 3: Binary Flight Log Parsers (`.bin`, `.ulg`, `.tlog`, `.ubx`, `.nmea`)
- Validates binary headers and checksums (`Fletcher-8`, `CRC-16/MCRF4XX`, `XOR`) and flags empty/corrupted streams with zero valid frames as `WARN / UNVERIFIED`.

### Subsystem 4: Structural Digital Signature Parsing (`.p7s`, `ASN.1 DER`, `CMS SignedData` per RFC 5652)
- Enforces strict `ASN.1 DER` (`ContentInfo -> SignedData`), rejects BER indefinite lengths (`0x80`), truncated TLVs (`corrupted_der`), and trailing bytes (`trailing_bytes`).
- Binds the signer certificate strictly via `SignerInfo.sid` (`IssuerAndSerialNumber` / `SubjectKeyIdentifier`), extracts X.509 RDN attributes directly from the matched certificate tree, and records a cryptographic SHA-256 fingerprint of the document state at the moment of inspection (independent time attestation requires an external qualified TSP timestamp).
- Clearly separates structural validity (`structuralStatus: "PASS" | "FAIL"`) from offline cryptographic verification (`cryptoStatus: "UNVERIFIED"` / `UNVERIFIED_CRYPTO`).

### Subsystem 5: OPSEC Sanitization Across Geolocation Channels & PII Entities
- Performs deterministic PII tokenization and coordinate translation while verifying `leaked_pii_tokens_remaining = 0`.

### Subsystem 6: Deterministic Readiness Scoring `0–100` (`CONFLICT_CEILING = 49`, `Zero-Evidence Ceiling = 0`) & Zero-Server Encrypted Sharing (`#diag=`)
- Enforces `CONFLICT_CEILING = 49` on cross-document conflicts and forces `readinessScore = 0` (`UNVERIFIED`) when a bundle contains zero verified or partially verified artifact-backed claims.
- Encrypts diagnostic capsules in-browser using WebCrypto `AES-256-GCM` with a 128-bit CSPRNG secret (`32` hex characters) inside the `#diag=` URL fragment.

---

## 5. Engineering Pilot on a Single Agreed Process (`Інженерний пілот на одному узгодженому процесі`)

### 6 Fixed Pilot Stages
1. **Один процес (Single Process)**: selecting one specific engineering cross-check workflow (TU ↔ PMV ↔ BOM specification).
2. **Погоджені входи (Agreed Inputs)**: fixing supported formats and table structures on de-identified sample files.
3. **Правила (Rules)**: formalizing tolerances, SI units, and blocking conditions (`FAIL` / `LOCKED` / `UNVERIFIED`).
4. **Потрібний вихід (Required Output)**: aligning on report layout, traceability matrix, and `#diag=` encrypted capsule format.
5. **Перевірка на відкладеному контрольному наборі (Hold-out set)**: validating on unseen files not used during rule calibration.
6. **Передача коду, тестів та інструкції (Handover)**: delivering the standalone package, automated test suite, and documentation to the customer's team.

*Timeline and pricing are determined after reviewing de-identified samples and task boundaries (`Час і вартість визначаються після перегляду знеособлених зразків і меж задачі`).*

### 4 Pilot Evaluation Metrics
1. **Повнота виявлення розбіжностей (Recall)**: `TP / (TP + FN)`
2. **Частка хибних спрацювань (False Discovery Rate)**: `FP / (TP + FP)`
3. **Частка неперевіреного (Unverified Rate)**: `UNVERIFIED / Total`
4. **Повний час роботи інженера (`T_before` vs `T_after`)**: comparison of manual review time before deployment (`T_before`) against tool-assisted workflow time including human review and verification of the generated report (`T_after`).

*If the denominator of any metric equals `0` (`TP + FN = 0`), the metric is reported as **"не визначено на цьому наборі" ("undefined on this dataset")** and is never interpreted as `100%` or `0%`.*

---

## 6. Quick Start, CLI Commands & Automated Test Suites

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm test
npm run qa:self-audit
python3 engines/defdoc_ai/defdoc_auditor.py --self-test
python3 engines/defdoc_ai/defdoc_auditor.py --test-client
python3 engines/defdoc_ai/defdoc_auditor.py --benchmark
python3 engines/defdoc_ai/sanitize_doc.py --json-stats
python3 engines/telemetry_ew/telemetry_analyzer.py --self-test
```

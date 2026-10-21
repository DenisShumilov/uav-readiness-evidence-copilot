# Engineering Basis of Verification — shmlv. systems

*[Українською](engineering-basis.md) · English · [Main Repository README](../README.en.md)*

This document links public engineering statements to source code, reproducible benchmarks, and primary standards. The UAV Copilot implementation stack is **Python / TypeScript**. **C++17/20 · Python · TypeScript** describes the author's wider engineering specialization, not the language breakdown of every individual repository. The repository release, document engine, and TypeScript CLI version is **v2.5.0**.

## Cost of a Missed Discrepancy

**Conditional scenario:** if a package return during military acceptance review (VP MOU) adds **10–14 days** of re-approval turnaround in an enterprise workflow, catching even **1 contradiction** between Technical Specifications (`.docx`) and the Test Protocol (`.xlsx`) prior to submission is high-leverage. These numbers represent an illustrative workflow scenario, not a statutory deadline or verified industry-wide statistic. Actual time savings depend on the specific team's review cycle.

## Reproducible Benchmark

Measured on 2026-10-19 on Intel Core i9-9880H 2.30 GHz, macOS 14.8.5, Python 3.9.6. Five consecutive runs on the synthetic three-file OpenXML bundle; engine revision `6ed10888ce8402eb096e619bb3339a90aa6a721f`.

| Measurement Boundary | Median | Range |
|---|---:|---:|
| Deterministic cross-audit | **11.92 ms** | 11.64–13.07 ms |
| De-identification + cross-audit | **26.95 ms** | 26.41–29.33 ms |
| Full `--self-test` process | **280.59 ms** | 237.13–372.74 ms |

Internal report timers cover specific in-memory stages, whereas external `time.perf_counter()` measurements cover Python startup, synthetic fixture generation, checks, XML patching, and report serialization. This is not an SLA for arbitrary enterprise documents. The legacy **28.5 ms** value was a static string in an earlier browser demo without a timing protocol and has been retired as a benchmark. Determinism applies to rule evaluation outcomes, not wall-clock execution time.

```bash
# Running self-test generates/updates synthetic fixtures next to the script.
# To reproduce without modifying the working tree, copy engines/ to a temporary directory.
python3 engines/defdoc_ai/defdoc_auditor.py --self-test
python3 engines/telemetry_ew/telemetry_analyzer.py --self-test
```

## Regulatory & Standards Context

- [Cabinet of Ministers of Ukraine Resolution No. 345 of 25.02.2015](https://zakon.rada.gov.ua/laws/show/345-2015-%D0%BF): governs defense procurement and acceptance procedures during a special period. It does not mandate a universal "one error = 10–14 days" rule.
- [DSTU GOST 2.104:2006 — "Basic Inscriptions", Order No. 373/2006](https://zakon.rada.gov.ua/rada/show/v0373609-06).
- [UkrNDNC Order No. 22 of 26.02.2026, official publication by Ukrmetrteststandart, DOC](https://csm.kiev.ua/images/stories/2026/nakazi_2026/n22_2026.doc): row 39 — DSTU GOST 2.104:2006; row 51 — **DSTU GOST 2.114-97 (GOST 2.114-95)**, "Technical Specifications", as explicitly designated in the order. Renewed validity: 01.03.2026–25.11.2027; scope limited to manufacturing/supply ordered by state defense, security, and fuel-energy customers.

For enterprise integration, the organization's quality control (normocontrol) department defines the applicable standard revision and check catalog. Citing these documents provides engineering context and does not constitute state certification or a legal declaration of compliance.

## Binary Formats & Navigation Metrics

| Object / Format | Primary Source & Exact Detail | Current Implementation Boundary |
|---|---|---|
| ArduPilot DataFlash | [AP_Logger/LogStructure.h](https://github.com/ArduPilot/ardupilot/blob/master/libraries/AP_Logger/LogStructure.h): `HEAD_BYTE1 = 0xA3`, `HEAD_BYTE2 = 0x95` | `engines/telemetry_ew/telemetry_analyzer.py` parses self-describing `FMT` headers, dynamic message IDs, `c/C/e/E/L` scaling factors, and `UNIT`/`MULT`/`FMTU` metadata (`schema_units`). Records missing `FMT`, sync loss, and truncated frames fail with exit code 2. |
| PX4 ULog | [ULog Specification](https://docs.px4.io/main/en/dev_log/ulog_file_format): `55 4C 6F 67 01 12 35`, followed by version and timestamp | `telemetry_analyzer.py` parses v0/v1 headers, `F`/`A`/`R`/`D` records, primitive types, arrays, and nested structures (up to depth 16), verifies integer `timestamp` types and duplicate-free fields; non-zero `incompat_flags` are rejected. |
| UBX / MAVLink / NMEA / CSV / GZIP | [u-blox Interface Description](https://content.u-blox.com/sites/default/files/u-blox_ZED-F9H_InterfaceDescription_%28UBX-19030118%29.pdf), [MAVLink Serialization](https://mavlink.io/en/guide/serialization.html) | `telemetry_analyzer.py` verifies Fletcher checksums (`NAV-PVT` 84/92 B, `NAV-SAT`, `NAV-STATUS`, `NAV-DOP`, `MON-HW` 60/68 B), MAVLink v1/v2 `CRC-16/MCRF4XX` (demultiplexed by `sysid/compid`), NMEA XOR checksums, and GZIP integrity. The engine outputs descriptive field statistics and does **not** make causal claims about EW jamming or spoofing. |

Historical thresholds `FLAT_MAX_STD_*` (`≤2.8` / `≤4.0 dB-Hz`) and the `3 Jam / 6 Spoof / 11 OK` summary in `SAMPLE_TELEMETRY_EW_REPORT.md` belong to the earlier v2.0 synthetic demonstrator; the production `telemetry_analyzer.py` does not use them and does not attribute C/N0 variations to EW causes. The browser testbench (`docs/index.html`) includes separate illustrative visualization heuristics that must not be conflated with the Python CLI analyzer. A dedicated bridge in `document_intake.py` (`--telemetry`) cross-checks aggregated telemetry JSON ranges against numerical claims in PMV/Passport documents.

## Demonstration & Acceptance Boundaries

- Interactive preset buttons in the browser switch prepared matrices and byte buffers; they do not replace enterprise Word/Excel authoring tools.
- Python `--apply-fixes-from-bundle` applies deterministic XML patches strictly to synthetic `--self-test` fixtures. It is blocked on client files and must never be used to fabricate missing test evidence or signatures.
- `100/100` is an internal completeness score for a synthetic bundle under the example rules. Real testing, signatures, and submission decisions remain the responsibility of human engineering acceptance.
- Coordinate translation does not scrub every possible metadata channel. The data owner must verify authorization before sharing any file externally.

Custom parser calibration under an **Engineering Pilot on a Single Agreed Process** is limited to at most **2 engineering teams per month**, following a **free diagnostic check of 1 de-identified file**. A single file determines format compatibility, whereas cross-document discrepancy detection requires a document set. Timeline, pricing, scope, and acceptance criteria are determined after reviewing de-identified samples and task boundaries.

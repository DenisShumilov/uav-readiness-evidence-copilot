# Engineering basis — shmlv. systems

The [canonical Ukrainian engineering basis](engineering-basis.md) records source links, parser limits, the benchmark and acceptance boundaries.

UAV Copilot uses Python and TypeScript. C++17/20, Python and TypeScript describe the author's wider engineering practice. The document engine is v2.2; the TypeScript CLI is v0.8.1.

The 10–14 day delay is an explicitly conditional workflow scenario, not a statutory deadline or measured customer outcome. The former 28.5 ms website number was hardcoded and is not a verified benchmark.

Five runs on an Intel Core i9-9880H, macOS 14.8.5, Python 3.9.6 measured median audit time 11.92 ms, sanitization plus audit 26.95 ms, and full self-test process 280.59 ms. Internal report timers and external process timers distinguish those scopes.

DataFlash synchronization bytes are `0xA3 0x95` (`engines/telemetry_ew/telemetry_analyzer.py` parses self-describing `FMT` definitions, dynamic message IDs, and `UNIT`/`MULT`/`FMTU` metadata into `schema_units`). ULog magic is `55 4C 6F 67 01 12 35` (`telemetry_analyzer.py` parses v0/v1 headers and `F`/`A`/`R`/`D` records with primitive, array, and nested types up to depth 16, rejecting unsupported `incompat_flags`). It also inspects `UBX` (`NAV-PVT` 84/92 B, `NAV-SAT`, `NAV-STATUS`, `NAV-DOP`, `MON-HW` 60/68 B), `MAVLink` v1/v2 (separated by `sysid/compid`), `NMEA 0183`, `CSV`, and single-member `GZIP`. The current production analyzer outputs descriptive stream/field statistics only and does **not** make causal EW/jamming/spoofing claims; the `3 Jam / 6 Spoof / 11 OK` table in `SAMPLE_TELEMETRY_EW_REPORT.md` is a historical v2.0 synthetic demo artifact.

In `site/index.html`, the first two tabs display prepared synthetic scenarios while the Cyber cross-domain demo and the local file dropzone run in-browser JS parsers with explicit structural limits. A `100/100` synthetic score is not certification. Prepared Python patches (`--apply-fixes-from-bundle`) are restricted to synthetic `--self-test` fixtures and must never be used to invent real test evidence or signatures. Standards references provide context, not a declaration of compliance.

Custom parser calibration is limited to two engineering teams per month after a free diagnostic check of one deidentified file. Scope and acceptance criteria are agreed before implementation.

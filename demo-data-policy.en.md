# Demo and Control Data Policy (`v2.5.0`)

*[Українською](demo-data-policy.md) · English*

This document defines the provenance, labeling, and safety rules for all sample files included in the repository (a complete per-file registry with SHA-256 digests is maintained in [`docs/real-samples/PROVENANCE.json`](real-samples/PROVENANCE.json)).

## Three Categories of Test Data in the Repository

1. **Synthetic Training Bundles (`examples/demo-*`):**
   - fully fictional 4-file bundles (`BOM.csv`, `demo_manual.md`, `test_log.csv`, `qa_notes.md`) authored to deterministically test readiness scoring rules (`44/100`, `80/100`, `49/100`);
   - every synthetic demo folder is explicitly labeled `Synthetic demo data only. Not operationally valid.`
2. **Verbatim Public Reference Artifacts (`docs/real-samples/`, documented via the `key`, `filename`, `sizeBytes`, `sourceOrg`, `tenderOrRepo`, `sourceUrl`, `license`, `descriptionUk`, `sha256`, `isFrameAlignedSlice`, and `originalFile` fields in the `samples` array of `PROVENANCE.json`):**
   - unmodified public files from open Prozorro procurement tenders (`06_Prozorro_UAV_TechVymogy_DJI_Matrice_4T.docx`, `06a_Prozorro_UAV_TechVymogy_DJI_Matrice_4T_Tender2.docx`, `06b_Prozorro_UAV_TTX_DJI_Mavic_3T.docx`, `07a_Prozorro_Real_Tender_Attachment_104.xlsx`, `08_Prozorro_Real_KEP_Sign.p7s`) and official open-source autopilot/GNSS test suites (`ArduPilot`, `PX4`, `pyubx2`, `NMEA`).
3. **Derived Control Fixtures with Injected Discrepancies (`docs/real-samples/`, documented in the top-level `verificationGuarantee` field and the `descriptionUk` field of each `samples` entry in `PROVENANCE.json`):**
   - `07_Prozorro_UAV_Protocol_DJI_Matrice_4T.xlsx` — a control test protocol derived from `06_Prozorro_UAV_TechVymogy_DJI_Matrice_4T.docx` with 2 intentionally injected discrepancies: `Standard Battery Voltage` in cell `C31` (`15.4 V` vs `14.76 V`, `Δ = +0.64 V`) and `Operating Temperature` in cell `C48` (`from -10° to 40° C` vs `from -20°C to 50°C`) to demonstrate cross-document conflict detection (alongside a live post-remediation check yielding `47/47 PASS, 0 FAIL`);
   - `09_Real_UAV_Readiness_Matrix_BOM.csv` — a control BOM table with 2 intentionally injected revision conflicts (`CONFLICT`);
   - `10_Stamped_PMV_Protocol_Scan_VP_MOU.pdf` — a synthetic raster protocol template (`560 × 220 px`) with a simulated wet blue stamp overlay used to test chromatic stamp drop-out.

## Blocked Data (Strictly Prohibited in the Repository)

No file in this repository may include:

- restricted or sensitive coordinates of real test ranges, launch sites, or landing zones;
- real operational routes, mission names, targeting data, or payload data;
- proprietary or NDA-protected engineering documentation from manufacturers;
- non-public personal data or private cryptographic keys.

## Labeling and Provenance Separation Rule

1. Synthetic bundles under `examples/demo-*` are explicitly labeled `SYNTHETIC DEMO`.
2. When evaluating user-provided files (`synthetic: false` in the CLI or custom files in the browser), the `SYNTHETIC DEMO` banner is omitted and artifacts are labeled as `User-provided`.
3. Every derived control fixture in `docs/real-samples/` is explicitly documented in `docs/real-samples/PROVENANCE.json` with each injected discrepancy listed so reviewers never mistake a control test fixture for an unmodified official protocol.

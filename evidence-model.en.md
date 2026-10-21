# Evidence Model

*[Українською](evidence-model.md) · English*

Evidence model means the rules for how the project treats proof.

The main idea is simple:

`No evidence -> locked.`

If there is no proof, the system must block the claim instead of guessing.

## Main Objects

## Artifact

Artifact means a file we receive or generate.

Active parsed input formats across the three system contours (`v2.5.0`):

1. **TypeScript Core & CLI Contour (`packages/*` — strict 4-file evidence bundle contract)**:
   - `BOM.csv` = bill of materials and component revision list;
   - `demo_manual.md` = technical manual and instruction text;
   - `test_log.csv` = bench and laboratory test table;
   - `qa_notes.md` = quality assurance notes and revision records.
2. **Browser Local UI (`docs/*.js`) and Python CLI Engines (`engines/*`) Contours**:
   - Office & tabular documents: `.docx` (Technical Specifications / Passport), `.xlsx` (PMV Test Protocols), `.csv`, `.tsv`, `.md`, `.txt`;
   - Scanned & vector PDFs: `.pdf` (including wet-stamped raster protocol scans);
   - Digital signature containers: `.p7s` (`ASN.1 DER` / `CMS SignedData` — structural inspection with explicit `UNVERIFIED_CRYPTO` boundary in browser offline mode);
   - Flight & navigation telemetry logs: `.bin` (ArduPilot DataFlash), `.ulg` (PX4 ULog), `.tlog` (MAVLink v1/v2), `.ubx` (u-blox), `.nmea` (NMEA 0183).

Planned future fixtures for expanding the TypeScript bundle contract:

- `future-fixtures/wiring_notes.yaml` = documentation-only wiring notes;
- `future-fixtures/config_dump.txt` = synthetic configuration dump text.

## Evidence Source

Evidence source means the exact file or record that supports a claim.

Example:

`test_log.csv` can support the claim "a bench test record exists."

Bench test means a safe table/lab check, not a flight mission.

Revision evidence can be structured: the BOM CSV has a `revision` column using `subject=value`, and
QA notes can include a `Revision: subject=value` line. The engine compares those fields to derive a
`conflict` when documents disagree; older `rev:subject=value` text is still accepted as a fallback.

## Evidence Claim

Evidence claim means a statement the system wants to make.

Safe example:

`The demo package includes a QA note.`

Unsafe example:

`The UAV is ready for a mission.`

The unsafe example is not allowed because this project does not make operational decisions.

## Evidence Link

Evidence link means the connection between a claim and the source that supports it.

Simple meaning:

`claim -> source file -> check result`

## Evidence Graph

Evidence graph means a map of claims and proof.

Graph means "things connected by lines." Here the lines show which file supports which claim.

## Evidence Lock

Evidence lock means a blocked claim.

A claim becomes locked when:

- the needed file is missing;
- the file is present but does not support the claim;
- sources disagree;
- the claim asks for unsafe operational detail.

## Claim Statuses

- `verified` = confirmed by evidence;
- `partial` = partly supported, but still incomplete;
- `locked` = blocked because evidence is missing or unsafe;
- `conflict` = two sources disagree.

## Wiring And Config Rule

Wiring means how parts are connected.

Config means settings.

Pinout means the map of pins/contacts on a board.

The project must never invent exact wiring, pinout, or config.

If exact wiring or config is not supported by evidence, mark it:

`locked`

## Readiness Score Rule

Readiness score means a simple documentation readiness estimate.

It must not mean:

- flight approval;
- mission approval;
- safety certification;
- tactical readiness.

If critical evidence is missing, the score must explain that the result is limited or locked.

## Safe Example

Claim:

`A synthetic BOM file exists.`

Evidence:

`examples/demo-uav-readiness/BOM.csv`

Status:

`verified`

## Locked Example

Claim:

`Exact wiring is verified.`

Evidence:

No wiring source exists.

Status:

`locked`

Reason:

`Exact wiring cannot be verified without a source file.`

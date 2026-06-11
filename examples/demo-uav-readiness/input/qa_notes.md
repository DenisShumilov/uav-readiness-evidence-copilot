# QA Notes

SYNTHETIC DEMO - EDUCATIONAL ONLY - NOT FOR REAL USE

These notes are fake training data for evidence review.

## Evidence Status Summary

| Evidence ID | Status | Meaning |
|---|---|---|
| EV-BOM-001 | verified | BOM row is present and linked to this QA note |
| EV-MAN-001 | verified | Demo manual exists and explains the review scope |
| EV-WIRE-001 | partial | Connector note has one source but needs another review note |
| EV-WIRE-002 | locked | Second connector label source is missing |
| EV-CONFIG-001 | locked | Config owner field is missing |

## Warning Finding

Finding ID: WARN-TRACE-001

Status: warning

Reason: one component record and one config record do not yet have enough evidence.

Impact: traceability is incomplete until the missing sources are added.

## Locked Items

- COMP-BOARD-001 stays locked because its supporting source is missing.
- EV-CONFIG-001 stays locked because the review owner is missing.

## Reviewer Reminder

Do not treat this demo as real approval.

Use it only to test evidence states:

- verified;
- partial;
- locked;
- warning.

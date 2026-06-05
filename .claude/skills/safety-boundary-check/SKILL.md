---
name: safety-boundary-check
description: Check whether files, prompts, examples, and docs stay inside safe UAV QA boundaries.
license: MIT
metadata:
  version: "0.1.0"
---

# Safety Boundary Check

Safety boundary means the line between allowed documentation work and blocked operational UAV work.

Allowed:

- documentation;
- QA;
- evidence tracking;
- traceability;
- readiness reports;
- synthetic demo data;
- locked steps.

Blocked:

- drone control;
- mission planning;
- routes;
- waypoints;
- targeting;
- payload control;
- tactics;
- evasion;
- live telemetry control;
- autonomous operation.

If a request crosses the boundary, refuse and redirect to safe QA/evidence work.

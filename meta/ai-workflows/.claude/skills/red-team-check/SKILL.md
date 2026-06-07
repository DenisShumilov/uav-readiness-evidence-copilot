---
name: red-team-check
description: Perform a safety and misuse review before UAV-related project changes.
license: MIT
metadata:
  version: "0.1.0"
---

# Red-Team Check

Red-team means critical risk review.

Before a change, check:

- Could this help drone control?
- Could this help mission planning?
- Could this create routes, waypoints, or targeting?
- Could this expose coordinates, telemetry, payload data, or tactics?
- Could this confuse documentation readiness with operational readiness?

Verdict options:

- SAFE
- NEEDS CHANGES
- BLOCKED

If unsafe, refuse and suggest a safe alternative:

documentation, QA, evidence locks, audit readiness, or portfolio explanation.

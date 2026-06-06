# packages/rules

Rules package placeholder.

Rules mean deterministic checks.

Deterministic means the same input gives the same result every time.

Future safe rules may check:

- missing documents;
- weak evidence;
- conflicting evidence;
- unsafe keywords;
- locked critical claims.

Implemented:

- `evaluateReadiness`, a simple documentation readiness rules engine.

Scoring formula:

- Start at 100.
- Subtract 6 points for each locked critical evidence item.
- Subtract 3 points for each partial evidence claim.
- Subtract 2 points for each warning.
- Subtract 10 points for each missing safe artifact.

The rules must never become mission, route, payload, or tactical rules.

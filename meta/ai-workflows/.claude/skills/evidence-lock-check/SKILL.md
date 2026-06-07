---
name: evidence-lock-check
description: Ensure every claim has evidence and missing proof becomes locked.
license: MIT
metadata:
  version: "0.1.0"
---

# Evidence Lock Check

Evidence means proof.

Locked means blocked because proof is missing.

Core rule:

`No evidence -> locked.`

Check every claim:

1. What is the claim?
2. Which artifact supports it?
3. Is the source enough?
4. Is the status verified, partial, locked, or conflict?
5. Is any wiring, pinout, or config being invented?

If a claim has no source, mark it locked.

Never invent exact wiring or config.

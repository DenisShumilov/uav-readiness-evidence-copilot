# Synthetic conflict-readiness demo

*[Українською](README.md) · English*

A **third** synthetic bundle that contains a deliberate contradiction, to showcase the
**conflict gate** in the readiness rules.

```text
Intended use:  educational documentation QA demo only.
Dataset type:  fully synthetic.
Fidelity:      medium — looks like document-control paperwork, not real data.
Limitations:   not operationally valid; revisions, IDs, and contents are artificial.
Safety:        no real coordinates, routes, telemetry, serial numbers, names, or operational content.
```

## Run

```powershell
npm run demo:conflict
```

Output is written to `examples/demo-conflict-readiness/output/` (not committed).

## What it shows

This package is almost fully evidenced — 11 verified claims. But the tool **derives a conflict by
itself**: the document index declares revision `TM-3` while the audit note declares `TM-2`. The code
compares these values across the two documents and **computes the `conflict` status**
(`claim.crosscheck.training-manual`) — the status is not hand-typed in the fixture.

Based on deductions alone the package would score ~90/100. But the **conflict gate** caps the verdict
at **49/100 (Blocked)**: a contradiction can never read as "ready" until the sources agree. This is
the honest behavior the whole project is built to demonstrate — evidence and consistency over
optimism.

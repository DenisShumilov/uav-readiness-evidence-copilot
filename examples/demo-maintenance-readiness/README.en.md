# Synthetic maintenance-readiness demo

*[Українською](README.md) · English*

A **second** synthetic example bundle, in a different shape from `demo-uav-readiness`. It exercises
the same pipeline (parsers → evidence graph → readiness rules → reports) on maintenance-style
records, and produces a clearly different, higher readiness score (a mostly-organized package).

```text
Intended use:  educational documentation QA demo only.
Dataset type:  fully synthetic.
Fidelity:      medium — looks like engineering paperwork, not real maintenance data.
Creation:      handcrafted synthetic records with cross-referenced IDs.
Limitations:   not operationally valid; dates, IDs, and contents are artificial.
Safety:        no real coordinates, routes, telemetry, serial numbers, names, or operational content.
```

## Run

```powershell
npm run demo:maintenance
```

Output is written to `examples/demo-maintenance-readiness/output/` (not committed).

## What it shows

Unlike the strict `demo-uav-readiness` package (44/100, "Blocked"), this package is mostly evidenced
and lands in the **"Reviewable, but incomplete"** band — but the tool still does its job: it flags a
partial record and keeps a missing disposal sign-off **locked**. Evidence, not optimism.

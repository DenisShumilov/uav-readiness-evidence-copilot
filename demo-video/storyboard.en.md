# ~70-second storyboard - English (live site recording)

Recorded by `demo-video/record-site-demo.mjs` from `site/index.html` (English UI).
The recorder keeps the same 5-beat structure for English and Ukrainian.

## Beat 1 - Hero + Thesis

Screen: English hero section. Readiness gauge settles at 44/100.

Say: Safe documentation QA only. The page checks whether paperwork supports its own claims.

## Beat 2 - Live Readiness Check

Screen: scroll to `#live`. Toggle `EV-BOM-001` off, then `EV-MAN-001` off. Linked claims become locked, the gauge falls from 44 to 26, then reset returns the score to 44.

Say: Status is derived from evidence. No evidence -> locked. The tool does not invent support.

## Beat 3 - Evidence Graph

Screen: scroll to `#evidence-graph`. Toggle one source off from the same internal state; graph edges and dependent claims turn locked-red. Toggle it back on.

Say: The graph reacts to the same toggle state as the live dashboard.

## Beat 4 - Conflict Gate

Screen: scroll to `#conflict-gate`. Hold long enough to read both synthetic documents, both hand-marked verified, and the derived verdict: 49/100 Blocked.

Say: Even when every row is hand-marked verified, conflicting documents stay blocked at 49/100.

## Beat 5 - End Card

Screen: full-screen end card overlay with the live-demo URL and command:
`npx github:DenisShumilov/uav-readiness-evidence-copilot demo`.

Say: The closing line points to the live demo and the command.

# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Public AI scaffold as a first-class artifact: [`AGENTS.md`](AGENTS.md) rules core and
  [`docs/scaffold.md`](docs/scaffold.md) with the 10 specialist agents, 7 skills, quality gates,
  a Mermaid diagram, a model-vs-scaffold comparison, and a real safety-agent refusal example.
- Rebuilt GitHub Pages site (`site/index.html`) into a single page with a live interactive readiness
  dashboard (toggle evidence sources → score and locked claims recompute), a scaffold showcase, and
  a safety-refusal exhibit. Bilingual UA/EN, no build step.
- README hero (both languages): thesis, badges, live-demo link, hero screenshot, and a TL;DR.
- First-screen clarity + accessibility: synthetic-data labeling on the score, a proof strip, a third
  recruiter CTA, a `role="status"` live region for the readiness score, and `:focus-visible` outlines.
- [`docs/scoring.md`](docs/scoring.md): transparent explanation of the readiness formula and bands.
- Repository hygiene: `CODE_OF_CONDUCT.md`, issue forms, Dependabot config, and this changelog.
- Machine-readable outputs: **SARIF 2.1.0** (`readiness.sarif`) for GitHub code-scanning ingest,
  and JSON Schemas for the output contracts (`schemas/`).
- Second synthetic example bundle `demo-maintenance-readiness` (`npm run demo:maintenance`, 80/100)
  proving the pipeline generalizes to a different document shape with a different, higher score.
- Third synthetic example bundle `demo-conflict-readiness` (`npm run demo:conflict`, 49/100) that
  contains a deliberate contradiction to showcase the conflict gate (deductions ~90, gated to 49).
- **Real cross-document conflict detection** (`detectCrossDocumentConflicts`, `packages/core`): the
  conflict gate now DERIVES a conflict by comparing declared revision values across documents
  (`rev:<subject>=<value>` tokens) instead of reading a hand-typed status. The conflict demo computes
  `TM-3` (document index) vs `TM-2` (audit note) → a derived `conflict` claim → capped at 49/100.
- Published the actual AI scaffold under `meta/ai-workflows/` (10 subagent + 7 skill files + the rules
  core), so the "built by a scaffold of 10 agents" claim is verifiable from real files.
- **Engine-derived evidence status** (`packages/rules/src/deriveStatus.ts`): the readiness engine now
  re-derives every claim's status from the evidence instead of trusting the reviewer's `Status`
  column, and may only make a verdict *more conservative* (never inflate). It locks dangling/absent
  evidence, grades `test_record` claims by their own logged outcome (a "verified" check that actually
  failed is overridden to `locked`), and surfaces an `engineAdjustments` list when its verdict and the
  reviewer label diverge. Demo scores are unchanged (44/80/49) and proven so by tests
  (`deriveStatus.test.ts`: `engineAdjustedCount === 0` for the internally consistent demo fixtures).
- **Site↔engine score parity test** (`packages/qa/src/siteParity.test.ts`): the live dashboard now
  applies the full 5-category formula + conflict ceiling from a single config mirroring `packages/rules`,
  and the test fails if any weight/cap drifts between the site and the engine.
- **Runtime scaffold gate** ([`.claude/settings.json`](.claude/settings.json) +
  [`meta/ai-workflows/hooks/scaffold-gate.mjs`](meta/ai-workflows/hooks/scaffold-gate.mjs)): a
  `PreToolUse` hook logs every tool call and blocks any edit/command introducing operational UAV
  terminology — the documentation-QA-only boundary as a measurable, tested runtime rule, with a
  committed sample log and tests (`scaffoldGate.test.ts`).
- Hardened cross-document conflict detection: the `rev:<subject>=<value>` token now tolerates
  whitespace, the input contract is documented, and `findMalformedRevisionMentions` surfaces malformed
  revision declarations instead of failing open silently.

### Changed

- Scoring guards in the readiness rules: a conflict deduction plus a **conflict gate** (a
  contradiction on a critical claim caps the verdict in the Blocked band) and **per-category caps**
  so one noisy bucket cannot dominate. Demo scores are unchanged (44/100 and 80/100).
- `evaluateReadiness` now takes a `DemoBundle` directly (removed an unused graph-input overload that
  silently dropped findings) and counts engine-derived statuses; demo scores stay 44/80/49.
- Removed the unreferenced, divergent `site/styles.css`; the page ships a single inline stylesheet.

### Fixed

- Post-review polish (from an adversarial multi-agent review of the session): SARIF result URIs now
  use each bundle's own example directory (was hardcoded to `demo-uav-readiness`); README demo-video
  links point at `v0.4.0-demo-video`; the site readiness bands match `docs/scoring.md`; agent #7's
  name is consistent ("Documentation & Portfolio"); added `og:image`/`twitter:card` social-preview
  tags + `site/social-card.png`; removed orphaned screenshot assets.

### Notes

- All demo data is synthetic and static. The project stays strictly within documentation QA,
  evidence, traceability, and readiness reporting — no operational UAV capability.

## Demo video releases

- `v0.6.0-demo-video` — re-recorded from the **English-default live site** after the honesty-audit
  hardening cycle (engine-derived status, site/engine parity, runtime scaffold gate). UK + EN.
- `v0.5.0-demo-video` — new video recorded from the **live interactive site**: shows the readiness
  score dropping 44 → 8 as evidence is toggled off, the 10-agent scaffold, and the safety refusal (UK + EN).
- `v0.4.0-demo-video` — polished Ukrainian demo video and voiceover.
- `v0.3.0-demo-video` — Ukrainian demo release.
- `v0.2.0-demo-video` — English demo release.

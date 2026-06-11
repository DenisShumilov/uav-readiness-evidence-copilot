# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

- No unreleased changes yet.

## [0.8.0] - 2026-06-11

### Added

- New `@uav-readiness/cli` package with the `uav-readiness` binary:
  - `uav-readiness check <dir>` scans a documentation folder for the four supported input contracts,
    reports parsed/skipped files, keeps missing evidence `locked`, and can write JSON, SARIF, and
    markdown outputs.
  - `uav-readiness demo` runs the bundled strict demo path for instant zero-setup output.
  - `--min-score` exits `1` when the documentation readiness score is below the configured gate, so
    the CLI can be used directly in CI.
- Root `bin` support for `npx github:DenisShumilov/uav-readiness-evidence-copilot`.
- Composite GitHub Action `UAV Readiness / Docs Evidence Check` with markdown summary and SARIF output.
- CI dogfood job that runs the local Action on `examples/demo-uav-readiness/input` and uploads SARIF
  with category `uav-readiness`.
- README sections in English and Ukrainian showing copy-paste CLI, GitHub Action, and strict demo usage.
- Category-level standards crosswalk docs (`docs/standards.en.md`, `docs/standards.md`) connecting the
  engine to public documentation-practice categories without claiming compliance.
- Fourth synthetic example bundle `demo-tdp-supplier-package` (`npm run demo:tdp`, 49/100 Blocked)
  framed as a TDP-style supplier package with locked claims, one partial cross-reference, and a
  derived revision conflict.
- Live-site evidence-graph section that renders sources, claims, and derived status edges from the
  same toggle state as the readiness dashboard.

### Changed

- Bumped all package versions to `0.8.0`.
- SARIF driver metadata now reports version `0.8.0` and maps QA warnings to the parsed QA-notes file
  when the CLI is pointed at a custom folder.
- README positioning and demo counts now cover all four bilingual demo bundles, including the
  TDP-style supplier package.

## [0.7.0] - 2026-06-11

### Added

- Public AI scaffold as a first-class artifact: [`AGENTS.md`](AGENTS.md) rules core and
  [`docs/scaffold.en.md`](docs/scaffold.en.md) with the 10 specialist agents, 7 skills, quality gates,
  a Mermaid diagram, a model-vs-scaffold comparison, and a real safety-agent refusal example.
- Rebuilt GitHub Pages site (`site/index.html`) into a single page with a live interactive readiness
  dashboard (toggle evidence sources → score and locked claims recompute), a scaffold showcase, and
  a safety-refusal exhibit. Bilingual UA/EN, no build step.
- README hero (both languages): thesis, badges, live-demo link, hero screenshot, and a TL;DR.
- First-screen clarity + accessibility: synthetic-data labeling on the score, a proof strip, a third
  recruiter CTA, a `role="status"` live region for the readiness score, and `:focus-visible` outlines.
- [`docs/scoring.en.md`](docs/scoring.en.md): transparent explanation of the readiness formula and bands.
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
- **Self-audit on real content** (`npm run demo:selfaudit`, `packages/qa/src/selfAudit.ts`): points the
  SAME derivation engine at this repository's own real documentation (not synthetic fixtures) — checks
  that documented demo scores match the engine's computed output, scaffold counts are real files,
  bilingual twins exist, and referenced assets resolve. A clean repo scores 100/100 with zero overrides;
  drift (a stale score, a missing twin) makes the engine override the documented claim
  (`verified -> locked`) and **fails CI**. The derivation now also accepts structural inputs
  (`DerivableClaim`/`DerivableSource`/`DerivableQaItem`) so it runs on real, non-operational evidence
  without forcing it through the synthetic-only schema. This is the first time the engine derives a
  verdict on input it did not author.
- **Reproducible gate demo** (`npm run demo:gate`): spawns the real `PreToolUse` hook for one allowed
  documentation edit and one blocked fixture, prints the exit codes and DENY stderr, and regenerates
  the committed sample log from a real run.

### Changed

- Scoring guards in the readiness rules: a conflict deduction plus a **conflict gate** (a
  contradiction on a critical claim caps the verdict in the Blocked band) and **per-category caps**
  so one noisy bucket cannot dominate. Demo scores are unchanged (44/100 and 80/100).
- `evaluateReadiness` now takes a `DemoBundle` directly (removed an unused graph-input overload that
  silently dropped findings) and counts engine-derived statuses; demo scores stay 44/80/49.
- Removed the unreferenced, divergent `site/styles.css`; the page ships a single inline stylesheet.
- README and scaffold docs now make the zero-install demo, scaffold counts, runtime gate, and
  fail-closed gate trade-off explicit in both English and Ukrainian.

### Fixed

- Post-review polish (from an adversarial multi-agent review of the session): SARIF result URIs now
  use each bundle's own example directory (was hardcoded to `demo-uav-readiness`); demo-video links
  point at the current release tag; the site readiness bands match `docs/scoring.en.md`; agent #7's
  name is consistent ("Documentation & Portfolio"); added `og:image`/`twitter:card` social-preview
  tags + `site/social-card.png`; removed orphaned screenshot assets.
- Site polish: release-asset URLs point at `v0.6.0-demo-video`, the missing `--accent-soft` token is
  defined, contrast is improved, the favicon/theme color are set, video cards keep a 16:9 ratio, and
  the on-screen formula shows zero-valued conflict and missing-artifact terms.
- Documentation drift fixes: runtime-gate notes now describe the enforced hook, scoring docs distinguish
  the 44/100 original bundle from the 49/100 conflict bundle, English docs link English twins, SARIF is
  listed in architecture outputs, and demo-data policy labels are present on all example bundles.
- Root `.gitignore` ignores only the local `/.claude/` directory while keeping the published scaffold
  under `meta/ai-workflows/.claude/` tracked.

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

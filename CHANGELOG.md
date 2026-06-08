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

### Notes

- All demo data is synthetic and static. The project stays strictly within documentation QA,
  evidence, traceability, and readiness reporting — no operational UAV capability.

## Demo video releases

- `v0.4.0-demo-video` — polished Ukrainian demo video and voiceover.
- `v0.3.0-demo-video` — Ukrainian demo release.
- `v0.2.0-demo-video` — English demo release.

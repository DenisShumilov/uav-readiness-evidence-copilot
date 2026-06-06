# Repo Cleanup Notes

This sprint intentionally kept cleanup lightweight and avoided large refactors.

## Completed

- Active parsed inputs are now separated from planned future fixtures.
- `wiring_notes.yaml` and `config_dump.txt` moved under `examples/demo-uav-readiness/future-fixtures/`.
- Package README files now describe the current MVP state instead of old placeholder phases.

## Optional Future Cleanup

These areas can be reviewed later, but were intentionally not moved in this sprint:

- `.claude/` project agent and skill files;
- `demo-video/` generated-video pipeline files;
- test layout;
- portfolio/interview docs under `docs/portfolio/`;
- older generated local outputs ignored by Git.

Keep future cleanup documentation-only unless there is a clear reason to change code.

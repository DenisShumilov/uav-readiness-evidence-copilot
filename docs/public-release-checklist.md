# Public release checklist

Use this before sharing the GitHub repository link.

## Repository state

- [ ] `git status` is clean.
- [ ] Latest work is committed.
- [ ] Remote URL points to the intended GitHub repository.
- [ ] Default branch is `main`.

## Safety and privacy

- [ ] Demo data is synthetic only.
- [ ] Demo input artifacts contain no unsafe operational content.
- [ ] Prohibited UAV terms appear only as safety boundaries, tests, or blocked examples.
- [ ] No private file paths are present in README, docs, or tracked source files.
- [ ] No secrets, API keys, tokens, passwords, or private keys are committed.
- [ ] `.env` files are ignored.
- [ ] `.env.example` contains no real secrets.

## Documentation

- [ ] README has a clear one-liner.
- [ ] README has a screenshot.
- [ ] README has quick start commands.
- [ ] README explains safety boundaries.
- [ ] README lists input and output files.
- [ ] README links to the interview cheat sheet.
- [ ] `docs/demo-script.md` is ready for a short demo video.
- [ ] `docs/interview-cheat-sheet.md` is ready for interview prep.

## Verification

Run:

```powershell
npm run demo:readiness
npm run typecheck
npm test
npm audit --audit-level=moderate
```

Expected:

- demo command succeeds;
- typecheck succeeds;
- tests pass;
- audit finds no moderate-or-higher vulnerabilities.

## GitHub push commands

Use your real GitHub repository URL:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/uav-readiness-evidence-copilot.git
git branch -M main
git push -u origin main
```

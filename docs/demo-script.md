# 2-minute demo script

Goal: show the repository in a way a recruiter understands quickly.

## 0:00-0:20 - Project intro

Show the GitHub README.

Say:

> This is UAV Readiness & Evidence Copilot. It is a safe documentation QA tool. It checks whether engineering claims have proof and keeps missing proof locked.

Simple meaning: the tool is like a paperwork inspector, not a drone controller.

## 0:20-0:45 - Show the input files

Show:

- `examples/demo-uav-readiness/BOM.csv`
- `examples/demo-uav-readiness/demo_manual.md`
- `examples/demo-uav-readiness/test_log.csv`
- `examples/demo-uav-readiness/qa_notes.md`

Say:

> These files are synthetic, meaning fake and made only for learning. They imitate safe engineering documentation, QA notes, and review logs.

## 0:45-1:05 - Run the demo command

Show terminal:

```powershell
npm run demo:readiness
```

Say:

> One command reads the demo files, checks evidence, calculates a documentation readiness score, and writes output files.

CLI means command-line interface, or running the project by typing a command.

## 1:05-1:35 - Show the portfolio page

Open:

```text
examples/demo-uav-readiness/output/portfolio-demo.html
```

Say:

> This is the 30-second demo page. It shows the score, verified evidence, partial evidence, locked items, warnings, and generated files.

Locked means the project refuses to pretend something is true when proof is missing.

## Optional - make a README screenshot

First generate the HTML page:

```powershell
npm run demo:readiness
```

Then open:

```text
examples/demo-uav-readiness/output/portfolio-demo.html
```

Manual screenshot steps:

1. Open the HTML file in a browser.
2. Make the browser window wide enough to show the score and cards.
3. Take a screenshot.
4. Save it as:

```text
docs/assets/demo-screenshot.png
```

Automatic screenshot command on Windows with Microsoft Edge:

```powershell
$html = (Resolve-Path -LiteralPath 'examples\demo-uav-readiness\output\portfolio-demo.html').Path
$png = Join-Path (Resolve-Path -LiteralPath 'docs\assets').Path 'demo-screenshot.png'
$url = [System.Uri]::new($html).AbsoluteUri
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' --headless --disable-gpu --hide-scrollbars --window-size=1440,1100 --screenshot="$png" $url
```

Headless means the browser runs without showing a normal window.

## 1:35-1:55 - Show traceability and hashes

Show:

- `traceability-matrix.csv`
- `artifact-hashes.json`

Say:

> The traceability matrix links requirement to evidence to check. The hashes are digital fingerprints that help prove which files were reviewed.

## 1:55-2:00 - Close

Say:

> The value is simple: this project shows safe AI-assisted engineering QA, evidence tracking, and portfolio-ready documentation without operational UAV capability.

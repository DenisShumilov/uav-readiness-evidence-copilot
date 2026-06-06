import type { DemoBundle } from "../../core/src/schemas";
import type { BuiltEvidenceGraph } from "../../evidence/src/evidenceGraph";
import type { ReadinessAssessment } from "../../rules/src/readiness";
import { buildTraceabilityRows } from "./traceabilityMatrix";

export function generatePortfolioDemoMarkdown(
  bundle: DemoBundle,
  graph: BuiltEvidenceGraph,
  assessment: ReadinessAssessment,
  outputFiles: string[]
): string {
  const lines = [
    "# UAV Readiness & Evidence Copilot",
    "",
    "Portfolio demo: synthetic documentation readiness review for safe engineering QA.",
    "",
    "This demo shows how the project reads safe example files, checks evidence, keeps missing proof locked, and writes a recruiter-friendly summary.",
    "",
    "## Readiness Score",
    "",
    `**${assessment.readinessScore}/100**`,
    "",
    "## Evidence Status",
    "",
    `- Verified: ${graph.summary.verifiedCount}`,
    `- Partial: ${graph.summary.partialCount}`,
    `- Locked: ${graph.summary.lockedCount}`,
    "",
    "## Warnings",
    "",
    ...formatList(assessment.warnings),
    "",
    "## Locked Items",
    "",
    ...formatList(
      assessment.lockedCriticalItems.map((item) => `${item.id}: ${item.reason}`)
    ),
    "",
    "## Output Files",
    "",
    ...outputFiles.map((file) => `- [${file}](${file})`),
    "",
    "## What This Shows Employers",
    "",
    "- Safe AI-assisted engineering workflow design.",
    "- Evidence-first thinking: missing proof stays locked.",
    "- Practical TypeScript modules, tests, CLI output, and clear documentation.",
    "- Portfolio-ready delivery that can be understood in 30 seconds.",
    "",
    "## Safety Note",
    "",
    "This is a synthetic documentation demo only. It does not connect to live systems or operate real equipment.",
    ""
  ];

  return `${lines.join("\n")}`;
}

export function generatePortfolioDemoHtml(
  bundle: DemoBundle,
  graph: BuiltEvidenceGraph,
  assessment: ReadinessAssessment,
  outputFiles: string[]
): string {
  const score = assessment.readinessScore;
  const lockedItems = assessment.lockedCriticalItems;
  const traceabilityRows = buildTraceabilityRows(bundle, assessment).slice(0, 5);
  const warnings = assessment.warnings.slice(0, 6);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UAV Readiness & Evidence Copilot</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --ink: #1c2430;
      --muted: #5f6b7a;
      --line: #d9dee6;
      --verified: #1d7f58;
      --partial: #b26900;
      --locked: #b3261e;
      --accent: #2357d6;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.45;
    }

    main {
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 220px;
      gap: 24px;
      align-items: stretch;
      border-bottom: 1px solid var(--line);
      padding-bottom: 24px;
      margin-bottom: 24px;
    }

    h1 {
      margin: 0 0 10px;
      font-size: 34px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    h2 {
      margin: 0 0 12px;
      font-size: 18px;
      letter-spacing: 0;
    }

    p {
      margin: 0;
      color: var(--muted);
    }

    .score {
      display: grid;
      place-items: center;
      min-height: 180px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }

    .score strong {
      display: block;
      font-size: 48px;
      line-height: 1;
    }

    .score span {
      color: var(--muted);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }

    .metric {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid var(--line);
      padding: 10px 0;
    }

    .metric:last-child {
      border-bottom: 0;
    }

    .metric b {
      font-size: 20px;
    }

    .verified {
      color: var(--verified);
    }

    .partial {
      color: var(--partial);
    }

    .locked {
      color: var(--locked);
    }

    ul {
      margin: 0;
      padding-left: 20px;
    }

    li {
      margin: 6px 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    th,
    td {
      border-bottom: 1px solid var(--line);
      padding: 10px 8px;
      text-align: left;
      vertical-align: top;
    }

    th {
      color: var(--muted);
      font-weight: 700;
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    .wide {
      grid-column: 1 / -1;
    }

    .note {
      margin-top: 16px;
      border-left: 4px solid var(--accent);
    }

    @media (max-width: 760px) {
      .hero,
      .grid {
        grid-template-columns: 1fr;
      }

      h1 {
        font-size: 28px;
      }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div>
        <h1>UAV Readiness & Evidence Copilot</h1>
        <p>Evidence-first documentation readiness demo for safe engineering QA. It checks synthetic files, connects proof to claims, and keeps missing proof locked.</p>
      </div>
      <div class="score" aria-label="Readiness score ${score} out of 100">
        <div>
          <strong>${score}</strong>
          <span>readiness score</span>
        </div>
      </div>
    </section>

    <section class="grid" aria-label="Evidence summary">
      <div class="panel">
        <h2>Evidence Status</h2>
        <div class="metric"><span>Verified</span><b class="verified">${graph.summary.verifiedCount}</b></div>
        <div class="metric"><span>Partial</span><b class="partial">${graph.summary.partialCount}</b></div>
        <div class="metric"><span>Locked</span><b class="locked">${graph.summary.lockedCount}</b></div>
      </div>

      <div class="panel">
        <h2>What Employers See</h2>
        <ul>
          <li>Safe AI-assisted engineering workflow.</li>
          <li>No evidence means locked.</li>
          <li>Clear TypeScript CLI with tests.</li>
        </ul>
      </div>

      <div class="panel">
        <h2>Output Files</h2>
        <ul>
          ${outputFiles.map((file) => `<li><a href="${escapeAttribute(file)}">${escapeHtml(file)}</a></li>`).join("\n          ")}
        </ul>
      </div>

      <div class="panel">
        <h2>Warnings</h2>
        <ul>
          ${formatHtmlList(warnings)}
        </ul>
      </div>

      <div class="panel">
        <h2>Locked Items</h2>
        <ul>
          ${formatHtmlList(lockedItems.map((item) => `${item.id}: ${item.reason}`))}
        </ul>
      </div>

      <div class="panel">
        <h2>Artifact Summary</h2>
        <ul>
          ${bundle.artifacts.map((artifact) => `<li>${escapeHtml(artifact.filename)} - ${escapeHtml(artifact.kind)}</li>`).join("\n          ")}
        </ul>
      </div>

      <div class="panel wide">
        <h2>Traceability Preview</h2>
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Evidence</th>
              <th>Check</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${traceabilityRows
              .map(
                (row) => `<tr>
              <td>${escapeHtml(row.requirement)}</td>
              <td>${escapeHtml(row.evidence)}</td>
              <td>${escapeHtml(row.check)}</td>
              <td class="${escapeAttribute(row.status)}">${escapeHtml(row.status)}</td>
            </tr>`
              )
              .join("\n            ")}
          </tbody>
        </table>
      </div>

      <div class="panel wide note">
        <h2>Safety Boundary</h2>
        <p>This static demo is for synthetic documentation review only. It does not connect to live systems or operate real equipment.</p>
      </div>
    </section>
  </main>
</body>
</html>
`;
}

function formatList(items: string[]): string[] {
  if (items.length === 0) {
    return ["- None"];
  }

  return items.map((item) => `- ${item}`);
}

function formatHtmlList(items: string[]): string {
  if (items.length === 0) {
    return "<li>None</li>";
  }

  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n          ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll(" ", "%20");
}

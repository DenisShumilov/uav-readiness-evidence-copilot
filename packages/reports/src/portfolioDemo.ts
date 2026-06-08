import type { DemoBundle } from "../../core/src/schemas";
import type { BuiltEvidenceGraph } from "../../evidence/src/evidenceGraph";
import type { ReadinessAssessment } from "../../rules/src/readiness";
import { buildTraceabilityRows } from "./traceabilityMatrix";

export type PortfolioDemoLanguage = "en" | "uk";

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
  outputFiles: string[],
  language: PortfolioDemoLanguage = "en"
): string {
  const score = assessment.readinessScore;
  const lockedItems = assessment.lockedCriticalItems;
  const traceabilityRows = buildTraceabilityRows(bundle, assessment).slice(0, 5);
  const warnings = assessment.warnings.slice(0, 6);
  const text = getPortfolioText(language);
  const displayWarnings = warnings.map((warning) =>
    localizeDisplayIssue(warning, language)
  );
  const displayLockedItems = lockedItems.map(
    (item) => localizeLockedItem(item.id, item.reason, language)
  );
  const displayTraceabilityRows = traceabilityRows.map((row) => ({
    requirement: localizeDisplayText(row.requirement, language),
    evidence: localizeDisplayText(row.evidence, language),
    check: localizeDisplayText(row.check, language),
    status: row.status,
    statusLabel: localizeStatus(row.status, language)
  }));

  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UAV Readiness & Evidence Copilot</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f6f8;
      --panel: #ffffff;
      --ink: #18212f;
      --muted: #5f6b7a;
      --line: #d9dee6;
      --verified: #1d7f58;
      --partial: #b26900;
      --locked: #b3261e;
      --accent: #2556c7;
      --accent-soft: #e9eefc;
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
      padding: 28px 20px 48px;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 240px;
      gap: 24px;
      align-items: stretch;
      border-bottom: 1px solid var(--line);
      padding: 18px 0 24px;
      margin-bottom: 24px;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 42px;
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

    .eyebrow {
      margin-bottom: 10px;
      color: var(--accent);
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .one-liner {
      color: var(--ink);
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .score {
      display: grid;
      place-items: center;
      min-height: 200px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }

    .score strong {
      display: block;
      font-size: 56px;
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

    .panel.soft {
      background: var(--accent-soft);
      border-color: #c8d4f7;
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

    .flow {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 8px;
    }

    .flow span {
      display: grid;
      min-height: 64px;
      align-items: center;
      justify-items: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #ffffff;
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
      text-align: center;
      padding: 8px;
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

    .boundary {
      border-left-color: var(--locked);
    }

    .language-link {
      margin-top: 18px;
      color: var(--muted);
      font-size: 14px;
    }

    @media (max-width: 760px) {
      .hero,
      .grid,
      .flow {
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
        <div class="eyebrow">${escapeHtml(text.eyebrow)}</div>
        <h1>UAV Readiness & Evidence Copilot</h1>
        <p class="one-liner">${escapeHtml(text.oneLiner)}</p>
        <p>${escapeHtml(text.heroBody)}</p>
        <p class="language-link">${text.languageLink}</p>
      </div>
      <div class="score" aria-label="${escapeHtml(text.scoreAria.replace("{score}", String(score)))}">
        <div>
          <strong>${score}</strong>
          <span>${escapeHtml(text.scoreLabel)}</span>
        </div>
      </div>
    </section>

    <section class="grid" aria-label="${escapeHtml(text.evidenceSummaryAria)}">
      <div class="panel">
        <h2>${escapeHtml(text.evidenceCounters)}</h2>
        <div class="metric"><span>${escapeHtml(text.verified)}</span><b class="verified">${graph.summary.verifiedCount}</b></div>
        <div class="metric"><span>${escapeHtml(text.partial)}</span><b class="partial">${graph.summary.partialCount}</b></div>
        <div class="metric"><span>${escapeHtml(text.locked)}</span><b class="locked">${graph.summary.lockedCount}</b></div>
      </div>

      <div class="panel soft">
        <h2>${escapeHtml(text.beforeTitle)}</h2>
        <ul>
          ${formatHtmlList(text.beforeItems, text.noneLabel)}
        </ul>
      </div>

      <div class="panel soft">
        <h2>${escapeHtml(text.afterTitle)}</h2>
        <ul>
          ${formatHtmlList(text.afterItems, text.noneLabel)}
        </ul>
      </div>

      <div class="panel">
        <h2>${escapeHtml(text.warningsTitle)}</h2>
        <ul>
          ${formatHtmlList(displayWarnings, text.noneLabel)}
        </ul>
      </div>

      <div class="panel">
        <h2>${escapeHtml(text.lockedStepsTitle)}</h2>
        <ul>
          ${formatHtmlList(displayLockedItems, text.noneLabel)}
        </ul>
      </div>

      <div class="panel">
        <h2>${escapeHtml(text.generatedOutputsTitle)}</h2>
        <ul>
          ${outputFiles.map((file) => `<li><a href="${escapeAttribute(file)}">${escapeHtml(file)}</a></li>`).join("\n          ")}
        </ul>
      </div>

      <div class="panel wide">
        <h2>${escapeHtml(text.demonstratesTitle)}</h2>
        <ul>
          ${formatHtmlList(text.demonstratesItems, text.noneLabel)}
        </ul>
      </div>

      <div class="panel wide">
        <h2>${escapeHtml(text.pipelineTitle)}</h2>
        <div class="flow" aria-label="${escapeHtml(text.pipelineAria)}">
          ${text.pipelineItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("\n          ")}
        </div>
      </div>

      <div class="panel wide">
        <h2>${escapeHtml(text.simpleTitle)}</h2>
        <ul>
          ${formatHtmlList(text.simpleItems, text.noneLabel)}
        </ul>
      </div>

      <div class="panel wide">
        <h2>${escapeHtml(text.artifactSummaryTitle)}</h2>
        <ul>
          ${bundle.artifacts.map((artifact) => `<li>${escapeHtml(artifact.filename)} - ${escapeHtml(localizeArtifactKind(artifact.kind, language))}</li>`).join("\n          ")}
        </ul>
      </div>

      <div class="panel wide">
        <h2>${escapeHtml(text.traceabilityTitle)}</h2>
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(text.requirement)}</th>
              <th>${escapeHtml(text.evidence)}</th>
              <th>${escapeHtml(text.check)}</th>
              <th>${escapeHtml(text.status)}</th>
            </tr>
          </thead>
          <tbody>
            ${displayTraceabilityRows
              .map(
                (row) => `<tr>
              <td>${escapeHtml(row.requirement)}</td>
              <td>${escapeHtml(row.evidence)}</td>
              <td>${escapeHtml(row.check)}</td>
              <td class="${escapeAttribute(row.status)}">${escapeHtml(row.statusLabel)}</td>
            </tr>`
              )
              .join("\n            ")}
          </tbody>
        </table>
      </div>

      <div class="panel wide note boundary">
        <h2>${escapeHtml(text.safetyTitle)}</h2>
        <p>${escapeHtml(text.safetyRule)}</p>
        <p>${escapeHtml(text.safetyBody)}</p>
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

function formatHtmlList(items: string[], emptyLabel = "None"): string {
  if (items.length === 0) {
    return `<li>${escapeHtml(emptyLabel)}</li>`;
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

function localizeDisplayText(value: string, language: PortfolioDemoLanguage): string {
  if (language !== "uk") {
    return value;
  }

  return value
    .replaceAll("Connector note review", "Перевірка нотатки про роз'єм")
    .replaceAll("Config owner assigned", "Власника конфігурації призначено")
    .replaceAll("Traceability warning", "Попередження простежуваності")
    .replaceAll("partial evidence", "частковий доказ")
    .replaceAll(
      "Board record needs a supporting source before review",
      "Запис про плату потребує джерела доказу перед рецензуванням"
    )
    .replaceAll(
      "Manual evidence row has no supporting evidence id",
      "Рядок доказу в інструкції не має ідентифікатора джерела"
    )
    .replaceAll(
      "Owner field is missing in synthetic config",
      "У навчальній конфігурації бракує поля власника"
    )
    .replaceAll(
      "Second connector label source is missing",
      "Бракує джерела для другої позначки роз'єму"
    )
    .replaceAll(
      "Config owner field is missing",
      "Бракує поля власника конфігурації"
    )
    .replaceAll(
      "Training frame plate appears in the synthetic BOM",
      "Навчальна пластина рами є у навчальному списку деталей"
    )
    .replaceAll(
      "Training bench cable appears in the synthetic BOM",
      "Навчальний стендовий кабель є у навчальному списку деталей"
    )
    .replaceAll(
      "Training compute board requires supporting evidence",
      "Навчальна обчислювальна плата потребує підтвердного доказу"
    )
    .replaceAll(
      "Training safety label set appears in the synthetic BOM",
      "Навчальний набір позначок безпеки є у навчальному списку деталей"
    )
    .replaceAll("Synthetic manual exists", "Навчальна інструкція існує")
    .replaceAll("documentation review", "перевірка документації")
    .replaceAll("missing", "немає");
}

function localizeDisplayIssue(value: string, language: PortfolioDemoLanguage): string {
  if (language !== "uk") {
    return value;
  }

  const labels: Record<string, string> = {
    "finding.test.check-003: Connector note review":
      "Перевірити нотатку про роз'єм.",
    "finding.test.check-004: Config owner assigned":
      "Призначити власника конфігурації.",
    "WARN-TRACE-001: Traceability warning":
      "Попередження щодо простежуваності.",
    "claim.comp-cable-001: partial evidence":
      "Кабель має лише частковий доказ.",
    "claim.manual.connector-note-has-one-source: partial evidence":
      "Нотатка про роз'єм має лише одне джерело доказу.",
    "claim.test.check-003: partial evidence":
      "Перевірка позначки роз'єму має частковий доказ."
  };

  return labels[value] ?? localizeDisplayText(value, language);
}

function localizeLockedItem(
  id: string,
  reason: string,
  language: PortfolioDemoLanguage
): string {
  if (language !== "uk") {
    return `${id}: ${reason}`;
  }

  return localizeDisplayText(reason, language);
}

function localizeStatus(value: string, language: PortfolioDemoLanguage): string {
  if (language !== "uk") {
    return value;
  }

  const labels: Record<string, string> = {
    verified: "підтверджено",
    partial: "частково",
    locked: "заблоковано"
  };

  return labels[value] ?? value;
}

function localizeArtifactKind(value: string, language: PortfolioDemoLanguage): string {
  if (language !== "uk") {
    return value;
  }

  const labels: Record<string, string> = {
    bom: "список деталей",
    manual: "інструкція",
    test_log: "журнал перевірок",
    qa_notes: "нотатки якості"
  };

  return labels[value] ?? value;
}

function getPortfolioText(language: PortfolioDemoLanguage) {
  if (language === "uk") {
    return {
      eyebrow: "Демо для портфоліо",
      oneLiner: "Інструмент із підтримкою ШІ для перевірки інженерної документації БпЛА.",
      heroBody:
        "Перетворює навчальні документи на зрозумілий пакет перевірки готовності: докази, заблоковані пункти, матрицю простежуваності, цифрові відбитки файлів і звіти.",
      languageLink:
        '<a href="portfolio-demo.en.html">Англійська версія</a> | Українська версія',
      scoreLabel: "оцінка готовності документації",
      scoreAria: "Оцінка готовності документації {score} зі 100",
      evidenceSummaryAria: "Підсумок доказів",
      pipelineAria: "Технічний шлях обробки",
      noneLabel: "Немає",
      evidenceCounters: "Лічильники доказів",
      verified: "Підтверджено",
      partial: "Частково",
      locked: "Заблоковано",
      beforeTitle: "До",
      beforeItems: [
        "Багато розкиданих файлів.",
        "Нотатки й журнали в різних місцях.",
        "Незрозуміло, де доказ."
      ],
      afterTitle: "Після",
      afterItems: [
        "Пакет перевірки готовності.",
        "Карта доказів і заблоковані пункти.",
        "Зрозумілі результати для перегляду."
      ],
      warningsTitle: "Попередження",
      lockedStepsTitle: "Заблоковані пункти",
      generatedOutputsTitle: "Згенеровані результати",
      demonstratesTitle: "Що це показує",
      demonstratesItems: [
        "Допомогу ШІ для інженерної перевірки.",
        "Відстеження доказів.",
        "Автоматизацію перевірки якості.",
        "Простежуваність від вимоги до доказу.",
        "Звітність про готовність документації.",
        "Безпечну перевірку документації за участі людини."
      ],
      pipelineTitle: "Технічний шлях",
      pipelineItems: [
        "вхідні файли",
        "читачі файлів",
        "карта доказів",
        "правила перевірки",
        "звіт про готовність",
        "демо-сторінка"
      ],
      simpleTitle: "Простими словами",
      simpleItems: [
        "Оцінка готовності показує стан документації, а не дозвіл на роботу реальної системи.",
        "Доказ — це підтвердження з файлу, таблиці, нотатки або журналу.",
        "Заблоковано означає: доказу немає, тому висновок не підтверджується.",
        "Демо показує, як розкидані файли стають зрозумілим пакетом перевірки.",
        "Це корисно командам, які готують інженерну документацію до перевірки."
      ],
      artifactSummaryTitle: "Підсумок файлів",
      traceabilityTitle: "Попередній перегляд матриці простежуваності",
      requirement: "Вимога",
      evidence: "Доказ",
      check: "Перевірка",
      status: "Статус",
      safetyTitle: "Межі безпеки",
      safetyRule:
        "Немає планування завдань. Немає роботи з корисним навантаженням. Жодного керування реальним дроном.",
      safetyBody:
        "Це демо-сторінка тільки для перевірки навчальної документації. Вона не підключається до живих систем і не працює з реальним обладнанням."
    };
  }

  return {
    eyebrow: "Portfolio demo",
    oneLiner: "AI-assisted QA workspace for UAV engineering artifacts.",
    heroBody:
      "Turns messy synthetic documents into a clear readiness package: evidence status, locked steps, traceability, hashes, and reports.",
    languageLink:
      'English version | <a href="portfolio-demo.uk.html">Українська версія</a>',
    scoreLabel: "readiness score",
    scoreAria: "Readiness score {score} out of 100",
    evidenceSummaryAria: "Evidence summary",
    pipelineAria: "Technical pipeline",
    noneLabel: "None",
    evidenceCounters: "Evidence Counters",
    verified: "Verified",
    partial: "Partial",
    locked: "Locked",
    beforeTitle: "Before",
    beforeItems: [
      "Messy artifacts.",
      "Scattered notes and logs.",
      "Unclear proof status."
    ],
    afterTitle: "After",
    afterItems: [
      "Readiness package.",
      "Evidence graph and locks.",
      "Clear review outputs."
    ],
    warningsTitle: "Warnings",
    lockedStepsTitle: "Locked Steps",
    generatedOutputsTitle: "Generated Outputs",
    demonstratesTitle: "What This Demonstrates",
    demonstratesItems: [
      "AI-assisted engineering workflow.",
      "Evidence tracking.",
      "QA automation.",
      "Traceability.",
      "Readiness reporting.",
      "Safe human-reviewed engineering documentation QA."
    ],
    pipelineTitle: "Technical Pipeline",
    pipelineItems: [
      "input artifacts",
      "parsers",
      "evidence graph",
      "rules engine",
      "readiness report",
      "portfolio demo"
    ],
    simpleTitle: "Plain-English Meaning",
    simpleItems: [
      "Readiness score means documentation readiness, not real-world approval.",
      "Evidence means proof from a file, table, note, or log.",
      "Locked means the tool refuses to verify a claim when proof is missing.",
      "The demo shows how messy files become a readable review package.",
      "This helps engineering documentation teams with QA, handoff, and evidence review."
    ],
    artifactSummaryTitle: "Artifact Summary",
    traceabilityTitle: "Traceability Preview",
    requirement: "Requirement",
    evidence: "Evidence",
    check: "Check",
    status: "Status",
    safetyTitle: "Safety Boundary",
    safetyRule: "No mission planning. No payload. No live drone control.",
    safetyBody:
      "This static demo is for synthetic documentation review only. It does not connect to live systems or operate real equipment."
  };
}

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is missing. Run: npm install -D playwright && npx playwright install chromium");
  process.exit(1);
}

const root = process.cwd();
const width = 1920;
const height = 1080;
const fps = 30;
const durationSeconds = 70;
const frameRoot = join(root, "demo-video", "frames");
mkdirSync(frameRoot, { recursive: true });

const languages = [
  { code: "en", file: "portfolio-demo.en.html" },
  { code: "uk", file: "portfolio-demo.uk.html" }
];

const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: false
});

function makeKeyframes(maxScroll) {
  const clamp = (value) => Math.max(0, Math.min(Math.round(value), maxScroll));

  return [
    { time: 0, scrollY: clamp(0), label: "hero" },
    { time: 8, scrollY: clamp(0), label: "problem" },
    { time: 18, scrollY: clamp(0), label: "start score" },
    { time: 22, scrollY: clamp(220), label: "readiness score and counters" },
    { time: 30, scrollY: clamp(220), label: "hold score" },
    { time: 34, scrollY: clamp(520), label: "locked items and warnings" },
    { time: 45, scrollY: clamp(520), label: "hold locked items" },
    { time: 49, scrollY: clamp(880), label: "generated outputs" },
    { time: 58, scrollY: clamp(880), label: "hold outputs" },
    { time: 62, scrollY: clamp(maxScroll), label: "safety boundary" },
    { time: durationSeconds, scrollY: clamp(maxScroll), label: "final safety frame" }
  ];
}

for (const language of languages) {
  const outputDir = join(frameRoot, language.code);
  mkdirSync(outputDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    colorScheme: "light"
  });
  const page = await context.newPage();
  const file = join(root, "examples", "demo-uav-readiness", "output", language.file);
  if (!existsSync(file)) {
    console.error(`Missing demo page: ${file}`);
    console.error("Run npm run demo:readiness first.");
    process.exitCode = 1;
    await context.close();
    continue;
  }

  await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts?.ready);
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
      body { cursor: none !important; }
    `
  });

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    maxScroll: Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  }));

  const fullPagePath = join(outputDir, "full-page.png");
  await page.screenshot({
    path: fullPagePath,
    fullPage: true,
    animations: "disabled"
  });

  const keyframes = makeKeyframes(metrics.maxScroll);

  writeFileSync(
    join(outputDir, "manifest.json"),
    JSON.stringify(
      {
        language: language.code,
        width,
        height,
        fps,
        durationSeconds,
        scrollWidth: metrics.scrollWidth,
        scrollHeight: metrics.scrollHeight,
        maxScroll: metrics.maxScroll,
        fullPageFile: relative(root, fullPagePath).replaceAll("\\", "/"),
        qualityTarget:
          "1920x1080, 30fps, smooth vertical pan, no browser chrome, no cursor, static portfolio pages only",
        timeline: [
          "0-8s hero and title",
          "8-18s problem context",
          "18-30s readiness score and counters",
          "30-45s locked items and warnings",
          "45-58s generated outputs",
          "58-70s safety boundary and final phrase"
        ],
        keyframes
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Captured full-page ${language.code}: ${fullPagePath}`);
  console.log(`Max scroll ${language.code}: ${metrics.maxScroll}px`);

  await context.close();
}

await browser.close();

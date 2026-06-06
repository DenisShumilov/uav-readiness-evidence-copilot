import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
const frameRoot = join(root, "demo-video", "frames");
mkdirSync(frameRoot, { recursive: true });

const languages = [
  { code: "en", file: "portfolio-demo.en.html" },
  { code: "uk", file: "portfolio-demo.uk.html" }
];

const scenes = [
  { id: "01-hero", title: "Hero and project title", scrollY: 0, duration: 8.5 },
  { id: "02-score", title: "Readiness score", scrollY: 0, duration: 10.5 },
  { id: "03-evidence", title: "Evidence counters", scrollY: 260, duration: 12.5 },
  { id: "04-locked", title: "Locked steps and warnings", scrollY: 540, duration: 12.5 },
  { id: "05-outputs", title: "Outputs and traceability", scrollY: 960, duration: 12.5 },
  { id: "06-safety", title: "Safety boundary and portfolio value", scrollY: 1500, duration: 11.5 }
];

const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: false
});

for (const language of languages) {
  const outputDir = join(frameRoot, language.code);
  mkdirSync(outputDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
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
      body { cursor: default !important; }
    `
  });

  const captured = [];
  for (const scene of scenes) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), scene.scrollY);
    await page.waitForTimeout(300);
    const path = join(outputDir, `${scene.id}.png`);
    await page.screenshot({ path, fullPage: false, animations: "disabled" });
    captured.push({ ...scene, file: path.replaceAll("\\", "/") });
    console.log(`Captured ${language.code}: ${scene.id}`);
  }

  writeFileSync(
    join(outputDir, "manifest.json"),
    JSON.stringify(
      {
        language: language.code,
        width,
        height,
        fps: 30,
        transitionSeconds: 0.6,
        targetDurationSeconds: 65,
        qualityTarget: "1920x1080, 30fps, no browser chrome, no cursor jitter, static portfolio pages only",
        scenes: captured
      },
      null,
      2
    ),
    "utf8"
  );

  await context.close();
}

await browser.close();

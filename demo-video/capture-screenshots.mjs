import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("Playwright is missing. Automated screenshots were not captured.");
  console.log("Install only if you want automated browser capture:");
  console.log("npm install -D playwright");
  console.log("npx playwright install chromium");
  process.exit(0);
}

const root = process.cwd();
const outputDir = join(root, "demo-video", "output", "screenshots");
mkdirSync(outputDir, { recursive: true });

const pages = [
  {
    name: "en",
    file: join(root, "examples", "demo-uav-readiness", "output", "portfolio-demo.en.html")
  },
  {
    name: "uk",
    file: join(root, "examples", "demo-uav-readiness", "output", "portfolio-demo.uk.html")
  }
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

for (const item of pages) {
  await page.goto(pathToFileURL(item.file).href);
  await page.screenshot({
    path: join(outputDir, `portfolio-demo.${item.name}.png`),
    fullPage: true
  });
  console.log(`Captured screenshot for ${item.name}`);
}

await browser.close();

// Regenerates the README/social visual assets from the real site source.
// Usage: node demo-video/capture-readme-assets.mjs
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sitePage = pathToFileURL(path.join(root, "site", "index.html")).href;
const cardPage = pathToFileURL(path.join(root, "demo-video", "social-card.html")).href;

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  // let reveal animations and the gauge finish
  await page.waitForTimeout(2200);
}

async function shoot(browser, { url, viewport, scale, out, fullPage = false }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  await page.goto(url, { waitUntil: "networkidle" });
  await settle(page);
  for (const file of out) {
    await page.screenshot({ path: path.join(root, file), fullPage });
    console.log("captured", file);
  }
  await page.close();
}

const browser = await chromium.launch();
try {
  await shoot(browser, {
    url: cardPage,
    viewport: { width: 1280, height: 640 },
    scale: 1,
    out: ["site/social-card.png", "docs/assets/social-card.png"],
  });
  await shoot(browser, {
    url: `${sitePage}?lang=en`,
    viewport: { width: 1380, height: 860 },
    scale: 2,
    out: ["docs/assets/hero-dashboard.png"],
  });
  await shoot(browser, {
    url: `${sitePage}?lang=uk`,
    viewport: { width: 1380, height: 860 },
    scale: 2,
    out: ["docs/assets/hero-dashboard.uk.png"],
  });
} finally {
  await browser.close();
}

for (const f of [
  "site/social-card.png",
  "docs/assets/social-card.png",
  "docs/assets/hero-dashboard.png",
  "docs/assets/hero-dashboard.uk.png",
]) {
  const kb = Math.round(fs.statSync(path.join(root, f)).size / 1024);
  console.log(`${f}: ${kb} KB`);
}

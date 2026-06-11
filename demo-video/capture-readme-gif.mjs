// Records the evidence-toggle interaction as docs/assets/demo-evidence-toggle.gif.
// Usage: node demo-video/capture-readme-gif.mjs   (requires ffmpeg in PATH)
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = pathToFileURL(path.join(root, "site", "index.html")).href + "?lang=en";
const tmpDir = path.join(root, "demo-video", "output", "gif-tmp");
fs.mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(siteUrl, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);

// frame the interactive dashboard: sources + claims + gauge
await page.locator("#sourceList").scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -90));
await page.waitForTimeout(1800);

const toggle = (id) => page.locator(`#sourceList .switch[aria-label="${id}"]`).click();

await toggle("EV-BOM-001"); // 4 claims lose their source -> locked, score dives
await page.waitForTimeout(2000);
await toggle("EV-MAN-001"); // 3 more claims -> locked
await page.waitForTimeout(2200);
await page.locator("#resetBtn").click(); // back to the strict 44/100 baseline
await page.waitForTimeout(2000);

await page.close();
await ctx.close();
await browser.close();

const webm = fs.readdirSync(tmpDir).find((f) => f.endsWith(".webm"));
if (!webm) throw new Error("no webm produced");
const webmPath = path.join(tmpDir, webm);
const gifPath = path.join(root, "docs", "assets", "demo-evidence-toggle.gif");
const palette = path.join(tmpDir, "palette.png");

execFileSync("ffmpeg", ["-y", "-i", webmPath, "-vf", "fps=8,scale=840:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff", palette]);
execFileSync("ffmpeg", ["-y", "-i", webmPath, "-i", palette, "-lavfi", "fps=8,scale=840:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5", gifPath]);

const mb = (fs.statSync(gifPath).size / 1024 / 1024).toFixed(2);
console.log(`docs/assets/demo-evidence-toggle.gif: ${mb} MB`);
fs.rmSync(tmpDir, { recursive: true, force: true });

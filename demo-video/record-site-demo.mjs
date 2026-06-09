// Records the LIVE interactive site (site/index.html) with scripted interactions
// (scroll + toggle evidence sources so the readiness score visibly drops), then
// converts each language's webm into a silent MP4 that the existing voiceover +
// merge scripts consume. Per-language duration is scaled to the generated
// voiceover WAV so the final video has no frozen padding.
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright missing. Run: npx playwright install chromium");
  process.exit(1);
}

const root = process.cwd();
const width = 1920;
const height = 1080;
const sitePath = join(root, "site", "index.html");
const siteUrl = pathToFileURL(sitePath).href;
const audioRoot = join(root, "demo-video", "audio");
const rawRoot = join(root, "demo-video", "videos", "raw");
const silentRoot = join(root, "demo-video", "videos", "silent");
mkdirSync(rawRoot, { recursive: true });
mkdirSync(silentRoot, { recursive: true });

function audioDuration(lang) {
  const wav = join(audioRoot, `voiceover.${lang}.wav`);
  if (!existsSync(wav)) return null;
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", wav],
    { encoding: "utf8" }
  );
  return r.status === 0 ? Number(r.stdout.trim()) : null;
}

const languages = ["uk", "en"];
const browser = await chromium.launch({ headless: true, chromiumSandbox: false });

for (const lang of languages) {
  // Target the recording slightly longer than the voiceover so merge -shortest
  // trims to the audio length with no frozen tail. Fall back to 50s.
  const audio = audioDuration(lang) ?? 48;
  const target = audio + 2.5;
  // Base timeline holds (ms) -> scaled so their sum ~= target.
  const base = [
    ["hero", 4800],
    ["proof", 3000],
    ["live", 3800],
    ["toggle1", 4600],
    ["toggle2", 4600],
    ["reset", 2600],
    ["scaffold", 5800],
    ["agentsPan", 2600],
    ["refusal", 5400],
    ["footer", 4200],
  ];
  const baseSum = base.reduce((s, [, ms]) => s + ms, 0);
  const scale = (target * 1000) / baseSum;
  const hold = (key) => Math.round(base.find(([k]) => k === key)[1] * scale);

  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: rawRoot, size: { width, height } },
    colorScheme: "light",
  });
  const page = await context.newPage();
  await page.goto(siteUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
  await page.addStyleTag({
    content: "*{cursor:none !important} ::-webkit-scrollbar{width:0 !important;height:0 !important}",
  });
  await page.click(`.lang button[data-lang="${lang}"]`).catch(() => {});
  await page.evaluate(() => window.scrollTo({ top: 0 }));

  // 1. Hero — gauge settles at 44
  await page.waitForTimeout(hold("hero"));
  // 2. Slow reveal of the proof strip
  await page.evaluate(() => window.scrollTo({ top: 360, behavior: "smooth" }));
  await page.waitForTimeout(hold("proof"));
  // 3. Live dashboard into view
  await page.evaluate(() => document.getElementById("live")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  await page.waitForTimeout(hold("live"));
  // 4. Toggle a source OFF -> score drops, claims lock
  await page.click('.switch[aria-label="EV-BOM-001"]').catch(() => {});
  await page.waitForTimeout(hold("toggle1"));
  // 5. Toggle a second source -> bigger drop
  await page.click('.switch[aria-label="EV-MAN-001"]').catch(() => {});
  await page.waitForTimeout(hold("toggle2"));
  // 6. Reset back to 44
  await page.click("#resetBtn").catch(() => {});
  await page.waitForTimeout(hold("reset"));
  // 7. Scaffold: 10 agents
  await page.evaluate(() => document.getElementById("scaffold")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  await page.waitForTimeout(hold("scaffold"));
  await page.evaluate(() => window.scrollBy({ top: 360, behavior: "smooth" }));
  await page.waitForTimeout(hold("agentsPan"));
  // 8. Safety refusal — BLOCKED stamp
  await page.evaluate(() => document.querySelector(".refusal")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  await page.waitForTimeout(hold("refusal"));
  // 9. Footer / CTA
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  await page.waitForTimeout(hold("footer"));

  const video = page.video();
  await context.close();
  const webm = await video.path();

  const out = join(silentRoot, `uav-readiness-demo.${lang}.silent.mp4`);
  const ff = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i", webm,
      "-vf", `fps=30,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
      "-c:v", "libx264",
      "-crf", "18",
      "-preset", "slow",
      "-movflags", "+faststart",
      out,
    ],
    { encoding: "utf8" }
  );
  if (ff.status !== 0) {
    console.error(ff.stderr);
  } else {
    console.log(`${lang} silent MP4: ${out} (target ${target.toFixed(1)}s, audio ${audio.toFixed(1)}s)`);
  }
}

await browser.close();

// Records the current interactive site (site/index.html) with the Batch 8
// five-beat walkthrough, then converts each language's browser capture into
// the silent MP4 consumed by the existing voiceover and merge scripts.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
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
const liveDemoUrl = "https://denisshumilov.github.io/uav-readiness-evidence-copilot/";
const npxCommand = "npx github:DenisShumilov/uav-readiness-evidence-copilot demo";
const sitePath = join(root, "site", "index.html");
const siteUrl = pathToFileURL(sitePath).href;
const audioRoot = join(root, "demo-video", "audio");
const rawRoot = join(root, "demo-video", "videos", "raw");
const silentRoot = join(root, "demo-video", "videos", "silent");
mkdirSync(rawRoot, { recursive: true });
mkdirSync(silentRoot, { recursive: true });

function ffprobeDuration(path) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
    { encoding: "utf8" }
  );
  return result.status === 0 ? Number(result.stdout.trim()) : null;
}

function freshAudioDuration(language) {
  const wav = join(audioRoot, `voiceover.${language}.wav`);
  const txt = join(root, "demo-video", `voiceover.${language}.txt`);
  if (!existsSync(wav) || !existsSync(txt)) return null;
  if (statSync(wav).mtimeMs < statSync(txt).mtimeMs) return null;
  return ffprobeDuration(wav);
}

function estimatedNarrationDuration(language) {
  const txt = join(root, "demo-video", `voiceover.${language}.txt`);
  if (!existsSync(txt)) return 66;
  const text = readFileSync(txt, "utf8").trim();
  const tokens = text.match(/[\p{L}\p{N}:/.-]+/gu) ?? [];
  const wordsPerMinute = language === "uk" ? 132 : 142;
  return Math.max(60, (tokens.length / wordsPerMinute) * 60 + 4);
}

function targetDuration(language) {
  const narration = freshAudioDuration(language) ?? estimatedNarrationDuration(language);
  return Math.max(64, Math.min(98, narration + 3.5));
}

const baseTimeline = [
  ["hero", 6500],
  ["liveIntro", 5500],
  ["toggleBom", 5500],
  ["toggleManual", 4500],
  ["reset", 3500],
  ["graphIntro", 7000],
  ["graphOff", 6000],
  ["graphOn", 4500],
  ["conflict", 13000],
  ["endCard", 7000]
];
const baseSum = baseTimeline.reduce((sum, [, ms]) => sum + ms, 0);

function makeHold(language) {
  const target = targetDuration(language);
  const scale = (target * 1000) / baseSum;
  return {
    target,
    hold(key) {
      const found = baseTimeline.find(([name]) => name === key);
      if (!found) throw new Error(`Unknown timeline key: ${key}`);
      return Math.round(found[1] * scale);
    }
  };
}

async function waitForSiteReady(page) {
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
  await page.waitForFunction(
    () => typeof window.update === "function" && document.querySelector("#liveNum")?.textContent
  );
}

async function scrollToSelector(page, selector, block = "start") {
  await page.evaluate(
    ({ selector: targetSelector, block: targetBlock }) => {
      document.querySelector(targetSelector)?.scrollIntoView({
        behavior: "smooth",
        block: targetBlock
      });
    },
    { selector, block }
  );
}

async function setSourceState(page, sourceId, enabled) {
  const changed = await page.evaluate(
    ({ sourceId: id, enabled: isEnabled }) => {
      if (!window.state || typeof window.update !== "function") return false;
      window.state[id] = isEnabled;
      document.querySelectorAll(`.switch[aria-label="${id}"]`).forEach((button) => {
        button.setAttribute("aria-pressed", isEnabled ? "true" : "false");
      });
      window.update(true);
      return true;
    },
    { sourceId, enabled }
  );
  if (!changed) {
    throw new Error(`Could not change source state for ${sourceId}`);
  }
}

async function showEndCard(page, language) {
  await page.evaluate(
    ({ liveDemoUrl: url, npxCommand: command, language: lang }) => {
      document.getElementById("videoEndCard")?.remove();
      document.getElementById("videoEndCardStyle")?.remove();

      const style = document.createElement("style");
      style.id = "videoEndCardStyle";
      style.textContent = `
        #videoEndCard {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          padding: 72px;
          background: #0f1720;
          color: #f8fafc;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        #videoEndCard .inner {
          width: min(1280px, 100%);
        }
        #videoEndCard .eyebrow {
          margin: 0 0 24px;
          color: #80d0ff;
          font-size: 28px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0;
        }
        #videoEndCard h2 {
          margin: 0 0 40px;
          font-size: 76px;
          line-height: 1.03;
          letter-spacing: 0;
        }
        #videoEndCard .line {
          display: block;
          margin-top: 18px;
          padding: 22px 26px;
          border: 1px solid rgba(248, 250, 252, 0.22);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          font-size: 32px;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }
      `;

      const card = document.createElement("div");
      card.id = "videoEndCard";
      card.innerHTML = `
        <div class="inner">
          <p class="eyebrow">${lang === "uk" ? "Живе демо" : "Live demo"}</p>
          <h2>${lang === "uk" ? "Перевірити локально або онлайн" : "Review online or run locally"}</h2>
          <code class="line">${url}</code>
          <code class="line">${command}</code>
        </div>
      `;
      document.head.appendChild(style);
      document.body.appendChild(card);
    },
    { liveDemoUrl, npxCommand, language }
  );
}

const languages = ["en", "uk"];
const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const manifest = {
  kind: "site-live-capture",
  width,
  height,
  recordedAt: new Date().toISOString(),
  liveDemoUrl,
  npxCommand,
  beats: [
    "Hero + thesis",
    "Live readiness check with two evidence toggles and reset",
    "Evidence graph reacting to the same toggle state",
    "Conflict gate: hand-verified rows still blocked at 49/100",
    "End card with live-demo URL and npx command"
  ],
  languages: {}
};

try {
  for (const language of languages) {
    const { hold, target } = makeHold(language);
    const pageUrl = language === "uk" ? `${siteUrl}?lang=uk` : siteUrl;
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: { dir: rawRoot, size: { width, height } },
      colorScheme: "light"
    });
    const page = await context.newPage();

    const recStart = Date.now();
    await page.goto(pageUrl, { waitUntil: "networkidle" });
    await waitForSiteReady(page);
    await page.addStyleTag({
      content: "*{cursor:none !important} ::-webkit-scrollbar{width:0 !important;height:0 !important}"
    });
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    const leadIn = (Date.now() - recStart) / 1000;

    // 1. Hero + thesis.
    await page.waitForTimeout(hold("hero"));

    // 2. Live readiness check: 44 -> 26, then reset to 44.
    await scrollToSelector(page, "#live", "start");
    await page.waitForTimeout(hold("liveIntro"));
    await page.click('.switch[aria-label="EV-BOM-001"]');
    await page.waitForTimeout(hold("toggleBom"));
    await page.click('.switch[aria-label="EV-MAN-001"]');
    await page.waitForTimeout(hold("toggleManual"));
    await page.click("#resetBtn");
    await page.waitForTimeout(hold("reset"));

    // 3. Evidence graph reacts to the same source state.
    await scrollToSelector(page, "#evidence-graph", "start");
    await page.waitForTimeout(Math.round(hold("graphIntro") * 0.55));
    await page.evaluate(() => window.scrollBy({ top: 210, behavior: "smooth" }));
    await page.waitForTimeout(Math.round(hold("graphIntro") * 0.45));
    await setSourceState(page, "EV-BOM-001", false);
    await page.waitForTimeout(hold("graphOff"));
    await setSourceState(page, "EV-BOM-001", true);
    await page.waitForTimeout(hold("graphOn"));

    // 4. Conflict gate: two hand-verified rows, derived 49/100 Blocked.
    await scrollToSelector(page, "#conflict-gate", "start");
    await page.waitForTimeout(hold("conflict"));

    // 5. End card with URL and local command.
    await showEndCard(page, language);
    await page.waitForTimeout(hold("endCard"));

    const video = page.video();
    await context.close();
    const webm = await video.path();
    const out = join(silentRoot, `uav-readiness-demo.${language}.silent.mp4`);
    const ffmpeg = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        leadIn.toFixed(2),
        "-i",
        webm,
        "-vf",
        `fps=30,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
        "-an",
        "-c:v",
        "libx264",
        "-crf",
        "21",
        "-preset",
        "slow",
        "-movflags",
        "+faststart",
        out
      ],
      { encoding: "utf8" }
    );

    if (ffmpeg.status !== 0) {
      console.error(ffmpeg.stderr);
      process.exitCode = ffmpeg.status ?? 1;
      continue;
    }

    manifest.languages[language] = {
      targetSeconds: Number(target.toFixed(2)),
      leadInTrimSeconds: Number(leadIn.toFixed(2)),
      rawWebm: relative(root, webm).replaceAll("\\", "/"),
      silentMp4: relative(root, out).replaceAll("\\", "/")
    };
    console.log(`${language} silent MP4: ${out} (target ${target.toFixed(1)}s)`);
  }
} finally {
  await browser.close();
}

writeFileSync(join(silentRoot, "site-capture-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

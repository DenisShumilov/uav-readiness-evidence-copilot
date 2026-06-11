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

const headerGapPx = 20;
const viewportBottomPaddingPx = 36;

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

async function smoothScrollToY(page, targetY, durationMs = 650) {
  await page.evaluate(
    ({ y, duration }) => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const target = Math.max(0, Math.min(maxScroll, y));
      const start = window.scrollY;
      const delta = target - start;

      if (Math.abs(delta) < 1 || duration <= 0) {
        window.scrollTo(0, target);
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const startTime = performance.now();
        const step = (now) => {
          const p = Math.min(1, (now - startTime) / duration);
          const eased = p * p * (3 - 2 * p);
          window.scrollTo(0, start + delta * eased);
          if (p < 1) requestAnimationFrame(step);
          else {
            window.scrollTo(0, target);
            resolve();
          }
        };
        requestAnimationFrame(step);
      });
    },
    { y: targetY, duration: durationMs }
  );
}

async function targetYForHeading(page, sectionSelector, headingSelector = ".sec-head h2") {
  return page.evaluate(
    ({ sectionSelector: targetSectionSelector, headingSelector: targetHeadingSelector, gap }) => {
      const section = document.querySelector(targetSectionSelector);
      const heading = section?.querySelector(targetHeadingSelector);
      const header = document.querySelector("header");
      if (!section || !heading) {
        throw new Error(`Missing section heading for ${targetSectionSelector}`);
      }

      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      const headingTop = heading.getBoundingClientRect().top + window.scrollY;
      return Math.max(0, headingTop - headerBottom - gap);
    },
    { sectionSelector, headingSelector, gap: headerGapPx }
  );
}

async function frameSectionHeading(page, language, beatNumber, label, sectionSelector, options = {}) {
  const targetY = await targetYForHeading(page, sectionSelector, options.headingSelector);
  await smoothScrollToY(page, targetY, options.durationMs ?? 650);
  await page.waitForTimeout(options.settleMs ?? 250);
  return assertHeadingFramed(page, language, beatNumber, label, sectionSelector, options);
}

async function assertHeadingFramed(page, language, beatNumber, label, sectionSelector, options = {}) {
  const metrics = await page.evaluate(
    ({ sectionSelector: targetSectionSelector, headingSelector: targetHeadingSelector, gap }) => {
      const section = document.querySelector(targetSectionSelector);
      const heading = section?.querySelector(targetHeadingSelector);
      const header = document.querySelector("header");
      if (!section || !heading) {
        throw new Error(`Missing section heading for ${targetSectionSelector}`);
      }

      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      const rect = heading.getBoundingClientRect();
      const gapFromHeader = rect.top - headerBottom;
      return {
        headerBottom,
        headingTop: rect.top,
        headingBottom: rect.bottom,
        viewportHeight: window.innerHeight,
        gapFromHeader,
        headingText: heading.textContent?.trim() ?? "",
        nearGap: Math.abs(gapFromHeader - gap) <= 10,
        insideViewport: rect.top >= headerBottom + 1 && rect.bottom <= window.innerHeight - 1
      };
    },
    {
      sectionSelector,
      headingSelector: options.headingSelector ?? ".sec-head h2",
      gap: headerGapPx
    }
  );

  if (!metrics.insideViewport || (options.requireHeaderGap && !metrics.nearGap)) {
    throw new Error(
      `[framing][${language}][beat${beatNumber}] ${label} failed: ` +
        `heading "${metrics.headingText}" top=${metrics.headingTop.toFixed(1)}, ` +
        `bottom=${metrics.headingBottom.toFixed(1)}, headerBottom=${metrics.headerBottom.toFixed(1)}, ` +
        `gap=${metrics.gapFromHeader.toFixed(1)}, viewport=${metrics.viewportHeight}`
    );
  }

  console.log(
    `[framing][${language}][beat${beatNumber}] PASS ${label}: ` +
      `heading top=${metrics.headingTop.toFixed(1)}, bottom=${metrics.headingBottom.toFixed(1)}, ` +
      `headerBottom=${metrics.headerBottom.toFixed(1)}, gap=${metrics.gapFromHeader.toFixed(1)}`
  );
  return metrics;
}

async function assertElementsFullyVisible(page, language, beatNumber, label, selectors) {
  const results = await page.evaluate(
    ({ selectors: targetSelectors }) =>
      targetSelectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return { selector, found: false };
        const rect = element.getBoundingClientRect();
        return {
          selector,
          found: true,
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          visible:
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
        };
      }),
    { selectors }
  );

  const failed = results.filter((result) => !result.found || !result.visible);
  if (failed.length > 0) {
    throw new Error(
      `[framing][${language}][beat${beatNumber}] ${label} failed: ` +
        failed
          .map((result) =>
            !result.found
              ? `${result.selector} missing`
              : `${result.selector} rect=${result.top.toFixed(1)}-${result.bottom.toFixed(1)}`
          )
          .join("; ")
    );
  }

  console.log(
    `[framing][${language}][beat${beatNumber}] PASS ${label}: ${results
      .map((result) => `${result.selector} ${result.top.toFixed(1)}-${result.bottom.toFixed(1)}`)
      .join(", ")}`
  );
}

async function slowScrollSectionContent(page, sectionSelector, contentSelector, durationMs) {
  const targetY = await page.evaluate(
    ({ sectionSelector: targetSectionSelector, contentSelector: targetContentSelector, bottomPad }) => {
      const section = document.querySelector(targetSectionSelector);
      const content = section?.querySelector(targetContentSelector);
      if (!section || !content) {
        throw new Error(`Missing scroll-through content for ${targetSectionSelector}`);
      }

      const contentBottom = content.getBoundingClientRect().bottom + window.scrollY;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      return Math.max(0, Math.min(maxScroll, contentBottom - window.innerHeight + bottomPad));
    },
    {
      sectionSelector,
      contentSelector,
      bottomPad: viewportBottomPaddingPx
    }
  );
  await smoothScrollToY(page, targetY, durationMs);
}

async function assertContentBottomVisible(page, language, beatNumber, label, sectionSelector, contentSelector) {
  const metrics = await page.evaluate(
    ({ sectionSelector: targetSectionSelector, contentSelector: targetContentSelector, bottomPad }) => {
      const section = document.querySelector(targetSectionSelector);
      const content = section?.querySelector(targetContentSelector);
      if (!section || !content) {
        throw new Error(`Missing content for ${targetSectionSelector}`);
      }

      const rect = content.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
        visible: rect.bottom <= window.innerHeight - bottomPad + 2
      };
    },
    {
      sectionSelector,
      contentSelector,
      bottomPad: viewportBottomPaddingPx
    }
  );

  if (!metrics.visible) {
    throw new Error(
      `[framing][${language}][beat${beatNumber}] ${label} failed: ` +
        `content bottom=${metrics.bottom.toFixed(1)}, viewport=${metrics.viewportHeight}`
    );
  }

  console.log(
    `[framing][${language}][beat${beatNumber}] PASS ${label}: ` +
      `content top=${metrics.top.toFixed(1)}, bottom=${metrics.bottom.toFixed(1)}`
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
      content:
        "html{scroll-behavior:auto !important}" +
        "*{cursor:none !important} ::-webkit-scrollbar{width:0 !important;height:0 !important}"
    });
    await page.evaluate(() => {
      document.querySelectorAll(".reveal").forEach((element) => element.classList.add("in"));
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    const leadIn = (Date.now() - recStart) / 1000;

    // 1. Hero + thesis.
    await assertHeadingFramed(page, language, 1, "Hero + thesis", ".hero", {
      headingSelector: "h1"
    });
    await page.waitForTimeout(hold("hero"));

    // 2. Live readiness check: 44 -> 26, then reset to 44.
    await frameSectionHeading(page, language, 2, "Live readiness check", "#live", {
      requireHeaderGap: true
    });
    await assertElementsFullyVisible(page, language, 2, "Live toggles and gauge visible", [
      "#live .dash > .panel",
      "#liveGauge"
    ]);
    await page.waitForTimeout(hold("liveIntro"));
    await page.click('.switch[aria-label="EV-BOM-001"]');
    await assertElementsFullyVisible(page, language, 2, "Live score drop after BOM toggle", [
      "#live .dash > .panel",
      "#liveGauge"
    ]);
    await page.waitForTimeout(hold("toggleBom"));
    await page.click('.switch[aria-label="EV-MAN-001"]');
    await assertElementsFullyVisible(page, language, 2, "Live score drop after manual toggle", [
      "#live .dash > .panel",
      "#liveGauge"
    ]);
    await page.waitForTimeout(hold("toggleManual"));
    await page.click("#resetBtn");
    await page.waitForTimeout(hold("reset"));

    // 3. Evidence graph reacts to the same source state.
    await frameSectionHeading(page, language, 3, "Evidence graph", "#evidence-graph", {
      requireHeaderGap: true
    });
    await page.waitForTimeout(Math.round(hold("graphIntro") * 0.25));
    await slowScrollSectionContent(page, "#evidence-graph", ".graph-panel", Math.round(hold("graphIntro") * 0.75));
    await assertContentBottomVisible(page, language, 3, "Evidence graph scroll-through end", "#evidence-graph", ".graph-panel");
    await setSourceState(page, "EV-BOM-001", false);
    await page.waitForTimeout(hold("graphOff"));
    await setSourceState(page, "EV-BOM-001", true);
    await page.waitForTimeout(hold("graphOn"));

    // 4. Conflict gate: two hand-verified rows, derived 49/100 Blocked.
    await frameSectionHeading(page, language, 4, "Conflict gate", "#conflict-gate", {
      requireHeaderGap: true
    });
    await assertElementsFullyVisible(page, language, 4, "Conflict documents and verdict visible", [
      "#conflict-gate .conflict-stage"
    ]);
    await page.waitForTimeout(hold("conflict"));

    // 5. End card with URL and local command.
    await showEndCard(page, language);
    await assertHeadingFramed(page, language, 5, "End card", "#videoEndCard", {
      headingSelector: "h2"
    });
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

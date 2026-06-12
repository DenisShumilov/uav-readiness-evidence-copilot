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
const qaFrameRoot = join(root, "demo-video", "qa", "frames");
mkdirSync(rawRoot, { recursive: true });
mkdirSync(silentRoot, { recursive: true });
mkdirSync(qaFrameRoot, { recursive: true });

const headerGapPx = 20;
const viewportBottomPaddingPx = 36;
const fitMarginPx = 24;
const minStaticZoom = 0.7;
const recorderOverheadAllowanceSeconds = 5.5;

function ffprobeDuration(path) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
    { encoding: "utf8" }
  );
  return result.status === 0 ? Number(result.stdout.trim()) : null;
}

function extractVerificationFrames(videoPath, frames) {
  for (const frame of frames) {
    const outputPath = join(root, frame.frame);
    const result = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        frame.timestampSeconds.toFixed(2),
        "-i",
        videoPath,
        "-frames:v",
        "1",
        "-vf",
        `scale=${width}:${height}`,
        outputPath
      ],
      { encoding: "utf8" }
    );
    if (result.status !== 0) {
      throw new Error(`Could not extract verification frame ${frame.frame}: ${result.stderr}`);
    }
    console.log(
      `[frames][${frame.language}] Extracted ${frame.label} at ` +
        `${frame.timestampSeconds.toFixed(2)}s: ${frame.frame}`
    );
  }
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
  return Math.max(64, Math.min(98, narration - recorderOverheadAllowanceSeconds));
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

function clampStaticZoom(value) {
  return Math.max(minStaticZoom, Math.min(1, value));
}

async function resetPageZoom(page) {
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1";
    document.body.style.zoom = "";
  });
  await page.waitForTimeout(80);
}

async function setPageZoom(page, zoom) {
  await page.evaluate((nextZoom) => {
    document.documentElement.style.zoom = String(nextZoom);
  }, zoom);
  await page.waitForTimeout(80);
}

async function staticSectionMetrics(page, sectionSelector, options = {}) {
  return page.evaluate(
    ({ sectionSelector: targetSectionSelector, headingSelector, bottomSelector, margin }) => {
      const section = document.querySelector(targetSectionSelector);
      const heading = section?.querySelector(headingSelector);
      const header = document.querySelector("header");
      if (!section || !heading) {
        throw new Error(`Missing static section bounds for ${targetSectionSelector}`);
      }

      const bottomElements = bottomSelector
        ? Array.from(section.querySelectorAll(bottomSelector))
        : [section];
      const meaningfulBottomElements = bottomElements.length > 0 ? bottomElements : [section];
      const topRect = heading.getBoundingClientRect();
      const bottom = Math.max(...meaningfulBottomElements.map((element) => element.getBoundingClientRect().bottom));
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      const sectionHeight = bottom - topRect.top;
      const availableHeight = window.innerHeight - headerBottom - margin * 2;

      return {
        headerBottom,
        sectionTop: topRect.top,
        sectionBottom: bottom,
        sectionHeight,
        availableHeight,
        viewportHeight: window.innerHeight,
        scrollY: window.scrollY,
        sectionTopPageY: topRect.top + window.scrollY,
        zoom: Number.parseFloat(document.documentElement.style.zoom || "1") || 1,
        headingText: heading.textContent?.trim() ?? ""
      };
    },
    {
      sectionSelector,
      headingSelector: options.headingSelector ?? ".sec-head h2",
      bottomSelector: options.bottomSelector,
      margin: fitMarginPx
    }
  );
}

async function livePriorityMetrics(page, options = {}) {
  return page.evaluate(
    ({ sectionSelector: targetSectionSelector, headingSelector }) => {
      const section = document.querySelector(targetSectionSelector);
      const heading = section?.querySelector(headingSelector);
      const header = document.querySelector("header");
      if (!section || !heading) {
        throw new Error("Missing live priority section bounds");
      }

      const claimRows = Array.from(section.querySelectorAll("#claimList .claim"));
      const rowTops = [];
      const priorityClaims = [];
      claimRows.forEach((claim) => {
        const rect = claim.getBoundingClientRect();
        let rowIndex = rowTops.findIndex((top) => Math.abs(top - rect.top) < 2);
        if (rowIndex === -1) {
          rowTops.push(rect.top);
          rowIndex = rowTops.length - 1;
        }
        if (rowIndex < 2) priorityClaims.push(claim);
      });

      const priorityElements = [
        section.querySelector(".dash > .panel"),
        section.querySelector("#liveGauge"),
        ...priorityClaims
      ].filter(Boolean);
      const topRect = heading.getBoundingClientRect();
      const bottom = Math.max(...priorityElements.map((element) => element.getBoundingClientRect().bottom));
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;

      return {
        headerBottom,
        sectionTop: topRect.top,
        sectionBottom: bottom,
        sectionHeight: bottom - topRect.top,
        viewportHeight: window.innerHeight,
        scrollY: window.scrollY,
        sectionTopPageY: topRect.top + window.scrollY,
        zoom: Number.parseFloat(document.documentElement.style.zoom || "1") || 1,
        headingText: heading.textContent?.trim() ?? "",
        priorityClaimCount: priorityClaims.length
      };
    },
    {
      sectionSelector: options.sectionSelector ?? "#live",
      headingSelector: options.headingSelector ?? ".sec-head h2"
    }
  );
}

function staticFramePasses(metrics) {
  return metrics.sectionTop >= metrics.headerBottom + 1 && metrics.sectionBottom <= metrics.viewportHeight - 1;
}

function formatFrameMetrics(metrics) {
  return (
    `top=${metrics.sectionTop.toFixed(1)}, bottom=${metrics.sectionBottom.toFixed(1)}, ` +
    `height=${metrics.sectionHeight.toFixed(1)}, headerBottom=${metrics.headerBottom.toFixed(1)}, ` +
    `viewport=${metrics.viewportHeight}, zoom=${metrics.zoom.toFixed(3)}`
  );
}

async function assertStaticSectionFramed(page, language, beatNumber, label, sectionSelector, options = {}) {
  const metrics = options.priority
    ? await livePriorityMetrics(page, options)
    : await staticSectionMetrics(page, sectionSelector, options);

  if (!staticFramePasses(metrics)) {
    throw new Error(
      `[framing][${language}][beat${beatNumber}] ${label} failed: ` +
        `section "${metrics.headingText}" ${formatFrameMetrics(metrics)}`
    );
  }

  const suffix = options.priority ? `, priorityClaims=${metrics.priorityClaimCount}` : "";
  console.log(
    `[framing][${language}][beat${beatNumber}] PASS ${label}: ` +
      `section ${formatFrameMetrics(metrics)}${suffix}`
  );
  return metrics;
}

async function frameLivePriority(page, language, beatNumber, label, sectionSelector, options = {}) {
  let metrics = await livePriorityMetrics(page, options);
  await smoothScrollToY(page, metrics.sectionTopPageY - metrics.headerBottom - fitMarginPx, options.durationMs ?? 650);
  await page.waitForTimeout(options.settleMs ?? 250);
  return assertStaticSectionFramed(page, language, beatNumber, `${label} priority fallback`, sectionSelector, {
    ...options,
    priority: true
  });
}

async function frameStaticSection(page, language, beatNumber, label, sectionSelector, options = {}) {
  await resetPageZoom(page);

  let metrics = await staticSectionMetrics(page, sectionSelector, options);
  let zoom = clampStaticZoom(metrics.availableHeight / metrics.sectionHeight);
  await setPageZoom(page, zoom);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    metrics = await staticSectionMetrics(page, sectionSelector, options);
    const targetY = Math.max(0, metrics.sectionTopPageY - metrics.headerBottom - fitMarginPx);
    await smoothScrollToY(page, targetY, options.durationMs ?? 650);
    await page.waitForTimeout(options.settleMs ?? 250);

    metrics = await staticSectionMetrics(page, sectionSelector, options);
    if (staticFramePasses(metrics)) {
      console.log(
        `[framing][${language}][beat${beatNumber}] PASS ${label}: ` +
          `section ${formatFrameMetrics(metrics)}`
      );
      return { ...metrics, fallback: false };
    }

    const nextZoom = clampStaticZoom(zoom * (metrics.availableHeight / metrics.sectionHeight));
    if (nextZoom >= zoom - 0.005 || zoom <= minStaticZoom + 0.001) break;
    zoom = nextZoom;
    await setPageZoom(page, zoom);
  }

  if (options.allowLivePriorityFallback) {
    const fallback = await frameLivePriority(page, language, beatNumber, label, sectionSelector, options);
    return { ...fallback, fallback: true };
  }

  return assertStaticSectionFramed(page, language, beatNumber, label, sectionSelector, options);
}

function markVerificationFrame(languageManifest, language, key, frameId, label) {
  const outputPath = join(qaFrameRoot, `${language}-${frameId}.png`);
  const frame = {
    key,
    label,
    language,
    timestampSeconds: Math.max(0, (Date.now() - languageManifest.timelineStartMs) / 1000),
    frame: relative(root, outputPath).replaceAll("\\", "/")
  };
  languageManifest.verificationFrames.push(frame);
  console.log(`[frames][${language}] Marked ${label} at ${frame.timestampSeconds.toFixed(2)}s: ${frame.frame}`);
  return frame;
}

async function holdWithMidFrame(page, language, key, durationMs, frameId, label, languageManifest) {
  const first = Math.floor(durationMs / 2);
  await page.waitForTimeout(first);
  markVerificationFrame(languageManifest, language, key ?? frameId, frameId, label);
  await page.waitForTimeout(durationMs - first);
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
    const languageManifest = { timelineStartMs: 0, verificationFrames: [] };

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
    languageManifest.timelineStartMs = Date.now();
    const leadIn = (languageManifest.timelineStartMs - recStart) / 1000;

    // 1. Hero + thesis.
    await frameStaticSection(page, language, 1, "Hero + thesis", ".hero", {
      headingSelector: "h1",
      bottomSelector: ".reveal"
    });
    await holdWithMidFrame(
      page,
      language,
      "hero",
      hold("hero"),
      "beat01-hero-mid",
      "Beat 1 midpoint - hero",
      languageManifest
    );

    // 2. Live readiness check: 44 -> 26, then reset to 44.
    const liveFrame = await frameStaticSection(page, language, 2, "Live readiness check", "#live", {
      bottomSelector: "#claimList",
      requireHeaderGap: true,
      allowLivePriorityFallback: true
    });
    await assertElementsFullyVisible(page, language, 2, "Live toggles and gauge visible", [
      "#live .dash > .panel",
      "#liveGauge"
    ]);
    await page.waitForTimeout(hold("liveIntro"));
    await page.click('.switch[aria-label="EV-BOM-001"]');
    await assertStaticSectionFramed(page, language, 2, "Live after BOM toggle", "#live", {
      bottomSelector: "#claimList",
      priority: liveFrame.fallback
    });
    await assertElementsFullyVisible(page, language, 2, "Live score drop after BOM toggle", [
      "#live .dash > .panel",
      "#liveGauge"
    ]);
    await holdWithMidFrame(
      page,
      language,
      "toggleBom",
      hold("toggleBom"),
      "beat02-live-mid",
      "Beat 2 midpoint - live readiness after first toggle",
      languageManifest
    );
    await page.click('.switch[aria-label="EV-MAN-001"]');
    await assertStaticSectionFramed(page, language, 2, "Live after manual toggle", "#live", {
      bottomSelector: "#claimList",
      priority: liveFrame.fallback
    });
    await assertElementsFullyVisible(page, language, 2, "Live score drop after manual toggle", [
      "#live .dash > .panel",
      "#liveGauge"
    ]);
    markVerificationFrame(
      languageManifest,
      language,
      "liveAfterSecondToggle",
      "beat02-live-after-second-toggle",
      "Beat 2 exact frame - after second toggle"
    );
    if (liveFrame.fallback) {
      const panMs = Math.min(1200, Math.round(hold("toggleManual") * 0.35));
      await slowScrollSectionContent(page, "#live", "#claimList", panMs);
      await page.waitForTimeout(hold("toggleManual") - panMs);
    } else {
      await page.waitForTimeout(hold("toggleManual"));
    }
    await page.click("#resetBtn");
    await page.waitForTimeout(hold("reset"));

    // 3. Evidence graph reacts to the same source state.
    await resetPageZoom(page);
    await frameSectionHeading(page, language, 3, "Evidence graph", "#evidence-graph", {
      requireHeaderGap: true
    });
    await page.waitForTimeout(Math.round(hold("graphIntro") * 0.25));
    await slowScrollSectionContent(page, "#evidence-graph", ".graph-panel", Math.round(hold("graphIntro") * 0.75));
    await assertContentBottomVisible(page, language, 3, "Evidence graph scroll-through end", "#evidence-graph", ".graph-panel");
    await setSourceState(page, "EV-BOM-001", false);
    await holdWithMidFrame(
      page,
      language,
      "graphOff",
      hold("graphOff"),
      "beat03-evidence-mid",
      "Beat 3 midpoint - evidence graph with source off",
      languageManifest
    );
    await setSourceState(page, "EV-BOM-001", true);
    await page.waitForTimeout(hold("graphOn"));

    // 4. Conflict gate: two hand-verified rows, derived 49/100 Blocked.
    await frameStaticSection(page, language, 4, "Conflict gate", "#conflict-gate", {
      bottomSelector: ".conflict-stage",
      requireHeaderGap: true
    });
    await assertElementsFullyVisible(page, language, 4, "Conflict documents and verdict visible", [
      "#conflict-gate .conflict-stage"
    ]);
    await holdWithMidFrame(
      page,
      language,
      "conflict",
      hold("conflict"),
      "beat04-conflict-mid",
      "Beat 4 midpoint - conflict gate",
      languageManifest
    );

    // 5. End card with URL and local command.
    await showEndCard(page, language);
    await frameStaticSection(page, language, 5, "End card", "#videoEndCard", {
      headingSelector: "h2",
      bottomSelector: ".line:last-of-type"
    });
    await holdWithMidFrame(
      page,
      language,
      "endCard",
      hold("endCard"),
      "beat05-end-card-mid",
      "Beat 5 midpoint - end card",
      languageManifest
    );

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

    extractVerificationFrames(out, languageManifest.verificationFrames);

    manifest.languages[language] = {
      targetSeconds: Number(target.toFixed(2)),
      leadInTrimSeconds: Number(leadIn.toFixed(2)),
      rawWebm: relative(root, webm).replaceAll("\\", "/"),
      silentMp4: relative(root, out).replaceAll("\\", "/"),
      verificationFrames: languageManifest.verificationFrames
    };
    console.log(`${language} silent MP4: ${out} (target ${target.toFixed(1)}s)`);
  }
} finally {
  await browser.close();
}

writeFileSync(join(silentRoot, "site-capture-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

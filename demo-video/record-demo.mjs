import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("Playwright is missing. Video frames were not captured.");
  console.log("Install only if you want automated browser capture:");
  console.log("npm install -D playwright");
  console.log("npx playwright install chromium");
  process.exit(0);
}

const root = process.cwd();
const frameRoot = join(root, "demo-video", "output", "frames");
const videoRoot = join(root, "demo-video", "videos");
mkdirSync(frameRoot, { recursive: true });
mkdirSync(videoRoot, { recursive: true });

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

const scrollSteps = [0, 420, 840, 1260, 1680];

const browser = await chromium.launch();

for (const item of pages) {
  const dir = join(frameRoot, item.name);
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(pathToFileURL(item.file).href);

  for (let index = 0; index < scrollSteps.length; index += 1) {
    const scrollY = scrollSteps[index];
    await page.evaluate((value) => window.scrollTo(0, value), scrollY);
    await page.waitForTimeout(250);
    await page.screenshot({
      path: join(dir, `frame-${String(index + 1).padStart(3, "0")}.png`)
    });
  }

  await page.close();
  console.log(`Captured frames for ${item.name}`);
}

await browser.close();

const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
if (ffmpeg.status !== 0) {
  console.log("ffmpeg is missing. Frames are ready, but MP4/GIF was not assembled.");
  process.exit(0);
}

for (const item of pages) {
  const input = join(frameRoot, item.name, "frame-%03d.png");
  const mp4 = join(videoRoot, `uav-readiness-demo.${item.name}.mp4`);
  const gif = join(videoRoot, `uav-readiness-demo.${item.name}.gif`);

  const mp4Result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      "1",
      "-i",
      input,
      "-vf",
      "scale=1280:-2,format=yuv420p",
      "-movflags",
      "+faststart",
      mp4
    ],
    { encoding: "utf8" }
  );

  if (mp4Result.status === 0 && existsSync(mp4)) {
    console.log(`Assembled MP4 for ${item.name}: ${mp4}`);
  } else {
    console.log(`MP4 assembly failed for ${item.name}. Frames are still available.`);
  }

  const gifResult = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      "1",
      "-i",
      input,
      "-vf",
      "scale=960:-1:flags=lanczos",
      gif
    ],
    { encoding: "utf8" }
  );

  if (gifResult.status === 0 && existsSync(gif)) {
    console.log(`Assembled GIF for ${item.name}: ${gif}`);
  } else {
    console.log(`GIF assembly failed for ${item.name}. Frames are still available.`);
  }
}

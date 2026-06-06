import { mkdirSync } from "node:fs";
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
mkdirSync(frameRoot, { recursive: true });

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

for (const item of pages) {
  const dir = join(frameRoot, item.name);
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(pathToFileURL(item.file).href);
  await page.screenshot({ path: join(dir, "frame-001.png") });
  await page.evaluate(() => window.scrollTo(0, 520));
  await page.screenshot({ path: join(dir, "frame-002.png") });
  await page.evaluate(() => window.scrollTo(0, 1040));
  await page.screenshot({ path: join(dir, "frame-003.png") });
  await page.close();
  console.log(`Captured frames for ${item.name}`);
}

await browser.close();

const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
if (ffmpeg.status !== 0) {
  console.log("ffmpeg is missing. Frames are ready, but MP4/GIF was not assembled.");
  process.exit(0);
}

console.log("ffmpeg is available. Assemble manually from frames if needed:");
console.log("ffmpeg -framerate 1 -i demo-video/output/frames/en/frame-%03d.png demo-video/output/uav-readiness-demo.en.mp4");
console.log("ffmpeg -framerate 1 -i demo-video/output/frames/uk/frame-%03d.png demo-video/output/uav-readiness-demo.uk.mp4");

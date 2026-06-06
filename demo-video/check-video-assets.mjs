import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outputDir = join(root, "examples", "demo-uav-readiness", "output");
const pages = [
  "portfolio-demo.html",
  "portfolio-demo.en.html",
  "portfolio-demo.uk.html"
];

let playwrightAvailable = false;
try {
  await import("playwright");
  playwrightAvailable = true;
} catch {
  playwrightAvailable = false;
}

const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
const ffmpegAvailable = ffmpeg.status === 0;
const ffprobe = spawnSync("ffprobe", ["-version"], { encoding: "utf8" });
const ffprobeAvailable = ffprobe.status === 0;
const missingPages = pages.filter((page) => !existsSync(join(outputDir, page)));

console.log("Demo video asset check");
console.log(`Playwright: ${playwrightAvailable ? "available" : "missing"}`);
console.log(`ffmpeg: ${ffmpegAvailable ? "available" : "missing"}`);
console.log(`ffprobe: ${ffprobeAvailable ? "available" : "missing"}`);
console.log(
  `Portfolio pages: ${missingPages.length === 0 ? "available" : `missing ${missingPages.join(", ")}`}`
);

if (!playwrightAvailable) {
  console.log("");
  console.log("To enable automated browser capture:");
  console.log("npm install -D playwright");
  console.log("npx playwright install chromium");
}

if (!ffmpegAvailable) {
  console.log("");
  console.log("ffmpeg is needed for MP4/GIF assembly. Without it, keep screenshots and storyboard files.");
}

if (!ffprobeAvailable) {
  console.log("");
  console.log("ffprobe is needed for video QA metadata. It usually installs together with ffmpeg.");
}

if (missingPages.length > 0) {
  console.log("");
  console.log("Run this first:");
  console.log("npm run demo:readiness");
}

console.log("");
console.log("High-quality MP4 pipeline:");
console.log("npm run demo:video:record:hq");
console.log("npm run demo:video:build");
console.log("npm run demo:video:qa");

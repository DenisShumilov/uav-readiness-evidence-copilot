import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const fps = 30;
const width = 1920;
const height = 1080;
const transitionSeconds = 0.6;
const frameRoot = join(root, "demo-video", "frames");
const videoRoot = join(root, "demo-video", "videos", "silent");
mkdirSync(videoRoot, { recursive: true });

const languages = ["en", "uk"];

function requireCommand(command, installHint) {
  const result = spawnSync(command, ["-version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    console.error(`${command} is missing or not available on PATH.`);
    console.error(installHint);
    process.exit(1);
  }
}

requireCommand("ffmpeg", "Install ffmpeg, then rerun: npm run demo:video:build");
requireCommand("ffprobe", "Install ffmpeg/ffprobe, then rerun: npm run demo:video:build");

for (const language of languages) {
  const manifestPath = join(frameRoot, language, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`Missing manifest for ${language}. Run npm run demo:video:record:hq first.`);
    process.exitCode = 1;
    continue;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const scenes = manifest.scenes;
  const transition = manifest.transitionSeconds ?? transitionSeconds;
  const output = join(videoRoot, `uav-readiness-demo.${language}.silent.mp4`);

  const args = [];
  scenes.forEach((scene) => {
    args.push("-loop", "1", "-t", String(scene.duration), "-i", scene.file);
  });

  const filters = [];
  scenes.forEach((_, index) => {
    filters.push(
      `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps},format=yuv420p[v${index}]`
    );
  });

  let outputLabel = "v0";
  if (scenes.length > 1) {
    let offset = scenes[0].duration - transition;
    filters.push(`[v0][v1]xfade=transition=fade:duration=${transition}:offset=${offset.toFixed(2)}[x1]`);
    for (let index = 2; index < scenes.length; index += 1) {
      offset += scenes[index - 1].duration - transition;
      const previous = `x${index - 1}`;
      const next = `x${index}`;
      filters.push(`[${previous}][v${index}]xfade=transition=fade:duration=${transition}:offset=${offset.toFixed(2)}[${next}]`);
    }
    outputLabel = `x${scenes.length - 1}`;
  }

  const ffmpegArgs = [
    "-y",
    ...args,
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${outputLabel}]`,
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-crf",
    "12",
    "-preset",
    "slow",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    output
  ];

  const result = spawnSync("ffmpeg", ffmpegArgs, { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exitCode = result.status ?? 1;
    continue;
  }

  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", output],
    { encoding: "utf8" }
  );

  if (probe.status === 0) {
    writeFileSync(
      join(videoRoot, `uav-readiness-demo.${language}.silent.ffprobe.json`),
      probe.stdout,
      "utf8"
    );
  }

  console.log(`Built high-quality silent video for ${language}: ${output}`);
}

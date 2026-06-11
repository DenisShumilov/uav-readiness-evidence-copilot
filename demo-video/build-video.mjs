import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const fps = 30;
const width = 1920;
const height = 1080;
const frameRoot = join(root, "demo-video", "frames");
const videoRoot = join(root, "demo-video", "videos", "silent");
mkdirSync(videoRoot, { recursive: true });

const languages = ["en", "uk"];
const siteCaptureManifest = join(videoRoot, "site-capture-manifest.json");

function requireCommand(command, installHint) {
  const result = spawnSync(command, ["-version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    console.error(`${command} is missing or not available on PATH.`);
    console.error(installHint);
    process.exit(1);
  }
}

function easeExpression(start, end) {
  if (start.scrollY === end.scrollY) {
    return String(start.scrollY);
  }

  const duration = end.time - start.time;
  const p = `((t-${start.time})/${duration})`;
  const eased = `((${p})*(${p})*(3-2*(${p})))`;
  return `(${start.scrollY}+(${end.scrollY - start.scrollY})*${eased})`;
}

function buildScrollExpression(keyframes) {
  let expression = String(keyframes.at(-1).scrollY);

  for (let index = keyframes.length - 2; index >= 0; index -= 1) {
    const start = keyframes[index];
    const end = keyframes[index + 1];
    const value = easeExpression(start, end);
    expression = `if(lt(t\\,${end.time})\\,${value}\\,${expression})`;
  }

  return expression;
}

requireCommand("ffmpeg", "Install ffmpeg, then rerun: npm run demo:video:build");
requireCommand("ffprobe", "Install ffmpeg/ffprobe, then rerun: npm run demo:video:build");

if (existsSync(siteCaptureManifest)) {
  const manifest = JSON.parse(readFileSync(siteCaptureManifest, "utf8"));
  console.log("Using live site-capture silent MP4s from demo-video/record-site-demo.mjs");
  for (const language of languages) {
    const output = join(videoRoot, `uav-readiness-demo.${language}.silent.mp4`);
    if (!existsSync(output)) {
      console.error(`Missing site-capture silent video for ${language}: ${output}`);
      process.exitCode = 1;
      continue;
    }

    const probe = spawnSync(
      "ffprobe",
      ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", output],
      { encoding: "utf8" }
    );

    if (probe.status !== 0) {
      console.error(`ffprobe failed for ${language} site-capture video.`);
      process.exitCode = probe.status ?? 1;
      continue;
    }

    writeFileSync(join(videoRoot, `uav-readiness-demo.${language}.silent.ffprobe.json`), probe.stdout, "utf8");
    const target = manifest.languages?.[language]?.targetSeconds;
    console.log(`Kept live site-capture silent video for ${language}: ${output}${target ? ` (${target}s target)` : ""}`);
  }
  process.exit(process.exitCode ?? 0);
}

for (const language of languages) {
  const manifestPath = join(frameRoot, language, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`Missing manifest for ${language}. Run npm run demo:video:record:hq first.`);
    process.exitCode = 1;
    continue;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const fullPageFile = join(root, manifest.fullPageFile);
  if (!existsSync(fullPageFile)) {
    console.error(`Missing full-page screenshot for ${language}: ${fullPageFile}`);
    process.exitCode = 1;
    continue;
  }

  const output = join(videoRoot, `uav-readiness-demo.${language}.silent.mp4`);
  const scrollExpression = buildScrollExpression(manifest.keyframes);
  const duration = manifest.durationSeconds ?? 70;
  const filter = [
    `fps=${fps}`,
    `scale=${width}:-1`,
    `crop=${width}:${height}:0:${scrollExpression}`,
    "format=yuv420p"
  ].join(",");

  const ffmpegArgs = [
    "-y",
    "-loop",
    "1",
    "-t",
    String(duration),
    "-i",
    fullPageFile,
    "-vf",
    filter,
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
    writeFileSync(join(videoRoot, `uav-readiness-demo.${language}.silent.ffprobe.json`), probe.stdout, "utf8");
  }

  console.log(`Built smooth silent video for ${language}: ${output}`);
}

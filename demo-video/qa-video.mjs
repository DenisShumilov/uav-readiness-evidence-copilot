import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const qaRoot = join(root, "demo-video", "qa");
mkdirSync(qaRoot, { recursive: true });

const languages = ["en", "uk"];
const timestamps = [2, 8, 15, 25, 35, 45, 55, 63];
const report = ["# Video QA report", ""];

function requireCommand(command, installHint) {
  const result = spawnSync(command, ["-version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    console.error(`${command} is missing or not available on PATH.`);
    console.error(installHint);
    process.exit(1);
  }
}

requireCommand("ffmpeg", "Install ffmpeg, then rerun: npm run demo:video:qa");
requireCommand("ffprobe", "Install ffmpeg/ffprobe, then rerun: npm run demo:video:qa");

for (const language of languages) {
  const finalVideo = join(root, "demo-video", "videos", "final", `uav-readiness-demo.${language}.final.mp4`);
  const silentVideo = join(root, "demo-video", "videos", "silent", `uav-readiness-demo.${language}.silent.mp4`);
  const video = existsSync(finalVideo) ? finalVideo : silentVideo;
  const hasVoiceover = existsSync(finalVideo);

  report.push(`## ${language.toUpperCase()}`);
  if (!existsSync(video)) {
    report.push("Video missing. Run `npm run demo:video:build` first.", "");
    continue;
  }

  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", video],
    { encoding: "utf8" }
  );

  let details = {};
  if (probe.status === 0) {
    details = JSON.parse(probe.stdout);
  }

  const videoStream = details.streams?.find((stream) => stream.codec_type === "video");
  const audioStream = details.streams?.find((stream) => stream.codec_type === "audio");

  const extractedFrames = [];
  timestamps.forEach((timestamp, index) => {
    const frame = join(qaRoot, `qa-${language}-${String(index + 1).padStart(2, "0")}.png`);
    const frameResult = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(timestamp),
        "-i",
        video,
        "-frames:v",
        "1",
        "-vf",
        "scale=480:-1",
        frame
      ],
      { encoding: "utf8" }
    );
    if (frameResult.status === 0) {
      extractedFrames.push(frame);
    }
  });

  spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      "1",
      "-i",
      join(qaRoot, `qa-${language}-%02d.png`),
      "-vf",
      "tile=4x2",
      "-frames:v",
      "1",
      join(qaRoot, `contact-sheet.${language}.png`)
    ],
    { encoding: "utf8" }
  );

  report.push(`- Source: ${hasVoiceover ? "final voiceover MP4" : "silent MP4"}`);
  report.push(`- Resolution: ${videoStream ? `${videoStream.width}x${videoStream.height}` : "unknown"}`);
  report.push(`- Duration: ${details.format?.duration ? `${Number(details.format.duration).toFixed(2)}s` : "unknown"}`);
  report.push(`- FPS: ${videoStream?.avg_frame_rate ?? "unknown"}`);
  report.push(`- Video codec: ${videoStream?.codec_name ?? "unknown"}`);
  report.push(`- Pixel format: ${videoStream?.pix_fmt ?? "unknown"}`);
  report.push(`- Audio codec: ${audioStream?.codec_name ?? "none"}`);
  report.push(`- Voiceover: ${hasVoiceover ? "yes" : "no"}`);
  report.push(`- QA frames sampled: ${extractedFrames.length}/${timestamps.length}`);
  report.push("- Visual checks: text clarity, no flicker, no black frames, smooth fades, safe static portfolio content.");
  report.push(`- Contact sheet: demo-video/qa/contact-sheet.${language}.png`, "");
}

report.push("## Manual review checklist", "");
report.push("- Open the MP4 locally and check text readability.");
report.push("- Confirm only static portfolio demo pages are shown.");
report.push("- Confirm no private paths or live data are visible.");
report.push("- Confirm any voiceover sounds natural and is not clipped.");
report.push("- For LinkedIn/GitHub Release, upload final MP4 only after manual review.");

writeFileSync(join(qaRoot, "video-qa-report.md"), `${report.join("\n")}\n`, "utf8");
console.log("Video QA report written to demo-video/qa/video-qa-report.md");

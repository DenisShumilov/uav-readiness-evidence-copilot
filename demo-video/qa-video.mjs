import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const qaRoot = join(root, "demo-video", "qa");
mkdirSync(qaRoot, { recursive: true });

const languages = ["en", "uk"];
const maxFinalBytes = 60 * 1024 * 1024;
const report = ["# Video QA report", ""];
let failures = 0;

function requireCommand(command, installHint) {
  const result = spawnSync(command, ["-version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    console.error(`${command} is missing or not available on PATH.`);
    console.error(installHint);
    process.exit(1);
  }
}

function fail(message) {
  failures += 1;
  report.push(`- FAIL: ${message}`);
}

function probeVideo(path) {
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", path],
    { encoding: "utf8" }
  );
  if (probe.status !== 0) return {};
  return JSON.parse(probe.stdout);
}

function timestampsFor(duration) {
  const safeDuration = Number.isFinite(duration) && duration > 10 ? duration : 70;
  const fractions = [0.06, 0.28, 0.55, 0.73, 0.94, 0.16, 0.38, 0.62, 0.82, 0.98];
  return fractions.map((fraction) => {
    const timestamp = safeDuration * fraction;
    return Math.max(1, Math.min(safeDuration - 0.75, timestamp));
  });
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
    fail(`Video missing for ${language}. Run the record/build/voiceover/merge chain first.`);
    report.push("");
    continue;
  }

  const details = probeVideo(video);
  const videoStream = details.streams?.find((stream) => stream.codec_type === "video");
  const audioStream = details.streams?.find((stream) => stream.codec_type === "audio");
  const duration = Number(details.format?.duration);
  const fileBytes = statSync(video).size;
  const timestamps = timestampsFor(duration);
  const extractedFrames = [];

  timestamps.forEach((timestamp, index) => {
    const frame = join(qaRoot, `qa-${language}-${String(index + 1).padStart(2, "0")}.png`);
    const frameResult = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        timestamp.toFixed(2),
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

  const tileResult = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      "1",
      "-i",
      join(qaRoot, `qa-${language}-%02d.png`),
      "-vf",
      "tile=5x2",
      "-frames:v",
      "1",
      join(qaRoot, `contact-sheet.${language}.png`)
    ],
    { encoding: "utf8" }
  );

  report.push(`- Source: ${hasVoiceover ? "final voiceover MP4" : "silent MP4"}`);
  report.push(`- Resolution: ${videoStream ? `${videoStream.width}x${videoStream.height}` : "unknown"}`);
  report.push(`- Duration: ${Number.isFinite(duration) ? `${duration.toFixed(2)}s` : "unknown"}`);
  report.push(`- File size: ${(fileBytes / 1024 / 1024).toFixed(2)} MiB`);
  report.push(`- FPS: ${videoStream?.avg_frame_rate ?? "unknown"}`);
  report.push(`- Video codec: ${videoStream?.codec_name ?? "unknown"}`);
  report.push(`- Pixel format: ${videoStream?.pix_fmt ?? "unknown"}`);
  report.push(`- Audio codec: ${audioStream?.codec_name ?? "none"}`);
  report.push(`- Audio sample rate: ${audioStream?.sample_rate ? `${audioStream.sample_rate} Hz` : "none"}`);
  report.push(`- Voiceover: ${hasVoiceover ? "yes" : "no"}`);
  report.push(
    `- Final MP4 path: ${
      hasVoiceover
        ? `demo-video/videos/final/uav-readiness-demo.${language}.final.mp4`
        : "not created yet"
    }`
  );
  report.push(`- QA frames sampled: ${extractedFrames.length}/${timestamps.length}`);
  report.push("- Contact sheet layout: 5 columns x 2 rows.");
  report.push("- Top row: hero, live readiness at 26, evidence graph, conflict gate, end card.");
  report.push("- Bottom row: live intro, reset/transition, graph recovery, conflict hold, final end-card hold.");
  report.push(`- Contact sheet: demo-video/qa/contact-sheet.${language}.png`);

  if (!hasVoiceover) fail(`${language} final voiceover MP4 is missing.`);
  if (!videoStream) fail(`${language} video stream is missing.`);
  if (videoStream && (videoStream.width !== 1920 || videoStream.height !== 1080)) {
    fail(`${language} resolution is ${videoStream.width}x${videoStream.height}, expected 1920x1080.`);
  }
  if (!audioStream) fail(`${language} audio stream is missing.`);
  if (!Number.isFinite(duration) || duration < 55 || duration > 105) {
    fail(`${language} duration is outside the 55-105s QA range.`);
  }
  if (fileBytes > maxFinalBytes) {
    fail(`${language} final MP4 exceeds 60 MiB.`);
  }
  if (extractedFrames.length !== timestamps.length || tileResult.status !== 0) {
    fail(`${language} contact sheet generation did not complete.`);
  }

  report.push("");
}

report.push("## Result", "");
if (failures > 0) {
  report.push(`FAIL - ${failures} issue(s) found.`);
} else {
  report.push("PASS - final MP4s include video, voiceover audio, 1920x1080 resolution, acceptable duration, contact sheets, and size under 60 MiB.");
}

report.push("");
report.push("## Manual review checklist", "");
report.push("- Open the MP4 locally and check text readability.");
report.push("- Confirm all 5 beats are visible in the contact sheets.");
report.push("- Confirm only static portfolio demo pages are shown.");
report.push("- Confirm no private paths or live data are visible.");
report.push("- Confirm voiceover sounds natural and is not clipped.");
report.push("- Upload final MP4 only after manual review.");

writeFileSync(join(qaRoot, "video-qa-report.md"), `${report.join("\n")}\n`, "utf8");

if (failures > 0) {
  console.error(`Video QA failed with ${failures} issue(s). See demo-video/qa/video-qa-report.md`);
  process.exit(1);
}

console.log("Video QA passed. Report written to demo-video/qa/video-qa-report.md");

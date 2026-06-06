import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const silentRoot = join(root, "demo-video", "videos", "silent");
const finalRoot = join(root, "demo-video", "videos", "final");
const audioRoot = join(root, "demo-video", "audio");
mkdirSync(finalRoot, { recursive: true });
mkdirSync(audioRoot, { recursive: true });

const languages = ["en", "uk"];
let mergedAny = false;

const ffmpegCheck = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
if (ffmpegCheck.error || ffmpegCheck.status !== 0) {
  console.error("ffmpeg is missing or not available on PATH.");
  console.error("Install ffmpeg before merging voiceover.");
  process.exit(1);
}

function durationOf(path) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
    { encoding: "utf8" }
  );
  if (result.status !== 0) return 0;
  return Number(result.stdout.trim());
}

for (const language of languages) {
  const video = join(silentRoot, `uav-readiness-demo.${language}.silent.mp4`);
  const audio = join(audioRoot, `voiceover.${language}.wav`);
  const output = join(finalRoot, `uav-readiness-demo.${language}.final.mp4`);

  if (!existsSync(video)) {
    console.log(`Missing silent video for ${language}. Run npm run demo:video:build first.`);
    continue;
  }

  if (!existsSync(audio)) {
    console.log(`No voiceover WAV found for ${language}: ${audio}`);
    console.log("Skipping final voiceover merge. Use voiceover scripts or record a clean WAV manually.");
    continue;
  }

  const videoDuration = durationOf(video);
  const audioDuration = durationOf(audio);
  const extensionSeconds = Math.max(0, audioDuration - videoDuration + 0.5);

  const args =
    extensionSeconds > 0.2
      ? [
          "-y",
          "-i",
          video,
          "-i",
          audio,
          "-filter_complex",
          `[0:v]tpad=stop_mode=clone:stop_duration=${extensionSeconds.toFixed(2)},format=yuv420p[v];[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`,
          "-map",
          "[v]",
          "-map",
          "[a]",
          "-c:v",
          "libx264",
          "-crf",
          "12",
          "-preset",
          "slow",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-shortest",
          output
        ]
      : [
      "-y",
      "-i",
      video,
      "-i",
      audio,
      "-filter:a",
      "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      output
    ];

  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });

  if (result.status !== 0) {
    console.error(result.stderr);
    process.exitCode = result.status ?? 1;
    continue;
  }

  mergedAny = true;
  console.log(`Merged final video for ${language}: ${output}`);
  console.log(`Video duration: ${videoDuration.toFixed(2)}s`);
  console.log(`Audio duration: ${audioDuration.toFixed(2)}s`);
  console.log(`Video extension: ${extensionSeconds.toFixed(2)}s`);
}

if (!mergedAny) {
  console.log("");
  console.log("No final voiceover MP4 was created because local voiceover WAV files are missing.");
  console.log("Expected files:");
  console.log("demo-video/audio/voiceover.en.wav");
  console.log("demo-video/audio/voiceover.uk.wav");
  console.log("Then run: npm run demo:video:merge");
}

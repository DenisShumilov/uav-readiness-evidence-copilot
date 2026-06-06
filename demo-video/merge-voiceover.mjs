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

  const result = spawnSync(
    "ffmpeg",
    [
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
    ],
    { encoding: "utf8" }
  );

  if (result.status !== 0) {
    console.error(result.stderr);
    process.exitCode = result.status ?? 1;
    continue;
  }

  mergedAny = true;
  console.log(`Merged final video for ${language}: ${output}`);
}

if (!mergedAny) {
  console.log("");
  console.log("No final voiceover MP4 was created because local voiceover WAV files are missing.");
  console.log("Expected files:");
  console.log("demo-video/audio/voiceover.en.wav");
  console.log("demo-video/audio/voiceover.uk.wav");
  console.log("Then run: npm run demo:video:merge");
}

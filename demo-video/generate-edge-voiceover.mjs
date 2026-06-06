import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const audioRoot = join(root, "demo-video", "audio");
mkdirSync(audioRoot, { recursive: true });

const voices = {
  en: {
    voice: "en-US-EmmaNeural",
    rate: "+0%",
    input: join(root, "demo-video", "voiceover.en.txt"),
    mp3: join(audioRoot, "voiceover.en.edge.mp3"),
    wav: join(audioRoot, "voiceover.en.wav")
  },
  uk: {
    voice: "uk-UA-PolinaNeural",
    rate: "+0%",
    input: join(root, "demo-video", "voiceover.uk.txt"),
    mp3: join(audioRoot, "voiceover.uk.edge.mp3"),
    wav: join(audioRoot, "voiceover.uk.wav")
  }
};

function run(command, args, hint) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
    console.error(hint);
    process.exit(result.status ?? 1);
  }
  return result;
}

function durationOf(path) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
    { encoding: "utf8" }
  );
  if (result.status !== 0) return "unknown";
  return `${Number(result.stdout.trim()).toFixed(2)}s`;
}

run("python", ["-m", "edge_tts", "--help"], "Install Edge TTS first: python -m pip install --user edge-tts");
run("ffmpeg", ["-version"], "Install ffmpeg first.");
run("ffprobe", ["-version"], "Install ffprobe first.");

for (const [language, config] of Object.entries(voices)) {
  if (!existsSync(config.input)) {
    console.error(`Missing voiceover text: ${config.input}`);
    process.exit(1);
  }

  const text = readFileSync(config.input, "utf8").trim();
  if (!text) {
    console.error(`Voiceover text is empty: ${config.input}`);
    process.exit(1);
  }

  run(
    "python",
    [
      "-m",
      "edge_tts",
      "--voice",
      config.voice,
      "--rate",
      config.rate,
      "--text",
      text,
      "--write-media",
      config.mp3
    ],
    `Failed to generate ${language} Edge TTS audio.`
  );

  run(
    "ffmpeg",
    [
      "-y",
      "-i",
      config.mp3,
      "-ar",
      "48000",
      "-ac",
      "1",
      "-sample_fmt",
      "s16",
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      config.wav
    ],
    `Failed to convert ${language} voiceover to WAV.`
  );

  console.log(`${language.toUpperCase()} voiceover: ${config.wav}`);
  console.log(`Voice: ${config.voice}`);
  console.log(`Duration: ${durationOf(config.wav)}`);
}

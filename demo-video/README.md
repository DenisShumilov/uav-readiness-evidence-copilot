# Demo Video Pipeline

This folder creates English and Ukrainian portfolio demo videos.

Simple meaning: it turns the static portfolio demo page into recruiter-friendly MP4/GIF assets.

## Safety

The video shows only static portfolio pages generated from synthetic demo data.

No real UAV data, no live systems, no operational workflow, no route planning, no payload handling, no targeting, and no telemetry tools are used.

## Quick Preview

Use this for a small README preview:

```powershell
npm run demo:readiness
npm run demo:video:screenshots
npm run demo:video:record
```

This can create small GIF previews:

```text
demo-video/videos/uav-readiness-demo.en.gif
demo-video/videos/uav-readiness-demo.uk.gif
```

## High-Quality MP4

Use this when you want a cleaner 1920x1080 MP4:

```powershell
npm run demo:readiness
npm run demo:video:record:hq
npm run demo:video:build
npm run demo:video:qa
```

Silent outputs:

```text
demo-video/videos/silent/uav-readiness-demo.en.silent.mp4
demo-video/videos/silent/uav-readiness-demo.uk.silent.mp4
```

QA outputs:

```text
demo-video/qa/contact-sheet.en.png
demo-video/qa/contact-sheet.uk.png
demo-video/qa/video-qa-report.md
```

## Voiceover

Do not use poor robotic TTS just to have sound.

If you have clean WAV voiceover files, put them here:

```text
demo-video/audio/voiceover.en.wav
demo-video/audio/voiceover.uk.wav
```

Then run:

```powershell
npm run demo:video:merge
npm run demo:video:qa
```

Final voiceover outputs:

```text
demo-video/videos/final/uav-readiness-demo.en.final.mp4
demo-video/videos/final/uav-readiness-demo.uk.final.mp4
```

Read:

- `demo-video/voiceover-instructions.md`
- `demo-video/voiceover.en.txt`
- `demo-video/voiceover.uk.txt`
- `demo-video/video-quality-audit.md`

## Tool Checks

Run:

```powershell
npm run demo:video:check
```

Needed tools:

- Playwright = browser automation tool for screenshots and capture.
- ffmpeg = video assembly tool.
- ffprobe = video inspection tool.

## Git Rule

Large MP4 and WAV files are ignored by Git.

Commit scripts, docs, screenshots, GIF previews, contact sheets, and QA reports. Do not commit large final videos unless you intentionally publish them through a GitHub Release or external video hosting.


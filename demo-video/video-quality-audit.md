# Demo Video Quality Audit

## What Was Weak Before

The first GIF/MP4 was useful as a quick preview, but not strong enough as a recruiter-facing final video.

Main issues:

- GIF compression creates visible artifacts, meaning text can look blocky or blurry.
- Low frame count makes scrolling feel jumpy.
- Browser capture was optimized for speed, not production quality.
- There was no separate QA pass for resolution, duration, frame clarity, or audio.
- There was no voiceover merge step.

Simple meaning: the old version was good as a preview, but too rough as a final portfolio video.

## Quality Target

The high-quality pipeline targets:

- 1920x1080 resolution;
- 30 fps for stable playback;
- H.264 MP4 output;
- CRF 12 video quality, meaning a high-quality ffmpeg setting;
- no browser chrome;
- no cursor jitter;
- smooth fade transitions;
- static portfolio pages only;
- no operational UAV content.

## Current Pipeline

1. `npm run demo:readiness`
   - Generates the static demo pages.

2. `npm run demo:video:record:hq`
   - Captures clean 1920x1080 PNG scenes.

3. `npm run demo:video:build`
   - Builds silent high-quality MP4 files with ffmpeg.

4. `npm run demo:video:merge`
   - Adds clean WAV voiceover if files exist.

5. `npm run demo:video:qa`
   - Creates contact sheets and a QA report.

## Voiceover Rule

Do not generate fake voiceover if local TTS quality is poor.

Use either:

- a clean manual recording;
- a trusted local/offline TTS voice;
- a user-approved external tool.

Expected audio files:

```text
demo-video/audio/voiceover.en.wav
demo-video/audio/voiceover.uk.wav
```

## Safety Rule

The video may show only static portfolio pages generated from synthetic demo data.

It must not show real UAV data, live systems, operational workflows, routes, targeting, payload control, telemetry, or tactical use.


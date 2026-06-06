# Demo video pipeline

This folder prepares a 60-second portfolio demo video in English and Ukrainian.

No external services are used.

## Files

- `storyboard.en.md` = English shot plan.
- `storyboard.uk.md` = Ukrainian shot plan.
- `voiceover.en.txt` = English voiceover text.
- `voiceover.uk.txt` = Ukrainian voiceover text.
- `check-video-assets.mjs` = checks local prerequisites.
- `capture-screenshots.mjs` = captures static demo screenshots with Playwright if available.
- `record-demo.mjs` = prepares frame capture and optional ffmpeg assembly.

## Expected outputs

Future files:

```text
demo-video/output/uav-readiness-demo.en.mp4
demo-video/output/uav-readiness-demo.uk.mp4
demo-video/output/uav-readiness-demo.en.gif
demo-video/output/uav-readiness-demo.uk.gif
```

## Run

First generate the static demo pages:

```powershell
npm run demo:readiness
```

Check tools:

```powershell
npm run demo:video:check
```

Capture screenshots:

```powershell
npm run demo:video:screenshots
```

Try frame/video preparation:

```powershell
npm run demo:video:record
```

If ffmpeg is available, this creates:

```text
demo-video/videos/uav-readiness-demo.en.mp4
demo-video/videos/uav-readiness-demo.uk.mp4
demo-video/videos/uav-readiness-demo.en.gif
demo-video/videos/uav-readiness-demo.uk.gif
```

Large MP4 files are ignored by Git. Commit only small GIFs/screenshots when they are useful for README preview.

## Playwright note

Playwright is optional.

If the check says Playwright is missing, install it only if you want automated browser capture:

```powershell
npm install -D playwright
npx playwright install chromium
```

Playwright = a tool that opens a browser automatically for screenshots or tests.

## ffmpeg note

ffmpeg is optional.

If ffmpeg is missing, the scripts still prepare frames and screenshots where possible.

ffmpeg = a tool that can assemble images into video or GIF.

## Safety

The video shows only static portfolio pages generated from synthetic demo data.

No real UAV data, no live systems, no operational workflow, and no external services are used.

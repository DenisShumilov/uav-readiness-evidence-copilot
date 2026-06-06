# Voiceover Instructions

Use this only when you want final MP4 files with voice.

## Recommended Audio

Record or generate two clean WAV files:

```text
demo-video/audio/voiceover.en.wav
demo-video/audio/voiceover.uk.wav
```

Recommended settings:

- WAV format;
- 48 kHz sample rate;
- clear speech;
- no background music;
- no clipping, meaning the sound should not be too loud and distorted;
- around 60 to 75 seconds.

## English Script

Use:

```text
demo-video/voiceover.en.txt
```

## Ukrainian Script

Use:

```text
demo-video/voiceover.uk.txt
```

## Merge Voiceover

After putting the WAV files in `demo-video/audio/`, run:

```powershell
npm run demo:video:merge
```

This creates:

```text
demo-video/videos/final/uav-readiness-demo.en.final.mp4
demo-video/videos/final/uav-readiness-demo.uk.final.mp4
```

## Quality Check

Run:

```powershell
npm run demo:video:qa
```

Then open:

```text
demo-video/qa/video-qa-report.md
demo-video/qa/contact-sheet.en.png
demo-video/qa/contact-sheet.uk.png
```

## Important

Do not use poor robotic TTS just to have audio.

A clean silent video is better than a distracting fake voice.


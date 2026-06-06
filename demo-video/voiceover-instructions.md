# Voiceover Instructions

Use this only when you want final MP4 files with voice.

## Automatic Voiceover

Current selected TTS:

- Ukrainian: Edge TTS `uk-UA-PolinaNeural`
- English: Edge TTS `en-US-EmmaNeural`

TTS means text-to-speech, or generated voice from written text.

Edge TTS is online, free to use from CLI, and does not need an API key or login.

Install if missing:

```powershell
python -m pip install --user edge-tts
```

Generate WAV files:

```powershell
npm run demo:video:voiceover
```

This creates:

```text
demo-video/audio/voiceover.en.wav
demo-video/audio/voiceover.uk.wav
```

## Recommended Audio

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

After generating or recording the WAV files, run:

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

Only send public demo narration text to online TTS tools.

Do not send secrets, private data, customer data, or real UAV operational data.

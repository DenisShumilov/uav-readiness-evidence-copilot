# Demo video / GIF placeholder

The README can later use one of these files:

```text
demo-video/output/uav-readiness-demo.en.mp4
demo-video/output/uav-readiness-demo.uk.mp4
demo-video/output/uav-readiness-demo.en.gif
demo-video/output/uav-readiness-demo.uk.gif
```

To create them:

1. Run `npm run demo:readiness`.
2. Run `npm run demo:video:check`.
3. If Playwright is installed, run `npm run demo:video:screenshots`.
4. If ffmpeg is available, use the instructions from `npm run demo:video:record`.
5. Add the final MP4/GIF to the README only after checking it shows static demo pages only.

No voice is generated automatically. Use `demo-video/voiceover.en.txt` or `demo-video/voiceover.uk.txt` for manual narration.

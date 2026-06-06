# TTS Bake-off

TTS means text-to-speech, or voice generated from written text.

Goal: choose a free, practical voiceover option for the portfolio MP4 demo.

## Recommendation Matrix

| TTS | UA quality | EN quality | Offline/Online | Needs key | Risk | Decision |
|---|---|---|---|---|---|---|
| Edge TTS | Good, Ukrainian voices available | Good, conversational voices available | Online | No | Sends public voiceover text to Microsoft speech service | Use for final MP4 |
| eSpeak NG | Robotic | Robotic | Offline | No | Low voice quality hurts portfolio demo | Reject for final, sample only |
| Windows SAPI | No Ukrainian voice found | Basic older English voice | Offline | No | English-only and less natural | Reject |
| Piper | Not installed or configured | Not installed or configured | Offline after model download | No | Needs voice model setup; Ukrainian quality not verified here | Later |
| RHVoice | Not found in local tooling or winget search | Not found in local tooling or winget search | Offline if installed | No | Setup path unclear in this environment | Later |
| Kokoro | Not installed | Not installed | Usually local after setup | No | Not available here; Ukrainian support not verified | Later |
| Chatterbox TTS | Not installed | Not installed | Usually local after setup | No | Not available here; Ukrainian support not verified | Later |

## Samples Created Locally

Samples are generated under:

```text
demo-video/audio/samples/
```

They are ignored by Git because they are generated audio files.

## Selected Voices

- Ukrainian: `uk-UA-PolinaNeural`
- English: `en-US-EmmaNeural`

Reason:

- clear enough for a portfolio demo;
- supports both target languages;
- works from CLI;
- no API key;
- no login;
- no private data is sent, only public demo narration text.

## Privacy Note

Edge TTS is online.

Only public demo voiceover text should be sent to it.

Do not use it for private data, customer data, secrets, or real operational UAV data.


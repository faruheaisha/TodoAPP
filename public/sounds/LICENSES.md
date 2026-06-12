# Sound Licenses — Asha Soundscape

All audio files in this directory are **procedurally generated** by
`scripts/generate-sounds.py` using Python + NumPy/SciPy.

They are original synthetic works authored by this project and released
under the same **MIT License** as the rest of the codebase.

No third-party samples, loops, or recordings are used.

---

| File | Description | Generation method |
|------|-------------|-------------------|
| `white.mp3`   | White noise           | Gaussian random noise, 0.5× gain |
| `rain.mp3`    | Rain                  | Pink noise (Voss-McCartney), lowpass @ 4 kHz, slow AM |
| `thunder.mp3` | Thunderstorm          | Pink rain + two low-freq rumble bursts (< 120 Hz) |
| `ocean.mp3`   | Ocean waves           | Pink noise bandpass 80–2500 Hz, 12-sec wave envelope |
| `forest.mp3`  | Forest / birds        | Lowpass wind + synthetic chirp bursts 2.8–5 kHz |
| `cafe.mp3`    | Café ambience         | Bandpass hum 300–2000 Hz + brief cutlery transients |
| `fire.mp3`    | Fireplace crackling   | Bandpass 200–3000 Hz + random crackle transients |
| `stream.mp3`  | Creek / stream        | Bandpass 400–5000 Hz shimmer + 0.3 Hz AM |

All files: 44100 Hz, mono, 96 kbps MP3, ~30-second seamless loop.

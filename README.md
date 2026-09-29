# AI risk field guide

A plain-English guide to the argument about AI and existential risk, for readers who know nothing about AI. It covers how the technology works, what went wrong at Hugging Face in summer 2026, who is saying what, and why. Correct as of 21 September 2026, with later additions noted in its diary.

Read it at https://peter-guillam123.github.io/ai-risk-field-guide/

Built by Chris Moran with Claude, an AI model made by Anthropic. The page's About section says what that means and what to distrust.

## What's here

- `index.html`, `css/`, `js/`: the guide. Plain HTML, CSS and JavaScript, with no build step and no dependencies.
  - `js/data.js`: every source, and the ten factions.
  - `js/content.js`: all other copy, and the data behind each plate.
  - `js/app.js`: the code that draws the page.
- `research/`: the four research passes behind the guide. Every claim carries a label saying how it was checked.
- `tools/`: checks and builds.
- `video/`: a 15-second film of plate 3, the boat that would not race, drawn by code.

## Run it

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Check it before any change goes out

```bash
node tools/check_refs.js
```

This fails if any citation lacks a source. To test every source link:

```bash
node tools/check_links.js
```

Some publishers block robots, so a 401 or 403 from Reuters or the New York Times is not a broken link.

## Publish it as a Claude artifact

```bash
python3 tools/build_artifact.py dist/ai-risk-field-guide.html
```

This packs the page into one self-contained file.

## Render the film

Needs Google Chrome, Python's Playwright, ffmpeg, and the local Kokoro voice at `~/tools/kokoro-tts`.

```bash
cd video && ./make_audio.sh && python3 render.py film.mp4 --audio mix.wav
```

Every frame is drawn from the clock, so the film comes out the same each time. The narration is a synthetic voice, made offline.

#!/bin/bash
# Rebuild the film's sound: narration (Kokoro, offline), sound design, then the mix.
# Usage: ./make_audio.sh   (VOICE=bm_george ./make_audio.sh for another voice)
# Writes mix.wav here; render with: python3 render.py film.mp4 --audio mix.wav
set -euo pipefail
cd "$(dirname "$0")"
VOICE="${VOICE:-bf_emma}"
AT=(400 6250 10450 12200)  # when each line starts, in ms; the captions in boat.html are timed to these
TMP="$(mktemp -d)"
python3 render.py x --events "$TMP/events.json" >/dev/null
python3 sound.py "$TMP/events.json" "$TMP/sfx.wav" >/dev/null
~/tools/kokoro-tts/speak --script narration.json --outdir "$TMP/vo" -v "$VOICE" -l en-gb >/dev/null
ffmpeg -y -loglevel error -i "$TMP/sfx.wav" -i "$TMP/vo/l1.wav" -i "$TMP/vo/l2.wav" -i "$TMP/vo/l3.wav" -i "$TMP/vo/l4.wav" \
  -filter_complex "[1]adelay=${AT[0]}|${AT[0]},volume=0.9[a];[2]adelay=${AT[1]}|${AT[1]},volume=0.9[b];[3]adelay=${AT[2]}|${AT[2]},volume=0.9[c];[4]adelay=${AT[3]}|${AT[3]},volume=0.9[d];[0][a][b][c][d]amix=inputs=5:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_rates=48000:channel_layouts=stereo" \
  -t 15 mix.wav
echo "wrote mix.wav ($VOICE)"; cat "$TMP/vo/durations.json"
rm -rf "$TMP"

#!/usr/bin/env python3
"""Sound design for boat.html, built from the animation's own event times.

Usage: python3 sound.py events.json sfx.wav
Water bed, engine, a rising tick for every point scored, the crash, fire,
and one low note under the last line. All synthesised; no samples.
"""
import json, sys, wave
import numpy as np

SR = 48000
ev = json.load(open(sys.argv[1]))
DUR = float(ev['duration']); M = ev['marks']
N = int(SR * DUR); T = np.arange(N) / SR
rng = np.random.default_rng(7)
out = np.zeros(N)

def add(sig, at, gain=1.0):
    n0 = int(at * SR); n1 = min(N, n0 + len(sig))
    if n0 < N: out[n0:n1] += sig[:n1 - n0] * gain

def env(t0, t1, attack, release):  # trapezoid envelope over the whole timeline
    e = np.clip((T - t0) / max(attack, 1e-3), 0, 1) * np.clip((t1 - T) / max(release, 1e-3), 0, 1)
    return e

def shape(x, lo=20, hi=20000, tilt=0.0):  # FFT band-pass with an optional 1/f^tilt slope
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    g = 1 / (1 + (lo / np.maximum(f, 1e-3)) ** 4) / (1 + (f / hi) ** 4)
    if tilt: g *= (np.maximum(f, 20) / 20.0) ** (-tilt)
    return np.fft.irfft(X * g, n=len(x))

def norm(x, peak): return x / (np.max(np.abs(x)) + 1e-9) * peak

# water: pink-ish noise, slowly breathing, gone before the last line
water = shape(rng.standard_normal(N), 50, 1400, tilt=0.5)
water = norm(water, 1) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.17 * T)) * env(0.0, 12.6, 1.4, 0.7)
out += water * 0.030

# engine: harmonics that climb with the laps
f0 = np.where(T < M['circ'], 56 + 16 * np.clip((T - M['launch']) / (M['circ'] - M['launch']), 0, 1),
              72 + 26 * np.clip((T - M['circ']) / 5.0, 0, 1))
ph = 2 * np.pi * np.cumsum(f0) / SR
eng = sum(np.sin(ph * k) / k for k in range(1, 7))
eng = shape(eng, 30, 420) * (1 + 0.12 * np.sin(2 * np.pi * 11 * T)) * env(M['launch'], 12.5, 0.7, 0.6)
out += norm(eng, 1) * 0.026

# launch: a short filtered rush
L = int(0.9 * SR); tt = np.arange(L) / SR
rush = shape(rng.standard_normal(L), 200, 3000) * np.sin(np.pi * np.clip(tt / 0.9, 0, 1)) ** 2
add(norm(rush, 1) * 0.05, M['launch'] - 0.1)

# a tick for every point, a quarter-tone higher each time
ticks = [e for e in ev['events'] if e['t'] < M['end']]
for i, e in enumerate(ticks):
    f = 520 * 2 ** (i / 24); L = int(0.4 * SR); tt = np.arange(L) / SR
    blip = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.10) + 0.3 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt / 0.04)
    blip[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    add(blip, e['t'], 0.14 if e['kind'] == 'mark' else 0.10)

# the crash: a thump, then fire crackling until the world fades
L = int(0.6 * SR); tt = np.arange(L) / SR
thump = np.sin(2 * np.pi * 64 * tt * (1 - 0.3 * tt)) * np.exp(-tt / 0.18) + shape(rng.standard_normal(L), 120, 2500) * np.exp(-tt / 0.05) * 0.5
add(norm(thump, 1) * 0.30, M['fire'] - 0.05)
crackle = np.zeros(N)
for t0 in np.sort(rng.uniform(M['fire'], 12.7, 260)):
    L = int(0.03 * SR); n0 = int(t0 * SR)
    burst = rng.standard_normal(L) * np.exp(-np.arange(L) / (0.006 * SR)) * rng.uniform(0.3, 1)
    crackle[n0:n0 + L] += burst[:max(0, min(L, N - n0))]
crackle = shape(crackle, 1200, 7000) * env(M['fire'], 12.7, 0.3, 0.6)
out += norm(crackle, 1) * 0.045

# one low note under the last line
L = int(3.2 * SR); tt = np.arange(L) / SR
note = (np.sin(2 * np.pi * 98 * tt) + 0.4 * np.sin(2 * np.pi * 196 * tt) + 0.15 * np.sin(2 * np.pi * 294 * tt)) * np.exp(-tt / 1.1)
note[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
add(norm(note, 1) * 0.16, M['end'] + 0.05)

out = np.clip(out, -0.98, 0.98)
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    st = np.repeat((out * 32767).astype(np.int16), 2)
    w.writeframes(st.tobytes())
print('peak dBFS', round(20 * np.log10(np.max(np.abs(out)) + 1e-9), 1), '| ticks', len(ticks))

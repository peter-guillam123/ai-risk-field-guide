#!/usr/bin/env python3
"""Render boat.html to an MP4, frame by frame, through the installed Chrome.

Usage: python3 render.py OUT.mp4 [--fps 60] [--audio mix.wav] [--events events.json]
Each frame is drawn by window.seek(t), so the result is the same on every run.
"""
import argparse, json, pathlib, subprocess, sys, time
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('out')
ap.add_argument('--fps', type=int, default=60)
ap.add_argument('--audio')
ap.add_argument('--events', help='write the score events and timing marks here as JSON, then exit')
a = ap.parse_args()

here = pathlib.Path(__file__).resolve().parent
url = (here / 'boat.html').as_uri() + '?render=1'

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    pg = b.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url)
    pg.wait_for_function('document.fonts.status === "loaded"')
    dur = pg.evaluate('window.DURATION')
    if a.events:
        pathlib.Path(a.events).write_text(json.dumps({'events': pg.evaluate('window.EVENTS'), 'marks': pg.evaluate('window.MARKS'), 'duration': dur}))
        print('events written'); b.close(); sys.exit(0)
    n = int(round(dur * a.fps))
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(a.fps), '-c:v', 'png', '-i', '-']
    if a.audio: cmd += ['-i', a.audio, '-c:a', 'aac', '-b:a', '192k', '-shortest']
    cmd += ['-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', a.out]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    for i in range(n):
        pg.evaluate('t => window.seek(t)', i / a.fps)
        ff.stdin.write(pg.screenshot(type='png'))
        if i % 120 == 0: print(f'frame {i}/{n}  {time.time() - t0:.0f}s', flush=True)
    ff.stdin.close(); ff.wait()
    b.close()
    print('errors:', errs or 'none'); print('wrote', a.out, 'in', f'{time.time() - t0:.0f}s')

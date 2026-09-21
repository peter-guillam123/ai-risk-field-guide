#!/usr/bin/env python3
"""Pack the guide into one self-contained file for publishing as a Claude Artifact.

The artifact host supplies its own <html>/<head>/<body>, so this emits only a
<title>, the Google Fonts link, one inlined <style>, the body markup and one
inlined <script> per source file. Usage: python3 tools/build_artifact.py OUT.html
"""
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'dist' / 'ai-risk-field-guide.html'
html = (root / 'index.html').read_text(encoding='utf-8')

title = re.search(r'<title>.*?</title>', html, re.S).group(0)
fonts = re.search(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]+>', html).group(0)
css = (root / 'css' / 'style.css').read_text(encoding='utf-8')
# The host has its own light/dark control and stamps data-theme itself.
css += '\n/* artifact build: the host provides the theme switch */\n.theme-btn { display: none; }\n'

body = re.search(r'<body>(.*)</body>', html, re.S).group(1)

def inline(m):
    js = (root / m.group(1)).read_text(encoding='utf-8')
    assert '</script' not in js.lower(), m.group(1) + ' contains a closing script tag'
    return '<script>\n' + js + '\n</script>'

body = re.sub(r'<script src="([^"]+)"></script>', inline, body)

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(title + '\n' + fonts + '\n<style>\n' + css + '</style>\n' + body.strip() + '\n', encoding='utf-8')
print(out, round(out.stat().st_size / 1024), 'KB')

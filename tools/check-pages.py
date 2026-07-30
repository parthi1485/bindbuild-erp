#!/usr/bin/env python3
"""Assert every generated page has balanced tags.

Unbalanced markup does not throw — the browser silently reparents everything
after the stray closer, which looks exactly like missing CSS. Cheap to check,
expensive to debug.
"""
import re, pathlib, sys

VOID = {'br','img','input','hr','meta','link','path','circle','rect','line',
        'polyline','polygon','use','stop','source','col','area','base','ellipse'}

def balance(html):
    body = re.search(r'<body>(.*)</body>', html, re.S)
    h = re.sub(r'<script.*?</script>', '', body.group(1) if body else html, flags=re.S)
    h = re.sub(r'<!--.*?-->', '', h, flags=re.S)
    stack, stray = [], 0
    for m in re.finditer(r'<(/?)([a-zA-Z][\w-]*)([^>]*?)(/?)>', h):
        closing, tag, _attrs, selfclose = m.groups()
        tag = tag.lower()
        if tag in VOID or selfclose == '/':
            continue
        if not closing:
            stack.append(tag)
        elif stack and stack[-1] == tag:
            stack.pop()
        elif tag in stack:
            while stack and stack[-1] != tag:
                stack.pop(); stray += 1
            if stack: stack.pop()
        else:
            stray += 1
    return len(stack), stray

bad = []
for f in sorted(pathlib.Path('.').glob('*.html')):
    if f.stem == 'index':
        continue
    unclosed, stray = balance(f.read_text())
    if unclosed or stray:
        bad.append((f.name, unclosed, stray))

if bad:
    for name, u, s in bad:
        print(f'BROKEN {name}: {u} unclosed, {s} stray closing tags')
    sys.exit(1)
print('all pages balanced')

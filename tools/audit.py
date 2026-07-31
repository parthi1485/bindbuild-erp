#!/usr/bin/env python3
"""Audit generated pages against the prototypes they came from.

Three questions:
  1. Did extraction lose any UI? (ids in the prototype's <main> but not in ours)
  2. Are controls wired? (ids in our page never referenced by its module)
  3. Is styling complete? (classes used with no matching selector)
"""
import re, pathlib, json, sys

UP   = pathlib.Path('/mnt/user-data/uploads')
ROOT = pathlib.Path('.')

PAGES = json.loads(pathlib.Path('tools/pages.json').read_text())

# ids that belong to the shell, injected at runtime, so absence is correct
SHELL_IDS = {'sidebar','hamburger','navToggle','scrim','themeToggle','profileBtn',
             'profileMenu','toasts','search','searchInput','newBtn','newMenu',
             'signOutBtn','avatarInitials','profileName','profileRole','menuName',
             'menuEmail','app','main','content'}

def ids_in_main(html):
    m = re.search(r'<main class="content"[^>]*>(.*?)</main>', html, re.S)
    body = m.group(1) if m else ''
    tail = re.search(r'</main>(.*?)</body>', html, re.S)
    if tail:
        body += tail.group(1)
    body = re.sub(r'<script.*?</script>', '', body, flags=re.S)
    return set(re.findall(r'id="([A-Za-z0-9_]+)"', body))

def ids_in_page(html):
    body = re.search(r'<body>(.*)</body>', html, re.S)
    b = re.sub(r'<script.*?</script>', '', body.group(1) if body else html, flags=re.S)
    return set(re.findall(r'id="([A-Za-z0-9_]+)"', b))

import json as _json
SHELL = set(_json.loads('''["sidebar","navToggle","themeToggle","search","searchInput",
"searchPop","newBtn","newMenu","notifBtn","notifCount","profileBtn","profileMenu",
"profileName","profileRole","avatarInitials","menuName","menuEmail","signOutBtn",
"storageFill"]'''))

rows, lost_total, dead_total, css_total, clash_total = [], 0, 0, 0, 0
for proto, slug in PAGES.items():
    p_html = (UP / proto).read_text()
    g_path = ROOT / f'{slug}.html'
    if not g_path.exists():
        rows.append((slug, 'MISSING PAGE', '', '', [])); continue
    g_html = g_path.read_text()
    js_path = ROOT / f'src/pages/{slug}.js'
    js = js_path.read_text() if js_path.exists() else ''

    lost = sorted(ids_in_main(p_html) - ids_in_page(g_html) - SHELL_IDS)

    # controls present but never mentioned in the module
    interactive = set()
    for m in re.finditer(r'<(button|input|select|textarea|form|a)\b[^>]*id="([A-Za-z0-9_]+)"', g_html):
        interactive.add(m.group(2))
    dead = sorted(i for i in interactive - SHELL_IDS if i not in js)

    used = set()
    for m in re.findall(r'class="([^"]+)"', g_html):
        used.update(m.split())
    css = (ROOT/'src/styles/app.css').read_text() + (ROOT/f'src/styles/{slug}.css').read_text()
    defined = set(re.findall(r'\.([a-zA-Z][\w-]*)', css))
    undef = sorted(c for c in used if c not in defined)

    # a page id that matches one the shell injects is a silent dead handler:
    # the shell mounts first, so querySelector finds the topbar element
    main = re.search(r'<main class="content".*?</main>', g_html, re.S)
    page_ids = set(re.findall(r'id="([A-Za-z0-9_]+)"', main.group(0))) if main else set()
    clash = sorted(page_ids & SHELL)

    lost_total += len(lost); dead_total += len(dead)
    css_total += len(undef); clash_total += len(clash)
    rows.append((slug, lost, dead, undef, clash))

print(f'{"page":16s} {"lostUI":>7s} {"deadCtrl":>9s} {"noCSS":>6s} {"idClash":>8s}   detail')
print('-'*100)
for slug, lost, dead, undef, clash in rows:
    if lost == 'MISSING PAGE':
        print(f'{slug:16s}   MISSING PAGE'); continue
    flag = '' if not (lost or dead or undef or clash) else '  <-'
    det = []
    if lost: det.append('lost=' + ','.join(lost[:4]))
    if dead: det.append('dead=' + ','.join(dead[:5]))
    if undef: det.append('css=' + ','.join(undef[:3]))
    if clash: det.append('CLASH=' + ','.join(clash))
    print(f'{slug:16s} {len(lost):7d} {len(dead):9d} {len(undef):6d} {len(clash):8d}   {" ".join(det)[:56]}{flag}')
print('-'*100)
print(f'{"TOTAL":16s} {lost_total:7d} {dead_total:9d} {css_total:6d} {clash_total:8d}')

#!/usr/bin/env python3
"""
Convert a Bind Build prototype page into a Vite MPA page.

  - shared layers (fonts/tokens/reset/shell) are dropped -> they live in app.css
  - page-specific CSS  -> src/styles/<slug>.css
  - <main class="content"> markup -> <slug>.html
  - shell is mounted at runtime by src/lib/shell.js
"""
import re, sys, pathlib

UP = pathlib.Path('/mnt/user-data/uploads')
ROOT = pathlib.Path('/home/claude/bindbuild')

SHELL_SELECTORS = ('.sidebar', 'body.nav-open', '.hamburger', '.topbar',
                   '.search', '.profile__meta', '.crumbs', '.btn-new',
                   '.toast-region', '.toast{', 'prefers-reduced-motion')

def page_css(src: str) -> str:
    """Everything in <style> from the '4 · CONTENT' marker onward."""
    style = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
    m = re.search(r'\n\s*\d+ · CONTENT', style)
    if not m:
        # some pages label the section differently; fall back to after the shell block
        m = re.search(r'\n\s*\d+ · (?:PAGE|MAIN|BODY)', style)
    css = style[m.start():] if m else style

    # strip @media rules that only touch shell chrome (already in app.css)
    out, i = [], 0
    for blk in re.split(r'(@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\})', css):
        if blk.startswith('@media'):
            inner = blk[blk.index('{') + 1:]
            hits = sum(inner.count(s) for s in SHELL_SELECTORS)
            rules = inner.count('{')
            if rules and hits >= rules - 1:
                continue           # purely shell -> drop
        out.append(blk)
    return ''.join(out)

def content(src: str) -> str:
    m = re.search(r'<main class="content"[^>]*>(.*?)</main>', src, re.S)
    body = m.group(1) if m else ''
    return re.sub(r'<script.*?</script>', '', body, flags=re.S)

def after_main(src: str) -> str:
    """Modals and dialogs live as siblings of <main>, not inside it. Without
    this they get silently dropped and every 'add row' button does nothing.
    Nested divs make regex matching of individual modals unreliable, so keep
    the whole tail and drop only what the page template already provides."""
    m = re.search(r'</main>(.*?)</body>', src, re.S)
    if not m:
        return ''
    tail = re.sub(r'<script.*?</script>', '', m.group(1), flags=re.S)
    # the template emits its own toast region and closes .main / .app itself
    tail = re.sub(r'<div[^>]*class="toast-region"[^>]*>\s*</div>', '', tail)
    tail = re.sub(r'<div[^>]*id="toasts"[^>]*>\s*</div>', '', tail)
    tail = re.sub(r'^\s*(</div>\s*)+', '', tail)        # stray closers for .main/.app
    return tail.strip()

def build(proto, slug, title, route, extra_head=''):
    src = (UP / proto).read_text()
    (ROOT / f'src/styles/{slug}.css').write_text(page_css(src))

    html = f'''<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title} · Bind Build ERP</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/src/styles/app.css" />
<link rel="stylesheet" href="/src/styles/{slug}.css" />
{extra_head}
<script>
  (function(){{
    var s=localStorage.getItem('bindbuild.theme');
    var l=window.matchMedia('(prefers-color-scheme: light)').matches;
    document.documentElement.setAttribute('data-theme', s || (l?'light':'dark'));
  }})();
</script>
</head>
<body>
<div class="app" id="app">
  <!-- sidebar injected by shell.js -->
  <div class="scrim" id="scrim"></div>
  <div class="main" id="main">
    <!-- topbar injected by shell.js -->
    <main class="content" id="content">
{content(src)}
    </main>
  </div>
{after_main(src)}
</div>
<div class="toast-region" aria-live="polite"></div>
<script type="module" src="/src/pages/{slug}.js"></script>
</body>
</html>
'''
    (ROOT / f'{slug}.html').write_text(html)
    print(f'{slug:14s} html={len(html):>6}B  css={(ROOT/f"src/styles/{slug}.css").stat().st_size:>6}B')

if __name__ == '__main__':
    build(*sys.argv[1:])

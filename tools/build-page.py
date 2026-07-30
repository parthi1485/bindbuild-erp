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

def _rules(css: str):
    """Split CSS into top-level chunks by brace matching. Regex cannot do this
    because @media blocks nest.

    Statement at-rules (@import, @charset) end in a semicolon and carry no
    braces, so a naive brace matcher glues them onto the front of the next
    rule. That made every page's @import + :root look unique and defeated
    deduplication. Pull them out first."""
    out, buf, depth = [], [], 0
    AT_STMT = r'''@(?:import|charset)\s*(?:url\([^)]*\)|"[^"]*"|'[^']*'|[^;{()]*)[^;{]*;'''
    for stmt in re.findall(AT_STMT, css):
        out.append(stmt.strip())
    css = re.sub(AT_STMT, '', css)
    for ch in css:
        buf.append(ch)
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                out.append(''.join(buf).strip())
                buf = []
    tail = ''.join(buf).strip()
    if tail:
        out.append(tail)
    return [r for r in out if r]

def _strip_comments(css: str) -> str:
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)

def _norm(rule: str) -> str:
    """Comments must go before comparing. The brace splitter attaches any
    leading /* section header */ to the rule that follows it, so two identical
    rules under different headers would otherwise never match."""
    return re.sub(r'\s+', ' ', _strip_comments(rule)).strip()

def _root_tokens(css: str) -> dict:
    m = re.search(r':root\s*\{(.*?)\}', _strip_comments(css), re.S)
    if not m:
        return {}
    return {k: v.strip() for k, v in re.findall(r'(--[\w-]+)\s*:\s*([^;]+)', m.group(1))}

def page_css(src: str, shared: str) -> str:
    """Page-specific CSS only.

    Prototype pages are inconsistent: some have one <style> block with a
    numbered "N . CONTENT" marker, others have two blocks and no markers.
    Reading only the first block silently produced page files that duplicated
    the shared design system and contained none of the page's own rules.

    So: concatenate every block, then drop any top-level rule that already
    exists in app.css."""
    blocks = re.findall(r'<style[^>]*>(.*?)</style>', src, re.S)
    if not blocks:
        return ''
    css = _strip_comments('\n'.join(blocks))

    shared_set = {_norm(r) for r in _rules(_strip_comments(shared))}
    kept = [r for r in _rules(css) if _norm(r) not in shared_set]

    # a purely shell-level @media block is already covered by app.css
    def shell_only(rule):
        if not rule.startswith('@media'):
            return False
        inner = rule[rule.index('{') + 1:]
        hits = sum(inner.count(sel) for sel in SHELL_SELECTORS)
        n = inner.count('{')
        return bool(n) and hits >= n - 1

    kept = [r for r in kept if not shell_only(r)]

    # :root differs per page by only a token or two. Emitting the whole block
    # duplicates ~33 tokens AND overrides app.css, which would silently defeat
    # editing a token in one place. Emit just the delta.
    shared_tokens = _root_tokens(shared)
    out = []
    for r in kept:
        if not re.match(r'^\s*:root\s*\{', r):
            out.append(r)
            continue
        mine = _root_tokens(r)
        delta = {k: v for k, v in mine.items()
                 if k not in shared_tokens or shared_tokens[k] != v}
        if delta:
            body = ''.join(f'{k}:{v};' for k, v in delta.items())
            out.append(f'/* page-specific tokens only; the rest live in app.css */\n:root{{{body}}}')
    return '\n'.join(out) + '\n'

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
    shared = (ROOT / 'src/styles/app.css').read_text()
    (ROOT / f'src/styles/{slug}.css').write_text(page_css(src, shared))

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

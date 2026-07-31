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

SHELL_IDS = {
    'sidebar','navToggle','themeToggle','search','searchInput','searchPop',
    'newBtn','newMenu','notifBtn','notifCount','profileBtn','profileMenu',
    'profileName','profileRole','avatarInitials','menuName','menuEmail',
    'signOutBtn','storageFill'
}

def derust_ids(html: str, slug: str):
    """Rename page ids that collide with ones the shell injects.

    The shell mounts its topbar before the page content, so
    document.querySelector('#newBtn') finds the TOPBAR button, not the page's.
    A page handler bound to that id silently never fires - which is exactly
    how "New project" stopped working. Renaming at generation time means no
    page module has to know the shell's id list.
    """
    renamed = {}
    for sid in SHELL_IDS:
        if f'id="{sid}"' not in html:
            continue
        new = 'pg' + sid[0].upper() + sid[1:]
        html = html.replace(f'id="{sid}"', f'id="{new}"')
        html = html.replace(f'for="{sid}"', f'for="{new}"')
        html = html.replace(f'aria-controls="{sid}"', f'aria-controls="{new}"')
        html = html.replace(f'aria-labelledby="{sid}"', f'aria-labelledby="{new}"')
        renamed[sid] = new
    if renamed:
        print(f'    {slug}: renamed clashing ids -> ' +
              ', '.join(f'{k}=>{v}' for k, v in renamed.items()))
    return html

def _close_index(html: str, open_end: int) -> int:
    """Index of the tag that closes the element whose opening tag ended at
    open_end. Brace-style depth tracking over div-ish tags."""
    depth = 1
    for m in re.finditer(r'<(/?)(div|main|section|aside|header|footer)\b[^>]*?(/?)>',
                         html[open_end:]):
        if m.group(3) == '/':
            continue
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return open_end + m.start()
    return len(html)

def content(src: str) -> str:
    """The page's own content.

    Most prototypes use <main class="content">. The AI assistant has no <main>
    at all — its chat sits directly inside <div class="main"> after the topbar.
    Assuming <main> silently produced an empty page, so fall back to the
    column wrapper and drop the topbar from it.
    """
    m = re.search(r'<main[^>]*class="[^"]*\bcontent\b[^"]*"[^>]*>', src)
    if m:
        end = _close_index(src, m.end())
        body = src[m.end():end]
    else:
        col = re.search(r'<div[^>]*class="[^"]*\bmain\b[^"]*"[^>]*>', src)
        if not col:
            return ''
        end = _close_index(src, col.end())
        body = src[col.end():end]
        # the shell supplies its own topbar
        head = re.search(r'<header[^>]*class="[^"]*\btopbar\b[^"]*"[^>]*>', body)
        if head:
            body = body[_close_index(body, head.end()) + len('</header>'):]

    return re.sub(r'<script.*?</script>', '', body, flags=re.S)

VOID_TAGS = {'br','img','input','hr','meta','link','path','circle','rect','line',
             'polyline','polygon','use','stop','source','col','area','base','ellipse'}

def after_main(src: str):
    """Split whatever follows </main> into (inside_main, outside_app).

    The prototype closes its own wrappers:

        </main>
        <footer>...</footer>     <- still inside .main
        </div>                   <- closes .main
        </div>                   <- closes .app
        <div class="modal">...   <- outside .app

    The page template writes those two closers itself, so emitting the
    prototype's copies too produced two stray </div> tags. The browser closed
    .content and .main early and hoisted the rest of the page out of the
    layout containers, which silently killed every grid and card rule.

    Position-based stripping does not work because the footer comes first, so
    this walks the tail tracking depth and treats each unmatched closer as the
    boundary of a wrapper the template already owns.
    """
    m = re.search(r'</main>(.*?)</body>', src, re.S)
    if not m:
        # no <main>: anything after the .main column closes is outside-app markup
        col = re.search(r'<div[^>]*class="[^"]*\bmain\b[^"]*"[^>]*>', src)
        if not col:
            return '', ''
        end = _close_index(src, col.end())
        rest = src[end:]
        rest = rest[:rest.find('</body>')] if '</body>' in rest else rest
        tail = re.sub(r'<script.*?</script>', '', rest, flags=re.S)
        tail = re.sub(r'^\s*(</div>\s*)+', '', tail)
        tail = re.sub(r'<div[^>]*class="toast-region"[^>]*>\s*</div>', '', tail)
        tail = re.sub(r'<div[^>]*id="toasts"[^>]*>\s*</div>', '', tail)
        return '', tail.strip()
    tail = re.sub(r'<script.*?</script>', '', m.group(1), flags=re.S)

    depth, split_at = 0, None
    for tok in re.finditer(r'<(/?)([a-zA-Z][\w-]*)([^>]*?)(/?)>', tail):
        closing, tag, _attrs, selfclose = tok.groups()
        if tag.lower() in VOID_TAGS or selfclose == '/':
            continue
        if not closing:
            depth += 1
        else:
            depth -= 1
            if depth < 0:                 # a wrapper the template already closes
                depth = 0
                split_at = tok.end()      # keep moving; last one wins

    if split_at is None:
        return tail.strip(), ''

    inside  = tail[:split_at]
    outside = tail[split_at:]
    # drop the unmatched closers themselves from the part kept inside
    inside = re.sub(r'(\s*</div>\s*)+$', '', inside)

    # the template emits its own toast region
    outside = re.sub(r'<div[^>]*class="toast-region"[^>]*>\s*</div>', '', outside)
    outside = re.sub(r'<div[^>]*id="toasts"[^>]*>\s*</div>', '', outside)
    return inside.strip(), outside.strip()

def build(proto, slug, title, route, extra_head=''):
    src = (UP / proto).read_text()
    inside_main, outside_app = after_main(src)
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
{inside_main}
  </div>
</div>
{outside_app}
<div class="toast-region" aria-live="polite"></div>
<script type="module" src="/src/pages/{slug}.js"></script>
</body>
</html>
'''
    html = derust_ids(html, slug)
    (ROOT / f'{slug}.html').write_text(html)
    print(f'{slug:14s} html={len(html):>6}B  css={(ROOT/f"src/styles/{slug}.css").stat().st_size:>6}B')

if __name__ == '__main__':
    build(*sys.argv[1:])

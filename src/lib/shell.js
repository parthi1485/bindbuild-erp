import { SIDEBAR_HTML, TOPBAR_HTML } from './shell-template.js';
import { requireAuth, signOut } from './auth.js';
import { initials, toast } from './ui.js';
import { supabase } from './supabase.js';

/* Routes that have a real page. Everything else in the nav is still a
   prototype — add the slug here as each page gets converted. */
const BUILT = new Set([
  'dashboard', 'analytics', 'crm', 'clients', 'sales',
  'projects', 'design', 'construction', 'site-visits',
  'procurement', 'inventory', 'finance',
  'hr', 'people', 'documents', 'calendar', 'meetings',
  'client-portal', 'vendor-portal', 'settings'
]);

/* ---------- theme (runs before paint to avoid a flash) ---------- */
export function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem('bindbuild.theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  root.setAttribute('data-theme', saved || (prefersLight ? 'light' : 'dark'));
}

function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('bindbuild.theme', next);
}

/* ---------- dropdown plumbing ---------- */
function wireMenu(btnId, menuId) {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', () => {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });
  menu.addEventListener('click', e => e.stopPropagation());
}

/**
 * Mount the app shell.
 * @param {object} o
 * @param {string} o.route  - data-route slug of the active nav item
 * @param {string} o.title  - breadcrumb leaf
 * @returns identity object, or null if the guard redirected
 */
export async function mountShell({ route, title }) {
  const user = await requireAuth();
  if (!user) return null;

  const app  = document.getElementById('app');
  const col  = document.getElementById('main');

  app.insertAdjacentHTML('afterbegin', SIDEBAR_HTML);
  col.insertAdjacentHTML('afterbegin', TOPBAR_HTML);

  document.getElementById('scrim')?.addEventListener('click', () => {
    document.body.classList.remove('nav-open');
  });

  /* active nav */
  const active = document.querySelector(`.nav-item[data-route="${route}"]`);
  if (active) {
    active.classList.add('is-active');
    active.setAttribute('aria-current', 'page');
  }

  /* breadcrumb */
  const here = document.querySelector('.crumbs .here');
  if (here && title) here.textContent = title;
  const homeLink = document.querySelector('.crumbs a');
  if (homeLink) homeLink.setAttribute('href', '/dashboard.html');

  /* real identity */
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('avatarInitials', initials(user.name));
  set('profileName', user.name);
  set('profileRole', user.title);
  set('menuName', user.name);
  set('menuEmail', user.email);

  /* controls */
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('navToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('nav-open');
  });
  document.getElementById('signOutBtn')?.addEventListener('click', signOut);
  wireMenu('newBtn', 'newMenu');
  wireMenu('profileBtn', 'profileMenu');

  /* ⌘K / Ctrl-K focuses search */
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.getElementById('searchInput')?.focus();
    }
    if (e.key === 'Escape') document.body.classList.remove('nav-open');
  });

  /* Pages not yet converted from the prototype would 404. Say so instead. */
  document.querySelectorAll('.nav-item[data-route]').forEach(a => {
    if (BUILT.has(a.dataset.route)) return;
    a.classList.add('is-pending');
    a.addEventListener('click', e => {
      e.preventDefault();
      toast(`${a.dataset.nav || 'That module'} isn't wired up yet`, 'err');
      document.body.classList.remove('nav-open');
    });
  });

  /* live nav counters straight off the database */
  paintCounts();

  return user;
}

/* The prototype hardcoded nav counts (Projects 12, Procurement 3). A number
   that lies is worse than no number, so each badge is either real or hidden. */
async function paintCounts() {
  const head = { count: 'exact', head: true };

  const [leads, projects, pos] = await Promise.all([
    supabase.from('leads').select('id', head).not('stage_key', 'in', '("won","lost")'),
    supabase.from('projects').select('id', head).eq('status', 'active'),
    supabase.from('purchase_orders').select('id', head).eq('status', 'quoted')
  ]);

  const set = (route, res) => {
    const badge = document.querySelector(`.nav-item[data-route="${route}"] .nav-item__count`);
    if (!badge) return;
    const n = res?.error ? null : res?.count;
    if (n) { badge.textContent = String(n); badge.hidden = false; }
    else   { badge.textContent = ''; badge.hidden = true; }
  };

  set('crm', leads);
  set('projects', projects);
  set('procurement', pos);

  /* any remaining hardcoded badge is prototype fiction — clear it */
  document.querySelectorAll('.nav-item .nav-item__count').forEach(b => {
    if (!b.textContent.trim()) b.hidden = true;
  });
}

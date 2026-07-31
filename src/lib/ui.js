/* Formatting + feedback helpers. Indian conventions throughout. */

/** 1250000 -> "₹12.5 L" · 32000000 -> "₹3.2 Cr" */
export function inr(n, { sign = true } = {}) {
  const v = Number(n) || 0;
  const p = sign ? '₹' : '';
  if (Math.abs(v) >= 1e7) return `${p}${(v / 1e7).toFixed(2).replace(/\.00$/,'')} Cr`;
  if (Math.abs(v) >= 1e5) return `${p}${(v / 1e5).toFixed(1).replace(/\.0$/,'')} L`;
  return p + v.toLocaleString('en-IN');
}

/** Value already expressed in lakhs (as the prototype stores budget). */
export const lakh = n => `₹${(Number(n) || 0).toLocaleString('en-IN')} L`;

export function daysAgo(ts) {
  if (!ts) return '—';
  const d = Math.floor((Date.now() - new Date(ts)) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return '1 day';
  return `${d} days`;
}

export const fmtDate = ts => ts
  ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

export const initials = name => (name || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '··';

export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/* ---- toasts (reuses the prototype's .toast-region markup) ---- */
export function toast(msg, kind = 'ok') {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  const t = document.createElement('div');
  t.className = `toast toast--${kind}`;
  t.textContent = msg;
  region.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3200);
}

/* Database-enforced rules surface as raw Postgres errors. Translate the ones
   users will actually hit into something actionable. */
const FRIENDLY = [
  [/has been issued and cannot be edited/i,
   'This invoice has been issued. Raise a credit note to correct it.'],
  [/its line items cannot be changed/i,
   'This invoice has been issued, so its line items are locked. Raise a credit note.'],
  [/exceeds the invoice value/i,
   'That would credit more than the invoice is worth.'],
  [/permission denied|violates row-level security/i,
   'You do not have permission to do that.'],
  [/duplicate key value/i,
   'That already exists — check for a duplicate.'],
  [/Only an owner or admin/i,
   'Only an owner or admin can do that.']
];

export const fail = e => {
  const raw = e?.message || String(e);
  const hit = FRIENDLY.find(([re]) => re.test(raw));
  toast(hit ? hit[1] : raw, 'err');
};

/* ---- modals -------------------------------------------------
   The prototype ships designed dialogs for every create/edit flow.
   Using window.prompt instead works, but throws away the design and
   every field it defines (type, options, validation). These helpers
   drive the real markup. */
export function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return null;
  m.classList.add('is-open', 'open');
  m.removeAttribute('hidden');
  m.querySelector('input,select,textarea')?.focus();
  return m;
}

export function closeModal(id) {
  const m = typeof id === 'string' ? document.getElementById(id) : id;
  m?.classList.remove('is-open', 'open');
}

export function closeAllModals() {
  document.querySelectorAll('.modal,.modal-root').forEach(m =>
    m.classList.remove('is-open', 'open'));
}

/** Wire every [data-close] and Escape once per page. */
export function wireModalDismiss() {
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeAllModals();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
  });
}

export const val = id => document.getElementById(id)?.value?.trim() ?? '';
export const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v ?? ''; };

/** Fill a <select> from rows, preserving any placeholder first option. */
export function fillSelect(id, rows, valueKey = 'id', labelKey = 'name') {
  const s = document.getElementById(id);
  if (!s) return;
  const keep = s.querySelector('option[value=""]')?.outerHTML ?? '';
  s.innerHTML = keep + rows.map(r =>
    `<option value="${r[valueKey]}">${String(r[labelKey] ?? '').replace(/[<>&"]/g, c =>
      ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))}</option>`).join('');
}

/* ---- containers -------------------------------------------------
   Some prototype pages are static layouts with hardcoded content and no
   hooks — the two portals especially. Binding to an id that does not exist
   fails silently and the section renders nowhere. This creates the container
   if it is missing, styled with the page's own card classes so it looks
   native rather than bolted on. */
export function ensureHost(id, { parent = '#content', tag = 'ul', title = '', cls = '' } = {}) {
  let el = document.getElementById(id);
  if (el) return el;

  const host = document.querySelector(parent) || document.getElementById('content');
  if (!host) return null;

  const wrap = document.createElement('section');
  wrap.className = 'card card__pad';
  wrap.style.marginTop = 'var(--s-5, 18px)';
  if (title) {
    const h = document.createElement('h3');
    h.className = 'card__title';
    h.textContent = title;
    wrap.appendChild(h);
  }
  el = document.createElement(tag);
  el.id = id;
  if (cls) el.className = cls;
  wrap.appendChild(el);
  host.appendChild(wrap);
  return el;
}

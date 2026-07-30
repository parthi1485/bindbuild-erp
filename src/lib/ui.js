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

export const fail = e => toast(e?.message || String(e), 'err');

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

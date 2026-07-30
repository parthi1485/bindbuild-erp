import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'finance', title: 'Expenses' });
if (!user) throw new Error('redirecting');

const isAccounts = ['owner', 'admin', 'accounts'].some(r => user.roles.includes(r));

const money = v => '₹' + Math.round(Number(v) || 0).toLocaleString('en-IN');
const moneyS = v => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
  return money(n);
};
const cssVar = c => c.startsWith('var(')
  ? getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim() || '#5a8dee'
  : c;

const CAT = {
  materials: ['Materials', 'var(--accent)'], labour: ['Labour', 'var(--violet)'],
  subcontractor: ['Subcontractors', '#38bdf8'], site: ['Site expenses', 'var(--warning)'],
  equipment: ['Equipment', '#f59e0b'], overheads: ['Overheads', 'var(--success)'],
  statutory: ['Statutory', 'var(--danger)'], other: ['Other', 'var(--text-3)']
};
const MODE = {
  neft: 'Bank transfer', rtgs: 'RTGS', imps: 'IMPS', upi: 'UPI',
  cheque: 'Cheque', cash: 'Cash', card: 'Card', other: 'Other'
};
const ST = { pending: 'Pending', approved: 'Approved', paid: 'Paid', rejected: 'Rejected' };

let EX = [], PROJECTS = [];
let fProject = '', fStatus = '', fCat = '', q = '';

async function load() {
  const [eRes, pRes] = await Promise.all([
    supabase.from('expenses')
      .select('*, projects(code,name), vendors(name)')
      .order('expense_date', { ascending: false }),
    supabase.from('projects').select('id,code,name').order('name')
  ]);

  if (eRes.error) return fail(eRes.error);
  EX = eRes.data ?? [];
  PROJECTS = pRes.data ?? [];

  fillSelects();
  render();
}

function fillSelects() {
  const ps = $('#projSel');
  if (ps && ps.options.length <= 1) PROJECTS.forEach(p => ps.add(new Option(`${p.code} · ${p.name}`, p.id)));

  const emProj = $('#emProj');
  if (emProj && emProj.options.length <= 1) PROJECTS.forEach(p => emProj.add(new Option(`${p.code} · ${p.name}`, p.id)));

  const emCat = $('#emCat');
  if (emCat && emCat.options.length <= 1) Object.entries(CAT).forEach(([k, v]) => emCat.add(new Option(v[0], k)));

  const emMode = $('#emMode');
  if (emMode && emMode.options.length <= 1) Object.entries(MODE).forEach(([k, v]) => emMode.add(new Option(v, k)));
}

function passes(e) {
  if (fProject && e.project_id !== fProject) return false;
  if (fStatus && e.status !== fStatus) return false;
  if (fCat && e.category !== fCat) return false;
  if (q && !`${e.title} ${e.memo} ${e.vendors?.name || ''}`.toLowerCase().includes(q)) return false;
  return true;
}

function render() {
  const rows = EX.filter(passes);
  const body = $('#exBody');

  if (body) {
    body.innerHTML = rows.length ? rows.map(e => `
      <tr data-id="${e.id}">
        <td>
          <div class="ex-t">${esc(e.title)}</div>
          <div class="ex-m">${esc(e.memo || e.vendors?.name || '')}</div>
        </td>
        <td><span class="cchip"><span class="cdot" style="background:${cssVar((CAT[e.category] || CAT.other)[1])}"></span>${esc((CAT[e.category] || CAT.other)[0])}</span></td>
        <td>${esc(e.projects ? e.projects.code : '—')}</td>
        <td>${esc(MODE[e.payment_mode] || e.payment_mode)}</td>
        <td>${fmtDate(e.expense_date)}</td>
        <td><span class="pill ${e.status}"><span class="pill__dot"></span>${ST[e.status]}</span></td>
        <td class="num">${money(e.amount)}</td>
      </tr>`).join('')
    : `<tr><td colspan="7" class="tbl__empty">No expenses match these filters.</td></tr>`;
  }

  const count = $('#exCount');
  if (count) count.textContent = `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`;

  /* approvals */
  const pending = EX.filter(e => e.status === 'pending');
  const el = $('#apprs');
  if (el) {
    el.innerHTML = pending.length
      ? pending.map(e => `<li class="appr" data-id="${e.id}">
          <span class="appr__body">
            <span class="appr__no">${esc(e.title)}</span>
            <span class="appr__meta">${money(e.amount)} · ${esc(e.memo || '')}</span>
          </span>
          ${isAccounts ? `<span class="appr__acts">
            <button class="appr__ok" data-approve="${e.id}">Approve</button>
            <button class="appr__no" data-reject="${e.id}">Reject</button>
          </span>` : '<span class="appr__meta">awaiting accounts</span>'}
        </li>`).join('')
      : '<li class="appr"><span class="appr__body">Nothing awaiting approval</span></li>';
  }

  const tag = $('#apprTag');
  if (tag) { tag.textContent = String(pending.length); tag.hidden = !pending.length; }

  const setId = (id, v) => { const x = document.getElementById(id); if (x) x.textContent = v; };
  setId('kPend', moneyS(pending.reduce((a, e) => a + Number(e.amount || 0), 0)));
  setId('kPendN', String(pending.length));

  breakdown('#cat', 'category', CAT);
  breakdown('#modes', 'payment_mode', null);
}

function breakdown(sel, field, dict) {
  const el = $(sel);
  if (!el) return;
  const paid = EX.filter(e => e.status === 'paid');
  const map = new Map();
  paid.forEach(e => map.set(e[field], (map.get(e[field]) || 0) + Number(e.amount || 0)));
  const rows = [...map].sort((a, b) => b[1] - a[1]);
  const top = Math.max(...rows.map(r => r[1]), 1);

  const PALETTE = ['var(--accent)', 'var(--warning)', '#38bdf8', 'var(--violet)', 'var(--success)', 'var(--danger)'];

  el.innerHTML = rows.length
    ? rows.map(([k, v], i) => {
        const label = dict ? (dict[k] || dict.other)[0] : (MODE[k] || k);
        const color = dict ? (dict[k] || dict.other)[1] : PALETTE[i % PALETTE.length];
        return `<div class="crow-wrap">
          <div class="crow__top">
            <span class="crow__nm"><span class="cdot" style="background:${cssVar(color)}"></span>${esc(label)}</span>
            <span class="crow__amt">${moneyS(v)}</span>
          </div>
          <div class="bar"><div class="bar__fill" style="width:${Math.round(v / top * 100)}%;background:${cssVar(color)}"></div></div>
        </div>`;
      }).join('')
    : '<div class="t-empty">No paid expenses yet</div>';
}

/* ---------------------------------------------------------------
   approve / reject / mark paid
--------------------------------------------------------------- */
async function setStatus(id, status) {
  const patch = { status, approved_by: user.id, approved_at: new Date().toISOString() };
  if (status === 'paid') patch.paid_on = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from('expenses').update(patch).eq('id', id);
  if (error) return fail(error);
  toast(`Expense ${status}`);
  await load();
}

document.addEventListener('click', async e => {
  const ap = e.target.closest('[data-approve]');
  if (ap) return setStatus(ap.dataset.approve, 'approved');

  const rj = e.target.closest('[data-reject]');
  if (rj) return setStatus(rj.dataset.reject, 'rejected');
});

/* an approved expense becomes paid on double-click, accounts only */
document.addEventListener('dblclick', async e => {
  const row = e.target.closest('#exBody tr[data-id]');
  if (!row || !isAccounts) return;
  const ex = EX.find(x => x.id === row.dataset.id);
  if (!ex || ex.status === 'paid') return;
  if (!confirm(`Mark "${ex.title}" as paid?`)) return;
  await setStatus(ex.id, 'paid');
});

/* ---------------------------------------------------------------
   new expense
--------------------------------------------------------------- */
const openModal = () => {
  const m = $('#exModal');
  if (!m) return;
  const d = $('#emDate');
  if (d) d.value = new Date().toISOString().slice(0, 10);
  const t = $('#emTitle');
  if (t) t.textContent = 'New expense';
  m.classList.add('is-open');
  $('#emT')?.focus();
};
const closeModal = () => $('#exModal')?.classList.remove('is-open');

$('#addBtn')?.addEventListener('click', openModal);
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });

$('#emSave')?.addEventListener('click', async () => {
  const title = ($('#emT')?.value || '').trim();
  const amount = Number($('#emAmt')?.value);

  if (!title) return toast('Give the expense a title', 'err');
  if (!Number.isFinite(amount) || amount <= 0) return toast('Enter a valid amount', 'err');

  const { error } = await supabase.from('expenses').insert({
    title,
    amount,
    category: $('#emCat')?.value || 'materials',
    project_id: $('#emProj')?.value || null,
    payment_mode: $('#emMode')?.value || 'neft',
    expense_date: $('#emDate')?.value || new Date().toISOString().slice(0, 10),
    requested_by: user.id,          // RLS requires this to be the caller
    status: 'pending'
  });

  if (error) return fail(error);
  closeModal();
  toast('Expense raised for approval');
  await load();
});

/* ---------------------------------------------------------------
   filters
--------------------------------------------------------------- */
$('#projSel')?.addEventListener('change', e => { fProject = e.target.value; render(); });
$('#statSel')?.addEventListener('change', e => { fStatus = e.target.value; render(); });
$('#exSearch')?.addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
$('#catSeg')?.addEventListener('click', e => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  fCat = b.dataset.cat === 'all' ? '' : b.dataset.cat;
  $$('#catSeg [data-cat]').forEach(x => x.classList.toggle('is-on', x === b));
  render();
});

await load();

import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, initials } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'procurement', title: 'Procurement' });
if (!user) throw new Error('redirecting');

/* PO totals are in rupees */
const money = v => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e7) return '₹' + (n / 1e7).toFixed(2).replace(/\.00$/, '') + 'Cr';
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(2).replace(/\.00$/, '') + 'L';
  return '₹' + n.toLocaleString('en-IN');
};

const ST_LABEL = {
  quoted: 'Quoted', approved: 'Approved', ordered: 'Ordered',
  partly_delivered: 'Part delivered', delivered: 'Delivered', cancelled: 'Cancelled'
};
const ST_CLASS = {
  quoted: 'q', approved: 'a', ordered: 'o',
  partly_delivered: 'o', delivered: 'd', cancelled: 'x'
};
const PIPE_ORDER = ['quoted', 'approved', 'ordered', 'partly_delivered', 'delivered'];

let POS = [], PROJECTS = [];
let fProject = '', fStatus = '', fCat = '', q = '';

async function load() {
  const [poRes, prRes] = await Promise.all([
    supabase.from('purchase_orders')
      .select('*, vendors(name,category), projects(name,code), po_items(description,qty,unit)')
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('id,code,name').order('name')
  ]);

  if (poRes.error) return fail(poRes.error);
  POS = poRes.data ?? [];
  PROJECTS = prRes.data ?? [];

  fillFilters();
  render();
}

function fillFilters() {
  const sel = $('#projSel');
  if (sel && sel.options.length <= 1) {
    PROJECTS.forEach(p => sel.add(new Option(`${p.code} · ${p.name}`, p.id)));
  }
  const cat = $('#cat');
  if (cat && cat.options.length <= 1) {
    [...new Set(POS.map(p => p.vendors?.category).filter(Boolean))]
      .sort().forEach(c => cat.add(new Option(c, c)));
  }
}

const firstItem = p => p.po_items?.[0];

function passes(p) {
  if (fProject && p.project_id !== fProject) return false;
  if (fStatus && p.status !== fStatus) return false;
  if (fCat && p.vendors?.category !== fCat) return false;
  if (q) {
    const hay = [p.po_no, p.vendors?.name, p.projects?.name, firstItem(p)?.description]
      .join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function render() {
  const rows = POS.filter(passes);
  const body = $('#poBody');

  if (body) {
    body.innerHTML = rows.length ? rows.map(p => {
      const it = firstItem(p);
      const extra = (p.po_items?.length ?? 0) - 1;
      const soon = p.expected_date &&
        p.expected_date <= new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10) &&
        !['delivered', 'cancelled'].includes(p.status);

      return `<tr data-id="${p.id}">
        <td>
          <div class="po-no">${esc(p.po_no)}</div>
          <div class="po-item">${esc(it?.description || '—')}${extra > 0 ? ` +${extra} more` : ''}</div>
          <div class="po-sub">${it ? esc(`${it.qty} ${it.unit || ''}`) : ''}</div>
        </td>
        <td>${esc(p.projects?.name || '—')}</td>
        <td><div class="vend"><span class="vend__ic">${esc(initials(p.vendors?.name || '?'))}</span>${esc(p.vendors?.name || 'No vendor')}</div></td>
        <td class="num">${money(p.total)}</td>
        <td><span class="pill ${ST_CLASS[p.status]}"><span class="pill__dot"></span>${ST_LABEL[p.status]}</span></td>
        <td><span class="due${soon ? ' soon' : ''}">${p.expected_date ? fmtDate(p.expected_date) : '—'}</span></td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="6" class="tbl__empty">No orders match these filters.</td></tr>`;
  }

  const count = $('#poCount');
  if (count) count.textContent = `${rows.length} order${rows.length === 1 ? '' : 's'}`;

  renderPipeline();
  renderApprovals();
  renderVendorBar();
}

function renderPipeline() {
  const el = $('#pipe');
  if (!el) return;
  const top = Math.max(...PIPE_ORDER.map(s => POS.filter(p => p.status === s).length), 1);
  el.innerHTML = PIPE_ORDER.map(s => {
    const items = POS.filter(p => p.status === s);
    const value = items.reduce((a, p) => a + Number(p.total || 0), 0);
    return `<div class="pipe-row">
      <span class="pipe-row__name">${ST_LABEL[s]}</span>
      <span class="pipe-row__bar"><span class="pipe-row__fill ${ST_CLASS[s]}" style="width:${Math.round(items.length / top * 100)}%"></span></span>
      <span class="pipe-row__n">${items.length}</span>
      <span class="pipe-row__v">${value ? money(value) : '—'}</span>
    </div>`;
  }).join('');
}

function renderApprovals() {
  const pending = POS.filter(p => p.status === 'quoted');
  const el = $('#apprList');
  if (el) {
    el.innerHTML = pending.length
      ? pending.map(p => `<li class="appr" data-id="${p.id}">
          <span class="appr__body">
            <span class="appr__no">${esc(p.po_no)}</span>
            <span class="appr__meta">${esc(p.vendors?.name || '—')} · ${money(p.total)}</span>
          </span>
          <button class="appr__ok" data-approve="${p.id}">Approve</button>
        </li>`).join('')
      : '<li class="appr"><span class="appr__body">Nothing awaiting approval</span></li>';
  }
  const tag = $('#apprTag');
  if (tag) { tag.textContent = String(pending.length); tag.hidden = !pending.length; }

  const note = $('#pendNote');
  if (note) {
    const value = pending.reduce((a, p) => a + Number(p.total || 0), 0);
    note.textContent = pending.length
      ? `${money(value)} awaiting sign-off`
      : 'All orders approved';
  }
}

function renderVendorBar() {
  const el = $('#vbar');
  if (!el) return;
  const byVendor = new Map();
  POS.forEach(p => {
    const k = p.vendors?.name || 'Unassigned';
    byVendor.set(k, (byVendor.get(k) || 0) + Number(p.total || 0));
  });
  const rows = [...byVendor].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const top = Math.max(...rows.map(r => r[1]), 1);
  el.innerHTML = rows.map(([name, value]) => `
    <div class="vb">
      <span class="vb__name">${esc(name)}</span>
      <span class="vb__bar"><span class="vb__fill" style="width:${Math.round(value / top * 100)}%"></span></span>
      <span class="vb__v">${money(value)}</span>
    </div>`).join('');
}

/* ---------------------------------------------------------------
   approve
--------------------------------------------------------------- */
document.addEventListener('click', async e => {
  const btn = e.target.closest('[data-approve]');
  if (!btn) return;

  const { error } = await supabase.from('purchase_orders').update({
    status: 'approved',
    approved_by: user.id,
    approved_at: new Date().toISOString()
  }).eq('id', btn.dataset.approve);

  if (error) return fail(error);
  toast('Purchase order approved');
  await load();
});

/* mark delivered — also posts stock in, which is the whole point of a PO */
document.addEventListener('dblclick', async e => {
  const row = e.target.closest('tr[data-id]');
  if (!row) return;
  const po = POS.find(p => p.id === row.dataset.id);
  if (!po || po.status === 'delivered') return;
  if (!confirm(`Mark ${po.no || po.po_no} as delivered?`)) return;

  const { error } = await supabase.from('purchase_orders').update({
    status: 'delivered',
    delivered_date: new Date().toISOString().slice(0, 10)
  }).eq('id', po.id);

  if (error) return fail(error);
  toast(`${po.po_no} marked delivered — record stock in from Inventory`);
  await load();
});

/* ---------------------------------------------------------------
   filters
--------------------------------------------------------------- */
$('#projSel')?.addEventListener('change', e => { fProject = e.target.value; render(); });
$('#cat')?.addEventListener('change', e => { fCat = e.target.value; render(); });
$('#poSearch')?.addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
$('#statusSeg')?.addEventListener('click', e => {
  const b = e.target.closest('[data-status]');
  if (!b) return;
  fStatus = b.dataset.status === 'all' ? '' : b.dataset.status;
  $$('#statusSeg [data-status]').forEach(x => x.classList.toggle('is-on', x === b));
  render();
});

await load();

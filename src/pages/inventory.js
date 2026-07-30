import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'inventory', title: 'Inventory' });
if (!user) throw new Error('redirecting');

const money = v => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e7) return '₹' + (n / 1e7).toFixed(2).replace(/\.00$/, '') + 'Cr';
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(2).replace(/\.00$/, '') + 'L';
  return '₹' + n.toLocaleString('en-IN');
};

const qtyFmt = n => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
};

let BAL = [], STORES = [], MOVES = [];
let fStore = '', fCat = '', fStatus = '', q = '';

async function load() {
  const [bRes, sRes, mRes] = await Promise.all([
    supabase.from('stock_balances').select('*').order('name'),
    supabase.from('stores').select('*').eq('status', 'active').order('name'),
    supabase.from('stock_ledger')
      .select('*, materials(name,unit), stores(name)')
      .order('moved_on', { ascending: false })
      .limit(25)
  ]);

  if (bRes.error) return fail(bRes.error);
  BAL    = bRes.data ?? [];
  STORES = sRes.data ?? [];
  MOVES  = mRes.data ?? [];

  fillFilters();
  render();
}

function fillFilters() {
  const st = $('#storeSel');
  if (st && st.options.length <= 1) {
    STORES.forEach(s => st.add(new Option(s.name, s.id)));
  }
  const cat = $('#cat');
  if (cat && cat.options.length <= 1) {
    [...new Set(BAL.map(b => b.category).filter(Boolean))].sort()
      .forEach(c => cat.add(new Option(c, c)));
  }
}

function passes(b) {
  if (fStore && b.store_id !== fStore) return false;
  if (fCat && b.category !== fCat) return false;
  if (fStatus && b.stock_status !== fStatus) return false;
  if (q && !`${b.name} ${b.code || ''} ${b.category}`.toLowerCase().includes(q)) return false;
  return true;
}

function render() {
  const rows = BAL.filter(passes);
  const body = $('#invBody');

  if (body) {
    body.innerHTML = rows.length ? rows.map(b => `
      <tr data-mat="${b.material_id}" data-store="${b.store_id}">
        <td>
          <div class="inv-nm">${esc(b.name)}</div>
          <div class="inv-sub">${esc(b.category)}${b.code ? ' · ' + esc(b.code) : ''}</div>
        </td>
        <td>${esc(b.store_name)}</td>
        <td class="num">${qtyFmt(b.qty)} ${esc(b.unit)}</td>
        <td class="num">${qtyFmt(b.reorder_level)} ${esc(b.unit)}</td>
        <td><span class="pill ${b.stock_status}"><span class="pill__dot"></span>${
          b.stock_status === 'out' ? 'Out of stock'
          : b.stock_status === 'low' ? 'Low' : 'In stock'}</span></td>
        <td class="num">${money(b.value)}</td>
        <td>
          <button class="mini-act" data-move="in:${b.material_id}:${b.store_id}" title="Record stock in">+</button>
          <button class="mini-act" data-move="out:${b.material_id}:${b.store_id}" title="Record issue">−</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="7" class="tbl__empty">No stock matches these filters.</td></tr>`;
  }

  const count = $('#invCount');
  if (count) count.textContent = `${rows.length} item${rows.length === 1 ? '' : 's'}`;

  const low = BAL.filter(b => b.stock_status === 'low');
  const out = BAL.filter(b => b.stock_status === 'out');
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('kLow', String(low.length));
  set('kOut', String(out.length));

  const tag = $('#alertTag');
  if (tag) { tag.textContent = String(low.length + out.length); tag.hidden = !(low.length + out.length); }

  const al = $('#alerts');
  if (al) {
    const rowsA = [...out, ...low].slice(0, 8);
    al.innerHTML = rowsA.length
      ? rowsA.map(b => `<li class="alert alert--${b.stock_status}">
          <span class="alert__nm">${esc(b.name)}</span>
          <span class="alert__meta">${esc(b.store_name)} · ${qtyFmt(b.qty)} ${esc(b.unit)} of ${qtyFmt(b.reorder_level)}</span>
        </li>`).join('')
      : '<li class="alert">Everything above reorder level</li>';
  }

  const st = $('#stores');
  if (st) {
    st.innerHTML = STORES.map(s => {
      const items = BAL.filter(b => b.store_id === s.id && Number(b.qty) > 0);
      const value = items.reduce((a, b) => a + Number(b.value || 0), 0);
      return `<li class="store">
        <span class="store__nm">${esc(s.name)}</span>
        <span class="store__meta">${items.length} items · ${money(value)}</span>
      </li>`;
    }).join('');
  }

  const mv = $('#moves');
  if (mv) {
    mv.innerHTML = MOVES.length
      ? MOVES.map(m => {
          const inward = ['in', 'transfer_in', 'adjust'].includes(m.movement_type);
          return `<li class="mv mv--${inward ? 'in' : 'out'}">
            <span class="mv__nm">${esc(m.materials?.name || '—')}</span>
            <span class="mv__qty">${inward ? '+' : '−'}${qtyFmt(m.qty)} ${esc(m.materials?.unit || '')}</span>
            <span class="mv__meta">${esc(m.stores?.name || '')} · ${fmtDate(m.moved_on)}</span>
          </li>`;
        }).join('')
      : '<li class="mv">No movements recorded yet</li>';
  }
}

/* ---------------------------------------------------------------
   record a movement — never mutate a quantity, always append
--------------------------------------------------------------- */
document.addEventListener('click', async e => {
  const btn = e.target.closest('[data-move]');
  if (!btn) return;

  const [dir, materialId, storeId] = btn.dataset.move.split(':');
  const row = BAL.find(b => b.material_id === materialId && b.store_id === storeId);
  const label = dir === 'in' ? 'received' : 'issued';

  const raw = prompt(`Quantity ${label} (${row?.unit || 'nos'})`);
  if (raw === null) return;
  const qtyVal = Number(raw);
  if (!Number.isFinite(qtyVal) || qtyVal <= 0) return toast('Enter a positive quantity', 'err');

  if (dir === 'out' && row && qtyVal > Number(row.qty)) {
    if (!confirm(`Only ${qtyFmt(row.qty)} ${row.unit} on hand. Issue anyway and go negative?`)) return;
  }

  const { error } = await supabase.from('stock_ledger').insert({
    material_id: materialId,
    store_id: storeId,
    movement_type: dir,
    qty: qtyVal,
    rate: row?.last_rate ?? 0,
    recorded_by: user.id
  });

  if (error) return fail(error);
  toast(`${qtyFmt(qtyVal)} ${row?.unit || ''} ${label}`);
  await load();
});

/* ---------------------------------------------------------------
   filters
--------------------------------------------------------------- */
$('#storeSel')?.addEventListener('change', e => { fStore = e.target.value; render(); });
$('#cat')?.addEventListener('change', e => { fCat = e.target.value; render(); });
$('#statSel')?.addEventListener('change', e => { fStatus = e.target.value; render(); });
$('#invSearch')?.addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
$('#catSeg')?.addEventListener('click', e => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  fCat = b.dataset.cat === 'all' ? '' : b.dataset.cat;
  $$('#catSeg [data-cat]').forEach(x => x.classList.toggle('is-on', x === b));
  render();
});

await load();

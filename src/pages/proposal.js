import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, openModal, closeAllModals,
         wireModalDismiss, val, setVal } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'sales', title: 'Proposal' });
if (!user) throw new Error('redirecting');

const qs         = new URLSearchParams(location.search);
const proposalId = qs.get('id');
const leadParam  = qs.get('lead');

const inr    = v => '₹' + Math.round(Number(v) || 0).toLocaleString('en-IN');
const moneyL = v => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e7) return '₹' + (n / 1e7).toFixed(2).replace(/\.00$/, '') + ' Cr';
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(2).replace(/\.00$/, '') + ' L';
  return inr(n);
};

let PROPOSAL = null, LEAD = null, ITEMS = [], SCOPE = [], SCHEDULE = [];
let dirty = false, saveTimer = null;

/* ---------------------------------------------------------------
   load
--------------------------------------------------------------- */
async function load() {
  if (proposalId) {
    const { data, error } = await supabase
      .from('proposals').select('*').eq('id', proposalId).maybeSingle();
    if (error) return fail(error);
    if (!data)  return bail('That proposal no longer exists.');
    PROPOSAL = data;
  } else if (leadParam) {
    return bail('Creating a proposal from scratch needs the Finance module. Open an existing proposal instead.');
  } else {
    /* no params — open the most recent proposal */
    const { data } = await supabase.from('proposals')
      .select('id').order('created_at', { ascending: false }).limit(1);
    if (!data?.length) return bail('No proposals yet.');
    return location.replace(`/proposal.html?id=${data[0].id}`);
  }

  if (PROPOSAL.lead_id) {
    const { data } = await supabase.from('leads')
      .select('*').eq('id', PROPOSAL.lead_id).maybeSingle();
    LEAD = data;
  }

  const { data: items } = await supabase.from('proposal_items')
    .select('*').eq('proposal_id', PROPOSAL.id).order('sort_order');

  /* fall back to the single service line the generator created */
  ITEMS = (items ?? []).length
    ? items.map(i => ({
        id: i.id, d: i.description, s: i.sub_description || '',
        q: Number(i.qty), u: i.unit || 'LS', r: Number(i.rate), sort: i.sort_order
      }))
    : [{
        id: null,
        d: PROPOSAL.service || 'Professional fee',
        s: PROPOSAL.sqft ? `${Number(PROPOSAL.sqft).toLocaleString('en-IN')} sq ft @ ₹${PROPOSAL.rate}/sq ft` : '',
        q: Number(PROPOSAL.sqft) || 1,
        u: PROPOSAL.sqft ? 'sq ft' : 'LS',
        r: Number(PROPOSAL.rate) || Number(PROPOSAL.total) || 0,
        sort: 0
      }];

  SCOPE = (PROPOSAL.scope || '')
    .split(/[\n;]+/).map(s => s.trim()).filter(Boolean);

  SCHEDULE = Array.isArray(PROPOSAL.stages) ? PROPOSAL.stages : [];

  paintMeta();
  renderItems();
  renderScope();
  renderSchedule();
  calc();
  await paintTracking();
}

function bail(msg) {
  toast(msg, 'err');
  const body = $('#feeBody');
  if (body) body.innerHTML = `<tr><td colspan="6" class="t-empty">${esc(msg)}</td></tr>`;
}

function paintMeta() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dClient', LEAD?.name || 'Unassigned');
  set('dTitle',  PROPOSAL.no || '—');
  set('dArea',   LEAD?.area || '—');
  set('dBy',     user.name);
  set('dValid',  PROPOSAL.valid_until ? fmtDate(PROPOSAL.valid_until) : '30 days from issue');

  const chip = $('#statusChip');
  if (chip) {
    chip.textContent = (PROPOSAL.status || 'draft').replace('_', ' ');
    chip.dataset.status = PROPOSAL.status || 'draft';
  }

  const rate = $('#tRate');
  if (rate) rate.textContent = LEAD?.area || '—';

  const terms = $('#terms');
  if (terms && PROPOSAL.terms) terms.value = PROPOSAL.terms;

  document.title = `${PROPOSAL.no || 'Proposal'} · Bind Build ERP`;
}

/* ---------------------------------------------------------------
   line items
--------------------------------------------------------------- */
function renderItems() {
  const body = $('#feeBody');
  if (!body) return;

  body.innerHTML = ITEMS.map((it, i) =>
    '<tr>' +
      `<td><input class="in in--desc" value="${esc(it.d)}" data-f="d" data-i="${i}" aria-label="Item description" />` +
        `<div class="sub"><input class="in" value="${esc(it.s)}" data-f="s" data-i="${i}" aria-label="Item detail" /></div></td>` +
      `<td class="r"><input class="in in--num" type="number" min="0" value="${it.q}" data-f="q" data-i="${i}" aria-label="Quantity" /></td>` +
      `<td><input class="in" value="${esc(it.u)}" data-f="u" data-i="${i}" aria-label="Unit" /></td>` +
      `<td class="r"><input class="in in--num" type="number" min="0" value="${it.r}" data-f="r" data-i="${i}" aria-label="Rate in rupees" /></td>` +
      `<td class="r"><span class="amt" data-amt="${i}">${inr(it.q * it.r)}</span></td>` +
      `<td><button class="rm" data-rm="${i}" aria-label="Remove line item">` +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>' +
      '</button></td>' +
    '</tr>').join('');

  const count = $('#feeCount');
  if (count) count.textContent = ITEMS.length + ' item' + (ITEMS.length === 1 ? '' : 's');
}

$('#feeBody')?.addEventListener('input', e => {
  const f = e.target.dataset.f, i = +e.target.dataset.i;
  if (f === undefined) return;
  ITEMS[i][f] = (f === 'q' || f === 'r') ? (parseFloat(e.target.value) || 0) : e.target.value;
  const amt = $(`[data-amt="${i}"]`);
  if (amt) amt.textContent = inr(ITEMS[i].q * ITEMS[i].r);
  calc(); markDirty();
});

$('#feeBody')?.addEventListener('click', e => {
  const rm = e.target.closest('[data-rm]');
  if (!rm) return;
  ITEMS.splice(+rm.dataset.rm, 1);
  renderItems(); calc(); markDirty();
  toast('Line removed');
});

$('#addItem')?.addEventListener('click', () => {
  ITEMS.push({ id: null, d: 'New line item', s: 'Add detail…', q: 1, u: 'LS', r: 0, sort: ITEMS.length });
  renderItems(); calc(); markDirty();
  const rows = $$('#feeBody tr');
  const inp = rows[rows.length - 1]?.querySelector('.in--desc');
  if (inp) { inp.focus(); inp.select(); }
});

/* ---------------------------------------------------------------
   scope + schedule
--------------------------------------------------------------- */
function renderScope() {
  const el = $('#scopeList');
  if (!el) return;
  el.innerHTML = SCOPE.length
    ? SCOPE.map((s, i) => `
        <li class="scope-item">
          <input class="in" value="${esc(s)}" data-scope="${i}" aria-label="Scope line" />
          <button class="rm" data-rmscope="${i}" aria-label="Remove scope line">×</button>
        </li>`).join('')
    : `<li class="scope-item"><span class="t-empty">No scope lines yet.</span></li>`;
}

$('#addScope')?.addEventListener('click', () => {
  SCOPE.push('New scope line');
  renderScope(); markDirty();
});

document.addEventListener('input', e => {
  const s = e.target.dataset.scope;
  if (s === undefined) return;
  SCOPE[+s] = e.target.value;
  markDirty();
});

document.addEventListener('click', e => {
  const rm = e.target.closest('[data-rmscope]');
  if (!rm) return;
  SCOPE.splice(+rm.dataset.rmscope, 1);
  renderScope(); markDirty();
});

function renderSchedule() {
  const el = $('#schList');
  if (el) {
    el.innerHTML = SCHEDULE.length
      ? SCHEDULE.map(s => `
          <li class="sch">
            <span class="sch__name">${esc(s.n)}</span>
            <span class="sch__pct">${s.p}%</span>
            <span class="sch__amt" data-schamt="${s.p}">—</span>
          </li>`).join('')
      : `<li class="sch"><span class="sch__name">No payment schedule defined</span></li>`;
  }
  const badge = $('#schBadge');
  if (badge) {
    const sum = SCHEDULE.reduce((a, s) => a + Number(s.p || 0), 0);
    badge.textContent = sum + '%';
    badge.dataset.ok = String(sum === 100);
  }
}

/* ---------------------------------------------------------------
   totals — GST aware
--------------------------------------------------------------- */
function totals() {
  const sub     = ITEMS.reduce((a, it) => a + it.q * it.r, 0);
  const dPct    = parseFloat($('#tDiscIn')?.value) || 0;
  const disc    = sub * dPct / 100;
  const taxable = sub - disc;
  const rate    = Number(PROPOSAL?.tax_rate ?? 18);
  const gst     = taxable * rate / 100;
  return { sub, disc, taxable, gst, grand: taxable + gst, rate };
}

function calc() {
  const t = totals();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('tSub',     moneyL(t.sub));
  set('tDisc',    '− ' + moneyL(t.disc));
  set('tTaxable', moneyL(t.taxable));
  set('tGst',     moneyL(t.gst));
  set('tGrand',   moneyL(t.grand));

  $$('[data-schamt]').forEach(el => {
    el.textContent = moneyL(t.grand * Number(el.dataset.schamt) / 100);
  });
}

$('#tDiscIn')?.addEventListener('input', () => { calc(); markDirty(); });
$('#terms')?.addEventListener('input', markDirty);

/* ---------------------------------------------------------------
   save
--------------------------------------------------------------- */
function markDirty() {
  dirty = true;
  const txt = $('#autosaveTxt');
  if (txt) txt.textContent = 'Unsaved changes';
  $('#autosave')?.setAttribute('data-state', 'dirty');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 1500);
}

async function save() {
  if (!dirty || !PROPOSAL) return;
  const t = totals();

  const txt = $('#autosaveTxt');
  if (txt) txt.textContent = 'Saving…';

  const { error: pErr } = await supabase.from('proposals').update({
    scope:       SCOPE.join('\n'),
    stages:      SCHEDULE,
    terms:       $('#terms')?.value ?? PROPOSAL.terms,
    subtotal:    t.sub,
    tax_amount:  t.gst,
    grand_total: t.grand,
    total:       Math.round(t.grand),
    updated_at:  new Date().toISOString()
  }).eq('id', PROPOSAL.id);

  if (pErr) { if (txt) txt.textContent = 'Save failed'; return fail(pErr); }

  /* replace line items wholesale — simplest correct approach at this size */
  await supabase.from('proposal_items').delete().eq('proposal_id', PROPOSAL.id);
  if (ITEMS.length) {
    const { error: iErr } = await supabase.from('proposal_items').insert(
      ITEMS.map((it, i) => ({
        proposal_id: PROPOSAL.id,
        description: it.d, sub_description: it.s,
        qty: it.q, unit: it.u, rate: it.r, sort_order: i
      }))
    );
    if (iErr) { if (txt) txt.textContent = 'Save failed'; return fail(iErr); }
  }

  dirty = false;
  if (txt) txt.textContent = 'All changes saved';
  $('#autosave')?.setAttribute('data-state', 'saved');
}

/* ---------------------------------------------------------------
   tracking + send
--------------------------------------------------------------- */
async function paintTracking() {
  const { data: views } = await supabase
    .from('proposal_views')
    .select('device,seconds,viewed_at')
    .eq('proposal_id', PROPOSAL.id)
    .order('viewed_at', { ascending: false });

  const v = views ?? [];
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  set('trackViewed', v.length ? `${v.length} view${v.length > 1 ? 's' : ''} · last ${fmtDate(v[0].viewed_at)}` : 'Not opened yet');
  set('trackAccepted', PROPOSAL.accepted_at ? `Accepted ${fmtDate(PROPOSAL.accepted_at)}` : 'Awaiting decision');

  const tl = $('#miniTl');
  if (tl) {
    const events = [
      { t: PROPOSAL.created_at, txt: 'Proposal created' },
      ...v.map(x => ({ t: x.viewed_at, txt: `Opened by client · ${x.device || 'unknown device'}` })),
      PROPOSAL.accepted_at ? { t: PROPOSAL.accepted_at, txt: 'Accepted by client' } : null
    ].filter(Boolean).sort((a, b) => new Date(b.t) - new Date(a.t));

    tl.innerHTML = events.map(e => `
      <li class="mtl">
        <span class="mtl__txt">${esc(e.txt)}</span>
        <span class="mtl__time">${fmtDate(e.t)}</span>
      </li>`).join('');
  }
}

async function send() {
  await save();
  const { error } = await supabase.from('proposals')
    .update({ status: 'sent' }).eq('id', PROPOSAL.id);
  if (error) return fail(error);

  PROPOSAL.status = 'sent';
  paintMeta();

  if (PROPOSAL.lead_id) {
    await supabase.from('leads')
      .update({ stage_key: 'proposal', last_contact_at: new Date().toISOString() })
      .eq('id', PROPOSAL.lead_id);
    await supabase.from('activities').insert({
      lead_id: PROPOSAL.lead_id, user_id: user.id, kind: 'proposal',
      detail: `Proposal ${PROPOSAL.no} sent`
    });
  }

  const link = `${location.origin}/proposal.html?id=${PROPOSAL.id}`;
  try { await navigator.clipboard.writeText(link); toast('Sent — link copied to clipboard'); }
  catch { toast('Marked as sent'); }
}

wireModalDismiss();

function openSend() {
  setVal('sendMsg',
    `Hello ${LEAD?.name || 'there'},\n\nPlease find our proposal ${PROPOSAL?.no || ''} attached. ` +
    `Happy to walk you through it whenever suits.\n\n${user.name}\nStudio Bind Architects`);
  if (!openModal('sendModal')) send();
}

$('#sendBtn') ?.addEventListener('click', openSend);
$('#sendBtn2')?.addEventListener('click', openSend);

$('#confirmSend')?.addEventListener('click', async () => {
  const byEmail = document.getElementById('chEmail')?.checked;
  const byWa    = document.getElementById('chWa')?.checked;
  if (!byEmail && !byWa) return toast('Pick at least one channel', 'err');

  await send();
  closeAllModals();

  const link = `${location.origin}/proposal.html?id=${PROPOSAL.id}`;
  const msg  = val('sendMsg');

  /* no mail server is configured, so hand off to the client's own apps
     rather than silently pretending something was sent */
  if (byWa && LEAD?.phone) {
    window.open(`https://wa.me/91${String(LEAD.phone).replace(/\D/g,'').slice(-10)}`
      + `?text=${encodeURIComponent(msg + '\n\n' + link)}`, '_blank');
  }
  if (byEmail && LEAD?.email) {
    window.location.href = `mailto:${LEAD.email}`
      + `?subject=${encodeURIComponent('Proposal ' + (PROPOSAL.no || ''))}`
      + `&body=${encodeURIComponent(msg + '\n\n' + link)}`;
  }
  if (byEmail && !LEAD?.email) toast('No email address on this lead', 'err');
});

$('#pdfBtn')  ?.addEventListener('click', () => window.print());
$('#pdfBtn2') ?.addEventListener('click', () => window.print());
$('#previewBtn')?.addEventListener('click', () => {
  if (!openModal('prevModal')) window.open(`/proposal.html?id=${PROPOSAL.id}`, '_blank');
});

window.addEventListener('beforeunload', e => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

await load();

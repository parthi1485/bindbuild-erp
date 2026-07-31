import { supabase } from '../lib/supabase.js';
import { mountShell, activeUnit, scopeToUnit } from '../lib/shell.js';
import { toast, fail, esc, openModal, closeModal, closeAllModals,
         wireModalDismiss, val, setVal } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'crm', title: 'CRM · Leads' });
if (!user) throw new Error('redirecting');

/* ---------------------------------------------------------------
   state
--------------------------------------------------------------- */
let STAGES = [];
let LEADS  = [];
const ACTIVE = ['new', 'contacted', 'meeting', 'proposal', 'nego'];

const money = l => l >= 100
  ? '₹' + (l / 100).toFixed(1).replace(/\.0$/, '') + 'Cr'
  : '₹' + l + 'L';

const SRC_ICON = {
  'Instagram':'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/>',
  'Google':'<circle cx="12" cy="12" r="9"/><path d="M12 12h7M12 12V5"/>',
  'Referral':'<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="m19 8 2 2-2 2"/>',
  'Website':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
  'Direct':'<path d="m22 2-7 20-4-9-9-4z"/>',
  'Walk-in':'<circle cx="12" cy="5" r="2.5"/><path d="M12 8v6l-3 7M12 14l3 7M9 11l3-3 3 3"/>'
};

const daysIn = row => {
  const from = row.last_contact_at || row.updated_at || row.created_at;
  if (!from) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(from)) / 86400000));
};

/** DB row -> the shape the prototype's templates expect. */
const toCard = r => ({
  id:     r.id,
  name:   r.name || 'Untitled lead',
  proj:   [r.service, r.sqft ? `${Number(r.sqft).toLocaleString('en-IN')} sq ft` : null]
            .filter(Boolean).join(' · ') || '—',
  loc:    r.area || '—',
  budget: Number(r.budget) || 0,
  src:    r.source || 'Direct',
  prio:   r.priority || 'warm',
  stage:  r.stage_key || 'new',
  days:   daysIn(r),
  phone:  r.phone || '',
  lost:   r.lost_reason || '',
  won:    r.stage_key === 'won' ? 'Won' : ''
});

/* ---------------------------------------------------------------
   load
--------------------------------------------------------------- */
async function load() {
  const [stageRes, leadRes] = await Promise.all([
    supabase.from('lead_stage_config').select('*').order('sort_order'),
    scopeToUnit(supabase.from('leads').select('*')).order('updated_at', { ascending: false })
  ]);

  if (stageRes.error) return fail(stageRes.error);
  if (leadRes.error)  return fail(leadRes.error);

  STAGES = stageRes.data.map(s => ({ id: s.stage, name: s.label, color: s.color }));
  LEADS  = leadRes.data.map(toCard);
  render();
}

/* ---------------------------------------------------------------
   filtering
--------------------------------------------------------------- */
const f = {
  get q()      { return ($('#fQ')?.value || '').trim().toLowerCase(); },
  get source() { return $('#fSource')?.value || ''; },
  get budget() { return $('#fBudget')?.value || ''; },
  get prio()   { return $('#fPrio')?.value || ''; }
};

const filterActive = () => !!(f.q || f.source || f.budget || f.prio);

function passes(l) {
  if (f.q && ![l.name, l.proj, l.loc].join(' ').toLowerCase().includes(f.q)) return false;
  if (f.source && l.src !== f.source) return false;
  if (f.prio && l.prio !== f.prio) return false;
  if (f.budget) {
    const [lo, hi] = f.budget.split('-').map(Number);
    if (Number.isFinite(lo) && l.budget < lo) return false;
    if (Number.isFinite(hi) && hi > 0 && l.budget > hi) return false;
  }
  return true;
}

/* ---------------------------------------------------------------
   templates — reproduced from the prototype
--------------------------------------------------------------- */
function leadCard(l) {
  const lostRow = l.stage === 'lost'
    ? `<p class="lead__lost"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>${esc(l.lost || 'Lost')}</p>` : '';
  const wonRow = l.stage === 'won'
    ? `<p class="lead__won"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>${esc(l.won || 'Won')}</p>` : '';
  const moveItems = STAGES.filter(s => s.id !== l.stage)
    .map(s => `<button class="menu__item" data-move="${s.id}" role="menuitem">${esc(s.name)}</button>`).join('');

  return `
  <div class="lead" draggable="true" data-id="${l.id}" role="button" tabindex="0"
       aria-label="Lead: ${esc(l.name)}, ${esc(l.proj)}, ${money(l.budget)}">
    <div class="lead__top">
      <span class="lead__prio lead__prio--${l.prio}" title="${l.prio} lead"></span>
      <span class="lead__name">${esc(l.name)}</span>
      <button class="lead__kebab" aria-haspopup="menu" aria-expanded="false" aria-label="Lead actions">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
        <div class="menu" role="menu">
          <div class="menu__label">Move to</div>
          ${moveItems}
          <div class="menu__rule"></div>
          <button class="menu__item" data-open role="menuitem">Open lead details</button>
        </div>
      </button>
    </div>
    <p class="lead__proj">${esc(l.proj)}</p>
    <p class="lead__loc"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>${esc(l.loc)}</p>
    <div class="lead__row">
      <span class="lead__budget">${money(l.budget)}</span>
      <span class="lead__days">${l.days}d in stage</span>
    </div>
    ${lostRow}${wonRow}
    <div class="lead__foot">
      <span class="src"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SRC_ICON[l.src] || SRC_ICON.Direct}</svg>${esc(l.src)}</span>
      <div class="lead__acts">
        <button class="mini-act" data-act="call" aria-label="Call ${esc(l.name)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/></svg></button>
        <button class="mini-act mini-act--wa" data-act="WhatsApp" aria-label="WhatsApp ${esc(l.name)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z"/><path d="M9 10a5 5 0 0 0 5 5"/></svg></button>
        <button class="mini-act" data-act="email" aria-label="Email ${esc(l.name)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg></button>
      </div>
      <span class="lead__owner" title="Owner: ${esc(user.name)}">${esc((user.name[0] || 'U') + (user.name.split(' ')[1]?.[0] || ''))}</span>
    </div>
  </div>`;
}

/* ---------------------------------------------------------------
   render
--------------------------------------------------------------- */
function render() {
  const board = $('#board');
  if (board) {
    board.innerHTML = STAGES.map(s => {
      const items = LEADS.filter(l => l.stage === s.id && passes(l));
      const value = items.reduce((a, l) => a + l.budget, 0);
      const bodies = items.length
        ? items.map(leadCard).join('')
        : `<div class="col__empty">${filterActive() ? 'No leads match the filter' : 'Drop a lead here'}</div>`;
      return `
      <section class="col" data-stage="${s.id}" aria-label="${esc(s.name)} column">
        <header class="col__head">
          <span class="col__dot" data-dotcolor="${s.color}"></span>
          <span class="col__name">${esc(s.name)}</span>
          <span class="col__count">${items.length}</span>
          <button class="col__add" data-addto="${s.id}" aria-label="Add lead to ${esc(s.name)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </header>
        <p class="col__value">${value ? money(value) : '—'}</p>
        <div class="col__body">${bodies}</div>
      </section>`;
    }).join('');
    $$('.col__dot', board).forEach(d => d.style.background = d.dataset.dotcolor);
  }

  /* table view */
  const tbody = $('#tbody');
  if (tbody) {
    tbody.innerHTML = LEADS.filter(passes).map(l => {
      const st = STAGES.find(s => s.id === l.stage) || { name: l.stage, color: 'var(--text-3)' };
      return `<tr data-id="${l.id}">
        <td><div class="t-name">${esc(l.name)}</div><div class="t-sub">${esc(l.loc)} · ${esc(l.src)}</div></td>
        <td>${esc(l.proj)}</td>
        <td class="t-money">${money(l.budget)}</td>
        <td>${esc(l.src)}</td>
        <td><span class="stage-chip" data-chipcolor="${st.color}"><span class="dot"></span>${esc(st.name)}</span></td>
        <td class="t-money">${l.days}d</td>
        <td>
          <button class="mini-act" data-act="call" aria-label="Call">·</button>
        </td>
      </tr>`;
    }).join('');
    $$('#tbody .stage-chip').forEach(ch => {
      ch.style.color = ch.dataset.chipcolor;
      const dot = ch.querySelector('.dot');
      if (dot) dot.style.background = ch.dataset.chipcolor;
    });
  }

  paintKpis();
  const shown = LEADS.filter(passes).length;
  const fc = $('#fCount');
  if (fc) fc.textContent = filterActive() ? `${shown} of ${LEADS.length}` : `${LEADS.length} leads`;

  $('#boardView')?.removeAttribute('data-skel');
}

function paintKpis() {
  const active = LEADS.filter(l => ACTIVE.includes(l.stage));
  const val = active.reduce((a, l) => a + l.budget, 0);
  const kv = $('#kpiValue'), ka = $('#kpiActive');
  if (kv) kv.textContent = val ? money(val) : '—';
  if (ka) ka.textContent = active.length;
}

/* ---------------------------------------------------------------
   stage changes — optimistic UI, then persist
--------------------------------------------------------------- */
async function moveLead(id, stage) {
  const lead = LEADS.find(l => l.id === id);
  if (!lead || lead.stage === stage) return;

  const prev = lead.stage;
  lead.stage = stage;
  lead.days = 0;
  render();

  const { error } = await supabase
    .from('leads')
    .update({ stage_key: stage, last_contact_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    lead.stage = prev;          // roll back
    render();
    return fail(error);
  }

  const label = STAGES.find(s => s.id === stage)?.name || stage;
  toast(`${lead.name} moved to ${label}`);

  supabase.from('activities').insert({
    lead_id: id,
    user_id: user.id,
    kind: 'stage_change',
    detail: `Stage changed from ${prev} to ${stage}`
  }).then(({ error }) => error && console.warn('activity log skipped:', error.message));
}

/* ---------------------------------------------------------------
   interactions
--------------------------------------------------------------- */
let dragId = null;

document.addEventListener('dragstart', e => {
  const card = e.target.closest?.('.lead');
  if (!card) return;
  dragId = card.dataset.id;
  card.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move';
});

document.addEventListener('dragend', e => {
  e.target.closest?.('.lead')?.classList.remove('is-dragging');
  $$('.col.is-over').forEach(c => c.classList.remove('is-over'));
  dragId = null;
});

document.addEventListener('dragover', e => {
  const col = e.target.closest?.('.col');
  if (!col) return;
  e.preventDefault();
  $$('.col.is-over').forEach(c => c !== col && c.classList.remove('is-over'));
  col.classList.add('is-over');
});

document.addEventListener('drop', e => {
  const col = e.target.closest?.('.col');
  if (!col || !dragId) return;
  e.preventDefault();
  col.classList.remove('is-over');
  if (col.dataset.stage === 'lost') { openLost(dragId); dragId = null; return; }
  moveLead(dragId, col.dataset.stage);
});

/* kebab menu + move / open */
document.addEventListener('click', e => {
  const kebab = e.target.closest('.lead__kebab');
  if (kebab) {
    e.stopPropagation();
    const menu = kebab.querySelector('.menu');
    const open = !menu.classList.contains('open');
    $$('.menu.open').forEach(m => m.classList.remove('open'));
    menu.classList.toggle('open', open);
    kebab.setAttribute('aria-expanded', String(open));
    return;
  }

  const move = e.target.closest('[data-move]');
  if (move) {
    e.stopPropagation();
    const leadId = move.closest('.lead').dataset.id;
    $$('.menu.open').forEach(m => m.classList.remove('open'));
    if (move.dataset.move === 'lost') { openLost(leadId); return; }
    moveLead(leadId, move.dataset.move);
    return;
  }

  const open = e.target.closest('[data-open]');
  if (open) {
    location.href = `/lead.html?id=${open.closest('.lead').dataset.id}`;
    return;
  }

  const act = e.target.closest('[data-act]');
  if (act) {
    e.stopPropagation();
    const l = LEADS.find(x => x.id === act.closest('[data-id]')?.dataset.id);
    if (!l) return;
    if (act.dataset.act === 'call' && l.phone)     location.href = `tel:${l.phone.replace(/\s/g,'')}`;
    else if (act.dataset.act === 'WhatsApp' && l.phone) window.open(`https://wa.me/91${l.phone.replace(/\D/g,'').slice(-10)}`, '_blank');
    else toast(`No contact number saved for ${l.name}`, 'err');
  }
});

/* ---------------------------------------------------------------
   add lead — uses the designed dialog, not window.prompt
--------------------------------------------------------------- */
wireModalDismiss();

function openAdd(stage = 'new') {
  const m = openModal('addModal');
  if (!m) return toast('Add-lead dialog is missing from this page', 'err');
  m.dataset.stage = stage;
  ['nlName','nlBudget','nlLoc'].forEach(id => setVal(id, ''));
}

$('#addLeadBtn')?.addEventListener('click', () => openAdd());
document.addEventListener('click', e => {
  const a = e.target.closest('[data-addto]');
  if (a) openAdd(a.dataset.addto);
});

$('#saveLead')?.addEventListener('click', async () => {
  const name = val('nlName');
  if (!name) return toast('Give the lead a name', 'err');

  const stage = $('#addModal')?.dataset.stage || 'new';
  const { error } = await supabase.from('leads').insert({
    name,
    phone:   val('nlPhone') || '',
    service: val('nlType') || 'Turnkey construction',
    budget:  Number(val('nlBudget')) || 0,
    area:    val('nlLoc') || 'Chennai',
    source:  val('nlSource') || 'Direct',
    stage_key: stage,
    business_unit_id: activeUnit(),
    owner_id: user.id,
    assigned_to: user.id,
    last_contact_at: new Date().toISOString()
  });

  if (error) return fail(error);
  closeAllModals();
  toast(`${name} added`);
  await load();
});

/* ---------------------------------------------------------------
   mark lost — capture the reason in the dialog
--------------------------------------------------------------- */
let lostId = null;

function openLost(id) {
  lostId = id;
  setVal('lostNote', '');
  if (!openModal('lostModal')) moveLead(id, 'lost');   // fall back if absent
}

$('#confirmLost')?.addEventListener('click', async () => {
  if (!lostId) return;
  const reason = val('lostNote');
  const { error } = await supabase.from('leads')
    .update({ lost_reason: reason }).eq('id', lostId);
  if (error) return fail(error);
  closeAllModals();
  await moveLead(lostId, 'lost');
  lostId = null;
});

/* card click / keyboard -> details */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const card = e.target.closest?.('.lead');
  if (card) location.href = `/lead.html?id=${card.dataset.id}`;
});

/* filters */
['#fQ', '#fSource', '#fBudget', '#fPrio'].forEach(sel => {
  $(sel)?.addEventListener('input', render);
  $(sel)?.addEventListener('change', render);
});
$('#fClear')?.addEventListener('click', () => {
  ['#fQ', '#fSource', '#fBudget', '#fPrio'].forEach(s => { const el = $(s); if (el) el.value = ''; });
  render();
});

/* board / list toggle */
$('#viewKanban')?.addEventListener('click', () => {
  $('#boardView')?.classList.remove('off');
  $('#listView')?.classList.add('off');
  $('#viewKanban').classList.add('is-active');
  $('#viewList')?.classList.remove('is-active');
});
$('#viewList')?.addEventListener('click', () => {
  $('#listView')?.classList.remove('off');
  $('#boardView')?.classList.add('off');
  $('#viewList').classList.add('is-active');
  $('#viewKanban')?.classList.remove('is-active');
});

/* live updates from other users */
supabase.channel('leads-board')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, load)
  .subscribe();

await load();

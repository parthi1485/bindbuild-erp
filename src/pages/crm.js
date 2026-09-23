import { supabase } from '../lib/supabase.js';
import { mountShell, activeUnit, scopeToUnit } from '../lib/shell.js';
import { nextErpNumber } from '../lib/numbering.js';
import { toast, fail, esc, openModal, closeAllModals, wireModalDismiss, val } from '../lib/ui.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'crm', title: 'CRM · Leads' });
if (!user) throw new Error('redirecting');

const STAGES = [
  { id:'new',       name:'New',                color:'#5a8dee' },
  { id:'contacted', name:'Contacted',          color:'#a78bfa' },
  { id:'meeting',   name:'Site / Office Meet', color:'#f0b45a' },
  { id:'proposal',  name:'Proposal',           color:'#41d1a0' },
  { id:'follow_up', name:'Follow-up',          color:'#38bdf8' },
  { id:'won',       name:'Won',                color:'#41d1a0' },
  { id:'lost',      name:'Lost',               color:'#f2708a' }
];
const ACTIVE = STAGES.filter(s => !['won','lost'].includes(s.id)).map(s => s.id);

let LEADS = [];
let selectedPriority = 'warm';
let pendingLostId = null;

const rupees = n => {
  const v = Number(n || 0);
  if (v >= 1e7) return '₹' + (v/1e7).toFixed(2).replace(/\.00$/,'').replace(/0$/,'') + 'Cr';
  if (v >= 1e5) return '₹' + (v/1e5).toFixed(1).replace(/\.0$/,'') + 'L';
  return '₹' + Math.round(v).toLocaleString('en-IN');
};
const daysIn = row => Math.max(0, Math.floor((Date.now() - new Date(row.updated_at || row.created_at)) / 86400000));
const stageName = id => STAGES.find(s => s.id === id)?.name || id || 'New';

const toCard = r => ({
  id:r.id,
  leadNo:r.lead_no || '—',
  name:r.name || 'Untitled lead',
  proj:r.service || '—',
  loc:r.area || r.city || '—',
  value:Number(r.expected_value || 0),
  src:r.source || 'Direct',
  prio:r.priority || 'warm',
  stage:r.stage || 'new',
  days:daysIn(r),
  phone:r.phone || '',
  email:r.email || '',
  notes:r.notes || '',
  createdAt:r.created_at || null
});

async function load() {
  const q = scopeToUnit(
    supabase.from('leads').select('*').is('deleted_at', null)
  ).order('updated_at', { ascending:false });

  const { data, error } = await q;
  if (error) return fail(error);
  LEADS = (data || []).map(toCard);
  render();
}

const filters = {
  get q(){ return ($('#fQ')?.value || '').trim().toLowerCase(); },
  get source(){ return $('#fSource')?.value || ''; },
  get budget(){ return $('#fBudget')?.value || ''; },
  get prio(){ return $('#fPrio')?.value || ''; }
};

function passes(l) {
  if (filters.q && ![l.leadNo,l.name,l.proj,l.loc,l.phone,l.email].join(' ').toLowerCase().includes(filters.q)) return false;
  if (filters.source && l.src.toLowerCase() !== filters.source.toLowerCase()) return false;
  if (filters.prio && l.prio !== filters.prio) return false;
  if (filters.budget === 's' && l.value >= 5e6) return false;
  if (filters.budget === 'm' && (l.value < 5e6 || l.value > 1e7)) return false;
  if (filters.budget === 'l' && l.value <= 1e7) return false;
  return true;
}

function leadCard(l) {
  return `<article class="lead" draggable="true" data-id="${l.id}" tabindex="0">
    <div class="lead__top">
      <span class="lead__prio lead__prio--${esc(l.prio)}"></span>
      <span class="lead__name">${esc(l.name)}</span>
      <div class="lead__menu-wrap">
        <button class="lead__kebab" type="button" aria-label="Lead actions" aria-expanded="false">⋯</button>
        <div class="menu" role="menu">
          <div class="menu__label">Move to</div>
          ${STAGES.filter(s=>s.id!==l.stage).map(s=>`<button class="menu__item" type="button" data-move="${s.id}">${esc(s.name)}</button>`).join('')}
          <div class="menu__rule"></div>
          <button class="menu__item" type="button" data-open>Open lead details</button>
        </div>
      </div>
    </div>
    <p class="lead__proj">${esc(l.proj)}</p>
    <p class="lead__loc">${esc(l.loc)}</p>
    <div class="lead__foot">
      <strong class="lead__budget">${rupees(l.value)}</strong>
      <span class="src">${esc(l.src)}</span>
      <span class="lead__days">${l.days}d</span>
    </div>
    <small style="display:block;margin-top:8px;opacity:.65">${esc(l.leadNo)}</small>
  </article>`;
}

function column(stage, rows) {
  const total = rows.reduce((s,l)=>s+l.value,0);
  return `<section class="col" data-stage="${stage.id}">
    <header class="col__head">
      <span class="col__dot" style="background:${stage.color}"></span>
      <h2 class="col__name">${esc(stage.name)}</h2>
      <span class="col__count">${rows.length}</span>
      <small class="col__value">${total ? rupees(total) : '—'}</small>
    </header>
    <div class="col__body" data-drop="${stage.id}">
      ${rows.map(leadCard).join('') || '<div class="col__empty">No leads</div>'}
    </div>
  </section>`;
}

function renderBoard(rows) {
  const board = $('#board');
  if (!board) return;
  board.innerHTML = STAGES.map(s => column(s, rows.filter(l=>l.stage===s.id))).join('');
}

function renderList(rows) {
  const body = $('#tbody');
  if (!body) return;
  body.innerHTML = rows.length ? rows.map(l => `<tr data-id="${l.id}">
    <td><b>${esc(l.name)}</b><small>${esc(l.leadNo)} · ${esc(l.phone || 'No phone')}</small></td>
    <td>${esc(l.proj)}<small>${esc(l.loc)}</small></td>
    <td><b>${rupees(l.value)}</b></td>
    <td>${esc(l.src)}</td>
    <td><span class="badge">${esc(stageName(l.stage))}</span></td>
    <td>${l.days} days</td>
    <td><button class="btn-ghost" data-open>Open</button></td>
  </tr>`).join('') : '<tr><td colspan="7">No matching leads.</td></tr>';
}

function renderKpis(rows) {
  const active = rows.filter(l=>ACTIVE.includes(l.stage));
  const pipeline = active.reduce((s,l)=>s+l.value,0);
  if ($('#kpiValue')) $('#kpiValue').textContent = rupees(pipeline);
  if ($('#kpiActive')) $('#kpiActive').textContent = String(active.length);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const createdThisMonth = rows.filter(l => l.createdAt && new Date(l.createdAt) >= startOfMonth);
  const addedThisMonth = createdThisMonth.reduce((sum, l) => sum + l.value, 0);
  const newThisWeek = rows.filter(l => l.createdAt && new Date(l.createdAt) >= sevenDaysAgo).length;
  const idle = active.filter(l => l.days > 7).length;
  const cards = $('.kpis .kpi');
  if (cards[0]) cards[0].querySelector('.kpi__note').innerHTML =
    `<b>${rupees(addedThisMonth)}</b> added this month`;
  if (cards[1]) cards[1].querySelector('.kpi__note').innerHTML =
    `<b>${newThisWeek} new</b> this week · ${idle} idle &gt; 7 days`;

  const closed = rows.filter(l=>['won','lost'].includes(l.stage));
  const won = rows.filter(l=>l.stage==='won');
  const conversion = closed.length ? Math.round(won.length/closed.length*100) : 0;
  if (cards[2]) {
    cards[2].querySelector('.kpi__label').textContent = 'Conversion · closed leads';
    cards[2].querySelector('.kpi__value').textContent = conversion + '%';
    cards[2].querySelector('.kpi__note').textContent = `${won.length} won · ${closed.length - won.length} lost`;
  }
  if (cards[3]) {
    cards[3].querySelector('.kpi__label').textContent = 'Pipeline freshness';
    cards[3].querySelector('.kpi__value').textContent = String(active.filter(l=>l.days<=7).length);
    cards[3].querySelector('.kpi__note').textContent = `${active.filter(l=>l.days>7).length} idle > 7 days`;
  }
}

function render() {
  const rows = LEADS.filter(passes);
  renderKpis(LEADS);
  renderBoard(rows);
  renderList(rows);
  if ($('#fCount')) $('#fCount').textContent = `${rows.length} of ${LEADS.length} leads`;
  $('#fClear')?.classList.toggle('on', !!(filters.q || filters.source || filters.budget || filters.prio));
  wireDnD();
}

async function moveLead(id, stage) {
  if (stage === 'lost') {
    pendingLostId = id;
    openModal('lostModal');
    return;
  }
  const { error } = await supabase.from('leads').update({ stage }).eq('id', id);
  if (error) return fail(error);
  const lead = LEADS.find(x=>x.id===id);
  if (lead) { lead.stage=stage; lead.days=0; }
  toast(`Moved to ${stageName(stage)}`);
  render();
}

function wireDnD() {
  $$('.lead[draggable="true"]').forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  $$('[data-drop]').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.closest('.col')?.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.closest('.col')?.classList.remove('drag-over'));
    zone.addEventListener('drop', async e => {
      e.preventDefault(); zone.closest('.col')?.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      if (id) await moveLead(id, zone.dataset.drop);
    });
  });
}

$('#addLeadBtn')?.addEventListener('click', () => openModal('addModal'));
wireModalDismiss();

$$('[data-prio]').forEach(btn => btn.addEventListener('click', () => {
  selectedPriority = btn.dataset.prio;
  $$('[data-prio]').forEach(x => {
    x.classList.remove('on--hot','on--warm','on--cold');
    x.setAttribute('aria-pressed','false');
  });
  btn.classList.add('on--' + selectedPriority);
  btn.setAttribute('aria-pressed','true');
}));

$('#saveLead')?.addEventListener('click', async () => {
  const name = val('nlName');
  if (!name) return toast('Enter the lead name', 'err');

  const rawPhone = val('nlPhone').replace(/\D/g,'');
  if (rawPhone && rawPhone.length < 10) return toast('Enter a valid mobile number', 'err');

  const budgetLakhs = Number(val('nlBudget') || 0);
  let leadNo;
  try {
    leadNo = await nextErpNumber('lead');
  } catch (error) {
    return fail(error);
  }

  const payload = {
    business_unit_id: activeUnit(),
    lead_no: leadNo,
    name,
    phone: rawPhone || null,
    email: val('nlEmail') || null,
    area: val('nlLoc') || null,
    city: 'Chennai',
    service: val('nlType') || null,
    source: val('nlSource') || 'Direct',
    expected_value: budgetLakhs * 100000,
    stage: 'new',
    priority: selectedPriority,
    owner_id: user.id
  };

  const { error } = await supabase.from('leads').insert(payload);
  if (error) return fail(error);

  closeAllModals();
  ['nlName','nlPhone','nlEmail','nlBudget','nlLoc'].forEach(id => { const e=$('#'+id); if(e) e.value=''; });
  toast(`Lead ${leadNo} created`);
  await load();
if(new URLSearchParams(location.search).get('new')==='1'){
  history.replaceState(null,'','/crm.html');
  openModal('addModal');
}
});

$('#confirmLost')?.addEventListener('click', async () => {
  if (!pendingLostId) return closeAllModals();
  const reason = $('input[name="lr"]:checked')?.value || 'Lost';
  const note = val('lostNote');
  const lead = LEADS.find(x=>x.id===pendingLostId);
  const existing = lead?.notes ? lead.notes + '\n' : '';
  const notes = `${existing}Lost reason: ${reason}${note ? ' — ' + note : ''}`;

  const { error } = await supabase.from('leads').update({ stage:'lost', notes }).eq('id', pendingLostId);
  if (error) return fail(error);

  if (lead) { lead.stage='lost'; lead.notes=notes; lead.days=0; }
  pendingLostId = null;
  closeAllModals();
  toast('Lead marked lost');
  render();
});

document.addEventListener('click', async e => {
  const kebab = e.target.closest('.lead__kebab');
  if (kebab) {
    e.preventDefault();
    e.stopPropagation();
    const wrap = kebab.closest('.lead__menu-wrap');
    const menu = wrap?.querySelector('.menu');
    $('.lead .menu').forEach(m => {
      if (m !== menu) {
        m.style.display = 'none';
        m.closest('.lead__menu-wrap')?.querySelector('.lead__kebab')?.setAttribute('aria-expanded','false');
      }
    });
    if (menu) {
      const open = menu.style.display === 'block';
      menu.style.display = open ? 'none' : 'block';
      kebab.setAttribute('aria-expanded', open ? 'false' : 'true');
    }
    return;
  }

  const move = e.target.closest('[data-move]');
  if (move) {
    e.preventDefault();
    e.stopPropagation();
    const host = move.closest('[data-id]');
    if (host) await moveLead(host.dataset.id, move.dataset.move);
    return;
  }

  const open = e.target.closest('[data-open]');
  if (open) {
    e.preventDefault();
    const host = open.closest('[data-id]');
    if (host) location.href = `/lead.html?id=${encodeURIComponent(host.dataset.id)}`;
    return;
  }

  const row = e.target.closest('tr[data-id]');
  if (row && !e.target.closest('button')) location.href = `/lead.html?id=${encodeURIComponent(row.dataset.id)}`;
});

['fQ','fSource','fBudget','fPrio'].forEach(id => $('#'+id)?.addEventListener('input', render));
$('#fClear')?.addEventListener('click', () => {
  ['fQ','fSource','fBudget','fPrio'].forEach(id => { const e=$('#'+id); if(e) e.value=''; });
  render();
});

$('#viewKanban')?.addEventListener('click', () => {
  $('#boardView')?.classList.remove('off');
  $('#listView')?.classList.remove('on');
  $('#viewKanban')?.classList.add('is-on');
  $('#viewList')?.classList.remove('is-on');
});
$('#viewList')?.addEventListener('click', () => {
  $('#boardView')?.classList.add('off');
  $('#listView')?.classList.add('on');
  $('#viewList')?.classList.add('is-on');
  $('#viewKanban')?.classList.remove('is-on');
});

await load();

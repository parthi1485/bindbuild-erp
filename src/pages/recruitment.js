import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'hr', title: 'Recruitment' });
if (!user) throw new Error('redirecting');

const canHr = ['owner','admin','hr'].some(r => user.roles.includes(r));

const STAGES = [
  { id: 'applied',   name: 'Applied' },
  { id: 'screening', name: 'Screening' },
  { id: 'interview', name: 'Interview' },
  { id: 'offer',     name: 'Offer' },
  { id: 'hired',     name: 'Hired' }
];

let CAND = [], OPENINGS = [], IVS = [];
let fRole = '';

async function load() {
  const [cRes, oRes, iRes] = await Promise.all([
    supabase.from('candidates').select('*, job_openings(title)').order('updated_at', { ascending: false }),
    supabase.from('job_openings').select('*').order('posted_on', { ascending: false }),
    supabase.from('interviews')
      .select('*, candidates(name), interviewer:interviewer_id(full_name)')
      .gte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(8)
  ]);

  if (cRes.error && !canHr) {
    toast('Candidate data is restricted to HR', 'err');
  } else if (cRes.error) {
    return fail(cRes.error);
  }

  CAND     = cRes.data ?? [];
  OPENINGS = oRes.data ?? [];
  IVS      = iRes.data ?? [];

  fillRoles();
  render();
}

function fillRoles() {
  const sel = $('#roleFilter');
  if (!sel || sel.dataset.filled) return;
  OPENINGS.forEach(o => sel.add(new Option(o.title, o.id)));
  sel.dataset.filled = '1';
}

const passes = c => !fRole || c.opening_id === fRole;

function render() {
  const rows = CAND.filter(passes);

  const kan = $('#kan');
  if (kan) {
    kan.innerHTML = STAGES.map(s => {
      const items = rows.filter(c => c.stage === s.id);
      return `<section class="kcol" data-stage="${s.id}">
        <header class="kcol__head"><span>${s.name}</span><span class="kcol__n">${items.length}</span></header>
        <div class="kcol__body">${
          items.length ? items.map(c => `
            <article class="kc" draggable="true" data-id="${c.id}">
              <div class="kc__top"><span class="kc__av">${esc(initials(c.name))}</span>
                <span class="kc__nm">${esc(c.name)}</span></div>
              <div class="kc__role">${esc(c.job_openings?.title || 'No opening')}</div>
              <div class="kc__meta">
                ${c.experience_yrs ? `<span>${c.experience_yrs}y</span>` : ''}
                ${c.expected_ctc ? `<span>₹${(Number(c.expected_ctc)/100000).toFixed(1)}L</span>` : ''}
                <span class="kc__src">${esc(c.source || '')}</span>
              </div>
            </article>`).join('')
          : '<div class="kcol__empty">Empty</div>'
        }</div>
      </section>`;
    }).join('');
  }

  const fn = $('#funnel');
  if (fn) {
    const top = Math.max(...STAGES.map(s => rows.filter(c => c.stage === s.id).length), 1);
    fn.innerHTML = STAGES.map((s, i) => {
      const n = rows.filter(c => c.stage === s.id).length;
      const prev = i ? rows.filter(c => c.stage === STAGES[i-1].id).length : n;
      const conv = i ? (prev ? Math.round(n / prev * 100) : 0) : 100;
      return `<div class="fnr">
        <span class="fnr__nm">${s.name}</span>
        <span class="fnr__bar"><span class="fnr__fill" style="width:${Math.round(n/top*100)}%">${n}</span></span>
        <span class="fnr__cv">${i ? conv + '%' : `${n} in`}</span>
      </div>`;
    }).join('');
  }

  const set = (id, v) => { const x = document.getElementById(id); if (x) x.textContent = v; };
  set('kInterview', String(rows.filter(c => c.stage === 'interview').length));
  set('kOffer', String(rows.filter(c => c.stage === 'offer').length));

  const iv = $('#ivs');
  if (iv) {
    iv.innerHTML = IVS.length
      ? IVS.map(i => {
          const d = new Date(i.scheduled_at);
          return `<li class="ivr">
            <span class="ivr__date"><b>${String(d.getDate()).padStart(2,'0')}</b><span>${d.toLocaleString('en-IN',{month:'short'}).toUpperCase()}</span></span>
            <span class="ivr__body">
              <span class="ivr__nm">${esc(i.candidates?.name || '—')}</span>
              <span class="ivr__meta">${d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})} · ${esc(i.round_name || '')} · ${esc(i.interviewer?.full_name || 'unassigned')}</span>
            </span>
          </li>`;
        }).join('')
      : '<li class="ivr"><span class="ivr__body">No interviews scheduled</span></li>';
  }

  const srcs = $('#srcs');
  if (srcs) {
    const map = new Map();
    rows.forEach(c => map.set(c.source || 'Unknown', (map.get(c.source || 'Unknown') || 0) + 1));
    const list = [...map].sort((a,b) => b[1]-a[1]);
    const top2 = Math.max(...list.map(l => l[1]), 1);
    srcs.innerHTML = list.length
      ? list.map(([nm, n]) => `<div class="sr">
          <span class="sr__nm">${esc(nm)}</span>
          <span class="sr__bar"><span class="sr__fill" style="width:${Math.round(n/top2*100)}%"></span></span>
          <span class="sr__n">${n}</span></div>`).join('')
      : '<div class="t-empty">No candidates yet</div>';
  }
}

/* drag between stages */
let dragId = null;
document.addEventListener('dragstart', e => {
  const c = e.target.closest?.('.kc');
  if (!c) return;
  dragId = c.dataset.id; c.classList.add('is-dragging');
});
document.addEventListener('dragend', e => {
  e.target.closest?.('.kc')?.classList.remove('is-dragging');
  $$('.kcol.is-over').forEach(c => c.classList.remove('is-over'));
  dragId = null;
});
document.addEventListener('dragover', e => {
  const col = e.target.closest?.('.kcol');
  if (!col) return;
  e.preventDefault();
  $$('.kcol.is-over').forEach(c => c !== col && c.classList.remove('is-over'));
  col.classList.add('is-over');
});
document.addEventListener('drop', async e => {
  const col = e.target.closest?.('.kcol');
  if (!col || !dragId) return;
  e.preventDefault();
  col.classList.remove('is-over');

  const cand = CAND.find(c => c.id === dragId);
  if (!cand || cand.stage === col.dataset.stage) return;

  const prev = cand.stage;
  cand.stage = col.dataset.stage;
  render();

  const { error } = await supabase.from('candidates')
    .update({ stage: col.dataset.stage }).eq('id', cand.id);
  if (error) { cand.stage = prev; render(); return fail(error); }
  toast(`${cand.name} moved to ${STAGES.find(s => s.id === col.dataset.stage)?.name}`);
});

$('#roleFilter')?.addEventListener('change', e => { fRole = e.target.value; render(); });

await load();

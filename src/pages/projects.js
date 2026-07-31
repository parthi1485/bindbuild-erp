import { supabase } from '../lib/supabase.js';
import { mountShell, activeUnit, scopeToUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, initials } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'projects', title: 'Projects' });
if (!user) throw new Error('redirecting');

/* contract_value is in lakhs, matching leads.budget */
const money = l => l >= 100
  ? '₹' + (l / 100).toFixed(2).replace(/\.00$/, '') + 'Cr'
  : '₹' + Math.round(l) + 'L';

const HEALTH_LABEL = { ontrack: 'On track', atrisk: 'At risk', delayed: 'Delayed', hold: 'On hold' };
const TYPE_CLASS   = { residential: 'res', interior: 'int', commercial: 'com', industrial: 'ind', landscape: 'lan' };
const TYPE_LABEL   = { residential: 'Residential', interior: 'Interior', commercial: 'Commercial', industrial: 'Industrial', landscape: 'Landscape' };
const PIN = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';

let PROJECTS = [];
let filterType = '', filterHealth = '', sortBy = 'progress';

const burnClass = p => p.burn_pct > p.progress_pct + 8 ? 'over'
                     : p.burn_pct > p.progress_pct ? 'warn' : 'ok';

async function load() {
  const { data, error } = await scopeToUnit(supabase
    .from('projects')
    .select('*, clients(name), profiles!projects_pm_id_fkey(full_name)'))
    .neq('status', 'cancelled')
    .order('updated_at', { ascending: false });

  if (error) {
    /* the embedded FK name can differ; fall back to a plain select */
    const plain = await supabase.from('projects').select('*')
      .neq('status', 'cancelled').order('updated_at', { ascending: false });
    if (plain.error) return fail(plain.error);
    PROJECTS = plain.data;
  } else {
    PROJECTS = data;
  }

  render();
}

function visible() {
  let rows = PROJECTS.slice();
  if (filterType)   rows = rows.filter(p => p.project_type === filterType);
  if (filterHealth) rows = rows.filter(p => p.health === filterHealth);

  const cmp = {
    progress: (a, b) => b.progress_pct - a.progress_pct,
    value:    (a, b) => Number(b.contract_value) - Number(a.contract_value),
    name:     (a, b) => a.name.localeCompare(b.name),
    deadline: (a, b) => (a.target_end_date || '9999').localeCompare(b.target_end_date || '9999')
  }[sortBy];

  return cmp ? rows.sort(cmp) : rows;
}

function cardHTML(p) {
  const value = Number(p.contract_value) || 0;
  const spent = value * p.burn_pct / 100;
  const client = p.clients?.name || '—';
  const pm = p.profiles?.full_name ? initials(p.profiles.full_name) : '··';

  return `<article class="pcard" data-id="${p.id}" tabindex="0" role="button"
      aria-label="${esc(p.name)} — ${HEALTH_LABEL[p.health]}, ${p.progress_pct}% complete">
    <div class="pcard__cover ${TYPE_CLASS[p.project_type] || 'res'}">
      <span class="pcard__type">${esc(TYPE_LABEL[p.project_type] || p.project_type)}</span>
      <span class="pcard__code">${esc(p.code)}</span>
    </div>
    <div class="pcard__body">
      <div class="pcard__top">
        <div style="min-width:0">
          <div class="pcard__name">${esc(p.name)}</div>
          <div class="pcard__client">${esc(client)}</div>
          <div class="pcard__loc">${PIN}${esc(p.location || '—')}</div>
        </div>
        <span class="health ${p.health}"><span class="hd"></span>${HEALTH_LABEL[p.health]}</span>
      </div>
      <div class="pcard__metrics">
        <div>
          <div class="metric__row"><span>Progress</span><b>${p.progress_pct}%</b></div>
          <div class="bar"><div class="bar__fill prog" data-w="${p.progress_pct}"></div></div>
        </div>
        <div>
          <div class="metric__row"><span>Budget burn</span><b>${money(spent)} / ${money(value)}</b></div>
          <div class="bar"><div class="bar__fill ${burnClass(p)}" data-w="${p.burn_pct}"></div></div>
        </div>
      </div>
      <div class="pcard__foot">
        <div class="milestone">
          <div class="milestone__lbl">Next milestone</div>
          <div class="milestone__val">${esc(p.next_milestone || 'Not set')}</div>
          <div class="milestone__date">${p.next_milestone_date ? fmtDate(p.next_milestone_date) : '—'}</div>
        </div>
        <span class="pm" title="Project lead">${esc(pm)}</span>
      </div>
    </div>
  </article>`;
}

function render() {
  const rows = visible();
  const grid = $('#pgrid');
  const empty = $('#empty');

  if (grid) grid.innerHTML = rows.map(cardHTML).join('');
  if (empty) empty.hidden = rows.length > 0;

  requestAnimationFrame(() => {
    $$('#pgrid .bar__fill').forEach(b => b.style.width = b.dataset.w + '%');
  });

  /* summary strip */
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const active = PROJECTS.filter(p => p.status === 'active');
  set('stTotal', String(active.length));
  set('stValue', money(active.reduce((a, p) => a + Number(p.contract_value || 0), 0)));
  set('stHealthy', String(active.filter(p => p.health === 'ontrack').length));
  set('stAttention', String(active.filter(p => ['atrisk','delayed','hold'].includes(p.health)).length));
}

/* ---------------------------------------------------------------
   filters
--------------------------------------------------------------- */
$('#typeChips')?.addEventListener('click', e => {
  const chip = e.target.closest('[data-type]');
  if (!chip) return;
  filterType = chip.dataset.type === filterType ? '' : chip.dataset.type;
  $$('#typeChips [data-type]').forEach(c => c.classList.toggle('is-on', c.dataset.type === filterType));
  render();
});

$('#healthSeg')?.addEventListener('click', e => {
  const b = e.target.closest('[data-health]');
  if (!b) return;
  filterHealth = b.dataset.health === 'all' ? '' : b.dataset.health;
  $$('#healthSeg [data-health]').forEach(x => x.classList.toggle('is-on', x === b));
  render();
});

$('#sortSel')?.addEventListener('change', e => { sortBy = e.target.value; render(); });

$('#gridBtn')?.addEventListener('click', () => {
  $('#pgrid')?.classList.remove('is-list');
  $('#gridBtn').classList.add('is-on'); $('#listBtn')?.classList.remove('is-on');
});
$('#listBtn')?.addEventListener('click', () => {
  $('#pgrid')?.classList.add('is-list');
  $('#listBtn').classList.add('is-on'); $('#gridBtn')?.classList.remove('is-on');
});

/* open a project */
document.addEventListener('click', e => {
  const card = e.target.closest('.pcard[data-id]');
  if (card) location.href = `/project.html?id=${card.dataset.id}`;
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const card = e.target.closest?.('.pcard[data-id]');
  if (card) location.href = `/project.html?id=${card.dataset.id}`;
});

/* ---------------------------------------------------------------
   new project
--------------------------------------------------------------- */
$('#pgNewBtn')?.addEventListener('click', async () => {
  const name = prompt('Project name');
  if (!name) return;

  /* next code in sequence */
  const { data: last } = await supabase.from('projects')
    .select('code').order('code', { ascending: false }).limit(1);
  const n = last?.length ? (parseInt(String(last[0].code).replace(/\D/g, ''), 10) || 0) + 1 : 1;
  const code = 'PRJ-' + String(n).padStart(3, '0');

  const { data, error } = await supabase.from('projects')
    .insert({ code, name, pm_id: user.id, status: 'active',
              business_unit_id: activeUnit() })
    .select('id').single();

  if (error) return fail(error);
  toast(`${code} created`);
  location.href = `/project.html?id=${data.id}`;
});

$('#exportBtn')?.addEventListener('click', () => {
  const rows = [['Code','Name','Client','Type','Location','Value (L)','Progress %','Burn %','Health','Status']]
    .concat(visible().map(p => [
      p.code, p.name, p.clients?.name || '', p.project_type, p.location || '',
      p.contract_value, p.progress_pct, p.burn_pct, p.health, p.status
    ]));
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `bindbuild-projects-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('Projects exported');
});

await load();

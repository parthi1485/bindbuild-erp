import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'site-visits', title: 'Site progress' });
if (!user) throw new Error('redirecting');

let projectId = new URLSearchParams(location.search).get('project') || '';
let PROJECTS = [], SNAPS = [], PHASES = [], ITEMS = [], PHOTOS = [];

const cssVar = c => c.startsWith('var(')
  ? getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim() || '#5a8dee'
  : c;

async function load() {
  const { data: projects, error } = await supabase
    .from('projects').select('id,code,name,progress_pct').order('name');
  if (error) return fail(error);

  PROJECTS = projects ?? [];
  if (!PROJECTS.length) return toast('No projects yet', 'err');
  if (!projectId) projectId = PROJECTS[0].id;

  const [sn, ph, it, ph2] = await Promise.all([
    supabase.from('progress_snapshots').select('*').eq('project_id', projectId).order('week_ending'),
    supabase.from('project_phases').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('schedule_items').select('*').eq('project_id', projectId),
    supabase.from('site_photos').select('*').eq('project_id', projectId).order('taken_on', { ascending: false }).limit(24)
  ]);

  SNAPS = sn.data ?? []; PHASES = ph.data ?? []; ITEMS = it.data ?? []; PHOTOS = ph2.data ?? [];

  const crumb = $('.crumbs .here');
  const p = PROJECTS.find(x => x.id === projectId);
  if (crumb && p) crumb.textContent = `${p.code} progress`;

  drawCurve();
  drawStages();
  await drawGallery();
}

/* ---------- planned vs actual S-curve ---------- */
function drawCurve() {
  const c = $('#curveChart');
  if (!c || !window.Chart) return;

  if (!SNAPS.length) {
    const wrap = c.parentElement;
    if (wrap) wrap.insertAdjacentHTML('beforeend',
      '<p class="t-empty">No weekly snapshots yet. Add rows to progress_snapshots to plot the S-curve.</p>');
    return;
  }

  new window.Chart(c, {
    type: 'line',
    data: {
      labels: SNAPS.map(s => fmtDate(s.week_ending)),
      datasets: [
        { label: 'Planned', data: SNAPS.map(s => Number(s.planned_pct)),
          borderColor: cssVar('var(--text-3)'), borderDash: [5, 4], tension: .3, pointRadius: 0 },
        { label: 'Actual',  data: SNAPS.map(s => Number(s.actual_pct)),
          borderColor: cssVar('var(--accent)'), backgroundColor: 'rgba(90,141,238,.13)',
          fill: true, tension: .3, pointRadius: 3 }
      ]
    },
    options: {
      plugins: { legend: { display: true, position: 'bottom' } },
      scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } },
                x: { grid: { display: false } } },
      maintainAspectRatio: false
    }
  });
}

/* ---------- per-phase completion ---------- */
function drawStages() {
  const el = $('#stageList');
  if (!el) return;

  const rows = PHASES.map(p => {
    const items = ITEMS.filter(i => i.phase_id === p.id);
    const pct = items.length
      ? Math.round(items.reduce((a, i) => a + i.progress_pct, 0) / items.length)
      : 0;
    return { name: p.name, color: p.color, pct, n: items.length };
  });

  el.innerHTML = rows.length
    ? rows.map(r => `
        <li class="stage">
          <span class="stage__dot" style="background:${r.color}"></span>
          <span class="stage__name">${esc(r.name)}</span>
          <span class="stage__bar"><span class="stage__fill" style="width:${r.pct}%;background:${r.color}"></span></span>
          <span class="stage__pct">${r.pct}%</span>
        </li>`).join('')
    : '<li class="t-empty">No phases defined for this project</li>';

  const trades = $('#trades');
  if (trades) {
    const done = rows.filter(r => r.pct >= 100).length;
    trades.textContent = rows.length ? `${done} of ${rows.length} phases complete` : '—';
  }
}

/* ---------- photo gallery (signed URLs, private bucket) ---------- */
async function drawGallery() {
  const el = $('#gallery');
  const count = $('#shotCount');
  if (count) count.textContent = String(PHOTOS.length);
  if (!el) return;

  if (!PHOTOS.length) {
    el.innerHTML = '<p class="t-empty">No site photos yet. Upload them from a daily site report.</p>';
    return;
  }

  const { data, error } = await supabase.storage
    .from('site-photos')
    .createSignedUrls(PHOTOS.map(p => p.storage_path), 3600);
  if (error) return fail(error);

  el.innerHTML = PHOTOS.map((p, i) => {
    const url = data[i]?.signedUrl;
    return url
      ? `<figure class="shot">
           <img src="${url}" alt="${esc(p.caption || 'Site photo')}" loading="lazy" />
           <figcaption>${esc(p.caption || '')}<span>${fmtDate(p.taken_on)}</span></figcaption>
         </figure>`
      : '';
  }).join('');
}

await load();

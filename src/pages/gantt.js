import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'projects', title: 'Schedule' });
if (!user) throw new Error('redirecting');

let projectId = new URLSearchParams(location.search).get('project') || '';
let PHASES = [], ITEMS = [], MILES = [], PROJECTS = [];
let ppd = 2.2;                       // pixels per day

const day  = 86400000;
const fmt  = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const dOf  = s => new Date(s + 'T00:00:00');

let minDate = null;
const idxOf = d => Math.round((d - minDate) / day);

async function load() {
  const { data: projects, error } = await supabase
    .from('projects').select('id,code,name').order('name');
  if (error) return fail(error);

  PROJECTS = projects ?? [];
  if (!PROJECTS.length) return toast('No projects yet', 'err');
  if (!projectId) projectId = PROJECTS[0].id;

  const [ph, it, ms] = await Promise.all([
    supabase.from('project_phases').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('schedule_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('milestones').select('*').eq('project_id', projectId).order('due_date')
  ]);

  PHASES = ph.data ?? []; ITEMS = it.data ?? []; MILES = ms.data ?? [];

  const crumb = $('.crumbs .here');
  const p = PROJECTS.find(x => x.id === projectId);
  if (crumb && p) crumb.textContent = `${p.code} schedule`;

  render();
}

function render() {
  const gantt = $('#gantt');
  if (!gantt) return;

  if (!ITEMS.length && !MILES.length) {
    gantt.innerHTML = `<div class="g-empty">No schedule yet for this project. Add phases and schedule items to see the Gantt.</div>`;
    return 0;
  }

  const allDates = [
    ...ITEMS.flatMap(i => [dOf(i.start_date), dOf(i.end_date)]),
    ...MILES.map(m => dOf(m.due_date))
  ];
  minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  const span = Math.max(idxOf(maxDate) + 14, 30);
  const timelineW = span * ppd;

  /* month header */
  let monthsHTML = '';
  const cur = new Date(minDate);
  cur.setDate(1);
  while (cur <= maxDate) {
    const next = new Date(cur); next.setMonth(next.getMonth() + 1);
    const from = Math.max(idxOf(cur), 0);
    const to   = Math.min(idxOf(next), span);
    monthsHTML += `<span class="g-month" style="left:${from * ppd}px;width:${(to - from) * ppd}px">${
      cur.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</span>`;
    cur.setMonth(cur.getMonth() + 1);
  }

  let linesHTML = '';
  for (let d = 0; d <= span; d += 7) {
    linesHTML += `<span class="g-line" style="left:${d * ppd}px"></span>`;
  }

  let leftRows = '', rightRows = '';

  /* milestones first */
  if (MILES.length) {
    leftRows  += '<div class="g-row g-grp"><span class="g-grp__dot" style="background:var(--warning)"></span>Key milestones</div>';
    rightRows += '<div class="g-row g-grp"></div>';
    leftRows  += `<div class="g-row"><span class="g-tname">Sign-offs &amp; pours</span><span class="g-tprog">${MILES.length}</span></div>`;

    let mHTML = '';
    MILES.forEach(m => {
      const x = idxOf(dOf(m.due_date)) * ppd;
      const col = m.done ? 'var(--success)' : 'var(--warning)';
      mHTML += `<div class="g-mile" style="left:${x}px;background:${col}" title="${esc(m.name)} · ${fmt(m.due_date)}${m.done ? ' · done' : ''}"></div>` +
        `<span style="position:absolute;left:${x + 11}px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--text-3);white-space:nowrap;font-family:var(--font-mono)">${esc(m.name)}</span>`;
    });
    rightRows += `<div class="g-row"><div class="g-track">${mHTML}</div></div>`;
  }

  /* phase groups — items with no phase collect under "Unphased" */
  const groups = PHASES.map(p => ({ ...p, items: ITEMS.filter(i => i.phase_id === p.id) }));
  const orphans = ITEMS.filter(i => !i.phase_id);
  if (orphans.length) groups.push({ name: 'Unphased', color: 'var(--text-3)', items: orphans });

  groups.forEach(ph => {
    if (!ph.items.length) return;
    leftRows  += `<div class="g-row g-grp"><span class="g-grp__dot" style="background:${ph.color}"></span>${esc(ph.name)}</div>`;
    rightRows += '<div class="g-row g-grp"></div>';

    ph.items.forEach(t => {
      const l = idxOf(dOf(t.start_date)) * ppd;
      const w = Math.max((idxOf(dOf(t.end_date)) - idxOf(dOf(t.start_date))) * ppd, 6);
      const done = t.progress_pct >= 100;
      leftRows += `<div class="g-row"><span class="g-tname" title="${esc(t.name)}">${esc(t.name)}</span><span class="g-tprog">${t.progress_pct}%</span></div>`;
      const label = w > 42 ? (t.progress_pct > 0 ? t.progress_pct + '%' : '') : '';
      const tip = `${esc(t.name)} · ${fmt(t.start_date)} → ${fmt(t.end_date)} · ${t.progress_pct}% complete`;
      rightRows += `<div class="g-row"><div class="g-track">` +
        `<div class="g-bar${done ? ' done' : ''}" style="left:${l}px;width:${w}px;background:${ph.color}" title="${tip}">` +
          `<span class="g-bar__fill" style="width:${t.progress_pct}%"></span>` +
          `<span class="g-bar__lb">${label}</span>` +
        `</div></div></div>`;
    });
  });

  const todayPx = idxOf(new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')) * ppd;

  gantt.innerHTML =
    `<div class="g-left"><div class="g-head">Task</div>${leftRows}</div>` +
    `<div class="g-right" style="width:${timelineW}px">` +
      `<div class="g-head">${monthsHTML}</div>` +
      `<div class="g-lines">${linesHTML}</div>` +
      `<div class="g-today" style="left:${todayPx}px"></div>` +
      rightRows +
    `</div>`;

  return todayPx;
}

/* zoom + scroll to today */
const scroller = $('#ganttScroll');
function scrollToToday(px, smooth) {
  if (!scroller) return;
  const target = Math.max(0, px - scroller.clientWidth / 2 + 125);
  scroller.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
}

$$('#zoomSeg button').forEach(b => b.addEventListener('click', () => {
  $$('#zoomSeg button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  ppd = parseFloat(b.dataset.zoom) || 2.2;
  scrollToToday(render(), false);
}));

$('#todayBtn')?.addEventListener('click', () => scrollToToday(render(), true));

await load();
scrollToToday(render(), false);

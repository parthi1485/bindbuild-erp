import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, initials } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'projects', title: 'Project' });
if (!user) throw new Error('redirecting');

let projectId = new URLSearchParams(location.search).get('id') || '';

const money = l => l >= 100
  ? '₹' + (l / 100).toFixed(2).replace(/\.00$/, '') + ' Cr'
  : '₹' + Math.round(l) + ' L';

const HEALTH_LABEL = { ontrack: 'On track', atrisk: 'At risk', delayed: 'Delayed', hold: 'On hold' };
const TYPE_LABEL = { residential: 'Residential', interior: 'Interior', commercial: 'Commercial', industrial: 'Industrial', landscape: 'Landscape' };

let P = null;

async function load() {
  if (!projectId) {
    const { data } = await supabase.from('projects').select('id').limit(1);
    if (!data?.length) return empty('No projects yet. Create one from the Projects page.');
    return location.replace(`/project.html?id=${data[0].id}`);
  }

  const { data, error } = await supabase
    .from('projects').select('*, clients(id,name)').eq('id', projectId).maybeSingle();

  if (error) return fail(error);
  if (!data)  return empty('That project no longer exists.');

  P = data;
  paintHero();
  await Promise.all([paintKpis(), paintTasks(), paintMilestones(), paintReports()]);
  wireLinks();
}

function empty(msg) {
  const n = $('.hero__name');
  if (n) n.textContent = 'No project';
  const m = $('.hero__meta');
  if (m) m.textContent = msg;
  toast(msg, 'err');
}

function paintHero() {
  const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
  set('.hero__name', P.name);
  set('.hero__id', P.code);

  const badge = $('.hero__badge');
  if (badge) {
    badge.textContent = HEALTH_LABEL[P.health] || P.health;
    badge.dataset.health = P.health;
  }

  const meta = $('.hero__meta');
  if (meta) {
    const bits = [
      P.clients?.name || 'No client linked',
      P.code,
      TYPE_LABEL[P.project_type] || P.project_type,
      P.location || '—'
    ];
    meta.innerHTML = bits
      .map(b => `<span class="mi">${esc(b)}</span>`)
      .join('<span class="dotsep"></span>');
  }

  document.title = `${P.code} · ${P.name} · Bind Build ERP`;
  const here = $('.crumbs .here');
  if (here) here.textContent = P.code;
}

async function paintKpis() {
  const value = Number(P.contract_value) || 0;
  const spent = value * P.burn_pct / 100;

  const [{ count: taskTotal }, { count: taskDone }, { data: inv }] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('tasks').select('id', { count: 'exact', head: true })
      .eq('project_id', projectId).eq('board_column', 'done'),
    supabase.from('invoice_balances').select('total,amount_paid').eq('project_id', projectId)
  ]);

  const billed = (inv ?? []).reduce((a, r) => a + Number(r.total || 0), 0);
  const received = (inv ?? []).reduce((a, r) => a + Number(r.amount_paid || 0), 0);

  const kpis = [
    ['Contract value', money(value)],
    ['Progress',       P.progress_pct + '%'],
    ['Budget burn',    `${money(spent)} of ${money(value)}`],
    ['Tasks',          `${taskDone ?? 0} of ${taskTotal ?? 0} done`],
    ['Billed',         '₹' + billed.toLocaleString('en-IN')],
    ['Received',       '₹' + received.toLocaleString('en-IN')],
    ['Target end',     P.target_end_date ? fmtDate(P.target_end_date) : 'Not set']
  ];

  const wrap = $('.hero__kpis');
  if (wrap) {
    wrap.innerHTML = kpis.map(([k, v]) => `
      <div class="kpi">
        <div class="kpi__k">${esc(k)}</div>
        <div class="kpi__v">${esc(v)}</div>
      </div>`).join('');
  }
}

/* fill the first matching panel body, identified by its section title */
function panelBody(titleText) {
  const title = $$('.sec-title').find(t =>
    t.textContent.trim().toLowerCase().includes(titleText.toLowerCase()));
  if (!title) return null;
  const panel = title.closest('.panel') || title.parentElement;
  return panel?.querySelector('.panel__body, ul, tbody') || panel;
}

async function paintTasks() {
  const host = panelBody('task') || panelBody('activity');
  if (!host) return;

  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,board_column,due_date,priority')
    .eq('project_id', projectId)
    .neq('board_column', 'done')
    .order('due_date', { nullsFirst: false })
    .limit(8);

  if (error) return;

  host.innerHTML = data.length
    ? data.map(t => `<li class="prow">
        <span class="prow__dot prio--${t.priority}"></span>
        <span class="prow__txt">${esc(t.title)}</span>
        <span class="prow__meta">${t.due_date ? fmtDate(t.due_date) : '—'}</span>
      </li>`).join('')
    : '<li class="t-empty">No open tasks</li>';
}

async function paintMilestones() {
  const host = panelBody('milestone');
  if (!host) return;

  const { data } = await supabase
    .from('milestones').select('*').eq('project_id', projectId).order('due_date');

  host.innerHTML = data?.length
    ? data.map(m => `<li class="prow ${m.done ? 'is-done' : ''}">
        <span class="prow__dot"></span>
        <span class="prow__txt">${esc(m.name)}</span>
        <span class="prow__meta">${fmtDate(m.due_date)}</span>
      </li>`).join('')
    : '<li class="t-empty">No milestones set</li>';
}

async function paintReports() {
  const host = panelBody('site') || panelBody('report');
  if (!host) return;

  const { data } = await supabase
    .from('site_reports')
    .select('id,report_date,status')
    .eq('project_id', projectId)
    .order('report_date', { ascending: false })
    .limit(6);

  host.innerHTML = data?.length
    ? data.map(r => `<li class="prow">
        <span class="prow__txt"><a href="/dsr.html?project=${projectId}&date=${r.report_date}">DSR ${fmtDate(r.report_date)}</a></span>
        <span class="prow__meta">${esc(r.status)}</span>
      </li>`).join('')
    : `<li class="t-empty"><a href="/dsr.html?project=${projectId}">Log today's site report</a></li>`;
}

/* point the hero action buttons at the sibling pages */
function wireLinks() {
  const map = [
    [/task|board/i,    `/tasks.html?project=${projectId}`],
    [/schedule|gantt/i, `/gantt.html?project=${projectId}`],
    [/progress|site/i,  `/progress.html?project=${projectId}`],
    [/report|dsr/i,     `/dsr.html?project=${projectId}`]
  ];

  $$('.hero__acts a, .hero__acts button, .tabs .tab').forEach(el => {
    const label = el.textContent.trim();
    const hit = map.find(([re]) => re.test(label));
    if (!hit) return;
    if (el.tagName === 'A') el.setAttribute('href', hit[1]);
    else el.addEventListener('click', () => location.href = hit[1]);
  });
}

await load();

import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'site-visits', title: 'Daily site report' });
if (!user) throw new Error('redirecting');

const qs = new URLSearchParams(location.search);
let projectId = qs.get('project') || '';
let reportDate = qs.get('date') || new Date().toISOString().slice(0, 10);

let REPORT = null, PROJECTS = [];
let LABOUR = [], ACTS = [], MATS = [], EQ = [], ISSUES = [];

const TABLES = {
  labour:     { table: 'site_report_labour',     rows: () => LABOUR },
  activities: { table: 'site_report_activities', rows: () => ACTS },
  materials:  { table: 'site_report_materials',  rows: () => MATS },
  equipment:  { table: 'site_report_equipment',  rows: () => EQ },
  issues:     { table: 'site_report_issues',     rows: () => ISSUES }
};

/* ---------------------------------------------------------------
   load
--------------------------------------------------------------- */
async function load() {
  const { data: projects, error: pErr } = await supabase
    .from('projects').select('id,code,name').eq('status', 'active').order('name');
  if (pErr) return fail(pErr);

  PROJECTS = projects ?? [];
  if (!PROJECTS.length) {
    toast('No active projects — create one first', 'err');
    return;
  }
  if (!projectId) projectId = PROJECTS[0].id;

  fillProjectPicker();
  const dateInput = $('#repDate');
  if (dateInput) dateInput.value = reportDate;

  await loadReport();
}

function fillProjectPicker() {
  const sel = $('#repProj');
  if (!sel) return;
  if (sel.tagName === 'SELECT') {
    sel.innerHTML = PROJECTS.map(p =>
      `<option value="${p.id}">${esc(p.code)} · ${esc(p.name)}</option>`).join('');
    sel.value = projectId;
  } else {
    const p = PROJECTS.find(x => x.id === projectId);
    sel.textContent = p ? `${p.code} · ${p.name}` : '—';
  }
}

async function loadReport() {
  const { data, error } = await supabase
    .from('site_reports')
    .select('*')
    .eq('project_id', projectId)
    .eq('report_date', reportDate)
    .maybeSingle();

  if (error) return fail(error);
  REPORT = data;

  if (!REPORT) {
    LABOUR = []; ACTS = []; MATS = []; EQ = []; ISSUES = [];
    paintStatus('draft', 'No report yet for this date');
    renderAll();
    return;
  }

  const [l, a, m, e, i] = await Promise.all([
    supabase.from('site_report_labour').select('*').eq('report_id', REPORT.id).order('sort_order'),
    supabase.from('site_report_activities').select('*').eq('report_id', REPORT.id).order('sort_order'),
    supabase.from('site_report_materials').select('*').eq('report_id', REPORT.id).order('sort_order'),
    supabase.from('site_report_equipment').select('*').eq('report_id', REPORT.id).order('sort_order'),
    supabase.from('site_report_issues').select('*').eq('report_id', REPORT.id).order('sort_order')
  ]);

  LABOUR = l.data ?? []; ACTS = a.data ?? []; MATS = m.data ?? [];
  EQ = e.data ?? [];     ISSUES = i.data ?? [];

  paintStatus(REPORT.status);
  renderAll();
}

function paintStatus(status, note) {
  const badge = $('#statusBadge');
  if (badge) {
    badge.textContent = status === 'approved' ? 'Approved'
                      : status === 'submitted' ? 'Submitted' : 'Draft';
    badge.dataset.status = status;
  }
  const rail = $('#railStatus');
  if (rail) {
    rail.textContent = note || (
      status === 'approved' ? 'Approved — locked'
      : status === 'submitted' ? 'Submitted, awaiting approval'
      : 'Draft — not yet submitted');
  }
  const locked = status !== 'draft';
  ['#submitBtn', '#submitTop'].forEach(s => {
    const b = $(s);
    if (b) { b.disabled = locked; b.textContent = locked ? 'Submitted' : 'Submit report'; }
  });
}

/* ---------------------------------------------------------------
   render
--------------------------------------------------------------- */
function renderAll() {
  renderLabour();
  renderList('#actList', ACTS, r =>
    `${esc(r.description)}${r.qty ? ` — ${r.qty} ${esc(r.unit || '')}` : ''}`);
  renderMaterials();
  renderList('#eqList', EQ, r => `${esc(r.name)} — ${r.hours} h`);
  renderList('#issueList', ISSUES, r =>
    `<span class="sev sev--${esc(r.severity)}"></span>${esc(r.description)}`);
  paintTotals();
}

function renderLabour() {
  const body = $('#mpBody');
  if (!body) return;
  body.innerHTML = LABOUR.length
    ? LABOUR.map(r => `<tr data-kind="labour" data-id="${r.id}">
        <td>${esc(r.trade)}</td>
        <td class="r">${r.planned}</td>
        <td class="r">${r.present}</td>
        <td class="r ${r.present < r.planned ? 'short' : ''}">${r.present - r.planned}</td>
        <td><button class="rm" data-del="labour:${r.id}" aria-label="Remove row">×</button></td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="t-empty">No labour recorded</td></tr>`;

  const plan = LABOUR.reduce((a, r) => a + r.planned, 0);
  const pres = LABOUR.reduce((a, r) => a + r.present, 0);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('mpPlan', String(plan));
  set('mpPresent', String(pres));
}

function renderMaterials() {
  const body = $('#matBody');
  if (!body) return;
  body.innerHTML = MATS.length
    ? MATS.map(r => `<tr data-kind="materials" data-id="${r.id}">
        <td>${esc(r.material)}</td>
        <td class="r">${r.qty}</td>
        <td>${esc(r.unit || '')}</td>
        <td>${esc(r.supplier || '')}</td>
        <td><button class="rm" data-del="materials:${r.id}" aria-label="Remove row">×</button></td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="t-empty">No materials received</td></tr>`;
}

function renderList(sel, rows, fmt) {
  const el = $(sel);
  if (!el) return;
  const kind = { '#actList': 'activities', '#eqList': 'equipment', '#issueList': 'issues' }[sel];
  el.innerHTML = rows.length
    ? rows.map(r => `<li data-id="${r.id}">
        <span>${fmt(r)}</span>
        <button class="rm" data-del="${kind}:${r.id}" aria-label="Remove row">×</button>
      </li>`).join('')
    : `<li class="t-empty">Nothing recorded</li>`;
}

function paintTotals() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sWorkers', String(LABOUR.reduce((a, r) => a + r.present, 0)));
  set('sActs', String(ACTS.length));
  set('sMats', String(MATS.length));
}

/* ---------------------------------------------------------------
   ensure a draft exists before writing children
--------------------------------------------------------------- */
async function ensureReport() {
  if (REPORT) return REPORT;
  const { data, error } = await supabase.from('site_reports')
    .insert({ project_id: projectId, report_date: reportDate, submitted_by: user.id })
    .select('*').single();
  if (error) { fail(error); return null; }
  REPORT = data;
  paintStatus('draft');
  return REPORT;
}

/* ---------------------------------------------------------------
   add rows — uses the prototype's modal shell
--------------------------------------------------------------- */
const FIELDS = {
  labour:     [['trade','Trade','text'],['planned','Planned','number'],['present','Present','number']],
  activities: [['description','Activity','text'],['qty','Quantity','number'],['unit','Unit','text']],
  materials:  [['material','Material','text'],['qty','Quantity','number'],['unit','Unit','text'],['supplier','Supplier','text']],
  equipment:  [['name','Equipment','text'],['hours','Hours','number']],
  issues:     [['description','Issue','text'],['severity','Severity (low/med/high)','text']]
};

let activeKind = null;

function openModal(kind) {
  activeKind = kind;
  const root = $('#modalRoot');
  const title = $('#mTitle');
  const body = $('#modalBody');
  if (!root || !body) return addViaPrompt(kind);

  if (title) title.textContent = 'Add ' + kind.replace(/s$/, '');
  body.innerHTML = FIELDS[kind].map(([k, label, type], i) => `
    <label class="fld">
      <span class="fld__k">${label}</span>
      <input class="in" id="f${i + 1}" data-k="${k}" type="${type}" ${type === 'number' ? 'min="0"' : ''} />
    </label>`).join('');

  root.classList.add('is-open');
  body.querySelector('input')?.focus();
}

function closeModal() {
  $('#modalRoot')?.classList.remove('is-open');
  activeKind = null;
}

async function addViaPrompt(kind) {
  const row = {};
  for (const [k, label, type] of FIELDS[kind]) {
    const v = prompt(label);
    if (v === null) return;
    row[k] = type === 'number' ? (Number(v) || 0) : v;
  }
  await insertRow(kind, row);
}

async function insertRow(kind, row) {
  const rep = await ensureReport();
  if (!rep) return;
  const { error } = await supabase.from(TABLES[kind].table)
    .insert({ ...row, report_id: rep.id, sort_order: TABLES[kind].rows().length });
  if (error) return fail(error);
  toast('Row added');
  await loadReport();
}

document.addEventListener('click', async e => {
  const add = e.target.closest('[data-add]');
  if (add) return openModal(add.dataset.add);

  if (e.target.closest('[data-close]')) return closeModal();

  const del = e.target.closest('[data-del]');
  if (del) {
    const [kind, id] = del.dataset.del.split(':');
    const { error } = await supabase.from(TABLES[kind].table).delete().eq('id', id);
    if (error) return fail(error);
    toast('Row removed');
    return loadReport();
  }
});

$('#modalSave')?.addEventListener('click', async () => {
  if (!activeKind) return;
  const row = {};
  $$('#modalBody [data-k]').forEach(inp => {
    row[inp.dataset.k] = inp.type === 'number' ? (Number(inp.value) || 0) : inp.value.trim();
  });
  const first = FIELDS[activeKind][0][0];
  if (!row[first]) return toast('Fill in the first field', 'err');
  closeModal();
  await insertRow(activeKind, row);
});

/* ---------------------------------------------------------------
   project / date switching
--------------------------------------------------------------- */
$('#repProj')?.addEventListener('change', e => {
  projectId = e.target.value;
  loadReport();
});
$('#repDate')?.addEventListener('change', e => {
  reportDate = e.target.value;
  loadReport();
});

/* ---------------------------------------------------------------
   submit
--------------------------------------------------------------- */
async function submit() {
  const rep = await ensureReport();
  if (!rep) return;

  if (!LABOUR.length && !ACTS.length) {
    return toast('Add at least the labour count and one activity before submitting', 'err');
  }

  const { error } = await supabase.from('site_reports').update({
    status: 'submitted',
    submitted_by: user.id,
    submitted_at: new Date().toISOString(),
    plan_note:   $('#mpPlan')?.dataset.note || REPORT.plan_note,
    actual_note: REPORT.actual_note
  }).eq('id', rep.id);

  if (error) return fail(error);

  REPORT.status = 'submitted';
  paintStatus('submitted');
  toast('Report submitted');
}

$('#submitBtn')?.addEventListener('click', submit);
$('#submitTop')?.addEventListener('click', submit);

await load();

import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'projects', title: 'Task board' });
if (!user) throw new Error('redirecting');

const COLUMNS = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'todo',    name: 'To do' },
  { id: 'doing',   name: 'In progress' },
  { id: 'review',  name: 'Review' },
  { id: 'done',    name: 'Done' }
];

let TASKS = [], PROJECTS = [], PEOPLE = [];
let fProject = '', fAssignee = '', fPrio = '';

async function load() {
  const [tRes, pRes, uRes] = await Promise.all([
    supabase.from('tasks')
      .select('*, task_checklist(id,done), projects(id,name,code)')
      .order('sort_order'),
    supabase.from('projects').select('id,name,code').order('name'),
    supabase.from('profiles').select('id,full_name')
  ]);

  if (tRes.error) return fail(tRes.error);
  TASKS    = tRes.data ?? [];
  PROJECTS = pRes.data ?? [];
  PEOPLE   = uRes.data ?? [];

  fillFilters();
  render();
}

function fillFilters() {
  const pf = $('#projFilter');
  if (pf && pf.options.length <= 1) {
    PROJECTS.forEach(p => pf.add(new Option(`${p.code} · ${p.name}`, p.id)));
  }
  const af = $('#assigneeFilter');
  if (af && af.options.length <= 1) {
    PEOPLE.forEach(p => af.add(new Option(p.full_name || 'Unnamed', p.id)));
  }
}

const passes = t =>
  (!fProject  || t.project_id  === fProject) &&
  (!fAssignee || t.assignee_id === fAssignee) &&
  (!fPrio     || t.priority    === fPrio);

function taskCard(t) {
  const list  = t.task_checklist ?? [];
  const done  = list.filter(c => c.done).length;
  const who   = PEOPLE.find(p => p.id === t.assignee_id)?.full_name;
  const overdue = t.due_date && t.due_date < new Date().toISOString().slice(0, 10)
                  && t.board_column !== 'done';

  return `<article class="tcard" draggable="true" data-id="${t.id}" tabindex="0">
    <div class="tcard__top">
      <span class="tprio tprio--${t.priority}" title="${t.priority} priority"></span>
      <span class="tcard__title">${esc(t.title)}</span>
    </div>
    ${t.projects ? `<div class="tcard__proj">${esc(t.projects.code)} · ${esc(t.projects.name)}</div>` : ''}
    <div class="tcard__meta">
      <span class="tlabel">${esc(t.label || 'general')}</span>
      ${list.length ? `<span class="tcheck">${done}/${list.length}</span>` : ''}
      ${t.due_date ? `<span class="tdue ${overdue ? 'is-over' : ''}">${fmtDate(t.due_date)}</span>` : ''}
      ${who ? `<span class="tavatar" title="${esc(who)}">${esc(initials(who))}</span>` : ''}
    </div>
  </article>`;
}

function render() {
  const board = $('#board');
  if (!board) return;

  board.innerHTML = COLUMNS.map(c => {
    const items = TASKS.filter(t => t.board_column === c.id && passes(t));
    return `<section class="tcol" data-col="${c.id}" aria-label="${c.name}">
      <header class="tcol__head">
        <span class="tcol__name">${c.name}</span>
        <span class="tcol__count">${items.length}</span>
        <button class="tcol__add" data-addto="${c.id}" aria-label="Add task to ${c.name}">+</button>
      </header>
      <div class="tcol__body">${
        items.length ? items.map(taskCard).join('')
                     : '<div class="tcol__empty">Nothing here</div>'
      }</div>
    </section>`;
  }).join('');
}

/* ---------------------------------------------------------------
   move
--------------------------------------------------------------- */
async function move(id, col) {
  const t = TASKS.find(x => x.id === id);
  if (!t || t.board_column === col) return;

  const prev = t.board_column;
  t.board_column = col;
  render();

  const patch = { board_column: col };
  if (col === 'done' && prev !== 'done') patch.completed_at = new Date().toISOString();
  if (col !== 'done' && prev === 'done') patch.completed_at = null;

  const { error } = await supabase.from('tasks').update(patch).eq('id', id);
  if (error) { t.board_column = prev; render(); return fail(error); }

  toast(`Moved to ${COLUMNS.find(c => c.id === col).name}`);
}

let dragId = null;
document.addEventListener('dragstart', e => {
  const c = e.target.closest?.('.tcard');
  if (!c) return;
  dragId = c.dataset.id;
  c.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move';
});
document.addEventListener('dragend', e => {
  e.target.closest?.('.tcard')?.classList.remove('is-dragging');
  $$('.tcol.is-over').forEach(c => c.classList.remove('is-over'));
  dragId = null;
});
document.addEventListener('dragover', e => {
  const col = e.target.closest?.('.tcol');
  if (!col) return;
  e.preventDefault();
  $$('.tcol.is-over').forEach(c => c !== col && c.classList.remove('is-over'));
  col.classList.add('is-over');
});
document.addEventListener('drop', e => {
  const col = e.target.closest?.('.tcol');
  if (!col || !dragId) return;
  e.preventDefault();
  col.classList.remove('is-over');
  move(dragId, col.dataset.col);
});

/* ---------------------------------------------------------------
   create
--------------------------------------------------------------- */
async function createTask(column = 'backlog') {
  const title = prompt('Task title');
  if (!title) return;

  const projectId = fProject || PROJECTS[0]?.id || null;
  if (!projectId) return toast('Create a project first', 'err');

  const { data: last } = await supabase.from('tasks')
    .select('code').not('code', 'is', null).order('code', { ascending: false }).limit(1);
  const n = last?.length ? (parseInt(String(last[0].code).replace(/\D/g, ''), 10) || 200) + 1 : 201;

  const { error } = await supabase.from('tasks').insert({
    code: 'TSK-' + n, project_id: projectId, title,
    board_column: column, assignee_id: user.id, created_by: user.id
  });
  if (error) return fail(error);
  toast('Task created');
  await load();
}

$('#addBtn')?.addEventListener('click', () => createTask('backlog'));
document.addEventListener('click', e => {
  const add = e.target.closest('[data-addto]');
  if (add) createTask(add.dataset.addto);
});

/* ---------------------------------------------------------------
   filters
--------------------------------------------------------------- */
$('#projFilter')?.addEventListener('change', e => { fProject = e.target.value; render(); });
$('#assigneeFilter')?.addEventListener('change', e => { fAssignee = e.target.value; render(); });
$('#prioSeg')?.addEventListener('click', e => {
  const b = e.target.closest('[data-prio]');
  if (!b) return;
  fPrio = b.dataset.prio === 'all' ? '' : b.dataset.prio;
  $$('#prioSeg [data-prio]').forEach(x => x.classList.toggle('is-on', x === b));
  render();
});
$('#clearBtn')?.addEventListener('click', () => {
  fProject = fAssignee = fPrio = '';
  const pf = $('#projFilter'), af = $('#assigneeFilter');
  if (pf) pf.value = ''; if (af) af.value = '';
  $$('#prioSeg [data-prio]').forEach((x, i) => x.classList.toggle('is-on', i === 0));
  render();
});

/* live board across the team */
supabase.channel('task-board')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
  .subscribe();

await load();

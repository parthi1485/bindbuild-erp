import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate, openModal, closeAllModals, wireModalDismiss } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
const user=await mountShell({route:'tasks',title:'Tasks'});
if(!user)throw new Error('redirecting');

const COLS=[
  {id:'backlog',name:'Backlog',css:'c-backlog'},
  {id:'todo',name:'To do',css:'c-todo'},
  {id:'in_progress',name:'In progress',css:'c-progress'},
  {id:'review',name:'Review',css:'c-review'},
  {id:'done',name:'Done',css:'c-done'}
];
let TASKS=[],PROJECTS=[],PEOPLE=[],editingId=null,dragId=null;
let projectFilter='',assigneeFilter='',priorityFilter='';
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const byId=(rows,id)=>rows.find(x=>x.id===id);

function normalStatus(s){
  if(s==='doing'||s==='progress')return'in_progress';
  if(s==='completed')return'done';
  return COLS.some(c=>c.id===s)?s:'todo';
}
function prioClass(p){return ['high','urgent'].includes(p)?'hi':p==='low'?'lo':'me';}
function dueClass(t){
  if(!t.due_at||normalStatus(t.status)==='done')return'';
  const d=String(t.due_at).slice(0,10);
  if(d<today())return' over';
  const soon=new Date(Date.now()+2*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
  return d<=soon?' soon':'';
}
function taskCard(t){
  const p=byId(PROJECTS,t.project_id),who=byId(PEOPLE,t.assigned_to);
  return `<article class="task" draggable="true" data-task="${t.id}" tabindex="0">
    <div class="task__top"><span class="prio ${prioClass(t.priority)}"><span class="pdot"></span>${esc(t.priority||'medium')}</span></div>
    <div class="task__title">${esc(t.title)}</div>
    ${p?`<div class="task__project"><span class="pj-dot"></span>${esc(p.project_no||p.code||'Project')} · ${esc(p.name)}</div>`:''}
    ${t.description?`<div class="task__labels"><span class="lbl">${esc(t.description.length>70?t.description.slice(0,70)+'…':t.description)}</span></div>`:''}
    <div class="task__foot">
      ${t.due_at?`<span class="due${dueClass(t)}">Due ${fmtDate(t.due_at)}</span>`:'<span class="due">No due date</span>'}
      ${who?`<span class="task__av c0" title="${esc(who.full_name||'Assignee')}">${esc(initials(who.full_name||'?'))}</span>`:'<span class="task__av c0" title="Unassigned">—</span>'}
    </div>
  </article>`;
}
function passes(t){
  return (!projectFilter||t.project_id===projectFilter)
    &&(!assigneeFilter||(assigneeFilter==='unassigned'?!t.assigned_to:t.assigned_to===assigneeFilter))
    &&(!priorityFilter||t.priority===priorityFilter);
}
function render(){
  const board=$('#board');if(!board)return;
  board.innerHTML=COLS.map(c=>{
    const items=TASKS.filter(t=>normalStatus(t.status)===c.id&&passes(t))
      .sort((a,b)=>String(a.due_at||'9999').localeCompare(String(b.due_at||'9999'))||String(a.created_at).localeCompare(String(b.created_at)));
    return `<section class="col ${c.css}" data-col="${c.id}">
      <div class="col__head"><span class="col__dot"></span><span class="col__name">${c.name}</span><span class="col__count">${items.length}</span><button class="col__add" data-add="${c.id}" aria-label="Add to ${c.name}">+</button></div>
      <div class="col__list" data-list="${c.id}">${items.length?items.map(taskCard).join(''):'<div class="col__empty">Nothing here</div>'}</div>
    </section>`;
  }).join('');
  const open=TASKS.filter(t=>!['done','cancelled'].includes(normalStatus(t.status))).length;
  const overdue=TASKS.filter(t=>t.due_at&&String(t.due_at).slice(0,10)<today()&&!['done','cancelled'].includes(normalStatus(t.status))).length;
  $('#taskFoot').textContent=`${open} open · ${overdue} overdue`;
}
function fillFilters(){
  const pf=$('#projFilter'),af=$('#assigneeFilter');
  pf.innerHTML='<option value="">All projects</option>'+PROJECTS.map(p=>`<option value="${p.id}">${esc(p.project_no||p.code||'Project')} · ${esc(p.name)}</option>`).join('');
  af.innerHTML='<option value="">All assignees</option><option value="unassigned">Unassigned</option>'+PEOPLE.map(p=>`<option value="${p.id}">${esc(p.full_name||'Unnamed')}</option>`).join('');
  pf.value=projectFilter;af.value=assigneeFilter;
}
function fillDialog(){
  $('#mProj').innerHTML='<option value="">General / no project</option>'+PROJECTS.map(p=>`<option value="${p.id}">${esc(p.project_no||p.code||'Project')} · ${esc(p.name)}</option>`).join('');
  $('#mAssignee').innerHTML='<option value="">Unassigned</option>'+PEOPLE.map(p=>`<option value="${p.id}">${esc(p.full_name||'Unnamed')}</option>`).join('');
}
async function load(){
  try{
    const [p,u,t]=await Promise.all([
      scopeToUnit(supabase.from('projects').select('id,project_no,code,name').is('deleted_at',null)).order('name'),
      supabase.from('profiles').select('id,full_name,role').eq('is_active',true).order('full_name'),
      supabase.from('tasks').select('*').order('created_at',{ascending:false})
    ]);
    [p,u,t].forEach(r=>{if(r.error)throw r.error;});
    PROJECTS=p.data||[];PEOPLE=u.data||[];
    const pids=new Set(PROJECTS.map(x=>x.id));
    TASKS=(t.data||[]).filter(x=>!x.project_id||pids.has(x.project_id));
    fillFilters();fillDialog();render();
    const params=new URLSearchParams(location.search),taskId=params.get('task');
    if(taskId){const task=TASKS.find(x=>x.id===taskId);if(task){openTask(task);history.replaceState(null,'','/tasks.html');}}
    else if(params.get('new')==='1'){openTask(null,'todo');history.replaceState(null,'','/tasks.html');}
  }catch(e){fail(e);}
}
function openTask(task=null,status='todo'){
  editingId=task?.id||null;
  $('#modalTitle').textContent=task?'Edit task':'New task';
  $('#mTitle').value=task?.title||'';
  $('#mDesc').value=task?.description||'';
  $('#mProj').value=task?.project_id||projectFilter||'';
  $('#mAssignee').value=task?.assigned_to||user.id||'';
  $('#mPrio').value=task?.priority||'medium';
  $('#mDue').value=task?.due_at?String(task.due_at).slice(0,10):'';
  $('#mStatus').value=normalStatus(task?.status||status);
  openModal('modalRoot');
  setTimeout(()=>$('#mTitle')?.focus(),0);
}
async function saveTask(){
  const title=$('#mTitle').value.trim();if(!title)return toast('Task title is required','err');
  const due=$('#mDue').value;
  const patch={
    title,
    description:$('#mDesc').value.trim()||null,
    project_id:$('#mProj').value||null,
    assigned_to:$('#mAssignee').value||null,
    priority:$('#mPrio').value||'medium',
    status:$('#mStatus').value||'todo',
    due_at:due?new Date(due+'T18:00:00+05:30').toISOString():null,
    updated_at:new Date().toISOString()
  };
  try{
    const r=editingId
      ?await supabase.from('tasks').update(patch).eq('id',editingId)
      :await supabase.from('tasks').insert({...patch,created_by:user.id});
    if(r.error)throw r.error;
    closeAllModals();toast(editingId?'Task updated':'Task created');editingId=null;await load();
  }catch(e){fail(e);}
}
async function moveTask(id,status){
  const t=TASKS.find(x=>x.id===id);if(!t||normalStatus(t.status)===status)return;
  const old=t.status;t.status=status;render();
  const r=await supabase.from('tasks').update({status,updated_at:new Date().toISOString()}).eq('id',id);
  if(r.error){t.status=old;render();return fail(r.error);}
  toast('Moved to '+COLS.find(c=>c.id===status)?.name);
}

wireModalDismiss();
$('#addBtn')?.addEventListener('click',()=>openTask(null,'todo'));
$('#calendarBtn')?.addEventListener('click',()=>location.href='/calendar.html');
$('#saveTask')?.addEventListener('click',saveTask);
$('#projFilter')?.addEventListener('change',e=>{projectFilter=e.target.value;render();});
$('#assigneeFilter')?.addEventListener('change',e=>{assigneeFilter=e.target.value;render();});
$('#prioSeg')?.addEventListener('click',e=>{const b=e.target.closest('[data-prio]');if(!b)return;priorityFilter=b.dataset.prio;$$('#prioSeg [data-prio]').forEach(x=>x.classList.toggle('on',x===b));render();});
$('#clearBtn')?.addEventListener('click',()=>{projectFilter=assigneeFilter=priorityFilter='';fillFilters();$$('#prioSeg [data-prio]').forEach((x,i)=>x.classList.toggle('on',i===0));render();});
document.addEventListener('click',e=>{
  const add=e.target.closest('[data-add]');if(add)return openTask(null,add.dataset.add);
  const card=e.target.closest('[data-task]');if(card&&!e.target.closest('button')){const t=TASKS.find(x=>x.id===card.dataset.task);if(t)return openTask(t);}
});
document.addEventListener('dragstart',e=>{const c=e.target.closest?.('[data-task]');if(!c)return;dragId=c.dataset.task;c.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
document.addEventListener('dragend',e=>{e.target.closest?.('[data-task]')?.classList.remove('dragging');$$('.col__list.drag-over').forEach(x=>x.classList.remove('drag-over'));dragId=null;});
document.addEventListener('dragover',e=>{const l=e.target.closest?.('[data-list]');if(!l)return;e.preventDefault();l.classList.add('drag-over');});
document.addEventListener('dragleave',e=>{e.target.closest?.('[data-list]')?.classList.remove('drag-over');});
document.addEventListener('drop',e=>{const l=e.target.closest?.('[data-list]');if(!l||!dragId)return;e.preventDefault();l.classList.remove('drag-over');moveTask(dragId,l.dataset.list);});

supabase.channel('erp-task-board').on('postgres_changes',{event:'*',schema:'public',table:'tasks'},()=>load()).subscribe();
await load();
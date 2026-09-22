import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'design',title:'Design & Pre-Construction'});
if(!user)throw new Error('redirecting');

const canEdit=['founder','admin','project_manager','designer'].includes(user.role);
const canApprove=['founder','admin','project_manager'].includes(user.role);
const labels={not_started:'Not started',active:'Active',waiting_client:'Waiting client',waiting_external:'Waiting external',blocked:'Blocked',completed:'Completed',skipped:'Skipped'};
const done=s=>['completed','skipped'].includes(s);

let projectId=new URLSearchParams(location.search).get('project');
let projects=[],clients=new Map(),profiles=[],project=null,steps=[],deliverables=[],drawings=[],approvals=[],tasks=[],selected=null;

async function base(){
  try{
    const a=await Promise.all([
      scopeToUnit(supabase.from('projects').select('*').is('deleted_at',null)).order('created_at',{ascending:false}),
      scopeToUnit(supabase.from('clients').select('id,name').is('deleted_at',null)),
      supabase.from('profiles').select('id,full_name,role,is_active').eq('is_active',true).order('full_name')
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    projects=a[0].data||[]; clients=new Map((a[1].data||[]).map(x=>[x.id,x.name])); profiles=a[2].data||[];
    if(!projects.length){
      $('#projectSel').innerHTML='<option>No projects yet</option>';
      $('#timeline').innerHTML='<div class="empty">Accept a proposal to create a project. Its pre-construction plan will be created automatically.</div>';
      return;
    }
    if(!projectId||!projects.some(x=>x.id===projectId))projectId=projects[0].id;
    $('#projectSel').innerHTML=projects.map(p=>'<option value="'+p.id+'"'+(p.id===projectId?' selected':'')+'>'+esc(p.project_no||p.code||'PROJECT')+' · '+esc(p.name)+'</option>').join('');
    await loadProject();
  }catch(e){fail(e);}
}

async function loadProject(){
  try{
    project=projects.find(x=>x.id===projectId); if(!project)return;
    const seed=await supabase.rpc('seed_project_preconstruction',{p_project_id:project.id});
    if(seed.error)throw seed.error;
    const a=await Promise.all([
      supabase.from('preconstruction_steps').select('*').eq('project_id',project.id).order('step_order'),
      supabase.from('design_deliverables').select('*').eq('project_id',project.id).order('created_at'),
      supabase.from('drawings').select('*').eq('project_id',project.id).order('created_at',{ascending:false}),
      supabase.from('approvals').select('*').eq('project_id',project.id).order('created_at',{ascending:false}),
      supabase.from('tasks').select('*').eq('project_id',project.id).order('due_at',{ascending:true})
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    steps=a[0].data||[]; deliverables=a[1].data||[]; drawings=a[2].data||[]; approvals=a[3].data||[]; tasks=a[4].data||[];
    if(!selected||!steps.some(x=>x.id===selected))selected=(steps.find(x=>!done(x.status))||steps[0])?.id||null;
    paint();
  }catch(e){fail(e);}
}

function paint(){
  const req=steps.filter(x=>x.required), complete=req.filter(x=>x.status==='completed').length;
  const current=steps.find(x=>!done(x.status))||steps[steps.length-1];
  const ready=deliverables.filter(x=>['approved','completed','issued'].includes(x.status)).length;
  const released=project.status==='active'||steps.find(x=>x.step_key==='bhoomi_pooja')?.status==='completed';
  $('#progressPct').textContent=(req.length?Math.round(complete/req.length*100):0)+'%';
  $('#progressMeta').textContent=complete+' of '+req.length+' required steps complete';
  $('#currentStep').textContent=current?.title||'Complete';
  $('#currentPhase').textContent=current?.phase||'—';
  $('#deliverableCount').textContent=ready+'/'+deliverables.length;
  $('#releaseStatus').textContent=released?'Released':'Not released';
  $('#releaseMeta').textContent=released?(project.start_date?'Started '+fmtDate(project.start_date):'Construction active'):'Bhoomi Pooja pending';
  $('#projectMeta').textContent=[project.project_no||project.code,clients.get(project.client_id),project.location].filter(Boolean).join(' · ');
  $('#projectStatus').textContent=String(project.status||'planning').toUpperCase();
  timeline(); editor(); deliverableTable(); drawingTable(); approvalList(); taskList();
}

function timeline(){
  const current=(steps.find(x=>!done(x.status))||{}).id;
  $('#timeline').innerHTML=steps.map(s=>{
    const cls=(done(s.status)?' done':'')+(s.id===current?' current':'');
    return '<div class="step'+cls+'" data-step="'+s.id+'"><span class="step__num">'+(s.status==='completed'?'✓':s.step_order)+'</span><div><div class="step__phase">'+esc(s.phase)+(s.required?'':' · OPTIONAL')+'</div><div class="step__title">'+esc(s.title)+'</div><div class="step__out">'+esc(s.output_label||'')+'</div></div><div class="step__right"><span class="sbadge '+esc(s.status)+'">'+esc(labels[s.status]||s.status)+'</span><div class="step__due">'+(s.due_date?'Due '+fmtDate(s.due_date):'No due date')+'</div></div></div>';
  }).join('');
}

function ownerOptions(id){
  return '<option value="">Unassigned</option>'+profiles.map(p=>'<option value="'+p.id+'"'+(p.id===id?' selected':'')+'>'+esc(p.full_name)+' · '+esc(String(p.role).replaceAll('_',' '))+'</option>').join('');
}

function editor(){
  const s=steps.find(x=>x.id===selected);
  if(!s){$('#stepEditor').innerHTML='<div class="empty">Select a step.</div>';return;}
  $('#stepTitle').textContent=s.step_order+'. '+s.title;
  $('#stepPhase').textContent=s.phase+(s.required?' · Required':' · Optional');
  const statuses=Object.entries(labels).map(x=>'<option value="'+x[0]+'"'+(s.status===x[0]?' selected':'')+'>'+esc(x[1])+'</option>').join('');
  $('#stepEditor').innerHTML='<div class="form-grid">'+
    '<div class="form-field full"><label>Required output</label><div class="output-box">'+esc(s.output_label||'—')+'</div></div>'+
    '<div class="form-field"><label>Status</label><select class="field-select" id="stepStatus" '+(canEdit?'':'disabled')+'>'+statuses+'</select></div>'+
    '<div class="form-field"><label>Due date</label><input class="field-input" id="stepDue" type="date" value="'+(s.due_date||'')+'" '+(canEdit?'':'disabled')+'/></div>'+
    '<div class="form-field full"><label>Owner</label><select class="field-select" id="stepOwner" '+(canEdit?'':'disabled')+'>'+ownerOptions(s.owner_id)+'</select></div>'+
    '<div class="form-field full"><label>External / approval reference</label><input class="field-input" id="stepRef" value="'+esc(s.external_reference||'')+'" placeholder="Approval no., soil report ref., agreement ref…" '+(canEdit?'':'disabled')+'/></div>'+
    '<div class="form-field full"><label>Notes / decision record</label><textarea class="field-textarea" id="stepNotes" '+(canEdit?'':'disabled')+'>'+esc(s.notes||'')+'</textarea></div></div>'+
    (s.step_key==='final_design_signoff'?'<div class="confirmation">Client design confirmation: <b>'+(s.client_confirmation_at?fmtDate(s.client_confirmation_at):'Not recorded')+'</b></div>':'')+
    (s.completed_at?'<div class="confirmation">Completed '+fmtDate(s.completed_at)+'</div>':'')+
    '<div class="action-row">'+
      (canEdit?'<button class="btn-primary" id="saveStepBtn">Save step</button>':'')+
      (canEdit&&s.status!=='completed'?'<button class="btn-ghost" id="completeStepBtn">Mark complete</button>':'')+
      (canEdit&&!s.required&&!['skipped','completed'].includes(s.status)?'<button class="btn-ghost" id="skipStepBtn">Mark N.A.</button>':'')+
      (canEdit?'<button class="btn-ghost" id="taskStepBtn">Create task</button>':'')+
      (canApprove?'<button class="btn-ghost" id="approvalStepBtn">Request approval</button>':'')+
    '</div>';
  $('#saveStepBtn')?.addEventListener('click',()=>saveStep());
  $('#completeStepBtn')?.addEventListener('click',()=>saveStep('completed'));
  $('#skipStepBtn')?.addEventListener('click',()=>saveStep('skipped'));
  $('#taskStepBtn')?.addEventListener('click',makeTask);
  $('#approvalStepBtn')?.addEventListener('click',makeApproval);
}

async function saveStep(force){
  const s=steps.find(x=>x.id===selected); if(!s)return;
  const patch={status:force||$('#stepStatus').value,due_date:$('#stepDue').value||null,owner_id:$('#stepOwner').value||null,external_reference:$('#stepRef').value.trim()||null,notes:$('#stepNotes').value.trim()||null};
  const r=await supabase.from('preconstruction_steps').update(patch).eq('id',s.id).select('*').single();
  if(r.error)return fail(r.error);
  toast(r.data.status==='completed'?'Step completed':'Step saved');
  if(s.step_key==='bhoomi_pooja'&&r.data.status==='completed'){
    const p=await supabase.from('projects').select('*').eq('id',project.id).single();
    if(!p.error){project=p.data;projects=projects.map(x=>x.id===project.id?project:x);}
  }
  await loadProject();
}

async function makeTask(){
  const s=steps.find(x=>x.id===selected);if(!s)return;
  const due=s.due_date?s.due_date+'T12:00:00+05:30':null;
  const r=await supabase.from('tasks').insert({project_id:project.id,title:'Pre-construction · '+s.title,description:s.output_label||null,priority:'medium',status:'todo',assigned_to:s.owner_id||null,due_at:due});
  if(r.error)return fail(r.error);toast('Task created');await loadProject();
}

async function makeApproval(){
  const s=steps.find(x=>x.id===selected);if(!s)return;
  if(approvals.some(a=>a.entity_type==='preconstruction_step'&&a.entity_id===s.id&&a.status==='pending'))return toast('Approval already pending','err');
  const r=await supabase.from('approvals').insert({project_id:project.id,title:'Approval · '+s.title,entity_type:'preconstruction_step',entity_id:s.id,status:'pending',comment:s.output_label||null});
  if(r.error)return fail(r.error);toast('Approval requested');await loadProject();
}

function deliverableTable(){
  const statusOpts=d=>['not_started','in_progress','review','approved','completed','issued'].map(v=>'<option value="'+v+'"'+(d.status===v?' selected':'')+'>'+v.replaceAll('_',' ')+'</option>').join('');
  $('#deliverablesBody').innerHTML=deliverables.length?deliverables.map(d=>'<tr data-deliv="'+d.id+'"><td><b>'+esc(d.title)+'</b></td><td>'+esc(String(d.stage||'—').replaceAll('_',' '))+'</td><td><input data-f="revision" value="'+esc(d.revision||'R0')+'" '+(canEdit?'':'disabled')+'/></td><td><input data-f="due_date" type="date" value="'+(d.due_date||'')+'" '+(canEdit?'':'disabled')+'/></td><td><select data-f="status" '+(canEdit?'':'disabled')+'>'+statusOpts(d)+'</select></td><td>'+(d.client_approval_required?'<span class="sbadge waiting_client">Required</span>':'—')+'</td></tr>').join(''):'<tr><td colspan="6">No deliverables.</td></tr>';
}

async function saveDeliverable(row){
  const patch={}; row.querySelectorAll('[data-f]').forEach(el=>patch[el.dataset.f]=el.value||null);
  const r=await supabase.from('design_deliverables').update(patch).eq('id',row.dataset.deliv);
  if(r.error)return fail(r.error);toast('Deliverable updated');await loadProject();
}

function drawingTable(){
  $('#drawingsBody').innerHTML=drawings.length?drawings.map(d=>'<tr data-drawing="'+d.id+'"><td class="mono">'+esc(d.drawing_no)+'</td><td>'+esc(d.title)+'</td><td>'+esc(d.discipline||'—')+'</td><td>'+esc(d.revision||'R0')+'</td><td><select data-drawing-status '+(canEdit?'':'disabled')+'><option value="draft"'+(d.status==='draft'?' selected':'')+'>draft</option><option value="review"'+(d.status==='review'?' selected':'')+'>review</option><option value="issued"'+(d.status==='issued'?' selected':'')+'>issued</option><option value="superseded"'+(d.status==='superseded'?' selected':'')+'>superseded</option></select></td></tr>').join(''):'<tr><td colspan="5">No drawings registered yet.</td></tr>';
  $('#addDrawingBtn').disabled=!canEdit;
}

async function addDrawing(){
  const no=prompt('Drawing number e.g. '+(project.project_no||project.code)+'-AR-001');if(!no)return;
  const title=prompt('Drawing title');if(!title)return;
  const discipline=prompt('Discipline','Architectural')||null;
  const revision=prompt('Revision','R0')||'R0';
  const r=await supabase.from('drawings').insert({project_id:project.id,drawing_no:no.trim(),title:title.trim(),discipline,revision,status:'draft'});
  if(r.error)return fail(r.error);toast('Drawing added');await loadProject();
}

async function drawingStatus(id,status){
  const r=await supabase.from('drawings').update({status,issue_date:status==='issued'?new Date().toISOString().slice(0,10):null}).eq('id',id);
  if(r.error)return fail(r.error);toast('Drawing updated');await loadProject();
}

function approvalList(){
  $('#approvalsList').innerHTML=approvals.length?approvals.map(a=>'<div class="list-row"><div class="list-row__body"><div class="list-row__title">'+esc(a.title)+'</div><div class="list-row__meta">'+esc(a.entity_type.replaceAll('_',' '))+' · '+fmtDate(a.created_at)+'</div></div><span class="sbadge '+(a.status==='approved'?'completed':a.status==='rejected'?'blocked':'waiting_client')+'">'+esc(a.status)+'</span>'+(canApprove&&a.status==='pending'?'<button class="btn-ghost" data-approve="'+a.id+'">Approve</button>':'')+'</div>').join(''):'<div class="empty">No approval requests.</div>';
}

async function approve(id){
  const r=await supabase.from('approvals').update({status:'approved',decided_by:user.id,decided_at:new Date().toISOString()}).eq('id',id);
  if(r.error)return fail(r.error);toast('Approved');await loadProject();
}

function taskList(){
  const rows=tasks.filter(t=>String(t.title||'').startsWith('Pre-construction')&&!['done','cancelled'].includes(t.status));
  $('#tasksList').innerHTML=rows.length?rows.map(t=>'<div class="list-row"><span class="sbadge '+(t.status==='in_progress'?'active':'')+'">'+esc(t.status)+'</span><div class="list-row__body"><div class="list-row__title">'+esc(t.title)+'</div><div class="list-row__meta">'+(t.due_at?'Due '+fmtDate(t.due_at):'No due date')+'</div></div></div>').join(''):'<div class="empty">No open pre-construction tasks.</div>';
}

$('#projectSel').addEventListener('change',async e=>{projectId=e.target.value;selected=null;history.replaceState(null,'','/design.html?project='+projectId);await loadProject();});
$('#openProjectBtn').addEventListener('click',()=>project?.id&&(location.href='/project.html?id='+project.id));
$('#timeline').addEventListener('click',e=>{const row=e.target.closest('[data-step]');if(row){selected=row.dataset.step;timeline();editor();}});
$('#deliverablesBody').addEventListener('change',e=>{const row=e.target.closest('[data-deliv]');if(row&&canEdit)saveDeliverable(row);});
$('#addDrawingBtn').addEventListener('click',()=>canEdit&&addDrawing());
$('#drawingsBody').addEventListener('change',e=>{const s=e.target.closest('[data-drawing-status]');if(s&&canEdit)drawingStatus(s.closest('[data-drawing]').dataset.drawing,s.value);});
$('#approvalsList').addEventListener('click',e=>{const b=e.target.closest('[data-approve]');if(b)approve(b.dataset.approve);});

await base();

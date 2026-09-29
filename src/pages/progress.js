import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'construction',title:'Construction'});
if(!user)throw new Error('redirecting');

const canWrite=['founder','admin','project_manager','site_engineer'].includes(user.role);
const canManager=['founder','admin','project_manager'].includes(user.role);
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});

let projectId=new URLSearchParams(location.search).get('project');
let PROJECTS=[],P=null,STAGES=[],REPORTS=[],ISSUES=[],INSPECTIONS=[],QUALITY=[],SNAPS=[];

async function loadBase(){
  try{
    const r=await scopeToUnit(
      supabase.from('projects').select('*').is('deleted_at',null).eq('status','active')
    ).order('created_at',{ascending:false});
    if(r.error)throw r.error;
    PROJECTS=r.data||[];
    if(!PROJECTS.length){
      $('#projectSel').innerHTML='<option>No active construction projects</option>';
      $('#stageList').innerHTML='<div class="empty">Construction appears here after Bhoomi Pooja releases a project from pre-construction.</div>';
      return;
    }
    if(!projectId||!PROJECTS.some(x=>x.id===projectId))projectId=PROJECTS[0].id;
    $('#projectSel').innerHTML=PROJECTS.map(p=>'<option value="'+p.id+'"'+(p.id===projectId?' selected':'')+'>'+esc(p.project_no||p.code||'PROJECT')+' · '+esc(p.name)+'</option>').join('');
    await loadProject();
  }catch(e){fail(e);}
}

async function loadProject(){
  try{
    P=PROJECTS.find(x=>x.id===projectId);if(!P)return;
    const seed=await supabase.rpc('seed_project_construction',{p_project_id:P.id});
    if(seed.error)throw seed.error;

    const a=await Promise.all([
      supabase.from('construction_stages').select('*').eq('project_id',P.id).order('sort_order'),
      supabase.from('site_reports').select('*').eq('project_id',P.id).order('report_date',{ascending:false}).limit(20),
      supabase.from('site_issues').select('*').eq('project_id',P.id).in('status',['open','in_progress']).order('created_at',{ascending:false}),
      supabase.from('site_inspections').select('*').eq('project_id',P.id).order('created_at',{ascending:false}).limit(20),
      supabase.from('quality_checks').select('*').eq('project_id',P.id).eq('status','open').order('created_at',{ascending:false}).limit(20),
      supabase.from('project_progress_snapshots').select('*').eq('project_id',P.id).order('snapshot_date',{ascending:false}).limit(12)
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    STAGES=a[0].data||[];REPORTS=a[1].data||[];ISSUES=a[2].data||[];INSPECTIONS=a[3].data||[];QUALITY=a[4].data||[];SNAPS=a[5].data||[];
    render();
  }catch(e){fail(e);}
}

function currentStage(){return STAGES.find(s=>s.status!=='completed')||STAGES[STAGES.length-1]||null;}

function render(){
  const cur=currentStage(),tr=REPORTS.find(r=>r.report_date===today());
  $('#overallPct').textContent=Number(P.progress_pct||0).toFixed(Number(P.progress_pct||0)%1?1:0)+'%';
  $('#progressSub').textContent=STAGES.filter(s=>s.status==='completed').length+' of '+STAGES.length+' stages completed';
  $('#currentStage').textContent=cur?.title||'Complete';
  $('#currentPhase').textContent=cur?.phase||'—';
  $('#workersToday').textContent=String(tr?.labour_count||0);
  $('#dsrState').textContent=tr?String(tr.status).toUpperCase():'No DSR today';
  $('#issueCount').textContent=String(ISSUES.length);
  $('#criticalCount').textContent=ISSUES.filter(x=>x.severity==='critical').length+' critical';
  $('#inspectionCount').textContent=String(INSPECTIONS.filter(x=>x.status==='planned'||x.outcome==='pending').length);
  $('#qualityMeta').textContent=QUALITY.filter(x=>x.result==='fail').length+' failed · '+QUALITY.filter(x=>x.result==='pending').length+' pending';
  $('#projectStatus').textContent=String(P.status||'active').toUpperCase();
  $('#todayLabel').textContent=fmtDate(today());

  renderStages();renderToday(tr);renderSnapshots();renderInspections();renderQuality();renderIssues();renderReports();
}

function renderStages(){
  $('#stageList').innerHTML=STAGES.map(s=>{
    const locked=!canWrite||s.status==='completed';
    const completeBtn=canManager&&s.status!=='completed'?'<button class="mini-btn" data-complete="'+s.id+'">Complete</button>':'';
    return '<div class="stage-row '+esc(s.status)+'" data-stage="'+s.id+'">'+
      '<span class="stage-num">'+(s.status==='completed'?'✓':s.sort_order)+'</span>'+
      '<div><div class="stage-title">'+esc(s.title)+'</div><div class="stage-meta">'+esc(s.phase)+' · Weight '+Number(s.weight_pct||0)+'%'+(s.requires_inspection?' · Inspection required':'')+'</div></div>'+
      '<div class="stage-progress"><input type="number" min="0" max="99" step="1" data-progress value="'+Number(s.progress_pct||0)+'" '+(locked?'disabled':'')+'/><span>%</span></div>'+
      '<div class="stage-date"><input type="date" data-end value="'+(s.planned_end||'')+'" '+(locked?'disabled':'')+'/></div>'+
      '<div class="stage-actions">'+(canWrite&&s.status!=='completed'?'<button class="mini-btn" data-save="'+s.id+'">Save</button>':'')+completeBtn+'</div>'+
    '</div>';
  }).join('')||'<div class="empty">No construction stages.</div>';
}

async function saveStage(id){
  const row=$('[data-stage="'+id+'"]');const s=STAGES.find(x=>x.id===id);if(!row||!s)return;
  const pct=Math.max(0,Math.min(99,Number(row.querySelector('[data-progress]').value)||0));
  const end=row.querySelector('[data-end]').value||null;
  const patch={progress_pct:pct,planned_end:end,status:pct>0&&s.status==='not_started'?'in_progress':s.status};
  const r=await supabase.from('construction_stages').update(patch).eq('id',id);
  if(r.error)return fail(r.error);
  toast('Stage progress saved');await refreshProject();
}

async function completeStage(id){
  if(!confirm('Mark this construction stage complete? Inspection and quality gates will be checked.'))return;
  const r=await supabase.rpc('complete_construction_stage',{p_stage_id:id});
  if(r.error)return fail(r.error);
  toast('Stage completed');await refreshProject();
}

async function refreshProject(){
  const p=await supabase.from('projects').select('*').eq('id',P.id).single();
  if(!p.error){P=p.data;PROJECTS=PROJECTS.map(x=>x.id===P.id?P:x);}
  await loadProject();
}

function renderToday(r){
  if(!r){
    $('#todayReport').innerHTML='<div class="empty">No report started today.</div><button class="btn-new" id="startDsrInline">Start today’s DSR</button>';
    $('#startDsrInline')?.addEventListener('click',()=>location.href='/dsr.html?project='+P.id+'&date='+today());
    return;
  }
  $('#todayReport').innerHTML=
    '<div class="metric-row"><span>Report</span><b>'+esc(r.report_no||'DSR')+'</b></div>'+
    '<div class="metric-row"><span>Status</span><b>'+esc(r.status)+'</b></div>'+
    '<div class="metric-row"><span>Labour</span><b>'+Number(r.labour_count||0)+'</b></div>'+
    '<div class="metric-row"><span>Work</span><b>'+esc((r.work_completed||'Draft in progress').slice(0,70))+'</b></div>'+
    '<button class="btn-ghost" id="openTodayDsr" style="width:100%;margin-top:10px">Open report</button>';
  $('#openTodayDsr')?.addEventListener('click',()=>location.href='/dsr.html?project='+P.id+'&date='+r.report_date);
}

function renderSnapshots(){
  $('#snapshotList').innerHTML=SNAPS.length?SNAPS.map(s=>
    '<div class="snap"><small>'+fmtDate(s.snapshot_date)+'</small><div><small>Planned</small><br><b>'+Number(s.planned_pct||0).toFixed(1)+'%</b></div><div><small>Actual</small><br><b>'+Number(s.actual_pct||0).toFixed(1)+'%</b></div></div>'
  ).join(''):'<div class="empty">Progress history begins when stage progress is recorded.</div>';
}

function renderInspections(){
  $('#inspectionList').innerHTML=INSPECTIONS.length?INSPECTIONS.slice(0,8).map(i=>
    '<div class="list-row"><div class="list-body"><div class="list-title">'+esc(i.title)+'</div><div class="list-meta">'+esc(i.inspection_type)+' · '+(i.scheduled_on?fmtDate(i.scheduled_on):'No date')+'</div></div><span class="status '+esc(i.outcome)+'">'+esc(i.outcome)+'</span>'+
    (canWrite&&i.outcome==='pending'?'<button class="mini-btn" data-insp="'+i.id+'" data-outcome="pass">Pass</button><button class="mini-btn" data-insp="'+i.id+'" data-outcome="fail">Fail</button>':'')+'</div>'
  ).join(''):'<div class="empty">No inspections yet.</div>';
}

async function addInspection(){
  const cur=currentStage();if(!cur)return;
  const title=prompt('Inspection title','Inspection · '+cur.title);if(!title)return;
  const type=prompt('Inspection type','quality')||'quality';
  const date=prompt('Scheduled date (YYYY-MM-DD)',today())||today();
  const r=await supabase.from('site_inspections').insert({project_id:P.id,stage_id:cur.id,title:title.trim(),inspection_type:type.trim(),scheduled_on:date,status:'planned',outcome:'pending'});
  if(r.error)return fail(r.error);toast('Inspection added');await loadProject();
}

async function inspect(id,outcome){
  const notes=prompt(outcome==='pass'?'Inspection notes (optional)':'Failure / observation notes');if(outcome==='fail'&&!notes)return;
  const r=await supabase.from('site_inspections').update({status:'completed',outcome,inspected_on:today(),inspector_id:user.id,notes:notes||null,updated_at:new Date().toISOString()}).eq('id',id);
  if(r.error)return fail(r.error);toast('Inspection recorded');await loadProject();
}

function renderQuality(){
  $('#qualityList').innerHTML=QUALITY.length?QUALITY.slice(0,8).map(q=>
    '<div class="list-row"><div class="list-body"><div class="list-title">'+esc(q.check_item)+'</div><div class="list-meta">'+esc(STAGES.find(s=>s.id===q.stage_id)?.title||'Project level')+'</div></div><span class="status '+esc(q.result)+'">'+esc(q.result)+'</span>'+
    (canWrite&&q.result==='pending'?'<button class="mini-btn" data-q="'+q.id+'" data-result="pass">Pass</button><button class="mini-btn" data-q="'+q.id+'" data-result="fail">Fail</button>':'')+
    (canWrite&&q.result==='fail'?'<button class="mini-btn" data-qclose="'+q.id+'">Close</button>':'')+'</div>'
  ).join(''):'<div class="empty">No open quality checks.</div>';
}

async function addQuality(){
  const cur=currentStage();if(!cur)return;
  const item=prompt('Quality checkpoint');if(!item)return;
  const r=await supabase.from('quality_checks').insert({project_id:P.id,stage_id:cur.id,check_item:item.trim(),result:'pending',status:'open'});
  if(r.error)return fail(r.error);toast('Quality check added');await loadProject();
}

async function qualityResult(id,result){
  const notes=prompt(result==='fail'?'Failure note':'Check note (optional)');if(result==='fail'&&!notes)return;
  const r=await supabase.from('quality_checks').update({result,status:result==='pass'?'closed':'open',notes:notes||null,checked_by:user.id,checked_at:new Date().toISOString(),resolved_at:result==='pass'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',id);
  if(r.error)return fail(r.error);toast('Quality result saved');await loadProject();
}

async function closeQuality(id){
  const note=prompt('Resolution / closure note');if(!note)return;
  const r=await supabase.from('quality_checks').update({status:'closed',notes:note,resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);
  if(r.error)return fail(r.error);toast('Quality issue closed');await loadProject();
}

function renderIssues(){
  $('#issueList').innerHTML=ISSUES.length?ISSUES.slice(0,9).map(i=>
    '<div class="list-row"><div class="list-body"><div class="list-title">'+esc(i.title)+'</div><div class="list-meta">'+esc(i.category)+' · '+esc(i.description||'')+'</div></div><span class="status '+esc(i.severity)+'">'+esc(i.severity)+'</span>'+
    (canWrite?'<button class="mini-btn" data-resolve="'+i.id+'">Resolve</button>':'')+'</div>'
  ).join(''):'<div class="empty">No open site issues.</div>';
}

async function addIssue(){
  const cur=currentStage();
  const title=prompt('Issue title');if(!title)return;
  const category=(prompt('Category: site / material / quality / safety / delay / design / client / vendor / other','site')||'site').toLowerCase();
  const severity=(prompt('Severity: low / medium / high / critical','medium')||'medium').toLowerCase();
  const description=prompt('Description / action required')||null;
  const r=await supabase.from('site_issues').insert({project_id:P.id,stage_id:cur?.id||null,title:title.trim(),category,severity,description,status:'open'});
  if(r.error)return fail(r.error);toast('Issue logged');await loadProject();
}

async function resolveIssue(id){
  const resolution=prompt('Resolution / closure note');if(!resolution)return;
  const r=await supabase.from('site_issues').update({status:'resolved',resolution,resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);
  if(r.error)return fail(r.error);toast('Issue resolved');await loadProject();
}

function renderReports(){
  $('#reportsBody').innerHTML=REPORTS.length?REPORTS.map(r=>
    '<tr><td><span class="report-link">'+esc(r.report_no||'DSR')+'</span></td><td>'+fmtDate(r.report_date)+'</td><td><span class="status '+esc(r.status)+'">'+esc(r.status)+'</span></td><td>'+Number(r.labour_count||0)+'</td><td>'+esc((r.work_completed||'—').slice(0,100))+'</td><td><button class="mini-btn" data-report-date="'+r.report_date+'">Open</button></td></tr>'
  ).join(''):'<tr><td colspan="6" class="empty">No site reports yet.</td></tr>';
}

$('#projectSel').addEventListener('change',async e=>{projectId=e.target.value;history.replaceState(null,'','/progress.html?project='+projectId);await loadProject();});
$('#openProjectBtn').addEventListener('click',()=>P&&(location.href='/project.html?id='+P.id));
$('#newDsrBtn').addEventListener('click',()=>P&&(location.href='/dsr.html?project='+P.id+'&date='+today()));
$('#allDsrBtn').addEventListener('click',()=>P&&(location.href='/dsr.html?project='+P.id+'&date='+today()));
$('#stageList').addEventListener('click',e=>{const s=e.target.closest('[data-save]');if(s)return saveStage(s.dataset.save);const c=e.target.closest('[data-complete]');if(c)return completeStage(c.dataset.complete);});
$('#addInspectionBtn').addEventListener('click',()=>canWrite&&addInspection());
$('#inspectionList').addEventListener('click',e=>{const b=e.target.closest('[data-insp]');if(b)return inspect(b.dataset.insp,b.dataset.outcome);});
$('#addQualityBtn').addEventListener('click',()=>canWrite&&addQuality());
$('#qualityList').addEventListener('click',e=>{const b=e.target.closest('[data-q]');if(b)return qualityResult(b.dataset.q,b.dataset.result);const c=e.target.closest('[data-qclose]');if(c)return closeQuality(c.dataset.qclose);});
$('#addIssueBtn').addEventListener('click',()=>canWrite&&addIssue());
$('#issueList').addEventListener('click',e=>{const b=e.target.closest('[data-resolve]');if(b)return resolveIssue(b.dataset.resolve);});
$('#reportsBody').addEventListener('click',e=>{const b=e.target.closest('[data-report-date]');if(b)location.href='/dsr.html?project='+P.id+'&date='+b.dataset.reportDate;});

await loadBase();

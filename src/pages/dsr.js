import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, initials } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user=await mountShell({route:'site-visits',title:'Daily site report'});
if(!user)throw new Error('redirecting');

const canWrite=['founder','admin','project_manager','site_engineer'].includes(user.role);
const canManager=['founder','admin','project_manager'].includes(user.role);
const qs=new URLSearchParams(location.search);
let projectId=qs.get('project')||'';
let reportDate=qs.get('date')||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});

let REPORT=null,PROJECTS=[],STAGES=[],LABOUR=[],ACTS=[],MATS=[],EQ=[],ISSUES=[],RECENT=[],PROFILES=new Map();
let activeKind=null;

const TABLES={
  labour:'site_report_labour',
  activities:'site_report_activities',
  materials:'site_report_materials',
  equipment:'site_report_equipment',
  issues:'site_issues'
};

async function load(){
  try{
    const a=await Promise.all([
      scopeToUnit(supabase.from('projects').select('id,project_no,code,name,location,start_date,status').is('deleted_at',null).eq('status','active')).order('name'),
      supabase.from('profiles').select('id,full_name,role').eq('is_active',true)
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    PROJECTS=a[0].data||[];PROFILES=new Map((a[1].data||[]).map(x=>[x.id,x]));
    if(!PROJECTS.length){toast('No active construction projects','err');return;}
    if(!projectId||!PROJECTS.some(x=>x.id===projectId))projectId=PROJECTS[0].id;
    fillProjectPicker();
    $('#repDate').value=reportDate;
    await loadReport();
  }catch(e){fail(e);}
}

function project(){return PROJECTS.find(x=>x.id===projectId)||null;}

function fillProjectPicker(){
  $('#repProj').innerHTML=PROJECTS.map(p=>'<option value="'+p.id+'"'+(p.id===projectId?' selected':'')+'>'+esc(p.project_no||p.code||'PROJECT')+' · '+esc(p.name)+'</option>').join('');
}

async function loadReport(){
  try{
    const [stageRes,repRes,recentRes]=await Promise.all([
      supabase.from('construction_stages').select('*').eq('project_id',projectId).order('sort_order'),
      supabase.from('site_reports').select('*').eq('project_id',projectId).eq('report_date',reportDate).maybeSingle(),
      supabase.from('site_reports').select('*').eq('project_id',projectId).order('report_date',{ascending:false}).limit(7)
    ]);
    [stageRes,repRes,recentRes].forEach(r=>{if(r.error)throw r.error;});
    STAGES=stageRes.data||[];REPORT=repRes.data;RECENT=recentRes.data||[];

    if(!REPORT){
      LABOUR=[];ACTS=[];MATS=[];EQ=[];ISSUES=[];
      renderAll();return;
    }

    const a=await Promise.all([
      supabase.from('site_report_labour').select('*').eq('report_id',REPORT.id).order('sort_order'),
      supabase.from('site_report_activities').select('*').eq('report_id',REPORT.id).order('sort_order'),
      supabase.from('site_report_materials').select('*').eq('report_id',REPORT.id).order('sort_order'),
      supabase.from('site_report_equipment').select('*').eq('report_id',REPORT.id).order('sort_order'),
      supabase.from('site_issues').select('*').eq('report_id',REPORT.id).order('created_at')
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    LABOUR=a[0].data||[];ACTS=a[1].data||[];MATS=a[2].data||[];EQ=a[3].data||[];ISSUES=a[4].data||[];
    renderAll();
  }catch(e){fail(e);}
}

function fmtTime(t){return t?String(t).slice(0,5):'';}
function workableHours(){
  if(!REPORT?.start_time||!REPORT?.close_time)return '—';
  const a=REPORT.start_time.split(':').map(Number),b=REPORT.close_time.split(':').map(Number);
  const h=Math.max(0,(b[0]*60+b[1]-a[0]*60-a[1])/60);
  return h.toFixed(1)+' hrs';
}
function person(id){return PROFILES.get(id)?.full_name||'—';}

function renderAll(){
  const p=project();if(!p)return;
  const status=REPORT?.status||'draft',locked=status!=='draft';

  $('#ctxEyebrow').textContent=(p.project_no||p.code||'PROJECT')+' · Daily site report';
  $('#ctxProjectName').textContent=p.name;
  $('#ctxDate').textContent=fmtDate(reportDate);
  $('#ctxReportNo').textContent=REPORT?.report_no||'Draft report not created';
  $('#mastProject').textContent=[p.project_no||p.code,p.name,p.location].filter(Boolean).join(' · ');
  $('#mastReportNo').textContent=REPORT?.report_no||'DRAFT DSR';
  $('#mastDate').textContent=fmtDate(reportDate);
  $('#mastWeather').textContent=REPORT?.weather||'—';
  $('#mastHours').textContent=workableHours();
  $('#mastPreparedBy').textContent=person(REPORT?.created_by)||user.name;
  $('#mastDay').textContent=p.start_date?'Day '+(Math.max(0,Math.floor((new Date(reportDate)-new Date(p.start_date))/86400000))+1)+' on site':'Construction site record';

  $('#weatherInput').value=REPORT?.weather||'';
  $('#groundInput').value=REPORT?.ground_condition||'';
  $('#startTimeInput').value=fmtTime(REPORT?.start_time);
  $('#closeTimeInput').value=fmtTime(REPORT?.close_time);
  ['weatherInput','groundInput','startTimeInput','closeTimeInput'].forEach(id=>{$('#'+id).disabled=locked||!canWrite;});

  paintStatus(status);
  renderLabour();renderActivities();renderMaterials();renderEquipment();renderIssues();paintTotals();renderRecent();renderSignoff();
  const remark=$('.remark');if(remark)remark.textContent=REPORT?.actual_note||'No architect instruction / review note recorded for this report.';
  $$('[data-add]').forEach(b=>b.disabled=locked||!canWrite);
  document.title=(REPORT?.report_no||'Daily Site Report')+' · Bind Build ERP';
}

function paintStatus(status){
  const badge=$('#statusBadge');
  badge.textContent=status==='approved'?'Approved':status==='submitted'?'Submitted':status==='rejected'?'Rejected':'Draft';
  badge.dataset.status=status;

  const rail=$('#railStatus');
  rail.textContent=status==='approved'?'Approved · locked':status==='submitted'?'Awaiting manager review':status==='rejected'?'Rejected · reopen to edit':'Draft · editable';

  ['#submitBtn','#submitTop'].forEach(sel=>{
    const b=$(sel);if(!b)return;
    b.hidden=status!=='draft';
    b.disabled=!canWrite;
  });

  let controls=$('#reviewControls');
  if(!controls){
    const host=$('#submitBtn')?.parentElement;
    if(host){host.insertAdjacentHTML('beforeend','<div id="reviewControls" style="display:grid;gap:8px;margin-top:8px"></div>');controls=$('#reviewControls');}
  }
  if(controls){
    if(status==='submitted'&&canManager){
      controls.innerHTML='<button class="btn-new btn-block" id="approveReportBtn">Approve report</button><button class="btn-ghost btn-block" id="rejectReportBtn">Reject</button>';
      $('#approveReportBtn')?.addEventListener('click',()=>review(true));
      $('#rejectReportBtn')?.addEventListener('click',()=>review(false));
    }else if(status==='rejected'&&canManager){
      controls.innerHTML='<button class="btn-ghost btn-block" id="reopenReportBtn">Reopen as draft</button>';
      $('#reopenReportBtn')?.addEventListener('click',reopen);
    }else controls.innerHTML='';
  }
}

function renderLabour(){
  $('#mpBody').innerHTML=LABOUR.length?LABOUR.map(r=>
    '<tr><td>'+esc(r.trade)+'</td><td class="num">'+r.planned+'</td><td class="num">'+r.present+'</td><td>'+esc(r.remarks||'')+(REPORT?.status==='draft'&&canWrite?' <button class="rm" data-del="labour:'+r.id+'">×</button>':'')+'</td></tr>'
  ).join(''):'<tr><td colspan="4" class="t-empty">No labour recorded</td></tr>';
  $('#mpPlan').textContent=String(LABOUR.reduce((a,r)=>a+Number(r.planned||0),0));
  $('#mpPresent').textContent=String(LABOUR.reduce((a,r)=>a+Number(r.present||0),0));
}

function renderActivities(){
  $('#actList').innerHTML=ACTS.length?ACTS.map(r=>{
    const s=STAGES.find(x=>x.id===r.stage_id);
    const meta=[s?.title,r.qty?Number(r.qty)+' '+(r.unit||''):'',r.reported_progress_pct!=null?'Stage '+Number(r.reported_progress_pct)+'%':''].filter(Boolean).join(' · ');
    return '<div class="issue issue--info"><div><div class="issue__t">'+esc(r.description)+'</div><div class="issue__m">'+esc(meta)+'</div></div>'+(REPORT?.status==='draft'&&canWrite?'<button class="rm" data-del="activities:'+r.id+'">×</button>':'')+'</div>';
  }).join(''):'<div class="t-empty">No work activity recorded</div>';
}

function renderMaterials(){
  $('#matBody').innerHTML=MATS.length?MATS.map(r=>
    '<tr><td>'+esc(r.material)+'</td><td class="num">'+Number(r.qty)+' '+esc(r.unit||'')+'</td><td>'+esc(r.supplier||'')+'</td><td>'+esc(r.challan_no||'')+(REPORT?.status==='draft'&&canWrite?' <button class="rm" data-del="materials:'+r.id+'">×</button>':'')+'</td></tr>'
  ).join(''):'<tr><td colspan="4" class="t-empty">No materials received</td></tr>';
}

function renderEquipment(){
  $('#eqList').innerHTML=EQ.length?EQ.map(r=>
    '<div class="issue issue--info"><div><div class="issue__t">'+esc(r.name)+'</div><div class="issue__m">'+Number(r.hours||0)+' hrs'+(r.remarks?' · '+esc(r.remarks):'')+'</div></div>'+(REPORT?.status==='draft'&&canWrite?'<button class="rm" data-del="equipment:'+r.id+'">×</button>':'')+'</div>'
  ).join(''):'<div class="t-empty">No equipment recorded</div>';
}

function renderIssues(){
  $('#issueList').innerHTML=ISSUES.length?ISSUES.map(r=>
    '<div class="issue '+(r.severity==='critical'?'':'issue--info')+'"><span class="sev sev--'+esc(r.severity)+'"></span><div style="flex:1"><div class="issue__t">'+esc(r.title)+'</div><div class="issue__m">'+esc(r.description||'')+'</div><div class="issue__meta">'+esc(r.category)+' · '+esc(r.severity)+' · '+esc(r.status)+'</div></div>'+(REPORT?.status==='draft'&&canWrite?'<button class="rm" data-del="issues:'+r.id+'">×</button>':'')+'</div>'
  ).join(''):'<div class="t-empty">No issues / observations recorded</div>';
}

function paintTotals(){
  $('#sWorkers').textContent=String(LABOUR.reduce((a,r)=>a+Number(r.present||0),0));
  $('#sActs').textContent=String(ACTS.length);
  $('#sMats').textContent=String(MATS.length);
}

function renderRecent(){
  $('#recentReports').innerHTML=RECENT.length?RECENT.map(r=>
    '<button class="rrow" data-recent-date="'+r.report_date+'" style="width:100%;text-align:left"><span class="rrow__ic">'+esc((r.report_no||'DSR').slice(-4))+'</span><div><div class="rrow__t">'+esc(r.report_no||'DSR')+'</div><div class="rrow__d">'+fmtDate(r.report_date)+'</div></div><span class="rrow__b">'+esc(r.status)+'</span></button>'
  ).join(''):'<div class="t-empty">No recent reports</div>';
}

function renderSignoff(){
  const el=$('.signoff');if(!el)return;
  const prep=person(REPORT?.submitted_by||REPORT?.created_by)||user.name;
  const review=REPORT?.approved_by?person(REPORT.approved_by):'Pending review';
  el.innerHTML='<div class="sign"><div class="sign__k">Prepared / submitted by</div><div class="sign__who"><span class="av">'+esc(initials(prep))+'</span><div><div class="sign__nm">'+esc(prep)+'</div><div class="sign__rl">'+esc(REPORT?.submitted_at?fmtDate(REPORT.submitted_at):'Draft')+'</div></div></div></div>'+
    '<div class="sign"><div class="sign__k">Reviewed by</div><div class="sign__who"><span class="av">'+esc(initials(review))+'</span><div><div class="sign__nm">'+esc(review)+'</div><div class="sign__rl">'+esc(REPORT?.approved_at?fmtDate(REPORT.approved_at):(REPORT?.status==='rejected'?'Rejected':'Awaiting approval'))+'</div></div></div></div>';
}

async function ensureReport(){
  if(REPORT)return REPORT;
  const r=await supabase.from('site_reports').insert({project_id:projectId,report_date:reportDate}).select('*').single();
  if(r.error){fail(r.error);return null;}
  REPORT=r.data;RECENT=[REPORT,...RECENT.filter(x=>x.id!==REPORT.id)];
  renderAll();return REPORT;
}

async function saveMeta(){
  const rep=await ensureReport();if(!rep||rep.status!=='draft')return;
  const r=await supabase.from('site_reports').update({
    weather:$('#weatherInput').value.trim()||null,
    ground_condition:$('#groundInput').value.trim()||null,
    start_time:$('#startTimeInput').value||null,
    close_time:$('#closeTimeInput').value||null
  }).eq('id',rep.id).select('*').single();
  if(r.error)return fail(r.error);REPORT=r.data;renderAll();toast('Site conditions saved');
}

const FIELDS={
  labour:[
    {k:'trade',label:'Trade / agency',type:'text'},
    {k:'planned',label:'Planned workers',type:'number'},
    {k:'present',label:'Present workers',type:'number'},
    {k:'remarks',label:'Remarks',type:'text'}
  ],
  activities:[
    {k:'stage_id',label:'Construction stage',type:'stage'},
    {k:'description',label:'Work executed',type:'text'},
    {k:'qty',label:'Quantity',type:'number'},
    {k:'unit',label:'Unit',type:'text'},
    {k:'reported_progress_pct',label:'Stage progress % after today',type:'number'}
  ],
  materials:[
    {k:'material',label:'Material',type:'text'},
    {k:'qty',label:'Quantity',type:'number'},
    {k:'unit',label:'Unit',type:'text'},
    {k:'supplier',label:'Supplier',type:'text'},
    {k:'challan_no',label:'DC / Invoice no.',type:'text'}
  ],
  equipment:[
    {k:'name',label:'Equipment',type:'text'},
    {k:'hours',label:'Hours used',type:'number'},
    {k:'remarks',label:'Remarks',type:'text'}
  ],
  issues:[
    {k:'category',label:'Category',type:'category'},
    {k:'severity',label:'Severity',type:'severity'},
    {k:'title',label:'Issue / observation',type:'text'},
    {k:'description',label:'Description / action required',type:'text'}
  ]
};

function fieldHtml(f,i){
  if(f.type==='stage')return '<label class="fld"><span class="fld__k">'+f.label+'</span><select class="in" id="f'+(i+1)+'" data-k="'+f.k+'"><option value="">Project level / no stage</option>'+STAGES.filter(s=>s.status!=='completed').map(s=>'<option value="'+s.id+'">'+esc(s.sort_order+'. '+s.title)+'</option>').join('')+'</select></label>';
  if(f.type==='category')return '<label class="fld"><span class="fld__k">'+f.label+'</span><select class="in" id="f'+(i+1)+'" data-k="'+f.k+'">'+['site','material','quality','safety','delay','design','client','vendor','other'].map(v=>'<option value="'+v+'">'+v+'</option>').join('')+'</select></label>';
  if(f.type==='severity')return '<label class="fld"><span class="fld__k">'+f.label+'</span><select class="in" id="f'+(i+1)+'" data-k="'+f.k+'">'+['low','medium','high','critical'].map(v=>'<option value="'+v+'"'+(v==='medium'?' selected':'')+'>'+v+'</option>').join('')+'</select></label>';
  return '<label class="fld"><span class="fld__k">'+f.label+'</span><input class="in" id="f'+(i+1)+'" data-k="'+f.k+'" type="'+f.type+'" '+(f.type==='number'?'min="0"':'')+'/></label>';
}

function openModal(kind){
  if(REPORT&&REPORT.status!=='draft')return toast('This report is locked','err');
  activeKind=kind;
  $('#mTitle').textContent='Add '+kind.replace(/s$/,'');
  $('#modalBody').innerHTML=(FIELDS[kind]||[]).map(fieldHtml).join('');
  $('#modalRoot').classList.add('is-open');
  $('#modalBody input, #modalBody select')?.focus();
}
function closeModal(){$('#modalRoot').classList.remove('is-open');activeKind=null;}

async function insertRow(kind,row){
  const rep=await ensureReport();if(!rep||rep.status!=='draft')return;
  let payload;
  if(kind==='issues'){
    payload={project_id:projectId,report_id:rep.id,stage_id:row.stage_id||null,category:row.category||'site',severity:row.severity||'medium',title:row.title,description:row.description||null,status:'open'};
  }else{
    payload={...row,report_id:rep.id,sort_order:({labour:LABOUR,activities:ACTS,materials:MATS,equipment:EQ}[kind]||[]).length};
  }
  const r=await supabase.from(TABLES[kind]).insert(payload);
  if(r.error)return fail(r.error);toast('Record added');await loadReport();
}

async function removeRow(kind,id){
  if(!REPORT||REPORT.status!=='draft')return toast('This report is locked','err');
  const r=await supabase.from(TABLES[kind]).delete().eq('id',id);
  if(r.error)return fail(r.error);toast('Record removed');await loadReport();
}

async function submit(){
  const rep=await ensureReport();if(!rep)return;
  const r=await supabase.rpc('submit_site_report',{p_report_id:rep.id});
  if(r.error)return fail(r.error);REPORT=r.data;toast('Site report submitted');await loadReport();
}

async function review(approve){
  if(!REPORT)return;
  const comment=prompt(approve?'Approval / architect review note (optional)':'Reason for rejection');if(!approve&&!comment)return;
  const r=await supabase.rpc('review_site_report',{p_report_id:REPORT.id,p_approve:approve,p_comment:comment||null});
  if(r.error)return fail(r.error);REPORT=r.data;toast(approve?'Report approved · progress posted':'Report rejected');await loadReport();
}

async function reopen(){
  if(!REPORT||!canManager)return;
  const r=await supabase.from('site_reports').update({status:'draft',rejection_reason:null}).eq('id',REPORT.id).select('*').single();
  if(r.error)return fail(r.error);REPORT=r.data;toast('Report reopened');await loadReport();
}

document.addEventListener('click',e=>{
  const add=e.target.closest('[data-add]');if(add)return openModal(add.dataset.add);
  if(e.target.closest('[data-close]'))return closeModal();
  const del=e.target.closest('[data-del]');if(del){const parts=del.dataset.del.split(':');return removeRow(parts[0],parts[1]);}
  const recent=e.target.closest('[data-recent-date]');if(recent){reportDate=recent.dataset.recentDate;$('#repDate').value=reportDate;history.replaceState(null,'','/dsr.html?project='+projectId+'&date='+reportDate);loadReport();}
});

$('#modalSave').addEventListener('click',async()=>{
  if(!activeKind)return;
  const row={};
  $$('#modalBody [data-k]').forEach(el=>{row[el.dataset.k]=el.type==='number'?(el.value===''?null:Number(el.value)):el.value.trim();});
  const required={labour:'trade',activities:'description',materials:'material',equipment:'name',issues:'title'}[activeKind];
  if(!row[required])return toast('Complete the required first field','err');
  if(row.reported_progress_pct!=null)row.reported_progress_pct=Math.max(0,Math.min(100,row.reported_progress_pct));
  closeModal();await insertRow(activeKind,row);
});

$('#repProj').addEventListener('change',async e=>{projectId=e.target.value;history.replaceState(null,'','/dsr.html?project='+projectId+'&date='+reportDate);await loadReport();});
$('#repDate').addEventListener('change',async e=>{reportDate=e.target.value;history.replaceState(null,'','/dsr.html?project='+projectId+'&date='+reportDate);await loadReport();});
['weatherInput','groundInput','startTimeInput','closeTimeInput'].forEach(id=>$('#'+id).addEventListener('change',saveMeta));
$('#submitBtn').addEventListener('click',submit);
$('#submitTop').addEventListener('click',submit);
$('.ctx__actions .btn-ghost')?.addEventListener('click',()=>window.print());

await load();

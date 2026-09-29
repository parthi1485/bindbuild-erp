import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user=await mountShell({route:'site-visits',title:'Daily Site Report'});
if(!user)throw new Error('redirecting');

const canWrite=['founder','admin','project_manager','site_engineer'].includes(user.role);
const canManager=['founder','admin','project_manager'].includes(user.role);
const qs=new URLSearchParams(location.search);
let projectId=qs.get('project')||'';
let reportDate=qs.get('date')||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});

let REPORT=null,PROJECTS=[],P=null,STAGES=[],LABOUR=[],ACTS=[],MATS=[],EQ=[],ISSUES=[],RECENT=[],PROFILES=new Map();
const draft=()=>!REPORT||REPORT.status==='draft';

const TABLES={
  labour:{table:'site_report_labour',rows:()=>LABOUR},
  activities:{table:'site_report_activities',rows:()=>ACTS},
  materials:{table:'site_report_materials',rows:()=>MATS},
  equipment:{table:'site_report_equipment',rows:()=>EQ}
};

async function load(){
  try{
    const pr=await scopeToUnit(supabase.from('projects').select('id,project_no,code,name,location,status,start_date').eq('status','active').is('deleted_at',null)).order('name');
    if(pr.error)throw pr.error;
    PROJECTS=pr.data||[];
    if(!PROJECTS.length){
      toast('No active construction projects','err');
      $('#repProj').innerHTML='<option>No active projects</option>';
      return;
    }
    if(!projectId||!PROJECTS.some(x=>x.id===projectId))projectId=PROJECTS[0].id;
    P=PROJECTS.find(x=>x.id===projectId);

    const [st,prof]=await Promise.all([
      supabase.from('construction_stages').select('id,title,sort_order,status,progress_pct').eq('project_id',projectId).order('sort_order'),
      supabase.from('profiles').select('id,full_name,role')
    ]);
    if(st.error)throw st.error;if(prof.error)throw prof.error;
    STAGES=st.data||[];PROFILES=new Map((prof.data||[]).map(x=>[x.id,x]));

    fillProjectPicker();
    $('#repDate').value=reportDate;
    await loadReport();
  }catch(e){fail(e);}
}

function fillProjectPicker(){
  $('#repProj').innerHTML=PROJECTS.map(p=>'<option value="'+p.id+'"'+(p.id===projectId?' selected':'')+'>'+esc(p.project_no||p.code)+' · '+esc(p.name)+'</option>').join('');
}

async function loadReport(){
  try{
    P=PROJECTS.find(x=>x.id===projectId);
    const [rep,recent]=await Promise.all([
      supabase.from('site_reports').select('*').eq('project_id',projectId).eq('report_date',reportDate).maybeSingle(),
      supabase.from('site_reports').select('*').eq('project_id',projectId).order('report_date',{ascending:false}).limit(8)
    ]);
    if(rep.error)throw rep.error;if(recent.error)throw recent.error;
    REPORT=rep.data;RECENT=recent.data||[];

    if(REPORT){
      const a=await Promise.all([
        supabase.from('site_report_labour').select('*').eq('report_id',REPORT.id).order('sort_order'),
        supabase.from('site_report_activities').select('*').eq('report_id',REPORT.id).order('sort_order'),
        supabase.from('site_report_materials').select('*').eq('report_id',REPORT.id).order('sort_order'),
        supabase.from('site_report_equipment').select('*').eq('report_id',REPORT.id).order('sort_order'),
        supabase.from('site_issues').select('*').eq('report_id',REPORT.id).order('created_at')
      ]);
      a.forEach(r=>{if(r.error)throw r.error;});
      LABOUR=a[0].data||[];ACTS=a[1].data||[];MATS=a[2].data||[];EQ=a[3].data||[];ISSUES=a[4].data||[];
    }else{
      LABOUR=[];ACTS=[];MATS=[];EQ=[];ISSUES=[];
    }
    paint();
  }catch(e){fail(e);}
}

function paint(){
  const status=REPORT?.status||'draft';
  $('#ctxEyebrow').textContent=(P?.project_no||P?.code||'Project')+' · Daily site report';
  $('#ctxProjectName').textContent=P?.name||'Project';
  $('#ctxDate').textContent=fmtDate(reportDate);
  $('#ctxReportNo').textContent=REPORT?.report_no||'Draft report';
  $('#mastProject').textContent=[P?.name,P?.location].filter(Boolean).join(' · ');
  $('#mastReportNo').textContent=REPORT?.report_no||'DRAFT DSR';
  $('#mastDay').textContent=P?.start_date?'Construction started '+fmtDate(P.start_date):'Construction site record';
  $('#mastDate').textContent=fmtDate(reportDate);
  const prepared=PROFILES.get(REPORT?.created_by)||{full_name:user.name,role:user.role};
  const reviewed=PROFILES.get(REPORT?.approved_by)||null;
  $('#mastPreparedBy').textContent=prepared.full_name||user.name;
  $('#preparedName').textContent=prepared.full_name||user.name;
  $('#preparedRole').textContent=String(prepared.role||'ERP user').replaceAll('_',' ');
  $('#preparedAvatar').textContent=(prepared.full_name||user.name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  $('#reviewedName').textContent=reviewed?.full_name||'Not reviewed';
  $('#reviewedRole').textContent=reviewed?String(reviewed.role||'').replaceAll('_',' '):'—';
  $('#reviewedAvatar').textContent=reviewed?(reviewed.full_name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase():'—';
  $('#instructionInput').value=REPORT?.architect_instruction||'';
  $('#weatherInput').value=REPORT?.weather||'';
  $('#groundInput').value=REPORT?.ground_condition||'';
  $('#startTimeInput').value=REPORT?.start_time?.slice(0,5)||'';
  $('#closeTimeInput').value=REPORT?.close_time?.slice(0,5)||'';
  $('#mastWeather').textContent=REPORT?.weather||'Not recorded';
  const hrs=hoursBetween(REPORT?.start_time,REPORT?.close_time);
  $('#mastHours').textContent=hrs==null?'—':hrs.toFixed(1)+' hrs';

  paintStatus(status);
  renderLabour();renderActivities();renderMaterials();renderEquipment();renderIssues();paintTotals();renderRecent();renderReview();
  const locked=status!=='draft';
  ['weatherInput','groundInput','startTimeInput','closeTimeInput','instructionInput'].forEach(id=>{$('#'+id).disabled=locked||!canWrite;});
  $$('[data-add]').forEach(b=>b.disabled=locked||!canWrite);
  $('#saveDraftBtn').disabled=locked||!canWrite;
  document.title=(REPORT?.report_no||'Daily Site Report')+' · '+(P?.name||'Project')+' · Bind Build ERP';
}

function hoursBetween(a,b){
  if(!a||!b)return null;
  const [ah,am]=a.split(':').map(Number),[bh,bm]=b.split(':').map(Number);
  return Math.max(0,(bh*60+bm-ah*60-am)/60);
}

function paintStatus(status){
  $('#statusBadge').textContent=status==='approved'?'Approved':status==='submitted'?'Submitted':status==='rejected'?'Rejected':'Draft';
  $('#statusBadge').dataset.status=status;
  $('#railStatus').textContent=status==='approved'?'Approved · locked':status==='submitted'?'Submitted · awaiting review':status==='rejected'?'Rejected · management action required':'Draft · editable';
  ['#submitBtn','#submitTop'].forEach(s=>{
    const b=$(s);if(!b)return;
    b.disabled=status!=='draft'||!canWrite;
    b.textContent=status==='draft'?'Submit report':status==='submitted'?'Awaiting approval':status==='approved'?'Approved':'Rejected';
  });
}

function renderLabour(){
  $('#mpBody').innerHTML=LABOUR.length?LABOUR.map(r=>'<tr><td>'+esc(r.trade)+'</td><td class="num">'+r.planned+'</td><td class="num">'+r.present+'</td><td>'+esc(r.remarks||'')+'</td><td>'+(draft()&&canWrite?'<button class="rm" data-del="labour:'+r.id+'">×</button>':'')+'</td></tr>').join(''):'<tr><td colspan="5" class="t-empty">No labour recorded</td></tr>';
  $('#mpPlan').textContent=String(LABOUR.reduce((a,r)=>a+Number(r.planned||0),0));
  $('#mpPresent').textContent=String(LABOUR.reduce((a,r)=>a+Number(r.present||0),0));
}

function renderActivities(){
  $('#actList').innerHTML=ACTS.length?ACTS.map(r=>{
    const stage=STAGES.find(s=>s.id===r.stage_id);
    return '<div class="act"><div><b>'+esc(r.description)+'</b><div class="muted">'+esc(stage?.title||'Unlinked stage')+(r.qty?' · '+r.qty+' '+esc(r.unit||''):'')+(r.reported_progress_pct!=null?' · stage '+Number(r.reported_progress_pct)+'%':'')+'</div></div>'+(draft()&&canWrite?'<button class="rm" data-del="activities:'+r.id+'">×</button>':'')+'</div>';
  }).join(''):'<div class="t-empty">No work activity recorded</div>';
}

function renderMaterials(){
  $('#matBody').innerHTML=MATS.length?MATS.map(r=>'<tr><td>'+esc(r.material)+'</td><td class="num">'+r.qty+' '+esc(r.unit||'')+'</td><td>'+esc(r.supplier||'')+'</td><td>'+esc(r.challan_no||'—')+'</td><td>'+(draft()&&canWrite?'<button class="rm" data-del="materials:'+r.id+'">×</button>':'')+'</td></tr>').join(''):'<tr><td colspan="5" class="t-empty">No materials received</td></tr>';
}

function renderEquipment(){
  $('#eqList').innerHTML=EQ.length?EQ.map(r=>'<div class="act"><div><b>'+esc(r.name)+'</b><div class="muted">'+Number(r.hours||0)+' hrs'+(r.remarks?' · '+esc(r.remarks):'')+'</div></div>'+(draft()&&canWrite?'<button class="rm" data-del="equipment:'+r.id+'">×</button>':'')+'</div>').join(''):'<div class="t-empty">No equipment recorded</div>';
}

function renderIssues(){
  $('#issueList').innerHTML=ISSUES.length?ISSUES.map(r=>'<div class="issue"><span class="sev sev--'+esc(r.severity)+'"></span><div><div class="issue__t">'+esc(r.title)+'</div><div class="issue__m">'+esc(r.description||'')+'</div><div class="issue__meta">'+esc(r.category.toUpperCase())+' · '+esc(r.status.toUpperCase())+'</div></div>'+(draft()&&canWrite?'<button class="rm" data-issue-del="'+r.id+'">×</button>':'')+'</div>').join(''):'<div class="t-empty">No issues recorded</div>';
}

function paintTotals(){
  $('#sWorkers').textContent=String(LABOUR.reduce((a,r)=>a+Number(r.present||0),0));
  $('#sActs').textContent=String(ACTS.length);
  $('#sMats').textContent=String(MATS.length);
}

function renderRecent(){
  $('#recentReports').innerHTML=RECENT.length?RECENT.map(r=>'<button class="rrow" data-recent-date="'+r.report_date+'" style="width:100%;text-align:left"><span class="rrow__ic">'+esc((r.report_no||'DSR').slice(-4))+'</span><div><div class="rrow__t">'+esc(r.report_no||'Draft DSR')+'</div><div class="rrow__d">'+fmtDate(r.report_date)+'</div></div><span class="rrow__b">'+esc(r.status)+'</span></button>').join(''):'<div class="t-empty">No recent reports</div>';
}

function renderReview(){
  const host=$('#reviewActions');host.innerHTML='';
  if(!REPORT)return;
  if(REPORT.status==='submitted'&&canManager){
    host.innerHTML='<button class="btn-new btn-block" id="approveReportBtn">Approve report</button><button class="btn-ghost btn-block" id="rejectReportBtn">Reject</button>';
    $('#approveReportBtn').onclick=()=>review(true);
    $('#rejectReportBtn').onclick=()=>review(false);
  }else if(REPORT.status==='rejected'&&canManager){
    host.innerHTML='<button class="btn-ghost btn-block" id="reopenReportBtn">Reopen as draft</button>';
    $('#reopenReportBtn').onclick=reopen;
  }
}

async function ensureReport(){
  if(REPORT)return REPORT;
  const r=await supabase.from('site_reports').insert({project_id:projectId,report_date:reportDate,created_by:user.id,status:'draft'}).select('*').single();
  if(r.error){fail(r.error);return null;}
  REPORT=r.data;return REPORT;
}

async function saveDraft(){
  const rep=await ensureReport();if(!rep)return;
  const patch={weather:$('#weatherInput').value.trim()||null,ground_condition:$('#groundInput').value.trim()||null,start_time:$('#startTimeInput').value||null,close_time:$('#closeTimeInput').value||null,architect_instruction:$('#instructionInput').value.trim()||null,updated_at:new Date().toISOString()};
  const r=await supabase.from('site_reports').update(patch).eq('id',rep.id).select('*').single();
  if(r.error)return fail(r.error);REPORT=r.data;toast('Draft saved');paint();
}

const FIELDS={
  labour:[['trade','Trade / agency','text'],['planned','Planned','number'],['present','Present','number'],['remarks','Remarks','text']],
  activities:[['description','Activity','text'],['qty','Quantity','number'],['unit','Unit','text'],['reported_progress_pct','Stage progress %','number']],
  materials:[['material','Material','text'],['qty','Quantity','number'],['unit','Unit','text'],['supplier','Supplier','text'],['challan_no','DC / Invoice','text']],
  equipment:[['name','Equipment','text'],['hours','Hours','number'],['remarks','Remarks','text']],
  issues:[['title','Issue title','text'],['description','Description','text']]
};
let activeKind=null;

function openModal(kind){
  if(!draft()||!canWrite)return;
  activeKind=kind;
  $('#mTitle').textContent=kind==='issues'?'Log site issue':'Add '+kind.replace(/s$/,'');
  let fields=FIELDS[kind].map(([k,label,type],i)=>'<label class="fld"><span class="fld__k">'+label+'</span><input class="in" id="f'+(i+1)+'" data-k="'+k+'" type="'+type+'" '+(type==='number'?'min="0"':'')+'/></label>').join('');
  if(kind==='activities')fields+='<label class="fld"><span class="fld__k">Construction stage</span><select class="in" id="activityStage"><option value="">Unlinked</option>'+STAGES.filter(s=>s.status!=='completed').map(s=>'<option value="'+s.id+'">'+esc(s.sort_order+'. '+s.title)+'</option>').join('')+'</select></label>';
  if(kind==='issues')fields+='<label class="fld"><span class="fld__k">Category</span><select class="in" id="issueCategory"><option>site</option><option>material</option><option>quality</option><option>safety</option><option>delay</option><option>design</option><option>client</option><option>vendor</option><option>other</option></select></label><label class="fld"><span class="fld__k">Severity</span><select class="in" id="issueSeverity"><option>low</option><option selected>medium</option><option>high</option><option>critical</option></select></label>';
  $('#modalBody').innerHTML=fields;$('#modalRoot').classList.add('is-open');$('#modalBody input')?.focus();
}
function closeModal(){$('#modalRoot').classList.remove('is-open');activeKind=null;}

async function insertRow(kind,row){
  const rep=await ensureReport();if(!rep)return;
  if(kind==='issues'){
    const stage=STAGES.find(s=>s.status!=='completed');
    const r=await supabase.from('site_issues').insert({project_id:projectId,report_id:rep.id,stage_id:stage?.id||null,title:row.title,description:row.description||null,category:$('#issueCategory').value,severity:$('#issueSeverity').value,status:'open'});
    if(r.error)return fail(r.error);
  }else{
    if(kind==='activities')row.stage_id=$('#activityStage').value||null;
    const spec=TABLES[kind];
    const r=await supabase.from(spec.table).insert({...row,report_id:rep.id,sort_order:spec.rows().length});
    if(r.error)return fail(r.error);
  }
  closeModal();toast('Record added');await loadReport();
}

async function submit(){
  const rep=await ensureReport();if(!rep)return;
  await saveDraft();
  const r=await supabase.rpc('submit_site_report',{p_report_id:rep.id});
  if(r.error)return fail(r.error);
  REPORT=r.data;toast('Daily site report submitted');await loadReport();
}

async function review(approve){
  const comment=prompt(approve?'Review note (optional)':'Reason for rejection');if(!approve&&!comment)return;
  const r=await supabase.rpc('review_site_report',{p_report_id:REPORT.id,p_approve:approve,p_comment:comment||null});
  if(r.error)return fail(r.error);
  toast(approve?'Report approved · progress updated':'Report rejected');await loadReport();
}

async function reopen(){
  if(!confirm('Reopen this rejected report as an editable draft?'))return;
  const r=await supabase.from('site_reports').update({status:'draft',rejection_reason:null}).eq('id',REPORT.id);
  if(r.error)return fail(r.error);toast('Report reopened');await loadReport();
}

document.addEventListener('click',async e=>{
  const add=e.target.closest('[data-add]');if(add)return openModal(add.dataset.add);
  if(e.target.closest('[data-close]'))return closeModal();

  const del=e.target.closest('[data-del]');
  if(del){
    const [kind,id]=del.dataset.del.split(':');
    const r=await supabase.from(TABLES[kind].table).delete().eq('id',id);
    if(r.error)return fail(r.error);toast('Record removed');return loadReport();
  }
  const issueDel=e.target.closest('[data-issue-del]');
  if(issueDel){
    const r=await supabase.from('site_issues').delete().eq('id',issueDel.dataset.issueDel);
    if(r.error)return fail(r.error);toast('Issue removed');return loadReport();
  }
  const recent=e.target.closest('[data-recent-date]');
  if(recent){reportDate=recent.dataset.recentDate;$('#repDate').value=reportDate;history.replaceState(null,'','/dsr.html?project='+projectId+'&date='+reportDate);return loadReport();}
});

$('#modalSave').addEventListener('click',async()=>{
  if(!activeKind)return;
  const row={};
  $$('#modalBody [data-k]').forEach(inp=>row[inp.dataset.k]=inp.type==='number'?(inp.value===''?null:Number(inp.value)):inp.value.trim());
  const first=FIELDS[activeKind][0][0];if(!row[first])return toast('Fill the first field','err');
  await insertRow(activeKind,row);
});

$('#repProj').addEventListener('change',async e=>{projectId=e.target.value;P=PROJECTS.find(x=>x.id===projectId);history.replaceState(null,'','/dsr.html?project='+projectId+'&date='+reportDate);await loadReport();});
$('#repDate').addEventListener('change',async e=>{reportDate=e.target.value;history.replaceState(null,'','/dsr.html?project='+projectId+'&date='+reportDate);await loadReport();});
$('#saveDraftBtn').addEventListener('click',saveDraft);
$('#submitBtn').addEventListener('click',submit);
$('#submitTop').addEventListener('click',submit);
$('#printBtn').addEventListener('click',()=>window.print());

await load();

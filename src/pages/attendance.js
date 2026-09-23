import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, initials } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'hr',title:'Attendance'});
if(!user)throw new Error('redirecting');

const canMark=['founder','admin','hr','project_manager','site_engineer'].includes(user.role);
let onDate=new URLSearchParams(location.search).get('date')||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
let EMP=[],ATT=[],LEAVES=[],LTYPES=[],ALLOCS=[],PROJECTS=[];
let q='',dept='';

const byId=(rows,id)=>rows.find(x=>x.id===id);

async function load(){
  try{
    const a=await Promise.all([
      scopeToUnit(supabase.from('employees').select('*')).in('status',['active','on_leave']).order('full_name'),
      supabase.from('attendance').select('*').eq('on_date',onDate),
      supabase.from('leave_requests').select('*').eq('status','approved').lte('from_date',onDate).gte('to_date',onDate),
      scopeToUnit(supabase.from('leave_types').select('*')).eq('active',true),
      supabase.from('project_allocations').select('*').eq('status','active').lte('start_date',onDate),
      scopeToUnit(supabase.from('projects').select('id,project_no,code,name').is('deleted_at',null))
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    [EMP,ATT,LEAVES,LTYPES,ALLOCS,PROJECTS]=a.map(r=>r.data||[]);
    ALLOCS=ALLOCS.filter(a=>!a.end_date||a.end_date>=onDate);
    $('#dateInput').value=onDate;
    $('#dateLabel').textContent=fmtDate(onDate);
    render();
  }catch(e){fail(e);}
}

function attendanceRow(empId){return ATT.find(a=>a.employee_id===empId);}
function approvedLeave(empId){return LEAVES.find(l=>l.employee_id===empId);}
function effectiveStatus(empId){return attendanceRow(empId)?.status||(approvedLeave(empId)?'leave':'unmarked');}
function allocation(empId){return ALLOCS.find(a=>a.employee_id===empId);}
function statusChip(s){return '<span class="po-status '+esc(s)+'">'+esc(s.replaceAll('_',' '))+'</span>';}

function render(){
  const depts=[...new Set(EMP.map(e=>e.department).filter(Boolean))].sort();
  $('#deptFilter').innerHTML='<option value="">All departments</option>'+depts.map(d=>'<option value="'+esc(d)+'"'+(d===dept?' selected':'')+'>'+esc(d)+'</option>').join('');
  const rows=EMP.filter(e=>(!dept||e.department===dept)&&(!q||String(e.full_name+' '+(e.designation||'')+' '+(e.department||'')).toLowerCase().includes(q)));
  const counts={present:0,leave:0,absent:0,unmarked:0,wfh:0,half_day:0};
  EMP.forEach(e=>{const s=effectiveStatus(e.id);counts[s]=(counts[s]||0)+1;});
  const present=counts.present+counts.wfh+counts.half_day;

  $('#kStrength').textContent=String(EMP.length);
  $('#kPresent').textContent=String(present);
  $('#kPct').textContent=(EMP.length?Math.round(present/EMP.length*100):0)+'%';
  $('#kLeave').textContent=String(counts.leave);
  $('#kAbsent').textContent=String(counts.absent);
  $('#kUnmarked').textContent=String(counts.unmarked);
  $('#kFlex').textContent=String(counts.wfh+counts.half_day);
  $('#rowCount').textContent=rows.length+' people';

  $('#attBody').innerHTML=rows.length?rows.map(e=>{
    const a=attendanceRow(e.id),s=effectiveStatus(e.id),al=allocation(e.id),p=al?byId(PROJECTS,al.project_id):null;
    const projectMeta=p?(p.project_no||p.code)+' · '+p.name:(e.work_location||'—');
    const acts=canMark?'<div class="po-inline">'+
      ['present','wfh','half_day','absent','leave'].map(x=>'<button class="po-btn'+(s===x?' primary':'')+'" data-mark="'+e.id+':'+x+'" title="'+x.replaceAll('_',' ')+'">'+({present:'P',wfh:'W',half_day:'½',absent:'A',leave:'L'})[x]+'</button>').join('')+
      '</div>':'';
    return '<tr><td><div style="display:flex;gap:9px;align-items:center"><span class="po-avatar">'+esc(initials(e.full_name))+'</span><div><div class="po-doc">'+esc(e.full_name)+'</div><div class="po-meta">'+esc(e.employee_no||'EMP')+' · '+esc(e.designation||'—')+'</div></div></div></td><td>'+esc(e.department||'—')+'</td><td>'+esc(projectMeta)+'</td><td>'+esc(a?.check_in?.slice(0,5)||'—')+'</td><td>'+esc(a?.check_out?.slice(0,5)||'—')+'</td><td>'+statusChip(s)+'</td><td>'+acts+'</td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="po-empty">No employees match this view.</div></td></tr>';

  $('#leaveTag').textContent=String(LEAVES.length);
  $('#leaveList').innerHTML=LEAVES.length?LEAVES.map(l=>{
    const lt=byId(LTYPES,l.leave_type_id);
    return '<div class="po-list-row"><span class="po-avatar">'+esc(initials(byId(EMP,l.employee_id)?.full_name||'?'))+'</span><div class="po-list-body"><div class="po-list-title">'+esc(byId(EMP,l.employee_id)?.full_name||'Employee')+'</div><div class="po-list-meta">'+esc(lt?.name||'Leave')+' · '+Number(l.days)+' day'+(Number(l.days)===1?'':'s')+'</div></div></div>';
  }).join(''):'<div class="po-empty">Nobody has approved leave on this date.</div>';

  $('#allocList').innerHTML=ALLOCS.length?ALLOCS.slice(0,12).map(a=>'<div class="po-list-row"><div class="po-list-body"><div class="po-list-title">'+esc(byId(EMP,a.employee_id)?.full_name||'Employee')+'</div><div class="po-list-meta">'+esc(byId(PROJECTS,a.project_id)?.name||'Project')+' · '+Number(a.allocation_pct)+'%</div></div></div>').join(''):'<div class="po-empty">No active allocations.</div>';

  $('#markAllBtn').disabled=!canMark||!EMP.some(e=>effectiveStatus(e.id)==='unmarked');
}

async function mark(empId,status){
  if(!canMark)return;
  const e=byId(EMP,empId),al=allocation(empId);
  const projectId=['project_manager','site_engineer'].includes(user.role)?al?.project_id||null:null;
  const existing=attendanceRow(empId);
  const now=new Date().toLocaleTimeString('en-GB',{hour12:false,timeZone:'Asia/Kolkata'});
  const inTime=['present','wfh','half_day'].includes(status)?(existing?.check_in||now):null;
  const outTime=existing?.check_out||null;
  const r=await supabase.rpc('mark_employee_attendance',{p_employee_id:empId,p_on_date:onDate,p_status:status,p_project_id:projectId,p_check_in:inTime,p_check_out:outTime,p_note:null});
  if(r.error)return fail(r.error);
  toast((e?.full_name||'Employee')+' · '+status.replaceAll('_',' '));await load();
}

async function markAll(){
  const rows=EMP.filter(e=>effectiveStatus(e.id)==='unmarked'&&(!['project_manager','site_engineer'].includes(user.role)||allocation(e.id)));
  if(!rows.length)return;
  if(!confirm('Mark '+rows.length+' unmarked employees present? Approved leave is excluded.'))return;
  for(const e of rows){
    const al=allocation(e.id);
    const projectId=['project_manager','site_engineer'].includes(user.role)?al?.project_id||null:null;
    const r=await supabase.rpc('mark_employee_attendance',{p_employee_id:e.id,p_on_date:onDate,p_status:'present',p_project_id:projectId,p_check_in:'09:00:00',p_check_out:null,p_note:'Bulk marked'});
    if(r.error){fail(r.error);return;}
  }
  toast(rows.length+' employees marked present');await load();
}

function shift(n){
  const d=new Date(onDate+'T12:00:00');d.setDate(d.getDate()+n);onDate=d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
  history.replaceState(null,'','/attendance.html?date='+onDate);load();
}

$('#prevBtn').addEventListener('click',()=>shift(-1));
$('#nextBtn').addEventListener('click',()=>shift(1));
$('#dateInput').addEventListener('change',e=>{onDate=e.target.value;history.replaceState(null,'','/attendance.html?date='+onDate);load();});
$('#markAllBtn').addEventListener('click',markAll);
$('#searchInput').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();render();});
$('#deptFilter').addEventListener('change',e=>{dept=e.target.value;render();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-mark]');if(!b)return;const [id,s]=b.dataset.mark.split(':');mark(id,s);});

await load();
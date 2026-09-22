import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, initials } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];
const user=await mountShell({route:'hr',title:'Employee'});
if(!user)throw new Error('redirecting');

const canHr=['founder','admin','hr'].includes(user.role);
const canFinance=['founder','admin','finance'].includes(user.role);
const money=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});

let empId=new URLSearchParams(location.search).get('id')||null;
let EMP=null,TEAM=[],PROJECTS=[],ALLOC=[],ATT=[],LEAVES=[],LTYPES=[],BAL=[],COMP=[],PENTRIES=[],PRUNS=[],PINPUTS=[],REIMB=[],GOALS=[],REVIEWS=[],CYCLES=[];

const byId=(rows,id)=>rows.find(x=>x.id===id);
const self=()=>EMP?.profile_id===user.id;
function choose(title,rows,label){
  if(!rows.length){toast('No options available','err');return null;}
  const raw=prompt(title+'\n\n'+rows.map((x,i)=>(i+1)+'. '+label(x)).join('\n')+'\n\nEnter number');
  if(raw===null)return null;const n=Number(raw);
  return Number.isInteger(n)&&n>0&&n<=rows.length?rows[n-1]:null;
}

async function load(){
  try{
    let er;
    if(empId)er=await supabase.from('employees').select('*').eq('id',empId).maybeSingle();
    else er=await supabase.from('employees').select('*').eq('profile_id',user.id).maybeSingle();
    if(er.error)throw er.error;if(!er.data){toast('No employee record linked to this account','err');return;}
    EMP=er.data;empId=EMP.id;

    const a=await Promise.all([
      supabase.from('employees').select('id,full_name,designation,status').order('full_name'),
      supabase.from('projects').select('id,project_no,code,name,status').is('deleted_at',null).order('name'),
      supabase.from('project_allocations').select('*').eq('employee_id',empId).order('start_date',{ascending:false}),
      supabase.from('attendance').select('*').eq('employee_id',empId).order('on_date',{ascending:false}).limit(45),
      supabase.from('leave_requests').select('*').eq('employee_id',empId).order('from_date',{ascending:false}).limit(30),
      supabase.from('leave_types').select('*').eq('active',true).order('name'),
      supabase.from('leave_balances').select('*').eq('employee_id',empId),
      supabase.from('employee_compensation').select('*').eq('employee_id',empId).order('effective_from',{ascending:false}),
      supabase.from('payroll_entries').select('*').eq('employee_id',empId).order('created_at',{ascending:false}).limit(24),
      supabase.from('payroll_inputs').select('*').eq('employee_id',empId).neq('status','cancelled').order('period_month',{ascending:false}).limit(20),
      supabase.from('reimbursements').select('*').eq('employee_id',empId).order('created_at',{ascending:false}).limit(20),
      supabase.from('performance_goals').select('*').eq('employee_id',empId).order('created_at',{ascending:false}),
      supabase.from('performance_reviews').select('*').eq('employee_id',empId).order('due_date',{ascending:false}),
      supabase.from('performance_cycles').select('*').order('start_date',{ascending:false})
    ]);
    a.forEach((r,i)=>{if(r.error&&![7,8,9,10].includes(i))throw r.error;});
    TEAM=a[0].data||[];PROJECTS=a[1].data||[];ALLOC=a[2].data||[];ATT=a[3].data||[];LEAVES=a[4].data||[];LTYPES=a[5].data||[];BAL=a[6].data||[];
    COMP=a[7].error?[]:(a[7].data||[]);PENTRIES=a[8].error?[]:(a[8].data||[]);PINPUTS=a[9].error?[]:(a[9].data||[]);REIMB=a[10].error?[]:(a[10].data||[]);
    GOALS=a[11].data||[];REVIEWS=a[12].data||[];CYCLES=a[13].data||[];

    const runIds=[...new Set(PENTRIES.map(x=>x.payroll_run_id))];
    if(runIds.length){
      const rr=await supabase.from('payroll_runs').select('*').in('id',runIds).order('period_month',{ascending:false});
      if(!rr.error)PRUNS=rr.data||[];
    }
    paint();
  }catch(e){fail(e);}
}

function kv(k,v){return '<div class="po-kv"><span>'+esc(k)+'</span><b>'+esc(v??'—')+'</b></div>';}
function chip(s){return '<span class="po-status '+esc(s||'draft')+'">'+esc(String(s||'draft').replaceAll('_',' '))+'</span>';}

function paint(){
  $('#empAvatar').textContent=initials(EMP.full_name);
  $('#empName').textContent=EMP.full_name;
  $('#empMeta').textContent=[EMP.designation,EMP.department,EMP.work_location].filter(Boolean).join(' · ')||'Employee';
  $('#empFacts').innerHTML='<span class="po-fact">'+esc(EMP.employee_no||'EMP')+'</span><span class="po-fact">'+esc(EMP.employment_type.replaceAll('_',' '))+'</span><span class="po-fact">'+esc(EMP.status)+'</span><span class="po-fact">Joined '+fmtDate(EMP.joining_date)+'</span>';
  $('#editEmpBtn').hidden=!canHr;$('#compBtn').hidden=!canHr;$('#leaveBtn').hidden=!(canHr||self());$('#reimbBtn').hidden=!(canHr||canFinance||self());

  const mgr=byId(TEAM,EMP.manager_employee_id)?.full_name||'—';
  $('#jobDetails').innerHTML=kv('Employee no.',EMP.employee_no)+kv('Designation',EMP.designation)+kv('Department',EMP.department)+kv('Employment',EMP.employment_type.replaceAll('_',' '))+kv('Work location',EMP.work_location)+kv('Joining date',fmtDate(EMP.joining_date))+kv('Work email',EMP.work_email)+kv('Phone',EMP.phone)+kv('Manager',mgr)+kv('Status',EMP.status);

  const currentAlloc=ALLOC.filter(a=>['active','planned'].includes(a.status));
  $('#projectList').innerHTML=currentAlloc.length?currentAlloc.map(a=>'<div class="po-list-row"><div class="po-list-body"><div class="po-list-title">'+esc(byId(PROJECTS,a.project_id)?.name||'Project')+'</div><div class="po-list-meta">'+Number(a.allocation_pct)+'% · '+esc(a.role_on_project||'Team member')+' · '+fmtDate(a.start_date)+(a.end_date?' → '+fmtDate(a.end_date):'')+'</div><div class="po-progress"><span style="width:'+Math.min(100,Number(a.allocation_pct))+'%"></span></div></div>'+chip(a.status)+'</div>').join(''):'<div class="po-empty">No current project allocations.</div>';

  const latest=ATT[0];
  $('#statusCard').innerHTML=kv('Employment',EMP.status)+kv('Latest attendance',latest?fmtDate(latest.on_date)+' · '+latest.status:'No attendance yet')+kv('Active allocation',currentAlloc.reduce((a,x)=>a+Number(x.allocation_pct||0),0)+'%')+kv('Open leave requests',LEAVES.filter(l=>l.status==='submitted').length);

  $('#reimbList').innerHTML=REIMB.length?REIMB.slice(0,8).map(r=>'<div class="po-list-row"><div class="po-list-body"><div class="po-list-title">'+esc(r.reimbursement_no||'Draft claim')+' · '+money(r.amount)+'</div><div class="po-list-meta">'+fmtDate(r.expense_date)+' · '+esc(r.description)+'</div></div>'+chip(r.status)+'</div>').join(''):'<div class="po-empty">No reimbursement claims.</div>';

  $('#attendanceBody').innerHTML=ATT.length?ATT.map(a=>'<tr><td>'+fmtDate(a.on_date)+'</td><td>'+chip(a.status)+'</td><td>'+esc(a.check_in?.slice(0,5)||'—')+'</td><td>'+esc(a.check_out?.slice(0,5)||'—')+'</td><td>'+esc(byId(PROJECTS,a.project_id)?.name||'—')+'</td><td>'+esc(a.note||'—')+'</td></tr>').join(''):'<tr><td colspan="6"><div class="po-empty">No attendance records.</div></td></tr>';

  $('#leaveBody').innerHTML=LEAVES.length?LEAVES.map(l=>'<tr><td>'+esc(byId(LTYPES,l.leave_type_id)?.name||'Leave')+'</td><td>'+fmtDate(l.from_date)+(l.to_date!==l.from_date?' → '+fmtDate(l.to_date):'')+'</td><td>'+Number(l.days)+'</td><td>'+chip(l.status)+'</td><td>'+esc(l.reason||'—')+'</td></tr>').join(''):'<tr><td colspan="5"><div class="po-empty">No leave history.</div></td></tr>';

  $('#leaveBalance').innerHTML=BAL.length?BAL.map(b=>'<div class="po-list-row"><div class="po-list-body"><div class="po-list-title">'+esc(b.name)+'</div><div class="po-list-meta">'+Number(b.available)+' available of '+Number(b.annual_quota)+' · '+Number(b.used)+' used</div><div class="po-progress"><span style="width:'+(Number(b.annual_quota)?Math.min(100,Number(b.used)/Number(b.annual_quota)*100):0)+'%"></span></div></div></div>').join(''):'<div class="po-empty">No leave policy configured.</div>';

  const comp=COMP[0];
  $('#compCard').innerHTML=comp?kv('Effective from',fmtDate(comp.effective_from))+kv('Pay cycle',comp.pay_cycle)+kv('Monthly fixed gross',money(comp.monthly_fixed_gross))+kv('Daily rate',money(comp.daily_rate))+kv('Hourly rate',money(comp.hourly_rate)):'<div class="po-empty">Compensation is unavailable or not configured.</div>';

  $('#payBody').innerHTML=PENTRIES.length?PENTRIES.map(e=>{
    const run=byId(PRUNS,e.payroll_run_id);
    return '<tr><td><div class="po-doc">'+esc(run?.run_no||'Payroll')+'</div></td><td>'+esc(run?.period_month?fmtDate(run.period_month):'—')+'</td><td class="num">'+money(e.fixed_gross)+'</td><td class="num">'+money(e.variable_earnings)+'</td><td class="num">'+money(e.deductions)+'</td><td class="num"><b>'+money(e.net_pay)+'</b></td><td>'+chip(run?.status||'draft')+'</td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="po-empty">No payroll history visible.</div></td></tr>';

  $('#inputList').innerHTML=PINPUTS.length?PINPUTS.map(i=>'<div class="po-list-row"><div class="po-list-body"><div class="po-list-title">'+esc(i.label)+' · '+money(i.amount)+'</div><div class="po-list-meta">'+fmtDate(i.period_month)+' · '+esc(i.input_type)+'</div></div>'+chip(i.status)+'</div>').join(''):'<div class="po-empty">No payroll inputs.</div>';

  $('#goalList').innerHTML=GOALS.length?GOALS.map(g=>'<div class="po-list-row"><div class="po-list-body"><div class="po-list-title">'+esc(g.title)+'</div><div class="po-list-meta">'+esc(byId(CYCLES,g.cycle_id)?.name||'Cycle')+' · Weight '+Number(g.weight_pct)+'% · '+esc(g.metric||'')+(g.target_value?' · target '+esc(g.target_value):'')+'</div><div class="po-progress"><span style="width:'+Number(g.progress_pct)+'%"></span></div></div>'+chip(g.status)+'</div>').join(''):'<div class="po-empty">No KPI goals assigned.</div>';

  $('#reviewList').innerHTML=REVIEWS.length?REVIEWS.map(r=>'<div class="po-list-row"><div class="po-list-body"><div class="po-list-title">'+esc(byId(CYCLES,r.cycle_id)?.name||'Review')+' · '+esc(r.review_type)+'</div><div class="po-list-meta">'+(r.due_date?'Due '+fmtDate(r.due_date):'No due date')+(r.rating?' · '+Number(r.rating)+'/5':'')+'</div></div>'+chip(r.status)+'</div>').join(''):'<div class="po-empty">No performance reviews.</div>';

  document.title=EMP.full_name+' · Bind Build ERP';const here=$('.crumbs .here');if(here)here.textContent=EMP.employee_no||EMP.full_name;
}

async function editEmployee(){
  const designation=prompt('Designation',EMP.designation||'');if(designation===null)return;
  const department=prompt('Department',EMP.department||'')||null;
  const location=prompt('Work location',EMP.work_location||'')||null;
  const status=(prompt('Status: active / on_leave / inactive / exited',EMP.status)||EMP.status).toLowerCase();
  if(!['active','on_leave','inactive','exited'].includes(status))return toast('Invalid status','err');
  const exit=status==='exited'?(prompt('Exit date (YYYY-MM-DD)',today())||today()):EMP.exit_date;
  const r=await supabase.from('employees').update({designation:designation||null,department,work_location:location,status,exit_date:exit,updated_at:new Date().toISOString()}).eq('id',EMP.id);
  if(r.error)return fail(r.error);toast('Employee updated');await load();
}

async function setComp(){
  const effective=prompt('Effective from (YYYY-MM-DD)',today())||today();
  const gross=Number(prompt('Monthly fixed gross',String(COMP[0]?.monthly_fixed_gross||0))||0);
  const daily=Number(prompt('Daily rate (0 if not applicable)',String(COMP[0]?.daily_rate||0))||0);
  const hourly=Number(prompt('Hourly rate (0 if not applicable)',String(COMP[0]?.hourly_rate||0))||0);
  const cycle=(prompt('Pay cycle: monthly / daily / hourly',COMP[0]?.pay_cycle||'monthly')||'monthly').toLowerCase();
  if(!['monthly','daily','hourly'].includes(cycle))return toast('Invalid pay cycle','err');
  const r=await supabase.from('employee_compensation').insert({employee_id:EMP.id,effective_from:effective,monthly_fixed_gross:Math.max(0,gross),daily_rate:Math.max(0,daily),hourly_rate:Math.max(0,hourly),pay_cycle:cycle});
  if(r.error)return fail(r.error);toast('New compensation effective date added');await load();
}

async function requestLeave(){
  if(!LTYPES.length)return toast('HR must configure leave types first','err');
  const lt=choose('Choose leave type',LTYPES,x=>x.name+' · '+Number(x.annual_quota)+' days/year');if(!lt)return;
  const from=prompt('From date (YYYY-MM-DD)',today());if(!from)return;
  const to=prompt('To date (YYYY-MM-DD)',from)||from;
  const span=Math.max(1,(new Date(to+'T12:00:00')-new Date(from+'T12:00:00'))/86400000+1);
  const days=Number(prompt('Chargeable leave days',String(span)));if(!Number.isFinite(days)||days<=0)return;
  const reason=prompt('Reason (optional)')||null;
  const r=await supabase.rpc('submit_leave_request',{p_employee_id:EMP.id,p_leave_type_id:lt.id,p_from_date:from,p_to_date:to,p_days:days,p_reason:reason});
  if(r.error)return fail(r.error);toast('Leave request submitted');await load();
}

async function newReimb(){
  const project=confirm('Link to a project?')?choose('Choose project',PROJECTS,p=>(p.project_no||p.code)+' · '+p.name):null;
  const category=prompt('Category','travel')||'reimbursement';
  const amount=Number(prompt('Amount',0)||0);if(amount<=0)return;
  const desc=prompt('Description');if(!desc)return;
  const ref=prompt('Receipt / bill reference (optional)')||null;
  const r=await supabase.from('reimbursements').insert({business_unit_id:EMP.business_unit_id,employee_id:EMP.id,project_id:project?.id||null,category,expense_date:today(),amount,description:desc,receipt_ref:ref,status:'draft'}).select('id').single();
  if(r.error)return fail(r.error);
  const s=await supabase.rpc('submit_reimbursement',{p_reimbursement_id:r.data.id});if(s.error)return fail(s.error);
  toast('Reimbursement submitted');await load();
}

$('#backHrBtn').addEventListener('click',()=>location.href='/hr.html');
$('#editEmpBtn').addEventListener('click',()=>canHr&&editEmployee());
$('#compBtn').addEventListener('click',()=>canHr&&setComp());
$('#leaveBtn').addEventListener('click',()=>requestLeave());
$('#reimbBtn').addEventListener('click',()=>newReimb());
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;$$('#tabs [data-tab]').forEach(x=>x.classList.toggle('on',x===b));$$('[data-panel]').forEach(p=>p.classList.toggle('on',p.dataset.panel===b.dataset.tab));});

await load();
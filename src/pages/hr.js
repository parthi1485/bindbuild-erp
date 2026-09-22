import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit, activeUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, initials } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'hr',title:'HR'});
if(!user)throw new Error('redirecting');

const canHr=['founder','admin','hr'].includes(user.role);
const canApprovePayroll=['founder','admin'].includes(user.role);
const canFinance=['founder','admin','finance'].includes(user.role);
const money=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const monthStart=()=>today().slice(0,7)+'-01';

let EMP=[],ATT=[],LEAVES=[],LTYPES=[],RUNS=[],INPUTS=[],REIMB=[],ALLOCS=[],PROJECTS=[],REVIEWS=[],PROFILES=[],COMP=[];
let q='',dept='';

const byId=(rows,id)=>rows.find(x=>x.id===id);
const empName=id=>byId(EMP,id)?.full_name||'Employee';
const projectName=id=>byId(PROJECTS,id)?.name||'—';

function choose(title,rows,label){
  if(!rows.length){toast('No options available','err');return null;}
  const raw=prompt(title+'\n\n'+rows.map((x,i)=>(i+1)+'. '+label(x)).join('\n')+'\n\nEnter number');
  if(raw===null)return null;const n=Number(raw);
  return Number.isInteger(n)&&n>0&&n<=rows.length?rows[n-1]:null;
}

async function load(){
  try{
    const d=today();
    const a=await Promise.all([
      scopeToUnit(supabase.from('employees').select('*')).in('status',['active','on_leave']).order('full_name'),
      supabase.from('attendance').select('*').eq('on_date',d),
      supabase.from('leave_requests').select('*').eq('status','submitted').order('from_date'),
      scopeToUnit(supabase.from('leave_types').select('*')).eq('active',true).order('name'),
      scopeToUnit(supabase.from('payroll_runs').select('*')).order('period_month',{ascending:false}).limit(12),
      supabase.from('payroll_inputs').select('*').eq('period_month',monthStart()).neq('status','cancelled').order('created_at',{ascending:false}),
      scopeToUnit(supabase.from('reimbursements').select('*')).order('created_at',{ascending:false}).limit(30),
      supabase.from('project_allocations').select('*').in('status',['active','planned']).order('start_date',{ascending:false}),
      scopeToUnit(supabase.from('projects').select('id,project_no,code,name,status').is('deleted_at',null)).order('name'),
      supabase.from('performance_reviews').select('*').neq('status','final').order('due_date',{ascending:true}),
      supabase.from('profiles').select('id,full_name,role,is_active').eq('is_active',true).order('full_name'),
      canHr||canFinance?supabase.from('employee_compensation').select('*').order('effective_from',{ascending:false}):Promise.resolve({data:[]})
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    [EMP,ATT,LEAVES,LTYPES,RUNS,INPUTS,REIMB,ALLOCS,PROJECTS,REVIEWS,PROFILES,COMP]=a.map(r=>r.data||[]);
    render();
  }catch(e){fail(e);}
}

function attendanceStatus(e){
  const a=ATT.find(x=>x.employee_id===e.id);
  if(a)return a.status;
  const leave=LEAVES.find(l=>l.employee_id===e.id&&l.status==='approved'&&l.from_date<=today()&&l.to_date>=today());
  return leave?'leave':'unmarked';
}

function render(){
  const active=EMP.length,present=EMP.filter(e=>['present','wfh','half_day'].includes(attendanceStatus(e))).length;
  const onLeave=EMP.filter(e=>attendanceStatus(e)==='leave').length;
  const current=RUNS.find(r=>r.period_month===monthStart()&&r.status!=='cancelled');
  const pendingReimb=REIMB.filter(r=>!['paid','rejected','cancelled'].includes(r.status));
  $('#kHead').textContent=String(active);
  $('#kDept').textContent=new Set(EMP.map(e=>e.department).filter(Boolean)).size+' departments';
  $('#kPresent').textContent=String(present);
  $('#kPresentMeta').textContent=(active?Math.round(present/active*100):0)+'% attendance';
  $('#kLeave').textContent=String(onLeave);
  $('#kPayroll').textContent=money(current?.total_net||0);
  $('#kPayrollMeta').textContent=current?String(current.status).toUpperCase():'No run this month';
  $('#kReimb').textContent=money(pendingReimb.reduce((a,r)=>a+Number(r.amount||0),0));
  $('#kReimbMeta').textContent=pendingReimb.length+' pending';
  $('#kReviews').textContent=String(REVIEWS.length);
  renderTeam();renderLeaves();renderPayroll();renderReimb();renderAlloc();renderInputs();renderLeaveTypes();
  $('#addEmployeeBtn').disabled=!canHr;
  $('#leaveTypeBtn').disabled=!canHr;
  $('#payInputBtn').disabled=!canHr;
  $('#generatePayrollBtn').disabled=!canHr;
  $('#allocateBtn').disabled=!['founder','admin','hr','project_manager'].includes(user.role);
}

function renderTeam(){
  const depts=[...new Set(EMP.map(e=>e.department).filter(Boolean))].sort();
  $('#deptFilter').innerHTML='<option value="">All departments</option>'+depts.map(d=>'<option value="'+esc(d)+'"'+(d===dept?' selected':'')+'>'+esc(d)+'</option>').join('');
  const rows=EMP.filter(e=>(!dept||e.department===dept)&&(!q||String(e.full_name+' '+(e.designation||'')+' '+(e.department||'')).toLowerCase().includes(q)));
  $('#teamCount').textContent=rows.length+' people';
  $('#teamBody').innerHTML=rows.length?rows.map(e=>{
    const st=attendanceStatus(e);
    return '<tr><td><div style="display:flex;gap:9px;align-items:center"><span class="po-avatar">'+esc(initials(e.full_name))+'</span><div><div class="po-doc">'+esc(e.full_name)+'</div><div class="po-meta">'+esc(e.employee_no||'EMP')+' · '+esc(e.designation||'—')+'</div></div></div></td><td>'+esc(e.department||'—')+'</td><td>'+esc(e.employment_type.replaceAll('_',' '))+'</td><td>'+esc(e.work_location||'—')+'</td><td><span class="po-status '+esc(st)+'">'+esc(st.replaceAll('_',' '))+'</span></td><td><button class="po-btn" data-emp="'+e.id+'">Open</button></td></tr>';
  }).join(''):'<tr><td colspan="6"><div class="po-empty">No employees match this view.</div></td></tr>';
}

function renderLeaves(){
  $('#leaveCount').textContent=String(LEAVES.length);
  $('#leaveBody').innerHTML=LEAVES.length?LEAVES.map(l=>{
    const lt=byId(LTYPES,l.leave_type_id);
    const acts=canHr?'<button class="po-btn primary" data-leave-approve="'+l.id+'">Approve</button><button class="po-btn danger" data-leave-reject="'+l.id+'">Reject</button>':'';
    return '<tr><td>'+esc(empName(l.employee_id))+'</td><td>'+esc(lt?.name||'Leave')+'</td><td>'+fmtDate(l.from_date)+(l.to_date!==l.from_date?' → '+fmtDate(l.to_date):'')+'</td><td>'+Number(l.days)+'</td><td>'+esc(l.reason||'—')+'</td><td><div class="po-inline">'+acts+'</div></td></tr>';
  }).join(''):'<tr><td colspan="6"><div class="po-empty">No submitted leave requests.</div></td></tr>';
}

function renderPayroll(){
  $('#payrollBody').innerHTML=RUNS.length?RUNS.map(r=>{
    let acts='';
    if(r.status==='draft'&&canHr)acts='<button class="po-btn primary" data-pay-submit="'+r.id+'">Send review</button>';
    if(r.status==='review'&&canApprovePayroll)acts='<button class="po-btn primary" data-pay-approve="'+r.id+'">Approve</button>';
    if(r.status==='approved'&&canFinance)acts='<button class="po-btn primary" data-pay-paid="'+r.id+'">Mark paid</button>';
    return '<tr><td><div class="po-doc">'+esc(r.run_no||'PAY')+'</div></td><td>'+fmtDate(r.period_month)+'</td><td class="num">'+money(r.total_gross)+'</td><td class="num">'+money(r.total_deductions)+'</td><td class="num"><b>'+money(r.total_net)+'</b></td><td><span class="po-status '+esc(r.status)+'">'+esc(r.status)+'</span></td><td><div class="po-inline">'+acts+'</div></td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="po-empty">No payroll runs yet.</div></td></tr>';
}

function renderReimb(){
  $('#reimbBody').innerHTML=REIMB.length?REIMB.map(r=>{
    let acts='';
    if(r.status==='draft')acts='<button class="po-btn primary" data-r-submit="'+r.id+'">Submit</button>';
    if(r.status==='submitted'&&canHr)acts='<button class="po-btn primary" data-r-verify="'+r.id+'">Verify</button><button class="po-btn danger" data-r-reject="'+r.id+'">Reject</button>';
    if(r.status==='hr_verified'&&canFinance)acts='<button class="po-btn primary" data-r-approve="'+r.id+'">Approve</button>';
    if(r.status==='approved'&&canFinance)acts='<button class="po-btn primary" data-r-pay="'+r.id+'">Pay</button>';
    return '<tr><td><div class="po-doc">'+esc(r.reimbursement_no||'DRAFT')+'</div><div class="po-meta">'+fmtDate(r.expense_date)+' · '+esc(r.category||'expense')+'</div></td><td>'+esc(empName(r.employee_id))+'</td><td>'+esc(projectName(r.project_id))+'</td><td class="num"><b>'+money(r.amount)+'</b></td><td><span class="po-status '+esc(r.status)+'">'+esc(r.status.replaceAll('_',' '))+'</span></td><td><div class="po-inline">'+acts+'</div></td></tr>';
  }).join(''):'<tr><td colspan="6"><div class="po-empty">No reimbursement claims.</div></td></tr>';
}

function renderAlloc(){
  $('#allocationList').innerHTML=ALLOCS.length?ALLOCS.slice(0,12).map(a=>'<div class="po-list-row"><span class="po-avatar">'+esc(initials(empName(a.employee_id)))+'</span><div class="po-list-body"><div class="po-list-title">'+esc(empName(a.employee_id))+'</div><div class="po-list-meta">'+esc(projectName(a.project_id))+' · '+Number(a.allocation_pct)+'% · '+esc(a.role_on_project||'Team')+'</div><div class="po-progress"><span style="width:'+Math.min(100,Number(a.allocation_pct))+'%"></span></div></div></div>').join(''):'<div class="po-empty">No active project allocations.</div>';
}

function renderInputs(){
  $('#inputCount').textContent=String(INPUTS.length);
  $('#payInputList').innerHTML=INPUTS.length?INPUTS.slice(0,10).map(i=>'<div class="po-list-row"><div class="po-list-body"><div class="po-list-title">'+esc(empName(i.employee_id))+' · '+esc(i.label)+'</div><div class="po-list-meta">'+esc(i.input_type)+' · '+money(i.amount)+'</div></div><span class="po-status '+esc(i.status)+'">'+esc(i.status)+'</span></div>').join(''):'<div class="po-empty">No variable payroll inputs this month.</div>';
}

function renderLeaveTypes(){
  $('#leaveTypeCount').textContent=String(LTYPES.length);
  $('#leaveTypeList').innerHTML=LTYPES.length?LTYPES.map(l=>'<div class="po-list-row"><div class="po-list-body"><div class="po-list-title">'+esc(l.name)+' · '+esc(l.code)+'</div><div class="po-list-meta">'+Number(l.annual_quota)+' days/year · '+(l.paid?'Paid':'Unpaid')+'</div></div></div>').join(''):'<div class="po-empty">Configure leave types before staff submit leave.</div>';
}

async function addEmployee(){
  const name=prompt('Employee full name');if(!name)return;
  const designation=prompt('Designation')||null;
  const department=prompt('Department e.g. Design / Site / Sales / Admin')||null;
  const employment=(prompt('Employment: full_time / part_time / contract / intern / consultant','full_time')||'full_time').toLowerCase();
  if(!['full_time','part_time','contract','intern','consultant'].includes(employment))return toast('Invalid employment type','err');
  const location=prompt('Work location','Studio')||null;
  const join=prompt('Joining date (YYYY-MM-DD)',today())||today();
  const email=prompt('Work email (optional)')||null;
  const phone=prompt('Phone (optional)')||null;
  let profileId=null;
  const available=PROFILES.filter(p=>!EMP.some(e=>e.profile_id===p.id));
  if(available.length&&confirm('Link this employee to an existing ERP login?')){
    const p=choose('Choose ERP account',available,x=>(x.full_name||'User')+' · '+x.role);profileId=p?.id||null;
  }
  const r=await supabase.from('employees').insert({business_unit_id:activeUnit(),profile_id:profileId,full_name:name.trim(),work_email:email,phone,designation,department,employment_type:employment,work_location:location,joining_date:join,status:'active'}).select('*').single();
  if(r.error)return fail(r.error);
  if(confirm('Set monthly fixed gross compensation now?')){
    const amount=Number(prompt('Monthly fixed gross',0)||0);
    if(amount>=0){const c=await supabase.from('employee_compensation').insert({employee_id:r.data.id,effective_from:join,monthly_fixed_gross:amount});if(c.error)return fail(c.error);}
  }
  toast((r.data.employee_no||'Employee')+' added');await load();
}

async function addLeaveType(){
  const code=(prompt('Leave code e.g. CL / SL / UPL')||'').trim().toUpperCase();if(!code)return;
  const name=prompt('Leave type name');if(!name)return;
  const quota=Number(prompt('Annual quota in days','0')||0);if(quota<0)return;
  const paid=confirm('Is this a paid leave type?');
  const r=await supabase.from('leave_types').insert({business_unit_id:activeUnit(),code,name:name.trim(),annual_quota:quota,paid,active:true});
  if(r.error)return fail(r.error);toast('Leave type added');await load();
}

async function reviewLeave(id,approve){
  const note=approve?prompt('Approval note (optional)'):prompt('Reason for rejection');
  if(!approve&&!note)return;
  const r=await supabase.rpc('review_leave_request',{p_leave_id:id,p_approve:approve,p_note:note||null});
  if(r.error)return fail(r.error);toast(approve?'Leave approved':'Leave rejected');await load();
}

async function addPayrollInput(){
  const emp=choose('Choose employee',EMP,e=>e.full_name+' · '+(e.designation||'Employee'));if(!emp)return;
  const type=(prompt('Input type: earning / deduction','earning')||'earning').toLowerCase();
  if(!['earning','deduction'].includes(type))return toast('Invalid input type','err');
  const label=prompt('Label e.g. Bonus / Site allowance / Advance recovery');if(!label)return;
  const amount=Number(prompt('Amount',0)||0);if(amount<0)return;
  const note=prompt('Note (optional)')||null;
  const r=await supabase.from('payroll_inputs').insert({employee_id:emp.id,period_month:monthStart(),input_type:type,label,amount,notes:note,status:'approved',approved_by:user.id,approved_at:new Date().toISOString()});
  if(r.error)return fail(r.error);toast('Payroll input added');await load();
}

async function generatePayroll(){
  const r=await supabase.rpc('generate_payroll_run',{p_business_unit_id:activeUnit(),p_period_month:monthStart()});
  if(r.error)return fail(r.error);toast('Payroll run generated');await load();
}
async function submitPayroll(id){const r=await supabase.rpc('submit_payroll_run',{p_run_id:id});if(r.error)return fail(r.error);toast('Payroll sent for approval');await load();}
async function approvePayroll(id){const r=await supabase.rpc('approve_payroll_run',{p_run_id:id});if(r.error)return fail(r.error);toast('Payroll approved');await load();}
async function payPayroll(id){
  const ref=prompt('Bank batch / payment reference')||null;
  const r=await supabase.rpc('mark_payroll_paid',{p_run_id:id,p_pay_date:today(),p_reference:ref});
  if(r.error)return fail(r.error);toast('Payroll marked paid');await load();
}

async function newReimbursement(){
  const emp=choose('Choose employee',EMP,e=>e.full_name);if(!emp)return;
  const project=confirm('Link this claim to a project?')?choose('Choose project',PROJECTS,p=>(p.project_no||p.code)+' · '+p.name):null;
  const category=prompt('Category e.g. travel / site purchase / fuel / client meeting','travel')||'reimbursement';
  const amount=Number(prompt('Claim amount',0)||0);if(amount<=0)return toast('Amount must be positive','err');
  const desc=prompt('Description');if(!desc)return;
  const receipt=prompt('Receipt / bill reference (optional)')||null;
  const r=await supabase.from('reimbursements').insert({business_unit_id:activeUnit(),employee_id:emp.id,project_id:project?.id||null,category,expense_date:today(),amount,description:desc,receipt_ref:receipt,status:'draft'}).select('*').single();
  if(r.error)return fail(r.error);
  if(confirm('Submit claim now?')){const s=await supabase.rpc('submit_reimbursement',{p_reimbursement_id:r.data.id});if(s.error)return fail(s.error);toast('Reimbursement submitted');}
  else toast('Reimbursement draft saved');
  await load();
}
async function submitReimb(id){const r=await supabase.rpc('submit_reimbursement',{p_reimbursement_id:id});if(r.error)return fail(r.error);toast('Claim submitted');await load();}
async function verifyReimb(id,approve){const reason=approve?null:prompt('Rejection reason');if(!approve&&!reason)return;const r=await supabase.rpc('verify_reimbursement',{p_reimbursement_id:id,p_approve:approve,p_reason:reason});if(r.error)return fail(r.error);toast(approve?'Claim HR-verified':'Claim rejected');await load();}
async function approveReimb(id){const r=await supabase.rpc('approve_reimbursement',{p_reimbursement_id:id,p_approve:true,p_reason:null});if(r.error)return fail(r.error);toast('Claim approved and posted to expenses');await load();}
async function payReimb(id){const ref=prompt('Payment reference / UTR')||null;const r=await supabase.rpc('pay_reimbursement',{p_reimbursement_id:id,p_pay_date:today(),p_reference:ref});if(r.error)return fail(r.error);toast('Reimbursement paid');await load();}

async function allocate(){
  const emp=choose('Choose employee',EMP,e=>e.full_name+' · '+(e.designation||''));if(!emp)return;
  const project=choose('Choose project',PROJECTS,p=>(p.project_no||p.code)+' · '+p.name);if(!project)return;
  const pct=Number(prompt('Allocation %','100'));if(!Number.isFinite(pct)||pct<=0||pct>100)return toast('Allocation must be 1–100','err');
  const role=prompt('Role on project',emp.designation||'Team member')||null;
  const start=prompt('Start date',today())||today();
  const end=prompt('End date (optional)','')||null;
  const r=await supabase.from('project_allocations').insert({employee_id:emp.id,project_id:project.id,allocation_pct:pct,role_on_project:role,start_date:start,end_date:end,status:'active'});
  if(r.error)return fail(r.error);toast('Project allocation saved');await load();
}

$('#attendanceBtn').addEventListener('click',()=>location.href='/attendance.html');
$('#peopleBtn').addEventListener('click',()=>location.href='/people.html');
$('#leaveTypeBtn').addEventListener('click',()=>canHr&&addLeaveType());
$('#addEmployeeBtn').addEventListener('click',()=>canHr&&addEmployee());
$('#payInputBtn').addEventListener('click',()=>canHr&&addPayrollInput());
$('#generatePayrollBtn').addEventListener('click',()=>canHr&&generatePayroll());
$('#newReimbBtn').addEventListener('click',newReimbursement);
$('#allocateBtn').addEventListener('click',allocate);
$('#teamSearch').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();renderTeam();});
$('#deptFilter').addEventListener('change',e=>{dept=e.target.value;renderTeam();});

document.addEventListener('click',e=>{
  const checks=[
    ['[data-emp]',b=>location.href='/employee.html?id='+b.dataset.emp],
    ['[data-leave-approve]',b=>reviewLeave(b.dataset.leaveApprove,true)],
    ['[data-leave-reject]',b=>reviewLeave(b.dataset.leaveReject,false)],
    ['[data-pay-submit]',b=>submitPayroll(b.dataset.paySubmit)],
    ['[data-pay-approve]',b=>approvePayroll(b.dataset.payApprove)],
    ['[data-pay-paid]',b=>payPayroll(b.dataset.payPaid)],
    ['[data-r-submit]',b=>submitReimb(b.dataset.rSubmit)],
    ['[data-r-verify]',b=>verifyReimb(b.dataset.rVerify,true)],
    ['[data-r-reject]',b=>verifyReimb(b.dataset.rReject,false)],
    ['[data-r-approve]',b=>approveReimb(b.dataset.rApprove)],
    ['[data-r-pay]',b=>payReimb(b.dataset.rPay)]
  ];
  for(const [sel,fn] of checks){const b=e.target.closest(sel);if(b){fn(b);break;}}
});

await load();
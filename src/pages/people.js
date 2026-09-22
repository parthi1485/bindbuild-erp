import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit, activeUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, initials } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'people',title:'People & Performance'});
if(!user)throw new Error('redirecting');

const canPeople=['founder','admin','hr','project_manager'].includes(user.role);
const canCycle=['founder','admin','hr'].includes(user.role);
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const projectHint=new URLSearchParams(location.search).get('project');
const monthKey=()=>today().slice(0,7);

let EMP=[],PROJECTS=[],ALLOC=[],CYCLES=[],GOALS=[],REVIEWS=[],KUDOS=[];
let SELF_EMP=null;

const byId=(rows,id)=>rows.find(x=>x.id===id);
const empName=id=>byId(EMP,id)?.full_name||'Employee';
const projectName=id=>byId(PROJECTS,id)?.name||'—';
const cycleName=id=>byId(CYCLES,id)?.name||'Cycle';
function choose(title,rows,label){
  if(!rows.length){toast('No options available','err');return null;}
  const raw=prompt(title+'\n\n'+rows.map((x,i)=>(i+1)+'. '+label(x)).join('\n')+'\n\nEnter number');
  if(raw===null)return null;const n=Number(raw);
  return Number.isInteger(n)&&n>0&&n<=rows.length?rows[n-1]:null;
}
function chip(s){return '<span class="po-status '+esc(s||'draft')+'">'+esc(String(s||'draft').replaceAll('_',' '))+'</span>';}

async function load(){
  try{
    const a=await Promise.all([
      scopeToUnit(supabase.from('employees').select('*')).in('status',['active','on_leave']).order('full_name'),
      scopeToUnit(supabase.from('projects').select('id,project_no,code,name,status').is('deleted_at',null)).order('name'),
      supabase.from('project_allocations').select('*').in('status',['active','planned']).order('start_date',{ascending:false}),
      scopeToUnit(supabase.from('performance_cycles').select('*')).order('start_date',{ascending:false}),
      supabase.from('performance_goals').select('*').neq('status','cancelled').order('created_at',{ascending:false}),
      supabase.from('performance_reviews').select('*').order('due_date',{ascending:true}),
      supabase.from('kudos').select('*').order('created_at',{ascending:false}).limit(30)
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    [EMP,PROJECTS,ALLOC,CYCLES,GOALS,REVIEWS,KUDOS]=a.map(r=>r.data||[]);
    SELF_EMP=EMP.find(e=>e.profile_id===user.id)||null;
    render();
  }catch(e){fail(e);}
}

function render(){
  const activeAlloc=ALLOC.filter(a=>a.status==='active'&&a.start_date<=today()&&(!a.end_date||a.end_date>=today()));
  const allocatedPeople=new Set(activeAlloc.map(a=>a.employee_id)).size;
  const avg=EMP.length?Math.round(activeAlloc.reduce((a,x)=>a+Number(x.allocation_pct||0),0)/EMP.length):0;
  const atRisk=GOALS.filter(g=>g.status==='at_risk').length;
  const due=REVIEWS.filter(r=>r.status!=='final').length;
  const kudosMonth=KUDOS.filter(k=>String(k.created_at).slice(0,7)===monthKey()).length;

  $('#kPeople').textContent=String(EMP.length);
  $('#kAllocated').textContent=(EMP.length?Math.round(allocatedPeople/EMP.length*100):0)+'%';
  $('#kCapacity').textContent=avg+'%';
  $('#kRisk').textContent=String(atRisk);
  $('#kDue').textContent=String(due);
  $('#kKudos').textContent=String(kudosMonth);
  $('#cycleBtn').disabled=!canCycle;
  $('#allocBtn').disabled=!canPeople;
  $('#goalBtn').disabled=!canPeople;
  $('#reviewBtn').disabled=!canPeople;
  $('#kudoBtn').disabled=!SELF_EMP;

  renderAlloc();renderGoals();renderReviews();renderCycles();renderCapacity();renderKudos();
}

function renderAlloc(){
  $('#allocCount').textContent=String(ALLOC.length);
  $('#allocBody').innerHTML=ALLOC.length?ALLOC.map(a=>'<tr><td>'+esc(empName(a.employee_id))+'</td><td>'+esc(projectName(a.project_id))+'</td><td>'+esc(a.role_on_project||'Team member')+'</td><td class="num"><b>'+Number(a.allocation_pct)+'%</b></td><td>'+fmtDate(a.start_date)+(a.end_date?' → '+fmtDate(a.end_date):'')+'</td><td>'+chip(a.status)+'</td></tr>').join(''):'<tr><td colspan="6"><div class="po-empty">No project allocations.</div></td></tr>';
}

function renderGoals(){
  $('#goalCount').textContent=String(GOALS.length);
  $('#goalBody').innerHTML=GOALS.length?GOALS.map(g=>{
    const meta=cycleName(g.cycle_id)+(g.project_id?' · '+projectName(g.project_id):'');
    return '<tr><td>'+esc(empName(g.employee_id))+'</td><td><div class="po-doc">'+esc(g.title)+'</div><div class="po-meta">'+esc(g.metric||'')+(g.target_value?' · target '+esc(g.target_value):'')+'</div></td><td>'+esc(meta)+'</td><td class="num">'+Number(g.weight_pct)+'%</td><td><div>'+Number(g.progress_pct)+'%</div><div class="po-progress"><span style="width:'+Number(g.progress_pct)+'%"></span></div></td><td>'+chip(g.status)+'</td><td>'+(canPeople?'<button class="po-btn" data-goal="'+g.id+'">Update</button>':'')+'</td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="po-empty">No KPI goals yet.</div></td></tr>';
}

function renderReviews(){
  $('#reviewBody').innerHTML=REVIEWS.length?REVIEWS.map(r=>'<tr><td>'+esc(empName(r.employee_id))+'</td><td>'+esc(cycleName(r.cycle_id))+'</td><td>'+esc(r.review_type)+'</td><td>'+(r.due_date?fmtDate(r.due_date):'—')+'</td><td>'+(r.rating?Number(r.rating).toFixed(1)+'/5':'—')+'</td><td>'+chip(r.status)+'</td><td>'+(canPeople&&r.status!=='final'?'<button class="po-btn primary" data-review="'+r.id+'">Complete</button>':'')+'</td></tr>').join(''):'<tr><td colspan="7"><div class="po-empty">No performance reviews.</div></td></tr>';
}

function renderCycles(){
  $('#cycleCount').textContent=String(CYCLES.length);
  $('#cycleList').innerHTML=CYCLES.length?CYCLES.map(c=>'<div class="po-list-row"><div class="po-list-body"><div class="po-list-title">'+esc(c.name)+' · '+esc(c.code)+'</div><div class="po-list-meta">'+fmtDate(c.start_date)+' → '+fmtDate(c.end_date)+'</div></div>'+chip(c.status)+'</div>').join(''):'<div class="po-empty">Create a review cycle before assigning KPIs.</div>';
}

function renderCapacity(){
  const active=ALLOC.filter(a=>a.status==='active'&&a.start_date<=today()&&(!a.end_date||a.end_date>=today()));
  const sums=new Map();
  active.forEach(a=>sums.set(a.employee_id,(sums.get(a.employee_id)||0)+Number(a.allocation_pct||0)));
  const rows=EMP.map(e=>({e,pct:sums.get(e.id)||0})).filter(x=>x.pct===0||x.pct>=90).sort((a,b)=>b.pct-a.pct);
  $('#capacityAlerts').textContent=String(rows.length);
  $('#capacityList').innerHTML=rows.length?rows.slice(0,10).map(x=>'<div class="po-list-row"><span class="po-avatar">'+esc(initials(x.e.full_name))+'</span><div class="po-list-body"><div class="po-list-title">'+esc(x.e.full_name)+'</div><div class="po-list-meta">'+(x.pct===0?'Unallocated':x.pct+'% allocated')+'</div><div class="po-progress"><span style="width:'+Math.min(100,x.pct)+'%"></span></div></div></div>').join(''):'<div class="po-empty">No capacity alerts.</div>';
}

function renderKudos(){
  $('#kudoCount').textContent=String(KUDOS.length);
  $('#kudoList').innerHTML=KUDOS.length?KUDOS.slice(0,12).map(k=>'<div class="po-list-row"><span class="po-avatar">'+esc(initials(empName(k.from_employee_id)))+'</span><div class="po-list-body"><div class="po-list-title">'+esc(empName(k.from_employee_id))+' → '+esc(empName(k.to_employee_id))+'</div><div class="po-list-meta">'+esc(k.message)+(k.value_tags?.length?' · '+k.value_tags.map(esc).join(', '):'')+'</div></div></div>').join(''):'<div class="po-empty">No kudos yet.</div>';
}

async function createCycle(){
  const code=(prompt('Cycle code e.g. 2026-Q4')||'').trim().toUpperCase();if(!code)return;
  const name=prompt('Cycle name','Q4 2026 Performance Review');if(!name)return;
  const start=prompt('Start date (YYYY-MM-DD)',today());if(!start)return;
  const end=prompt('End date (YYYY-MM-DD)',start);if(!end)return;
  const status=(prompt('Status: planning / active / review / closed','active')||'active').toLowerCase();
  const r=await supabase.from('performance_cycles').insert({business_unit_id:activeUnit(),code,name,start_date:start,end_date:end,status});
  if(r.error)return fail(r.error);toast('Performance cycle created');await load();
}

async function allocate(){
  const emp=choose('Choose employee',EMP,e=>e.full_name+' · '+(e.designation||''));if(!emp)return;
  const project=(projectHint&&PROJECTS.find(p=>p.id===projectHint))||choose('Choose project',PROJECTS,p=>(p.project_no||p.code)+' · '+p.name);if(!project)return;
  const pct=Number(prompt('Allocation %','100'));if(!Number.isFinite(pct)||pct<=0||pct>100)return;
  const role=prompt('Role on project',emp.designation||'Team member')||null;
  const start=prompt('Start date',today())||today();
  const end=prompt('End date (optional)','')||null;
  const r=await supabase.from('project_allocations').insert({employee_id:emp.id,project_id:project.id,role_on_project:role,allocation_pct:pct,start_date:start,end_date:end,status:'active'});
  if(r.error)return fail(r.error);toast('Allocation saved');await load();
}

async function addGoal(){
  const cycles=CYCLES.filter(c=>['planning','active'].includes(c.status));if(!cycles.length)return toast('Create an active performance cycle first','err');
  const cycle=choose('Choose cycle',cycles,c=>c.name);if(!cycle)return;
  const emp=choose('Choose employee',EMP,e=>e.full_name);if(!emp)return;
  const project=confirm('Link this KPI to a project?')?choose('Choose project',PROJECTS,p=>p.name):null;
  const title=prompt('Goal / KPI title');if(!title)return;
  const metric=prompt('Metric / measure')||null;
  const target=prompt('Target value')||null;
  const weight=Number(prompt('Weight %','25'));if(!Number.isFinite(weight)||weight<0||weight>100)return;
  const due=prompt('Due date (optional)',cycle.end_date)||cycle.end_date;
  const r=await supabase.from('performance_goals').insert({cycle_id:cycle.id,employee_id:emp.id,project_id:project?.id||null,title,metric,target_value:target,weight_pct:weight,progress_pct:0,status:'open',due_date:due});
  if(r.error)return fail(r.error);toast('KPI goal added');await load();
}

async function updateGoal(id){
  const g=byId(GOALS,id);if(!g)return;
  const pct=Number(prompt('Progress %',String(g.progress_pct)));if(!Number.isFinite(pct)||pct<0||pct>100)return;
  const status=(prompt('Status: open / on_track / at_risk / completed',pct>=100?'completed':g.status)||g.status).toLowerCase();
  const note=prompt('Manager note (optional)',g.manager_note||'')||null;
  const r=await supabase.from('performance_goals').update({progress_pct:pct,status,manager_note:note,updated_at:new Date().toISOString()}).eq('id',id);
  if(r.error)return fail(r.error);toast('Goal updated');await load();
}

async function addReview(){
  const cycles=CYCLES.filter(c=>['active','review'].includes(c.status));if(!cycles.length)return toast('No active/review cycle','err');
  const cycle=choose('Choose cycle',cycles,c=>c.name);if(!cycle)return;
  const emp=choose('Choose employee',EMP,e=>e.full_name);if(!emp)return;
  const type=user.role==='founder'?'founder':'manager';
  const due=prompt('Review due date',cycle.end_date)||cycle.end_date;
  const r=await supabase.from('performance_reviews').insert({cycle_id:cycle.id,employee_id:emp.id,reviewer_employee_id:SELF_EMP?.id||null,review_type:type,due_date:due,status:'draft'});
  if(r.error)return fail(r.error);toast('Review created');await load();
}

async function completeReview(id){
  const rating=Number(prompt('Rating 1–5'));if(!Number.isFinite(rating)||rating<1||rating>5)return toast('Rating must be 1–5','err');
  const strengths=prompt('Strengths')||null;
  const development=prompt('Development priorities')||null;
  const summary=prompt('Review summary')||null;
  const r=await supabase.from('performance_reviews').update({rating,strengths,development,summary,status:'final',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);
  if(r.error)return fail(r.error);toast('Performance review finalised');await load();
}

async function giveKudos(){
  if(!SELF_EMP)return toast('Link your ERP account to an employee record first','err');
  const peers=EMP.filter(e=>e.id!==SELF_EMP.id);const to=choose('Recognise a colleague',peers,e=>e.full_name);if(!to)return;
  const message=prompt('What did they do well?');if(!message)return;
  const tagsRaw=prompt('Values / tags (comma separated)','Ownership, Quality')||'';
  const tags=tagsRaw.split(',').map(x=>x.trim()).filter(Boolean).slice(0,6);
  const r=await supabase.from('kudos').insert({from_employee_id:SELF_EMP.id,to_employee_id:to.id,message:message.trim(),value_tags:tags});
  if(r.error)return fail(r.error);toast('Kudos shared');await load();
}

$('#hrBtn').addEventListener('click',()=>location.href='/hr.html');
$('#cycleBtn').addEventListener('click',()=>canCycle&&createCycle());
$('#allocBtn').addEventListener('click',()=>canPeople&&allocate());
$('#goalBtn').addEventListener('click',()=>canPeople&&addGoal());
$('#reviewBtn').addEventListener('click',()=>canPeople&&addReview());
$('#kudoBtn').addEventListener('click',giveKudos);
document.addEventListener('click',e=>{
  const g=e.target.closest('[data-goal]');if(g)return updateGoal(g.dataset.goal);
  const r=e.target.closest('[data-review]');if(r)return completeReview(r.dataset.review);
});

await load();
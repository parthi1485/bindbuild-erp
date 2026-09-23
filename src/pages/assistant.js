import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit, activeUnit } from '../lib/shell.js';
import { toast, fail, esc } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'assistant',title:'Bind AI'});
if(!user)throw new Error('redirecting');

const money=v=>{const n=Number(v)||0;if(Math.abs(n)>=1e7)return '₹'+(n/1e7).toFixed(2).replace(/\.00$/,'')+' Cr';if(Math.abs(n)>=1e5)return '₹'+(n/1e5).toFixed(1).replace(/\.0$/,'')+' L';return '₹'+Math.round(n).toLocaleString('en-IN');};
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const recentKey='bindbuild.ai.recent.'+user.id;
let RECENT=JSON.parse(localStorage.getItem(recentKey)||'[]');

const markdown=text=>esc(text)
  .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
  .replace(/^### (.+)$/gm,'<strong>$1</strong>')
  .replace(/^[-•] (.+)$/gm,'• $1')
  .replace(/\n/g,'<br>');

function remember(q){
  RECENT=[q,...RECENT.filter(x=>x!==q)].slice(0,8);
  localStorage.setItem(recentKey,JSON.stringify(RECENT));renderRecent();
}

function renderRecent(){
  $('#recentChats').innerHTML=RECENT.length?RECENT.map(q=>'<button class="thread-item" data-ask="'+esc(q)+'">'+esc(q)+'</button>').join(''):'<div style="font-size:11px;color:var(--text-3);padding:8px 10px">No recent questions on this device.</div>';
}

function bubble(role,text){
  const host=$('#threadIn');if(!host)return;
  $('#welcome')?.setAttribute('hidden','');
  const wrap=document.createElement('div');wrap.className='msg '+(role==='user'?'me':'');
  wrap.innerHTML='<div class="msg__av '+(role==='user'?'me':'ai')+'">'+(role==='user'?esc((user.name||'U').slice(0,2).toUpperCase()):'AI')+'</div><div class="msg__body"><div class="msg__who">'+(role==='user'?esc(user.name||'You'):'Bind AI')+'</div><div class="bubble">'+markdown(text)+'</div>'+(role==='assistant'?'<button class="new-btn" data-copy-answer style="margin-top:9px">Copy</button>':'')+'</div>';
  wrap.dataset.raw=text;host.appendChild(wrap);$('#thread').scrollTop=$('#thread').scrollHeight;
}

function typing(on){
  $('#typing')?.remove();if(!on)return;
  const el=document.createElement('div');el.id='typing';el.className='msg';el.innerHTML='<div class="msg__av ai">AI</div><div class="msg__body"><div class="msg__who">Bind AI</div><div class="typing"><span></span><span></span><span></span></div></div>';$('#threadIn').appendChild(el);$('#thread').scrollTop=$('#thread').scrollHeight;
}

async function management(days=90){
  const to=today(),d=new Date(to+'T12:00:00');d.setDate(d.getDate()-days+1);
  const from=d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
  const {data,error}=await supabase.rpc('management_dashboard',{p_business_unit_id:activeUnit(),p_from:from,p_to:to});
  if(error)throw error;return data;
}

async function allProjects(){
  const r=await scopeToUnit(supabase.from('projects').select('id,project_no,code,name,client_id,service_type,location,contract_value,status,health,progress_pct,start_date,target_end_date').is('deleted_at',null)).order('created_at',{ascending:false});
  if(r.error)throw r.error;return r.data||[];
}

function matchProject(query,rows){
  const q=query.toLowerCase(),tokens=q.split(/[^a-z0-9]+/).filter(x=>x.length>2);
  return [...rows].map(p=>{
    const hay=[p.project_no,p.code,p.name,p.location,p.service_type].filter(Boolean).join(' ').toLowerCase();
    let score=hay&&q.includes(hay)?20:0;
    tokens.forEach(t=>{if(hay.includes(t))score+=1;});
    return {p,score};
  }).sort((a,b)=>b.score-a.score)[0];
}

async function dailyBrief(){
  const d=await management(30),k=d.kpis||{};
  const [tasks,meets,issues]=await Promise.all([
    supabase.from('tasks').select('title,priority,due_at,status').not('status','in','("done","cancelled")').order('due_at',{ascending:true}).limit(20),
    scopeToUnit(supabase.from('meetings').select('title,scheduled_at,status').in('status',['scheduled','in_progress'])).gte('scheduled_at',new Date().toISOString()).order('scheduled_at').limit(8),
    supabase.from('site_issues').select('title,severity,status,due_date,project_id').not('status','in','("resolved","closed","cancelled")').order('created_at',{ascending:false}).limit(10)
  ]);
  const overdue=(tasks.data||[]).filter(t=>t.due_at&&new Date(t.due_at)<new Date());
  const critical=(issues.data||[]).filter(x=>['high','critical','urgent'].includes(String(x.severity).toLowerCase()));
  const lines=[
    '**Founder brief — '+new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short'})+'**',
    '- Open pipeline: '+money(k.open_pipeline)+' · '+(k.new_leads||0)+' new leads',
    '- Collections (30d): '+money(k.collections)+' · Receivables: '+money(k.receivables),
    '- Vendor payables: '+money(k.vendor_payables),
    '- Active projects: '+(k.active_projects||0)+' · At risk: '+(k.at_risk_projects||0),
    '- Overdue tasks: '+overdue.length+' · Pending approvals: '+(k.pending_approvals||0),
    '- High/critical site issues: '+critical.length
  ];
  const next=(meets.data||[])[0];if(next)lines.push('- Next meeting: '+next.title+' · '+new Date(next.scheduled_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}));
  return lines.join('\n');
}

async function pipeline(){
  const d=await management(90),k=d.kpis||{},rows=d.pipeline||[],src=d.sources||[];
  let out='**Sales pipeline**\n- Open value: '+money(k.open_pipeline)+'\n- New leads (90d): '+(k.new_leads||0)+'\n- Won: '+(k.won_leads||0)+' · Lost: '+(k.lost_leads||0)+'\n- Closed-lead win rate: '+Number(k.win_rate||0).toFixed(1).replace('.0','')+'%';
  if(rows.length)out+='\n\n**By stage**\n'+rows.slice(0,8).map(x=>'- '+x.stage+': '+x.count+' · '+money(x.value)).join('\n');
  if(src.length)out+='\n\n**Top sources**\n'+src.slice(0,5).map(x=>'- '+x.source+': '+x.count+' leads').join('\n');
  return out;
}

async function collections(){
  const d=await management(180),k=d.kpis||{},risk=d.risks||{};
  let out='**Collections & dues**\n- Collections (180d): '+money(k.collections)+'\n- Invoiced (180d): '+money(k.invoiced)+'\n- Client receivables: '+money(k.receivables)+'\n- Vendor payables: '+money(k.vendor_payables);
  const inv=risk.overdue_invoices||[];if(inv.length)out+='\n\n**Overdue invoices**\n'+inv.slice(0,6).map(x=>'- '+(x.invoice_no||'Invoice')+': '+money(x.balance)+' · due '+x.due_date).join('\n');
  return out;
}

async function projectAnswer(q){
  const rows=await allProjects(),m=matchProject(q,rows);
  if(!m||m.score===0){
    const active=rows.filter(p=>!['completed','cancelled'].includes(p.status));
    return active.length?'Tell me which project. Active projects:\n'+active.slice(0,10).map(p=>'- '+(p.project_no||p.code||'')+' · '+p.name).join('\n'):'No active projects found.';
  }
  const p=m.p;
  const [tasks,issues,inv,rec,docs,meet]=await Promise.all([
    supabase.from('tasks').select('title,status,priority,due_at').eq('project_id',p.id).not('status','in','("done","cancelled")').order('due_at').limit(12),
    supabase.from('site_issues').select('title,severity,status,due_date').eq('project_id',p.id).not('status','in','("resolved","closed","cancelled")').limit(12),
    supabase.from('invoices').select('invoice_no,total,amount_paid,credited_amount,status,due_date').eq('project_id',p.id).is('deleted_at',null),
    supabase.from('receipts').select('amount,status').eq('project_id',p.id).eq('status','issued'),
    supabase.from('project_documents').select('status').eq('project_id',p.id),
    supabase.from('meetings').select('title,scheduled_at,status').eq('project_id',p.id).in('status',['scheduled','in_progress']).order('scheduled_at').limit(3)
  ]);
  const billed=(inv.data||[]).reduce((a,x)=>a+Math.max(0,Number(x.total||0)-Number(x.credited_amount||0)),0);
  const collected=(rec.data||[]).reduce((a,x)=>a+Number(x.amount||0),0);
  const receivable=(inv.data||[]).reduce((a,x)=>a+Math.max(0,Number(x.total||0)-Number(x.credited_amount||0)-Number(x.amount_paid||0)),0);
  let out='**'+(p.project_no||p.code||'Project')+' · '+p.name+'**\n- Status: '+p.status+' · Health: '+p.health+'\n- Progress: '+Number(p.progress_pct||0)+'%\n- Contract: '+money(p.contract_value)+'\n- Billed: '+money(billed)+' · Collected: '+money(collected)+' · Receivable: '+money(receivable)+'\n- Open tasks: '+(tasks.data||[]).length+' · Open site issues: '+(issues.data||[]).length+'\n- Approved docs: '+(docs.data||[]).filter(x=>x.status==='approved').length;
  const next=(meet.data||[])[0];if(next)out+='\n- Next meeting: '+next.title+' · '+new Date(next.scheduled_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
  const urgent=(issues.data||[]).filter(x=>['high','critical','urgent'].includes(String(x.severity).toLowerCase()));
  if(urgent.length)out+='\n\n**Site attention**\n'+urgent.slice(0,5).map(x=>'- '+x.title+' · '+x.severity).join('\n');
  return out;
}

async function team(){
  const t=today();
  const [emp,att,leave,alloc]=await Promise.all([
    scopeToUnit(supabase.from('employees').select('id,full_name,designation,department,status').in('status',['active','on_leave'])).order('full_name'),
    supabase.from('attendance').select('employee_id,status,check_in,project_id').eq('on_date',t),
    supabase.from('leave_requests').select('employee_id,days,status').eq('status','approved').lte('from_date',t).gte('to_date',t),
    supabase.from('project_allocations').select('employee_id,allocation_pct,status,start_date,end_date').eq('status','active').lte('start_date',t)
  ]);
  const rows=emp.data||[],ids=new Set(rows.map(x=>x.id)),a=(att.data||[]).filter(x=>ids.has(x.employee_id)),l=(leave.data||[]).filter(x=>ids.has(x.employee_id));
  const present=a.filter(x=>['present','wfh','half_day'].includes(x.status));
  const allocated=(alloc.data||[]).filter(x=>ids.has(x.employee_id)&&(!x.end_date||x.end_date>=t));
  return '**People today**\n- Active people: '+rows.length+'\n- Present / WFH / half-day: '+present.length+'\n- Approved leave: '+l.length+'\n- Attendance not marked: '+Math.max(0,rows.length-a.length)+'\n- Active project allocations: '+allocated.length;
}

async function stock(){
  const r=await scopeToUnit(supabase.from('stock_balances').select('*')).order('name');
  if(r.error)throw r.error;const low=(r.data||[]).filter(x=>Number(x.reorder_level||0)>0&&Number(x.qty||0)<=Number(x.reorder_level||0));
  if(!low.length)return (r.data||[]).length?'All tracked stock is above reorder level.':'No stock balances are available yet.';
  return '**Low / reorder stock**\n'+low.slice(0,12).map(x=>'- '+(x.name||x.code)+' · '+x.store_name+': '+Number(x.qty||0)+' '+(x.unit||'')+' (reorder '+Number(x.reorder_level||0)+')').join('\n');
}

async function siteRisks(){
  const [issues,qc]=await Promise.all([
    supabase.from('site_issues').select('title,severity,status,due_date,project_id').not('status','in','("resolved","closed","cancelled")').order('due_date',{ascending:true}).limit(20),
    supabase.from('quality_checks').select('check_item,result,status,project_id').neq('status','closed').limit(20)
  ]);
  const bad=(issues.data||[]).filter(x=>['high','critical','urgent'].includes(String(x.severity).toLowerCase()));
  const fail=(qc.data||[]).filter(x=>['fail','failed','rejected'].includes(String(x.result).toLowerCase()));
  return '**Site / quality risk**\n- Open site issues: '+(issues.data||[]).length+'\n- High/critical issues: '+bad.length+'\n- Failed/rejected quality checks: '+fail.length+(bad.length?'\n\n'+bad.slice(0,6).map(x=>'- '+x.title+' · '+x.severity+(x.due_date?' · due '+x.due_date:'')).join('\n'):'');
}

async function followup(q){
  const r=await scopeToUnit(supabase.from('leads').select('id,lead_no,name,phone,email,area,city,service,stage,expected_value,updated_at').is('deleted_at',null)).order('updated_at',{ascending:false}).limit(100);
  if(r.error)throw r.error;const leads=r.data||[];
  const lower=q.toLowerCase(),tokens=lower.split(/[^a-z0-9]+/).filter(x=>x.length>2);
  const ranked=leads.map(l=>{const h=[l.lead_no,l.name,l.area,l.city,l.service].filter(Boolean).join(' ').toLowerCase();return {l,score:tokens.reduce((n,t)=>n+(h.includes(t)?1:0),0)};}).sort((a,b)=>b.score-a.score);
  const lead=ranked[0]?.score?ranked[0].l:null;
  if(!lead)return leads.length?'Mention the client/lead name. Recent leads:\n'+leads.slice(0,8).map(l=>'- '+(l.lead_no||'')+' · '+l.name+' · '+l.stage).join('\n'):'No leads found.';
  const place=[lead.area,lead.city].filter(Boolean).join(', ');
  const context=lead.service?lead.service+(place?' at '+place:''):place||'your project';
  let line;
  if(['proposal','follow_up'].includes(lead.stage))line='following up on the proposal we shared for '+context+'. Let me know your feedback, and I can clarify the scope, budget or next steps.';
  else if(['meeting','contacted'].includes(lead.stage))line='following up after our discussion about '+context+'. If the requirements look aligned, we can move to the next planning step.';
  else line='following up regarding your enquiry for '+context+'. Let me know a convenient time to discuss the requirements and next steps.';
  const wa='Hi '+lead.name+', '+line+'\n\n— Parthiban\nBind Builds';
  const email='Hi '+lead.name+',\n\n'+line.charAt(0).toUpperCase()+line.slice(1)+'\n\nRegards,\nParthiban\nBind Builds';
  return '**'+(lead.lead_no||'Lead')+' · '+lead.name+' · '+lead.stage.replaceAll('_',' ')+'**\n\n**WhatsApp**\n'+wa+'\n\n**Email**\n'+email;
}

const SKILLS=[
  {label:'Give me today’s founder brief',match:/brief|today|priority|attention|what.*next|dashboard/i,run:dailyBrief},
  {label:'Show my sales pipeline',match:/pipeline|leads?|funnel|sales/i,run:pipeline},
  {label:'How much is pending from clients?',match:/receiv|collect|pending.*client|outstanding|invoice|money|cash/i,run:collections},
  {label:'Summarise a project',match:/project|progress|status of|construction status/i,run:projectAnswer},
  {label:'Who is in today?',match:/team|attendance|who.*today|employee|people|leave/i,run:team},
  {label:'What stock is running low?',match:/stock|inventory|material|reorder|running low/i,run:stock},
  {label:'Show site and quality risks',match:/site|quality|snag|issue|risk/i,run:siteRisks},
  {label:'Draft a client follow-up',match:/follow.?up|whatsapp|draft.*client|email.*client/i,run:followup}
];

async function ask(text){
  const q=String(text||'').trim();if(!q)return;
  bubble('user',q);remember(q);typing(true);
  try{
    const skill=SKILLS.find(s=>s.match.test(q));
    const answer=skill?await skill.run(q):'I can answer live ERP questions in these areas:\n\n'+SKILLS.map(s=>'- '+s.label).join('\n')+'\n\nFor project-specific questions, include the project name, number or location.';
    typing(false);bubble('assistant',answer);
  }catch(e){typing(false);bubble('assistant','I could not complete that live query. '+(e?.message||String(e)));fail(e);}
}

$('#chips').innerHTML=SKILLS.slice(0,6).map(s=>'<button class="chip" data-ask="'+esc(s.label)+'"><div class="chip__t">'+esc(s.label)+'</div><div class="chip__m">Live ERP query</div></button>').join('');
renderRecent();

const input=$('#input'),sendBtn=$('#send');
input.addEventListener('input',()=>{sendBtn.disabled=!input.value.trim();input.style.height='auto';input.style.height=Math.min(input.scrollHeight,150)+'px';});
function send(){const q=input.value.trim();if(!q)return;input.value='';input.style.height='auto';sendBtn.disabled=true;ask(q);}
sendBtn.addEventListener('click',send);
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
$('#newChat').addEventListener('click',()=>{$('#threadIn').innerHTML='';$('#threadIn').appendChild($('#welcome'));$('#welcome').removeAttribute('hidden');renderRecent();});
document.addEventListener('click',async e=>{
  const a=e.target.closest('[data-ask]');if(a)return ask(a.dataset.ask);
  const c=e.target.closest('[data-copy-answer]');if(c){const raw=c.closest('.msg')?.dataset.raw||'';try{await navigator.clipboard.writeText(raw);toast('Copied');}catch{toast('Copy failed','err');}}
});

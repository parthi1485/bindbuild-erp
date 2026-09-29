import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit, activeUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'meetings',title:'Meetings'});
if(!user)throw new Error('redirecting');

const canWrite=['founder','admin','sales','project_manager','designer','site_engineer','finance','procurement','hr'].includes(user.role);
const canManage=['founder','admin','project_manager'].includes(user.role);
const projectHint=new URLSearchParams(location.search).get('project');
let MTG=[],ATT=[],NOTES=[],ACTIONS=[],PROJECTS=[],PROFILES=[],selected=null;
let q='',projectFilter=projectHint||'',statusFilter='';

const byId=(rows,id)=>rows.find(x=>x.id===id);
const meetingNotes=id=>NOTES.filter(n=>n.meeting_id===id).sort((a,b)=>a.sort_order-b.sort_order||new Date(a.created_at)-new Date(b.created_at));
const meetingActions=id=>ACTIONS.filter(a=>a.meeting_id===id);
const status=s=>'<span class="ws-status '+esc(s||'scheduled')+'">'+esc(String(s||'scheduled').replaceAll('_',' '))+'</span>';
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});

function choose(title,rows,label){
  if(!rows.length){toast('No options available','err');return null;}
  const raw=prompt(title+'\n\n'+rows.map((x,i)=>(i+1)+'. '+label(x)).join('\n')+'\n\nEnter number');
  if(raw===null)return null;const n=Number(raw);
  return Number.isInteger(n)&&n>0&&n<=rows.length?rows[n-1]:null;
}

async function load(){
  try{
    const a=await Promise.all([
      scopeToUnit(supabase.from('meetings').select('*')).order('scheduled_at',{ascending:false}).limit(100),
      supabase.from('meeting_attendees').select('*'),
      supabase.from('meeting_notes').select('*').order('created_at',{ascending:true}),
      supabase.from('meeting_action_items').select('*').order('due_date',{ascending:true}),
      scopeToUnit(supabase.from('projects').select('id,project_no,code,name').is('deleted_at',null)).order('name'),
      supabase.from('profiles').select('id,full_name,role,is_active').eq('is_active',true).order('full_name')
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    [MTG,ATT,NOTES,ACTIONS,PROJECTS,PROFILES]=a.map(r=>r.data||[]);
    const meetingIds=new Set(MTG.map(m=>m.id));
    ATT=ATT.filter(x=>meetingIds.has(x.meeting_id));
    NOTES=NOTES.filter(x=>meetingIds.has(x.meeting_id));
    ACTIONS=ACTIONS.filter(x=>meetingIds.has(x.meeting_id));
    if(!selected&&MTG.length)selected=MTG[0].id;
    render();
  }catch(e){fail(e);}
}

function render(){
  const now=new Date(),month=today().slice(0,7);
  const rows=MTG.filter(m=>{
    if(projectFilter&&m.project_id!==projectFilter)return false;
    if(statusFilter&&m.status!==statusFilter)return false;
    if(q&&!String(m.meeting_no+' '+m.title+' '+(m.meeting_type||'')).toLowerCase().includes(q))return false;
    return true;
  });
  const open=ACTIONS.filter(a=>!['done','cancelled'].includes(a.status));
  $('#kUpcoming').textContent=String(MTG.filter(m=>m.status==='scheduled'&&new Date(m.scheduled_at)>=now).length);
  $('#kMonth').textContent=String(MTG.filter(m=>String(m.scheduled_at).slice(0,7)===month).length);
  $('#kActions').textContent=String(open.length);
  $('#kOverdue').textContent=String(open.filter(a=>a.due_date&&a.due_date<today()).length);
  $('#kDecisions').textContent=String(NOTES.filter(n=>n.kind==='decision').length);
  $('#meetingCount').textContent=rows.length+' meetings';
  $('#scheduleBtn').disabled=!canWrite;

  $('#projectFilter').innerHTML='<option value="">All projects</option>'+PROJECTS.map(p=>'<option value="'+p.id+'"'+(p.id===projectFilter?' selected':'')+'>'+esc((p.project_no||p.code)+' · '+p.name)+'</option>').join('');
  $('#meetingStatus').value=statusFilter;

  $('#meetingBody').innerHTML=rows.length?rows.map(m=>{
    const p=byId(PROJECTS,m.project_id),d=new Date(m.scheduled_at);
    return '<tr><td><div class="ws-doc">'+esc(m.meeting_no||'MOM')+'</div></td><td><div class="ws-doc">'+esc(m.title)+'</div><div class="ws-meta">'+esc(m.location||m.meeting_link||'—')+'</div></td><td>'+esc(p?.name||'General')+'</td><td>'+fmtDate(m.scheduled_at)+'<div class="ws-meta">'+d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})+' · '+m.duration_minutes+' min</div></td><td>'+esc(m.meeting_type)+'</td><td>'+status(m.status)+'</td><td><button class="ws-btn'+(selected===m.id?' primary':'')+'" data-select="'+m.id+'">Open</button></td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="ws-empty">No meetings match this view.</div></td></tr>';

  renderDetail();renderActions();renderDecisions();renderProjects();
}

function renderDetail(){
  const m=byId(MTG,selected),el=$('#detail');
  if(!m){el.innerHTML='<div class="ws-empty">Select a meeting.</div>';$('#detailTag').textContent='Select meeting';return;}
  $('#detailTag').textContent=m.meeting_no||'MOM';
  const notes=meetingNotes(m.id),att=ATT.filter(a=>a.meeting_id===m.id),acts=meetingActions(m.id);
  const p=byId(PROJECTS,m.project_id);
  const editable=canWrite&&m.status!=='completed'&&m.status!=='cancelled';

  const noteSection=(kind,title)=> {
    const rows=notes.filter(n=>n.kind===kind);
    return '<section class="ws-section"><h3>'+title+'</h3>'+(rows.length?rows.map(n=>'<div class="ws-note">'+esc(n.body)+'</div>').join(''):'<div class="ws-meta">No '+title.toLowerCase()+' recorded.</div>')+(editable?'<button class="ws-btn" style="margin-top:8px" data-note-kind="'+kind+'">+ '+title.slice(0,-1)+'</button>':'')+'</section>';
  };

  el.innerHTML='<h2>'+esc(m.title)+'</h2><div class="ws-detail-meta">'+esc(m.meeting_no)+' · '+fmtDate(m.scheduled_at)+' · '+esc(m.meeting_type)+' · '+esc(p?.name||'General')+(m.location?' · '+esc(m.location):'')+'</div>'+
    (m.agenda?'<section class="ws-section"><h3>Agenda overview</h3><div class="ws-note">'+esc(m.agenda)+'</div></section>':'')+
    '<div class="ws-attendees">'+(att.length?att.map(a=>'<span class="ws-person">'+esc(a.profile_id?byId(PROFILES,a.profile_id)?.full_name||'Internal':a.external_name||'Guest')+' · '+esc(a.attendance_status)+'</span>').join(''):'<span class="ws-meta">No attendees recorded</span>')+'</div>'+
    noteSection('agenda','Agenda items')+noteSection('minute','Minutes')+noteSection('decision','Decisions')+
    '<section class="ws-section"><h3>Action items</h3>'+(acts.length?acts.map(a=>'<div class="ws-list-row"><div class="ws-list-body"><div class="ws-list-title">'+esc(a.title)+'</div><div class="ws-list-meta">'+esc(byId(PROFILES,a.owner_profile_id)?.full_name||'Unassigned')+(a.due_date?' · due '+fmtDate(a.due_date):'')+'</div></div>'+status(a.status)+'</div>').join(''):'<div class="ws-meta">No action items.</div>')+(editable?'<button class="ws-btn" style="margin-top:8px" id="addActionBtn">+ Action item</button>':'')+'</section>'+
    '<div class="ws-inline" style="justify-content:flex-start;margin-top:16px">'+
      (editable?'<button class="ws-btn" id="addAttendeeBtn">+ Attendee</button>':'')+
      (editable?'<button class="ws-btn primary" id="finalizeBtn">Finalize MOM</button>':'')+
      (m.status==='completed'?'<span class="ws-status completed">Minutes locked</span>':'')+
    '</div>';
}

function renderActions(){
  const rows=ACTIONS.filter(a=>!['done','cancelled'].includes(a.status));
  $('#actionCount').textContent=String(rows.length);
  $('#actionList').innerHTML=rows.length?rows.slice(0,15).map(a=>{
    const m=byId(MTG,a.meeting_id);
    const own=a.owner_profile_id===user.id||canManage;
    return '<div class="ws-list-row"><div class="ws-list-body"><div class="ws-list-title">'+esc(a.title)+'</div><div class="ws-list-meta">'+esc(m?.meeting_no||'MOM')+' · '+esc(byId(PROFILES,a.owner_profile_id)?.full_name||'Unassigned')+(a.due_date?' · '+(a.due_date<today()?'OVERDUE · ':'')+fmtDate(a.due_date):'')+'</div></div>'+(own?'<button class="ws-btn primary" data-done="'+a.id+'">Done</button>':'')+'</div>';
  }).join(''):'<div class="ws-empty">No open actions.</div>';
}

function renderDecisions(){
  const rows=NOTES.filter(n=>n.kind==='decision').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  $('#decisionCount').textContent=String(rows.length);
  $('#decisionList').innerHTML=rows.length?rows.slice(0,12).map(n=>'<div class="ws-list-row"><div class="ws-list-body"><div class="ws-list-title">'+esc(n.body)+'</div><div class="ws-list-meta">'+esc(byId(MTG,n.meeting_id)?.meeting_no||'MOM')+' · '+fmtDate(n.created_at)+'</div></div></div>').join(''):'<div class="ws-empty">No decisions recorded.</div>';
}

function renderProjects(){
  const map=new Map();MTG.forEach(m=>map.set(m.project_id,(map.get(m.project_id)||0)+1));
  const rows=[...map.entries()].sort((a,b)=>b[1]-a[1]);
  $('#projectList').innerHTML=rows.length?rows.map(([id,n])=>'<div class="ws-list-row"><div class="ws-list-body"><div class="ws-list-title">'+esc(byId(PROJECTS,id)?.name||'General / internal')+'</div><div class="ws-list-meta">'+n+' meeting record'+(n===1?'':'s')+'</div></div></div>').join(''):'<div class="ws-empty">No meetings yet.</div>';
}

async function schedule(){
  const project=projectHint?byId(PROJECTS,projectHint):(confirm('Link meeting to a project?')?choose('Choose project',PROJECTS,p=>(p.project_no||p.code)+' · '+p.name):null);
  const title=prompt('Meeting title');if(!title)return;
  const type=(prompt('Type: client / project / design / site / vendor / internal / review / other',project?'project':'internal')||'project').toLowerCase();
  if(!['client','project','design','site','vendor','internal','review','other'].includes(type))return toast('Invalid meeting type','err');
  const local=prompt('Date & time (YYYY-MM-DD HH:MM)',today()+' 10:00');if(!local)return;
  const dt=new Date(local.replace(' ','T')+':00+05:30');if(Number.isNaN(dt.getTime()))return toast('Invalid date/time','err');
  const duration=Number(prompt('Duration minutes','60')||60);
  const location=prompt('Location / room (optional)')||null;
  const link=prompt('Meeting link (optional)')||null;
  const agenda=prompt('Agenda summary (optional)')||null;
  const r=await supabase.from('meetings').insert({business_unit_id:activeUnit(),project_id:project?.id||null,title:title.trim(),meeting_type:type,scheduled_at:dt.toISOString(),duration_minutes:duration,location,meeting_link:link,agenda,status:'scheduled'}).select('*').single();
  if(r.error)return fail(r.error);
  selected=r.data.id;
  if(confirm('Add internal attendees now?'))await addAttendee(true);
  toast((r.data.meeting_no||'Meeting')+' scheduled');await load();
}

async function addAttendee(noReload=false){
  const m=byId(MTG,selected)||await supabase.from('meetings').select('*').eq('id',selected).single().then(r=>r.data);if(!m)return;
  const internal=confirm('Internal ERP user?');
  let payload={meeting_id:m.id};
  if(internal){
    const used=new Set(ATT.filter(a=>a.meeting_id===m.id&&a.profile_id).map(a=>a.profile_id));
    const choices=PROFILES.filter(p=>!used.has(p.id));
    const p=choose('Choose attendee',choices,x=>(x.full_name||'User')+' · '+x.role);if(!p)return;
    payload={...payload,profile_id:p.id,attendee_type:'internal',attendance_status:'invited'};
  }else{
    const name=prompt('External attendee name');if(!name)return;
    const email=prompt('Email (optional)')||null;
    const type=(prompt('Type: client / vendor / consultant / other','client')||'client').toLowerCase();
    payload={...payload,external_name:name,external_email:email,attendee_type:['client','vendor','consultant','other'].includes(type)?type:'other',attendance_status:'invited'};
  }
  const r=await supabase.from('meeting_attendees').insert(payload);if(r.error)return fail(r.error);
  if(!noReload){toast('Attendee added');await load();}
}

async function addNote(kind){
  const body=prompt(kind==='decision'?'Decision':'Meeting '+kind);if(!body)return;
  const count=meetingNotes(selected).filter(n=>n.kind===kind).length;
  const r=await supabase.from('meeting_notes').insert({meeting_id:selected,kind,body:body.trim(),sort_order:count,created_by:user.id});
  if(r.error)return fail(r.error);toast(kind==='decision'?'Decision recorded':'Note saved');await load();
}

async function addAction(){
  const title=prompt('Action item');if(!title)return;
  const owner=confirm('Assign to an internal user?')?choose('Choose owner',PROFILES,p=>(p.full_name||'User')+' · '+p.role):null;
  const due=prompt('Due date (YYYY-MM-DD)',new Date(Date.now()+7*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}))||null;
  const priority=(prompt('Priority: low / medium / high / urgent','medium')||'medium').toLowerCase();
  if(!['low','medium','high','urgent'].includes(priority))return toast('Invalid priority','err');
  const desc=prompt('Details (optional)')||null;
  const r=await supabase.rpc('add_meeting_action',{p_meeting_id:selected,p_title:title.trim(),p_owner_profile_id:owner?.id||null,p_due_date:due,p_priority:priority,p_description:desc});
  if(r.error)return fail(r.error);toast(owner?'Action added to project task queue':'Unassigned action added');await load();
}

async function completeAction(id){
  const r=await supabase.rpc('complete_meeting_action',{p_action_id:id});
  if(r.error)return fail(r.error);toast('Action completed');await load();
}

async function finalize(){
  const summary=prompt('Final MOM summary (optional)')||null;
  if(!confirm('Finalize this MOM? Minutes and decisions will lock; action items remain trackable.'))return;
  const r=await supabase.rpc('finalize_meeting',{p_meeting_id:selected,p_summary:summary});
  if(r.error)return fail(r.error);toast((r.data.meeting_no||'MOM')+' finalised');await load();
}

$('#scheduleBtn').addEventListener('click',()=>canWrite&&schedule());
$('#documentsBtn').addEventListener('click',()=>location.href='/documents.html'+(projectHint?'?project='+projectHint:''));
$('#meetingSearch').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();render();});
$('#projectFilter').addEventListener('change',e=>{projectFilter=e.target.value;render();});
$('#meetingStatus').addEventListener('change',e=>{statusFilter=e.target.value;render();});
document.addEventListener('click',e=>{
  const s=e.target.closest('[data-select]');if(s){selected=s.dataset.select;render();return;}
  const n=e.target.closest('[data-note-kind]');if(n)return addNote(n.dataset.noteKind);
  const d=e.target.closest('[data-done]');if(d)return completeAction(d.dataset.done);
  if(e.target.id==='addActionBtn')return addAction();
  if(e.target.id==='addAttendeeBtn')return addAttendee();
  if(e.target.id==='finalizeBtn')return finalize();
});

await load();
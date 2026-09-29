import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit } from '../lib/shell.js';
import { fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s),$$=(s,c=document)=>[...c.querySelectorAll(s)];
const user=await mountShell({route:'calendar',title:'Calendar'});if(!user)throw new Error('redirecting');

const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const META={
  meeting:{label:'Meeting',css:'meet'},
  task:{label:'Task deadline',css:'dead'},
  site:{label:'Site inspection',css:'site'},
  milestone:{label:'Milestone',css:'learn'},
  leave:{label:'Leave',css:'hr'}
};
let cursor=new Date();cursor.setDate(1);
let ITEMS=[],PROJECTS=[],ACTIVE=new Set(Object.keys(META)),selectedKey=null;

const indiaKey=d=>new Date(d).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const rawDate=s=>String(s||'').slice(0,10);
const projectName=id=>PROJECTS.find(p=>p.id===id)?.name||'';
function addDays(key,n){const d=new Date(key+'T12:00:00+05:30');d.setDate(d.getDate()+n);return d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});}
function monthBounds(){
  const y=cursor.getFullYear(),m=cursor.getMonth();
  const first=new Date(y,m,1),last=new Date(y,m+1,0);
  const from=first.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
  const to=last.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
  return {from,to,fromISO:from+'T00:00:00+05:30',toISO:addDays(to,1)+'T00:00:00+05:30'};
}
function push(item){if(item.date)ITEMS.push(item);}

async function load(){
  try{
    const b=monthBounds();
    const p=await scopeToUnit(supabase.from('projects').select('id,project_no,code,name,target_end_date,status').is('deleted_at',null)).order('name');
    if(p.error)throw p.error;PROJECTS=p.data||[];const pids=PROJECTS.map(x=>x.id);

    const emp=await scopeToUnit(supabase.from('employees').select('id,full_name').in('status',['active','on_leave'])).order('full_name');
    if(emp.error)throw emp.error;const employees=emp.data||[],empIds=employees.map(x=>x.id);

    const [meet,tasks,stages,inspections,leaves,types]=await Promise.all([
      scopeToUnit(supabase.from('meetings').select('*')).gte('scheduled_at',b.fromISO).lt('scheduled_at',b.toISO).neq('status','cancelled').order('scheduled_at'),
      supabase.from('tasks').select('*').gte('due_at',b.fromISO).lt('due_at',b.toISO).not('status','in','("done","cancelled")').order('due_at'),
      pids.length?supabase.from('construction_stages').select('id,project_id,title,planned_end,status,progress_pct').in('project_id',pids).gte('planned_end',b.from).lte('planned_end',b.to).order('planned_end'):Promise.resolve({data:[]}),
      pids.length?supabase.from('site_inspections').select('id,project_id,title,scheduled_on,status,outcome').in('project_id',pids).gte('scheduled_on',b.from).lte('scheduled_on',b.to).order('scheduled_on'):Promise.resolve({data:[]}),
      empIds.length?supabase.from('leave_requests').select('*').in('employee_id',empIds).eq('status','approved').lte('from_date',b.to).gte('to_date',b.from):Promise.resolve({data:[]}),
      scopeToUnit(supabase.from('leave_types').select('id,name')).eq('active',true)
    ]);
    [meet,tasks,stages,inspections,leaves,types].forEach(r=>{if(r.error)throw r.error;});

    const projectSet=new Set(pids),empMap=new Map(employees.map(x=>[x.id,x.full_name])),typeMap=new Map((types.data||[]).map(x=>[x.id,x.name]));
    ITEMS=[];

    (meet.data||[]).forEach(m=>push({
      id:'meeting:'+m.id,kind:'meeting',date:indiaKey(m.scheduled_at),startsAt:m.scheduled_at,
      title:m.title,meta:[projectName(m.project_id),m.location,m.meeting_type].filter(Boolean).join(' · '),
      projectId:m.project_id,href:'/meetings.html'+(m.project_id?'?project='+m.project_id:'')
    }));

    (tasks.data||[]).filter(t=>!t.project_id||projectSet.has(t.project_id)).forEach(t=>push({
      id:'task:'+t.id,kind:'task',date:indiaKey(t.due_at),startsAt:t.due_at,title:t.title,
      meta:[projectName(t.project_id),t.priority].filter(Boolean).join(' · '),projectId:t.project_id,href:'/tasks.html?task='+t.id
    }));

    (stages.data||[]).forEach(s=>push({
      id:'stage:'+s.id,kind:'milestone',date:rawDate(s.planned_end),startsAt:s.planned_end+'T18:00:00+05:30',
      title:s.title,meta:[projectName(s.project_id),Number(s.progress_pct||0)+'%'].filter(Boolean).join(' · '),
      projectId:s.project_id,href:'/progress.html?project='+s.project_id
    }));

    PROJECTS.filter(p=>p.target_end_date&&p.target_end_date>=b.from&&p.target_end_date<=b.to&& !['completed','cancelled'].includes(p.status)).forEach(p=>push({
      id:'project-target:'+p.id,kind:'milestone',date:rawDate(p.target_end_date),startsAt:p.target_end_date+'T18:00:00+05:30',
      title:'Project target · '+p.name,meta:p.project_no||p.code||'',projectId:p.id,href:'/project.html?id='+p.id
    }));

    (inspections.data||[]).forEach(i=>push({
      id:'inspection:'+i.id,kind:'site',date:rawDate(i.scheduled_on),startsAt:i.scheduled_on+'T10:00:00+05:30',
      title:i.title,meta:[projectName(i.project_id),i.status].filter(Boolean).join(' · '),projectId:i.project_id,href:'/progress.html?project='+i.project_id
    }));

    (leaves.data||[]).forEach(l=>{
      let d=l.from_date;const end=l.to_date;
      while(d<=end){
        if(d>=b.from&&d<=b.to)push({
          id:'leave:'+l.id+':'+d,kind:'leave',date:d,startsAt:d+'T09:00:00+05:30',
          title:(empMap.get(l.employee_id)||'Employee')+' · '+(typeMap.get(l.leave_type_id)||'Leave'),
          meta:l.reason||'Approved leave',href:'/employee.html?id='+l.employee_id
        });
        d=addDays(d,1);
      }
    });

    ITEMS.sort((a,b)=>String(a.startsAt).localeCompare(String(b.startsAt)));
    if(!selectedKey||selectedKey<b.from||selectedKey>b.to)selectedKey=indiaKey(new Date());
    render();
  }catch(e){fail(e);}
}

function visibleItems(){return ITEMS.filter(x=>ACTIVE.has(x.kind));}
function render(){
  const b=monthBounds(),monthItems=visibleItems();
  $('#mLabel').textContent=MONTHS[cursor.getMonth()]+' '+cursor.getFullYear();
  $('#kMeetings').textContent=monthItems.filter(x=>x.kind==='meeting').length;
  $('#kTasks').textContent=monthItems.filter(x=>x.kind==='task').length;
  $('#kSite').textContent=monthItems.filter(x=>x.kind==='site').length;
  $('#kMilestones').textContent=monthItems.filter(x=>x.kind==='milestone').length;
  $('#kLeave').textContent=monthItems.filter(x=>x.kind==='leave').length;

  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1),pad=(first.getDay()+6)%7,days=new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate();
  const today=indiaKey(new Date()),cells=[];
  for(let i=0;i<pad;i++)cells.push(null);
  for(let d=1;d<=days;d++)cells.push(new Date(cursor.getFullYear(),cursor.getMonth(),d));

  $('#month').innerHTML=cells.map(d=>{
    if(!d)return'<div class="cell out"></div>';
    const key=d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),items=monthItems.filter(x=>x.date===key);
    const classes=['cell',key===today?'today':'',key===selectedKey?'sel':'',d.getDay()===0?'sun':''].filter(Boolean).join(' ');
    return `<div class="${classes}" data-date="${key}" data-dots="${items.length?'•'.repeat(Math.min(3,items.length)):''}">
      <span class="cell__d">${d.getDate()}</span>
      ${items.slice(0,3).map(x=>`<button class="ev ${META[x.kind].css}" data-event="${esc(x.id)}" title="${esc(x.title)}">${esc(x.title)}</button>`).join('')}
      ${items.length>3?`<span class="ev-more">+${items.length-3} more</span>`:''}
    </div>`;
  }).join('');

  renderAgenda(selectedKey);
  renderDeadlines();
  renderLegend();
}

function renderAgenda(key){
  const rows=visibleItems().filter(x=>x.date===key).sort((a,b)=>String(a.startsAt).localeCompare(String(b.startsAt)));
  $('#agTitle').textContent=fmtDate(key);$('#agTag').textContent=rows.length+' item'+(rows.length===1?'':'s');
  $('#agenda').innerHTML=rows.length?rows.map(x=>{
    const time=['meeting','task'].includes(x.kind)?new Date(x.startsAt).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'}):'All day';
    return `<button class="ag" data-event="${esc(x.id)}" style="width:100%;text-align:left"><span class="ag__time">${esc(time)}</span><span class="ag__bar" style="background:var(--accent)"></span><span><span class="ag__t">${esc(x.title)}</span><span class="ag__m">${esc(META[x.kind].label+(x.meta?' · '+x.meta:''))}</span></span></button>`;
  }).join(''):'<div class="ag-empty">Nothing scheduled.</div>';
}

function renderDeadlines(){
  const today=indiaKey(new Date()),next=addDays(today,30);
  const rows=visibleItems().filter(x=>['task','milestone','site'].includes(x.kind)&&x.date>=today&&x.date<=next).slice(0,8);
  $('#deadlineList').innerHTML=rows.length?rows.map(x=>`<button class="dlr" data-event="${esc(x.id)}" style="width:100%;text-align:left"><span class="dlr__ic ${x.kind==='site'?'i-sky':x.kind==='milestone'?'i-green':'i-amber'}">●</span><span><span class="dlr__t">${esc(x.title)}</span><span class="dlr__m">${esc(x.meta||META[x.kind].label)}</span></span><span class="dlr__due">${fmtDate(x.date)}</span></button>`).join(''):'<div class="ag-empty">No deadlines in the next 30 days.</div>';
}

function renderLegend(){
  $('#legend').innerHTML=Object.entries(META).map(([kind,m])=>{
    const count=ITEMS.filter(x=>x.kind===kind).length,on=ACTIVE.has(kind);
    return `<button class="lg ${on?'':'off'}" data-kind="${kind}"><span class="lg__dot" style="background:var(--accent)"></span>${esc(m.label)}<span class="lg__n">${count}</span></button>`;
  }).join('');
}

document.addEventListener('click',e=>{
  const cell=e.target.closest('.cell[data-date]');if(cell&&!e.target.closest('[data-event]')){selectedKey=cell.dataset.date;render();return;}
  const ev=e.target.closest('[data-event]');if(ev){const item=ITEMS.find(x=>x.id===ev.dataset.event);if(item?.href)location.href=item.href;return;}
  const lg=e.target.closest('[data-kind]');if(lg){const k=lg.dataset.kind;ACTIVE.has(k)?ACTIVE.delete(k):ACTIVE.add(k);render();}
});
$('#prevM').addEventListener('click',()=>{cursor.setMonth(cursor.getMonth()-1);selectedKey=null;load();});
$('#nextM').addEventListener('click',()=>{cursor.setMonth(cursor.getMonth()+1);selectedKey=null;load();});
$('#todayBtn').addEventListener('click',()=>{cursor=new Date();cursor.setDate(1);selectedKey=indiaKey(new Date());load();});
$('#tasksBtn').addEventListener('click',()=>location.href='/tasks.html');
$('#meetingBtn').addEventListener('click',()=>location.href='/meetings.html');

await load();
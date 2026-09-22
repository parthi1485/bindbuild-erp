import { supabase } from '../lib/supabase.js';
import { mountShell, activeUnit } from '../lib/shell.js';
import { fail, esc, fmtDate, toast } from '../lib/ui.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const num = v => Number(v || 0);

const user = await mountShell({ route: 'dashboard', title: 'Dashboard' });
if (!user) throw new Error('redirecting');

const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const unitId = activeUnit();
const unitScope = (rows = []) => unitId ? rows.filter(r => !r.business_unit_id || r.business_unit_id === unitId) : rows;
const isOpenProject = s => !['completed','cancelled','closed'].includes(String(s || '').toLowerCase());
const isOpenTask = s => !['done','cancelled'].includes(String(s || '').toLowerCase());

function moneyINR(v) {
  const n = num(v);
  if (Math.abs(n) >= 1e7) return `₹${(n/1e7).toFixed(1).replace('.0','')}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n/1e5).toFixed(1).replace('.0','')}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function greet() {
  const h = now.getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  if ($('#greeting')) $('#greeting').textContent = `${part}, ${user.name.split(' ')[0]}`;
  if ($('#todayLine')) $('#todayLine').textContent =
    now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) + ' · Chennai';
}

function setKpi(index, value, sub = '') {
  const card = $$('.kpis .kpi')[index];
  if (!card) return;
  const valueEl = card.querySelector('.kpi__value');
  const delta = card.querySelector('.kpi__delta');
  if (valueEl) valueEl.textContent = value;
  if (delta && sub) {
    delta.className = 'kpi__delta';
    delta.textContent = sub;
  }
}

async function loadCore() {
  const [leadRes, projectRes, invoiceRes, receiptRes, expenseRes, taskRes, approvalRes, clientRes, meetingRes] = await Promise.all([
    supabase.from('leads').select('id,business_unit_id,lead_no,name,stage,expected_value,created_at,updated_at').is('deleted_at', null),
    supabase.from('projects').select('id,business_unit_id,project_no,code,name,status,health,client_id,contract_value,progress_pct,created_at,updated_at').is('deleted_at', null),
    supabase.from('invoices').select('id,business_unit_id,invoice_no,total,amount_paid,status,issue_date,due_date,created_at').is('deleted_at', null),
    supabase.from('receipts').select('id,business_unit_id,receipt_no,amount,receipt_date,status,created_at'),
    supabase.from('expenses').select('id,business_unit_id,title,amount,expense_date,status,created_at'),
    supabase.from('tasks').select('id,project_id,title,priority,status,due_at,created_at').order('due_at', { ascending:true, nullsFirst:false }),
    supabase.from('approvals').select('id,title,amount,status,created_at').order('created_at', { ascending:false }),
    supabase.from('clients').select('id,business_unit_id,name,created_at').is('deleted_at', null),
    supabase.from('meetings').select('id,business_unit_id,project_id,meeting_no,title,meeting_type,scheduled_at,duration_minutes,location,status').in('status',['scheduled','in_progress']).order('scheduled_at')
  ]);

  [leadRes,projectRes,invoiceRes,receiptRes,expenseRes,taskRes,approvalRes,clientRes,meetingRes]
    .forEach(r => { if (r.error) throw r.error; });

  const projects=unitScope(projectRes.data),projectIds=new Set(projects.map(p=>p.id));
  return {
    leads: unitScope(leadRes.data),
    projects,
    invoices: unitScope(invoiceRes.data),
    receipts: unitScope(receiptRes.data).filter(r => r.status !== 'cancelled'),
    expenses: unitScope(expenseRes.data).filter(r=>['approved','paid'].includes(r.status)),
    tasks: (taskRes.data || []).filter(t=>!t.project_id||projectIds.has(t.project_id)),
    approvals: (approvalRes.data || []).filter(a=>!a.project_id||projectIds.has(a.project_id)),
    clients: unitScope(clientRes.data),
    meetings: unitScope(meetingRes.data)
  };
}

function paintKpis(d) {
  const monthReceipts = d.receipts
    .filter(r => new Date(r.receipt_date || r.created_at) >= monthStart)
    .reduce((s,r) => s + num(r.amount), 0);
  const activeProjects = d.projects.filter(p => isOpenProject(p.status));
  const openTasks = d.tasks.filter(t => isOpenTask(t.status));
  const dueWeek = openTasks.filter(t => {
    if (!t.due_at) return false;
    const diff = new Date(t.due_at) - now;
    return diff >= 0 && diff <= 7 * 86400000;
  }).length;

  const labels = $$('.kpis .kpi .kpi__label');
  if (labels[0]) labels[0].textContent = `Collections · ${now.toLocaleString('en-IN',{month:'long'})}`;
  setKpi(0, moneyINR(monthReceipts), 'actual receipts');
  setKpi(1, String(activeProjects.length), `${activeProjects.filter(p => ['atrisk','critical'].includes(p.health)).length} at risk`);
  setKpi(2, String(openTasks.length), `${dueWeek} due this week`);
  setKpi(3, String(d.clients.length), 'active client records');
}

function monthBuckets() {
  const a = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    a.push({
      key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: d.toLocaleString('en-IN', { month:'short' })
    });
  }
  return a;
}
const ymd = v => String(v || '').slice(0,7);

function paintCharts(d) {
  if (!window.Chart) return;
  const buckets = monthBuckets();
  const receipts = buckets.map(b => d.receipts.filter(r => ymd(r.receipt_date) === b.key).reduce((s,r)=>s+num(r.amount),0));
  const expenses = buckets.map(b => d.expenses.filter(r => ymd(r.expense_date) === b.key).reduce((s,r)=>s+num(r.amount),0));
  const root = getComputedStyle(document.documentElement);
  const accent = root.getPropertyValue('--accent').trim() || '#5a8dee';
  const muted = root.getPropertyValue('--text-3').trim() || '#657079';
  const success = root.getPropertyValue('--success').trim() || '#41d1a0';
  const grid = root.getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,.06)';
  const text = root.getPropertyValue('--text-2').trim() || '#9aa4ad';

  const common = {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ display:false } },
    scales:{
      x:{ grid:{ display:false }, ticks:{ color:text } },
      y:{ grid:{ color:grid }, ticks:{ color:text, callback:v => moneyINR(v) } }
    }
  };

  if ($('#revChart')) {
    new Chart($('#revChart'), {
      type:'bar',
      data:{ labels:buckets.map(b=>b.label), datasets:[
        { label:'Collections', data:receipts, backgroundColor:accent, borderRadius:5 },
        { label:'Expenses', data:expenses, backgroundColor:muted, borderRadius:5 }
      ]},
      options:common
    });
  }

  if ($('#cashChart')) {
    const net = receipts.map((v,i)=>v-expenses[i]);
    new Chart($('#cashChart'), {
      type:'line',
      data:{ labels:buckets.map(b=>b.label), datasets:[{
        label:'Net cash movement', data:net, borderColor:success,
        backgroundColor:success, tension:.35, pointRadius:3, fill:false
      }]},
      options:common
    });
  }

  const stageMap = new Map();
  d.projects.filter(p => isOpenProject(p.status)).forEach(p => {
    const key = p.status || 'planning';
    stageMap.set(key, (stageMap.get(key) || 0) + 1);
  });
  const stages = [...stageMap.entries()];
  const stageList = $('#stageList');
  if (stageList) stageList.innerHTML = stages.length ? stages.map(([stage,count]) =>
    `<div class="stage-row"><span class="stage-row__dot"></span><span class="stage-row__name">${esc(stage.replaceAll('_',' '))}</span><span class="stage-row__count">${count}</span></div>`
  ).join('') : '<div class="empty__sub">No active projects yet.</div>';

  const donutCentre = $('.donut-centre b');
  if (donutCentre) donutCentre.textContent = String(d.projects.filter(p=>isOpenProject(p.status)).length);

  if ($('#stageChart') && stages.length) {
    const palette = [accent, success, muted, root.getPropertyValue('--warning').trim() || '#f0b45a', root.getPropertyValue('--violet').trim() || '#a78bfa'];
    new Chart($('#stageChart'), {
      type:'doughnut',
      data:{ labels:stages.map(x=>x[0]), datasets:[{ data:stages.map(x=>x[1]), backgroundColor:stages.map((_,i)=>palette[i%palette.length]), borderWidth:0 }] },
      options:{ responsive:true, maintainAspectRatio:false, cutout:'68%', plugins:{legend:{display:false}} }
    });
  }
}

function paintTasks(d) {
  const el = $('#taskList');
  if (!el) return;
  const tasks = d.tasks.filter(t=>isOpenTask(t.status)).slice(0,6);
  el.innerHTML = tasks.length ? tasks.map(t => `
    <div class="task-row">
      <span class="task-row__check"></span>
      <span class="task-row__body"><b>${esc(t.title)}</b><small>${t.due_at ? 'Due ' + fmtDate(t.due_at) : 'No due date'}</small></span>
      <span class="badge">${esc(t.priority || 'medium')}</span>
    </div>`).join('') :
    '<div class="empty"><div class="empty__title">No open tasks</div><div class="empty__sub">Your execution queue is clear.</div></div>';
}

function paintMeetings(d) {
  const el = $('#meetList');
  if (!el) return;
  const cutoff=new Date(now.getTime()+48*3600000);
  const rows=(d.meetings||[]).filter(m=>new Date(m.scheduled_at)>=now&&new Date(m.scheduled_at)<=cutoff).slice(0,6);
  el.innerHTML=rows.length?rows.map(m=>{
    const dt=new Date(m.scheduled_at);
    return `<div class="meet-row"><div class="meet-row__date"><b>${dt.toLocaleDateString('en-IN',{day:'2-digit'})}</b><span>${dt.toLocaleDateString('en-IN',{month:'short'})}</span></div><div class="meet-row__body"><b>${esc(m.title)}</b><small>${dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} · ${esc(m.location||m.meeting_type||'Meeting')}</small></div></div>`;
  }).join(''):'<div class="empty"><div class="empty__title">No meetings in the next 48 hours</div><div class="empty__sub">Scheduled meetings will appear here automatically.</div></div>';
}

function paintFeed(d) {
  const el = $('#feed');
  if (!el) return;
  const rows = [
    ...d.leads.map(x=>({at:x.created_at,text:`Lead ${x.lead_no || ''} · ${x.name}`})),
    ...d.projects.map(x=>({at:x.created_at,text:`Project ${x.project_no || x.code || ''} · ${x.name}`})),
    ...d.receipts.map(x=>({at:x.created_at,text:`Receipt ${x.receipt_no || ''} · ${moneyINR(x.amount)}`}))
  ].sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,8);

  el.innerHTML = rows.length ? rows.map(x => `
    <div class="feed__item"><span class="feed__txt">${esc(x.text)}</span><span class="feed__time">${fmtDate(x.at)}</span></div>
  `).join('') : '<div class="feed__item"><span class="feed__txt">No live ERP activity yet. Create the first lead to begin.</span></div>';
}

function paintCalendar(meetings=[]) {
  const grid = $('#calGrid');
  if (!grid) return;
  const card = grid.closest('.card');
  const title = card?.querySelector('.card__title');
  const hint = card?.querySelector('.card__hint');
  if (title) title.textContent = now.toLocaleString('en-IN',{month:'long',year:'numeric'});
  if (hint) hint.textContent = 'Current month';

  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
  const cells = ['S','M','T','W','T','F','S'].map(x=>`<span class="cal__dow">${x}</span>`);
  for (let i=0;i<first.getDay();i++) cells.push('<span class="cal__day is-out"></span>');
  for (let day=1; day<=last.getDate(); day++) {
    const hasMeeting=meetings.some(m=>{const d=new Date(m.scheduled_at);return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===day;});
    cells.push(`<span class="cal__day ${day===now.getDate()?'is-today':''} ${hasMeeting?'has-event':''}">${day}</span>`);
  }
  grid.innerHTML = cells.join('');
}

function paintApprovals(d) {
  const pending = d.approvals.filter(a=>a.status==='pending');
  const body = $('#notifBody');
  if (body) body.innerHTML = pending.length ? pending.slice(0,8).map(a=>`
    <div class="notif"><b>${esc(a.title)}</b><small>Approval pending${num(a.amount) ? ' · ' + moneyINR(a.amount) : ''}</small></div>
  `).join('') : '<div class="empty__sub">No pending approvals.</div>';
}

greet();
$('.weather')?.remove();

try {
  const data = await loadCore();
  paintKpis(data);
  paintCharts(data);
  paintTasks(data);
  paintMeetings(data);
  paintCalendar(data.meetings||[]);
  paintFeed(data);
  paintApprovals(data);
  const revHint=$('#revChart')?.closest('.card')?.querySelector('.card__hint');
  if(revHint)revHint.textContent='Last 6 months · issued receipts vs booked expenses';
  const stageHint=$('#stageChart')?.closest('.card')?.querySelector('.card__hint');
  if(stageHint)stageHint.textContent=data.projects.filter(p=>isOpenProject(p.status)).length+' active projects';
} catch (error) {
  fail(error);
} catch (error) {
  fail(error);
}

$('#notifDrawer')?.setAttribute('hidden','');


import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user=await mountShell({route:'finance',title:'Finance'});
if(!user)throw new Error('redirecting');

const money=v=>{
  const n=Number(v)||0;
  if(Math.abs(n)>=1e7)return '₹'+(n/1e7).toFixed(2).replace(/\.00$/,'')+' Cr';
  if(Math.abs(n)>=1e5)return '₹'+(n/1e5).toFixed(2).replace(/\.00$/,'')+' L';
  return '₹'+Math.round(n).toLocaleString('en-IN');
};
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim()||'#5a8dee';

let period='YTD',INVOICES=[],PROFORMAS=[],RECEIPTS=[],EXPENSES=[],PROJECTS=[],CLIENTS=[];
function rangeStart(){
  const now=new Date();
  if(period==='Q')return new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1);
  if(period==='FY'){
    const y=now.getMonth()>=3?now.getFullYear():now.getFullYear()-1;
    return new Date(y,3,1);
  }
  return new Date(now.getFullYear(),0,1);
}
const after=(value,start)=>!value||new Date(value)>=start;

async function load(){
  try{
    const [i,p,r,e,pr,c]=await Promise.all([
      scopeToUnit(supabase.from('invoices').select('*').is('deleted_at',null)),
      scopeToUnit(supabase.from('proforma_invoices').select('*').is('deleted_at',null)),
      scopeToUnit(supabase.from('receipts').select('*')).eq('status','issued'),
      scopeToUnit(supabase.from('expenses').select('*')),
      scopeToUnit(supabase.from('projects').select('*').is('deleted_at',null)),
      scopeToUnit(supabase.from('clients').select('id,name').is('deleted_at',null))
    ]);
    [i,p,r,e,pr,c].forEach(x=>{if(x.error)throw x.error;});
    INVOICES=i.data||[];PROFORMAS=p.data||[];RECEIPTS=r.data||[];EXPENSES=e.data||[];PROJECTS=pr.data||[];CLIENTS=c.data||[];
    paint();
  }catch(err){fail(err);}
}

function periodData(){
  const start=rangeStart();
  return {
    invoices:INVOICES.filter(x=>after(x.issue_date,start)),
    proformas:PROFORMAS.filter(x=>after(x.issue_date,start)),
    receipts:RECEIPTS.filter(x=>after(x.receipt_date,start)),
    expenses:EXPENSES.filter(x=>after(x.expense_date||x.created_at,start))
  };
}

function outstandingRows(){
  const converted=new Set(INVOICES.map(i=>i.proforma_id).filter(Boolean));
  const inv=INVOICES.map(x=>({...x,kind:'Invoice',balance:Math.max(Number(x.total||0)-Number(x.amount_paid||0),0)}));
  const pi=PROFORMAS.filter(x=>!converted.has(x.id)).map(x=>({...x,kind:'Proforma',balance:Math.max(Number(x.total||0)-Number(x.amount_paid||0),0)}));
  return [...inv,...pi].filter(x=>x.balance>0.01);
}

function paint(){
  const d=periodData();
  const invoiced=d.invoices.reduce((a,x)=>a+Number(x.total||0),0);
  const collected=d.receipts.reduce((a,x)=>a+Number(x.amount||0),0);
  const cost=d.expenses.filter(x=>x.status!=='cancelled').reduce((a,x)=>a+Number(x.amount||0),0);
  const outstanding=outstandingRows().reduce((a,x)=>a+x.balance,0);
  const gm=invoiced?((invoiced-cost)/invoiced*100):null;
  const cash=collected-d.expenses.filter(x=>x.status==='paid').reduce((a,x)=>a+Number(x.amount||0),0);

  $('#kInv').textContent=money(invoiced);
  $('#kColl').textContent=money(collected);
  $('#kCost').textContent=money(cost);
  $('#kGm').textContent=gm===null?'—':gm.toFixed(1)+'%';
  $('#kCash').textContent=money(cash);
  $('#kRecv').textContent=money(outstanding);

  const boxes=$$('.kbox');
  const labels=['GST invoiced','Collected','Recorded cost','Gross margin','Net cash movement','Receivables'];
  const notes=['Tax invoices in period','Issued receipts','Expenses in period','Invoice less recorded cost','Collections less paid expenses','Invoices + unconverted proformas'];
  boxes.forEach((b,i)=>{
    const top=b.querySelector('.kbox__top');if(top){const span=top.querySelector('span');top.childNodes[top.childNodes.length-1].nodeValue=labels[i]||'';}
    const n=b.querySelector('.kbox__note');if(n)n.textContent=notes[i]||'';
  });

  paintRevenueCost(d);
  paintExpenses(d);
  paintProjects();
  paintAgeing();
  paintTransactions(d);
  document.body.classList.add('loaded');
}

function buckets(){
  const now=new Date(), arr=[];
  for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);arr.push({key:d.toISOString().slice(0,7),label:d.toLocaleString('en-IN',{month:'short'})});}
  return arr;
}

function paintRevenueCost(d){
  const canvas=$('#rcChart');if(!canvas||!window.Chart)return;
  if(canvas._chart)canvas._chart.destroy();
  const b=buckets();
  const rev=b.map(m=>d.receipts.filter(x=>String(x.receipt_date||'').startsWith(m.key)).reduce((a,x)=>a+Number(x.amount||0),0));
  const cost=b.map(m=>d.expenses.filter(x=>String(x.expense_date||x.created_at||'').startsWith(m.key)&&x.status!=='cancelled').reduce((a,x)=>a+Number(x.amount||0),0));
  canvas._chart=new Chart(canvas,{type:'bar',data:{labels:b.map(x=>x.label),datasets:[
    {label:'Collections',data:rev,backgroundColor:css('--accent'),borderRadius:5},
    {label:'Cost',data:cost,backgroundColor:css('--danger'),borderRadius:5}
  ]},options:{plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{callback:v=>money(v)}}},maintainAspectRatio:false}});
  $('#rcSub').textContent='Actual collections vs recorded cost · last 6 months';
  $('#rcMargin').textContent='Net '+money(rev.reduce((a,b)=>a+b,0)-cost.reduce((a,b)=>a+b,0));
  $('#lgRev').textContent=money(rev.reduce((a,b)=>a+b,0));
  $('#lgCost').textContent=money(cost.reduce((a,b)=>a+b,0));
}

function paintExpenses(d){
  const by=new Map();
  d.expenses.filter(x=>x.status!=='cancelled').forEach(x=>{const k=x.category||'other';by.set(k,(by.get(k)||0)+Number(x.amount||0));});
  const rows=[...by.entries()].sort((a,b)=>b[1]-a[1]),total=rows.reduce((a,x)=>a+x[1],0);
  const canvas=$('#expChart');
  if(canvas&&window.Chart&&rows.length){
    if(canvas._chart)canvas._chart.destroy();
    canvas._chart=new Chart(canvas,{type:'doughnut',data:{labels:rows.map(x=>String(x[0]).replaceAll('_',' ')),datasets:[{data:rows.map(x=>x[1]),borderWidth:0}]},options:{cutout:'66%',plugins:{legend:{display:false}},maintainAspectRatio:false}});
  }
  $('#expLegend').innerHTML=rows.length?rows.map(([k,v])=>`<div class="lg"><span class="lg__nm">${esc(String(k).replaceAll('_',' '))}</span><span class="lg__val">${money(v)}</span><span>${total?Math.round(v/total*100):0}%</span></div>`).join(''):'<div class="lg">No expenses in this period</div>';
}

function paintProjects(){
  const clientMap=new Map(CLIENTS.map(x=>[x.id,x.name]));
  const rows=PROJECTS.map(p=>{
    const billed=INVOICES.filter(i=>i.project_id===p.id).reduce((a,x)=>a+Number(x.total||0),0);
    const received=RECEIPTS.filter(r=>r.project_id===p.id).reduce((a,x)=>a+Number(x.amount||0),0);
    const cost=EXPENSES.filter(e=>e.project_id===p.id&&e.status!=='cancelled').reduce((a,x)=>a+Number(x.amount||0),0);
    return {p,billed,received,cost,margin:billed?((billed-cost)/billed*100):null,client:clientMap.get(p.client_id)||''};
  }).filter(x=>x.billed||x.cost||x.received).sort((a,b)=>b.billed-a.billed);
  $('#projList').innerHTML=rows.length?rows.map(x=>`<div class="prow" data-project="${x.p.id}" style="padding:10px 0;border-bottom:1px solid var(--hairline);cursor:pointer"><div class="prow__top"><span class="prow__nm">${esc(x.p.project_no||x.p.code)} · ${esc(x.p.name)}</span><span class="prow__fig">Billed ${money(x.billed)} · Cost ${money(x.cost)} · <b>${x.margin===null?'—':x.margin.toFixed(1)+'%'}</b></span></div><small>${esc(x.client)} · Collected ${money(x.received)}</small></div>`).join(''):'<div class="t-empty">No project financial activity yet.</div>';
}

function paintAgeing(){
  const rows=outstandingRows();
  const now=new Date();
  const defs=[['Not due',x=>!x.due_date||new Date(x.due_date)>=now],['1–30 days',x=>x.due_date&&((now-new Date(x.due_date))/86400000)>0&&((now-new Date(x.due_date))/86400000)<=30],['31–60 days',x=>x.due_date&&((now-new Date(x.due_date))/86400000)>30&&((now-new Date(x.due_date))/86400000)<=60],['61+ days',x=>x.due_date&&((now-new Date(x.due_date))/86400000)>60]];
  const groups=defs.map(([name,test])=>({name,items:rows.filter(test)})).filter(x=>x.items.length);
  const max=Math.max(...groups.map(g=>g.items.reduce((a,x)=>a+x.balance,0)),1);
  $('#aging').innerHTML=groups.length?groups.map(g=>{const v=g.items.reduce((a,x)=>a+x.balance,0);return `<div class="age"><div class="age__top"><span class="age__k">${esc(g.name)}</span><span class="age__v">${money(v)} · ${g.items.length}</span></div><div class="bar"><div class="bar__fill" style="width:${Math.round(v/max*100)}%;background:var(--accent)"></div></div></div>`}).join(''):'<div class="t-empty">Nothing outstanding</div>';
  const total=rows.reduce((a,x)=>a+x.balance,0);
  const tag=$('#aging')?.closest('.card')?.querySelector('.card__tag');if(tag)tag.textContent=money(total);
  const totalEl=$('#aging')?.closest('.card')?.querySelector('.age__total b');if(totalEl)totalEl.textContent=money(total);
}

function paintTransactions(d){
  const rows=[
    ...d.receipts.map(r=>({dir:'in',date:r.receipt_date,title:'Receipt '+r.receipt_no,meta:String(r.payment_mode||'').replaceAll('_',' '),amount:r.amount})),
    ...d.expenses.filter(e=>e.status!=='cancelled').map(e=>({dir:'out',date:e.expense_date||e.created_at,title:e.title||'Expense',meta:e.category||'',amount:e.amount}))
  ].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,12);
  $('#tx').innerHTML=rows.length?rows.map(x=>`<div class="trow"><span class="tx__ic ${x.dir}">${x.dir==='in'?'↓':'↑'}</span><div><div class="tx__t">${esc(x.title)}</div><div class="tx__m">${esc(String(x.meta))} · ${fmtDate(x.date)}</div></div><span class="tx__amt ${x.dir}">${x.dir==='in'?'+':'−'}${money(x.amount)}</span></div>`).join(''):'<div class="t-empty">No transactions in this period.</div>';
}

$('#periodSeg')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-p]');if(!b)return;
  period=b.dataset.p;
  $$('#periodSeg button').forEach(x=>x.classList.toggle('on',x===b));
  paint();
});
document.addEventListener('click',e=>{const p=e.target.closest('[data-project]');if(p)location.href='/project.html?id='+p.dataset.project;});
const exportBtn=$('.ctx__actions .btn-ghost:last-child');
if(exportBtn)exportBtn.addEventListener('click',()=>{
  const rows=[['Type','Number','Date','Amount']]
    .concat(RECEIPTS.map(x=>['Receipt',x.receipt_no,x.receipt_date,x.amount]))
    .concat(INVOICES.map(x=>['Invoice',x.invoice_no,x.issue_date,x.total]))
    .concat(EXPENSES.map(x=>['Expense',x.title,x.expense_date,x.amount]));
  const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const u=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=u;a.download='bindbuild-finance-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(u);toast('Finance CSV exported');
});

await load();
const financeIntent=new URLSearchParams(location.search).get('new');
if(financeIntent==='invoice'){
  history.replaceState(null,'','/finance.html');
  toast('GST Invoice is created from a paid Proforma. Open the related project / proforma to generate it.','info');
}

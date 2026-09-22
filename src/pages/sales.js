import { supabase } from '../lib/supabase.js';
import { mountShell, activeUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user=await mountShell({route:'sales',title:'Sales & Proposals'});
if(!user)throw new Error('redirecting');

const STAGES=[
  {id:'new',name:'New',p:.10},
  {id:'contacted',name:'Contacted',p:.20},
  {id:'meeting',name:'Site / Office Meet',p:.35},
  {id:'proposal',name:'Proposal',p:.60},
  {id:'follow_up',name:'Follow-up',p:.75},
  {id:'won',name:'Won',p:1},
  {id:'lost',name:'Lost',p:0}
];

let LEADS=[],ESTIMATES=[],PROPOSALS=[];
const rupees=v=>{
  const n=Number(v||0);
  if(Math.abs(n)>=1e7)return '₹'+(n/1e7).toFixed(2).replace(/\.00$/,'')+' Cr';
  if(Math.abs(n)>=1e5)return '₹'+(n/1e5).toFixed(1).replace(/\.0$/,'')+' L';
  return '₹'+Math.round(n).toLocaleString('en-IN');
};
const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function scoped(rows){
  const id=activeUnit();
  return id?rows.filter(r=>!r.business_unit_id||r.business_unit_id===id):rows;
}

async function load(){
  try{
    const [l,e,p]=await Promise.all([
      supabase.from('leads').select('*').is('deleted_at',null).order('updated_at',{ascending:false}),
      supabase.from('estimates').select('*').is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('proposals').select('*').is('deleted_at',null).order('created_at',{ascending:false})
    ]);
    if(l.error)throw l.error;if(e.error)throw e.error;if(p.error)throw p.error;
    LEADS=scoped(l.data||[]);ESTIMATES=scoped(e.data||[]);PROPOSALS=scoped(p.data||[]);
    paintKpis();paintFunnel();paintWinLoss();paintStageChart();paintRevenue();paintForecast();paintRing();paintDocumentHub();
  }catch(err){fail(err);}
}

function paintKpis(){
  const open=LEADS.filter(x=>!['won','lost'].includes(x.stage));
  const pipe=open.reduce((a,x)=>a+Number(x.expected_value||0),0);
  const closed=LEADS.filter(x=>['won','lost'].includes(x.stage));
  const won=closed.filter(x=>x.stage==='won').length;
  const winRate=closed.length?Math.round(won/closed.length*100):0;
  const avgDays=open.length?Math.round(open.reduce((a,x)=>a+Math.max(0,(Date.now()-new Date(x.created_at))/86400000),0)/open.length):0;
  const issued=PROPOSALS.filter(x=>['sent','accepted'].includes(x.status)).reduce((a,x)=>a+Number(x.grand_total||0),0);

  const cards=$$('.kpis .kpi');
  const vals=cards.map(x=>x.querySelector('.kpi__val'));
  const labs=cards.map(x=>x.querySelector('.kpi__label'));
  const deltas=cards.map(x=>x.querySelector('.kpi__delta'));
  if(vals[0])vals[0].textContent=rupees(pipe);
  if(labs[0])labs[0].textContent='Open pipeline value';
  if(deltas[0])deltas[0].textContent=open.length+' active leads';

  if(vals[1])vals[1].textContent=winRate+'%';
  if(labs[1])labs[1].textContent='Lead win rate';
  if(deltas[1])deltas[1].textContent=closed.length+' closed';

  if(vals[2])vals[2].textContent=avgDays+' days';
  if(labs[2])labs[2].textContent='Avg. open lead age';
  if(deltas[2])deltas[2].textContent='live CRM';

  if(vals[3])vals[3].textContent=rupees(issued);
  if(labs[3])labs[3].textContent='Issued proposal value';
  if(deltas[3])deltas[3].textContent=PROPOSALS.filter(x=>x.status==='sent').length+' awaiting decision';
}

function paintFunnel(){
  const host=$('#funnelRows');if(!host)return;
  const order=STAGES.filter(s=>!['won','lost'].includes(s.id));
  const rank=new Map(order.map((s,i)=>[s.id,i]));
  const rows=order.map((s,i)=>({
    name:s.name,
    n:LEADS.filter(l=>l.stage==='won'||(!['lost'].includes(l.stage)&&(rank.get(l.stage)??-1)>=i)).length
  }));
  rows.push({name:'Won',n:LEADS.filter(l=>l.stage==='won').length});
  const top=Math.max(...rows.map(r=>r.n),1);
  host.innerHTML=rows.map((r,i)=>{
    const prev=i?rows[i-1].n:r.n;
    const conv=i?(prev?Math.round(r.n/prev*100):0):100;
    return `<div class="fn">
      <div class="fn__name">${esc(r.name)}<small>${i===0?'top of funnel':i===rows.length-1?'closed':'progressed'}</small></div>
      <div class="fn__bar"><div class="fn__fill ${['','s2','s3','s4','s5','s6'][i]||'s6'}" style="width:${Math.round(r.n/top*100)}%">${r.n}</div></div>
      <div class="fn__conv"><b>${conv}%</b> from prev</div>
    </div>`;
  }).join('');
}

function paintWinLoss(){
  const el=$('#wlChart');if(!el||!window.Chart)return;
  const won=LEADS.filter(x=>x.stage==='won').length;
  const lost=LEADS.filter(x=>x.stage==='lost').length;
  const open=LEADS.filter(x=>!['won','lost'].includes(x.stage)).length;
  new Chart(el,{type:'doughnut',data:{labels:['Won','Lost','Open'],datasets:[{
    data:[won,lost,open],
    borderWidth:0,backgroundColor:[cssVar('--success'),cssVar('--danger'),cssVar('--text-3')]
  }]},options:{cutout:'66%',plugins:{legend:{display:false}},maintainAspectRatio:false}});
  const legend=el.closest('.card')?.querySelector('.legend');
  if(legend)legend.innerHTML=`
    <span><i style="background:var(--success)"></i>Won · ${won}</span>
    <span><i style="background:var(--danger)"></i>Lost · ${lost}</span>
    <span><i style="background:var(--text-3)"></i>Open · ${open}</span>`;
}

function paintStageChart(){
  const el=$('#stageChart');if(!el||!window.Chart)return;
  const open=STAGES.filter(s=>!['won','lost'].includes(s.id));
  new Chart(el,{type:'bar',data:{labels:open.map(s=>s.name),datasets:[{
    data:open.map(s=>LEADS.filter(l=>l.stage===s.id).reduce((a,l)=>a+Number(l.expected_value||0),0)),
    backgroundColor:cssVar('--accent'),borderRadius:6
  }]},options:{plugins:{legend:{display:false}},scales:{
    x:{grid:{display:false}},y:{beginAtZero:true,ticks:{callback:v=>rupees(v)}}
  },maintainAspectRatio:false}});
}

function paintRevenue(){
  const el=$('#revChart');if(!el||!window.Chart)return;
  const months=[];
  for(let i=5;i>=0;i--){
    const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);
    months.push({key:d.toISOString().slice(0,7),label:d.toLocaleString('en-IN',{month:'short'})});
  }
  const data=months.map(m=>PROPOSALS.filter(p=>p.accepted_at?.slice(0,7)===m.key).reduce((a,p)=>a+Number(p.grand_total||0),0));
  new Chart(el,{type:'line',data:{labels:months.map(m=>m.label),datasets:[{
    data,borderColor:cssVar('--accent'),backgroundColor:'rgba(90,141,238,.14)',fill:true,tension:.35,pointRadius:3
  }]},options:{plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{callback:v=>rupees(v)}}},maintainAspectRatio:false}});
  const card=el.closest('.card');
  const title=card?.querySelector('.card__title');
  const sub=card?.querySelector('.card__sub');
  const legend=card?.querySelector('.legend');
  if(title)title.textContent='Accepted proposal value';
  if(sub)sub.textContent='Monthly accepted commercial value';
  if(legend)legend.innerHTML='<span><i style="background:var(--accent)"></i>Accepted value</span>';
}

function paintForecast(){
  const host=$('#forecastBody');if(!host)return;
  const open=LEADS.filter(l=>!['won','lost'].includes(l.stage));
  const rows=STAGES.filter(s=>!['won','lost'].includes(s.id)).map(s=>{
    const leads=open.filter(l=>l.stage===s.id);
    const pipe=leads.reduce((a,l)=>a+Number(l.expected_value||0),0);
    return {name:s.name,p:s.p,leads,pipe,weighted:pipe*s.p};
  }).filter(r=>r.leads.length);
  host.innerHTML=rows.length?rows.map(r=>`<tr>
    <td class="month">${esc(r.name)}</td>
    <td>${esc(r.leads.slice(0,2).map(x=>x.name).join(' · ')||'—')}</td>
    <td class="r mono">${rupees(r.pipe)}</td>
    <td class="r mono" style="color:var(--accent)">${rupees(r.weighted)}</td>
    <td><div class="bar-cell"><div class="track"><div class="fill" style="width:${Math.round(r.p*100)}%"></div></div></div></td>
    <td class="r"><span class="pill ${r.p>=.6?'high':r.p>=.35?'mid':'low'}">${Math.round(r.p*100)}%</span></td>
  </tr>`).join(''):'<tr><td colspan="6" class="t-empty">No open leads yet.</td></tr>';
  $('#fcDeals').textContent=String(open.length);
  $('#fcPipe').textContent=rupees(rows.reduce((a,r)=>a+r.pipe,0));
  $('#fcWeighted').textContent=rupees(rows.reduce((a,r)=>a+r.weighted,0));
}

function paintRing(){
  const sent=PROPOSALS.filter(p=>['sent','accepted'].includes(p.status));
  const sentValue=sent.reduce((a,p)=>a+Number(p.grand_total||0),0);
  const accepted=PROPOSALS.filter(p=>p.status==='accepted'||p.accepted_at);
  const acceptedValue=accepted.reduce((a,p)=>a+Number(p.grand_total||0),0);
  const pct=sentValue?Math.min(100,Math.round(acceptedValue/sentValue*100)):0;

  const card=$('.ring-card');
  if(card){
    card.querySelector('.card__title').textContent='Proposal acceptance';
    card.querySelector('.card__sub').textContent='Accepted value as a share of issued proposals';
    const labels=card.querySelectorAll('.ring-meta .lbl');
    if(labels[0])labels[0].textContent='Accepted';
    if(labels[1])labels[1].textContent='Issued';
    if(labels[2])labels[2].textContent='Open gap';
    const vals=card.querySelectorAll('.ring-meta .val');
    if(vals[1])vals[1].textContent=rupees(sentValue);
  }
  $('#ringPct').textContent=pct+'%';
  $('#ringAch').textContent=rupees(acceptedValue);
  $('#ringGap').textContent=rupees(Math.max(sentValue-acceptedValue,0));
  const ring=$('#ringFill');
  if(ring){
    const r=Number(ring.getAttribute('r'))||84,circ=2*Math.PI*r;
    ring.style.strokeDasharray=String(circ);
    ring.style.strokeDashoffset=String(circ*(1-pct/100));
  }
}

function paintDocumentHub(){
  let hub=$('#commercialDocs');
  if(!hub){
    hub=document.createElement('section');
    hub.id='commercialDocs';
    hub.className='grid g-2';
    $('#content').appendChild(hub);
  }
  const est=ESTIMATES.slice(0,8);
  const prop=PROPOSALS.slice(0,8);
  hub.innerHTML=`
    <article class="card tbl-card">
      <div class="card__head" style="padding:0">
        <div><span class="card__title">Estimates</span><div class="card__sub">Preliminary commercial working</div></div>
      </div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>No.</th><th>Title</th><th>Status</th><th class="r">Total</th></tr></thead>
      <tbody>${est.length?est.map(x=>`<tr data-est="${x.id}"><td class="mono">${esc(x.estimate_no||'DRAFT')}</td><td>${esc(x.title)}</td><td>${esc(x.status)}</td><td class="r mono">${rupees(x.total)}</td></tr>`).join(''):'<tr><td colspan="4">No estimates yet. Create one from a lead.</td></tr>'}</tbody></table></div>
    </article>
    <article class="card tbl-card">
      <div class="card__head" style="padding:0">
        <div><span class="card__title">Proposals</span><div class="card__sub">Client-facing commercial documents</div></div>
      </div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>No.</th><th>Title</th><th>Status</th><th class="r">Value</th></tr></thead>
      <tbody>${prop.length?prop.map(x=>`<tr data-prop="${x.id}"><td class="mono">${esc(x.proposal_no||'DRAFT')}</td><td>${esc(x.title)}</td><td>${esc(x.status)}</td><td class="r mono">${rupees(x.grand_total)}</td></tr>`).join(''):'<tr><td colspan="4">No proposals yet. Create one from a lead or estimate.</td></tr>'}</tbody></table></div>
    </article>`;
}

document.addEventListener('click',e=>{
  const er=e.target.closest('[data-est]');if(er)location.href='/estimate.html?id='+er.dataset.est;
  const pr=e.target.closest('[data-prop]');if(pr)location.href='/proposal.html?id='+pr.dataset.prop;
});

$('#exportBtn')?.addEventListener('click',()=>{
  const rows=[['Type','Number','Title','Status','Value']]
    .concat(ESTIMATES.map(x=>['Estimate',x.estimate_no||'DRAFT',x.title,x.status,x.total]))
    .concat(PROPOSALS.map(x=>['Proposal',x.proposal_no||'DRAFT',x.title,x.status,x.grand_total]));
  const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='bindbuild-commercials-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);
  toast('Commercial documents exported');
});

const head=$('.page-head__title');
if(head)head.textContent='Sales & Commercials';
const sub=$('.page-head__sub');
if(sub)sub.textContent='Live CRM → Estimate → Proposal workflow';
$('.page-head__acts .seg')?.remove();
const newDeal=$('.page-head__acts .btn-new');
if(newDeal){newDeal.href='/crm.html';newDeal.textContent='＋ New lead';}

await load();
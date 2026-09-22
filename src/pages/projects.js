import { supabase } from '../lib/supabase.js';
import { mountShell, activeUnit, scopeToUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user=await mountShell({route:'projects',title:'Projects'});
if(!user)throw new Error('redirecting');

const money=v=>{
  const n=Number(v)||0;
  if(Math.abs(n)>=1e7)return '₹'+(n/1e7).toFixed(2).replace(/\.00$/,'')+'Cr';
  if(Math.abs(n)>=1e5)return '₹'+(n/1e5).toFixed(1).replace(/\.0$/,'')+'L';
  return '₹'+Math.round(n).toLocaleString('en-IN');
};
const HEALTH_LABEL={ontrack:'On track',atrisk:'At risk',critical:'Critical',hold:'On hold'};
const PIN='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';

let PROJECTS=[],CLIENTS=new Map(),RECEIVED=new Map(),BILLED=new Map();
let filterHealth='',filterType='',sortBy='progress-desc';

async function load(){
  try{
    const [pRes,cRes,rRes,iRes,piRes]=await Promise.all([
      scopeToUnit(supabase.from('projects').select('*').is('deleted_at',null)).order('updated_at',{ascending:false}),
      scopeToUnit(supabase.from('clients').select('id,name').is('deleted_at',null)),
      scopeToUnit(supabase.from('receipts').select('project_id,amount,status')).eq('status','issued'),
      scopeToUnit(supabase.from('invoices').select('project_id,total,status').is('deleted_at',null)),
      scopeToUnit(supabase.from('proforma_invoices').select('project_id,total,status').is('deleted_at',null))
    ]);
    [pRes,cRes,rRes,iRes,piRes].forEach(r=>{if(r.error)throw r.error;});
    PROJECTS=pRes.data||[];
    CLIENTS=new Map((cRes.data||[]).map(x=>[x.id,x.name]));
    RECEIVED=new Map();
    (rRes.data||[]).forEach(x=>RECEIVED.set(x.project_id,(RECEIVED.get(x.project_id)||0)+Number(x.amount||0)));
    BILLED=new Map();
    [...(iRes.data||[]),...(piRes.data||[])].forEach(x=>{
      if(!x.project_id)return;
      BILLED.set(x.project_id,(BILLED.get(x.project_id)||0)+Number(x.total||0));
    });
    render();
  }catch(e){fail(e);}
}

function visible(){
  let rows=PROJECTS.slice();
  if(filterHealth)rows=rows.filter(p=>filterHealth==='critical'?p.health==='critical':p.health===filterHealth);
  if(filterType)rows=rows.filter(p=>String(p.service_type||'').toLowerCase().includes(filterType.toLowerCase()));
  const sorters={
    'progress-desc':(a,b)=>Number(b.progress_pct)-Number(a.progress_pct),
    'progress-asc':(a,b)=>Number(a.progress_pct)-Number(b.progress_pct),
    'value-desc':(a,b)=>Number(b.contract_value)-Number(a.contract_value),
    'value-asc':(a,b)=>Number(a.contract_value)-Number(b.contract_value),
    'name-asc':(a,b)=>String(a.name).localeCompare(String(b.name))
  };
  return rows.sort(sorters[sortBy]||sorters['progress-desc']);
}

function cardHTML(p){
  const received=RECEIVED.get(p.id)||0;
  const billed=BILLED.get(p.id)||0;
  const contract=Number(p.contract_value||0);
  const collectionPct=contract?Math.min(100,Math.round(received/contract*100)):0;
  const health=p.health||'ontrack';
  return `<article class="pcard" data-id="${p.id}" tabindex="0" role="button">
    <div class="pcard__cover res">
      <span class="pcard__type">${esc(p.service_type||'Project')}</span>
      <span class="pcard__code">${esc(p.project_no||p.code||'—')}</span>
    </div>
    <div class="pcard__body">
      <div class="pcard__top">
        <div style="min-width:0">
          <div class="pcard__name">${esc(p.name)}</div>
          <div class="pcard__client">${esc(CLIENTS.get(p.client_id)||'Client not linked')}</div>
          <div class="pcard__loc">${PIN}${esc(p.location||'—')}</div>
        </div>
        <span class="health ${health}"><span class="hd"></span>${esc(HEALTH_LABEL[health]||health)}</span>
      </div>
      <div class="pcard__metrics">
        <div>
          <div class="metric__row"><span>Execution progress</span><b>${Number(p.progress_pct||0)}%</b></div>
          <div class="bar"><div class="bar__fill prog" data-w="${Number(p.progress_pct||0)}"></div></div>
        </div>
        <div>
          <div class="metric__row"><span>Collections</span><b>${money(received)} / ${money(contract)}</b></div>
          <div class="bar"><div class="bar__fill ok" data-w="${collectionPct}"></div></div>
        </div>
      </div>
      <div class="pcard__foot">
        <div class="milestone">
          <div class="milestone__lbl">Commercial position</div>
          <div class="milestone__val">Billed ${money(billed)}</div>
          <div class="milestone__date">${p.target_end_date?'Target '+fmtDate(p.target_end_date):'Target end not set'}</div>
        </div>
        <span class="pm" title="Status">${esc(String(p.status||'planning').slice(0,2).toUpperCase())}</span>
      </div>
    </div>
  </article>`;
}

function render(){
  const rows=visible();
  $('#pgrid').innerHTML=rows.map(cardHTML).join('');
  $('#empty').hidden=rows.length>0;
  requestAnimationFrame(()=>$$('#pgrid .bar__fill').forEach(x=>x.style.width=x.dataset.w+'%'));

  const live=PROJECTS.filter(p=>!['completed','cancelled'].includes(p.status));
  $('#stTotal').textContent=String(live.length);
  $('#stValue').textContent=money(live.reduce((a,p)=>a+Number(p.contract_value||0),0));
  $('#stHealthy').textContent=String(live.filter(p=>p.health==='ontrack').length);
  $('#stAttention').textContent=String(live.filter(p=>['atrisk','critical','hold'].includes(p.health)).length);

  const sub=$('.page-head__sub');
  if(sub)sub.textContent='Accepted proposals become numbered projects here · live ERP data';
}

$('#healthSeg')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-health]');if(!b)return;
  filterHealth=b.dataset.health==='all'?'':(b.dataset.health==='delayed'?'critical':b.dataset.health);
  $$('#healthSeg button').forEach(x=>x.classList.toggle('on',x===b));
  render();
});
$('#typeChips')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-type]');if(!b)return;
  filterType=b.dataset.type==='all'?'':b.dataset.type;
  $$('#typeChips button').forEach(x=>x.classList.toggle('on',x===b));
  render();
});
$('#sortSel')?.addEventListener('change',e=>{sortBy=e.target.value;render();});
$('#gridBtn')?.addEventListener('click',()=>{$('#pgrid').classList.remove('is-list');$('#gridBtn').classList.add('on');$('#listBtn').classList.remove('on');});
$('#listBtn')?.addEventListener('click',()=>{$('#pgrid').classList.add('is-list');$('#listBtn').classList.add('on');$('#gridBtn').classList.remove('on');});
document.addEventListener('click',e=>{const card=e.target.closest('.pcard[data-id]');if(card)location.href='/project.html?id='+card.dataset.id;});
document.addEventListener('keydown',e=>{if(e.key==='Enter'){const card=e.target.closest?.('.pcard[data-id]');if(card)location.href='/project.html?id='+card.dataset.id;}});

$('#pgNewBtn')?.addEventListener('click',()=>toast('Projects are created from accepted proposals so client, contract value and numbering stay linked.'));
$('#exportBtn')?.addEventListener('click',()=>{
  const rows=[['Project','Name','Client','Service','Location','Contract value','Collected','Progress','Health','Status']]
    .concat(visible().map(p=>[p.project_no||p.code,p.name,CLIENTS.get(p.client_id)||'',p.service_type||'',p.location||'',p.contract_value,RECEIVED.get(p.id)||0,p.progress_pct,p.health,p.status]));
  const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='bindbuild-projects-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);
  toast('Projects exported');
});

await load();
import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'projects',title:'Project'});
if(!user)throw new Error('redirecting');

const projectId=new URLSearchParams(location.search).get('id');
const money=v=>{
  const n=Number(v)||0;
  if(Math.abs(n)>=1e7)return '₹'+(n/1e7).toFixed(2).replace(/\.00$/,'')+' Cr';
  if(Math.abs(n)>=1e5)return '₹'+(n/1e5).toFixed(1).replace(/\.0$/,'')+' L';
  return '₹'+Math.round(n).toLocaleString('en-IN');
};

let P=null,CLIENT=null,PROPOSAL=null,PROFORMAS=[],INVOICES=[],RECEIPTS=[],TASKS=[];

async function load(){
  try{
    if(!projectId)throw new Error('Open a project from Projects.');
    const pRes=await supabase.from('projects').select('*').eq('id',projectId).is('deleted_at',null).maybeSingle();
    if(pRes.error)throw pRes.error;if(!pRes.data)throw new Error('Project not found');
    P=pRes.data;

    const [cRes,propRes,piRes,invRes,recRes,tRes]=await Promise.all([
      P.client_id?supabase.from('clients').select('*').eq('id',P.client_id).maybeSingle():Promise.resolve({data:null}),
      P.proposal_id?supabase.from('proposals').select('*').eq('id',P.proposal_id).maybeSingle():Promise.resolve({data:null}),
      supabase.from('proforma_invoices').select('*').eq('project_id',projectId).is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('invoices').select('*').eq('project_id',projectId).is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('receipts').select('*').eq('project_id',projectId).eq('status','issued').order('receipt_date',{ascending:false}),
      supabase.from('tasks').select('*').eq('project_id',projectId).order('due_at',{ascending:true})
    ]);
    [cRes,propRes,piRes,invRes,recRes,tRes].forEach(r=>{if(r.error)throw r.error;});
    CLIENT=cRes.data;PROPOSAL=propRes.data;PROFORMAS=piRes.data||[];INVOICES=invRes.data||[];RECEIPTS=recRes.data||[];TASKS=tRes.data||[];
    paint();
  }catch(e){fail(e);}
}

function paint(){
  const received=RECEIPTS.reduce((a,r)=>a+Number(r.amount||0),0);
  const billed=INVOICES.reduce((a,r)=>a+Number(r.total||0),0);
  const provisional=PROFORMAS.reduce((a,r)=>a+Number(r.total||0),0);
  const contract=Number(P.contract_value||0);
  const outstanding=Math.max(contract-received,0);

  const content=$('#content');
  content.innerHTML=`
    <section class="hero">
      <div class="hero__cover"></div>
      <div class="hero__body">
        <div class="hero__top">
          <div class="hero__badge">BB</div>
          <div class="hero__id">
            <h1 class="hero__name">${esc(P.name)}</h1>
            <div class="hero__meta">
              <span class="mi">${esc(CLIENT?.name||'Client not linked')}</span><span class="dotsep"></span>
              <span class="mi">${esc(P.project_no||P.code||'—')}</span><span class="dotsep"></span>
              <span class="mi">${esc(P.service_type||'Project')}</span><span class="dotsep"></span>
              <span class="mi">${esc(P.location||'—')}</span>
            </div>
          </div>
          <div class="hero__acts">
            <span class="health ${esc(P.health||'ontrack')}"><span class="hd"></span>${esc(P.health||'ontrack')}</span>
            <button class="btn-ghost" id="clientBtn">Client</button>
            <button class="btn-ghost" id="proposalBtn">Proposal</button>
            <button class="btn-ghost" id="designBtn">Design & Pre-construction</button>
            <button class="btn-new" id="newPiBtn">Create proforma</button>
          </div>
        </div>
        <div class="hero__kpis">
          <div class="hkpi"><div class="hkpi__lbl">Contract value</div><div class="hkpi__val">${money(contract)}</div><div class="hkpi__sub">Accepted proposal</div></div>
          <div class="hkpi"><div class="hkpi__lbl">Progress</div><div class="hkpi__val">${Number(P.progress_pct||0)}%</div><div class="hkpi__bar"><div class="hkpi__fill a" style="width:${Number(P.progress_pct||0)}%"></div></div></div>
          <div class="hkpi"><div class="hkpi__lbl">Collected</div><div class="hkpi__val">${money(received)}</div><div class="hkpi__sub">${contract?Math.round(received/contract*100):0}% of contract</div></div>
          <div class="hkpi"><div class="hkpi__lbl">Outstanding</div><div class="hkpi__val">${money(outstanding)}</div><div class="hkpi__sub">${P.target_end_date?'Target '+fmtDate(P.target_end_date):'Target end not set'}</div></div>
        </div>
      </div>
    </section>

    <div class="layout">
      <div class="stack">
        <section class="card card__pad">
          <div class="sec-title"><div><span class="card__title">Commercial ledger</span><div class="card__sub">Proforma → receipt → GST invoice</div></div></div>
          <div style="overflow:auto"><table style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left;padding:10px">Document</th><th style="text-align:left;padding:10px">Status</th><th style="text-align:right;padding:10px">Total</th><th style="text-align:right;padding:10px">Paid</th><th></th></tr></thead>
            <tbody>
              ${PROFORMAS.map(x=>`<tr><td style="padding:10px"><b>${esc(x.proforma_no||'DRAFT PI')}</b><br><small>${esc(x.milestone_name||x.title)}</small></td><td style="padding:10px">${esc(x.status)}</td><td style="padding:10px;text-align:right">${money(x.total)}</td><td style="padding:10px;text-align:right">${money(x.amount_paid)}</td><td style="padding:10px;text-align:right"><button class="btn-ghost" data-pi="${x.id}">Open</button></td></tr>`).join('')}
              ${INVOICES.map(x=>`<tr><td style="padding:10px"><b>${esc(x.invoice_no||'DRAFT INV')}</b><br><small>${esc(x.milestone_name||'Tax invoice')}</small></td><td style="padding:10px">${esc(x.status)}</td><td style="padding:10px;text-align:right">${money(x.total)}</td><td style="padding:10px;text-align:right">${money(x.amount_paid)}</td><td style="padding:10px;text-align:right"><button class="btn-ghost" data-inv="${x.id}">Open</button></td></tr>`).join('')}
              ${!PROFORMAS.length&&!INVOICES.length?'<tr><td colspan="5" style="padding:18px;color:var(--text-3)">No billing documents yet.</td></tr>':''}
            </tbody>
          </table></div>
        </section>

        <section class="card card__pad">
          <div class="sec-title"><div><span class="card__title">Receipts</span><div class="card__sub">Actual money received</div></div></div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${RECEIPTS.length?RECEIPTS.map(r=>`<button class="btn-ghost" data-rec="${r.id}" style="justify-content:space-between"><span>${esc(r.receipt_no)} · ${fmtDate(r.receipt_date)}</span><b>${money(r.amount)}</b></button>`).join(''):'<p style="color:var(--text-3)">No receipts yet.</p>'}
          </div>
        </section>

        <section class="card card__pad">
          <div class="sec-title"><div><span class="card__title">Open tasks</span><div class="card__sub">Execution queue linked to this project</div></div></div>
          <div style="display:flex;flex-direction:column;gap:9px">
            ${TASKS.filter(t=>!['done','cancelled'].includes(t.status)).length?TASKS.filter(t=>!['done','cancelled'].includes(t.status)).map(t=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--hairline)"><span>${esc(t.title)}</span><small>${t.due_at?fmtDate(t.due_at):'No due date'}</small></div>`).join(''):'<p style="color:var(--text-3)">No open tasks.</p>'}
          </div>
        </section>
      </div>

      <aside class="rail">
        <section class="card card__pad">
          <div class="card__title">Project state</div>
          <div class="kv"><span class="kv__k">Status</span><span class="kv__v">${esc(P.status)}</span></div>
          <div class="kv"><span class="kv__k">Health</span><span class="kv__v">${esc(P.health)}</span></div>
          <div class="kv"><span class="kv__k">Started</span><span class="kv__v">${P.start_date?fmtDate(P.start_date):'—'}</span></div>
          <div class="kv"><span class="kv__k">Billed</span><span class="kv__v">${money(billed)}</span></div>
          <div class="kv"><span class="kv__k">Proforma</span><span class="kv__v">${money(provisional)}</span></div>
        </section>
      </aside>
    </div>`;

  $('#clientBtn')?.addEventListener('click',()=>CLIENT?.id?location.href='/client.html?id='+CLIENT.id:toast('No client linked','err'));
  $('#proposalBtn')?.addEventListener('click',()=>P.proposal_id?location.href='/proposal.html?id='+P.proposal_id:toast('No proposal linked','err'));
  $('#designBtn')?.addEventListener('click',()=>location.href='/design.html?project='+P.id);
  $('#newPiBtn')?.addEventListener('click',()=>location.href='/proforma.html?project='+P.id);
  document.querySelectorAll('[data-pi]').forEach(b=>b.addEventListener('click',()=>location.href='/proforma.html?id='+b.dataset.pi));
  document.querySelectorAll('[data-inv]').forEach(b=>b.addEventListener('click',()=>location.href='/invoice.html?id='+b.dataset.inv));
  document.querySelectorAll('[data-rec]').forEach(b=>b.addEventListener('click',()=>location.href='/receipt.html?id='+b.dataset.rec));

  document.title=`${P.project_no||P.code} · ${P.name} · Bind Build ERP`;
  const here=$('.crumbs .here');if(here)here.textContent=P.project_no||P.code||'Project';
}

await load();
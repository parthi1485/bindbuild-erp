import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, initials } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'clients',title:'Clients'});
if(!user)throw new Error('redirecting');

const id=new URLSearchParams(location.search).get('id');
const money=v=>{
  const n=Number(v)||0;
  if(Math.abs(n)>=1e7)return '₹'+(n/1e7).toFixed(2).replace(/\.00$/,'')+' Cr';
  if(Math.abs(n)>=1e5)return '₹'+(n/1e5).toFixed(1).replace(/\.0$/,'')+' L';
  return '₹'+Math.round(n).toLocaleString('en-IN');
};

let CLIENTS=[],CLIENT=null,PROJECTS=[],INVOICES=[],PROFORMAS=[],RECEIPTS=[];

async function load(){
  try{
    const cRes=await scopeToUnit(supabase.from('clients').select('*').is('deleted_at',null)).order('created_at',{ascending:false});
    if(cRes.error)throw cRes.error;
    CLIENTS=cRes.data||[];
    if(!id)return paintList();

    CLIENT=CLIENTS.find(x=>x.id===id);
    if(!CLIENT){
      const one=await supabase.from('clients').select('*').eq('id',id).is('deleted_at',null).maybeSingle();
      if(one.error)throw one.error;CLIENT=one.data;
    }
    if(!CLIENT)throw new Error('Client not found');

    const [p,i,pi,r]=await Promise.all([
      supabase.from('projects').select('*').eq('client_id',id).is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('invoices').select('*').eq('client_id',id).is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('proforma_invoices').select('*').eq('client_id',id).is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('receipts').select('*').eq('client_id',id).eq('status','issued').order('receipt_date',{ascending:false})
    ]);
    [p,i,pi,r].forEach(x=>{if(x.error)throw x.error;});
    PROJECTS=p.data||[];INVOICES=i.data||[];PROFORMAS=pi.data||[];RECEIPTS=r.data||[];
    paintProfile();
  }catch(e){fail(e);}
}

function paintList(){
  $('#profile').hidden=true;$('#clientList').hidden=false;$('#listBtn').hidden=true;$('#editBtn').hidden=true;
  $('#pageTitle').textContent='Clients';
  $('#pageSub').textContent=CLIENTS.length+' converted client'+(CLIENTS.length===1?'':'s');
  $('#clientList').innerHTML=CLIENTS.length?CLIENTS.map(c=>`
    <article class="card" data-client="${c.id}" style="padding:var(--s-5);cursor:pointer">
      <div style="display:flex;gap:12px;align-items:center">
        <div class="avatar">${esc(initials(c.name))}</div>
        <div><h2 style="font-family:var(--font-display);font-size:17px">${esc(c.name)}</h2><p style="color:var(--text-3);margin-top:3px">${esc([c.city,c.phone].filter(Boolean).join(' · ')||'No contact details')}</p></div>
      </div>
      <div style="margin-top:16px;color:var(--text-2);font-size:13px">${c.gstin?'GSTIN '+esc(c.gstin):'GSTIN not set'}</div>
    </article>`).join(''):'<div class="card" style="padding:24px;color:var(--text-3)">No clients yet. A client is created when an issued proposal is accepted.</div>';
  document.body.classList.add('loaded');
}

function paintProfile(){
  $('#clientList').hidden=true;$('#profile').hidden=false;$('#listBtn').hidden=false;$('#editBtn').hidden=false;
  $('#pageTitle').textContent=CLIENT.name;
  $('#pageSub').textContent='Client since '+fmtDate(CLIENT.created_at);
  $('#clientAvatar').textContent=initials(CLIENT.name);
  $('#clientName').textContent=CLIENT.name;
  $('#clientMeta').textContent=[CLIENT.city,CLIENT.state,CLIENT.gstin?'GST registered':'GST not set'].filter(Boolean).join(' · ');
  $('#phone').textContent=CLIENT.phone?'+91 '+CLIENT.phone:'—';
  $('#email').textContent=CLIENT.email||'—';
  $('#address').textContent=CLIENT.address||'—';
  $('#state').textContent=[CLIENT.state,CLIENT.state_code?'('+CLIENT.state_code+')':null].filter(Boolean).join(' ')||'—';
  $('#gstin').textContent=CLIENT.gstin||'—';
  $('#pan').textContent=CLIENT.pan||'—';

  $('#projects').innerHTML=PROJECTS.length?PROJECTS.map(p=>`<button class="btn-ghost" data-project="${p.id}" style="width:100%;justify-content:space-between;margin-top:8px"><span>${esc(p.project_no||p.code)} · ${esc(p.name)}</span><span>${Number(p.progress_pct||0)}%</span></button>`).join(''):'<p style="color:var(--text-3)">No projects linked.</p>';

  const converted=new Set(INVOICES.map(x=>x.proforma_id).filter(Boolean));
  const rows=[
    ...INVOICES.map(x=>({type:'GST Invoice',id:x.id,no:x.invoice_no,status:x.status,total:x.total,paid:x.amount_paid,href:'/invoice.html?id='+x.id})),
    ...PROFORMAS.filter(x=>!converted.has(x.id)).map(x=>({type:'Proforma',id:x.id,no:x.proforma_no||'DRAFT',status:x.status,total:x.total,paid:x.amount_paid,href:'/proforma.html?id='+x.id}))
  ];
  $('#ledger').innerHTML=rows.length?`<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:9px">Document</th><th style="text-align:left;padding:9px">Status</th><th style="text-align:right;padding:9px">Total</th><th style="text-align:right;padding:9px">Paid</th></tr></thead><tbody>${rows.map(x=>`<tr data-doc="${esc(x.href)}" style="cursor:pointer"><td style="padding:9px"><b>${esc(x.no||'—')}</b><br><small>${esc(x.type)}</small></td><td style="padding:9px">${esc(x.status)}</td><td style="padding:9px;text-align:right">${money(x.total)}</td><td style="padding:9px;text-align:right">${money(x.paid)}</td></tr>`).join('')}</tbody></table>`:'<p style="color:var(--text-3)">No commercial documents yet.</p>';

  const collected=RECEIPTS.reduce((a,x)=>a+Number(x.amount||0),0);
  const contract=PROJECTS.reduce((a,x)=>a+Number(x.contract_value||0),0);
  $('#collected').textContent=money(collected);
  $('#outstanding').textContent=contract?money(Math.max(contract-collected,0))+' remaining against project contract value':'No project contract value yet';

  $('#listBtn').onclick=()=>location.href='/client.html';
  $('#editBtn').onclick=editBilling;
  document.addEventListener('click',e=>{
    const p=e.target.closest('[data-project]');if(p)location.href='/project.html?id='+p.dataset.project;
    const d=e.target.closest('[data-doc]');if(d)location.href=d.dataset.doc;
  });
  document.body.classList.add('loaded');
  document.title=CLIENT.name+' · Bind Build ERP';
}

async function editBilling(){
  const address=prompt('Billing address',CLIENT.address||'');if(address===null)return;
  const city=prompt('City',CLIENT.city||'Chennai');if(city===null)return;
  const state=prompt('State',CLIENT.state||'Tamil Nadu');if(state===null)return;
  const stateCode=prompt('GST state code',CLIENT.state_code||'33');if(stateCode===null)return;
  const gstin=prompt('GSTIN (leave blank if unregistered)',CLIENT.gstin||'');if(gstin===null)return;
  const pan=prompt('PAN (optional)',CLIENT.pan||'');if(pan===null)return;
  const {data,error}=await supabase.from('clients').update({
    address:address||null,city:city||null,state:state||null,state_code:stateCode||null,
    gstin:gstin||null,pan:pan||null
  }).eq('id',CLIENT.id).select('*').single();
  if(error)return fail(error);
  CLIENT=data;paintProfile();toast('Client billing details updated');
}

document.addEventListener('click',e=>{const c=e.target.closest('[data-client]');if(c)location.href='/client.html?id='+c.dataset.client;});
await load();
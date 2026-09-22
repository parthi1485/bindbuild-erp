import { supabase } from '../lib/supabase.js';
import { mountShell, activeUnit } from '../lib/shell.js';
import { issueDocumentNumber } from '../lib/numbering.js';
import { toast, fail, esc, fmtDate, openModal, closeAllModals, wireModalDismiss, val, setVal } from '../lib/ui.js';

const $ = (s,c=document)=>c.querySelector(s);
const $$ = (s,c=document)=>[...c.querySelectorAll(s)];

const user = await mountShell({route:'sales',title:'Proposal'});
if(!user) throw new Error('redirecting');

const qs=new URLSearchParams(location.search);
const proposalId=qs.get('id');
const leadParam=qs.get('lead');

let PROPOSAL=null;
let LEAD=null;
let LEADS=[];
let ITEMS=[];
let SCOPE=[];
let SCHEDULE=[];
let dirty=false;
let saveTimer=null;

const today=new Date();
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
const inr=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');
const money=v=>{
  const n=Number(v)||0;
  if(Math.abs(n)>=1e7)return '₹'+(n/1e7).toFixed(2).replace(/\.00$/,'')+' Cr';
  if(Math.abs(n)>=1e5)return '₹'+(n/1e5).toFixed(2).replace(/\.00$/,'')+' L';
  return inr(n);
};

function totals(){
  const sub=ITEMS.reduce((a,it)=>a+Number(it.q||0)*Number(it.r||0),0);
  const discountPct=Number($('#tDiscIn')?.value||0);
  const discount=sub*discountPct/100;
  const taxable=Math.max(sub-discount,0);
  const taxRate=Number(PROPOSAL?.tax_rate ?? 18);
  const gst=taxable*taxRate/100;
  return {sub,discountPct,discount,taxable,taxRate,gst,grand:taxable+gst};
}

function calc(){
  const t=totals();
  $('#tSub').textContent=money(t.sub);
  $('#tDisc').textContent='− '+money(t.discount);
  $('#tTaxable').textContent=money(t.taxable);
  $('#tGst').textContent=money(t.gst);
  $('#tGrand').textContent=money(t.grand);
  $('#tRate').textContent=LEAD?.area||LEAD?.city||'';
  $$('[data-amt]').forEach(el=>{
    const i=Number(el.dataset.amt);
    el.textContent=inr((ITEMS[i]?.q||0)*(ITEMS[i]?.r||0));
  });
  $$('[data-schamt]').forEach(el=>{
    const pct=Number(el.dataset.schamt||0);
    el.textContent=money(t.grand*pct/100);
  });
}

function renderItems(){
  const body=$('#feeBody');
  body.innerHTML=ITEMS.map((it,i)=>`<tr>
    <td><input class="in in--desc" value="${esc(it.d||'')}" data-f="d" data-i="${i}" />
      <div class="sub"><input class="in" value="${esc(it.category||'')}" data-f="category" data-i="${i}" placeholder="Category / detail" /></div></td>
    <td class="r"><input class="in in--num" type="number" min="0" step="0.001" value="${it.q}" data-f="q" data-i="${i}" /></td>
    <td><input class="in" value="${esc(it.u||'LS')}" data-f="u" data-i="${i}" /></td>
    <td class="r"><input class="in in--num" type="number" min="0" step="0.01" value="${it.r}" data-f="r" data-i="${i}" /></td>
    <td class="r"><span class="amt" data-amt="${i}">${inr(it.q*it.r)}</span></td>
    <td><button class="rm" data-rm="${i}" aria-label="Remove item">×</button></td>
  </tr>`).join('');
  $('#feeCount').textContent=ITEMS.length+' item'+(ITEMS.length===1?'':'s');
  calc();
}

function renderScope(){
  const host=$('#scopeList');
  host.innerHTML=SCOPE.length?SCOPE.map((s,i)=>`
    <div class="scope">
      <span>✓</span>
      <input value="${esc(s)}" data-scope="${i}" />
      <button class="scope__x" data-rmscope="${i}" aria-label="Remove">×</button>
    </div>`).join(''):'<div class="scope"><span>—</span><input value="" placeholder="Add scope item" data-scope="0" /></div>';
}

function renderSchedule(){
  const host=$('#schList');
  if(!SCHEDULE.length)SCHEDULE=[
    {name:'Design / mobilisation advance',pct:10},
    {name:'Agreement / pre-construction',pct:10},
    {name:'Construction milestones',pct:75},
    {name:'Handover / close-out',pct:5}
  ];
  host.innerHTML=SCHEDULE.map((s,i)=>`
    <div class="sch">
      <input type="text" value="${esc(s.name||'')}" data-schname="${i}" />
      <span class="pct"><input type="number" min="0" max="100" step="1" value="${Number(s.pct||0)}" data-schpct="${i}" /></span>
      <span class="val" data-schamt="${Number(s.pct||0)}">—</span>
      <button class="rm" data-rmsch="${i}" aria-label="Remove">×</button>
    </div>`).join('');
  const sum=SCHEDULE.reduce((a,s)=>a+Number(s.pct||0),0);
  $('#schBadge').textContent=sum+'%';
  $('#schBadge').classList.toggle('ok',Math.round(sum)===100);
  $('#schBadge').classList.toggle('bad',Math.round(sum)!==100);
  calc();
}

function markDirty(){
  dirty=true;
  $('#autosaveTxt').textContent='Unsaved changes';
  $('#autosave')?.classList.add('saving');
  clearTimeout(saveTimer);
  saveTimer=setTimeout(save,900);
}

async function loadLeads(){
  const {data,error}=await supabase.from('leads')
    .select('id,lead_no,name,phone,email,area,city,service,expected_value,business_unit_id')
    .is('deleted_at',null).order('updated_at',{ascending:false});
  if(error)throw error;
  LEADS=data||[];
  $('#dClient').innerHTML='<option value="">Select lead</option>'+LEADS.map(l=>`
    <option value="${l.id}">${esc(l.lead_no||'')} · ${esc(l.name)}</option>`).join('');
}

async function createDraftFromLead(leadId){
  LEAD=LEADS.find(l=>l.id===leadId)||null;
  if(!LEAD)throw new Error('Lead not found');
  const {data,error}=await supabase.from('proposals').insert({
    business_unit_id:LEAD.business_unit_id||activeUnit(),
    lead_id:LEAD.id,
    title:`Project Proposal · ${LEAD.name}`,
    service:LEAD.service||null,
    status:'draft',
    subtotal:Number(LEAD.expected_value||0),
    discount:0,tax_rate:18,
    tax_amount:Number(LEAD.expected_value||0)*0.18,
    grand_total:Number(LEAD.expected_value||0)*1.18,
    valid_until:addDays(today,30),
    scope:LEAD.service||null,
    terms:'Proposal subject to final drawings, specifications, statutory approvals, site conditions and signed construction agreement.',
    payment_schedule:[
      {name:'Design / mobilisation advance',pct:10},
      {name:'Agreement / pre-construction',pct:10},
      {name:'Construction milestones',pct:75},
      {name:'Handover / close-out',pct:5}
    ]
  }).select('*').single();
  if(error)throw error;
  PROPOSAL=data;
  ITEMS=[{category:'',d:LEAD.service||'Professional / construction scope',q:1,u:'LS',r:Number(LEAD.expected_value||0)}];
  if(ITEMS[0].r>0){
    const {error:iErr}=await supabase.from('proposal_items').insert({
      proposal_id:PROPOSAL.id,sort_order:0,description:ITEMS[0].d,qty:1,unit:'LS',rate:ITEMS[0].r
    });
    if(iErr)throw iErr;
  }
  history.replaceState(null,'',`/proposal.html?id=${PROPOSAL.id}`);
}

async function load(){
  try{
    await loadLeads();
    if(proposalId){
      const {data,error}=await supabase.from('proposals').select('*').eq('id',proposalId).is('deleted_at',null).maybeSingle();
      if(error)throw error;
      if(!data)throw new Error('Proposal not found');
      PROPOSAL=data;
    }else if(leadParam){
      await createDraftFromLead(leadParam);
    }else{
      const {data}=await supabase.from('proposals').select('id').is('deleted_at',null).order('created_at',{ascending:false}).limit(1);
      if(data?.length)return location.replace('/proposal.html?id='+data[0].id);
      throw new Error('Create a proposal from a lead or estimate.');
    }

    LEAD=LEADS.find(l=>l.id===PROPOSAL.lead_id)||null;
    const {data:items,error:iErr}=await supabase.from('proposal_items').select('*').eq('proposal_id',PROPOSAL.id).order('sort_order');
    if(iErr)throw iErr;
    ITEMS=(items||[]).map(x=>({id:x.id,category:x.category||'',d:x.description,q:Number(x.qty),u:x.unit,r:Number(x.rate)}));
    if(!ITEMS.length)ITEMS=[{category:'',d:PROPOSAL.service||'Proposal item',q:1,u:'LS',r:Number(PROPOSAL.subtotal||0)}];

    SCOPE=(PROPOSAL.scope||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    SCHEDULE=Array.isArray(PROPOSAL.payment_schedule)?PROPOSAL.payment_schedule:[];
    paint();
  }catch(e){fail(e);}
}

function paint(){
  const title=PROPOSAL.title||'Project Proposal';
  $('.prop-head__title').textContent=title;
  const verChip=$('.chip--ver');
  if(verChip)verChip.textContent=PROPOSAL.proposal_no||'DRAFT';
  const clientChip=$('.chip--client');
  if(clientChip)clientChip.textContent=LEAD?.name||'Unassigned';
  $('#statusChip').textContent=(PROPOSAL.status||'draft').toUpperCase();

  $('#dClient').value=PROPOSAL.lead_id||'';
  $('#dTitle').value=title;
  $('#dArea').value=PROPOSAL.built_up_area||'';
  $('#dValid').value=PROPOSAL.valid_until||addDays(today,30);
  $('#dBy').value=user.name;
  $('#terms').value=PROPOSAL.terms||'';

  const sub=Number(PROPOSAL.subtotal||0);
  const disc=Number(PROPOSAL.discount||0);
  $('#tDiscIn').value=sub>0?Math.round((disc/sub)*10000)/100:0;

  const back=$('.back');
  if(back){
    back.href=LEAD?`/lead.html?id=${LEAD.id}`:'/sales.html';
    back.textContent=LEAD?`← Back to lead · ${LEAD.name}`:'← Back to Sales';
  }

  $('#trackViewed').innerHTML=PROPOSAL.sent_at
    ? `<span class="tdot"></span>Sent <small>· ${fmtDate(PROPOSAL.sent_at)}</small>`
    : '<span class="tdot"></span>Not sent';
  $('#trackAccepted').innerHTML=PROPOSAL.accepted_at
    ? `<span class="tdot"></span>Accepted <small>· ${fmtDate(PROPOSAL.accepted_at)}</small>`
    : '<span class="tdot"></span>Awaiting acceptance';

  renderItems();renderScope();renderSchedule();paintTimeline();
  document.title=(PROPOSAL.proposal_no||'Draft Proposal')+' · Bind Build ERP';
}

function paintTimeline(){
  const tl=$('#miniTl');
  if(!tl)return;
  const events=[
    {t:PROPOSAL.created_at,txt:'Proposal draft created'},
    PROPOSAL.sent_at?{t:PROPOSAL.sent_at,txt:'Proposal issued and sent'}:null,
    PROPOSAL.accepted_at?{t:PROPOSAL.accepted_at,txt:'Proposal accepted'}:null
  ].filter(Boolean).sort((a,b)=>new Date(b.t)-new Date(a.t));
  tl.innerHTML=events.map(e=>`<p><b>${esc(e.txt)}</b><small>${fmtDate(e.t)}</small></p>`).join('');
}

async function save(){
  if(!dirty||!PROPOSAL)return;
  const t=totals();
  $('#autosaveTxt').textContent='Saving…';
  const sum=SCHEDULE.reduce((a,s)=>a+Number(s.pct||0),0);
  if(Math.round(sum)!==100){
    $('#autosaveTxt').textContent='Payment schedule must total 100%';
    return toast('Payment schedule must total 100%','err');
  }

  const leadId=$('#dClient').value||null;
  const lead=LEADS.find(l=>l.id===leadId)||null;
  const payload={
    lead_id:leadId,
    business_unit_id:lead?.business_unit_id||PROPOSAL.business_unit_id||activeUnit(),
    title:$('#dTitle').value.trim()||'Project Proposal',
    service:lead?.service||PROPOSAL.service||null,
    built_up_area:Number($('#dArea').value||0)||null,
    valid_until:$('#dValid').value||null,
    scope:SCOPE.join('\n')||null,
    terms:$('#terms').value.trim()||null,
    payment_schedule:SCHEDULE,
    subtotal:t.sub,discount:t.discount,tax_rate:t.taxRate,tax_amount:t.gst,grand_total:t.grand
  };
  const {error}=await supabase.from('proposals').update(payload).eq('id',PROPOSAL.id);
  if(error)return fail(error);

  const del=await supabase.from('proposal_items').delete().eq('proposal_id',PROPOSAL.id);
  if(del.error)return fail(del.error);
  if(ITEMS.length){
    const {error:iErr}=await supabase.from('proposal_items').insert(ITEMS.map((it,i)=>({
      proposal_id:PROPOSAL.id,sort_order:i,category:it.category||null,
      description:it.d||'Proposal item',qty:Number(it.q||0),unit:it.u||'LS',rate:Number(it.r||0)
    })));
    if(iErr)return fail(iErr);
  }

  PROPOSAL={...PROPOSAL,...payload};
  LEAD=lead;
  dirty=false;
  $('#autosaveTxt').textContent='All changes saved';
  $('#autosave')?.classList.remove('saving');
  paint();
}

async function issueAndSend(){
  if(dirty)await save();
  const t=totals();
  if(!PROPOSAL.proposal_no){
    let no;
    try{
      no=await issueDocumentNumber('proposal',{
        issueDate:today,leadId:PROPOSAL.lead_id,clientId:PROPOSAL.client_id,
        amount:t.grand,status:'sent',metadata:{proposal_id:PROPOSAL.id,title:PROPOSAL.title}
      });
    }catch(e){return fail(e);}
    PROPOSAL.proposal_no=no;
  }

  const sentAt=new Date().toISOString();
  const {error}=await supabase.from('proposals').update({
    proposal_no:PROPOSAL.proposal_no,status:'sent',sent_at:sentAt
  }).eq('id',PROPOSAL.id);
  if(error)return fail(error);

  PROPOSAL.status='sent';PROPOSAL.sent_at=sentAt;
  if(PROPOSAL.lead_id)await supabase.from('leads').update({stage:'proposal'}).eq('id',PROPOSAL.lead_id);
  paint();
  toast(`Proposal ${PROPOSAL.proposal_no} issued`);
}

function buildPreview(){
  const t=totals();
  const paper=$('#paper');
  if(!paper)return;
  paper.innerHTML=`
    <div class="paper__mast">
      <div class="paper__logo">BIND BUILDS<small>ARCHITECT-LED CONSTRUCTION</small></div>
      <div class="paper__no">${esc(PROPOSAL.proposal_no||'DRAFT')}<br>${new Date().toLocaleDateString('en-IN')}</div>
    </div>
    <h3>${esc(PROPOSAL.title||'Project Proposal')}</h3>
    <p><b>Client:</b> ${esc(LEAD?.name||'—')}<br><b>Location:</b> ${esc(LEAD?.area||LEAD?.city||'—')}</p>
    <h3>Scope</h3>
    <ul>${SCOPE.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
    <h3>Commercials</h3>
    <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
    <tbody>${ITEMS.map(it=>`<tr><td>${esc(it.d)}</td><td class="r">${it.q} ${esc(it.u)}</td><td class="r">${inr(it.r)}</td><td class="r">${inr(it.q*it.r)}</td></tr>`).join('')}
    <tr class="grand"><td colspan="3" class="r">Grand total</td><td class="r">${money(t.grand)}</td></tr></tbody></table>
    <h3>Payment schedule</h3>
    <ul>${SCHEDULE.map(s=>`<li>${esc(s.name)} — ${Number(s.pct)}%</li>`).join('')}</ul>
    <h3>Terms</h3><p>${esc($('#terms').value).replaceAll('\n','<br>')}</p>`;
}

function openSend(){
  setVal('sendMsg',`Hello ${LEAD?.name||'there'},\n\nPlease find our proposal ${PROPOSAL.proposal_no||''}. Happy to walk you through the scope, commercials and payment milestones.\n\n${user.name}\nBind Builds`);
  if(!openModal('sendModal'))issueAndSend();
}

wireModalDismiss();

$('#feeBody').addEventListener('input',e=>{
  const i=Number(e.target.dataset.i),f=e.target.dataset.f;
  if(!Number.isFinite(i)||!f)return;
  ITEMS[i][f]=['q','r'].includes(f)?Number(e.target.value||0):e.target.value;
  calc();markDirty();
});
$('#feeBody').addEventListener('click',e=>{
  const rm=e.target.closest('[data-rm]');if(!rm)return;
  ITEMS.splice(Number(rm.dataset.rm),1);renderItems();markDirty();
});
$('#addItem').addEventListener('click',()=>{
  ITEMS.push({category:'',d:'New line item',q:1,u:'LS',r:0});renderItems();markDirty();
});
$('#scopeList').addEventListener('input',e=>{
  const i=Number(e.target.dataset.scope);if(!Number.isFinite(i))return;
  SCOPE[i]=e.target.value;markDirty();
});
$('#scopeList').addEventListener('click',e=>{
  const rm=e.target.closest('[data-rmscope]');if(!rm)return;
  SCOPE.splice(Number(rm.dataset.rmscope),1);renderScope();markDirty();
});
$('#addScope').addEventListener('click',()=>{SCOPE.push('New scope item');renderScope();markDirty();});

$('#schList').addEventListener('input',e=>{
  if(e.target.dataset.schname!==undefined){
    SCHEDULE[Number(e.target.dataset.schname)].name=e.target.value;
  }
  if(e.target.dataset.schpct!==undefined){
    SCHEDULE[Number(e.target.dataset.schpct)].pct=Number(e.target.value||0);
  }
  renderSchedule();markDirty();
});
$('#schList').addEventListener('click',e=>{
  const rm=e.target.closest('[data-rmsch]');if(!rm)return;
  SCHEDULE.splice(Number(rm.dataset.rmsch),1);renderSchedule();markDirty();
});

['dClient','dTitle','dArea','dValid','terms','tDiscIn'].forEach(id=>$('#'+id)?.addEventListener('input',()=>{calc();markDirty();}));

$('#sendBtn')?.addEventListener('click',openSend);
$('#sendBtn2')?.addEventListener('click',openSend);
$('#confirmSend')?.addEventListener('click',async()=>{
  const byEmail=$('#chEmail')?.checked;
  const byWa=$('#chWa')?.checked;
  if(!byEmail&&!byWa)return toast('Pick at least one channel','err');
  await issueAndSend();
  closeAllModals();
  const link=`${location.origin}/proposal.html?id=${PROPOSAL.id}`;
  const msg=val('sendMsg');
  if(byWa&&LEAD?.phone){
    const phone=String(LEAD.phone).replace(/\D/g,'').slice(-10);
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg+'\n\n'+link)}`,'_blank');
  }else if(byWa)toast('No mobile number on this lead','err');
  if(byEmail&&LEAD?.email){
    location.href=`mailto:${LEAD.email}?subject=${encodeURIComponent('Proposal '+PROPOSAL.proposal_no)}&body=${encodeURIComponent(msg+'\n\n'+link)}`;
  }else if(byEmail)toast('No email address on this lead','err');
});
$('#previewBtn')?.addEventListener('click',()=>{buildPreview();openModal('prevModal');});
$('#pdfBtn')?.addEventListener('click',()=>{buildPreview();window.print();});
$('#pdfBtn2')?.addEventListener('click',()=>{buildPreview();window.print();});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});

await load();
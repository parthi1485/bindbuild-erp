import { supabase } from '../lib/supabase.js';
import { mountShell, activeUnit } from '../lib/shell.js';
import { issueDocumentNumber } from '../lib/numbering.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $ = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route:'sales', title:'Estimate' });
if (!user) throw new Error('redirecting');

const qs = new URLSearchParams(location.search);
const estimateId = qs.get('id');
const leadParam = qs.get('lead');

let ESTIMATE = null;
let LEAD = null;
let LEADS = [];
let ITEMS = [];
let dirty = false;
let saveTimer = null;

const today = new Date();
const addDays = (d,n) => {
  const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10);
};
const inr = v => '₹' + Math.round(Number(v)||0).toLocaleString('en-IN');

function totals() {
  const sub = ITEMS.reduce((a,it)=>a + Number(it.q||0)*Number(it.r||0), 0);
  const discountPct = Number($('#tDiscIn')?.value || 0);
  const discount = sub * discountPct / 100;
  const taxable = Math.max(sub - discount, 0);
  const taxRate = Number($('#tTaxIn')?.value || 0);
  const tax = taxable * taxRate / 100;
  return { sub, discountPct, discount, taxable, taxRate, tax, total: taxable + tax };
}

function paintTotals() {
  const t = totals();
  $('#tSub').textContent = inr(t.sub);
  $('#tDisc').textContent = '− ' + inr(t.discount);
  $('#tGst').textContent = inr(t.tax);
  $('#tGrand').textContent = inr(t.total);
  $$('[data-amt]').forEach(el => {
    const i = Number(el.dataset.amt);
    el.textContent = inr((ITEMS[i]?.q||0)*(ITEMS[i]?.r||0));
  });
}

function renderItems() {
  const body = $('#feeBody');
  body.innerHTML = ITEMS.map((it,i)=>`<tr>
    <td><input class="in" value="${esc(it.category||'')}" data-i="${i}" data-f="category" placeholder="Civil / MEP…" /></td>
    <td><input class="in in--desc" value="${esc(it.d||'')}" data-i="${i}" data-f="d" /></td>
    <td class="r"><input class="in in--num" type="number" min="0" step="0.001" value="${it.q}" data-i="${i}" data-f="q" /></td>
    <td><input class="in" value="${esc(it.u||'LS')}" data-i="${i}" data-f="u" /></td>
    <td class="r"><input class="in in--num" type="number" min="0" step="0.01" value="${it.r}" data-i="${i}" data-f="r" /></td>
    <td class="r"><span class="amt" data-amt="${i}">${inr(it.q*it.r)}</span></td>
    <td><button class="rm" data-rm="${i}" aria-label="Remove item">×</button></td>
  </tr>`).join('');
  $('#feeCount').textContent = ITEMS.length + ' item' + (ITEMS.length===1?'':'s');
  paintTotals();
}

function markDirty() {
  dirty = true;
  $('#autosaveTxt').textContent = 'Unsaved changes';
  $('#autosave')?.classList.add('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 900);
}

async function loadLeads() {
  const { data, error } = await supabase.from('leads')
    .select('id,lead_no,name,phone,email,area,city,service,expected_value,business_unit_id')
    .is('deleted_at', null)
    .order('updated_at', {ascending:false});
  if (error) throw error;
  LEADS = data || [];
  $('#dClient').innerHTML = '<option value="">Select a lead</option>' + LEADS.map(l =>
    `<option value="${l.id}">${esc(l.lead_no || '')} · ${esc(l.name)}</option>`
  ).join('');
}

async function createDraftFromLead(leadId) {
  LEAD = LEADS.find(l=>l.id===leadId) || null;
  if (!LEAD) throw new Error('Lead not found');

  const payload = {
    business_unit_id: LEAD.business_unit_id || activeUnit(),
    lead_id: LEAD.id,
    title: `Preliminary Estimate · ${LEAD.name}`,
    status: 'draft',
    subtotal: 0, discount: 0, tax_rate: 0, tax_amount: 0, total: 0,
    issue_date: today.toISOString().slice(0,10),
    valid_until: addDays(today, 15),
    built_up_area: null,
    scope: LEAD.service ? `${LEAD.service} · preliminary budget scope` : null,
    terms: 'Preliminary estimate subject to design development, site verification, structural inputs, statutory approvals and final specifications.'
  };

  const { data, error } = await supabase.from('estimates').insert(payload).select('*').single();
  if (error) throw error;
  ESTIMATE = data;

  ITEMS = [{
    category:'Preliminary',
    d: LEAD.service || 'Construction / project allowance',
    q: 1, u:'LS', r:Number(LEAD.expected_value || 0)
  }];

  if (ITEMS[0].r > 0) {
    const { error:itemErr } = await supabase.from('estimate_items').insert({
      estimate_id: ESTIMATE.id, sort_order:0, category:ITEMS[0].category,
      description:ITEMS[0].d, qty:1, unit:'LS', rate:ITEMS[0].r
    });
    if (itemErr) throw itemErr;
  }
  history.replaceState(null,'',`/estimate.html?id=${ESTIMATE.id}`);
}

async function load() {
  try {
    await loadLeads();

    if (estimateId) {
      const { data, error } = await supabase.from('estimates').select('*').eq('id',estimateId).is('deleted_at',null).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Estimate not found');
      ESTIMATE = data;
    } else if (leadParam) {
      await createDraftFromLead(leadParam);
    } else {
      const { data } = await supabase.from('estimates').select('id').is('deleted_at',null).order('created_at',{ascending:false}).limit(1);
      if (data?.length) return location.replace('/estimate.html?id=' + data[0].id);
      throw new Error('Create an estimate from a lead in CRM.');
    }

    if (ESTIMATE.lead_id) LEAD = LEADS.find(l=>l.id===ESTIMATE.lead_id) || null;

    const { data:items, error:iErr } = await supabase.from('estimate_items')
      .select('*').eq('estimate_id',ESTIMATE.id).order('sort_order');
    if (iErr) throw iErr;
    ITEMS = (items||[]).map(x=>({
      id:x.id, category:x.category||'', d:x.description, q:Number(x.qty), u:x.unit, r:Number(x.rate)
    }));
    if (!ITEMS.length) ITEMS=[{category:'',d:'New estimate item',q:1,u:'LS',r:0}];

    paint();
  } catch(e) {
    fail(e);
  }
}

function paint() {
  $('#dClient').value = ESTIMATE.lead_id || '';
  $('#dTitle').value = ESTIMATE.title || 'Preliminary Construction Estimate';
  $('#dArea').value = ESTIMATE.built_up_area || '';
  $('#dValid').value = ESTIMATE.valid_until || addDays(today,15);
  $('#dBy').value = user.name;
  $('#scope').value = ESTIMATE.scope || '';
  $('#terms').value = ESTIMATE.terms || '';
  $('#tTaxIn').value = Number(ESTIMATE.tax_rate || 0);

  const sub = Number(ESTIMATE.subtotal||0);
  const disc = Number(ESTIMATE.discount||0);
  $('#tDiscIn').value = sub > 0 ? Math.round((disc/sub)*10000)/100 : 0;

  $('#pageTitle').textContent = ESTIMATE.title || 'Preliminary Estimate';
  $('#numberChip').textContent = ESTIMATE.estimate_no || 'DRAFT';
  $('#statusChip').textContent = (ESTIMATE.status || 'draft').toUpperCase();
  $('#clientChip').textContent = LEAD?.name || 'Unassigned';
  $('#metaNo').textContent = ESTIMATE.estimate_no || 'Draft — not issued';
  $('#metaStatus').textContent = ESTIMATE.status || 'draft';
  $('#metaIssue').textContent = ESTIMATE.estimate_no ? fmtDate(ESTIMATE.issue_date) : '—';
  $('#metaLead').textContent = LEAD ? `${LEAD.lead_no || ''} · ${LEAD.name}` : '—';
  $('#backToLead').href = LEAD ? `/lead.html?id=${LEAD.id}` : '/sales.html';

  renderItems();
}

async function save() {
  if (!ESTIMATE || !dirty) return;
  const t = totals();
  $('#autosaveTxt').textContent = 'Saving…';

  const { error } = await supabase.from('estimates').update({
    lead_id: $('#dClient').value || null,
    title: $('#dTitle').value.trim() || 'Preliminary Construction Estimate',
    built_up_area: Number($('#dArea').value || 0) || null,
    valid_until: $('#dValid').value || null,
    scope: $('#scope').value.trim() || null,
    terms: $('#terms').value.trim() || null,
    subtotal: t.sub,
    discount: t.discount,
    tax_rate: t.taxRate,
    tax_amount: t.tax,
    total: t.total
  }).eq('id',ESTIMATE.id);
  if (error) return fail(error);

  const del = await supabase.from('estimate_items').delete().eq('estimate_id',ESTIMATE.id);
  if (del.error) return fail(del.error);

  if (ITEMS.length) {
    const { error:iErr } = await supabase.from('estimate_items').insert(ITEMS.map((it,i)=>({
      estimate_id:ESTIMATE.id, sort_order:i, category:it.category||null,
      description:it.d || 'Estimate item', qty:Number(it.q||0), unit:it.u||'LS', rate:Number(it.r||0)
    })));
    if (iErr) return fail(iErr);
  }

  ESTIMATE = {...ESTIMATE,
    lead_id: $('#dClient').value || null,
    title: $('#dTitle').value.trim(),
    built_up_area:Number($('#dArea').value||0)||null,
    valid_until:$('#dValid').value||null,
    scope:$('#scope').value.trim()||null,
    terms:$('#terms').value.trim()||null,
    subtotal:t.sub,discount:t.discount,tax_rate:t.taxRate,tax_amount:t.tax,total:t.total
  };

  LEAD = LEADS.find(l=>l.id===ESTIMATE.lead_id) || null;
  dirty=false;
  $('#autosaveTxt').textContent='All changes saved';
  $('#autosave')?.classList.remove('saving');
  paint();
}

async function issueEstimate() {
  if (dirty) await save();
  if (ESTIMATE.estimate_no) return toast('Estimate is already issued');

  const t=totals();
  let no;
  try {
    no = await issueDocumentNumber('estimate',{
      issueDate:new Date(ESTIMATE.issue_date || today),
      leadId:ESTIMATE.lead_id,
      clientId:ESTIMATE.client_id,
      amount:t.total,
      status:'issued',
      metadata:{ estimate_id:ESTIMATE.id, title:ESTIMATE.title }
    });
  } catch(e) { return fail(e); }

  const { error } = await supabase.from('estimates').update({
    estimate_no:no,status:'issued',issue_date:today.toISOString().slice(0,10)
  }).eq('id',ESTIMATE.id);
  if (error) return fail(error);

  ESTIMATE.estimate_no=no; ESTIMATE.status='issued'; ESTIMATE.issue_date=today.toISOString().slice(0,10);
  paint();
  toast(`Estimate ${no} issued`);
}

async function createProposal() {
  if (dirty) await save();
  const t=totals();

  const { data:proposal, error } = await supabase.from('proposals').insert({
    business_unit_id:ESTIMATE.business_unit_id || activeUnit(),
    lead_id:ESTIMATE.lead_id,
    client_id:ESTIMATE.client_id,
    estimate_id:ESTIMATE.id,
    title:ESTIMATE.title?.replace(/^Preliminary Estimate/i,'Proposal') || 'Project Proposal',
    service:LEAD?.service || null,
    status:'draft',
    subtotal:t.sub,
    discount:t.discount,
    tax_rate:18,
    tax_amount:Math.max(t.sub-t.discount,0)*0.18,
    grand_total:Math.max(t.sub-t.discount,0)*1.18,
    valid_until:addDays(today,30),
    built_up_area:ESTIMATE.built_up_area,
    scope:ESTIMATE.scope,
    terms:ESTIMATE.terms,
    payment_schedule:[
      {name:'Design / mobilisation advance',pct:10},
      {name:'Agreement / pre-construction',pct:10},
      {name:'Construction milestones',pct:75},
      {name:'Handover / close-out',pct:5}
    ]
  }).select('*').single();
  if (error) return fail(error);

  const { error:itemErr } = await supabase.from('proposal_items').insert(ITEMS.map((it,i)=>({
    proposal_id:proposal.id,sort_order:i,category:it.category||null,
    description:it.d||'Proposal item',qty:Number(it.q||0),unit:it.u||'LS',rate:Number(it.r||0)
  })));
  if (itemErr) return fail(itemErr);

  if (ESTIMATE.lead_id) {
    await supabase.from('leads').update({stage:'proposal'}).eq('id',ESTIMATE.lead_id);
  }

  toast('Proposal draft created');
  location.href = `/proposal.html?id=${proposal.id}`;
}

$('#feeBody').addEventListener('input',e=>{
  const i=Number(e.target.dataset.i), f=e.target.dataset.f;
  if (!Number.isFinite(i) || !f) return;
  ITEMS[i][f] = ['q','r'].includes(f) ? Number(e.target.value||0) : e.target.value;
  paintTotals(); markDirty();
});
$('#feeBody').addEventListener('click',e=>{
  const rm=e.target.closest('[data-rm]'); if(!rm) return;
  ITEMS.splice(Number(rm.dataset.rm),1); renderItems(); markDirty();
});
$('#addItem').addEventListener('click',()=>{
  ITEMS.push({category:'',d:'New estimate item',q:1,u:'LS',r:0});
  renderItems(); markDirty();
});
['dClient','dTitle','dArea','dValid','scope','terms','tDiscIn','tTaxIn'].forEach(id=>{
  $('#'+id)?.addEventListener('input',()=>{ paintTotals(); markDirty(); });
});
$('#issueBtn').addEventListener('click',issueEstimate);
$('#proposalBtn').addEventListener('click',createProposal);
$('#proposalBtn2').addEventListener('click',createProposal);
$('#pdfBtn').addEventListener('click',()=>window.print());
window.addEventListener('beforeunload',e=>{ if(dirty){e.preventDefault(); e.returnValue='';} });

await load();
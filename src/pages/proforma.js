import { supabase } from '../lib/supabase.js';
import { mountShell, activeUnit } from '../lib/shell.js';
import { issueDocumentNumber } from '../lib/numbering.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'finance',title:'Proforma Invoice'});
if(!user)throw new Error('redirecting');

const qs=new URLSearchParams(location.search);
let id=qs.get('id');
const projectParam=qs.get('project');
let PI=null,P=null,C=null,PROP=null,ORG=null,ITEMS=[],latestReceipt=null;
const today=new Date();
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
const money=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');

async function createDraft(projectId){
  const existing=await supabase.from('proforma_invoices').select('id').eq('project_id',projectId).eq('status','draft').is('deleted_at',null).order('created_at',{ascending:false}).limit(1);
  if(existing.error)throw existing.error;
  if(existing.data?.length){location.replace('/proforma.html?id='+existing.data[0].id);return false;}

  const pRes=await supabase.from('projects').select('*').eq('id',projectId).is('deleted_at',null).maybeSingle();
  if(pRes.error)throw pRes.error;if(!pRes.data)throw new Error('Project not found');
  const project=pRes.data;
  const propRes=project.proposal_id?await supabase.from('proposals').select('*').eq('id',project.proposal_id).maybeSingle():{data:null};
  if(propRes.error)throw propRes.error;
  const proposal=propRes.data;

  const old=await supabase.from('proforma_invoices').select('milestone_name').eq('project_id',projectId).is('deleted_at',null);
  const used=new Set((old.data||[]).map(x=>x.milestone_name).filter(Boolean));
  const schedule=Array.isArray(proposal?.payment_schedule)?proposal.payment_schedule:[];
  const next=schedule.find(s=>!used.has(s.name))||schedule[0]||{name:'Mobilisation / milestone payment',pct:10};
  const pct=Number(next.pct||10);
  const subtotal=Number(proposal?.subtotal||project.contract_value||0)*pct/100;
  const discount=Number(proposal?.discount||0)*pct/100;
  const taxRate=Number(proposal?.tax_rate??18);
  const taxable=Math.max(subtotal-discount,0);
  const tax=taxable*taxRate/100;
  const total=taxable+tax;

  const cRes=project.client_id?await supabase.from('clients').select('*').eq('id',project.client_id).maybeSingle():{data:null};
  const orgRes=await supabase.from('organisation_profiles').select('*').eq('business_unit_id',project.business_unit_id||activeUnit()).maybeSingle();
  const client=cRes.data, org=orgRes.data;
  const interstate=!!(client?.state_code&&org?.state_code&&client.state_code!==org.state_code);

  const {data,error}=await supabase.from('proforma_invoices').insert({
    business_unit_id:project.business_unit_id||activeUnit(),lead_id:project.lead_id,project_id:project.id,
    client_id:project.client_id,proposal_id:project.proposal_id,title:'Proforma Invoice · '+next.name,
    milestone_name:next.name,milestone_pct:pct,status:'draft',
    subtotal,discount,tax_rate:taxRate,tax_amount:tax,total,amount_paid:0,
    issue_date:today.toISOString().slice(0,10),due_date:addDays(today,7),
    notes:'Milestone payment request against accepted proposal.',
    place_of_supply_state_code:client?.state_code||null,is_interstate:interstate
  }).select('*').single();
  if(error)throw error;
  PI=data;
  const {error:iErr}=await supabase.from('proforma_items').insert({
    proforma_id:PI.id,sort_order:0,description:next.name,sac_code:'9954',qty:1,unit:'LS',rate:subtotal
  });
  if(iErr)throw iErr;
  history.replaceState(null,'','/proforma.html?id='+PI.id);
  id=PI.id;
  return true;
}

async function load(){
  try{
    if(!id&&projectParam){
      const created=await createDraft(projectParam);
      if(created===false)return;
    }
    if(!id)throw new Error('Create a proforma from a project.');

    const piRes=await supabase.from('proforma_invoices').select('*').eq('id',id).is('deleted_at',null).maybeSingle();
    if(piRes.error)throw piRes.error;if(!piRes.data)throw new Error('Proforma not found');
    PI=piRes.data;

    const [pRes,cRes,propRes,orgRes,itRes,rRes]=await Promise.all([
      supabase.from('projects').select('*').eq('id',PI.project_id).maybeSingle(),
      supabase.from('clients').select('*').eq('id',PI.client_id).maybeSingle(),
      PI.proposal_id?supabase.from('proposals').select('*').eq('id',PI.proposal_id).maybeSingle():Promise.resolve({data:null}),
      supabase.from('organisation_profiles').select('*').eq('business_unit_id',PI.business_unit_id).maybeSingle(),
      supabase.from('proforma_items').select('*').eq('proforma_id',PI.id).order('sort_order'),
      supabase.from('receipts').select('*').eq('proforma_id',PI.id).eq('status','issued').order('created_at',{ascending:false}).limit(1)
    ]);
    [pRes,cRes,propRes,orgRes,itRes,rRes].forEach(r=>{if(r.error)throw r.error;});
    P=pRes.data;C=cRes.data;PROP=propRes.data;ORG=orgRes.data;ITEMS=itRes.data||[];latestReceipt=rRes.data?.[0]||null;
    paint();
  }catch(e){fail(e);}
}

function paint(){
  const balance=Math.max(Number(PI.total||0)-Number(PI.amount_paid||0),0);
  $('#title').childNodes[0].nodeValue=(PI.proforma_no?'Proforma '+PI.proforma_no:'Draft Proforma')+' ';
  $('#statPill').textContent=(PI.status||'draft').toUpperCase();
  $('#sub').textContent=(P?.project_no||P?.code||'')+' · '+(PI.milestone_name||'Milestone payment');
  $('#sellerName').textContent=ORG?.trade_name||'Bind Builds';
  $('#sellerMeta').innerHTML=ORG?.gstin
    ? [ORG.legal_name,ORG.address,ORG.city,ORG.state,ORG.pincode,'GSTIN '+ORG.gstin,'PAN '+(ORG.pan||'')].filter(Boolean).map(esc).join('<br>')
    : '<b>GST profile incomplete</b><br>Configure legal name, GSTIN, PAN and address before external issue.';
  $('#docNo').textContent=PI.proforma_no||'DRAFT';
  $('#issueDate').textContent=fmtDate(PI.issue_date);
  $('#dueDate').textContent=PI.due_date?fmtDate(PI.due_date):'—';
  $('#pos').textContent=(C?.state||C?.city||'—')+(PI.place_of_supply_state_code?' ('+PI.place_of_supply_state_code+')':'');
  $('#clientName').textContent=C?.name||'—';
  $('#clientMeta').innerHTML=[C?.address,C?.city,C?.state,C?.gstin?'GSTIN '+C.gstin:null,C?.email].filter(Boolean).map(esc).join('<br>')||'—';
  $('#projectName').textContent=P?.name||'—';
  $('#projectNo').textContent=P?.project_no||P?.code||'—';
  $('#milestoneName').value=PI.milestone_name||'';
  $('#milestonePct').value=Number(PI.milestone_pct||0);
  $('#itemsBody').innerHTML=ITEMS.map((it,i)=>`<tr><td class="num">${i+1}</td><td class="desc"><b>${esc(it.description)}</b><span>${esc(it.unit||'LS')}</span></td><td class="sac">${esc(it.sac_code||'—')}</td><td class="num r">${Number(it.amount||0).toLocaleString('en-IN')}</td></tr>`).join('');

  const taxable=Math.max(Number(PI.subtotal||0)-Number(PI.discount||0),0);
  const rate=Number(PI.tax_rate||0);
  const taxRows=PI.is_interstate
    ? [[`IGST @ ${rate}%`,Number(PI.tax_amount||0)]]
    : [[`CGST @ ${rate/2}%`,Number(PI.tax_amount||0)/2],[`SGST @ ${rate/2}%`,Number(PI.tax_amount||0)/2]];
  $('#totals').innerHTML=[
    ['Subtotal',PI.subtotal],
    ...(Number(PI.discount)?[['Discount',-Number(PI.discount)]]:[]),
    ['Taxable value',taxable],
    ...taxRows,
    ['Total',PI.total]
  ].map((r,i,a)=>`<div class="tot__row ${i===a.length-1?'grand':''}"><span>${esc(r[0])}</span><span>${r[1]<0?'− ':''}${money(Math.abs(r[1]))}</span></div>`).join('');

  $('#notes').textContent=PI.notes||'Milestone payment request.';
  $('#dueAmt').textContent=money(balance);
  $('#paidMeta').textContent=Number(PI.amount_paid||0)?money(PI.amount_paid)+' received':'No payment recorded';
  $('#payAmount').value=balance>0?balance:'';
  $('#recordBtn').disabled=!PI.proforma_no||balance<=0;
  $('#issueBtn').hidden=!!PI.proforma_no;
  $('#receiptBtn').hidden=!latestReceipt;
  $('#invoiceBtn').hidden=Number(PI.amount_paid||0)<=0;
  $('#metaStatus').textContent=PI.status||'draft';
  $('#metaTax').textContent=rate+'%';
  $('#metaTaxMode').textContent=PI.is_interstate?'IGST':'CGST + SGST';
}

async function saveMilestone(){
  const name=$('#milestoneName').value.trim()||'Milestone payment';
  const pct=Number($('#milestonePct').value||0);
  if(pct<=0||pct>100)return toast('Milestone percentage must be between 0 and 100','err');

  const subtotal=Number(PROP?.subtotal||P?.contract_value||0)*pct/100;
  const discount=Number(PROP?.discount||0)*pct/100;
  const taxable=Math.max(subtotal-discount,0);
  const taxRate=Number(PROP?.tax_rate??PI.tax_rate??18);
  const tax=taxable*taxRate/100;
  const total=taxable+tax;

  const {error}=await supabase.from('proforma_invoices').update({
    milestone_name:name,milestone_pct:pct,title:'Proforma Invoice · '+name,
    subtotal,discount,tax_rate:taxRate,tax_amount:tax,total
  }).eq('id',PI.id);
  if(error)return fail(error);

  await supabase.from('proforma_items').delete().eq('proforma_id',PI.id);
  const {error:iErr}=await supabase.from('proforma_items').insert({
    proforma_id:PI.id,sort_order:0,description:name,sac_code:'9954',qty:1,unit:'LS',rate:subtotal
  });
  if(iErr)return fail(iErr);
  PI={...PI,milestone_name:name,milestone_pct:pct,title:'Proforma Invoice · '+name,subtotal,discount,tax_rate:taxRate,tax_amount:tax,total};
  ITEMS=[{description:name,sac_code:'9954',unit:'LS',amount:subtotal}];
  paint();toast('Milestone updated');
}

async function issue(){
  await saveMilestone();
  if(PI.proforma_no)return;
  let no;
  try{
    no=await issueDocumentNumber('proforma',{
      issueDate:new Date(PI.issue_date),leadId:PI.lead_id,projectId:PI.project_id,clientId:PI.client_id,
      amount:PI.total,status:'issued',metadata:{proforma_id:PI.id,milestone_name:PI.milestone_name}
    });
  }catch(e){return fail(e);}
  const {error}=await supabase.from('proforma_invoices').update({proforma_no:no,status:'issued'}).eq('id',PI.id);
  if(error)return fail(error);
  PI.proforma_no=no;PI.status='issued';paint();toast('Proforma '+no+' issued');
}

async function recordPayment(){
  const amount=Number($('#payAmount').value||0);
  if(amount<=0)return toast('Enter a payment amount','err');
  const {data,error}=await supabase.rpc('record_erp_payment',{
    p_target_type:'proforma',p_target_id:PI.id,p_amount:amount,
    p_receipt_date:today.toISOString().slice(0,10),p_payment_mode:$('#payMode').value,
    p_reference_no:$('#payRef').value.trim()||null,p_notes:'Payment against '+(PI.proforma_no||'proforma')
  });
  if(error)return fail(error);
  const row=Array.isArray(data)?data[0]:data;
  const fresh=await supabase.from('proforma_invoices').select('*').eq('id',PI.id).single();
  if(fresh.error)return fail(fresh.error);
  PI=fresh.data;
  latestReceipt={id:row?.receipt_id,receipt_no:row?.receipt_no};
  paint();toast(`Receipt ${row?.receipt_no||''} created`);
}

async function createInvoice(){
  const {data,error}=await supabase.rpc('create_invoice_from_proforma',{p_proforma_id:PI.id});
  if(error)return fail(error);
  const row=Array.isArray(data)?data[0]:data;
  toast(`GST invoice ${row?.invoice_no||''} created`);
  if(row?.invoice_id)location.href='/invoice.html?id='+row.invoice_id;
}

$('#milestoneName').addEventListener('change',saveMilestone);
$('#milestonePct').addEventListener('change',saveMilestone);
$('#issueBtn').addEventListener('click',issue);
$('#recordBtn').addEventListener('click',recordPayment);
$('#receiptBtn').addEventListener('click',()=>latestReceipt?.id&&(location.href='/receipt.html?id='+latestReceipt.id));
$('#invoiceBtn').addEventListener('click',createInvoice);
$('#backBtn').addEventListener('click',()=>P?.id&&(location.href='/project.html?id='+P.id));
$('#printBtn').addEventListener('click',()=>window.print());

await load();
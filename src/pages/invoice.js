import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'finance',title:'GST Invoice'});
if(!user)throw new Error('redirecting');

const invoiceId=new URLSearchParams(location.search).get('id');
const money=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');
let INV=null,ITEMS=[],CLIENT=null,PROJECT=null,ORG=null,RECEIPT=null,PI=null,CREDITS=[];

async function load(){
  try{
    if(!invoiceId){
      const latest=await supabase.from('invoices').select('id').is('deleted_at',null).order('created_at',{ascending:false}).limit(1);
      if(latest.error)throw latest.error;
      if(latest.data?.length)return location.replace('/invoice.html?id='+latest.data[0].id);
      throw new Error('No GST invoices yet.');
    }

    const iRes=await supabase.from('invoices').select('*').eq('id',invoiceId).is('deleted_at',null).maybeSingle();
    if(iRes.error)throw iRes.error;if(!iRes.data)throw new Error('Invoice not found');
    INV=iRes.data;

    const [itRes,cRes,pRes,oRes,rRes,piRes,cnRes]=await Promise.all([
      supabase.from('invoice_items').select('*').eq('invoice_id',INV.id).order('sort_order'),
      INV.client_id?supabase.from('clients').select('*').eq('id',INV.client_id).maybeSingle():Promise.resolve({data:null}),
      INV.project_id?supabase.from('projects').select('*').eq('id',INV.project_id).maybeSingle():Promise.resolve({data:null}),
      supabase.from('organisation_profiles').select('*').eq('business_unit_id',INV.business_unit_id).maybeSingle(),
      supabase.from('receipts').select('*').eq('invoice_id',INV.id).eq('status','issued').order('created_at',{ascending:false}).limit(1),
      INV.proforma_id?supabase.from('proforma_invoices').select('*').eq('id',INV.proforma_id).maybeSingle():Promise.resolve({data:null}),
      supabase.from('credit_notes').select('*').eq('invoice_id',INV.id).eq('status','issued').order('issue_date',{ascending:false})
    ]);
    [itRes,cRes,pRes,oRes,rRes,piRes,cnRes].forEach(r=>{if(r.error)throw r.error;});
    ITEMS=itRes.data||[];CLIENT=cRes.data;PROJECT=pRes.data;ORG=oRes.data;RECEIPT=rRes.data?.[0]||null;PI=piRes.data;CREDITS=cnRes.data||[];
    paint();
  }catch(e){fail(e);}
}

function paint(){
  const taxable=Math.max(Number(INV.subtotal||0)-Number(INV.discount||0),0);
  const taxRate=Number(INV.tax_rate||0);
  const balance=Math.max(Number(INV.total||0)-Number(INV.amount_paid||0),0);
  const settled=balance<=0.01;
  const cancelled=INV.status==='cancelled';
  const taxableRemaining=Math.max(taxable-CREDITS.reduce((a,x)=>a+Number(x.subtotal||0),0),0);

  $('#pageTitle').childNodes[0].nodeValue='Invoice '+(INV.invoice_no||'')+' ';
  $('#statPill').textContent=cancelled?'CANCELLED':(settled?'PAID':String(INV.status||'issued').toUpperCase());
  $('#pageSub').textContent=[PROJECT?.name,INV.milestone_name].filter(Boolean).join(' · ')||'GST invoice';

  $('#sellerName').textContent=ORG?.trade_name||'Bind Builds';
  $('#sellerMeta').innerHTML=ORG?.gstin
    ? [ORG.legal_name,ORG.address,ORG.city,ORG.state,ORG.pincode,'GSTIN '+ORG.gstin,'PAN '+(ORG.pan||'')].filter(Boolean).map(esc).join('<br>')
    : '<b>GST profile incomplete</b><br>Configure legal name, GSTIN, PAN and address before external issue.';
  $('#bankDetails').innerHTML=[ORG?.account_name,ORG?.bank_name,ORG?.account_no?'A/c '+ORG.account_no:null,ORG?.ifsc?'IFSC '+ORG.ifsc:null,ORG?.upi?'UPI '+ORG.upi:null].filter(Boolean).map(esc).join('<br>')||'Not configured';

  $('#invoiceNo').textContent=INV.invoice_no||'—';
  $('#issueDate').textContent=fmtDate(INV.issue_date);
  $('#dueDate').textContent=INV.due_date?fmtDate(INV.due_date):'—';
  $('#pos').textContent=(CLIENT?.state||CLIENT?.city||'—')+(INV.place_of_supply_state_code?' ('+INV.place_of_supply_state_code+')':'');
  $('#clientName').textContent=CLIENT?.name||'—';
  $('#clientMeta').innerHTML=[CLIENT?.address,CLIENT?.city,CLIENT?.state,CLIENT?.gstin?'GSTIN '+CLIENT.gstin:null,CLIENT?.email].filter(Boolean).map(esc).join('<br>')||'—';
  $('#projectName').textContent=PROJECT?.name||'—';
  $('#projectNo').textContent=PROJECT?.project_no||PROJECT?.code||'—';
  $('#milestone').textContent=[INV.milestone_name,INV.milestone_pct?INV.milestone_pct+'%':null].filter(Boolean).join(' · ')||'—';

  $('#itemsBody').innerHTML=ITEMS.length?ITEMS.map((it,i)=>`<tr><td class="num">${i+1}</td><td class="desc"><b>${esc(it.description)}</b><span>${esc(it.unit||'LS')}</span></td><td class="sac">${esc(it.sac_code||'—')}</td><td class="num r">${Number(it.amount||0).toLocaleString('en-IN')}</td></tr>`).join(''):'<tr><td colspan="4">No line items</td></tr>';

  const taxRows=INV.is_interstate
    ? [[`IGST @ ${taxRate}%`,Number(INV.tax_amount||0)]]
    : [[`CGST @ ${taxRate/2}%`,Number(INV.tax_amount||0)/2],[`SGST @ ${taxRate/2}%`,Number(INV.tax_amount||0)/2]];
  $('#totals').innerHTML=[
    ['Subtotal',INV.subtotal],
    ...(Number(INV.discount)?[['Discount',-Number(INV.discount)]]:[]),
    ['Taxable value',taxable],
    ...taxRows,
    ['Total',INV.total]
  ].map((r,i,a)=>`<div class="tot__row ${i===a.length-1?'grand':''}"><span>${esc(r[0])}</span><span>${r[1]<0?'− ':''}${money(Math.abs(r[1]))}</span></div>`).join('');

  $('#notes').textContent=INV.notes||'Generated from received proforma payment.';
  $('#totalAmt').textContent=money(INV.total);
  $('#dueMeta').textContent=settled?'Fully settled':money(INV.amount_paid)+' received · '+money(balance)+' outstanding';
  $('#paymentStatus').innerHTML=`Received: <b>${money(INV.amount_paid)}</b><br>Outstanding: <b>${money(balance)}</b>`;
  $('#taxable').textContent=money(taxable);
  $('#taxMode').textContent=INV.is_interstate?'IGST':'CGST + SGST';
  $('#gstTotal').textContent=money(INV.tax_amount);
  $('#receiptBtn').hidden=!RECEIPT;

  let corr=$('#correctionCard');
  if(!corr){
    const rail=$('.rail');
    rail?.insertAdjacentHTML('beforeend',`
      <section class="card" id="correctionCard">
        <div class="card__head"><span class="card__title">Corrections</span></div>
        <div class="card__body">
          <div class="gstsum" id="creditList"></div>
          <div class="due__acts" style="margin-top:14px">
            <button class="rbtn rbtn--ghost" id="creditBtn">Raise credit note</button>
            <button class="rbtn rbtn--ghost" id="cancelInvoiceBtn">Cancel invoice</button>
          </div>
        </div>
      </section>`);
    corr=$('#correctionCard');
  }
  const creditList=$('#creditList');
  if(creditList)creditList.innerHTML=CREDITS.length
    ? CREDITS.map(x=>`<button class="rbtn rbtn--ghost" data-credit="${x.id}" style="justify-content:space-between"><span>${esc(x.credit_no)}</span><b>${money(x.total)}</b></button>`).join('')
    : '<div class="gstsum__row"><span>Credit notes</span><b>None</b></div>';
  const creditBtn=$('#creditBtn');
  const cancelBtn=$('#cancelInvoiceBtn');
  if(creditBtn){creditBtn.hidden=cancelled||taxableRemaining<=0.01;creditBtn.onclick=()=>raiseCredit(taxableRemaining);}
  if(cancelBtn){cancelBtn.hidden=cancelled||Number(INV.amount_paid||0)>0||Number(INV.credited_amount||0)>0;cancelBtn.onclick=cancelInvoice;}

  $('#projectBtn').onclick=()=>PROJECT?.id&&(location.href='/project.html?id='+PROJECT.id);
  $('#proformaBtn').onclick=()=>PI?.id&&(location.href='/proforma.html?id='+PI.id);
  $('#receiptBtn').onclick=()=>RECEIPT?.id&&(location.href='/receipt.html?id='+RECEIPT.id);
  $('#printBtn').onclick=()=>window.print();

  document.querySelectorAll('[data-credit]').forEach(b=>b.onclick=()=>location.href='/credit-note.html?id='+b.dataset.credit);
  document.title=(INV.invoice_no||'GST Invoice')+' · Bind Build ERP';
  const here=$('.crumbs .here');if(here)here.textContent=INV.invoice_no||'Invoice';
}

async function raiseCredit(maxSubtotal){
  const raw=prompt('Credit taxable value (before GST)',String(Math.round(maxSubtotal)));
  if(raw===null)return;
  const subtotal=Number(raw);
  if(!Number.isFinite(subtotal)||subtotal<=0)return toast('Enter a valid credit amount','err');
  const reason=prompt('Reason for credit note','Price revision / correction');
  if(!reason)return;
  const narration=prompt('Narration / reference (optional)','Against '+INV.invoice_no)||null;
  const {data,error}=await supabase.rpc('raise_credit_note',{
    p_invoice_id:INV.id,p_subtotal:subtotal,p_reason:reason,p_narration:narration,
    p_issue_date:new Date().toISOString().slice(0,10)
  });
  if(error)return fail(error);
  const row=Array.isArray(data)?data[0]:data;
  toast('Credit note '+(row?.credit_no||'')+' issued');
  if(row?.credit_note_id)location.href='/credit-note.html?id='+row.credit_note_id;
}

async function cancelInvoice(){
  const reason=prompt('Cancellation reason');
  if(!reason)return;
  if(!confirm('Cancel invoice '+INV.invoice_no+'? The invoice number will remain in the register.'))return;
  const {error}=await supabase.rpc('cancel_invoice',{p_invoice_id:INV.id,p_reason:reason});
  if(error)return fail(error);
  toast('Invoice cancelled');
  location.reload();
}

await load();
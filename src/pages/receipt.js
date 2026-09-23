import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'finance',title:'Receipt'});
if(!user)throw new Error('redirecting');

const id=new URLSearchParams(location.search).get('id');
const money=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');
let R=null,C=null,P=null,PI=null,INV=null,ORG=null;

async function load(){
  try{
    if(!id)throw new Error('Open a receipt from a project, client or finance record.');
    const rRes=await supabase.from('receipts').select('*').eq('id',id).maybeSingle();
    if(rRes.error)throw rRes.error;if(!rRes.data)throw new Error('Receipt not found');
    R=rRes.data;

    const [cRes,pRes,piRes,iRes,oRes]=await Promise.all([
      R.client_id?supabase.from('clients').select('*').eq('id',R.client_id).maybeSingle():Promise.resolve({data:null}),
      R.project_id?supabase.from('projects').select('*').eq('id',R.project_id).maybeSingle():Promise.resolve({data:null}),
      R.proforma_id?supabase.from('proforma_invoices').select('*').eq('id',R.proforma_id).maybeSingle():Promise.resolve({data:null}),
      R.invoice_id?supabase.from('invoices').select('*').eq('id',R.invoice_id).maybeSingle():Promise.resolve({data:null}),
      supabase.from('organisation_profiles').select('*').eq('business_unit_id',R.business_unit_id).maybeSingle()
    ]);
    [cRes,pRes,piRes,iRes,oRes].forEach(x=>{if(x.error)throw x.error;});
    C=cRes.data;P=pRes.data;PI=piRes.data;INV=iRes.data;ORG=oRes.data;
    paint();
  }catch(e){fail(e);}
}

function paint(){
  $('#pageTitle').textContent='Receipt '+R.receipt_no;
  $('#pageSub').textContent=[P?.name,PI?.milestone_name||INV?.milestone_name].filter(Boolean).join(' · ')||'Payment acknowledgement';
  $('#sellerName').textContent=ORG?.trade_name||'Bind Builds';
  $('#sellerMeta').innerHTML=[ORG?.legal_name,ORG?.address,ORG?.city,ORG?.state,ORG?.gstin?'GSTIN '+ORG.gstin:null].filter(Boolean).map(esc).join('<br>')||'Organisation profile not fully configured';
  $('#receiptNo').textContent=R.receipt_no;
  $('#receiptDate').textContent=fmtDate(R.receipt_date);
  $('#clientName').textContent=C?.name||'—';
  $('#clientMeta').innerHTML=[C?.phone,C?.email,C?.city].filter(Boolean).map(esc).join('<br>')||'—';
  $('#againstName').textContent=INV?.invoice_no||PI?.proforma_no||P?.project_no||P?.code||'Project payment';
  $('#againstMeta').textContent=P?.name||'—';
  $('#amount').textContent=money(R.amount);
  $('#paymentMeta').textContent=[String(R.payment_mode||'').replaceAll('_',' ').toUpperCase(),R.reference_no].filter(Boolean).join(' · ')||'—';
  $('#notes').textContent=R.notes||'Payment received and acknowledged.';
  $('#status').textContent=R.status||'issued';
  $('#mode').textContent=String(R.payment_mode||'—').replaceAll('_',' ');
  $('#ref').textContent=R.reference_no||'—';

  $('#backBtn').onclick=()=>{
    if(INV?.id)location.href='/invoice.html?id='+INV.id;
    else if(PI?.id)location.href='/proforma.html?id='+PI.id;
    else if(P?.id)location.href='/project.html?id='+P.id;
    else history.back();
  };
  const host=$('.ctx__actions');
  if(host&&!$('#cancelReceiptBtn')&&R.status!=='cancelled'&&['founder','admin','finance'].includes(user.role)){
    host.insertAdjacentHTML('beforeend','<button class="btn-ghost" id="cancelReceiptBtn">Cancel receipt</button>');
    $('#cancelReceiptBtn').onclick=cancelReceipt;
  }
  $('#printBtn').onclick=()=>window.print();
  document.title=R.receipt_no+' · Bind Build ERP';
  const here=$('.crumbs .here');if(here)here.textContent=R.receipt_no;
}

async function cancelReceipt(){
  const reason=prompt('Receipt cancellation reason');
  if(!reason)return;
  if(!confirm('Cancel '+R.receipt_no+' and reverse this payment from the linked document?'))return;
  const {error}=await supabase.rpc('cancel_receipt',{p_receipt_id:R.id,p_reason:reason});
  if(error)return fail(error);
  location.reload();
}

await load();
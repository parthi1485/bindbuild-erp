import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'finance',title:'Credit Note'});
if(!user)throw new Error('redirecting');

const id=new URLSearchParams(location.search).get('id');
const money=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');
let CN=null,INV=null,C=null,P=null,ORG=null;

async function load(){
  try{
    if(!id)throw new Error('Open a credit note from its invoice.');
    const cn=await supabase.from('credit_notes').select('*').eq('id',id).maybeSingle();
    if(cn.error)throw cn.error;if(!cn.data)throw new Error('Credit note not found');
    CN=cn.data;
    const [i,c,p,o]=await Promise.all([
      supabase.from('invoices').select('*').eq('id',CN.invoice_id).maybeSingle(),
      CN.client_id?supabase.from('clients').select('*').eq('id',CN.client_id).maybeSingle():Promise.resolve({data:null}),
      CN.project_id?supabase.from('projects').select('*').eq('id',CN.project_id).maybeSingle():Promise.resolve({data:null}),
      supabase.from('organisation_profiles').select('*').eq('business_unit_id',CN.business_unit_id).maybeSingle()
    ]);
    [i,c,p,o].forEach(x=>{if(x.error)throw x.error;});
    INV=i.data;C=c.data;P=p.data;ORG=o.data;paint();
  }catch(e){fail(e);}
}

function paint(){
  $('#pageTitle').textContent='Credit Note '+CN.credit_no;
  $('#pageSub').textContent='Against '+(INV?.invoice_no||'GST invoice');
  $('#sellerName').textContent=ORG?.trade_name||'Bind Builds';
  $('#sellerMeta').innerHTML=[ORG?.legal_name,ORG?.address,ORG?.city,ORG?.state,ORG?.gstin?'GSTIN '+ORG.gstin:null,ORG?.pan?'PAN '+ORG.pan:null].filter(Boolean).map(esc).join('<br>')||'Organisation profile incomplete';
  $('#creditNo').textContent=CN.credit_no;
  $('#issueDate').textContent=fmtDate(CN.issue_date);
  $('#clientName').textContent=C?.name||'—';
  $('#clientMeta').innerHTML=[C?.address,C?.city,C?.state,C?.gstin?'GSTIN '+C.gstin:null].filter(Boolean).map(esc).join('<br>')||'—';
  $('#invoiceNo').textContent=INV?.invoice_no||'—';
  $('#projectMeta').textContent=[P?.project_no||P?.code,P?.name].filter(Boolean).join(' · ')||'—';
  $('#reason').textContent=CN.reason;
  $('#narration').textContent=CN.narration||'Credit adjustment';
  $('#subtotal').textContent=money(CN.subtotal);
  const taxRows=CN.is_interstate
    ? [[`IGST @ ${CN.tax_rate}%`,CN.tax_amount]]
    : [[`CGST @ ${Number(CN.tax_rate)/2}%`,Number(CN.tax_amount)/2],[`SGST @ ${Number(CN.tax_rate)/2}%`,Number(CN.tax_amount)/2]];
  $('#totals').innerHTML=[['Taxable credit',CN.subtotal],...taxRows,['Total credit',CN.total]].map((x,i,a)=>`<div class="tot__row ${i===a.length-1?'grand':''}"><span>${esc(x[0])}</span><span>${money(x[1])}</span></div>`).join('');
  $('#status').textContent=CN.status;
  $('#taxMode').textContent=CN.is_interstate?'IGST':'CGST + SGST';
  $('#invoiceBtn').onclick=()=>INV?.id&&(location.href='/invoice.html?id='+INV.id);
  $('#printBtn').onclick=()=>window.print();
  document.title=CN.credit_no+' · Bind Build ERP';
}

await load();
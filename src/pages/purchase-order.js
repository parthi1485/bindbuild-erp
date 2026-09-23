import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { fail, esc, fmtDate } from '../lib/ui.js';
const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'procurement',title:'Purchase Order'});if(!user)throw new Error('redirecting');
const id=new URLSearchParams(location.search).get('id');
const money=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');
let PO=null,ITEMS=[],V=null,P=null,O=null,R=null,Q=null;

async function load(){
  try{
    if(!id)throw new Error('Open a purchase order from Procurement.');
    const po=await supabase.from('purchase_orders').select('*').eq('id',id).maybeSingle();
    if(po.error)throw po.error;if(!po.data)throw new Error('Purchase order not found');PO=po.data;
    const a=await Promise.all([
      supabase.from('po_items').select('*').eq('po_id',id).order('created_at'),
      PO.vendor_id?supabase.from('vendors').select('*').eq('id',PO.vendor_id).maybeSingle():Promise.resolve({data:null}),
      PO.project_id?supabase.from('projects').select('*').eq('id',PO.project_id).maybeSingle():Promise.resolve({data:null}),
      supabase.from('organisation_profiles').select('*').eq('business_unit_id',PO.business_unit_id).maybeSingle(),
      PO.requisition_id?supabase.from('material_requisitions').select('*').eq('id',PO.requisition_id).maybeSingle():Promise.resolve({data:null}),
      PO.quote_id?supabase.from('vendor_quotes').select('*').eq('id',PO.quote_id).maybeSingle():Promise.resolve({data:null})
    ]);
    a.forEach(x=>{if(x.error)throw x.error;});
    ITEMS=a[0].data||[];V=a[1].data;P=a[2].data;O=a[3].data;R=a[4].data;Q=a[5].data;paint();
  }catch(e){fail(e);}
}
function paint(){
  $('#pageTitle').textContent=PO.po_no||'Draft Purchase Order';
  $('#pageSub').textContent=[P?.project_no||P?.code,P?.name,V?.name].filter(Boolean).join(' · ');
  $('#sellerName').textContent=O?.trade_name||'Bind Builds';
  $('#sellerMeta').innerHTML=[O?.legal_name,O?.address,O?.city,O?.state,O?.gstin?'GSTIN '+O.gstin:null,O?.pan?'PAN '+O.pan:null].filter(Boolean).map(esc).join('<br>')||'Organisation profile incomplete';
  $('#poNo').textContent=PO.po_no||'DRAFT';
  $('#orderDate').textContent=PO.order_date?fmtDate(PO.order_date):'—';
  $('#expectedDate').textContent=PO.expected_date?fmtDate(PO.expected_date):'—';
  $('#vendorName').textContent=V?.name||'—';
  $('#vendorMeta').innerHTML=[V?.contact_person,V?.phone,V?.email,V?.gstin?'GSTIN '+V.gstin:null,V?.city].filter(Boolean).map(esc).join('<br>')||'—';
  $('#projectName').textContent=P?.name||'—';
  $('#deliveryMeta').innerHTML=[PO.delivery_address||P?.location,P?.project_no||P?.code].filter(Boolean).map(esc).join('<br>')||'—';
  $('#itemsBody').innerHTML=ITEMS.map((x,i)=>'<tr><td class="num">'+(i+1)+'</td><td class="desc"><b>'+esc(x.description)+'</b></td><td class="num">'+Number(x.qty)+'</td><td>'+esc(x.unit)+'</td><td class="num r">'+money(x.rate)+'</td><td class="num r">'+Number(x.gst_rate||0)+'%</td><td class="num r">'+money(x.amount)+'</td></tr>').join('');
  $('#totals').innerHTML=[['Subtotal',PO.subtotal],['GST',PO.tax_amount],['PO total',PO.total]].map((x,i,a)=>'<div class="tot__row '+(i===a.length-1?'grand':'')+'"><span>'+x[0]+'</span><span>'+money(x[1])+'</span></div>').join('');
  $('#terms').innerHTML=[PO.payment_terms?'Payment: '+PO.payment_terms:null,PO.expected_date?'Expected delivery: '+fmtDate(PO.expected_date):null,PO.notes].filter(Boolean).map(esc).join('<br>')||'—';
  $('#status').textContent=PO.status;$('#mrNo').textContent=R?.requisition_no||'—';$('#quoteRef').textContent=Q?.quote_ref||'—';
  $('#backBtn').onclick=()=>location.href='/procurement.html';$('#printBtn').onclick=()=>window.print();
  document.title=(PO.po_no||'Purchase Order')+' · Bind Build ERP';
}
await load();
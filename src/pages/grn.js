import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { fail, esc, fmtDate } from '../lib/ui.js';
const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'procurement',title:'Goods Receipt Note'});if(!user)throw new Error('redirecting');
const id=new URLSearchParams(location.search).get('id');
let G=null,ITEMS=[],PO=null,V=null,P=null,S=null,O=null;
async function load(){
  try{
    if(!id)throw new Error('Open a GRN from Procurement.');
    const g=await supabase.from('goods_receipts').select('*').eq('id',id).maybeSingle();if(g.error)throw g.error;if(!g.data)throw new Error('GRN not found');G=g.data;
    const a=await Promise.all([
      supabase.from('goods_receipt_items').select('*').eq('grn_id',id).order('created_at'),
      supabase.from('purchase_orders').select('*').eq('id',G.po_id).maybeSingle(),
      G.vendor_id?supabase.from('vendors').select('*').eq('id',G.vendor_id).maybeSingle():Promise.resolve({data:null}),
      supabase.from('projects').select('*').eq('id',G.project_id).maybeSingle(),
      supabase.from('stores').select('*').eq('id',G.store_id).maybeSingle(),
      supabase.from('organisation_profiles').select('*').eq('business_unit_id',G.business_unit_id).maybeSingle()
    ]);
    a.forEach(x=>{if(x.error)throw x.error;});ITEMS=a[0].data||[];PO=a[1].data;V=a[2].data;P=a[3].data;S=a[4].data;O=a[5].data;paint();
  }catch(e){fail(e);}
}
function paint(){
  $('#pageTitle').textContent='GRN '+G.grn_no;$('#pageSub').textContent=[P?.project_no||P?.code,P?.name].filter(Boolean).join(' · ');
  $('#sellerName').textContent=O?.trade_name||'Bind Builds';$('#sellerMeta').innerHTML=[O?.legal_name,O?.address,O?.city,O?.state,O?.gstin?'GSTIN '+O.gstin:null].filter(Boolean).map(esc).join('<br>')||'—';
  $('#grnNo').textContent=G.grn_no;$('#receiptDate').textContent=fmtDate(G.receipt_date);
  $('#vendorName').textContent=V?.name||'—';$('#deliveryInfo').innerHTML=[V?.gstin?'GSTIN '+V.gstin:null,G.delivery_challan_no?'DC '+G.delivery_challan_no:null,G.vehicle_no?'Vehicle '+G.vehicle_no:null].filter(Boolean).map(esc).join('<br>')||'—';
  $('#projectName').textContent=P?.name||'—';$('#storeInfo').innerHTML=[S?.name,S?.location,P?.location].filter(Boolean).map(esc).join('<br>')||'—';
  $('#itemsBody').innerHTML=ITEMS.map((x,i)=>'<tr><td class="num">'+(i+1)+'</td><td class="desc"><b>'+esc(x.description)+'</b></td><td class="num r">'+Number(x.ordered_qty)+'</td><td class="num r">'+Number(x.received_qty)+'</td><td class="num r">'+Number(x.accepted_qty)+'</td><td class="num r">'+Number(x.rejected_qty)+'</td><td>'+esc(x.unit)+'</td></tr>').join('');
  $('#qualityNote').textContent=G.quality_note||'No exception noted';$('#status').textContent=G.status;$('#poNo').textContent=PO?.po_no||'—';$('#dcNo').textContent=G.delivery_challan_no||'—';$('#vehicleNo').textContent=G.vehicle_no||'—';
  $('#poBtn').onclick=()=>PO?.id&&(location.href='/purchase-order.html?id='+PO.id);$('#printBtn').onclick=()=>window.print();document.title=G.grn_no+' · Bind Build ERP';
}
await load();
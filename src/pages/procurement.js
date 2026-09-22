import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit, activeUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'procurement',title:'Procurement'});
if(!user)throw new Error('redirecting');

const canRequest=['founder','admin','procurement','project_manager','site_engineer'].includes(user.role);
const canProcure=['founder','admin','procurement','project_manager'].includes(user.role);
const canApprove=['founder','admin','project_manager'].includes(user.role);
const canFinance=['founder','admin','finance'].includes(user.role);

const money=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});

let PROJECTS=[],VENDORS=[],MATERIALS=[],REQS=[],REQITEMS=[],QUOTES=[],QITEMS=[],POS=[],POITEMS=[],GRNS=[],BILLS=[],PAYMENTS=[];

const byId=(arr,id)=>arr.find(x=>x.id===id);
const reqItems=id=>REQITEMS.filter(x=>x.requisition_id===id);
const quotesFor=id=>QUOTES.filter(x=>x.requisition_id===id);
const poItems=id=>POITEMS.filter(x=>x.po_id===id);
const paymentsFor=id=>PAYMENTS.filter(x=>x.vendor_bill_id===id);
const reqValue=r=>reqItems(r.id).reduce((a,x)=>a+Number(x.qty||0)*Number(x.estimated_rate||0),0);

function pick(label,rows,fmt=x=>x.name){
  if(!rows.length){toast('No options available','err');return null;}
  const text=rows.map((x,i)=>(i+1)+'. '+fmt(x)).join('\n');
  const raw=prompt(label+'\n\n'+text);
  if(raw===null)return null;
  const n=Number(raw);
  if(!Number.isInteger(n)||n<1||n>rows.length){toast('Choose a valid number','err');return null;}
  return rows[n-1];
}

async function load(){
  try{
    const a=await Promise.all([
      scopeToUnit(supabase.from('projects').select('id,project_no,code,name,status,business_unit_id').is('deleted_at',null)).order('name'),
      scopeToUnit(supabase.from('vendors').select('*')).eq('status','active').order('name'),
      scopeToUnit(supabase.from('materials').select('*')).eq('status','active').order('name'),
      scopeToUnit(supabase.from('material_requisitions').select('*')).order('created_at',{ascending:false}),
      supabase.from('material_requisition_items').select('*').order('created_at'),
      supabase.from('vendor_quotes').select('*').order('created_at',{ascending:false}),
      supabase.from('vendor_quote_items').select('*').order('created_at'),
      scopeToUnit(supabase.from('purchase_orders').select('*')).order('created_at',{ascending:false}),
      supabase.from('po_items').select('*').order('created_at'),
      scopeToUnit(supabase.from('goods_receipts').select('*')).order('receipt_date',{ascending:false}).limit(30),
      scopeToUnit(supabase.from('vendor_bills').select('*')).order('created_at',{ascending:false}),
      supabase.from('vendor_payments').select('*').order('payment_date',{ascending:false})
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    [PROJECTS,VENDORS,MATERIALS,REQS,REQITEMS,QUOTES,QITEMS,POS,POITEMS,GRNS,BILLS,PAYMENTS]=a.map(r=>r.data||[]);
    render();
  }catch(e){fail(e);}
}

function render(){
  const openReq=REQS.filter(r=>!['closed','cancelled','rejected'].includes(r.status));
  const openPo=POS.filter(p=>!['delivered','cancelled'].includes(p.status));
  const approval=REQS.filter(r=>r.status==='submitted').length+POS.filter(p=>p.status==='approval').length;
  const committed=POS.filter(p=>['approved','ordered','partly_delivered','delivered'].includes(p.status)).reduce((a,p)=>a+Number(p.total||0),0);
  const month=today().slice(0,7);
  const grnMonth=GRNS.filter(g=>String(g.receipt_date).slice(0,7)===month).length;
  const payable=BILLS.filter(b=>['approved','part_paid'].includes(b.status)).reduce((a,b)=>a+Math.max(Number(b.total||0)-Number(b.amount_paid||0),0),0);

  $('#kReq').textContent=String(openReq.length);
  $('#kPO').textContent=money(committed);
  $('#kPOMeta').textContent=openPo.length+' open order'+(openPo.length===1?'':'s');
  $('#kApproval').textContent=String(approval);
  $('#kGRN').textContent=String(grnMonth);
  $('#kPayable').textContent=money(payable);

  renderReqs();renderQuotes();renderPOs();renderBills();renderApprovals();renderGRNs();renderVendors();
}

function status(s){return '<span class="s-status '+esc(s||'draft')+'">'+esc(String(s||'draft').replaceAll('_',' '))+'</span>';}

function renderReqs(){
  $('#reqCount').textContent=String(REQS.length);
  $('#reqBody').innerHTML=REQS.length?REQS.map(r=>{
    const p=byId(PROJECTS,r.project_id),items=reqItems(r.id),qs=quotesFor(r.id);
    let acts='';
    if(r.status==='draft'&&canRequest)acts='<button class="s-btn" data-req-add="'+r.id+'">+ Item</button><button class="s-btn primary" data-req-submit="'+r.id+'">Submit</button>';
    if(r.status==='submitted'&&canApprove)acts='<button class="s-btn primary" data-req-approve="'+r.id+'">Approve</button><button class="s-btn" data-req-reject="'+r.id+'">Reject</button>';
    if(['approved','sourcing'].includes(r.status)&&canProcure)acts='<button class="s-btn primary" data-quote-new="'+r.id+'">Add quote</button>';
    return '<tr><td><div class="s-doc">'+esc(r.requisition_no||'DRAFT MR')+'</div><div class="s-meta">'+esc(r.purpose||'Material requirement')+' · '+esc(r.priority)+'</div></td>'+
      '<td>'+esc(p?.name||'—')+'</td><td>'+(r.required_by?fmtDate(r.required_by):'—')+'</td>'+
      '<td>'+items.length+' · '+money(reqValue(r))+'<div class="s-meta">'+qs.length+' quote'+(qs.length===1?'':'s')+'</div></td><td>'+status(r.status)+'</td><td><div class="s-actions-inline">'+acts+'</div></td></tr>';
  }).join(''):'<tr><td colspan="6" class="s-empty">No material requisitions yet.</td></tr>';
}

function renderQuotes(){
  $('#quoteCount').textContent=String(QUOTES.length);
  $('#quoteBody').innerHTML=QUOTES.length?QUOTES.map(q=>{
    const r=byId(REQS,q.requisition_id),v=byId(VENDORS,q.vendor_id);
    const canSelect=canProcure&&['approved','sourcing'].includes(r?.status)&&q.status!=='selected'&&!POS.some(p=>p.quote_id===q.id);
    return '<tr><td><div class="s-doc">'+esc(r?.requisition_no||'MR')+'</div></td><td>'+esc(v?.name||'—')+'</td><td>'+esc(q.quote_ref||'—')+'</td>'+
      '<td>'+(q.delivery_days!=null?q.delivery_days+' days':'—')+'</td><td>'+esc(q.payment_terms||'—')+'</td><td class="num">'+money(q.total)+'</td>'+
      '<td><div class="s-actions-inline">'+status(q.status)+(canSelect?'<button class="s-btn primary" data-quote-select="'+q.id+'">Select</button>':'')+'</div></td></tr>';
  }).join(''):'<tr><td colspan="7" class="s-empty">Approved requisitions can collect vendor quotes here.</td></tr>';
}

function renderPOs(){
  $('#poCount').textContent=String(POS.length);
  $('#poBody').innerHTML=POS.length?POS.map(p=>{
    const pr=byId(PROJECTS,p.project_id),v=byId(VENDORS,p.vendor_id),items=poItems(p.id);
    let acts='';
    if(p.status==='draft'&&canProcure)acts='<button class="s-btn primary" data-po-submit="'+p.id+'">Send approval</button>';
    if(p.status==='approval'&&canApprove)acts='<button class="s-btn primary" data-po-approve="'+p.id+'">Approve</button>';
    if(p.status==='approved'&&canProcure)acts='<button class="s-btn primary" data-po-order="'+p.id+'">Mark ordered</button>';
    if(['approved','ordered','partly_delivered'].includes(p.status)&&canRequest)acts+=(acts?'':'')+'<button class="s-btn" data-grn="'+p.id+'">Receive</button>';
    if(['partly_delivered','delivered'].includes(p.status)&&['founder','admin','procurement','finance'].includes(user.role))acts+='<button class="s-btn" data-bill-new="'+p.id+'">Vendor bill</button>';
    const received=items.reduce((a,x)=>a+Number(x.received_qty||0),0),ordered=items.reduce((a,x)=>a+Number(x.qty||0),0);
    return '<tr><td><div class="s-doc">'+esc(p.po_no||'DRAFT PO')+'</div><div class="s-meta">'+items.length+' items · '+received+'/'+ordered+' received</div></td>'+
      '<td>'+esc(pr?.name||'—')+'</td><td>'+esc(v?.name||'—')+'</td><td class="num">'+money(p.total)+'</td><td>'+status(p.status)+'</td>'+
      '<td>'+(p.expected_date?fmtDate(p.expected_date):'—')+'</td><td><div class="s-actions-inline">'+acts+'</div></td></tr>';
  }).join(''):'<tr><td colspan="7" class="s-empty">No purchase orders yet.</td></tr>';
}

function renderBills(){
  $('#billCount').textContent=String(BILLS.length);
  $('#billBody').innerHTML=BILLS.length?BILLS.map(b=>{
    const v=byId(VENDORS,b.vendor_id),p=byId(PROJECTS,b.project_id);
    let acts='';
    if(b.status==='draft'&&['founder','admin','procurement','finance'].includes(user.role))acts='<button class="s-btn primary" data-bill-verify="'+b.id+'">Verify</button>';
    if(b.status==='verified'&&canFinance)acts='<button class="s-btn primary" data-bill-approve="'+b.id+'">Approve</button>';
    if(['approved','part_paid'].includes(b.status)&&canFinance)acts='<button class="s-btn primary" data-bill-pay="'+b.id+'">Record payment</button>';
    return '<tr><td><div class="s-doc">'+esc(b.internal_no||b.bill_no)+'</div><div class="s-meta">Vendor ref '+esc(b.bill_no)+'</div></td><td>'+esc(v?.name||'—')+'</td><td>'+esc(p?.name||'—')+'</td>'+
      '<td class="num">'+money(b.total)+'</td><td class="num">'+money(b.amount_paid)+'</td><td>'+status(b.status)+'</td><td><div class="s-actions-inline">'+acts+'</div></td></tr>';
  }).join(''):'<tr><td colspan="7" class="s-empty">No vendor bills yet.</td></tr>';
}

function renderApprovals(){
  const rs=REQS.filter(r=>r.status==='submitted'),ps=POS.filter(p=>p.status==='approval');
  const rows=[
    ...rs.map(r=>({t:r.requisition_no||'MR',m:(byId(PROJECTS,r.project_id)?.name||'Project')+' · '+money(reqValue(r)),action:'req',id:r.id})),
    ...ps.map(p=>({t:p.po_no||'PO approval',m:(byId(VENDORS,p.vendor_id)?.name||'Vendor')+' · '+money(p.total),action:'po',id:p.id}))
  ];
  $('#approvalTag').textContent=String(rows.length);
  $('#approvalList').innerHTML=rows.length?rows.map(x=>'<div class="s-list-row"><div class="s-list-body"><div class="s-list-title">'+esc(x.t)+'</div><div class="s-list-meta">'+esc(x.m)+'</div></div>'+(canApprove?'<button class="s-btn primary" data-quick-approve="'+x.action+':'+x.id+'">Approve</button>':'')+'</div>').join(''):'<div class="s-empty">Nothing awaiting approval.</div>';
}

function renderGRNs(){
  $('#grnList').innerHTML=GRNS.length?GRNS.slice(0,8).map(g=>{
    const p=byId(PROJECTS,g.project_id),v=byId(VENDORS,g.vendor_id);
    return '<div class="s-list-row"><div class="s-list-body"><div class="s-list-title">'+esc(g.grn_no)+'</div><div class="s-list-meta">'+esc(p?.name||'Project')+' · '+esc(v?.name||'Vendor')+' · '+fmtDate(g.receipt_date)+'</div></div>'+status(g.status)+'</div>';
  }).join(''):'<div class="s-empty">No goods receipts yet.</div>';
}

function renderVendors(){
  const spend=new Map();
  POS.forEach(p=>spend.set(p.vendor_id,(spend.get(p.vendor_id)||0)+Number(p.total||0)));
  const rows=[...spend].map(([id,val])=>({v:byId(VENDORS,id),val})).filter(x=>x.v).sort((a,b)=>b.val-a.val).slice(0,8);
  const max=Math.max(...rows.map(x=>x.val),1);
  $('#vendorList').innerHTML=rows.length?rows.map(x=>'<div class="s-list-row"><div class="s-list-body"><div class="s-list-title">'+esc(x.v.name)+'</div><div class="s-list-meta">'+money(x.val)+' committed</div><div class="s-vbar"><span style="width:'+Math.round(x.val/max*100)+'%"></span></div></div></div>').join(''):'<div class="s-empty">Vendor spend appears after PO approval.</div>';
}

async function newVendor(){
  if(!['founder','admin','procurement'].includes(user.role))return toast('Procurement access required','err');
  const name=prompt('Vendor / supplier name');if(!name)return;
  const category=prompt('Category','Building Materials')||null;
  const contact=prompt('Contact person')||null;
  const phone=prompt('Phone')||null;
  const email=prompt('Email')||null;
  const gstin=(prompt('GSTIN (optional)')||'').trim().toUpperCase()||null;
  if(gstin&&!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin))return toast('GSTIN format looks invalid','err');
  const terms=prompt('Payment terms','30 days')||null;
  const r=await supabase.from('vendors').insert({business_unit_id:activeUnit(),name:name.trim(),category,contact_person:contact,phone,email,gstin,payment_terms:terms}).select('*').single();
  if(r.error)return fail(r.error);toast('Vendor added');await load();
}

async function newReq(){
  if(!canRequest)return toast('Requisition access denied','err');
  const project=pick('Choose project number',PROJECTS,p=>(p.project_no||p.code)+' · '+p.name);if(!project)return;
  const purpose=prompt('Purpose / work package','Site material requirement');if(purpose===null)return;
  const required=prompt('Required by (YYYY-MM-DD)',today());if(required===null)return;
  const priority=(prompt('Priority: low / normal / high / urgent','normal')||'normal').toLowerCase();
  if(!['low','normal','high','urgent'].includes(priority))return toast('Invalid priority','err');
  const r=await supabase.from('material_requisitions').insert({business_unit_id:project.business_unit_id||activeUnit(),project_id:project.id,purpose:purpose||null,required_by:required||null,priority,status:'draft'}).select('*').single();
  if(r.error)return fail(r.error);
  await addReqItem(r.data.id,true);
  toast('Requisition draft created');await load();
}

async function addReqItem(reqId,first=false){
  const req=byId(REQS,reqId);
  let mat=null;
  if(MATERIALS.length){
    const raw=prompt('Material: enter number, or 0 for custom\n\n0. Custom item\n'+MATERIALS.map((m,i)=>(i+1)+'. '+m.name+' · '+m.unit).join('\n'));
    if(raw===null)return;
    const n=Number(raw);if(n>0&&n<=MATERIALS.length)mat=MATERIALS[n-1];
  }
  const description=mat?.name||prompt('Material / item description');if(!description)return;
  const qty=Number(prompt('Required quantity','1'));if(!Number.isFinite(qty)||qty<=0)return toast('Quantity must be positive','err');
  const unit=mat?.unit||prompt('Unit','nos')||'nos';
  const rate=Number(prompt('Estimated rate per '+unit,String(mat?.default_rate||0)))||0;
  const r=await supabase.from('material_requisition_items').insert({requisition_id:reqId,material_id:mat?.id||null,description,qty,unit,estimated_rate:rate});
  if(r.error)return fail(r.error);
  if(first&&confirm('Add another material?'))await addReqItem(reqId,false);
  if(!first){toast('Requisition item added');await load();}
}

async function submitReq(id){
  const r=await supabase.rpc('submit_material_requisition',{p_requisition_id:id});
  if(r.error)return fail(r.error);toast('Requisition submitted');await load();
}
async function reviewReq(id,approve){
  const reason=approve?null:prompt('Rejection reason');if(!approve&&!reason)return;
  const r=await supabase.rpc('review_material_requisition',{p_requisition_id:id,p_approve:approve,p_reason:reason});
  if(r.error)return fail(r.error);toast(approve?'Requisition approved':'Requisition rejected');await load();
}

async function newQuote(reqId){
  if(!canProcure)return toast('Procurement access required','err');
  const req=byId(REQS,reqId),items=reqItems(reqId);if(!req||!items.length)return toast('Requisition has no items','err');
  if(!VENDORS.length)return toast('Add a vendor first','err');
  const vendor=pick('Choose vendor number',VENDORS,v=>v.name+' · '+(v.category||'Vendor'));if(!vendor)return;
  const ref=prompt('Vendor quotation reference')||null;
  const daysRaw=prompt('Delivery lead time (days)','7');if(daysRaw===null)return;
  const days=daysRaw===''?null:Number(daysRaw);if(days!=null&&(!Number.isFinite(days)||days<0))return toast('Invalid delivery days','err');
  const terms=prompt('Payment terms',vendor.payment_terms||'30 days')||null;

  const qr=await supabase.from('vendor_quotes').insert({requisition_id:reqId,vendor_id:vendor.id,quote_ref:ref,quote_date:today(),delivery_days:days,payment_terms:terms,status:'received'}).select('*').single();
  if(qr.error)return fail(qr.error);

  let subtotal=0,tax=0;
  for(const it of items){
    const mat=byId(MATERIALS,it.material_id);
    const rateRaw=prompt('Rate for '+it.description+' ('+it.qty+' '+it.unit+')',String(it.estimated_rate||mat?.default_rate||0));
    if(rateRaw===null)return toast('Quote created; finish rates by adding a new quote if needed','err');
    const rate=Number(rateRaw)||0;
    const gst=Number(prompt('GST % for '+it.description,String(mat?.gst_rate??18)))||0;
    const amount=Number(it.qty)*rate;subtotal+=amount;tax+=amount*gst/100;
    const ir=await supabase.from('vendor_quote_items').insert({quote_id:qr.data.id,requisition_item_id:it.id,material_id:it.material_id,description:it.description,qty:it.qty,unit:it.unit,rate,gst_rate:gst});
    if(ir.error)return fail(ir.error);
  }
  const ur=await supabase.from('vendor_quotes').update({subtotal:Math.round(subtotal*100)/100,tax_amount:Math.round(tax*100)/100,total:Math.round((subtotal+tax)*100)/100}).eq('id',qr.data.id);
  if(ur.error)return fail(ur.error);
  await supabase.from('material_requisitions').update({status:'sourcing',updated_at:new Date().toISOString()}).eq('id',reqId);
  toast('Vendor quotation recorded');await load();
}

async function selectQuote(id){
  const r=await supabase.rpc('create_po_from_quote',{p_quote_id:id});
  if(r.error)return fail(r.error);
  const poId=r.data;
  const s=await supabase.rpc('submit_purchase_order',{p_po_id:poId});
  if(s.error)return fail(s.error);
  toast('Quote selected · PO sent for approval');await load();
}
async function approvePO(id){
  const r=await supabase.rpc('approve_purchase_order',{p_po_id:id});
  if(r.error)return fail(r.error);toast('Purchase order approved '+(r.data?.po_no||''));await load();
}
async function orderPO(id){
  const r=await supabase.rpc('mark_purchase_order_ordered',{p_po_id:id});
  if(r.error)return fail(r.error);toast('Purchase order marked ordered');await load();
}

async function receivePO(id){
  const po=byId(POS,id),items=poItems(id);if(!po||!items.length)return;
  const sr=await supabase.rpc('ensure_project_store',{p_project_id:po.project_id});
  if(sr.error)return fail(sr.error);
  const storeId=sr.data;
  const received=[];
  for(const it of items){
    const out=Math.max(Number(it.qty)-Number(it.received_qty||0),0);
    if(out<=0)continue;
    const raw=prompt('Receive '+it.description+'\nOutstanding '+out+' '+it.unit+'\nEnter received quantity',String(out));
    if(raw===null)continue;
    const qty=Number(raw);if(!Number.isFinite(qty)||qty<=0)continue;
    const accRaw=prompt('Accepted quantity after quality check',String(qty));
    if(accRaw===null)continue;
    const accepted=Number(accRaw);if(!Number.isFinite(accepted)||accepted<0||accepted>qty)return toast('Accepted quantity is invalid','err');
    received.push({po_item_id:it.id,received_qty:qty,accepted_qty:accepted,remarks:accepted<qty?'Partly rejected at receipt':null});
  }
  if(!received.length)return toast('No receipt quantity entered','err');
  const dc=prompt('Delivery challan / DC number')||null;
  const vehicle=prompt('Vehicle number (optional)')||null;
  const note=prompt('Quality / receipt note (optional)')||null;
  const r=await supabase.rpc('post_goods_receipt',{p_po_id:id,p_store_id:storeId,p_items:received,p_receipt_date:today(),p_delivery_challan_no:dc,p_vehicle_no:vehicle,p_quality_note:note});
  if(r.error)return fail(r.error);
  const row=Array.isArray(r.data)?r.data[0]:r.data;
  toast('Goods received · '+(row?.grn_no||'GRN'));await load();
}

async function newBill(poId){
  const po=byId(POS,poId);if(!po)return;
  const billNo=prompt('Vendor invoice / bill number');if(!billNo)return;
  const subtotal=Number(prompt('Taxable amount',String(po.subtotal||0)))||0;
  const tax=Number(prompt('GST / tax amount',String(po.tax_amount||0)))||0;
  const total=Number(prompt('Bill total',String(subtotal+tax)))||0;
  if(total<0)return toast('Invalid bill total','err');
  const due=prompt('Due date (YYYY-MM-DD)',po.expected_date||today())||null;
  const grn=GRNS.find(g=>g.po_id===poId);
  const r=await supabase.from('vendor_bills').insert({business_unit_id:po.business_unit_id,vendor_id:po.vendor_id,project_id:po.project_id,po_id:po.id,grn_id:grn?.id||null,bill_no:billNo.trim(),bill_date:today(),due_date:due,subtotal,tax_amount:tax,total,status:'draft'}).select('*').single();
  if(r.error)return fail(r.error);toast('Vendor bill captured');await load();
}
async function verifyBill(id){
  const r=await supabase.from('vendor_bills').update({status:'verified',updated_at:new Date().toISOString()}).eq('id',id);
  if(r.error)return fail(r.error);toast('Vendor bill verified');await load();
}
async function approveBill(id){
  const r=await supabase.rpc('approve_vendor_bill',{p_bill_id:id});
  if(r.error)return fail(r.error);toast('Vendor bill approved '+(r.data?.internal_no||''));await load();
}
async function payBill(id){
  const b=byId(BILLS,id),bal=Math.max(Number(b.total)-Number(b.amount_paid||0),0);
  const raw=prompt('Payment amount\nOutstanding '+money(bal),String(bal));if(raw===null)return;
  const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0)return toast('Invalid payment amount','err');
  const mode=prompt('Payment mode','bank_transfer')||'bank_transfer';
  const ref=prompt('UTR / transaction reference')||null;
  const r=await supabase.rpc('record_vendor_payment',{p_bill_id:id,p_amount:amount,p_payment_date:today(),p_payment_mode:mode,p_reference_no:ref,p_notes:null});
  if(r.error)return fail(r.error);toast('Vendor payment recorded');await load();
}

$('#vendorBtn').addEventListener('click',newVendor);
$('#inventoryBtn').addEventListener('click',()=>location.href='/inventory.html');
$('#newReqBtn').addEventListener('click',newReq);

document.addEventListener('click',e=>{
  const target=e.target.closest('[data-req-add],[data-req-submit],[data-req-approve],[data-req-reject],[data-quote-new],[data-quote-select],[data-po-submit],[data-po-approve],[data-po-order],[data-grn],[data-bill-new],[data-bill-verify],[data-bill-approve],[data-bill-pay],[data-quick-approve]');
  if(!target)return;
  if(target.dataset.reqAdd)return addReqItem(target.dataset.reqAdd);
  if(target.dataset.reqSubmit)return submitReq(target.dataset.reqSubmit);
  if(target.dataset.reqApprove)return reviewReq(target.dataset.reqApprove,true);
  if(target.dataset.reqReject)return reviewReq(target.dataset.reqReject,false);
  if(target.dataset.quoteNew)return newQuote(target.dataset.quoteNew);
  if(target.dataset.quoteSelect)return selectQuote(target.dataset.quoteSelect);
  if(target.dataset.poSubmit)return supabase.rpc('submit_purchase_order',{p_po_id:target.dataset.poSubmit}).then(async r=>{if(r.error)return fail(r.error);toast('PO sent for approval');await load();});
  if(target.dataset.poApprove)return approvePO(target.dataset.poApprove);
  if(target.dataset.poOrder)return orderPO(target.dataset.poOrder);
  if(target.dataset.grn)return receivePO(target.dataset.grn);
  if(target.dataset.billNew)return newBill(target.dataset.billNew);
  if(target.dataset.billVerify)return verifyBill(target.dataset.billVerify);
  if(target.dataset.billApprove)return approveBill(target.dataset.billApprove);
  if(target.dataset.billPay)return payBill(target.dataset.billPay);
  if(target.dataset.quickApprove){const [kind,id]=target.dataset.quickApprove.split(':');return kind==='req'?reviewReq(id,true):approvePO(id);}
});

await load();

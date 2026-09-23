async function newBill(poId){
  const po=byId(POS,poId);if(!po)return;
  const related=GRNS.filter(g=>g.po_id===poId&&g.status==='accepted');
  if(!related.length)return toast('Post a GRN before capturing the vendor bill','err');

  const gi=await supabase.from('goods_receipt_items').select('*').in('grn_id',related.map(g=>g.id));
  if(gi.error)return fail(gi.error);
  const acceptedValue=(gi.data||[]).reduce((a,x)=>{
    const item=byId(POITEMS,x.po_item_id);
    return a+Number(x.accepted_qty||0)*Number(item?.rate||x.rate||0)*(1+Number(item?.gst_rate||0)/100);
  },0);
  const prior=BILLS.filter(b=>b.po_id===poId&&!['cancelled','disputed'].includes(b.status)).reduce((a,b)=>a+Number(b.total||0),0);
  const available=Math.max(acceptedValue-prior,0);
  if(available<=0.01)return toast('No unbilled accepted GRN value remains','err');

  const billNo=prompt('Vendor invoice / bill number');if(!billNo)return;
  const totalRaw=prompt('Bill total\nMaximum matched to accepted GRN: '+money(available),String(Math.round(available*100)/100));
  if(totalRaw===null)return;
  const total=Number(totalRaw);if(!Number.isFinite(total)||total<=0||total>available+0.01)return toast('Bill exceeds accepted GRN value','err');

  const ratio=Number(po.total)>0?Math.max(0,Math.min(1,Number(po.subtotal||0)/Number(po.total))):1;
  const defSubtotal=Math.round(total*ratio*100)/100;
  const subtotal=Number(prompt('Taxable amount',String(defSubtotal)));if(!Number.isFinite(subtotal)||subtotal<0)return toast('Invalid taxable amount','err');
  const tax=Number(prompt('GST / tax amount',String(Math.round((total-subtotal)*100)/100)));if(!Number.isFinite(tax)||tax<0)return toast('Invalid tax amount','err');
  if(Math.abs((subtotal+tax)-total)>0.02)return toast('Taxable + tax must equal bill total','err');

  const due=prompt('Due date (YYYY-MM-DD)',po.expected_date||today())||null;
  const grn=related.at(-1);
  const r=await supabase.from('vendor_bills').insert({
    business_unit_id:po.business_unit_id,vendor_id:po.vendor_id,project_id:po.project_id,
    po_id:po.id,grn_id:grn?.id||null,bill_no:billNo.trim(),bill_date:today(),due_date:due,
    subtotal,tax_amount:tax,total,status:'draft'
  }).select('*').single();
  if(r.error)return fail(r.error);toast('Vendor bill captured');await load();
}
import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit, activeUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'procurement',title:'Procurement'});
if(!user)throw new Error('redirecting');

const canProc=['founder','admin','procurement','project_manager'].includes(user.role);
const canSite=['founder','admin','procurement','project_manager','site_engineer'].includes(user.role);
const canManager=['founder','admin','project_manager'].includes(user.role);
const canFinance=['founder','admin','finance'].includes(user.role);
const money=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const projectHint=new URLSearchParams(location.search).get('project');

let PROJECTS=[],VENDORS=[],MATERIALS=[],REQS=[],REQITEMS=[],QUOTES=[],QUOTEITEMS=[],POS=[],POITEMS=[],GRNS=[],BILLS=[],PAYMENTS=[];

function byId(rows,id){return rows.find(x=>x.id===id);}
function reqItems(id){return REQITEMS.filter(x=>x.requisition_id===id);}
function quoteItems(id){return QUOTEITEMS.filter(x=>x.quote_id===id);}
function poItems(id){return POITEMS.filter(x=>x.po_id===id);}
function billPayments(id){return PAYMENTS.filter(x=>x.vendor_bill_id===id);}
function promptChoice(title,rows,label){
  if(!rows.length){toast('Nothing available for '+title,'err');return null;}
  const text=rows.map((x,i)=>(i+1)+'. '+label(x)).join('\n');
  const raw=prompt(title+'\n\n'+text+'\n\nEnter number');
  if(raw===null)return null;
  const n=Number(raw);
  return Number.isInteger(n)&&n>=1&&n<=rows.length?rows[n-1]:null;
}

async function load(){
  try{
    const a=await Promise.all([
      scopeToUnit(supabase.from('projects').select('id,business_unit_id,project_no,code,name,location,status').is('deleted_at',null)).order('name'),
      scopeToUnit(supabase.from('vendors').select('*')).eq('status','active').order('name'),
      scopeToUnit(supabase.from('materials').select('*')).eq('status','active').order('name'),
      scopeToUnit(supabase.from('material_requisitions').select('*')).order('created_at',{ascending:false}),
      supabase.from('material_requisition_items').select('*').order('created_at'),
      supabase.from('vendor_quotes').select('*').order('created_at',{ascending:false}),
      supabase.from('vendor_quote_items').select('*').order('created_at'),
      scopeToUnit(supabase.from('purchase_orders').select('*')).order('created_at',{ascending:false}),
      supabase.from('po_items').select('*').order('created_at'),
      scopeToUnit(supabase.from('goods_receipts').select('*')).order('receipt_date',{ascending:false}).limit(30),
      scopeToUnit(supabase.from('vendor_bills').select('*')).order('bill_date',{ascending:false}),
      supabase.from('vendor_payments').select('*').order('payment_date',{ascending:false})
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    [PROJECTS,VENDORS,MATERIALS,REQS,REQITEMS,QUOTES,QUOTEITEMS,POS,POITEMS,GRNS,BILLS,PAYMENTS]=a.map(r=>r.data||[]);
    render();
  }catch(e){fail(e);}
}

function render(){
  const openReq=REQS.filter(r=>!['closed','cancelled','rejected'].includes(r.status));
  const openPo=POS.filter(p=>!['delivered','cancelled'].includes(p.status));
  const pending=REQS.filter(r=>r.status==='submitted').length+POS.filter(p=>p.status==='approval').length;
  const month=today().slice(0,7);
  const monthGrn=GRNS.filter(g=>String(g.receipt_date).slice(0,7)===month).length;
  const payable=BILLS.filter(b=>['approved','part_paid'].includes(b.status)).reduce((a,b)=>a+Math.max(0,Number(b.total)-Number(b.amount_paid)),0);
  $('#kReq').textContent=String(openReq.length);
  $('#kPO').textContent=money(openPo.reduce((a,p)=>a+Number(p.total||0),0));
  $('#kPOMeta').textContent=openPo.length+' open order'+(openPo.length===1?'':'s');
  $('#kApproval').textContent=String(pending);
  $('#kGRN').textContent=String(monthGrn);
  $('#kPayable').textContent=money(payable);
  renderReqs();renderQuotes();renderPOs();renderBills();renderApprovals();renderGRNs();renderVendors();
  $('#newReqBtn').disabled=!canSite;
  $('#vendorBtn').disabled=!['founder','admin','procurement'].includes(user.role);
}

function renderReqs(){
  $('#reqCount').textContent=String(REQS.length);
  $('#reqBody').innerHTML=REQS.length?REQS.map(r=>{
    const items=reqItems(r.id),estimate=items.reduce((a,x)=>a+Number(x.qty)*Number(x.estimated_rate||0),0);
    const project=byId(PROJECTS,r.project_id);
    let actions='';
    if(r.status==='draft'&&canSite)actions='<button class="s-btn primary" data-submit-req="'+r.id+'">Submit</button>';
    if(r.status==='submitted'&&canManager)actions='<button class="s-btn primary" data-approve-req="'+r.id+'">Approve</button><button class="s-btn" data-reject-req="'+r.id+'">Reject</button>';
    if(['approved','sourcing'].includes(r.status)&&canProc)actions='<button class="s-btn primary" data-rfq="'+r.id+'">Send RFQ</button><button class="s-btn" data-add-quote="'+r.id+'">Record quote</button>';
    return '<tr><td><div class="s-doc">'+esc(r.requisition_no||'DRAFT MR')+'</div><div class="s-meta">'+esc(r.priority||'normal')+' · '+esc(r.purpose||'No purpose')+'</div></td><td>'+esc(project?.name||'—')+'</td><td>'+(r.required_by?fmtDate(r.required_by):'—')+'</td><td>'+items.length+' item'+(items.length===1?'':'s')+'<div class="s-meta">'+money(estimate)+'</div></td><td><span class="s-status '+esc(r.status)+'">'+esc(r.status)+'</span></td><td><div class="s-actions-inline">'+actions+'</div></td></tr>';
  }).join(''):'<tr><td colspan="6"><div class="s-empty">No material requisitions yet.</div></td></tr>';
}

function renderQuotes(){
  $('#quoteCount').textContent=String(QUOTES.length);
  $('#quoteBody').innerHTML=QUOTES.length?QUOTES.map(q=>{
    const r=byId(REQS,q.requisition_id),v=byId(VENDORS,q.vendor_id);
    let action='';
    if(['approved','sourcing'].includes(r?.status)&&['received','shortlisted'].includes(q.status)&&canProc)action='<button class="s-btn primary" data-create-po="'+q.id+'">Prepare PO</button>';
    return '<tr><td><div class="s-doc">'+esc(r?.requisition_no||'MR')+'</div><div class="s-meta">'+quoteItems(q.id).length+' items</div></td><td>'+esc(v?.name||'—')+'</td><td>'+esc(q.quote_ref||'—')+'</td><td>'+(q.delivery_days!=null?q.delivery_days+' days':'—')+'</td><td>'+esc(q.payment_terms||'—')+'</td><td class="num"><b>'+money(q.total)+'</b></td><td><div class="s-actions-inline">'+action+'</div></td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="s-empty">Approved requisitions can collect vendor quotations here.</div></td></tr>';
}

function renderPOs(){
  $('#poCount').textContent=String(POS.length);
  $('#poBody').innerHTML=POS.length?POS.map(p=>{
    const pr=byId(PROJECTS,p.project_id),v=byId(VENDORS,p.vendor_id);
    let actions='';
    if(p.status==='draft'&&canProc)actions='<button class="s-btn primary" data-submit-po="'+p.id+'">Submit approval</button>';
    if(p.status==='approval'&&canManager)actions='<button class="s-btn primary" data-approve-po="'+p.id+'">Approve</button>';
    if(p.status==='approved'&&canProc)actions='<button class="s-btn primary" data-order-po="'+p.id+'">Mark ordered</button>';
    if(['approved','ordered','partly_delivered'].includes(p.status)&&canSite)actions+='<button class="s-btn" data-grn="'+p.id+'">Receive / GRN</button>';
    if(['partly_delivered','delivered'].includes(p.status)&&canProc)actions+='<button class="s-btn" data-bill="'+p.id+'">Vendor bill</button>';
    return '<tr><td><div class="s-doc">'+esc(p.po_no||'DRAFT PO')+'</div><div class="s-meta">'+poItems(p.id).length+' lines</div></td><td>'+esc(pr?.name||'—')+'</td><td>'+esc(v?.name||'—')+'</td><td class="num"><b>'+money(p.total)+'</b></td><td><span class="s-status '+esc(p.status)+'">'+esc(p.status)+'</span></td><td>'+(p.expected_date?fmtDate(p.expected_date):'—')+'</td><td><div class="s-actions-inline">'+actions+'</div></td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="s-empty">No purchase orders.</div></td></tr>';
}

function renderBills(){
  $('#billCount').textContent=String(BILLS.length);
  $('#billBody').innerHTML=BILLS.length?BILLS.map(b=>{
    const v=byId(VENDORS,b.vendor_id),p=byId(PROJECTS,b.project_id);
    let actions='';
    if(['draft','verified'].includes(b.status)&&canFinance)actions='<button class="s-btn primary" data-approve-bill="'+b.id+'">Approve bill</button>';
    if(['approved','part_paid'].includes(b.status)&&canFinance)actions='<button class="s-btn primary" data-pay-bill="'+b.id+'">Record payment</button>';
    return '<tr><td><div class="s-doc">'+esc(b.internal_no||'UNPOSTED')+'</div><div class="s-meta">Vendor '+esc(b.bill_no)+'</div></td><td>'+esc(v?.name||'—')+'</td><td>'+esc(p?.name||'—')+'</td><td class="num">'+money(b.total)+'</td><td class="num">'+money(b.amount_paid)+'</td><td><span class="s-status '+esc(b.status)+'">'+esc(b.status)+'</span></td><td><div class="s-actions-inline">'+actions+'</div></td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="s-empty">No vendor bills.</div></td></tr>';
}

function renderApprovals(){
  const rows=[
    ...REQS.filter(r=>r.status==='submitted').map(r=>({type:'MR',id:r.id,title:r.requisition_no||'Submitted MR',meta:byId(PROJECTS,r.project_id)?.name||'Project'})),
    ...POS.filter(p=>p.status==='approval').map(p=>({type:'PO',id:p.id,title:p.po_no||'Draft PO',meta:(byId(VENDORS,p.vendor_id)?.name||'Vendor')+' · '+money(p.total)}))
  ];
  $('#approvalTag').textContent=String(rows.length);
  $('#approvalList').innerHTML=rows.length?rows.map(x=>'<div class="s-list-row"><div class="s-list-body"><div class="s-list-title">'+esc(x.type+' · '+x.title)+'</div><div class="s-list-meta">'+esc(x.meta)+'</div></div></div>').join(''):'<div class="s-empty">Nothing awaiting management approval.</div>';
}

function renderGRNs(){
  $('#grnList').innerHTML=GRNS.length?GRNS.slice(0,8).map(g=>{
    const v=byId(VENDORS,g.vendor_id),p=byId(PROJECTS,g.project_id);
    return '<div class="s-list-row"><div class="s-list-body"><div class="s-list-title">'+esc(g.grn_no)+'</div><div class="s-list-meta">'+esc(p?.name||'Project')+' · '+esc(v?.name||'Vendor')+' · '+fmtDate(g.receipt_date)+'</div></div><span class="s-status '+esc(g.status)+'">'+esc(g.status)+'</span></div>';
  }).join(''):'<div class="s-empty">No goods receipts yet.</div>';
}

function renderVendors(){
  const spend=new Map();
  POS.forEach(p=>spend.set(p.vendor_id,(spend.get(p.vendor_id)||0)+Number(p.total||0)));
  const rows=[...spend.entries()].sort((a,b)=>b[1]-a[1]).slice(0,7);
  const top=Math.max(1,...rows.map(x=>x[1]));
  $('#vendorList').innerHTML=rows.length?rows.map(([id,val])=>{
    const v=byId(VENDORS,id);return '<div class="s-list-row"><div class="s-list-body"><div class="s-list-title">'+esc(v?.name||'Vendor')+'</div><div class="s-list-meta">'+money(val)+'</div><div class="s-vbar"><span style="width:'+Math.round(val/top*100)+'%"></span></div></div>'+(['founder','admin','procurement'].includes(user.role)?'<button class="s-btn" data-vendor-portal="'+id+'">Portal</button>':'')+'</div>';
  }).join(''):'<div class="s-empty">Vendor ranking begins with purchase orders.</div>';
}

async function newVendor(){
  const name=prompt('Vendor / supplier name');if(!name)return;
  const category=prompt('Category e.g. Cement, Steel, RMC, Electrical, Plumbing')||null;
  const contact=prompt('Contact person')||null;
  const phone=prompt('Mobile number')||null;
  const email=prompt('Email')||null;
  const gstin=(prompt('GSTIN (optional)')||'').trim().toUpperCase()||null;
  if(gstin&&!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin))return toast('GSTIN format looks invalid','err');
  const terms=prompt('Default payment terms','30 days')||null;
  const r=await supabase.from('vendors').insert({business_unit_id:activeUnit(),name:name.trim(),category,contact_person:contact,phone,email,gstin,payment_terms:terms,status:'active'}).select('*').single();
  if(r.error)return fail(r.error);toast('Vendor added');await load();
}

async function newRequisition(){
  const project=(projectHint&&PROJECTS.find(p=>p.id===projectHint))||promptChoice('Choose project',PROJECTS,p=>(p.project_no||p.code)+' · '+p.name);if(!project)return;
  const purpose=prompt('Purpose / work package','Site material requirement')||null;
  const required=prompt('Required by date (YYYY-MM-DD)',today())||null;
  const priority=(prompt('Priority: low / normal / high / urgent','normal')||'normal').toLowerCase();
  const rr=await supabase.from('material_requisitions').insert({business_unit_id:project.business_unit_id||activeUnit(),project_id:project.id,required_by:required,purpose,priority,status:'draft'}).select('*').single();
  if(rr.error)return fail(rr.error);
  const req=rr.data;
  let count=0;
  while(true){
    const pick=promptChoice('Select material for item '+(count+1)+' (Cancel to enter free description)',MATERIALS,m=>m.name+' · '+m.unit);
    let material_id=null,description='',unit='nos',rate=0;
    if(pick){material_id=pick.id;description=pick.name;unit=pick.unit;rate=Number(pick.default_rate||0);}
    else{
      description=prompt('Material / item description');if(!description)break;
      unit=prompt('Unit','nos')||'nos';rate=Number(prompt('Estimated rate',0)||0);
    }
    const qty=Number(prompt('Required quantity',1));if(!Number.isFinite(qty)||qty<=0){toast('Quantity must be positive','err');continue;}
    const ir=await supabase.from('material_requisition_items').insert({requisition_id:req.id,material_id,description,qty,unit,estimated_rate:rate});
    if(ir.error)return fail(ir.error);count++;
    if(!confirm('Add another material?'))break;
  }
  if(!count){await supabase.from('material_requisitions').delete().eq('id',req.id);return toast('Requisition cancelled — no items added','err');}
  if(confirm('Submit this requisition for approval now?')){
    const s=await supabase.rpc('submit_material_requisition',{p_requisition_id:req.id});if(s.error)return fail(s.error);
    toast(s.data.requisition_no+' submitted');
  }else toast('Draft requisition saved');
  await load();
}

async function submitReq(id){const r=await supabase.rpc('submit_material_requisition',{p_requisition_id:id});if(r.error)return fail(r.error);toast(r.data.requisition_no+' submitted');await load();}
async function reviewReq(id,approve){const reason=approve?null:prompt('Reason for rejection');if(!approve&&!reason)return;const r=await supabase.rpc('review_material_requisition',{p_requisition_id:id,p_approve:approve,p_reason:reason});if(r.error)return fail(r.error);toast(approve?'Requisition approved':'Requisition rejected');await load();}

async function sendRfq(reqId){
  const req=byId(REQS,reqId);if(!req)return;
  const vendor=promptChoice('Choose vendor for RFQ',VENDORS,v=>v.name+(v.email?' · '+v.email:' · no email'));if(!vendor)return;
  let email=vendor.email||'';
  if(!email){email=(prompt('Vendor email required for portal access')||'').trim();if(!email)return toast('Vendor email is required','err');const u=await supabase.from('vendors').update({email,updated_at:new Date().toISOString()}).eq('id',vendor.id);if(u.error)return fail(u.error);vendor.email=email;}
  const due=prompt('Quotation due date (YYYY-MM-DD)',req.required_by||today())||null;
  const note=prompt('RFQ note (optional)',req.purpose||'')||null;
  const access=await supabase.rpc('invite_portal_member',{p_portal_type:'vendor',p_entity_id:vendor.id,p_email:email,p_display_name:vendor.contact_person||vendor.name});
  if(access.error)return fail(access.error);
  const r=await supabase.rpc('invite_vendor_rfq',{p_requisition_id:reqId,p_vendor_id:vendor.id,p_due_date:due,p_note:note});
  if(r.error)return fail(r.error);
  const link=location.origin+'/vendor-portal.html';
  try{await navigator.clipboard.writeText(link);toast('RFQ sent to portal · vendor link copied');}catch{toast('RFQ sent to vendor portal');}
  await load();
}

async function inviteVendorPortal(vendorId){
  const vendor=byId(VENDORS,vendorId);if(!vendor)return;
  let email=(vendor.email||prompt('Vendor portal email')||'').trim();if(!email)return;
  if(!vendor.email){const u=await supabase.from('vendors').update({email,updated_at:new Date().toISOString()}).eq('id',vendor.id);if(u.error)return fail(u.error);}
  const r=await supabase.rpc('invite_portal_member',{p_portal_type:'vendor',p_entity_id:vendor.id,p_email:email,p_display_name:vendor.contact_person||vendor.name});
  if(r.error)return fail(r.error);
  const link=location.origin+'/vendor-portal.html';
  try{await navigator.clipboard.writeText(link);toast('Vendor portal invited · link copied');}catch{toast('Vendor portal invited');}
}

async function addQuote(reqId){
  const req=byId(REQS,reqId),items=reqItems(reqId);if(!req||!items.length)return;
  const vendor=promptChoice('Choose vendor',VENDORS,v=>v.name+(v.category?' · '+v.category:''));if(!vendor)return;
  const ref=prompt('Vendor quote reference / number')||('QUOTE-'+today());
  const daysRaw=prompt('Delivery lead time in days','7');const days=daysRaw===''||daysRaw===null?null:Number(daysRaw);
  const terms=prompt('Payment terms',vendor.payment_terms||'')||null;
  const valid=prompt('Quote valid until (YYYY-MM-DD)','')||null;
  let subtotal=0,tax=0,lines=[];
  for(const item of items){
    let materialId=item.material_id;
    if(!materialId){
      if(!MATERIALS.length){
        toast('Add the required item to Inventory material master before recording a vendor quote','err');
        return;
      }
      const material=promptChoice('Map "'+item.description+'" to material master',MATERIALS,m=>m.name+' · '+m.unit);
      if(!material)return toast('Vendor quote cancelled — every item must map to material master','err');
      materialId=material.id;
    }
    const rate=Number(prompt(item.description+' — vendor rate per '+item.unit,String(item.estimated_rate||0))||0);
    const mat=materialId?byId(MATERIALS,materialId):null;
    const gst=Number(prompt(item.description+' — GST %',String(mat?.gst_rate??18))||0);
    const amount=Number(item.qty)*rate;
    subtotal+=amount;tax+=amount*gst/100;
    lines.push({requisition_item_id:item.id,material_id:materialId,description:item.description,qty:item.qty,unit:item.unit,rate,gst_rate:gst});
  }
  const qr=await supabase.from('vendor_quotes').insert({requisition_id:reqId,vendor_id:vendor.id,quote_ref:ref,quote_date:today(),valid_until:valid,delivery_days:Number.isFinite(days)?days:null,payment_terms:terms,subtotal:Math.round(subtotal*100)/100,tax_amount:Math.round(tax*100)/100,total:Math.round((subtotal+tax)*100)/100,status:'received'}).select('id').single();
  if(qr.error)return fail(qr.error);
  const ir=await supabase.from('vendor_quote_items').insert(lines.map(x=>({...x,quote_id:qr.data.id})));if(ir.error)return fail(ir.error);
  await supabase.from('material_requisitions').update({status:'sourcing',updated_at:new Date().toISOString()}).eq('id',reqId);
  toast('Vendor quote recorded');await load();
}

async function createPO(quoteId){
  const r=await supabase.rpc('create_po_from_quote',{p_quote_id:quoteId});if(r.error)return fail(r.error);
  toast('Draft PO prepared from selected quote');await load();
}
async function submitPO(id){const r=await supabase.rpc('submit_purchase_order',{p_po_id:id});if(r.error)return fail(r.error);toast('PO submitted for approval');await load();}
async function approvePO(id){const r=await supabase.rpc('approve_purchase_order',{p_po_id:id});if(r.error)return fail(r.error);toast(r.data.po_no+' approved');await load();}
async function orderPO(id){const r=await supabase.rpc('mark_purchase_order_ordered',{p_po_id:id});if(r.error)return fail(r.error);toast('PO marked ordered');await load();}

async function receiveGRN(poId){
  const po=byId(POS,poId),items=poItems(poId);if(!po||!items.length)return;
  const sr=await supabase.rpc('ensure_project_store',{p_project_id:po.project_id});if(sr.error)return fail(sr.error);
  const storeId=sr.data;
  const dc=prompt('Delivery challan / DC number')||null;
  const vehicle=prompt('Vehicle number (optional)')||null;
  const quality=prompt('Receipt / quality note (optional)')||null;
  const rows=[];
  for(const item of items){
    const open=Math.max(0,Number(item.qty)-Number(item.received_qty||0));if(open<=0)continue;
    const raw=prompt(item.description+' — received quantity (open '+open+' '+item.unit+')',String(open));if(raw===null)continue;
    const received=Number(raw);if(!Number.isFinite(received)||received<=0)continue;
    const accepted=Number(prompt(item.description+' — accepted quantity',String(received))||received);
    rows.push({po_item_id:item.id,received_qty:received,accepted_qty:accepted,remarks:null});
  }
  if(!rows.length)return toast('No receipt quantity entered','err');
  const r=await supabase.rpc('post_goods_receipt',{p_po_id:poId,p_store_id:storeId,p_items:rows,p_receipt_date:today(),p_delivery_challan_no:dc,p_vehicle_no:vehicle,p_quality_note:quality});
  if(r.error)return fail(r.error);
  toast(r.data?.[0]?.grn_no||'GRN posted · stock updated');await load();
}

async function createBill(poId){
  const po=byId(POS,poId);if(!po)return;
  const grns=GRNS.filter(g=>g.po_id===poId);if(!grns.length)return toast('Post a GRN before recording the vendor bill','err');
  const billNo=prompt('Vendor invoice / bill number');if(!billNo)return;
  const date=prompt('Bill date (YYYY-MM-DD)',today())||today();
  const subtotal=Number(prompt('Taxable subtotal',String(po.subtotal||0))||0);
  const tax=Number(prompt('Tax amount',String(po.tax_amount||0))||0);
  const total=Math.round((subtotal+tax)*100)/100;
  const due=prompt('Due date (YYYY-MM-DD)','')||null;
  const r=await supabase.from('vendor_bills').insert({business_unit_id:po.business_unit_id,project_id:po.project_id,vendor_id:po.vendor_id,po_id:po.id,grn_id:grns[0].id,bill_no:billNo.trim(),bill_date:date,due_date:due,subtotal,tax_amount:tax,total,status:'verified'}).select('*').single();
  if(r.error)return fail(r.error);toast('Vendor bill recorded for finance approval');await load();
}

async function approveBill(id){const r=await supabase.rpc('approve_vendor_bill',{p_bill_id:id});if(r.error)return fail(r.error);toast((r.data.internal_no||'Vendor bill')+' approved and posted to expenses');await load();}
async function payBill(id){
  const b=byId(BILLS,id);if(!b)return;
  const balance=Math.max(0,Number(b.total)-Number(b.amount_paid));
  const amount=Number(prompt('Payment amount · balance '+money(balance),String(balance)));if(!Number.isFinite(amount)||amount<=0)return;
  const mode=prompt('Payment mode','bank_transfer')||'bank_transfer';
  const ref=prompt('Bank / UTR / cheque reference')||null;
  const r=await supabase.rpc('record_vendor_payment',{p_bill_id:id,p_amount:amount,p_payment_date:today(),p_payment_mode:mode,p_reference_no:ref,p_notes:null});
  if(r.error)return fail(r.error);toast('Vendor payment recorded');await load();
}

$('#newReqBtn').addEventListener('click',()=>canSite&&newRequisition());
$('#vendorBtn').addEventListener('click',()=>['founder','admin','procurement'].includes(user.role)&&newVendor());
$('#inventoryBtn').addEventListener('click',()=>location.href='/inventory.html');
document.addEventListener('click',e=>{
  const map=[
    ['[data-submit-req]',b=>submitReq(b.dataset.submitReq)],
    ['[data-approve-req]',b=>reviewReq(b.dataset.approveReq,true)],
    ['[data-reject-req]',b=>reviewReq(b.dataset.rejectReq,false)],
    ['[data-rfq]',b=>sendRfq(b.dataset.rfq)],
    ['[data-vendor-portal]',b=>inviteVendorPortal(b.dataset.vendorPortal)],
    ['[data-add-quote]',b=>addQuote(b.dataset.addQuote)],
    ['[data-create-po]',b=>createPO(b.dataset.createPo)],
    ['[data-submit-po]',b=>submitPO(b.dataset.submitPo)],
    ['[data-approve-po]',b=>approvePO(b.dataset.approvePo)],
    ['[data-order-po]',b=>orderPO(b.dataset.orderPo)],
    ['[data-grn]',b=>receiveGRN(b.dataset.grn)],
    ['[data-bill]',b=>createBill(b.dataset.bill)],
    ['[data-approve-bill]',b=>approveBill(b.dataset.approveBill)],
    ['[data-pay-bill]',b=>payBill(b.dataset.payBill)]
  ];
  for(const [sel,fn] of map){const b=e.target.closest(sel);if(b){fn(b);break;}}
});

await load();
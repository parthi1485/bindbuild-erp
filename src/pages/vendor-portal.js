import { supabase } from '../lib/supabase.js';
import { portalIdentity, sendPortalMagicLink, portalSignOut } from '../lib/portal-auth.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];
const money=v=>{const n=Number(v)||0;if(Math.abs(n)>=1e7)return '₹'+(n/1e7).toFixed(2).replace(/\.00$/,'')+' Cr';if(Math.abs(n)>=1e5)return '₹'+(n/1e5).toFixed(1).replace(/\.0$/,'')+' L';return '₹'+Math.round(n).toLocaleString('en-IN');};
const status=s=>'<span class="portal-status '+esc(s||'open')+'">'+esc(String(s||'open').replaceAll('_',' '))+'</span>';

let ID=null,VENDORS=[],VENDOR=null,RFQS=[],RFQITEMS=[],QUOTES=[],QUOTEITEMS=[],POS=[],POITEMS=[],GRNS=[],GRNITEMS=[],BILLS=[],PAYMENTS=[],PROJECTS=[],MESSAGES=[];

const byId=(rows,id)=>rows.find(x=>x.id===id);
const itemsFor=(rows,key,id)=>rows.filter(x=>x[key]===id);

async function boot(){
  try{
    ID=await portalIdentity('vendor');
    if(!ID.session){$('#authScreen').hidden=false;return;}
    if(ID.staff){
      const r=await supabase.from('vendors').select('*').eq('status','active').order('name');
      if(r.error)throw r.error;VENDORS=r.data||[];
    }else{
      if(!ID.members.length){$('#deniedScreen').hidden=false;return;}
      const ids=ID.members.map(m=>m.vendor_id);
      const r=await supabase.from('vendors').select('*').in('id',ids).order('name');
      if(r.error)throw r.error;VENDORS=r.data||[];
    }
    if(!VENDORS.length){$('#deniedScreen').hidden=false;return;}
    const hint=new URLSearchParams(location.search).get('vendor');
    VENDOR=VENDORS.find(v=>v.id===hint)||VENDORS[0];
    $('#portalApp').hidden=false;$('#erpBtn').hidden=!ID.staff;$('#inviteBtn').hidden=!ID.staff;
    paintEntityChooser();await load();
  }catch(e){fail(e);}
}

function paintEntityChooser(){
  $('#entitySelect').innerHTML=VENDORS.map(v=>'<option value="'+v.id+'"'+(v.id===VENDOR.id?' selected':'')+'>'+esc(v.name)+'</option>').join('');
  $('#entityName').textContent=VENDOR.name;
  $('#entityMeta').textContent=ID.staff?'Staff preview · '+(VENDOR.email||'no vendor email'):(ID.session.user.email||'Vendor portal');
  $('#heroTitle').textContent=VENDOR.name;
}

async function load(){
  try{
    const [rfq,quotes,pos,grns,bills,pays,msg]=await Promise.all([
      supabase.from('vendor_rfq_invites').select('*').eq('vendor_id',VENDOR.id).order('created_at',{ascending:false}),
      supabase.from('vendor_quotes').select('*').eq('vendor_id',VENDOR.id).order('created_at',{ascending:false}),
      supabase.from('purchase_orders').select('*').eq('vendor_id',VENDOR.id).order('created_at',{ascending:false}),
      supabase.from('goods_receipts').select('*').eq('vendor_id',VENDOR.id).order('receipt_date',{ascending:false}),
      supabase.from('vendor_bills').select('*').eq('vendor_id',VENDOR.id).order('bill_date',{ascending:false}),
      supabase.from('vendor_payments').select('*').eq('vendor_id',VENDOR.id).order('payment_date',{ascending:false}),
      supabase.from('portal_messages').select('*').eq('vendor_id',VENDOR.id).order('created_at')
    ]);
    [rfq,quotes,pos,grns,bills,pays,msg].forEach(x=>{if(x.error)throw x.error;});
    RFQS=rfq.data||[];QUOTES=quotes.data||[];POS=pos.data||[];GRNS=grns.data||[];BILLS=bills.data||[];PAYMENTS=pays.data||[];MESSAGES=msg.data||[];

    const rfqIds=RFQS.map(x=>x.id),quoteIds=QUOTES.map(x=>x.id),poIds=POS.map(x=>x.id),grnIds=GRNS.map(x=>x.id);
    const [ri,qi,poi,gi]=await Promise.all([
      rfqIds.length?supabase.from('vendor_rfq_items').select('*').in('invite_id',rfqIds).order('created_at'):Promise.resolve({data:[]}),
      quoteIds.length?supabase.from('vendor_quote_items').select('*').in('quote_id',quoteIds).order('created_at'):Promise.resolve({data:[]}),
      poIds.length?supabase.from('po_items').select('*').in('po_id',poIds).order('created_at'):Promise.resolve({data:[]}),
      grnIds.length?supabase.from('goods_receipt_items').select('*').in('grn_id',grnIds).order('created_at'):Promise.resolve({data:[]})
    ]);
    [ri,qi,poi,gi].forEach(x=>{if(x.error)throw x.error;});
    RFQITEMS=ri.data||[];QUOTEITEMS=qi.data||[];POITEMS=poi.data||[];GRNITEMS=gi.data||[];

    const pids=[...new Set([...RFQS.map(x=>x.project_id),...POS.map(x=>x.project_id),...BILLS.map(x=>x.project_id)].filter(Boolean))];
    if(pids.length){
      const pr=await supabase.from('projects').select('id,project_no,code,name,location').in('id',pids);
      if(pr.error)throw pr.error;PROJECTS=pr.data||[];
    }else PROJECTS=[];
    render();
  }catch(e){fail(e);}
}

function render(){
  const openRfqs=RFQS.filter(r=>['invited','viewed'].includes(r.status));
  const openPos=POS.filter(p=>!['delivered','cancelled'].includes(p.status));
  const due=BILLS.filter(b=>['approved','part_paid'].includes(b.status)).reduce((a,b)=>a+Math.max(0,Number(b.total)-Number(b.amount_paid)),0);
  const paid=PAYMENTS.reduce((a,p)=>a+Number(p.amount||0),0);
  $('#kRfq').textContent=String(openRfqs.length);$('#kPO').textContent=money(openPos.reduce((a,p)=>a+Number(p.total||0),0));$('#kDue').textContent=money(due);$('#kPaid').textContent=money(paid);
  $('#rfqBadge').textContent=String(openRfqs.length);

  $('#activePoList').innerHTML=openPos.length?openPos.slice(0,6).map(p=>'<div class="portal-row"><div class="portal-row__body"><div class="portal-row__title">'+esc(p.po_no||'PO')+' · '+esc(byId(PROJECTS,p.project_id)?.name||'Project')+'</div><div class="portal-row__meta">'+(p.expected_date?'Expected '+fmtDate(p.expected_date):'No expected date')+' · '+itemsFor(POITEMS,'po_id',p.id).length+' lines</div></div><div style="text-align:right"><b>'+money(p.total)+'</b><div style="margin-top:4px">'+status(p.status)+'</div></div></div>').join(''):'<div class="portal-empty">No active purchase orders.</div>';

  const activity=[
    ...GRNS.map(g=>({date:g.receipt_date,title:g.grn_no,meta:'Goods receipt · '+g.status})),
    ...PAYMENTS.map(p=>({date:p.payment_date,title:'Payment '+money(p.amount),meta:p.reference_no||p.payment_mode}))
  ].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8);
  $('#activityList').innerHTML=activity.length?activity.map(a=>'<div class="portal-row"><div class="portal-row__body"><div class="portal-row__title">'+esc(a.title)+'</div><div class="portal-row__meta">'+esc(a.meta)+' · '+fmtDate(a.date)+'</div></div></div>').join(''):'<div class="portal-empty">No receipt or payment activity yet.</div>';

  $('#rfqShort').innerHTML=openRfqs.length?openRfqs.slice(0,5).map(r=>'<div class="portal-row"><div class="portal-row__body"><div class="portal-row__title">'+esc(r.requisition_no||'RFQ')+'</div><div class="portal-row__meta">'+esc(byId(PROJECTS,r.project_id)?.name||'Project')+(r.due_date?' · quote by '+fmtDate(r.due_date):'')+'</div></div></div>').join(''):'<div class="portal-empty">No RFQs are awaiting response.</div>';

  $('#accountCard').innerHTML='<div class="portal-row"><div class="portal-row__body"><div class="portal-row__title">'+esc(VENDOR.contact_person||VENDOR.name)+'</div><div class="portal-row__meta">'+esc([VENDOR.category,VENDOR.city,VENDOR.gstin?'GSTIN '+VENDOR.gstin:null].filter(Boolean).join(' · ')||'Vendor account')+'</div></div></div><div class="portal-row"><div class="portal-row__body"><div class="portal-row__title">Payment terms</div><div class="portal-row__meta">'+esc(VENDOR.payment_terms||'Not specified')+'</div></div></div>';

  $('#rfqBody').innerHTML=RFQS.length?RFQS.map(r=>{
    const its=itemsFor(RFQITEMS,'invite_id',r.id),q=r.quote_id?byId(QUOTES,r.quote_id):null;
    let action='';
    if(['invited','viewed'].includes(r.status)&&!ID.staff)action='<button class="portal-btn primary" data-quote="'+r.id+'">Submit quote</button>';
    else if(['invited','viewed'].includes(r.status)&&ID.staff)action='<span class="portal-meta">Vendor can quote</span>';
    else if(q)action='<span class="portal-meta">'+esc(q.quote_ref||'Quote')+' · '+money(q.total)+'</span>';
    return '<tr><td><div class="portal-doc">'+esc(r.requisition_no||'RFQ')+'</div><div class="portal-meta">'+esc(r.purpose||r.note||'Material requirement')+'</div></td><td>'+esc(byId(PROJECTS,r.project_id)?.name||'—')+'</td><td>'+(r.required_by?fmtDate(r.required_by):'—')+(r.due_date?'<div class="portal-meta">Quote by '+fmtDate(r.due_date)+'</div>':'')+'</td><td>'+its.length+' item'+(its.length===1?'':'s')+'<div class="portal-meta">'+esc(its.slice(0,2).map(i=>i.description).join(', '))+(its.length>2?' +'+(its.length-2):'')+'</div></td><td>'+status(r.status)+'</td><td>'+action+'</td></tr>';
  }).join(''):'<tr><td colspan="6"><div class="portal-empty">No RFQ invitations.</div></td></tr>';

  $('#poBody').innerHTML=POS.length?POS.map(p=>'<tr><td><div class="portal-doc">'+esc(p.po_no||'PO')+'</div><div class="portal-meta">'+esc(p.payment_terms||'')+'</div></td><td>'+esc(byId(PROJECTS,p.project_id)?.name||'—')+'</td><td>'+(p.order_date?fmtDate(p.order_date):'—')+'<div class="portal-meta">'+(p.expected_date?'Expected '+fmtDate(p.expected_date):'')+'</div></td><td>'+itemsFor(POITEMS,'po_id',p.id).length+'<div class="portal-meta">'+esc(itemsFor(POITEMS,'po_id',p.id).slice(0,2).map(i=>i.description).join(', '))+'</div></td><td class="num"><b>'+money(p.total)+'</b></td><td>'+status(p.status)+'</td></tr>').join(''):'<tr><td colspan="6"><div class="portal-empty">No released purchase orders.</div></td></tr>';

  $('#grnBody').innerHTML=GRNS.length?GRNS.map(g=>{const its=itemsFor(GRNITEMS,'grn_id',g.id),rejected=its.filter(i=>Number(i.rejected_qty||0)>0).length;return '<tr><td><div class="portal-doc">'+esc(g.grn_no)+'</div><div class="portal-meta">'+esc(g.delivery_challan_no||'No DC')+'</div></td><td>'+esc(byId(POS,g.po_id)?.po_no||'—')+'</td><td>'+esc(byId(PROJECTS,g.project_id)?.name||'—')+'</td><td>'+fmtDate(g.receipt_date)+'</td><td><b>'+its.length+'</b> line'+(its.length===1?'':'s')+' received<div class="portal-meta">'+rejected+' line'+(rejected===1?'':'s')+' with rejected qty</div></td><td>'+status(g.status)+'</td></tr>';}).join(''):'<tr><td colspan="6"><div class="portal-empty">No GRNs posted.</div></td></tr>';

  $('#billBody').innerHTML=BILLS.length?BILLS.map(b=>'<tr><td><div class="portal-doc">'+esc(b.internal_no||b.bill_no)+'</div><div class="portal-meta">Vendor bill '+esc(b.bill_no)+'</div></td><td>'+esc(byId(PROJECTS,b.project_id)?.name||'—')+'</td><td>'+(b.due_date?fmtDate(b.due_date):'—')+'</td><td class="num">'+money(b.total)+'</td><td class="num">'+money(b.amount_paid)+'</td><td>'+status(b.status)+'</td></tr>').join(''):'<tr><td colspan="6"><div class="portal-empty">No vendor bills posted.</div></td></tr>';

  $('#paymentBody').innerHTML=PAYMENTS.length?PAYMENTS.map(p=>'<tr><td>'+fmtDate(p.payment_date)+'</td><td>'+esc(byId(BILLS,p.vendor_bill_id)?.internal_no||byId(BILLS,p.vendor_bill_id)?.bill_no||'Bill')+'</td><td>'+esc(byId(PROJECTS,p.project_id)?.name||'—')+'</td><td>'+esc(p.reference_no||p.payment_mode.replaceAll('_',' '))+'</td><td class="num"><b>'+money(p.amount)+'</b></td></tr>').join(''):'<tr><td colspan="5"><div class="portal-empty">No payments recorded.</div></td></tr>';

  $('#messageList').innerHTML=MESSAGES.length?MESSAGES.map(m=>'<div class="portal-message '+(m.sender_user_id===ID.session.user.id?'me':'')+'">'+esc(m.body)+'<small>'+esc(m.from_studio?'Bind Builds':m.sender_name||VENDOR.name)+' · '+fmtDate(m.created_at)+'</small></div>').join(''):'<div class="portal-empty">No messages yet.</div>';
  $('#messageList').scrollTop=$('#messageList').scrollHeight;
}

async function quoteRfq(id){
  const r=byId(RFQS,id);if(!r||ID.staff)return;
  const viewed=await supabase.rpc('mark_vendor_rfq_viewed',{p_invite_id:id});if(viewed.error)return fail(viewed.error);
  const items=itemsFor(RFQITEMS,'invite_id',id);if(!items.length)return toast('RFQ has no quote lines','err');
  const ref=prompt('Your quotation reference / number',VENDOR.code?VENDOR.code+'-'+(r.requisition_no||'RFQ'):'')||null;
  const valid=prompt('Quote valid until (YYYY-MM-DD)','')||null;
  const deliveryRaw=prompt('Delivery lead time in days','7');if(deliveryRaw===null)return;
  const delivery=deliveryRaw===''?null:Number(deliveryRaw);if(delivery!==null&&(!Number.isFinite(delivery)||delivery<0))return toast('Invalid delivery days','err');
  const terms=prompt('Payment terms',VENDOR.payment_terms||'')||null;
  const note=prompt('Quotation note (optional)')||null;
  const lines=[];
  for(const item of items){
    const rate=Number(prompt(item.description+'\n'+item.qty+' '+item.unit+' · rate per '+item.unit,'0'));if(!Number.isFinite(rate)||rate<0)return toast('Invalid rate','err');
    const gst=Number(prompt(item.description+' · GST %','18'));if(!Number.isFinite(gst)||gst<0||gst>100)return toast('Invalid GST rate','err');
    lines.push({requisition_item_id:item.requisition_item_id,rate,gst_rate:gst});
  }
  if(!confirm('Submit this quotation? It becomes read-only in the Vendor Portal after submission.'))return;
  const q=await supabase.rpc('submit_vendor_rfq_quote',{p_invite_id:id,p_quote_ref:ref,p_valid_until:valid,p_delivery_days:delivery,p_payment_terms:terms,p_items:lines,p_notes:note});
  if(q.error)return fail(q.error);toast('Quotation submitted · '+money(q.data.total));await load();
}

async function invite(){
  if(!ID.staff)return;
  const email=(prompt('Vendor portal email',VENDOR.email||'')||'').trim();if(!email)return;
  const r=await supabase.rpc('invite_portal_member',{p_portal_type:'vendor',p_entity_id:VENDOR.id,p_email:email,p_display_name:VENDOR.contact_person||VENDOR.name});
  if(r.error)return fail(r.error);
  const link=location.origin+'/vendor-portal.html';
  try{await navigator.clipboard.writeText(link);toast('Vendor access invited · portal link copied');}catch{toast('Vendor access invited · share '+link);}
}

$('#sendLinkBtn').addEventListener('click',async()=>{try{$('#sendLinkBtn').disabled=true;const e=await sendPortalMagicLink($('#authEmail').value,'vendor');$('#authNote').textContent='Secure sign-in link sent to '+e+'. Open it on this device to continue.';}catch(e){fail(e);}finally{$('#sendLinkBtn').disabled=false;}});
$('#signOutBtn').addEventListener('click',portalSignOut);$('#deniedSignOut').addEventListener('click',portalSignOut);
$('#erpBtn').addEventListener('click',()=>location.href='/procurement.html');$('#inviteBtn').addEventListener('click',invite);
$('#entitySelect').addEventListener('change',async e=>{VENDOR=VENDORS.find(v=>v.id===e.target.value)||VENDOR;history.replaceState(null,'','/vendor-portal.html?vendor='+VENDOR.id);paintEntityChooser();await load();});
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;$$('#tabs [data-tab]').forEach(x=>x.classList.toggle('on',x===b));$$('[data-panel]').forEach(p=>p.classList.toggle('on',p.dataset.panel===b.dataset.tab));});
$('#messageSend').addEventListener('click',async()=>{const body=$('#messageInput').value.trim();if(!body)return;const r=await supabase.from('portal_messages').insert({vendor_id:VENDOR.id,sender_user_id:ID.session.user.id,sender_name:ID.session.user.email,from_studio:ID.staff,body});if(r.error)return fail(r.error);$('#messageInput').value='';await load();});
document.addEventListener('click',e=>{const q=e.target.closest('[data-quote]');if(q)return quoteRfq(q.dataset.quote);});

await boot();
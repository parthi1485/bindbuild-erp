import { supabase } from '../lib/supabase.js';
import { portalIdentity, sendPortalMagicLink, portalSignOut } from '../lib/portal-auth.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];
const money=v=>{const n=Number(v)||0;if(Math.abs(n)>=1e7)return '₹'+(n/1e7).toFixed(2).replace(/\.00$/,'')+' Cr';if(Math.abs(n)>=1e5)return '₹'+(n/1e5).toFixed(1).replace(/\.0$/,'')+' L';return '₹'+Math.round(n).toLocaleString('en-IN');};
const status=s=>'<span class="portal-status '+esc(s||'open')+'">'+esc(String(s||'open').replaceAll('_',' '))+'</span>';

let ID=null,CLIENTS=[],CLIENT=null,PROJECTS=[],STAGES=[],INVOICES=[],PROFORMAS=[],RECEIPTS=[],DOCS=[],REVS=[],APPROVALS=[],MESSAGES=[];

async function boot(){
  try{
    ID=await portalIdentity('client');
    if(!ID.session){$('#authScreen').hidden=false;return;}
    if(ID.staff){
      const r=await supabase.from('clients').select('id,name,email,phone,city,state').is('deleted_at',null).order('name');
      if(r.error)throw r.error;CLIENTS=r.data||[];
    }else{
      if(!ID.members.length){$('#deniedScreen').hidden=false;return;}
      const ids=ID.members.map(m=>m.client_id);
      const r=await supabase.from('clients').select('id,name,email,phone,city,state').in('id',ids).order('name');
      if(r.error)throw r.error;CLIENTS=r.data||[];
    }
    if(!CLIENTS.length){$('#deniedScreen').hidden=false;return;}
    const hint=new URLSearchParams(location.search).get('client');
    CLIENT=CLIENTS.find(c=>c.id===hint)||CLIENTS[0];
    $('#portalApp').hidden=false;
    $('#erpBtn').hidden=!ID.staff;$('#inviteBtn').hidden=!ID.staff;
    paintEntityChooser();await load();
  }catch(e){fail(e);}
}

function paintEntityChooser(){
  $('#entitySelect').innerHTML=CLIENTS.map(c=>'<option value="'+c.id+'"'+(c.id===CLIENT.id?' selected':'')+'>'+esc(c.name)+'</option>').join('');
  $('#entityName').textContent=CLIENT.name;
  $('#entityMeta').textContent=ID.staff?'Staff preview · '+(CLIENT.email||'no client email'):(ID.session.user.email||'Client portal');
  $('#heroTitle').textContent=CLIENT.name;
  $('#heroSub').textContent='Live progress, approved documents and commercial records shared by Bind Builds.';
}

async function load(){
  try{
    const p=await supabase.from('projects').select('*').eq('client_id',CLIENT.id).is('deleted_at',null).order('created_at');
    if(p.error)throw p.error;PROJECTS=p.data||[];
    const pids=PROJECTS.map(x=>x.id);

    const [st,inv,pi,rec,docs,ap,msg]=await Promise.all([
      pids.length?supabase.from('construction_stages').select('*').in('project_id',pids).order('sort_order'):Promise.resolve({data:[]}),
      supabase.from('invoices').select('*').eq('client_id',CLIENT.id).is('deleted_at',null).not('invoice_no','is',null).order('issue_date',{ascending:false}),
      supabase.from('proforma_invoices').select('*').eq('client_id',CLIENT.id).is('deleted_at',null).not('proforma_no','is',null).order('issue_date',{ascending:false}),
      supabase.from('receipts').select('*').eq('client_id',CLIENT.id).eq('status','issued').order('receipt_date',{ascending:false}),
      pids.length?supabase.from('project_documents').select('*').in('project_id',pids).eq('client_visible',true).eq('status','approved').order('updated_at',{ascending:false}):Promise.resolve({data:[]}),
      pids.length?supabase.from('approvals').select('*').in('project_id',pids).order('created_at',{ascending:false}):Promise.resolve({data:[]}),
      supabase.from('portal_messages').select('*').eq('client_id',CLIENT.id).order('created_at')
    ]);
    [st,inv,pi,rec,docs,ap,msg].forEach(x=>{if(x.error)throw x.error;});
    STAGES=st.data||[];INVOICES=inv.data||[];PROFORMAS=pi.data||[];RECEIPTS=rec.data||[];DOCS=docs.data||[];APPROVALS=ap.data||[];MESSAGES=msg.data||[];

    const revIds=DOCS.map(d=>d.current_revision_id).filter(Boolean);
    if(revIds.length){
      const r=await supabase.from('document_revisions').select('*').in('id',revIds);
      if(r.error)throw r.error;REVS=r.data||[];
    }else REVS=[];
    render();
  }catch(e){fail(e);}
}

const byId=(rows,id)=>rows.find(x=>x.id===id);
function render(){
  const contract=PROJECTS.reduce((a,p)=>a+Number(p.contract_value||0),0);
  const collected=RECEIPTS.filter(r=>r.status==='issued').reduce((a,r)=>a+Number(r.amount||0),0);
  const avg=PROJECTS.length?Math.round(PROJECTS.reduce((a,p)=>a+Number(p.progress_pct||0),0)/PROJECTS.length):0;
  $('#kProjects').textContent=String(PROJECTS.length);$('#kProgress').textContent=avg+'%';$('#kContract').textContent=money(contract);$('#kCollected').textContent=money(collected);

  $('#projectList').innerHTML=PROJECTS.length?PROJECTS.map(p=>'<div class="portal-row"><div class="portal-row__body"><div class="portal-row__title">'+esc(p.project_no||p.code||'Project')+' · '+esc(p.name)+'</div><div class="portal-row__meta">'+esc([p.location,p.service_type,p.target_end_date?'Target '+fmtDate(p.target_end_date):null].filter(Boolean).join(' · '))+'</div><div class="portal-progress"><span style="width:'+Math.min(100,Number(p.progress_pct||0))+'%"></span></div></div><b>'+Number(p.progress_pct||0)+'%</b></div>').join(''):'<div class="portal-empty">No projects are linked yet.</div>';

  const ledger=[...INVOICES.map(x=>({no:x.invoice_no,label:x.milestone_name||'GST Invoice',date:x.issue_date,total:x.total,status:x.status})),...RECEIPTS.filter(r=>r.status==='issued').map(x=>({no:x.receipt_no,label:'Receipt',date:x.receipt_date,total:x.amount,status:'paid'}))].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);
  $('#latestLedger').innerHTML=ledger.length?ledger.map(x=>'<div class="portal-row"><div class="portal-row__body"><div class="portal-row__title">'+esc(x.no||x.label)+'</div><div class="portal-row__meta">'+esc(x.label)+' · '+fmtDate(x.date)+'</div></div><div style="text-align:right"><b>'+money(x.total)+'</b><div style="margin-top:4px">'+status(x.status)+'</div></div></div>').join(''):'<div class="portal-empty">No issued commercial records yet.</div>';

  const pending=APPROVALS.filter(a=>a.status==='pending');
  $('#pendingBadge').textContent=String(pending.length);
  $('#pendingList').innerHTML=pending.length?pending.slice(0,6).map(a=>'<div class="portal-row"><div class="portal-row__body"><div class="portal-row__title">'+esc(a.title)+'</div><div class="portal-row__meta">'+esc(byId(PROJECTS,a.project_id)?.name||'Project')+' · '+fmtDate(a.created_at)+'</div></div></div>').join(''):'<div class="portal-empty">Nothing is awaiting your response.</div>';

  $('#latestDocs').innerHTML=DOCS.length?DOCS.slice(0,5).map(d=>'<button class="portal-row" data-open-doc="'+d.id+'" style="width:100%;text-align:left"><div class="portal-row__body"><div class="portal-row__title">'+esc(d.title)+'</div><div class="portal-row__meta">'+esc(d.document_no||'DOC')+' · '+esc(byId(REVS,d.current_revision_id)?.revision_code||'Approved')+'</div></div></button>').join(''):'<div class="portal-empty">No approved documents are shared yet.</div>';

  $('#stageBody').innerHTML=STAGES.length?STAGES.map(s=>'<tr><td>'+esc(byId(PROJECTS,s.project_id)?.name||'Project')+'</td><td><div class="portal-doc">'+esc(s.title)+'</div></td><td>'+esc(s.phase||'—')+'</td><td><b>'+Number(s.progress_pct||0)+'%</b><div class="portal-progress"><span style="width:'+Math.min(100,Number(s.progress_pct||0))+'%"></span></div></td><td>'+status(s.status)+'</td><td>'+(s.planned_end?fmtDate(s.planned_end):'—')+'</td></tr>').join(''):'<tr><td colspan="6"><div class="portal-empty">Construction stages will appear after project release.</div></td></tr>';

  $('#docBody').innerHTML=DOCS.length?DOCS.map(d=>{const r=byId(REVS,d.current_revision_id);return '<tr><td><div class="portal-doc">'+esc(d.document_no||'DOC')+'</div><div class="portal-meta">'+esc(d.title)+'</div></td><td>'+esc(byId(PROJECTS,d.project_id)?.name||'—')+'</td><td>'+esc(d.document_type)+'</td><td>'+esc(r?.revision_code||'—')+'</td><td>'+fmtDate(d.updated_at)+'</td><td><button class="portal-btn" data-open-doc="'+d.id+'">Open</button></td></tr>';}).join(''):'<tr><td colspan="6"><div class="portal-empty">No approved documents shared.</div></td></tr>';

  const payRows=[...INVOICES.map(x=>({type:'GST Invoice',no:x.invoice_no,project_id:x.project_id,date:x.issue_date,total:x.total,paid:x.amount_paid,status:x.status})),...PROFORMAS.filter(x=>!INVOICES.some(i=>i.proforma_id===x.id)).map(x=>({type:'Proforma',no:x.proforma_no,project_id:x.project_id,date:x.issue_date,total:x.total,paid:x.amount_paid,status:x.status}))].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $('#paymentBody').innerHTML=payRows.length?payRows.map(x=>'<tr><td><div class="portal-doc">'+esc(x.no||'—')+'</div><div class="portal-meta">'+esc(x.type)+'</div></td><td>'+esc(byId(PROJECTS,x.project_id)?.name||'—')+'</td><td>'+fmtDate(x.date)+'</td><td class="num">'+money(x.total)+'</td><td class="num">'+money(x.paid)+'</td><td>'+status(x.status)+'</td></tr>').join(''):'<tr><td colspan="6"><div class="portal-empty">No issued billing documents.</div></td></tr>';

  $('#receiptBody').innerHTML=RECEIPTS.length?RECEIPTS.map(r=>'<tr><td><div class="portal-doc">'+esc(r.receipt_no)+'</div></td><td>'+esc(byId(PROJECTS,r.project_id)?.name||'—')+'</td><td>'+fmtDate(r.receipt_date)+'</td><td>'+esc(r.payment_mode.replaceAll('_',' '))+'</td><td class="num"><b>'+money(r.amount)+'</b></td></tr>').join(''):'<tr><td colspan="5"><div class="portal-empty">No receipts yet.</div></td></tr>';

  $('#approvalList').innerHTML=APPROVALS.length?APPROVALS.map(a=>'<div class="portal-row"><div class="portal-row__body"><div class="portal-row__title">'+esc(a.title)+'</div><div class="portal-row__meta">'+esc(byId(PROJECTS,a.project_id)?.name||'Project')+' · '+fmtDate(a.created_at)+(a.comment?' · '+esc(a.comment):'')+'</div></div><div class="portal-top__actions">'+status(a.status)+(a.status==='pending'&&!ID.staff?'<button class="portal-btn primary" data-decide="'+a.id+':approved">Approve</button><button class="portal-btn" data-decide="'+a.id+':changes_requested">Request change</button>':'')+(a.status==='pending'&&ID.staff?'<span class="portal-meta">Preview only</span>':'')+'</div></div>').join(''):'<div class="portal-empty">No approval requests.</div>';

  $('#messageList').innerHTML=MESSAGES.length?MESSAGES.map(m=>'<div class="portal-message '+(m.sender_user_id===ID.session.user.id?'me':'')+'">'+esc(m.body)+'<small>'+esc(m.from_studio?'Bind Builds':m.sender_name||CLIENT.name)+' · '+fmtDate(m.created_at)+'</small></div>').join(''):'<div class="portal-empty">No messages yet.</div>';
  $('#messageList').scrollTop=$('#messageList').scrollHeight;
}

async function openDoc(id){
  const d=byId(DOCS,id),r=d?byId(REVS,d.current_revision_id):null;if(!r)return toast('Approved revision unavailable','err');
  const s=await supabase.storage.from('erp-documents').createSignedUrl(r.storage_path,300);
  if(s.error)return fail(s.error);window.open(s.data.signedUrl,'_blank','noopener');
}

async function decide(id,decision){
  const comment=decision==='changes_requested'?(prompt('What needs to change?')||''):prompt('Approval comment (optional)')||'';
  if(decision==='changes_requested'&&!comment)return;
  const r=await supabase.rpc('client_decide_approval',{p_approval_id:id,p_decision:decision,p_comment:comment||null});
  if(r.error)return fail(r.error);toast(decision==='approved'?'Approval recorded':'Change request recorded');await load();
}

async function invite(){
  if(!ID.staff)return;
  const email=(prompt('Client portal email',CLIENT.email||'')||'').trim();if(!email)return;
  const r=await supabase.rpc('invite_portal_member',{p_portal_type:'client',p_entity_id:CLIENT.id,p_email:email,p_display_name:CLIENT.name});
  if(r.error)return fail(r.error);
  const link=location.origin+'/client-portal.html';
  try{await navigator.clipboard.writeText(link);toast('Client access invited · portal link copied');}catch{toast('Client access invited · share '+link);}
}

$('#sendLinkBtn').addEventListener('click',async()=>{try{$('#sendLinkBtn').disabled=true;const e=await sendPortalMagicLink($('#authEmail').value,'client');$('#authNote').textContent='Secure sign-in link sent to '+e+'. Open it on this device to continue.';}catch(e){fail(e);}finally{$('#sendLinkBtn').disabled=false;}});
$('#signOutBtn').addEventListener('click',portalSignOut);$('#deniedSignOut').addEventListener('click',portalSignOut);
$('#erpBtn').addEventListener('click',()=>location.href='/dashboard.html');$('#inviteBtn').addEventListener('click',invite);
$('#entitySelect').addEventListener('change',async e=>{CLIENT=CLIENTS.find(c=>c.id===e.target.value)||CLIENT;history.replaceState(null,'','/client-portal.html?client='+CLIENT.id);paintEntityChooser();await load();});
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;$$('#tabs [data-tab]').forEach(x=>x.classList.toggle('on',x===b));$$('[data-panel]').forEach(p=>p.classList.toggle('on',p.dataset.panel===b.dataset.tab));});
$('#messageSend').addEventListener('click',async()=>{const body=$('#messageInput').value.trim();if(!body)return;const r=await supabase.from('portal_messages').insert({client_id:CLIENT.id,sender_user_id:ID.session.user.id,sender_name:ID.session.user.email,from_studio:ID.staff,body});if(r.error)return fail(r.error);$('#messageInput').value='';await load();});
document.addEventListener('click',e=>{const d=e.target.closest('[data-open-doc]');if(d)return openDoc(d.dataset.openDoc);const x=e.target.closest('[data-decide]');if(x){const [id,decision]=x.dataset.decide.split(':');return decide(id,decision);}});

await boot();
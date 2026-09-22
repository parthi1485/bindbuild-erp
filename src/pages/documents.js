import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit, activeUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'documents',title:'Documents'});
if(!user)throw new Error('redirecting');

const canWrite=['founder','admin','project_manager','designer','site_engineer','procurement'].includes(user.role);
const canApprove=['founder','admin','project_manager'].includes(user.role);
const projectHint=new URLSearchParams(location.search).get('project');
let DOCS=[],REVS=[],APPROVALS=[],PROJECTS=[],selected=null;
let q='',projectFilter=projectHint||'',typeFilter='',statusFilter='';

const byId=(rows,id)=>rows.find(x=>x.id===id);
const docRevs=id=>REVS.filter(r=>r.document_id===id).sort((a,b)=>b.revision_no-a.revision_no);
const latestDraft=id=>docRevs(id).find(r=>r.status==='draft');
const latestIssued=id=>docRevs(id).find(r=>r.status==='issued');
const currentRev=d=>d.current_revision_id?byId(REVS,d.current_revision_id):docRevs(d.id)[0];
const status=s=>'<span class="ws-status '+esc(s||'draft')+'">'+esc(String(s||'draft').replaceAll('_',' '))+'</span>';

function choose(title,rows,label){
  if(!rows.length){toast('No options available','err');return null;}
  const raw=prompt(title+'\n\n'+rows.map((x,i)=>(i+1)+'. '+label(x)).join('\n')+'\n\nEnter number');
  if(raw===null)return null;const n=Number(raw);
  return Number.isInteger(n)&&n>0&&n<=rows.length?rows[n-1]:null;
}

async function load(){
  try{
    const a=await Promise.all([
      scopeToUnit(supabase.from('project_documents').select('*')).order('created_at',{ascending:false}),
      supabase.from('document_revisions').select('*').order('revision_no',{ascending:false}),
      supabase.from('document_approvals').select('*').eq('status','pending').order('requested_at',{ascending:true}),
      scopeToUnit(supabase.from('projects').select('id,project_no,code,name').is('deleted_at',null)).order('name')
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    [DOCS,REVS,APPROVALS,PROJECTS]=a.map(r=>r.data||[]);
    const docIds=new Set(DOCS.map(d=>d.id));
    REVS=REVS.filter(r=>docIds.has(r.document_id));
    APPROVALS=APPROVALS.filter(a=>docIds.has(a.document_id));
    if(!selected&&DOCS.length)selected=DOCS[0].id;
    render();
  }catch(e){fail(e);}
}

function render(){
  const rows=DOCS.filter(d=>{
    if(projectFilter&&d.project_id!==projectFilter)return false;
    if(typeFilter&&d.document_type!==typeFilter)return false;
    if(statusFilter&&d.status!==statusFilter)return false;
    if(q&&!String(d.document_no+' '+d.title+' '+(d.discipline||'')).toLowerCase().includes(q))return false;
    return true;
  });
  $('#kDocs').textContent=String(DOCS.length);
  $('#kApproved').textContent=String(DOCS.filter(d=>d.status==='approved').length);
  $('#kReview').textContent=String(DOCS.filter(d=>d.status==='under_review').length);
  $('#kClient').textContent=String(DOCS.filter(d=>d.client_visible).length);
  $('#kRev').textContent=String(REVS.length);
  $('#docCount').textContent=rows.length+' docs';
  $('#newDocBtn').disabled=!canWrite;
  $('#uploadBtn').disabled=!canWrite||!DOCS.length;

  $('#projectFilter').innerHTML='<option value="">All projects</option>'+PROJECTS.map(p=>'<option value="'+p.id+'"'+(p.id===projectFilter?' selected':'')+'>'+esc((p.project_no||p.code)+' · '+p.name)+'</option>').join('');
  $('#typeFilter').value=typeFilter;$('#statusFilter').value=statusFilter;

  $('#docBody').innerHTML=rows.length?rows.map(d=>{
    const p=byId(PROJECTS,d.project_id),r=currentRev(d),draft=latestDraft(d.id),issued=latestIssued(d.id);
    let acts='<button class="ws-btn" data-select="'+d.id+'">History</button>';
    if(r?.storage_path)acts+='<button class="ws-btn" data-open-rev="'+r.id+'">Open</button>';
    if(canWrite)acts+='<button class="ws-btn" data-upload="'+d.id+'">+ Rev</button>';
    if(draft&&canWrite)acts+='<button class="ws-btn primary" data-issue="'+draft.id+'">Issue '+esc(draft.revision_code)+'</button>';
    if(issued&&canApprove)acts+='<button class="ws-btn primary" data-approve="'+issued.id+'">Approve</button><button class="ws-btn danger" data-reject="'+issued.id+'">Reject</button>';
    if(canApprove&&d.status==='approved')acts+='<button class="ws-btn" data-share="'+d.id+'">'+(d.client_visible?'Hide client':'Flag client')+'</button>';
    return '<tr><td><div class="ws-doc">'+esc(d.document_no||'DOC')+'</div><div class="ws-meta">'+esc(d.title)+'</div></td><td>'+esc(p?.name||'General')+'</td><td>'+esc(d.document_type)+'<div class="ws-meta">'+esc(d.discipline||'—')+'</div></td><td>'+(r?'<b>'+esc(r.revision_code)+'</b><div class="ws-meta">'+esc(r.file_name)+'</div>':'—')+'</td><td>'+status(d.status)+'</td><td>'+(d.client_visible?'Client flagged':'Internal')+'</td><td><div class="ws-inline">'+acts+'</div></td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="ws-empty">No documents match this view.</div></td></tr>';

  renderRevisions();renderApprovals();renderProjects();
}

function renderRevisions(){
  const d=byId(DOCS,selected),rows=d?docRevs(d.id):[];
  $('#revCount').textContent=String(rows.length);
  $('#revSubtitle').textContent=d?(d.document_no+' · '+d.title):'Select a document';
  $('#revBody').innerHTML=rows.length?rows.map(r=>'<tr><td><div class="ws-doc">'+esc(r.revision_code)+'</div></td><td>'+esc(r.file_name)+'<div class="ws-meta">'+(r.size_bytes?Math.round(r.size_bytes/1024)+' KB':'')+'</div></td><td>'+esc(r.issue_purpose.replaceAll('_',' '))+'</td><td>'+fmtDate(r.created_at)+'</td><td>'+status(r.status)+'</td><td><button class="ws-btn" data-open-rev="'+r.id+'">Open</button></td></tr>').join(''):'<tr><td colspan="6"><div class="ws-empty">No revisions yet.</div></td></tr>';
}

function renderApprovals(){
  $('#approvalCount').textContent=String(APPROVALS.length);
  $('#approvalList').innerHTML=APPROVALS.length?APPROVALS.map(a=>{
    const r=byId(REVS,a.revision_id),d=byId(DOCS,a.document_id);
    return '<div class="ws-list-row"><div class="ws-list-body"><div class="ws-list-title">'+esc(d?.document_no||'DOC')+' · '+esc(r?.revision_code||'')+'</div><div class="ws-list-meta">'+esc(d?.title||'Document')+'</div></div>'+(canApprove?'<button class="ws-btn primary" data-approve="'+a.revision_id+'">Review</button>':'')+'</div>';
  }).join(''):'<div class="ws-empty">Nothing awaiting approval.</div>';
}

function renderProjects(){
  const map=new Map();
  DOCS.forEach(d=>map.set(d.project_id,(map.get(d.project_id)||0)+1));
  const rows=[...map.entries()].sort((a,b)=>b[1]-a[1]);
  $('#projectList').innerHTML=rows.length?rows.map(([id,n])=>'<div class="ws-list-row"><div class="ws-list-body"><div class="ws-list-title">'+esc(byId(PROJECTS,id)?.name||'General documents')+'</div><div class="ws-list-meta">'+n+' controlled document'+(n===1?'':'s')+'</div></div></div>').join(''):'<div class="ws-empty">No documents yet.</div>';
}

async function newDocument(){
  const project=projectHint?byId(PROJECTS,projectHint):(confirm('Link this document to a project?')?choose('Choose project',PROJECTS,p=>(p.project_no||p.code)+' · '+p.name):null);
  const title=prompt('Document title');if(!title)return;
  const type=(prompt('Type: drawing / specification / contract / approval / report / boq / schedule / photo / vendor / other','drawing')||'drawing').toLowerCase();
  if(!['drawing','specification','contract','approval','report','boq','schedule','photo','vendor','other'].includes(type))return toast('Invalid document type','err');
  const discipline=prompt('Discipline e.g. Architectural / Structural / Electrical / Plumbing')||null;
  const approval=confirm('Does each issued revision require management approval?');
  const r=await supabase.from('project_documents').insert({business_unit_id:activeUnit(),project_id:project?.id||null,title:title.trim(),document_type:type,discipline,requires_approval:approval,status:'draft'}).select('*').single();
  if(r.error)return fail(r.error);
  selected=r.data.id;toast((r.data.document_no||'Document')+' created');await uploadRevision(r.data.id,true);await load();
}

function filePicker(){
  return new Promise(resolve=>{
    const input=Object.assign(document.createElement('input'),{type:'file'});
    input.onchange=()=>resolve(input.files?.[0]||null);input.click();
  });
}

async function uploadRevision(docId,quiet=false){
  const d=byId(DOCS,docId)||await supabase.from('project_documents').select('*').eq('id',docId).single().then(r=>r.data);
  if(!d)return;
  const file=await filePicker();if(!file)return;
  if(file.size>50*1024*1024)return toast('File exceeds 50 MB bucket limit','err');
  const purpose=(prompt('Issue purpose: internal / review / approval / construction / tender / as_built / record','internal')||'internal').toLowerCase();
  if(!['internal','review','approval','construction','tender','as_built','record'].includes(purpose))return toast('Invalid issue purpose','err');
  const note=prompt('Revision note (optional)')||null;
  const safe=file.name.replace(/[^\w.\-]+/g,'_');
  const path=(d.business_unit_id||activeUnit()||'general')+'/'+(d.project_id||'general')+'/'+d.id+'/'+Date.now()+'-'+safe;
  const up=await supabase.storage.from('erp-documents').upload(path,file,{upsert:false,contentType:file.type||undefined});
  if(up.error)return fail(up.error);
  const rr=await supabase.rpc('register_document_revision',{p_document_id:d.id,p_file_name:file.name,p_storage_path:path,p_mime_type:file.type||null,p_size_bytes:file.size,p_issue_purpose:purpose,p_note:note});
  if(rr.error){
    await supabase.storage.from('erp-documents').remove([path]);
    return fail(rr.error);
  }
  selected=d.id;if(!quiet)toast(rr.data.revision_code+' uploaded');await load();
}

async function issueRevision(id){
  let reviewer=null;
  if(byId(DOCS,byId(REVS,id)?.document_id)?.requires_approval){
    reviewer=user.role==='project_manager'?user.id:null;
  }
  const r=await supabase.rpc('issue_document_revision',{p_revision_id:id,p_reviewer_id:reviewer});
  if(r.error)return fail(r.error);toast((r.data.revision_code||'Revision')+' issued');await load();
}

async function reviewRevision(id,approve){
  const comment=prompt(approve?'Approval comment (optional)':'Rejection / revision comment');
  if(!approve&&!comment)return;
  const r=await supabase.rpc('review_document_revision',{p_revision_id:id,p_approve:approve,p_comment:comment||null});
  if(r.error)return fail(r.error);toast(approve?'Revision approved':'Revision rejected');await load();
}

async function openRevision(id){
  const r=byId(REVS,id);if(!r)return;
  const s=await supabase.storage.from('erp-documents').createSignedUrl(r.storage_path,300);
  if(s.error)return fail(s.error);window.open(s.data.signedUrl,'_blank','noopener');
}

async function toggleClient(id){
  const d=byId(DOCS,id);if(!d)return;
  const r=await supabase.from('project_documents').update({client_visible:!d.client_visible,updated_at:new Date().toISOString()}).eq('id',id);
  if(r.error)return fail(r.error);toast(!d.client_visible?'Flagged client-visible':'Returned to internal');await load();
}

$('#newDocBtn').addEventListener('click',()=>canWrite&&newDocument());
$('#uploadBtn').addEventListener('click',()=>{if(!canWrite)return;const d=byId(DOCS,selected)||choose('Choose document',DOCS,x=>x.document_no+' · '+x.title);if(d)uploadRevision(d.id);});
$('#meetingsBtn').addEventListener('click',()=>location.href='/meetings.html'+(projectHint?'?project='+projectHint:''));
$('#docSearch').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();render();});
$('#projectFilter').addEventListener('change',e=>{projectFilter=e.target.value;render();});
$('#typeFilter').addEventListener('change',e=>{typeFilter=e.target.value;render();});
$('#statusFilter').addEventListener('change',e=>{statusFilter=e.target.value;render();});
document.addEventListener('click',e=>{
  const checks=[
    ['[data-select]',b=>{selected=b.dataset.select;renderRevisions();}],
    ['[data-upload]',b=>uploadRevision(b.dataset.upload)],
    ['[data-issue]',b=>issueRevision(b.dataset.issue)],
    ['[data-approve]',b=>reviewRevision(b.dataset.approve,true)],
    ['[data-reject]',b=>reviewRevision(b.dataset.reject,false)],
    ['[data-open-rev]',b=>openRevision(b.dataset.openRev)],
    ['[data-share]',b=>toggleClient(b.dataset.share)]
  ];
  for(const [sel,fn] of checks){const b=e.target.closest(sel);if(b){fn(b);break;}}
});

await load();
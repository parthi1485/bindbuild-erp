import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit, activeUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'inventory',title:'Inventory'});
if(!user)throw new Error('redirecting');

const canMaster=['founder','admin','procurement','project_manager'].includes(user.role);
const canIssue=['founder','admin','procurement','project_manager','site_engineer'].includes(user.role);
const money=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');
const qty=v=>Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:3});
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const projectHint=new URLSearchParams(location.search).get('project');

let BAL=[],STORES=[],MATERIALS=[],MOVES=[],PROJECTS=[];
let fStore='',fCat='',fStatus='',search='';

function byId(rows,id){return rows.find(x=>x.id===id);}
function movementSign(t){return ['grn_in','return_in','transfer_in','adjust_in'].includes(t)?'+':'−';}

async function load(){
  try{
    const a=await Promise.all([
      supabase.from('stock_balances').select('*').order('name'),
      scopeToUnit(supabase.from('stores').select('*')).eq('status','active').order('name'),
      scopeToUnit(supabase.from('materials').select('*')).eq('status','active').order('name'),
      scopeToUnit(supabase.from('stock_ledger').select('*')).order('moved_on',{ascending:false}).order('created_at',{ascending:false}).limit(50),
      scopeToUnit(supabase.from('projects').select('id,project_no,code,name,status').is('deleted_at',null)).order('name')
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    [BAL,STORES,MATERIALS,MOVES,PROJECTS]=a.map(r=>r.data||[]);
    fillFilters();render();
  }catch(e){fail(e);}
}

function fillFilters(){
  $('#storeSel').innerHTML='<option value="">All stores</option>'+STORES.map(s=>'<option value="'+s.id+'"'+(s.id===fStore?' selected':'')+'>'+esc(s.name)+'</option>').join('');
  const cats=[...new Set(MATERIALS.map(m=>m.category).filter(Boolean))].sort();
  $('#catSel').innerHTML='<option value="">All categories</option>'+cats.map(c=>'<option value="'+esc(c)+'"'+(c===fCat?' selected':'')+'>'+esc(c)+'</option>').join('');
}

function pass(b){
  if(projectHint&&b.project_id!==projectHint)return false;
  if(fStore&&b.store_id!==fStore)return false;
  if(fCat&&b.category!==fCat)return false;
  if(fStatus&&b.stock_status!==fStatus)return false;
  if(search&&!String(b.name+' '+(b.code||'')+' '+(b.category||'')+' '+(b.store_name||'')).toLowerCase().includes(search))return false;
  return true;
}

function render(){
  const rows=BAL.filter(pass);
  const stockValue=BAL.reduce((a,b)=>a+Number(b.value||0),0);
  const low=BAL.filter(b=>b.stock_status==='low'),out=BAL.filter(b=>b.stock_status==='out');
  const todayMoves=MOVES.filter(m=>m.moved_on===today()).length;
  $('#kValue').textContent=money(stockValue);
  $('#kSku').textContent=String(MATERIALS.length);
  $('#kLow').textContent=String(low.length);
  $('#kOut').textContent=String(out.length);
  $('#kMove').textContent=String(todayMoves);
  $('#invCount').textContent=String(rows.length);
  $('#alertTag').textContent=String(low.length+out.length);
  $('#storeCount').textContent=String(STORES.length);
  $('#addItemBtn').disabled=!canMaster;
  $('#adjustBtn').disabled=!canMaster;
  renderStock(rows);renderMoves();renderAlerts([...out,...low]);renderStores();renderCategories();
}

function renderStock(rows){
  $('#invBody').innerHTML=rows.length?rows.map(b=>{
    const store=byId(STORES,b.store_id),project=store?.project_id?byId(PROJECTS,store.project_id):null;
    return '<tr><td><div class="s-doc">'+esc(b.name)+'</div><div class="s-meta">'+esc(b.category||'Uncategorised')+(b.code?' · '+esc(b.code):'')+'</div></td><td>'+esc(b.store_name||'—')+'<div class="s-meta">'+esc(project?.name||'')+'</div></td><td class="num"><b>'+qty(b.qty)+' '+esc(b.unit)+'</b></td><td class="num">'+qty(b.reorder_level)+' '+esc(b.unit)+'</td><td><span class="s-status '+esc(b.stock_status)+'">'+(b.stock_status==='ok'?'in stock':b.stock_status==='low'?'low':'out')+'</span></td><td class="num">'+money(b.value)+'</td><td><div class="s-actions-inline">'+(canIssue&&Number(b.qty)>0?'<button class="s-btn primary" data-issue="'+b.material_id+':'+b.store_id+'">Issue</button>':'')+(canMaster?'<button class="s-btn" data-adjust="'+b.material_id+':'+b.store_id+'">Adjust</button>':'')+'</div></td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="s-empty">No stock matches the selected filters.</div></td></tr>';
}

function renderMoves(){
  $('#moveBody').innerHTML=MOVES.length?MOVES.map(m=>{
    const mat=byId(MATERIALS,m.material_id),store=byId(STORES,m.store_id);
    return '<tr><td>'+fmtDate(m.moved_on)+'</td><td>'+esc(mat?.name||'Material')+'</td><td>'+esc(store?.name||'Store')+'</td><td><span class="s-status '+(movementSign(m.movement_type)==='+'?'approved':'submitted')+'">'+esc(m.movement_type.replaceAll('_',' '))+'</span></td><td class="num"><b>'+movementSign(m.movement_type)+qty(m.qty)+' '+esc(mat?.unit||'')+'</b></td><td>'+esc(m.reference_no||m.purpose||'—')+'</td></tr>';
  }).join(''):'<tr><td colspan="6"><div class="s-empty">No stock movements yet.</div></td></tr>';
}

function renderAlerts(rows){
  $('#alerts').innerHTML=rows.length?rows.slice(0,10).map(b=>'<div class="s-list-row"><div class="s-list-body"><div class="s-list-title">'+esc(b.name)+'</div><div class="s-list-meta">'+esc(b.store_name)+' · '+qty(b.qty)+' '+esc(b.unit)+' on hand · reorder '+qty(b.reorder_level)+'</div></div><span class="s-status '+esc(b.stock_status)+'">'+esc(b.stock_status)+'</span></div>').join(''):'<div class="s-empty">Everything is above reorder level.</div>';
}

function renderStores(){
  $('#stores').innerHTML=STORES.length?STORES.map(s=>{
    const rows=BAL.filter(b=>b.store_id===s.id&&Number(b.qty)>0),value=rows.reduce((a,b)=>a+Number(b.value||0),0),p=byId(PROJECTS,s.project_id);
    return '<div class="s-list-row"><div class="s-list-body"><div class="s-list-title">'+esc(s.name)+'</div><div class="s-list-meta">'+esc(p?.name||s.location||'')+' · '+rows.length+' stocked items · '+money(value)+'</div></div></div>';
  }).join(''):'<div class="s-empty">Stores are created when a project first receives material.</div>';
}

function renderCategories(){
  const map=new Map();
  BAL.forEach(b=>map.set(b.category||'Other',(map.get(b.category||'Other')||0)+Number(b.value||0)));
  const rows=[...map.entries()].sort((a,b)=>b[1]-a[1]),top=Math.max(1,...rows.map(x=>x[1]));
  $('#categoryList').innerHTML=rows.length?rows.map(([name,value])=>'<div class="s-list-row"><div class="s-list-body"><div class="s-list-title">'+esc(name)+'</div><div class="s-list-meta">'+money(value)+'</div><div class="s-vbar"><span style="width:'+Math.round(value/top*100)+'%"></span></div></div></div>').join(''):'<div class="s-empty">Category values appear after the first GRN.</div>';
}

async function addMaterial(){
  const name=prompt('Material name');if(!name)return;
  const code=(prompt('Material code (optional)')||'').trim()||null;
  const category=prompt('Category e.g. Cement, Steel, Aggregate, Electrical, Plumbing')||null;
  const unit=prompt('Unit','nos')||'nos';
  const rate=Number(prompt('Default / reference rate',0)||0);
  const reorder=Number(prompt('Reorder level',0)||0);
  const hsn=(prompt('HSN code (optional)')||'').trim()||null;
  const gst=Number(prompt('GST %','18')||18);
  const r=await supabase.from('materials').insert({business_unit_id:activeUnit(),code,name:name.trim(),category,unit,default_rate:Math.max(0,rate),reorder_level:Math.max(0,reorder),hsn_code:hsn,gst_rate:Math.max(0,gst),status:'active'}).select('*').single();
  if(r.error)return fail(r.error);toast('Material master added');await load();
}

async function issue(materialId,storeId){
  const b=BAL.find(x=>x.material_id===materialId&&x.store_id===storeId),m=byId(MATERIALS,materialId);if(!b)return;
  const amount=Number(prompt('Issue quantity · available '+qty(b.qty)+' '+b.unit,'1'));if(!Number.isFinite(amount)||amount<=0)return;
  const purpose=prompt('Purpose / work package');if(!purpose)return toast('Purpose is required','err');
  const r=await supabase.rpc('issue_site_stock',{p_store_id:storeId,p_material_id:materialId,p_qty:amount,p_purpose:purpose,p_moved_on:today()});
  if(r.error)return fail(r.error);toast(qty(amount)+' '+(m?.unit||'')+' issued to site');await load();
}

async function adjust(materialId,storeId){
  const b=BAL.find(x=>x.material_id===materialId&&x.store_id===storeId);if(!b)return;
  const direction=(prompt('Adjustment type: in / out','in')||'').toLowerCase();if(!['in','out'].includes(direction))return toast('Use in or out','err');
  const amount=Number(prompt('Adjustment quantity',1));if(!Number.isFinite(amount)||amount<=0)return;
  const reason=prompt('Mandatory adjustment reason');if(!reason)return toast('Adjustment reason is required','err');
  const r=await supabase.from('stock_ledger').insert({business_unit_id:b.business_unit_id,project_id:b.project_id,store_id:storeId,material_id:materialId,movement_type:direction==='in'?'adjust_in':'adjust_out',qty:amount,rate:Number(b.last_rate||0),purpose:reason,moved_on:today(),recorded_by:user.id});
  if(r.error)return fail(r.error);toast('Stock adjustment posted');await load();
}

async function genericAdjust(){
  if(!STORES.length||!MATERIALS.length)return toast('Create material master and receive stock before adjustment','err');
  const store=promptChoice('Choose store',STORES,s=>s.name);if(!store)return;
  const mat=promptChoice('Choose material',MATERIALS,m=>m.name+' · '+m.unit);if(!mat)return;
  const b=BAL.find(x=>x.store_id===store.id&&x.material_id===mat.id);
  if(!b){
    const direction=(prompt('No current balance. Adjustment type must be in','in')||'').toLowerCase();if(direction!=='in')return toast('Cannot adjust out from zero stock','err');
    const amount=Number(prompt('Adjustment quantity',1));if(!Number.isFinite(amount)||amount<=0)return;
    const reason=prompt('Mandatory adjustment reason');if(!reason)return;
    const r=await supabase.from('stock_ledger').insert({business_unit_id:store.business_unit_id,project_id:store.project_id,store_id:store.id,material_id:mat.id,movement_type:'adjust_in',qty:amount,rate:Number(mat.default_rate||0),purpose:reason,moved_on:today(),recorded_by:user.id});
    if(r.error)return fail(r.error);toast('Opening adjustment posted');await load();return;
  }
  await adjust(mat.id,store.id);
}

function promptChoice(title,rows,label){
  const raw=prompt(title+'\n\n'+rows.map((x,i)=>(i+1)+'. '+label(x)).join('\n')+'\n\nEnter number');
  if(raw===null)return null;const n=Number(raw);return Number.isInteger(n)&&n>0&&n<=rows.length?rows[n-1]:null;
}

$('#procurementBtn').addEventListener('click',()=>location.href='/procurement.html');
$('#addItemBtn').addEventListener('click',()=>canMaster&&addMaterial());
$('#adjustBtn').addEventListener('click',()=>canMaster&&genericAdjust());
$('#storeSel').addEventListener('change',e=>{fStore=e.target.value;render();});
$('#catSel').addEventListener('change',e=>{fCat=e.target.value;render();});
$('#statSel').addEventListener('change',e=>{fStatus=e.target.value;render();});
$('#invSearch').addEventListener('input',e=>{search=e.target.value.trim().toLowerCase();render();});
document.addEventListener('click',e=>{
  const issueBtn=e.target.closest('[data-issue]');if(issueBtn){const [m,s]=issueBtn.dataset.issue.split(':');return issue(m,s);}
  const adj=e.target.closest('[data-adjust]');if(adj){const [m,s]=adj.dataset.adjust.split(':');return adjust(m,s);}
});

await load();
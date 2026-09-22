import { supabase } from '../lib/supabase.js';
import { mountShell, scopeToUnit, activeUnit } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user=await mountShell({route:'inventory',title:'Inventory'});
if(!user)throw new Error('redirecting');

const canStock=['founder','admin','procurement','project_manager','site_engineer'].includes(user.role);
const canMaster=['founder','admin','procurement','project_manager'].includes(user.role);
const qty=v=>{const n=Number(v)||0;return Number.isInteger(n)?String(n):n.toFixed(3).replace(/\.?0+$/,'');};
const money=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});

let BAL=[],STORES=[],MOVES=[],MATERIALS=[],PROJECTS=[];
let fStore='',fCat='',fStatus='',q='';

function pick(label,rows,fmt=x=>x.name){
  if(!rows.length){toast('No options available','err');return null;}
  const raw=prompt(label+'\n\n'+rows.map((x,i)=>(i+1)+'. '+fmt(x)).join('\n'));
  if(raw===null)return null;const n=Number(raw);
  if(!Number.isInteger(n)||n<1||n>rows.length){toast('Choose a valid number','err');return null;}
  return rows[n-1];
}

async function load(){
  try{
    const a=await Promise.all([
      supabase.from('stock_balances').select('*').order('name'),
      scopeToUnit(supabase.from('stores').select('*')).eq('status','active').order('name'),
      supabase.from('stock_ledger').select('*').order('moved_on',{ascending:false}).order('created_at',{ascending:false}).limit(40),
      scopeToUnit(supabase.from('materials').select('*')).eq('status','active').order('name'),
      scopeToUnit(supabase.from('projects').select('id,project_no,code,name').is('deleted_at',null)).order('name')
    ]);
    a.forEach(r=>{if(r.error)throw r.error;});
    [BAL,STORES,MOVES,MATERIALS,PROJECTS]=a.map(r=>r.data||[]);
    fillFilters();render();
  }catch(e){fail(e);}
}

function fillFilters(){
  $('#storeSel').innerHTML='<option value="all">All stores</option>'+STORES.map(s=>'<option value="'+s.id+'">'+esc(s.name)+' · '+esc(PROJECTS.find(p=>p.id===s.project_id)?.name||'General')+'</option>').join('');
  const cats=[...new Set(MATERIALS.map(m=>m.category).filter(Boolean))].sort();
  $('#catSeg').innerHTML='<button class="'+(!fCat?'on':'')+'" data-cat="all">All</button>'+cats.slice(0,7).map(c=>'<button class="'+(fCat===c?'on':'')+'" data-cat="'+esc(c)+'">'+esc(c.length>14?c.slice(0,12)+'…':c)+'</button>').join('');
  $('#cat').innerHTML=cats.length?cats.map(c=>{
    const rows=BAL.filter(b=>b.category===c),value=rows.reduce((a,b)=>a+Number(b.value||0),0);
    return '<div class="cat-row"><span>'+esc(c)+'</span><b>'+money(value)+'</b></div>';
  }).join(''):'<div class="tbl__empty">No material categories yet.</div>';
}

function passes(b){
  if(fStore&&b.store_id!==fStore)return false;
  if(fCat&&b.category!==fCat)return false;
  if(fStatus&&b.stock_status!==fStatus)return false;
  if(q&&!((b.name+' '+(b.code||'')+' '+(b.category||'')).toLowerCase().includes(q)))return false;
  return true;
}

function render(){
  const rows=BAL.filter(passes);
  $('#invBody').innerHTML=rows.length?rows.map(b=>
    '<tr><td><div class="inv-nm">'+esc(b.name)+'</div><div class="inv-sub">'+esc(b.category||'Uncategorised')+(b.code?' · '+esc(b.code):'')+'</div></td>'+
    '<td>'+esc(b.store_name)+'</td><td class="num">'+qty(b.qty)+' '+esc(b.unit)+'</td><td class="num">'+qty(b.reorder_level)+' '+esc(b.unit)+'</td>'+
    '<td><span class="pill '+esc(b.stock_status)+'"><span class="pill__dot"></span>'+(b.stock_status==='out'?'Out':b.stock_status==='low'?'Low':'In stock')+'</span></td>'+
    '<td class="num">'+money(b.value)+'</td><td><div style="display:flex;gap:5px;justify-content:flex-end">'+
      (canStock&&Number(b.qty)>0?'<button class="mini-act" data-issue="'+b.store_id+':'+b.material_id+'" title="Issue / consume">−</button>':'')+
      (canMaster?'<button class="mini-act" data-adjust-row="'+b.store_id+':'+b.material_id+'" title="Adjust">±</button>':'')+
    '</div></td></tr>'
  ).join(''):'<tr><td colspan="7" class="tbl__empty">No stock on hand matches these filters.</td></tr>';
  $('#invCount').textContent=rows.length+' balance'+(rows.length===1?'':'s');

  const low=BAL.filter(b=>b.stock_status==='low'),out=BAL.filter(b=>b.stock_status==='out');
  $('#kValue').textContent=money(BAL.reduce((a,b)=>a+Number(b.value||0),0));
  $('#kSku').textContent=String(MATERIALS.length);
  $('#kLow').textContent=String(low.length);$('#kOut').textContent=String(out.length);
  const tm=MOVES.filter(m=>m.moved_on===today());
  $('#kMoves').textContent=String(tm.length);
  $('#kMovesMeta').textContent=tm.filter(m=>['grn_in','return_in','adjust_in','transfer_in'].includes(m.movement_type)).length+' in · '+tm.filter(m=>['issue_out','adjust_out','transfer_out'].includes(m.movement_type)).length+' out';

  const alerts=[...out,...low].slice(0,10);
  $('#alertTag').textContent=String(alerts.length);$('#alertTag').hidden=!alerts.length;
  $('#alerts').innerHTML=alerts.length?alerts.map(b=>'<div class="alert alert--'+esc(b.stock_status)+'"><span class="alert__nm">'+esc(b.name)+'</span><span class="alert__meta">'+esc(b.store_name)+' · '+qty(b.qty)+' '+esc(b.unit)+' / reorder '+qty(b.reorder_level)+'</span></div>').join(''):'<div class="alert">All stocked items are above reorder level.</div>';

  $('#stores').innerHTML=STORES.length?STORES.map(s=>{
    const rows=BAL.filter(b=>b.store_id===s.id),value=rows.reduce((a,b)=>a+Number(b.value||0),0),p=PROJECTS.find(p=>p.id===s.project_id);
    return '<div class="store"><span class="store__nm">'+esc(s.name)+'</span><span class="store__meta">'+esc(p?.name||'General')+' · '+rows.length+' items · '+money(value)+'</span></div>';
  }).join(''):'<div class="store">No stores yet. A site store is created on first receipt.</div>';

  $('#moves').innerHTML=MOVES.length?MOVES.map(m=>{
    const mat=MATERIALS.find(x=>x.id===m.material_id),store=STORES.find(x=>x.id===m.store_id);
    const inward=['grn_in','return_in','transfer_in','adjust_in'].includes(m.movement_type);
    return '<div class="mv mv--'+(inward?'in':'out')+'"><span class="mv__nm">'+esc(mat?.name||'Material')+'</span><span class="mv__qty">'+(inward?'+':'−')+qty(m.qty)+' '+esc(mat?.unit||'')+'</span><span class="mv__meta">'+esc(store?.name||'Store')+' · '+esc(m.movement_type.replaceAll('_',' '))+' · '+fmtDate(m.moved_on)+(m.reference_no?' · '+esc(m.reference_no):'')+'</span></div>';
  }).join(''):'<div class="mv">No stock movements yet.</div>';
}

async function addMaterial(){
  if(!canMaster)return toast('Material master access denied','err');
  const name=prompt('Material name');if(!name)return;
  const code=(prompt('Material code (optional)')||'').trim().toUpperCase()||null;
  const category=prompt('Category','Building Materials')||null;
  const unit=prompt('Base unit','nos')||'nos';
  const rate=Number(prompt('Default rate','0'))||0;
  const reorder=Number(prompt('Reorder level','0'))||0;
  const hsn=(prompt('HSN code (optional)')||'').trim()||null;
  const gst=Number(prompt('GST rate %','18'))||0;
  const r=await supabase.from('materials').insert({business_unit_id:activeUnit(),code,name:name.trim(),category,unit,default_rate:rate,reorder_level:reorder,hsn_code:hsn,gst_rate:gst}).select('*').single();
  if(r.error)return fail(r.error);toast('Material added');await load();
}

async function issueStock(key){
  if(!canStock)return;
  const [storeId,materialId]=key.split(':');
  const b=BAL.find(x=>x.store_id===storeId&&x.material_id===materialId);if(!b)return;
  const raw=prompt('Issue / consumption quantity\nAvailable '+qty(b.qty)+' '+b.unit);if(raw===null)return;
  const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0)return toast('Enter a positive quantity','err');
  const purpose=prompt('Purpose / work activity','Site consumption');if(!purpose)return;
  const r=await supabase.rpc('issue_site_stock',{p_store_id:storeId,p_material_id:materialId,p_qty:amount,p_purpose:purpose,p_moved_on:today()});
  if(r.error)return fail(r.error);toast(qty(amount)+' '+b.unit+' issued');await load();
}

async function adjustStock(key){
  if(!canMaster)return toast('Stock adjustment requires Procurement / Management','err');
  let store,mat;
  if(key){
    const [sid,mid]=key.split(':');store=STORES.find(x=>x.id===sid);mat=MATERIALS.find(x=>x.id===mid);
  }else{
    store=pick('Choose store',STORES,s=>s.name+' · '+(PROJECTS.find(p=>p.id===s.project_id)?.name||'General'));if(!store)return;
    mat=pick('Choose material',MATERIALS,m=>m.name+' · '+m.unit);if(!mat)return;
  }
  const dir=(prompt('Adjustment type: in / out','in')||'').toLowerCase();if(!['in','out'].includes(dir))return toast('Enter in or out','err');
  const raw=prompt('Adjustment quantity');if(raw===null)return;const amount=Number(raw);
  if(!Number.isFinite(amount)||amount<=0)return toast('Enter a positive quantity','err');
  const reason=prompt('Mandatory adjustment reason');if(!reason)return;
  const r=await supabase.from('stock_ledger').insert({business_unit_id:store.business_unit_id,project_id:store.project_id,store_id:store.id,material_id:mat.id,movement_type:dir==='in'?'adjust_in':'adjust_out',qty:amount,rate:mat.default_rate||0,purpose:reason,moved_on:today(),recorded_by:user.id});
  if(r.error)return fail(r.error);toast('Stock adjustment posted');await load();
}

$('#addItemBtn').addEventListener('click',addMaterial);
$('#adjustBtn').addEventListener('click',()=>adjustStock());
$('#storeSel').addEventListener('change',e=>{fStore=e.target.value==='all'?'':e.target.value;render();});
$('#statSel').addEventListener('change',e=>{fStatus=e.target.value==='all'?'':e.target.value;render();});
$('#invSearch').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();render();});
$('#catSeg').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;fCat=b.dataset.cat==='all'?'':b.dataset.cat;fillFilters();render();});
document.addEventListener('click',e=>{const i=e.target.closest('[data-issue]');if(i)return issueStock(i.dataset.issue);const a=e.target.closest('[data-adjust-row]');if(a)return adjustStock(a.dataset.adjustRow);});

await load();

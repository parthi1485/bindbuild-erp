import { supabase } from '../lib/supabase.js';
import { mountShell, activeUnit, activeUnitName } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate } from '../lib/ui.js';

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user=await mountShell({route:'settings',title:'Settings'});
if(!user)throw new Error('redirecting');

const canWrite=['founder','admin','finance'].includes(user.role);
const canUnlock=['founder','admin'].includes(user.role);
let ORG=null,LOCK=null,SELF_EMP=null;

const fields={
  tradeName:'trade_name',legalName:'legal_name',gstin:'gstin',pan:'pan',
  email:'email',phone:'phone',address:'address',city:'city',state:'state',
  stateCode:'state_code',pincode:'pincode',accountName:'account_name',
  bankName:'bank_name',accountNo:'account_no',ifsc:'ifsc',upi:'upi'
};

function fyKey(d=new Date()){
  const y=d.getMonth()>=3?d.getFullYear():d.getFullYear()-1;
  return String(y).slice(-2)+'-'+String(y+1).slice(-2);
}
function norm(id){return String($('#'+id)?.value||'').trim();}
function validOrg(){
  return !!(ORG?.trade_name&&ORG?.legal_name&&ORG?.gstin&&ORG?.pan&&ORG?.address&&ORG?.city&&ORG?.state&&ORG?.state_code);
}
function validate(patch){
  if(patch.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(patch.gstin))
    throw new Error('GSTIN format looks invalid');
  if(patch.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(patch.pan))
    throw new Error('PAN format looks invalid');
  if(patch.state_code && !/^[0-9]{2}$/.test(patch.state_code))
    throw new Error('GST state code must be 2 digits');
  if(patch.pincode && !/^[0-9]{6}$/.test(patch.pincode))
    throw new Error('PIN code must be 6 digits');
  if(patch.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(patch.ifsc))
    throw new Error('IFSC format looks invalid');
}

async function load(){
  try{
    const unit=activeUnit();
    if(!unit)throw new Error('Choose a business unit first');
    const [o,l,t,e]=await Promise.all([
      supabase.from('organisation_profiles').select('*').eq('business_unit_id',unit).maybeSingle(),
      supabase.from('accounting_period_locks').select('*').eq('business_unit_id',unit).eq('period_key',fyKey()).maybeSingle(),
      supabase.from('profiles').select('id,full_name,role,is_active').eq('is_active',true).order('full_name'),
      supabase.from('employees').select('id,employee_no,full_name,designation,department,status').eq('profile_id',user.id).maybeSingle()
    ]);
    if(o.error)throw o.error;if(l.error)throw l.error;if(t.error)throw t.error;if(e.error)throw e.error;
    ORG=o.data;LOCK=l.data;SELF_EMP=e.data;
    if(!ORG){
      const ins=await supabase.from('organisation_profiles').insert({business_unit_id:unit,trade_name:activeUnitName()}).select('*').single();
      if(ins.error)throw ins.error;ORG=ins.data;
    }
    paintOrg();paintLock();paintTeam(t.data||[]);paintTheme();paintProfile();paintRequestedTab();
  }catch(e){fail(e);}
}

function paintOrg(){
  Object.entries(fields).forEach(([id,col])=>{const el=$('#'+id);if(el){el.value=ORG?.[col]??'';el.disabled=!canWrite;}});
  const status=$('#orgStatus');
  if(status){status.textContent=validOrg()?'Ready':'Incomplete';status.classList.toggle('on',validOrg());status.classList.toggle('off',!validOrg());}
  $('#saveOrg').disabled=!canWrite;$('#saveBank').disabled=!canWrite;
}

async function save(keys){
  if(!canWrite)return toast('Founder, Admin or Finance access required','err');
  try{
    const patch={};
    keys.forEach(id=>patch[fields[id]]=norm(id)||null);
    validate(patch);
    patch.updated_at=new Date().toISOString();patch.updated_by=user.id;
    const {data,error}=await supabase.from('organisation_profiles').update(patch).eq('id',ORG.id).select('*').single();
    if(error)throw error;ORG=data;paintOrg();toast('Organisation profile saved');
  }catch(e){toast(e.message||String(e),'err');}
}
$('#saveOrg').addEventListener('click',()=>save(['tradeName','legalName','gstin','pan','email','phone','address','city','state','stateCode','pincode']));
$('#saveBank').addEventListener('click',()=>save(['accountName','bankName','accountNo','ifsc','upi']));

function paintLock(){
  const key=fyKey();
  $('#fyLabel').textContent='FY '+key;
  $('#fyMeta').textContent=LOCK?'Locked '+fmtDate(LOCK.locked_at)+(LOCK.note?' · '+LOCK.note:''):'Open for posting';
  $('#lockStatus').textContent=LOCK?'Locked':'Open';
  $('#lockStatus').classList.toggle('on',!!LOCK);$('#lockStatus').classList.toggle('off',!LOCK);
  $('#lockBtn').textContent=LOCK?'Unlock period':'Lock period';
  $('#lockBtn').classList.toggle('btn-danger',!LOCK);
  $('#lockBtn').classList.toggle('btn-ghost',!!LOCK);
  $('#lockBtn').disabled=LOCK?!canUnlock:!canWrite;
  $('#lockNote').disabled=!!LOCK||!canWrite;
}
$('#lockBtn').addEventListener('click',async()=>{
  const unit=activeUnit(),key=fyKey();
  if(LOCK){
    if(!canUnlock)return toast('Only Founder or Admin can reopen a period','err');
    if(!confirm('Reopen FY '+key+' for financial posting?'))return;
    const {error}=await supabase.from('accounting_period_locks').delete().eq('id',LOCK.id);
    if(error)return fail(error);LOCK=null;paintLock();toast('FY '+key+' reopened');
    return;
  }
  if(!canWrite)return;
  if(!confirm('Lock FY '+key+'? New invoices, receipts, credit notes and corrections will be blocked.'))return;
  const {data,error}=await supabase.from('accounting_period_locks').insert({
    business_unit_id:unit,period_key:key,note:norm('lockNote')||null
  }).select('*').single();
  if(error)return fail(error);LOCK=data;paintLock();toast('FY '+key+' locked');
});

function paintProfile(){
  $('#myName').value=user.name||'';
  $('#myEmail').value=user.email||'';
  $('#myRole').value=String(user.role||'').replaceAll('_',' ');
  $('#myUserId').value=user.id||'';
  $('#profileStatus').textContent=user.profile?.is_active?'Active':'Inactive';
  $('#employeeLinkMeta').textContent=SELF_EMP
    ? [SELF_EMP.employee_no,SELF_EMP.designation,SELF_EMP.department,SELF_EMP.status].filter(Boolean).join(' · ')
    : 'No HR employee record is linked to this ERP account.';
  $('#openEmployeeBtn').disabled=!SELF_EMP;
  $('#openEmployeeBtn').onclick=()=>{if(SELF_EMP)location.href='/employee.html?id='+encodeURIComponent(SELF_EMP.id);};
}
function paintRequestedTab(){
  const requested=new URLSearchParams(location.search).get('tab');
  const btn=requested?document.querySelector('[data-tab="'+CSS.escape(requested)+'"]'):null;
  if(btn){
    $('[data-tab]').forEach(x=>x.classList.toggle('on',x===btn));
    $('.panel').forEach(p=>p.classList.toggle('on',p.id==='p-'+requested));
  }
}

function paintTeam(team){
  $('#teamList').innerHTML=team.length?team.map(p=>`<div class="mem"><span class="mav c0">${esc(initials(p.full_name||'?'))}</span><div><div class="mem__n">${esc(p.full_name||'Unnamed')}</div><div class="mem__e">${esc(String(p.role||'viewer').replaceAll('_',' '))}</div></div><span class="role ${['founder','admin'].includes(p.role)?'admin':''}">${esc(p.role)}</span></div>`).join(''):'<div class="mem">No active users</div>';
}

$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
  $$('[data-tab]').forEach(x=>x.classList.toggle('on',x===b));
  $$('.panel').forEach(p=>p.classList.toggle('on',p.id==='p-'+b.dataset.tab));
}));

function paintTheme(){
  const cur=document.documentElement.getAttribute('data-theme');
  $$('#themeSeg [data-theme-set]').forEach(b=>b.classList.toggle('on',b.dataset.themeSet===cur));
}
$('#themeSeg').addEventListener('click',e=>{
  const b=e.target.closest('[data-theme-set]');if(!b)return;
  document.documentElement.setAttribute('data-theme',b.dataset.themeSet);
  localStorage.setItem('bindbuild.theme',b.dataset.themeSet);paintTheme();
});

await load();
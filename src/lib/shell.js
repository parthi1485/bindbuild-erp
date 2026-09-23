import { SIDEBAR_HTML, TOPBAR_HTML } from './shell-template.js';
import { requireAuth, signOut } from './auth.js';
import { initials, toast, esc } from './ui.js';
import { supabase } from './supabase.js';

/* Routes that have a real page. Everything else in the nav is still a
   prototype — add the slug here as each page gets converted. */
const BUILT = new Set(['dashboard','assistant','analytics','crm','sales','clients','projects','design','construction','site-visits','procurement','inventory','finance','hr','people','documents','meetings','tasks','calendar','client-portal','vendor-portal','backup','settings']);

/* ---------------------------------------------------------------
   business unit
   The active unit is a session preference, not a filter the database
   enforces — RLS is about who may see a row, not which vertical the user is
   looking at. Pages read activeUnit() on insert and when filtering lists.
--------------------------------------------------------------- */
const UNIT_KEY = 'bindbuild.unit';
let UNITS = [];

export const activeUnit = () => localStorage.getItem(UNIT_KEY) || null;
export const activeUnitName = () =>
  UNITS.find(u => u.id === activeUnit())?.name || 'All units';

/** Scope a query to the active unit. Rows with no unit stay visible, so
 *  anything created before units existed does not vanish. */
export function scopeToUnit(query, column = 'business_unit_id') {
  const id = activeUnit();
  return id ? query.or(`${column}.eq.${id},${column}.is.null`) : query;
}

async function mountUnitPicker() {
  const { data, error } = await supabase
    .from('business_units').select('id,code,name,active')
    .eq('active', true).order('name');
  if (error || !data?.length) return;

  UNITS = data;
  if (!activeUnit()) {
    const def = data.find(u => u.code === 'BB') || data[0];
    localStorage.setItem(UNIT_KEY, def.id);
  }

  /* only worth showing once there is more than one vertical */
  if (data.length < 2) return;

  const host = document.querySelector('.topbar__right, .topbar .right')
            || document.getElementById('newBtn')?.parentElement
            || document.querySelector('.topbar');
  if (!host || document.getElementById('unitSel')) return;

  host.insertAdjacentHTML('afterbegin',
    `<label class="unit-pick" title="Business unit">
       <select id="unitSel" aria-label="Business unit">
         ${data.map(u => `<option value="${u.id}"${u.id === activeUnit() ? ' selected' : ''}>${esc(u.code)}</option>`).join('')}
       </select>
     </label>`);

  document.getElementById('unitSel').addEventListener('change', e => {
    localStorage.setItem(UNIT_KEY, e.target.value);
    location.reload();          // simplest correct refresh of every query
  });
}

/* ---------- theme (runs before paint to avoid a flash) ---------- */
export function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem('bindbuild.theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  root.setAttribute('data-theme', saved || (prefersLight ? 'light' : 'dark'));
}

function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('bindbuild.theme', next);
}

/* ---------- dropdown plumbing ---------- */
function wireMenu(btnId, menuId) {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', () => {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });
  menu.addEventListener('click', e => e.stopPropagation());
}

/**
 * Mount the app shell.
 * @param {object} o
 * @param {string} o.route  - data-route slug of the active nav item
 * @param {string} o.title  - breadcrumb leaf
 * @returns identity object, or null if the guard redirected
 */
export async function mountShell({ route, title }) {
  const user = await requireAuth();
  if (!user) return null;

  const app  = document.getElementById('app');
  const col  = document.getElementById('main');

  app.insertAdjacentHTML('afterbegin', SIDEBAR_HTML);
  col.insertAdjacentHTML('afterbegin', TOPBAR_HTML);

  document.getElementById('scrim')?.addEventListener('click', () => {
    document.body.classList.remove('nav-open');
  });

  /* active nav */
  const active = document.querySelector(`.nav-item[data-route="${route}"]`);
  if (active) {
    active.classList.add('is-active');
    active.setAttribute('aria-current', 'page');
  }

  /* breadcrumb */
  const here = document.querySelector('.crumbs .here');
  if (here && title) here.textContent = title;
  const homeLink = document.querySelector('.crumbs a');
  if (homeLink) homeLink.setAttribute('href', '/dashboard.html');

  /* real identity */
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('avatarInitials', initials(user.name));
  set('profileName', user.name);
  set('profileRole', user.title);
  set('menuName', user.name);
  set('menuEmail', user.email);

  /* controls */
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('navToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('nav-open');
  });
  document.getElementById('signOutBtn')?.addEventListener('click', signOut);
  wireMenu('newBtn', 'newMenu');
  wireMenu('profileBtn', 'profileMenu');
  /* Quick-create routes respect the ERP workflow instead of inventing bypasses. */
  document.getElementById('newMenu')?.addEventListener('click', e => {
    const item=e.target.closest('[data-new]');
    if(!item)return;
    e.preventDefault();
    const routes={
      'Lead':'/crm.html?new=1',
      'Project':'/sales.html?new=project',
      'Invoice':'/finance.html?new=invoice',
      'Task':'/tasks.html?new=1',
      'Site visit log':'/dsr.html?new=1'
    };
    const href=routes[item.dataset.new];
    if(href)location.href=href;
  });

  /* Profile menu */
  document.getElementById('profileMenu')?.addEventListener('click',e=>{
    const item=e.target.closest('[data-nav]');
    if(!item)return;
    if(item.dataset.nav==='My profile'){e.preventDefault();location.href='/settings.html?tab=profile';}
    if(item.dataset.nav==='Settings'){e.preventDefault();location.href='/settings.html';}
  });

  /* ⌘K / Ctrl-K focuses global search */
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.getElementById('searchInput')?.focus();
    }
    if (e.key === 'Escape') {
      document.body.classList.remove('nav-open');
      document.getElementById('searchPop')?.classList.remove('open');
      document.getElementById('searchInput')?.setAttribute('aria-expanded','false');
    }
  });

  /* Pages not yet converted from the prototype would 404. Say so instead. */
  document.querySelectorAll('.nav-item[data-route]').forEach(a => {
    if (BUILT.has(a.dataset.route)) return;
    a.classList.add('is-pending');
    a.addEventListener('click', e => {
      e.preventDefault();
      toast(`${a.dataset.nav || 'That module'} isn't wired up yet`, 'err');
      document.body.classList.remove('nav-open');
    });
  });

  await mountUnitPicker();
  await mountGlobalSearch(user);

  /* prototype storage quota was fictional; hide it until live bucket usage is measured */
  const storagePrototype = document.querySelector('.sidebar__foot .storage');
  if (storagePrototype) storagePrototype.hidden = true;

  /* live nav counters straight off the database */
  paintCounts();
  await mountNotifications(user);

  return user;
}

async function mountNotifications(user) {
  const btn=document.getElementById('notifBtn');
  if(!btn)return;

  if(!document.getElementById('erpNotifStyles')){
    const s=document.createElement('style');s.id='erpNotifStyles';
    s.textContent=`
      .erp-notif{position:fixed;right:18px;top:72px;width:min(390px,calc(100vw - 28px));max-height:70vh;z-index:90;background:var(--elevated);border:1px solid var(--hairline-strong);border-radius:16px;box-shadow:var(--shadow-2);display:none;overflow:hidden}
      .erp-notif.open{display:block}.erp-notif__head{display:flex;align-items:center;justify-content:space-between;padding:13px 14px;border-bottom:1px solid var(--hairline)}.erp-notif__title{font:650 13px var(--font-display)}.erp-notif__body{max-height:54vh;overflow:auto}.erp-notif__row{display:flex;gap:10px;width:100%;text-align:left;padding:11px 14px;border-bottom:1px solid var(--hairline)}.erp-notif__row:hover{background:var(--surface-2)}.erp-notif__dot{width:8px;height:8px;border-radius:50%;background:var(--accent);margin-top:5px;flex:none}.erp-notif__dot.warning{background:var(--warning)}.erp-notif__dot.critical{background:var(--danger)}.erp-notif__main{flex:1;min-width:0}.erp-notif__t{font-size:11.5px;font-weight:650}.erp-notif__m{font-size:10px;color:var(--text-3);margin-top:2px;line-height:1.35}.erp-notif__foot{display:flex;justify-content:flex-end;padding:10px 12px}.erp-notif__empty{padding:22px;text-align:center;color:var(--text-3);font-size:11px}
    `;
    document.head.appendChild(s);
  }

  let drawer=document.getElementById('erpNotifDrawer');
  if(!drawer){
    drawer=document.createElement('aside');drawer.id='erpNotifDrawer';drawer.className='erp-notif';
    drawer.innerHTML='<div class="erp-notif__head"><div class="erp-notif__title">Notifications</div><button class="icon-btn" id="erpNotifClose" aria-label="Close">×</button></div><div class="erp-notif__body" id="erpNotifBody"></div><div class="erp-notif__foot"><button class="btn-ghost" id="erpNotifReadAll">Mark all read</button></div>';
    document.body.appendChild(drawer);
  }

  let rows=[];
  async function refresh(){
    let q=supabase.from('erp_notifications').select('*').order('created_at',{ascending:false}).limit(40);
    const unit=activeUnit();if(unit)q=q.or(`business_unit_id.eq.${unit},business_unit_id.is.null`);
    const {data,error}=await q;
    if(error){const badge=document.getElementById('notifCount');if(badge)badge.hidden=true;return;}
    rows=data||[];
    const ids=rows.map(x=>x.id);
    let readMap=new Map();
    if(ids.length){
      const rr=await supabase.from('erp_notification_reads').select('notification_id,status,read_at').eq('user_id',user.id).in('notification_id',ids);
      if(!rr.error)readMap=new Map((rr.data||[]).map(x=>[x.notification_id,x]));
    }
    rows=rows.map(x=>({...x,user_status:readMap.get(x.id)?.status||'unread',user_read_at:readMap.get(x.id)?.read_at||null}));
    const unread=rows.filter(x=>x.user_status==='unread').length;
    const badge=document.getElementById('notifCount');
    if(badge){badge.textContent=unread?String(unread):'';badge.hidden=!unread;}
    const visible=rows.filter(x=>x.user_status!=='dismissed');
    const body=document.getElementById('erpNotifBody');
    body.innerHTML=visible.length?visible.map(n=>`<button class="erp-notif__row" data-notif="${n.id}" data-kind="${esc(n.entity_type||'')}" data-entity="${esc(n.entity_id||'')}"><span class="erp-notif__dot ${esc(n.severity)}"></span><span class="erp-notif__main"><span class="erp-notif__t">${esc(n.title)}</span><span class="erp-notif__m">${esc(n.body||'')}${n.user_status==='unread'?' · New':''}</span></span></button>`).join(''):'<div class="erp-notif__empty">No operational alerts.</div>';
  }
  await refresh();

  btn.setAttribute('aria-label','Notifications');
  btn.addEventListener('click',e=>{e.stopPropagation();drawer.classList.toggle('open');});
  document.getElementById('erpNotifClose')?.addEventListener('click',()=>drawer.classList.remove('open'));
  document.getElementById('erpNotifReadAll')?.addEventListener('click',async()=>{
    const ids=rows.filter(x=>x.user_status==='unread').map(x=>x.id);if(!ids.length)return;
    const at=new Date().toISOString();
    const payload=ids.map(id=>({notification_id:id,user_id:user.id,status:'read',read_at:at}));
    const {error}=await supabase.from('erp_notification_reads').upsert(payload,{onConflict:'notification_id,user_id'});
    if(error)return toast(error.message||String(error),'err');await refresh();
  });
  document.getElementById('erpNotifBody')?.addEventListener('click',async e=>{
    const b=e.target.closest('[data-notif]');if(!b)return;
    const row=rows.find(x=>x.id===b.dataset.notif);
    if(row?.user_status==='unread')await supabase.from('erp_notification_reads').upsert({notification_id:row.id,user_id:user.id,status:'read',read_at:new Date().toISOString()},{onConflict:'notification_id,user_id'});
    drawer.classList.remove('open');await refresh();
    const map={invoice:'/finance.html',vendor_bill:'/finance.html',approval:'/projects.html',material:'/inventory.html'};
    if(b.dataset.kind==='task'&&b.dataset.entity)location.href='/tasks.html?task='+encodeURIComponent(b.dataset.entity);
    else if(map[b.dataset.kind])location.href=map[b.dataset.kind];
  });
}

/* The prototype hardcoded nav counts (Projects 12, Procurement 3). A number
   that lies is worse than no number, so each badge is either real or hidden. */
async function paintCounts() {
  const head = { count: 'exact', head: true };

  const [leads, projects, pos, reqs] = await Promise.all([
    scopeToUnit(supabase.from('leads').select('id', head)).is('deleted_at', null).not('stage', 'in', '("won","lost")'),
    scopeToUnit(supabase.from('projects').select('id', head)).is('deleted_at', null).not('status', 'in', '("completed","cancelled")'),
    scopeToUnit(supabase.from('purchase_orders').select('id', head)).eq('status', 'approval'),
    scopeToUnit(supabase.from('material_requisitions').select('id', head)).eq('status', 'submitted')
  ]);

  const set = (route, res) => {
    const badge = document.querySelector(`.nav-item[data-route="${route}"] .nav-item__count`);
    if (!badge) return;
    const n = res?.error ? null : res?.count;
    if (n) { badge.textContent = String(n); badge.hidden = false; }
    else   { badge.textContent = ''; badge.hidden = true; }
  };

  set('crm', leads);
  set('projects', projects);
  const supplyPending = (pos?.error || reqs?.error) ? null : { count: Number(pos?.count||0)+Number(reqs?.count||0) };
  set('procurement', supplyPending);

  /* any remaining hardcoded badge is prototype fiction — clear it */
  document.querySelectorAll('.nav-item .nav-item__count').forEach(b => {
    if (!b.textContent.trim()) b.hidden = true;
  });
}


async function mountGlobalSearch(user){
  const input=document.getElementById('searchInput');
  const pop=document.getElementById('searchPop');
  if(!input||!pop)return;

  if(!document.getElementById('erpSearchStyles')){
    const s=document.createElement('style');s.id='erpSearchStyles';
    s.textContent=`
      .search__pop.open{display:block}.gs-empty{padding:18px;color:var(--text-3);font-size:11px;text-align:center}
      .gs-group{padding:7px 8px 3px}.gs-group__label{padding:5px 7px;font:700 8.5px var(--font-mono);letter-spacing:.09em;color:var(--text-3);text-transform:uppercase}
      .gs-row{display:flex;width:100%;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;text-align:left;color:var(--text)}
      .gs-row:hover,.gs-row.is-active{background:var(--surface-2)}.gs-ico{width:28px;height:28px;border:1px solid var(--hairline);border-radius:8px;display:grid;place-items:center;color:var(--text-3);font:700 9px var(--font-mono);flex:none}
      .gs-main{flex:1;min-width:0}.gs-title{display:block;font-size:11.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gs-meta{display:block;font-size:9.5px;color:var(--text-3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .gs-kbd{font:600 8px var(--font-mono);color:var(--text-3);border:1px solid var(--hairline);border-radius:5px;padding:2px 4px}
    `;
    document.head.appendChild(s);
  }

  const unit=()=>activeUnit();
  let timer=null,seq=0,items=[],active=-1;
  const clean=v=>String(v||'').replace(/[^a-zA-Z0-9@._+\-\s/]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
  const pattern=v=>'%'+clean(v).replace(/%/g,'')+'%';

  function group(title,rows){
    if(!rows.length)return '';
    return '<div class="gs-group"><div class="gs-group__label">'+esc(title)+'</div>'+rows.map(r=>{
      const idx=items.length;items.push(r);
      return '<button class="gs-row" role="option" data-gs="'+idx+'"><span class="gs-ico">'+esc(r.code)+'</span><span class="gs-main"><span class="gs-title">'+esc(r.title)+'</span><span class="gs-meta">'+esc(r.meta||'')+'</span></span><span class="gs-kbd">↵</span></button>';
    }).join('')+'</div>';
  }

  function unitScope(q,col='business_unit_id'){
    const id=unit();return id?q.or(`${col}.eq.${id},${col}.is.null`):q;
  }

  async function search(raw){
    const q=clean(raw);const my=++seq;items=[];active=-1;
    if(q.length<2){pop.innerHTML='<div class="gs-empty">Type at least 2 characters to search the ERP.</div>';pop.classList.add('open');input.setAttribute('aria-expanded','true');return;}
    pop.innerHTML='<div class="gs-empty">Searching…</div>';pop.classList.add('open');input.setAttribute('aria-expanded','true');
    const p=pattern(q);
    try{
      const [leads,clients,projects,invoices,docs,vendors,employees,tasks]=await Promise.all([
        unitScope(supabase.from('leads').select('id,lead_no,name,phone,area,city,service').is('deleted_at',null)).or(`lead_no.ilike.${p},name.ilike.${p},phone.ilike.${p},area.ilike.${p},city.ilike.${p},service.ilike.${p}`).limit(6),
        unitScope(supabase.from('clients').select('id,name,phone,email,city').is('deleted_at',null)).or(`name.ilike.${p},phone.ilike.${p},email.ilike.${p},city.ilike.${p}`).limit(6),
        unitScope(supabase.from('projects').select('id,project_no,code,name,location,status').is('deleted_at',null)).or(`project_no.ilike.${p},code.ilike.${p},name.ilike.${p},location.ilike.${p}`).limit(6),
        unitScope(supabase.from('invoices').select('id,invoice_no,project_id,milestone_name,total,status').is('deleted_at',null)).or(`invoice_no.ilike.${p},milestone_name.ilike.${p}`).limit(6),
        unitScope(supabase.from('project_documents').select('id,document_no,title,document_type,project_id,status')).or(`document_no.ilike.${p},title.ilike.${p},discipline.ilike.${p}`).limit(6),
        unitScope(supabase.from('vendors').select('id,code,name,contact_person,phone,email,status')).or(`code.ilike.${p},name.ilike.${p},contact_person.ilike.${p},phone.ilike.${p},email.ilike.${p}`).limit(6),
        unitScope(supabase.from('employees').select('id,employee_no,full_name,designation,department,status')).or(`employee_no.ilike.${p},full_name.ilike.${p},designation.ilike.${p},department.ilike.${p}`).limit(6),
        supabase.from('tasks').select('id,project_id,title,status,priority,due_at').ilike('title',p).limit(6)
      ]);
      if(my!==seq)return;
      const ok=r=>r.error?[]:(r.data||[]);
      const html=[
        group('Leads',ok(leads).map(x=>({code:'LD',title:(x.lead_no||'Lead')+' · '+x.name,meta:[x.service,x.area||x.city,x.phone].filter(Boolean).join(' · '),href:'/lead.html?id='+x.id}))),
        group('Clients',ok(clients).map(x=>({code:'CL',title:x.name,meta:[x.city,x.phone,x.email].filter(Boolean).join(' · '),href:'/client.html?id='+x.id}))),
        group('Projects',ok(projects).map(x=>({code:'PR',title:(x.project_no||x.code||'Project')+' · '+x.name,meta:[x.location,x.status].filter(Boolean).join(' · '),href:'/project.html?id='+x.id}))),
        group('Invoices',ok(invoices).map(x=>({code:'IN',title:x.invoice_no||'Invoice',meta:[x.milestone_name,x.status,'₹'+Math.round(Number(x.total||0)).toLocaleString('en-IN')].filter(Boolean).join(' · '),href:'/invoice.html?id='+x.id}))),
        group('Documents',ok(docs).map(x=>({code:'DC',title:(x.document_no||'DOC')+' · '+x.title,meta:[x.document_type,x.status].filter(Boolean).join(' · '),href:'/documents.html'+(x.project_id?'?project='+x.project_id:'')}))),
        group('Vendors',ok(vendors).map(x=>({code:'VN',title:(x.code?x.code+' · ':'')+x.name,meta:[x.contact_person,x.phone,x.status].filter(Boolean).join(' · '),href:'/procurement.html?vendor='+x.id}))),
        group('Employees',ok(employees).map(x=>({code:'HR',title:(x.employee_no||'EMP')+' · '+x.full_name,meta:[x.designation,x.department,x.status].filter(Boolean).join(' · '),href:'/employee.html?id='+x.id}))),
        group('Tasks',ok(tasks).map(x=>({code:'TS',title:x.title,meta:[x.priority,x.status,x.due_at?'Due '+new Date(x.due_at).toLocaleDateString('en-IN'):null].filter(Boolean).join(' · '),href:'/tasks.html?task='+x.id})))
      ].join('');
      pop.innerHTML=html||'<div class="gs-empty">No matching ERP records.</div>';
    }catch(error){
      if(my!==seq)return;pop.innerHTML='<div class="gs-empty">'+esc(error?.message||'Search failed')+'</div>';
    }
  }

  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>search(input.value),180);});
  input.addEventListener('focus',()=>{if(input.value.trim())search(input.value);});
  input.addEventListener('keydown',e=>{
    const rows=[...pop.querySelectorAll('[data-gs]')];
    if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(rows.length-1,active+1);}
    else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(0,active-1);}
    else if(e.key==='Enter'&&active>=0){e.preventDefault();const item=items[active];if(item)location.href=item.href;}
    else return;
    rows.forEach((r,i)=>r.classList.toggle('is-active',i===active));rows[active]?.scrollIntoView({block:'nearest'});
  });
  pop.addEventListener('click',e=>{const b=e.target.closest('[data-gs]');if(!b)return;const item=items[Number(b.dataset.gs)];if(item)location.href=item.href;});
  document.addEventListener('click',e=>{if(!e.target.closest('#search')){pop.classList.remove('open');input.setAttribute('aria-expanded','false');}});
}

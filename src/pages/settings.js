import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate, daysAgo } from '../lib/ui.js';
const $ = (s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user = await mountShell({ route: 'settings', title: 'Settings' });
if (!user) throw new Error('redirecting');

const isAdmin = ['owner','admin'].some(r => user.roles.includes(r));
let ORG = null;

const FIELDS = {
  oName: 'display_name', oLegal: 'legal_name', oGst: 'gstin', oPan: 'pan',
  oAddr: 'address_line', oPhone: 'phone', oEmail: 'email', oWeb: 'website',
  pCur: 'currency', pDate: 'date_format', pUnit: 'unit_system',
  pWeek: 'week_start', pTz: 'timezone'
};

async function load() {
  const [o, t] = await Promise.all([
    supabase.from('org_settings').select('*').maybeSingle(),
    supabase.from('profiles').select('id,full_name,email,job_title')
  ]);
  if (o.error) return fail(o.error);
  ORG = o.data;
  paintOrg();
  await paintTeam(t.data ?? []);
  paintTheme();
  await paintAudit();
}

function paintOrg() {
  if (!ORG) return;
  for (const [id, col] of Object.entries(FIELDS)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if ('value' in el) { el.value = ORG[col] ?? ''; el.disabled = !isAdmin; }
    else el.textContent = ORG[col] ?? '—';
  }
  const fy = $('#pFy');
  if (fy) { fy.value = String(ORG.fy_start_month ?? 4); fy.disabled = !isAdmin; }
}

async function saveOrg() {
  if (!isAdmin) return toast('Only owners and admins can change org settings', 'err');
  const patch = {};
  for (const [id, col] of Object.entries(FIELDS)) {
    const el = document.getElementById(id);
    if (el && 'value' in el) patch[col] = el.value;
  }
  const fy = $('#pFy');
  if (fy) patch.fy_start_month = Number(fy.value) || 4;

  const { error } = await supabase.from('org_settings').update(patch).eq('id', true);
  if (error) return fail(error);
  toast('Settings saved');
}

$$('#oName,#oLegal,#oGst,#oPan,#oAddr,#oPhone,#oEmail,#oWeb,#pCur,#pDate,#pUnit,#pWeek,#pTz,#pFy')
  .forEach(el => el?.addEventListener('change', saveOrg));

async function paintTeam(team) {
  const el = $('#teamList');
  if (!el) return;
  const { data: roles } = await supabase.from('user_roles').select('user_id,role');
  const byUser = new Map();
  (roles ?? []).forEach(r => byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r.role]));

  el.innerHTML = team.length ? team.map(p => `<li class="tm" data-id="${p.id}">
    <span class="tm__av">${esc(initials(p.full_name || p.email || '?'))}</span>
    <span class="tm__body"><span class="tm__nm">${esc(p.full_name || 'Unnamed')}</span>
      <span class="tm__meta">${esc(p.email || '')}${p.job_title ? ' · ' + esc(p.job_title) : ''}</span></span>
    <span class="tm__roles">${(byUser.get(p.id) || ['no role']).map(r => `<span class="tag">${esc(r)}</span>`).join('')}</span>
  </li>`).join('')
  : '<li class="tm"><span class="tm__body">No team members yet</span></li>';
}

function paintTheme() {
  const seg = $('#themeSeg');
  if (!seg) return;
  const cur = document.documentElement.getAttribute('data-theme');
  $$('#themeSeg [data-theme-set]').forEach(b =>
    b.classList.toggle('is-on', b.dataset.themeSet === cur));
  seg.addEventListener('click', e => {
    const b = e.target.closest('[data-theme-set]');
    if (!b) return;
    document.documentElement.setAttribute('data-theme', b.dataset.themeSet);
    localStorage.setItem('bindbuild.theme', b.dataset.themeSet);
    paintTheme();
  });
}

async function paintAudit() {
  const el = $('#trail');
  if (!el) return;
  const { data, error } = await supabase.from('audit_trail')
    .select('*').order('created_at', { ascending: false }).limit(20);
  el.innerHTML = error
    ? '<li class="tr">The audit trail is visible to admins only</li>'
    : (data ?? []).length
      ? data.map(a => `<li class="tr"><span class="tr__t">${esc(a.action)}${a.entity ? ' · ' + esc(a.entity) : ''}</span>
          <span class="tr__w">${daysAgo(a.created_at)} ago</span></li>`).join('')
      : '<li class="tr">No activity recorded</li>';
}

/* password change uses Supabase auth, never a table */
$('#sConf')?.closest('form')?.addEventListener('submit', e => e.preventDefault());
document.addEventListener('click', async e => {
  if (!e.target.closest('#savePwd')) return;
  const a = $('#sNew')?.value, b = $('#sConf')?.value;
  if (!a || a.length < 8) return toast('Use at least 8 characters', 'err');
  if (a !== b) return toast('The two passwords do not match', 'err');
  const { error } = await supabase.auth.updateUser({ password: a });
  if (error) return fail(error);
  toast('Password updated');
  if ($('#sNew')) $('#sNew').value = '';
  if ($('#sConf')) $('#sConf').value = '';
});

await load();

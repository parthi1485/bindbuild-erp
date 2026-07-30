import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'hr', title: 'Employee' });
if (!user) throw new Error('redirecting');

const canHr = ['owner','admin','hr'].some(r => user.roles.includes(r));
let empId = new URLSearchParams(location.search).get('id') || user.id;
let EMP = null;

function setByClass(cls, v) { const el = $('.' + cls); if (el) el.textContent = v ?? '—'; }
function setKv(label, v) {
  const row = $$('.kv').find(r => $('.kv__k', r)?.textContent.trim().toLowerCase() === label.toLowerCase());
  if (row) $('.kv__v', row).textContent = v || '—';
}

async function load() {
  const { data, error } = await supabase.from('employees')
    .select('*, profiles(full_name,email,phone,job_title), reporting:reporting_to(full_name)')
    .eq('id', empId).maybeSingle();

  if (error) {
    const plain = await supabase.from('employees')
      .select('*, profiles(full_name,email,phone,job_title)').eq('id', empId).maybeSingle();
    if (plain.error) return fail(plain.error);
    EMP = plain.data;
  } else EMP = data;

  if (!EMP) {
    toast('No employee record. HR can create one from the HR dashboard.', 'err');
    return;
  }

  paint();
  await Promise.all([paintLeave(), paintDocs()]);
}

function paint() {
  const nm = EMP.profiles?.full_name || 'Unnamed';
  setByClass('emp-avatar', initials(nm));
  setByClass('emp-head__name', nm);
  setByClass('emp-head__sub',
    [EMP.designation, EMP.department, EMP.work_location].filter(Boolean).join(' · '));

  setKv('Phone',        EMP.profiles?.phone ? `+91 ${EMP.profiles.phone}` : '—');
  setKv('Email',        EMP.profiles?.email);
  setKv('Department',   EMP.department);
  setKv('Designation',  EMP.designation);
  setKv('Employment',   EMP.employment_type);
  setKv('Joined',       EMP.date_of_joining ? fmtDate(EMP.date_of_joining) : '—');
  setKv('Location',     EMP.work_location);
  setKv('Reports to',   EMP.reporting?.full_name);
  setKv('Blood group',  EMP.blood_group);
  setKv('Emergency',    EMP.emergency_phone ? `${EMP.emergency_name || ''} ${EMP.emergency_phone}`.trim() : '—');

  document.title = `${nm} · Bind Build ERP`;
  const here = $('.crumbs .here');
  if (here) here.textContent = nm;
}

async function paintLeave() {
  const el = $('#lvBal');
  if (!el) return;
  const { data, error } = await supabase.from('leave_balances').select('*').eq('employee_id', empId);
  if (error) return;

  el.innerHTML = (data ?? []).length
    ? data.filter(b => b.annual_quota > 0).map(b => `<li class="lb">
        <span class="lb__nm">${esc(b.name)}</span>
        <span class="lb__bar"><span class="lb__fill" style="width:${b.annual_quota ? Math.round(b.used / b.annual_quota * 100) : 0}%"></span></span>
        <span class="lb__v">${b.available} of ${b.annual_quota}</span>
      </li>`).join('')
    : '<li class="lb">No leave types configured</li>';
}

async function paintDocs() {
  const el = $('#docs');
  if (!el) return;
  const { data } = await supabase.from('employee_documents')
    .select('*').eq('employee_id', empId).order('created_at', { ascending: false });

  el.innerHTML = (data ?? []).length
    ? data.map(d => `<li class="doc" data-path="${esc(d.storage_path)}">
        <span class="doc__nm">${esc(d.file_name)}</span>
        <span class="doc__meta">${esc(d.doc_type)}${d.expires_on ? ' · expires ' + fmtDate(d.expires_on) : ''}</span>
      </li>`).join('')
    : `<li class="doc"><span class="doc__nm">${canHr ? 'No documents uploaded' : 'No documents'}</span></li>`;
}

document.addEventListener('click', async e => {
  const d = e.target.closest('.doc[data-path]');
  if (!d) return;
  const { data, error } = await supabase.storage
    .from('receipts').createSignedUrl(d.dataset.path, 60);
  if (error) return fail(error);
  window.open(data.signedUrl, '_blank');
});

await load();

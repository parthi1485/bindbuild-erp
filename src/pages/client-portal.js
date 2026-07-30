import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';
const $ = (s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user = await mountShell({ route: 'client-portal', title: 'Client portal' });
if (!user) throw new Error('redirecting');

const money = v => '₹' + Math.round(Number(v)||0).toLocaleString('en-IN');
let CLIENT = null, isStaffView = false;

async function load() {
  /* a portal login resolves to exactly one client; staff pick one to preview */
  const { data: link } = await supabase.from('client_users')
    .select('client_id').eq('user_id', user.id).maybeSingle();

  let clientId = link?.client_id || new URLSearchParams(location.search).get('client');
  isStaffView = !link;

  if (!clientId) {
    const { data } = await supabase.from('clients').select('id').limit(1);
    clientId = data?.[0]?.id;
  }
  if (!clientId) {
    const t = $('#tbTitle');
    if (t) t.textContent = 'No client linked to this portal yet';
    return toast('No clients exist yet', 'err');
  }

  const [c, p, i, a, d] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
    supabase.from('projects').select('*').eq('client_id', clientId),
    supabase.from('invoice_balances').select('*').eq('client_id', clientId).order('issue_date',{ascending:false}),
    supabase.from('approvals').select('*').eq('client_id', clientId).order('created_at',{ascending:false}),
    supabase.from('documents').select('*').eq('client_id', clientId).eq('shared_with_client', true)
  ]);

  CLIENT = c.data;
  paint(p.data ?? [], i.data ?? [], a.data ?? [], d.data ?? []);
  await thread(clientId);
}

function paint(projects, invoices, approvals, docs) {
  const t = $('#tbTitle');
  if (t) t.textContent = CLIENT?.name
    ? `${CLIENT.name}${isStaffView ? ' · staff preview' : ''}` : 'Client portal';

  const set=(id,v)=>{const x=document.getElementById(id); if(x)x.textContent=v;};
  const billed = invoices.reduce((a,r)=>a+Number(r.total||0),0);
  const paid   = invoices.reduce((a,r)=>a+Number(r.amount_paid||0),0);
  set('pProjects', String(projects.length));
  set('pBilled', money(billed));
  set('pPaid', money(paid));
  set('pDue', money(billed - paid));

  const pl = $('#projList') || $('#plist');
  if (pl) pl.innerHTML = projects.length
    ? projects.map(p => `<li class="pp">
        <span class="pp__nm">${esc(p.name)}</span>
        <span class="pp__bar"><span style="width:${p.progress_pct}%"></span></span>
        <span class="pp__pct">${p.progress_pct}%</span></li>`).join('')
    : '<li class="pp"><span class="pp__nm">No projects yet</span></li>';

  const il = $('#invList') || $('#invBody');
  if (il) il.innerHTML = invoices.length
    ? invoices.map(v => `<li class="pi">
        <span class="pi__no">${esc(v.invoice_no)}</span>
        <span class="pi__meta">${esc(v.description||'')} · ${fmtDate(v.issue_date)}</span>
        <span class="pi__amt">${money(v.total)}</span>
        <span class="pi__st ${Number(v.balance)<=0?'paid':'due'}">${Number(v.balance)<=0?'Paid':'Due'}</span>
      </li>`).join('')
    : '<li class="pi"><span class="pi__meta">No invoices yet</span></li>';

  const pending = approvals.filter(a => a.status === 'pending');
  const badge = $('#apprBadge');
  if (badge) { badge.textContent = String(pending.length); badge.hidden = !pending.length; }

  const al = $('#apprList') || $('#appr');
  if (al) al.innerHTML = approvals.length
    ? approvals.map(a => `<li class="pa" data-id="${a.id}">
        <span class="pa__body"><span class="pa__nm">${esc(a.title)}</span>
        <span class="pa__meta">${esc(a.detail||'')} · ${fmtDate(a.created_at)}</span></span>
        ${a.status === 'pending'
          ? `<span class="pa__acts"><button class="pa__ok" data-decide="${a.id}:approved">Approve</button>
             <button class="pa__no" data-decide="${a.id}:changes_requested">Request changes</button></span>`
          : `<span class="pa__st">${a.status.replace('_',' ')}</span>`}
      </li>`).join('')
    : '<li class="pa"><span class="pa__body">Nothing awaiting your approval</span></li>';

  const dl = $('#docList') || $('#docs');
  if (dl) dl.innerHTML = docs.length
    ? docs.map(d => `<li class="pd" data-path="${esc(d.storage_path)}">
        <span class="pd__nm">${esc(d.name)}</span>
        <span class="pd__meta">${fmtDate(d.created_at)}</span></li>`).join('')
    : '<li class="pd"><span class="pd__nm">No documents shared yet</span></li>';
}

async function thread(clientId) {
  const el = $('#thread');
  if (!el) return;
  const { data, error } = await supabase.from('portal_messages')
    .select('*').eq('client_id', clientId).order('created_at');
  if (error) return fail(error);

  el.innerHTML = (data ?? []).length
    ? data.map(m => `<li class="msg ${m.from_studio ? 'msg--studio' : 'msg--client'}">
        <span class="msg__b">${esc(m.body)}</span>
        <span class="msg__t">${fmtDate(m.created_at)}</span></li>`).join('')
    : '<li class="msg msg--studio"><span class="msg__b">No messages yet.</span></li>';
  el.scrollTop = el.scrollHeight;
  el.dataset.client = clientId;
}

$('#msgSend')?.addEventListener('click', async () => {
  const box = $('#msgInput');
  const body = (box?.value || '').trim();
  if (!body) return;
  const clientId = $('#thread')?.dataset.client;
  if (!clientId) return;

  const { error } = await supabase.from('portal_messages').insert({
    client_id: clientId, sender_id: user.id, from_studio: isStaffView, body
  });
  if (error) return fail(error);
  box.value = '';
  await thread(clientId);
});

document.addEventListener('click', async e => {
  const d = e.target.closest('[data-decide]');
  if (d) {
    const [id, status] = d.dataset.decide.split(':');
    const comment = status === 'changes_requested' ? (prompt('What needs changing?') || '') : '';
    const { error } = await supabase.from('approvals').update({
      status, decided_by: user.id, decided_at: new Date().toISOString(), comment
    }).eq('id', id);
    if (error) return fail(error);
    toast('Response recorded');
    return load();
  }

  const doc = e.target.closest('.pd[data-path]');
  if (doc) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.dataset.path, 60);
    if (error) return fail(error);
    window.open(data.signedUrl, '_blank');
  }
});

await load();

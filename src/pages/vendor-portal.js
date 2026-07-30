import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';
const $ = (s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user = await mountShell({ route: 'vendor-portal', title: 'Vendor portal' });
if (!user) throw new Error('redirecting');

const money = v => '₹' + Math.round(Number(v)||0).toLocaleString('en-IN');
const ST = { quoted:'Quoted', approved:'Approved', ordered:'Ordered',
             partly_delivered:'Part delivered', delivered:'Delivered', cancelled:'Cancelled' };
let VENDOR = null, isStaffView = false;

async function load() {
  const { data: link } = await supabase.from('vendor_users')
    .select('vendor_id').eq('user_id', user.id).maybeSingle();

  let vendorId = link?.vendor_id || new URLSearchParams(location.search).get('vendor');
  isStaffView = !link;

  if (!vendorId) {
    const { data } = await supabase.from('vendors').select('id').limit(1);
    vendorId = data?.[0]?.id;
  }
  if (!vendorId) {
    const t = $('#tbTitle'); if (t) t.textContent = 'No vendors yet';
    return toast('No vendors exist yet', 'err');
  }

  const [v, po] = await Promise.all([
    supabase.from('vendors').select('*').eq('id', vendorId).maybeSingle(),
    supabase.from('purchase_orders')
      .select('*, projects(code,name), po_items(description,qty,unit,received_qty)')
      .eq('vendor_id', vendorId).order('created_at', { ascending: false })
  ]);

  VENDOR = v.data;
  paint(po.data ?? []);
  await thread(vendorId);
}

function paint(pos) {
  const t = $('#tbTitle');
  if (t) t.textContent = VENDOR?.name ? `${VENDOR.name}${isStaffView ? ' · staff preview' : ''}` : 'Vendor portal';

  const open = pos.filter(p => !['delivered','cancelled'].includes(p.status));
  const badge = $('#poBadge');
  if (badge) { badge.textContent = String(open.length); badge.hidden = !open.length; }

  const body = $('#poBody');
  if (body) body.innerHTML = pos.length
    ? pos.map(p => `<tr data-id="${p.id}">
        <td>${esc(p.po_no)}</td>
        <td>${esc(p.po_items?.[0]?.description || '—')}${(p.po_items?.length||0) > 1 ? ` +${p.po_items.length-1}` : ''}</td>
        <td>${esc(p.projects?.code || '—')}</td>
        <td class="num">${money(p.total)}</td>
        <td><span class="pill ${p.status}">${ST[p.status]}</span></td>
        <td>${p.expected_date ? fmtDate(p.expected_date) : '—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="tbl__empty">No purchase orders</td></tr>';

  const del = $('#delBody');
  if (del) {
    const rows = pos.filter(p => ['ordered','partly_delivered'].includes(p.status));
    del.innerHTML = rows.length
      ? rows.map(p => `<tr><td>${esc(p.po_no)}</td>
          <td>${esc(p.projects?.name || '—')}</td>
          <td>${p.expected_date ? fmtDate(p.expected_date) : '—'}</td>
          <td><span class="pill ${p.status}">${ST[p.status]}</span></td></tr>`).join('')
      : '<tr><td colspan="4" class="tbl__empty">Nothing scheduled for delivery</td></tr>';
  }

  const inv = $('#invBody');
  if (inv) inv.innerHTML = '<tr><td colspan="4" class="tbl__empty">Vendor invoicing is not enabled yet</td></tr>';

  const act = $('#ovAct');
  if (act) act.innerHTML = pos.slice(0,8).map(p =>
    `<li class="va"><span class="va__t">${esc(p.po_no)} · ${ST[p.status]}</span>
     <span class="va__w">${fmtDate(p.created_at)}</span></li>`).join('')
    || '<li class="va"><span class="va__t">No activity</span></li>';

  const dl = $('#docList');
  if (dl) dl.innerHTML = '<li class="pd"><span class="pd__nm">No documents shared</span></li>';
}

async function thread(vendorId) {
  const el = $('#supMsg') ? $('#thread') || $('#supThread') : null;
  const box = el || $('#thread');
  if (!box) return;
  const { data } = await supabase.from('portal_messages')
    .select('*').eq('vendor_id', vendorId).order('created_at');
  box.innerHTML = (data ?? []).length
    ? data.map(m => `<li class="msg ${m.from_studio ? 'msg--studio' : 'msg--vendor'}">
        <span class="msg__b">${esc(m.body)}</span>
        <span class="msg__t">${fmtDate(m.created_at)}</span></li>`).join('')
    : '<li class="msg msg--studio"><span class="msg__b">No messages yet.</span></li>';
  box.dataset.vendor = vendorId;
}

$('#supSend')?.addEventListener('click', async () => {
  const input = $('#supMsg');
  const body = (input?.value || '').trim();
  if (!body) return;
  const box = $('#thread') || $('#supThread');
  const vendorId = box?.dataset.vendor;
  if (!vendorId) return;
  const { error } = await supabase.from('portal_messages').insert({
    vendor_id: vendorId, sender_id: user.id, from_studio: isStaffView, body
  });
  if (error) return fail(error);
  input.value = '';
  await thread(vendorId);
});

await load();

import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, initials } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'clients', title: 'Client profile' });
if (!user) throw new Error('redirecting');

const clientId = new URLSearchParams(location.search).get('id');

/* amounts here are real rupees, not lakhs */
const money = v => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e7) return '₹' + (n / 1e7).toFixed(2).replace(/\.00$/, '') + ' Cr';
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(1).replace(/\.0$/, '') + ' L';
  return '₹' + n.toLocaleString('en-IN');
};

let CLIENT = null;

function setKv(label, value) {
  const row = $$('.kv').find(r => $('.kv__k', r)?.textContent.trim().toLowerCase() === label.toLowerCase());
  if (row) $('.kv__v', row).textContent = value || '—';
}

/* ---------------------------------------------------------------
   load
--------------------------------------------------------------- */
async function load() {
  if (!clientId) return firstClientOrEmpty();

  const { data, error } = await supabase
    .from('clients').select('*').eq('id', clientId).maybeSingle();

  if (error) return fail(error);
  if (!data)  return emptyState('That client no longer exists.');

  CLIENT = data;
  paintHeader();
  await Promise.all([paintInvoices(), paintActivity()]);
}

/** No id in the URL — send them to the first client, or explain the emptiness. */
async function firstClientOrEmpty() {
  const { data } = await supabase.from('clients').select('id').limit(1);
  if (data?.length) return location.replace(`/client.html?id=${data[0].id}`);
  emptyState('No clients yet. Convert a won lead from the CRM board to create one.');
}

function emptyState(msg) {
  const nm = $('.client-head__name') || $('h1');
  if (nm) nm.textContent = 'No client selected';
  const sub = $('.client-head__sub');
  if (sub) sub.textContent = msg;
  const body = $('#invBody');
  if (body) body.innerHTML = `<tr><td colspan="5" class="t-empty">${esc(msg)}</td></tr>`;
  const tl = $('#actTl');
  if (tl) tl.innerHTML = '';
  ['stTotal','stPaid','stDue','stPct','paySumPct','nPay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = id === 'nPay' ? '0' : '—';
  });
}

function paintHeader() {
  const av = $('.client-avatar');
  if (av) av.textContent = initials(CLIENT.name);

  const nm = $('.client-head__name') || $('h1');
  if (nm) nm.textContent = CLIENT.name;

  const sub = $('.client-head__sub');
  if (sub) {
    sub.textContent = [
      CLIENT.type === 'company' ? 'Company' : 'Individual',
      CLIENT.city, `Client since ${fmtDate(CLIENT.client_since)}`
    ].filter(Boolean).join(' · ');
  }

  setKv('Phone',   CLIENT.phone ? `+91 ${CLIENT.phone}` : '—');
  setKv('Email',   CLIENT.email);
  setKv('Address', [CLIENT.address_line, CLIENT.city, CLIENT.pincode].filter(Boolean).join(', '));
  setKv('Contact', CLIENT.primary_contact);
  setKv('PAN',     CLIENT.pan);
  setKv('GSTIN',   CLIENT.gstin);
  setKv('State',   CLIENT.state ? `${CLIENT.state} (${CLIENT.state_code})` : '—');

  const gst = $('#gstVal');
  if (gst) gst.textContent = CLIENT.gstin || 'Not registered';

  document.title = `${CLIENT.name} · Bind Build ERP`;
  const here = $('.crumbs .here');
  if (here) here.textContent = CLIENT.name;
}

/* ---------------------------------------------------------------
   invoices + payment summary
--------------------------------------------------------------- */
async function paintInvoices() {
  const { data, error } = await supabase
    .from('invoice_balances')
    .select('*')
    .eq('client_id', clientId)
    .order('issue_date', { ascending: false });

  if (error) return fail(error);

  const rows = data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const body = $('#invBody');
  if (body) {
    body.innerHTML = rows.length ? rows.map(inv => {
      const settled  = Number(inv.balance) <= 0;
      const overdue  = !settled && inv.due_date && inv.due_date < today;
      const pill = settled
        ? '<span class="pill pill--paid"><span class="dot"></span>Paid</span>'
        : overdue
        ? '<span class="pill pill--over"><span class="dot"></span>Overdue</span>'
        : '<span class="pill pill--due"><span class="dot"></span>Due</span>';

      const when = settled
        ? `Paid ${fmtDate(inv.last_paid_on)}${inv.last_method ? ' · ' + inv.last_method.toUpperCase() : ''}`
        : `Due ${fmtDate(inv.due_date)}`;

      const act = settled ? '' :
        `<button class="t-act" data-remind="${esc(inv.invoice_no)}">Remind</button>
         <button class="t-act" data-pay="${inv.id}" data-bal="${inv.balance}">Record payment</button>`;

      return `<tr>
        <td class="t-no">${esc(inv.invoice_no)}</td>
        <td><div class="t-label">${esc(inv.description || '—')}</div>
            <div class="t-sub">${esc(inv.project_name || '')}${inv.project_name ? ' · ' : ''}${esc(when)}</div></td>
        <td class="t-money">${money(inv.total)}</td>
        <td>${pill}</td>
        <td style="text-align:right">${act}</td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="5" class="t-empty">No invoices raised for this client yet.</td></tr>`;
  }

  /* summary */
  const total = rows.reduce((a, r) => a + Number(r.total || 0), 0);
  const paid  = rows.reduce((a, r) => a + Number(r.amount_paid || 0), 0);
  const due   = total - paid;
  const pct   = total ? Math.round((paid / total) * 100) : 0;
  const overdueCount = rows.filter(r =>
    Number(r.balance) > 0 && r.due_date && r.due_date < today).length;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('stTotal', money(total));
  set('stPaid',  money(paid));
  set('stDue',   money(due));
  set('stPct',   pct + '%');
  set('paySumPct', pct + '%');
  set('nPay', String(rows.length));
  set('stDueNote', overdueCount
    ? `${overdueCount} invoice${overdueCount > 1 ? 's' : ''} past due date`
    : due > 0 ? 'Nothing overdue' : 'Fully settled');

  const meter = $('#payMeter');
  if (meter) {
    meter.style.width = pct + '%';
    meter.setAttribute('aria-valuenow', String(pct));
  }
}

/* ---------------------------------------------------------------
   activity
--------------------------------------------------------------- */
async function paintActivity() {
  const el = $('#actTl');
  if (!el) return;

  const { data, error } = await supabase
    .from('activities')
    .select('kind,detail,created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return fail(error);

  el.innerHTML = data.length
    ? data.map(a => `
        <li class="act act--${esc(a.kind)}">
          <span class="act__txt">${esc(a.detail || a.kind)}</span>
          <span class="act__time">${fmtDate(a.created_at)}</span>
        </li>`).join('')
    : `<li class="act"><span class="act__txt">No activity recorded for this client.</span></li>`;
}

/* ---------------------------------------------------------------
   actions
--------------------------------------------------------------- */
document.addEventListener('click', async e => {
  const remind = e.target.closest('[data-remind]');
  if (remind) {
    await supabase.from('activities').insert({
      client_id: clientId, user_id: user.id, kind: 'email',
      detail: `Payment reminder sent for ${remind.dataset.remind}`
    });
    toast(`Reminder logged for ${remind.dataset.remind}`);
    return paintActivity();
  }

  const pay = e.target.closest('[data-pay]');
  if (pay) {
    const bal = Number(pay.dataset.bal);
    const amt = prompt(`Amount received? (balance ${money(bal)})`, String(bal));
    if (amt === null) return;
    const value = Number(amt);
    if (!Number.isFinite(value) || value <= 0) return toast('Enter a valid amount', 'err');

    const method = (prompt('Method? neft / upi / cheque / cash / card', 'neft') || 'neft').toLowerCase();

    const { error } = await supabase.from('invoice_payments').insert({
      invoice_id: pay.dataset.pay, amount: value,
      method: ['neft','rtgs','imps','upi','cheque','cash','card'].includes(method) ? method : 'other',
      recorded_by: user.id
    });
    if (error) return fail(error);

    /* flip status when the invoice is fully settled */
    const newBal = bal - value;
    await supabase.from('invoices')
      .update({ status: newBal <= 0 ? 'paid' : 'partly_paid' })
      .eq('id', pay.dataset.pay);

    toast(`${money(value)} recorded`);
    await Promise.all([paintInvoices(), paintActivity()]);
  }
});

$('#copyGst')?.addEventListener('click', async () => {
  if (!CLIENT?.gstin) return toast('No GSTIN saved for this client', 'err');
  try {
    await navigator.clipboard.writeText(CLIENT.gstin);
    toast('GSTIN copied');
  } catch { toast('Could not access the clipboard', 'err'); }
});

$('#newInvBtn')?.addEventListener('click', () =>
  toast('Invoice builder arrives with the Finance module', 'err'));

$('#recPayBtn')?.addEventListener('click', () =>
  toast('Use "Record payment" on the invoice row', 'err'));

$('#resetPortal')?.addEventListener('click', () =>
  toast('Client portal access is set up in the Portals module', 'err'));

await load();

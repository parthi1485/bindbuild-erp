import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'finance', title: 'Invoice' });
if (!user) throw new Error('redirecting');

const inr = v => '₹' + Math.round(Number(v) || 0).toLocaleString('en-IN');
let INV = null, ITEMS = [], PAYS = [], BAL = null;

const invoiceId = new URLSearchParams(location.search).get('id');

async function load() {
  if (!invoiceId) {
    const { data } = await supabase.from('invoices')
      .select('id').order('created_at', { ascending: false }).limit(1);
    if (!data?.length) return bail('No invoices raised yet. Create one from a client profile.');
    return location.replace(`/invoice.html?id=${data[0].id}`);
  }

  const [iRes, itRes, pRes, bRes] = await Promise.all([
    supabase.from('invoices').select('*, clients(name,gstin,address_line,city,state,state_code), projects(code,name)').eq('id', invoiceId).maybeSingle(),
    supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order'),
    supabase.from('invoice_payments').select('*').eq('invoice_id', invoiceId).order('paid_on', { ascending: false }),
    supabase.from('invoice_balances').select('*').eq('id', invoiceId).maybeSingle()
  ]);

  if (iRes.error) return fail(iRes.error);
  if (!iRes.data)  return bail('That invoice no longer exists.');

  INV = iRes.data; ITEMS = itRes.data ?? []; PAYS = pRes.data ?? []; BAL = bRes.data;
  paint();
}

function bail(msg) { toast(msg, 'err'); }

function paint() {
  const setTxt = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };

  /* header / party blocks are class-based in the prototype */
  setTxt('.inv-no', INV.invoice_no);
  setTxt('.inv-date', fmtDate(INV.issue_date));
  setTxt('.inv-due', INV.due_date ? fmtDate(INV.due_date) : '—');
  setTxt('.party__name', INV.clients?.name || '—');
  setTxt('.party__gst', INV.clients?.gstin || 'Unregistered');
  setTxt('.party__addr', [INV.clients?.address_line, INV.clients?.city].filter(Boolean).join(', '));
  setTxt('.inv-project', INV.projects ? `${INV.projects.code} · ${INV.projects.name}` : (INV.project_name || '—'));

  const pill = $('#statPill');
  const balance = Number(BAL?.balance ?? INV.total);
  const settled = balance <= 0;
  const overdue = !settled && INV.due_date && INV.due_date < new Date().toISOString().slice(0, 10);
  if (pill) {
    pill.textContent = settled ? 'Paid' : overdue ? 'Overdue' : 'Due';
    pill.dataset.status = settled ? 'paid' : overdue ? 'over' : 'due';
  }

  /* line items */
  const body = $('.items tbody') || $('#itemsBody');
  if (body) {
    body.innerHTML = ITEMS.length
      ? ITEMS.map((it, i) => `<tr>
          <td class="num">${i + 1}</td>
          <td><div class="it-desc">${esc(it.description)}</div>${it.hsn_sac ? `<div class="it-hsn">HSN/SAC ${esc(it.hsn_sac)}</div>` : ''}</td>
          <td class="num">${it.qty}</td>
          <td>${esc(it.unit || '')}</td>
          <td class="num">${inr(it.rate)}</td>
          <td class="num">${inr(it.amount)}</td>
        </tr>`).join('')
      : `<tr><td colspan="6" class="t-empty">No line items on this invoice</td></tr>`;
  }

  /* totals — GST split follows place of supply */
  const totals = [
    ['Subtotal', inr(INV.subtotal)],
    ...(Number(INV.discount) ? [['Discount', '− ' + inr(INV.discount)]] : []),
    ['Taxable value', inr(INV.taxable_value)],
    ...(INV.is_interstate
      ? [[`IGST @ ${INV.igst_rate}%`, inr(INV.igst_amount)]]
      : [[`CGST @ ${INV.cgst_rate}%`, inr(INV.cgst_amount)],
         [`SGST @ ${INV.sgst_rate}%`, inr(INV.sgst_amount)]]),
    ['Total', inr(INV.total)]
  ];
  const tw = $('.totals');
  if (tw) {
    tw.innerHTML = totals.map(([k, v], i) => `
      <div class="tr${i === totals.length - 1 ? ' tr--grand' : ''}">
        <span>${esc(k)}</span><span>${esc(v)}</span>
      </div>`).join('');
  }

  const paid = Number(BAL?.amount_paid ?? 0);
  const setId = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const credited = Number(BAL?.credited ?? 0);
  setId('dueAmt', inr(balance));
  if (credited > 0) {
    const el = document.getElementById('dueMeta');
    if (el) el.insertAdjacentHTML('afterend',
      `<p class="inv-credited">Less credit notes: ${inr(credited)}</p>`);
  }
  setId('dueMeta', settled
    ? `Settled${BAL?.last_paid_on ? ' on ' + fmtDate(BAL.last_paid_on) : ''}`
    : `${inr(paid)} received of ${inr(INV.total)}`);

  ['#payBtn', '#payBtn2'].forEach(s => { const b = $(s); if (b) b.disabled = settled; });

  /* timeline */
  const tl = $('#tl');
  if (tl) {
    const events = [
      { t: INV.created_at, txt: `Invoice ${INV.invoice_no} raised` },
      ...PAYS.map(p => ({ t: p.paid_on, txt: `${inr(p.amount)} received via ${(p.method || '').toUpperCase()}${p.reference ? ' · ' + p.reference : ''}` }))
    ].sort((a, b) => String(b.t).localeCompare(String(a.t)));

    tl.innerHTML = events.map(e => `<li class="tlr">
      <span class="tlr__txt">${esc(e.txt)}</span>
      <span class="tlr__time">${fmtDate(e.t)}</span>
    </li>`).join('');
  }

  mountCreditAction();
  document.title = `${INV.invoice_no} · Bind Build ERP`;
  const here = $('.crumbs .here');
  if (here) here.textContent = INV.invoice_no;
}

/* ---------------- payment modal ---------------- */
function openPay() {
  const balance = Number(BAL?.balance ?? INV.total);
  const m = $('#payModal');
  if (!m) return;
  const amt = $('#pmAmt'), date = $('#pmDate');
  if (amt)  amt.value = balance;
  if (date) date.value = new Date().toISOString().slice(0, 10);
  const t = $('#pmTitle');
  if (t) t.textContent = `Record payment · ${INV.invoice_no}`;
  m.classList.add('is-open');
  amt?.focus();
}
const closePay = () => $('#payModal')?.classList.remove('is-open');

$('#payBtn')?.addEventListener('click', openPay);
$('#payBtn2')?.addEventListener('click', openPay);
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closePay(); });

$('#pmConfirm')?.addEventListener('click', async () => {
  const amount = Number($('#pmAmt')?.value);
  if (!Number.isFinite(amount) || amount <= 0) return toast('Enter a valid amount', 'err');

  const balance = Number(BAL?.balance ?? INV.total);
  if (amount > balance && !confirm(`That is more than the ${inr(balance)} outstanding. Record anyway?`)) return;

  const method = ($('#pmMethod')?.value || 'neft').toLowerCase();
  const { error } = await supabase.from('invoice_payments').insert({
    invoice_id: INV.id,
    amount,
    paid_on: $('#pmDate')?.value || new Date().toISOString().slice(0, 10),
    method: ['neft','rtgs','imps','upi','cheque','cash','card'].includes(method) ? method : 'other',
    reference: $('#pmRef')?.value || '',
    recorded_by: user.id
  });
  if (error) return fail(error);

  await supabase.from('invoices')
    .update({ status: amount >= balance ? 'paid' : 'partly_paid' })
    .eq('id', INV.id);

  closePay();
  toast(`${inr(amount)} recorded`);
  await load();
});

/* ---------------------------------------------------------------
   credit note — the only sanctioned way to correct an issued invoice
--------------------------------------------------------------- */
const REASONS = {
  sales_return:'Sales return', deficiency:'Deficiency in service',
  price_revision:'Price revision', post_sale_discount:'Post-sale discount',
  cancellation:'Cancellation', other:'Other'
};

function mountCreditAction() {
  if (!INV || INV.status === 'draft') return;
  if (document.getElementById('creditBtn')) return;

  const host = $('#payBtn')?.parentElement || $('.inv-acts') || $('.actions');
  if (!host) return;

  host.insertAdjacentHTML('beforeend',
    `<button class="btn" id="creditBtn" title="An issued invoice cannot be edited">Raise credit note</button>`);
}

document.addEventListener('click', async e => {
  if (!e.target.closest('#creditBtn')) return;

  const outstanding = Number(INV.total) - Number(BAL?.credited ?? 0);
  const raw = prompt(
    `Credit amount before GST?\n\nInvoice ${INV.invoice_no} is ${inr(INV.total)}.` +
    `\nAlready credited: ${inr(BAL?.credited ?? 0)}`,
    String(Math.max(Math.round(Number(INV.taxable_value) - Number(BAL?.credited ?? 0)), 0)));
  if (raw === null) return;

  const subtotal = Number(raw);
  if (!Number.isFinite(subtotal) || subtotal <= 0) return toast('Enter a valid amount', 'err');

  const reasonKey = (prompt(
    'Reason?\n' + Object.entries(REASONS).map(([k,v]) => `${k} — ${v}`).join('\n'),
    'price_revision') || 'other').trim();
  const reason = REASONS[reasonKey] ? reasonKey : 'other';

  /* credit notes carry their own number series, by financial year */
  const now = new Date();
  const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const prefix = `CN-${fy}-`;
  const { data: last } = await supabase.from('credit_notes')
    .select('credit_no').like('credit_no', prefix + '%')
    .order('credit_no', { ascending: false }).limit(1);
  const seq = last?.length
    ? (parseInt(String(last[0].credit_no).slice(prefix.length), 10) || 0) + 1 : 1;

  const { data, error } = await supabase.from('credit_notes').insert({
    credit_no: prefix + String(seq).padStart(3, '0'),
    invoice_id: INV.id,
    client_id: INV.client_id,
    reason,
    narration: `Against invoice ${INV.invoice_no}`,
    is_interstate: INV.is_interstate,
    cgst_rate: INV.cgst_rate, sgst_rate: INV.sgst_rate, igst_rate: INV.igst_rate,
    subtotal,
    created_by: user.id
  }).select('credit_no,total').single();

  if (error) {
    /* the database refuses to credit more than was invoiced */
    return toast(error.message.includes('exceeds the invoice value')
      ? 'That would credit more than the invoice is worth'
      : error.message, 'err');
  }

  toast(`${data.credit_no} raised for ${inr(data.total)}`);
  await load();
});

$('#printBtn')?.addEventListener('click', () => window.print());

await load();

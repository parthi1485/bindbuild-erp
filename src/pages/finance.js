import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'finance', title: 'Finance' });
if (!user) throw new Error('redirecting');

const money = v => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e7) return '₹' + (n / 1e7).toFixed(2).replace(/\.00$/, '') + ' Cr';
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(2).replace(/\.00$/, '') + ' L';
  return '₹' + Math.round(n).toLocaleString('en-IN');
};

const cssVar = c => c.startsWith('var(')
  ? getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim() || '#5a8dee'
  : c;

const CAT_LABEL = {
  materials: 'Materials', labour: 'Labour', subcontractor: 'Subcontractors',
  site: 'Site expenses', equipment: 'Equipment', overheads: 'Overheads',
  statutory: 'Statutory', other: 'Other'
};
const CAT_COLOR = {
  materials: 'var(--accent)', labour: 'var(--violet)', subcontractor: '#38bdf8',
  site: 'var(--warning)', equipment: '#f59e0b', overheads: 'var(--success)',
  statutory: 'var(--danger)', other: 'var(--text-3)'
};

let months = 6;
let FIN = [], AGE = [], EXPENSES = [], PAYMENTS = [];

async function load() {
  const from = new Date();
  from.setMonth(from.getMonth() - (months - 1));
  from.setDate(1);
  const fromISO = from.toISOString().slice(0, 10);

  const [fRes, aRes, eRes, pRes] = await Promise.all([
    supabase.from('project_financials').select('*'),
    supabase.from('receivables_ageing').select('*'),
    supabase.from('expenses').select('*').gte('expense_date', fromISO),
    supabase.from('invoice_payments').select('amount,paid_on,method').gte('paid_on', fromISO)
  ]);

  if (fRes.error) return fail(fRes.error);
  FIN      = fRes.data ?? [];
  AGE      = aRes.data ?? [];
  EXPENSES = eRes.data ?? [];
  PAYMENTS = pRes.data ?? [];

  paintKpis();
  paintExpenseSplit();
  paintRevenueCost();
  paintAgeing();
  paintProjects();
  await paintTransactions();
}

function paintKpis() {
  const billed   = FIN.reduce((a, r) => a + Number(r.billed || 0), 0);
  const received = FIN.reduce((a, r) => a + Number(r.received || 0), 0);
  const cost     = FIN.reduce((a, r) => a + Number(r.cost || 0), 0);
  const recv     = AGE.reduce((a, r) => a + Number(r.balance || 0), 0);
  const gm       = billed ? ((billed - cost) / billed * 100) : null;

  /* cash in minus cash out over the window. This is net movement, NOT a bank
     balance — there is no bank account table, so calling it "balance" would
     be a lie. */
  const cashIn  = PAYMENTS.reduce((a, p) => a + Number(p.amount || 0), 0);
  const cashOut = EXPENSES.filter(e => e.status === 'paid')
                          .reduce((a, e) => a + Number(e.amount || 0), 0);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('kInv',  money(billed));
  set('kColl', money(received));
  set('kRecv', money(recv));
  set('kCost', money(cost));
  set('kGm',   gm === null ? '—' : gm.toFixed(1) + '%');
  set('kCash', money(cashIn - cashOut));

  const sub = $('#rcSub');
  if (sub) sub.textContent = `Last ${months} months · net cash movement, not a bank balance`;

  const marg = $('#rcMargin');
  if (marg) marg.textContent = gm === null ? '—' : gm.toFixed(1) + '%';
}

function paintExpenseSplit() {
  const byCat = new Map();
  EXPENSES.filter(e => e.status === 'paid').forEach(e => {
    byCat.set(e.category, (byCat.get(e.category) || 0) + Number(e.amount || 0));
  });
  const rows = [...byCat].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, r) => a + r[1], 0);

  const canvas = $('#expChart');
  if (canvas && window.Chart) {
    if (!rows.length) {
      canvas.replaceWith(Object.assign(document.createElement('p'),
        { className: 't-empty', textContent: 'No paid expenses in this period.' }));
    } else {
      new window.Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: rows.map(r => CAT_LABEL[r[0]] || r[0]),
          datasets: [{ data: rows.map(r => r[1]), borderWidth: 0,
                       backgroundColor: rows.map(r => cssVar(CAT_COLOR[r[0]] || 'var(--text-3)')) }]
        },
        options: { cutout: '66%', plugins: { legend: { display: false } }, maintainAspectRatio: false }
      });
    }
  }

  const lg = $('#expLegend');
  if (lg) {
    lg.innerHTML = rows.length
      ? rows.map(([cat, amt]) => `<li class="lg">
          <span class="lg__dot" style="background:${cssVar(CAT_COLOR[cat] || 'var(--text-3)')}"></span>
          <span class="lg__nm">${esc(CAT_LABEL[cat] || cat)}</span>
          <span class="lg__v">${money(amt)}</span>
          <span class="lg__p">${total ? Math.round(amt / total * 100) : 0}%</span>
        </li>`).join('')
      : '<li class="lg">Nothing recorded yet</li>';
  }
}

function paintRevenueCost() {
  const canvas = $('#rcChart');
  if (!canvas || !window.Chart) return;

  const labels = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    labels.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en-IN', { month: 'short' }) });
  }

  const rev  = labels.map(m => PAYMENTS.filter(p => (p.paid_on || '').startsWith(m.key))
                                       .reduce((a, p) => a + Number(p.amount || 0), 0));
  const cost = labels.map(m => EXPENSES.filter(e => e.status === 'paid' && (e.expense_date || '').startsWith(m.key))
                                       .reduce((a, e) => a + Number(e.amount || 0), 0));

  new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels.map(m => m.label),
      datasets: [
        { label: 'Collected', data: rev,  backgroundColor: cssVar('var(--accent)'), borderRadius: 5 },
        { label: 'Cost',      data: cost, backgroundColor: cssVar('var(--danger)'), borderRadius: 5 }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } },
                y: { beginAtZero: true, ticks: { callback: v => money(v) } } },
      maintainAspectRatio: false
    }
  });

  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('lgRev',  money(rev.reduce((a, b) => a + b, 0)));
  setTxt('lgCost', money(cost.reduce((a, b) => a + b, 0)));
}

function paintAgeing() {
  const el = $('#aging');
  if (!el) return;

  const BUCKETS = ['current', '1-30', '31-60', '61-90', '90+', 'no due date'];
  const rows = BUCKETS.map(b => ({
    name: b === 'current' ? 'Not yet due' : b === 'no due date' ? 'No due date' : b + ' days',
    value: AGE.filter(a => a.bucket === b).reduce((s, a) => s + Number(a.balance || 0), 0),
    n: AGE.filter(a => a.bucket === b).length,
    risk: ['61-90', '90+'].includes(b)
  })).filter(r => r.n);

  const top = Math.max(...rows.map(r => r.value), 1);

  el.innerHTML = rows.length
    ? rows.map(r => `<div class="age">
        <span class="age__nm">${esc(r.name)}</span>
        <span class="age__bar"><span class="age__fill${r.risk ? ' risk' : ''}" style="width:${Math.round(r.value / top * 100)}%"></span></span>
        <span class="age__n">${r.n}</span>
        <span class="age__v">${money(r.value)}</span>
      </div>`).join('')
    : '<div class="t-empty">Nothing outstanding</div>';
}

function paintProjects() {
  const el = $('#projList');
  if (!el) return;

  const rows = FIN.filter(r => Number(r.billed) > 0 || Number(r.cost) > 0)
                  .sort((a, b) => Number(b.billed) - Number(a.billed));

  el.innerHTML = rows.length
    ? rows.map(r => {
        const gm = r.gross_margin_pct;
        const cls = gm === null ? '' : gm < 10 ? 'bad' : gm < 20 ? 'warn' : 'ok';
        return `<li class="pf" data-id="${r.project_id}">
          <span class="pf__nm">${esc(r.code)} · ${esc(r.name)}</span>
          <span class="pf__billed">${money(r.billed)}</span>
          <span class="pf__cost">${money(r.cost)}</span>
          <span class="pf__gm ${cls}">${gm === null ? '—' : gm + '%'}</span>
        </li>`;
      }).join('')
    : '<li class="t-empty">No project has been billed or costed yet</li>';
}

async function paintTransactions() {
  const el = $('#tx');
  if (!el) return;

  const [{ data: pays }, { data: exps }] = await Promise.all([
    supabase.from('invoice_payments')
      .select('amount,paid_on,method,reference,invoices(invoice_no)')
      .order('paid_on', { ascending: false }).limit(10),
    supabase.from('expenses')
      .select('title,amount,expense_date,payment_mode,status')
      .eq('status', 'paid')
      .order('expense_date', { ascending: false }).limit(10)
  ]);

  const rows = [
    ...(pays ?? []).map(p => ({
      dir: 'in', when: p.paid_on, amount: p.amount,
      title: `Payment received${p.invoices?.invoice_no ? ' · ' + p.invoices.invoice_no : ''}`,
      meta: (p.method || '').toUpperCase() + (p.reference ? ' · ' + p.reference : '')
    })),
    ...(exps ?? []).map(e => ({
      dir: 'out', when: e.expense_date, amount: e.amount,
      title: e.title, meta: (e.payment_mode || '').toUpperCase()
    }))
  ].sort((a, b) => String(b.when).localeCompare(String(a.when))).slice(0, 12);

  el.innerHTML = rows.length
    ? rows.map(r => `<li class="txr tx--${r.dir}">
        <span class="txr__nm">${esc(r.title)}</span>
        <span class="txr__meta">${esc(r.meta)} · ${fmtDate(r.when)}</span>
        <span class="txr__amt">${r.dir === 'in' ? '+' : '−'}${money(r.amount)}</span>
      </li>`).join('')
    : '<li class="t-empty">No transactions yet</li>';
}

/* period switcher */
$('#periodSeg')?.addEventListener('click', e => {
  const b = e.target.closest('[data-months]');
  if (!b) return;
  months = Number(b.dataset.months) || 6;
  $$('#periodSeg [data-months]').forEach(x => x.classList.toggle('is-on', x === b));
  load();
});

document.addEventListener('click', e => {
  const pf = e.target.closest('.pf[data-id]');
  if (pf) location.href = `/project.html?id=${pf.dataset.id}`;
});

await load();

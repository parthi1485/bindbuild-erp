import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'hr', title: 'Payroll' });
if (!user) throw new Error('redirecting');

const canRun = ['owner','admin','hr','accounts'].some(r => user.roles.includes(r));

const money = v => '₹' + Math.round(Number(v) || 0).toLocaleString('en-IN');
const moneyS = v => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(2).replace(/\.00$/, '') + 'L';
  return money(n);
};

/* current month, first day */
let period = (() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); })();
let RUN = null, SLIPS = [], DEPTS = [];
let fDept = '', q = '';

const ST_LABEL = { draft:'Draft', processing:'Processing', approved:'Approved', paid:'Paid', cancelled:'Cancelled' };

async function load() {
  const { data: run, error } = await supabase.from('payroll_runs')
    .select('*').eq('period_month', period).maybeSingle();
  if (error) return fail(error);
  RUN = run;

  SLIPS = [];
  if (RUN) {
    const { data } = await supabase.from('payslips')
      .select('*, employees(department, designation, side, profiles(full_name))')
      .eq('run_id', RUN.id);
    SLIPS = data ?? [];
  }
  DEPTS = [...new Set(SLIPS.map(s => s.employees?.department).filter(Boolean))].sort();
  fillDepts();
  render();
}

function fillDepts() {
  const sel = $('#depSel');
  if (!sel || sel.dataset.filled) return;
  DEPTS.forEach(d => sel.add(new Option(d, d)));
  sel.dataset.filled = '1';
}

const passes = s =>
  (!fDept || s.employees?.department === fDept) &&
  (!q || (s.employees?.profiles?.full_name || '').toLowerCase().includes(q));

function render() {
  const rows = SLIPS.filter(passes);
  const body = $('#payBody');

  if (body) {
    body.innerHTML = rows.length ? rows.map(s => {
      const nm = s.employees?.profiles?.full_name || 'Unnamed';
      return `<tr data-id="${s.id}">
        <td>
          <div class="pe"><span class="pe__av">${esc(initials(nm))}</span>
            <span><div class="pe__nm">${esc(nm)}</div>
            <div class="pe__role">${esc(s.employees?.designation || '')}</div></span></div>
        </td>
        <td>${esc(s.employees?.department || '—')}</td>
        <td class="num">${s.days_paid} / ${s.days_in_month}</td>
        <td class="num">${money(s.gross)}</td>
        <td class="num">${money(s.pf_employee)}</td>
        <td class="num">${money(s.professional_tax)}</td>
        <td class="num">${canRun
            ? `<input class="tdsIn" type="number" min="0" step="1" value="${Number(s.tds)}" data-tds="${s.id}" aria-label="TDS for ${esc(nm)}" />`
            : money(s.tds)}</td>
        <td class="num">${money(s.total_deductions)}</td>
        <td class="num strong">${money(s.net_pay)}</td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="9" class="tbl__empty">${
        RUN ? 'No payslips match these filters.'
            : 'No payroll run for this month yet. Use Process payroll.'}</td></tr>`;
  }

  const cnt = $('#payCount');
  if (cnt) cnt.textContent = `${rows.length} employee${rows.length === 1 ? '' : 's'}`;

  const gross = rows.reduce((a, s) => a + Number(s.gross || 0), 0);
  const ded   = rows.reduce((a, s) => a + Number(s.total_deductions || 0), 0);
  const net   = rows.reduce((a, s) => a + Number(s.net_pay || 0), 0);

  const set = (id, v) => { const x = document.getElementById(id); if (x) x.textContent = v; };
  set('kGross', moneyS(gross)); set('kDed', moneyS(ded)); set('kNet', moneyS(net));
  set('statTot', money(net));
  set('runMeta', new Date(period).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    + (RUN ? ` · ${ST_LABEL[RUN.status]}` : ' · not processed'));
  set('kPayNote', RUN?.status === 'paid'
    ? `Paid${RUN.paid_on ? ' on ' + fmtDate(RUN.paid_on) : ''}`
    : RUN?.status === 'approved' ? 'Approved, ready to disburse'
    : RUN ? 'Draft — review before approving' : 'Nothing processed');

  const foot = $('#payFoot');
  if (foot) foot.innerHTML = rows.length
    ? `<tr><td colspan="3">Total</td><td class="num">${money(gross)}</td>
        <td class="num">${money(rows.reduce((a,s)=>a+Number(s.pf_employee||0),0))}</td>
        <td class="num">${money(rows.reduce((a,s)=>a+Number(s.professional_tax||0),0))}</td>
        <td class="num">${money(rows.reduce((a,s)=>a+Number(s.tds||0),0))}</td>
        <td class="num">${money(ded)}</td><td class="num strong">${money(net)}</td></tr>`
    : '';

  /* studio vs site split */
  const split = $('#split');
  if (split) {
    const groups = [['studio','Studio'],['site','Site'],['hybrid','Hybrid']].map(([k, label]) => ({
      label, value: rows.filter(s => s.employees?.side === k).reduce((a, s) => a + Number(s.net_pay || 0), 0)
    })).filter(g => g.value > 0);
    const top = Math.max(...groups.map(g => g.value), 1);
    split.innerHTML = groups.length
      ? groups.map(g => `<div class="sp">
          <span class="sp__nm">${g.label}</span>
          <span class="sp__bar"><span class="sp__fill" style="width:${Math.round(g.value/top*100)}%"></span></span>
          <span class="sp__v">${moneyS(g.value)}</span></div>`).join('')
      : '<div class="t-empty">Nothing to split</div>';
  }

  /* step indicator */
  const steps = $('#steps');
  if (steps) {
    const order = ['draft','approved','paid'];
    const at = RUN ? order.indexOf(RUN.status === 'processing' ? 'draft' : RUN.status) : -1;
    steps.innerHTML = ['Process','Approve','Disburse'].map((s, i) =>
      `<li class="stp ${i < at ? 'is-done' : i === at ? 'is-now' : ''}">${s}</li>`).join('');
  }

  const sv = $('#schedV');
  if (sv) sv.textContent = RUN?.status === 'paid' ? 'Complete' : 'Last working day';

  const btn = $('#processBtn');
  if (btn) {
    btn.disabled = !canRun || (RUN && RUN.status !== 'draft');
    btn.textContent = !RUN ? 'Process payroll'
      : RUN.status === 'draft' ? 'Reprocess draft' : ST_LABEL[RUN.status];
  }
}

/* ---------- process ---------- */
$('#processBtn')?.addEventListener('click', async () => {
  if (!canRun) return toast('Payroll is restricted to HR and accounts', 'err');
  if (RUN && RUN.status !== 'draft') return toast(`Already ${RUN.status}`, 'err');
  if (RUN && !confirm('Reprocess this draft? Existing payslips will be rebuilt from current salary structures.')) return;

  const { error } = await supabase.rpc('generate_payroll', { _period: period });
  if (error) return fail(error);
  toast('Payroll processed — review before approving');
  await load();
});

/* TDS entry — accounts fills this in; the DB trigger resyncs the totals */
document.addEventListener('change', async e => {
  const inp = e.target.closest('[data-tds]');
  if (!inp) return;
  const tds = Number(inp.value);
  if (!Number.isFinite(tds) || tds < 0) return toast('Enter a valid TDS amount', 'err');

  const { error } = await supabase.from('payslips').update({ tds }).eq('id', inp.dataset.tds);
  if (error) return fail(error);
  await load();
});

/* ---------- approve / pay ---------- */
const modal = () => $('#procModal');
$('#pmConfirm')?.addEventListener('click', async () => {
  if (!RUN) return;
  const next = RUN.status === 'draft' ? 'approved' : 'paid';
  const patch = next === 'approved'
    ? { status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() }
    : { status: 'paid', paid_on: new Date().toISOString().slice(0, 10) };

  const { error } = await supabase.from('payroll_runs').update(patch).eq('id', RUN.id);
  if (error) return fail(error);
  modal()?.classList.remove('is-open');
  toast(next === 'approved' ? 'Payroll approved' : 'Marked as paid');
  await load();
});

document.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) modal()?.classList.remove('is-open');
});

$('#depSel')?.addEventListener('change', e => { fDept = e.target.value; render(); });
$('#paySearch')?.addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });

$('#exportBtn')?.addEventListener('click', () => {
  if (!SLIPS.length) return toast('Nothing to export', 'err');
  const head = ['Employee','Department','Days paid','Basic','HRA','Allowances','Gross',
                'PF employee','PF employer','ESI employee','Professional tax','TDS',
                'Other deductions','Total deductions','Net pay'];
  const rows = SLIPS.filter(passes).map(s => [
    s.employees?.profiles?.full_name || '', s.employees?.department || '',
    s.days_paid, s.basic, s.hra, s.allowances, s.gross,
    s.pf_employee, s.pf_employer, s.esi_employee, s.professional_tax, s.tds,
    s.other_deductions, s.total_deductions, s.net_pay
  ]);
  const csv = [head, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `payroll-${period.slice(0,7)}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast('Payroll exported');
});

await load();

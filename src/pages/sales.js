import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'sales', title: 'Sales pipeline' });
if (!user) throw new Error('redirecting');

/* budgets are stored in lakhs */
const L  = v => '₹' + (Number(v) || 0).toFixed(1).replace(/\.0$/, '') + ' L';
const CR = v => '₹' + ((Number(v) || 0) / 100).toFixed(2) + ' Cr';

const FN_CLASS = ['', 's2', 's3', 's4', 's5', 's6'];
const cssVar = c => c.startsWith('var(')
  ? getComputedStyle(document.documentElement)
      .getPropertyValue(c.slice(4, -1)).trim() || '#5a8dee'
  : c;

let LEADS = [], STAGES = [];

async function load() {
  const [stageRes, leadRes, targetRes] = await Promise.all([
    supabase.from('lead_stage_config').select('*').order('sort_order'),
    supabase.from('leads').select('name,service,budget,stage_key,created_at,updated_at'),
    supabase.from('sales_targets').select('period_month,target_value')
  ]);

  if (stageRes.error) return fail(stageRes.error);
  if (leadRes.error)  return fail(leadRes.error);

  STAGES = stageRes.data ?? [];
  LEADS  = leadRes.data ?? [];

  paintFunnel();
  paintWinLoss();
  paintRevenue();
  paintStageChart();
  paintForecast();
  paintRing(targetRes.data ?? []);
}

/* ---------------------------------------------------------------
   funnel — cumulative, since a lead at 'nego' already passed 'new'
--------------------------------------------------------------- */
function paintFunnel() {
  const el = $('#funnelRows');
  if (!el) return;

  const order = STAGES.filter(s => !['won', 'lost'].includes(s.stage));
  const rank  = new Map(STAGES.map(s => [s.stage, s.sort_order]));

  const rows = order.map(s => ({
    name: s.label,
    sub:  ['top of funnel','qualified','discovery done','quote sent','terms'][s.sort_order - 1] || '',
    n: LEADS.filter(l => {
      const r = rank.get(l.stage_key);
      /* won leads passed every stage; lost leads stop where they died */
      if (l.stage_key === 'won') return true;
      if (l.stage_key === 'lost') return false;
      return r >= s.sort_order;
    }).length
  }));

  /* Won is the terminal row */
  rows.push({ name: 'Won', sub: 'closed', n: LEADS.filter(l => l.stage_key === 'won').length });

  const top = Math.max(...rows.map(r => r.n), 1);

  el.innerHTML = rows.map((s, i) => {
    const wpct = Math.round(s.n / top * 100);
    const prev = i ? rows[i - 1].n : s.n;
    const conv = i ? (prev ? Math.round(s.n / prev * 100) : 0) : 100;
    const convHtml = i
      ? `<b>${conv}%</b> from prev · <span class="drop">−${100 - conv}%</span>`
      : `<b>${s.n}</b> deals entered`;
    return `<div class="fn">
      <div class="fn__name">${esc(s.name)}<small>${esc(s.sub)}</small></div>
      <div class="fn__bar"><div class="fn__fill ${FN_CLASS[i] || 's6'}" data-w="${wpct}">${s.n}</div></div>
      <div class="fn__conv">${convHtml}</div>
    </div>`;
  }).join('');

  /* the prototype animates width from data-w */
  requestAnimationFrame(() => {
    $$('#funnelRows .fn__fill').forEach(f => f.style.width = f.dataset.w + '%');
  });
}

/* ---------------------------------------------------------------
   charts
--------------------------------------------------------------- */
function paintWinLoss() {
  const c = $('#wlChart');
  if (!c || !window.Chart) return;

  const won  = LEADS.filter(l => l.stage_key === 'won').length;
  const lost = LEADS.filter(l => l.stage_key === 'lost').length;
  const open = LEADS.length - won - lost;

  new window.Chart(c, {
    type: 'doughnut',
    data: {
      labels: ['Won', 'Lost', 'In play'],
      datasets: [{
        data: [won, lost, open],
        borderWidth: 0,
        backgroundColor: [cssVar('var(--success)'), cssVar('var(--danger)'), cssVar('var(--text-3)')]
      }]
    },
    options: { cutout: '66%', plugins: { legend: { display: false } }, maintainAspectRatio: false }
  });
}

function paintStageChart() {
  const c = $('#stageChart');
  if (!c || !window.Chart) return;

  const open = STAGES.filter(s => !['won','lost'].includes(s.stage)).map(s => ({
    label: s.label,
    color: cssVar(s.color),
    value: LEADS.filter(l => l.stage_key === s.stage)
                .reduce((a, l) => a + Number(l.budget || 0), 0)
  })).filter(s => s.value > 0);

  new window.Chart(c, {
    type: 'bar',
    data: {
      labels: open.map(s => s.label),
      datasets: [{ data: open.map(s => s.value), backgroundColor: open.map(s => s.color), borderRadius: 6 }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { callback: v => '₹' + v + 'L' } }
      },
      maintainAspectRatio: false
    }
  });
}

function paintRevenue() {
  const c = $('#revChart');
  if (!c || !window.Chart) return;

  /* won value per month over the last 6 months */
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en-IN', { month: 'short' }) });
  }

  const won = LEADS.filter(l => l.stage_key === 'won');
  const series = months.map(m =>
    won.filter(l => (l.updated_at || '').slice(0, 7) === m.key)
       .reduce((a, l) => a + Number(l.budget || 0), 0));

  new window.Chart(c, {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        data: series,
        borderColor: cssVar('var(--accent)'),
        backgroundColor: 'rgba(90,141,238,.14)',
        fill: true, tension: .35, pointRadius: 3
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { callback: v => '₹' + v + 'L' } }
      },
      maintainAspectRatio: false
    }
  });
}

/* ---------------------------------------------------------------
   forecast — weighted by each stage's probability
--------------------------------------------------------------- */
function paintForecast() {
  const el = $('#forecastBody');
  if (!el) return;

  const prob = new Map(STAGES.map(s => [s.stage, Number(s.probability)]));
  const open = LEADS.filter(l => !['won','lost'].includes(l.stage_key));

  /* group by expected close month; with no close date, fall back to
     "the further along, the sooner" — a lead in negotiation lands first */
  const buckets = new Map();
  for (const l of open) {
    const p = prob.get(l.stage_key) ?? 0;
    const monthsOut = p >= 0.7 ? 0 : p >= 0.5 ? 1 : p >= 0.35 ? 2 : 3;
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthsOut);
    const key = d.toISOString().slice(0, 7);
    if (!buckets.has(key)) buckets.set(key, { label: d.toLocaleString('en-IN', { month: 'short', year: 'numeric' }), leads: [], pipe: 0, weighted: 0 });
    const b = buckets.get(key);
    b.leads.push(l.name);
    b.pipe     += Number(l.budget || 0);
    b.weighted += Number(l.budget || 0) * p;
  }

  const rows = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1]);
  if (!rows.length) {
    el.innerHTML = `<tr><td colspan="6" class="t-empty">No open leads to forecast.</td></tr>`;
    return;
  }

  const maxPipe = Math.max(...rows.map(r => r.pipe), 1);
  let pipeSum = 0, wSum = 0;

  el.innerHTML = rows.map(r => {
    pipeSum += r.pipe; wSum += r.weighted;
    const pct  = r.pipe ? r.weighted / r.pipe : 0;
    const conf = pct >= 0.6 ? 'high' : pct >= 0.4 ? 'mid' : 'low';
    const cov  = Math.round(r.pipe / maxPipe * 100);
    const deals = r.leads.length <= 2 ? r.leads.join(' · ') : `${r.leads.length} deals`;
    return `<tr>
      <td class="month">${esc(r.label)}</td>
      <td style="color:var(--text-2)">${esc(deals)}</td>
      <td class="r mono">${L(r.pipe)}</td>
      <td class="r mono" style="color:var(--accent)">${L(r.weighted)}</td>
      <td><div class="bar-cell"><div class="track"><div class="fill" style="width:${cov}%"></div></div></div></td>
      <td class="r"><span class="pill ${conf}">${Math.round(pct * 100)}%</span></td>
    </tr>`;
  }).join('');

  const set = (id, v) => { const el2 = document.getElementById(id); if (el2) el2.textContent = v; };
  set('fcPipe', L(pipeSum));
  set('fcWeighted', L(wSum));
  set('fcDeals', String(open.length));
}

/* ---------------------------------------------------------------
   target achievement ring
--------------------------------------------------------------- */
function paintRing(targets) {
  const year = new Date().getFullYear();
  const target = targets
    .filter(t => t.period_month?.startsWith(String(year)))
    .reduce((a, t) => a + Number(t.target_value || 0), 0);

  const achieved = LEADS
    .filter(l => l.stage_key === 'won')
    .reduce((a, l) => a + Number(l.budget || 0), 0);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('ringAch', CR(achieved));
  set('ringGap', target ? CR(Math.max(target - achieved, 0)) : 'No target set');

  const pct = target ? Math.min(Math.round(achieved / target * 100), 100) : 0;
  set('ringPct', pct + '%');

  const ring = $('#ringFill');
  if (ring) {
    const r = Number(ring.getAttribute('r')) || 84;
    const circ = 2 * Math.PI * r;
    ring.style.strokeDasharray  = String(circ);
    ring.style.strokeDashoffset = String(circ * (1 - pct / 100));
  }

  if (!target) {
    toast('No sales target set for this year — add one in sales_targets', 'err');
  }
}

$('#exportBtn')?.addEventListener('click', () => {
  const rows = [['Lead','Service','Stage','Budget (L)']]
    .concat(LEADS.map(l => [l.name, l.service || '', l.stage_key, l.budget]));
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `bindbuild-pipeline-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Pipeline exported');
});

await load();

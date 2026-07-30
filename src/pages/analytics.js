import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc } from '../lib/ui.js';
const $ = (s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user = await mountShell({ route: 'analytics', title: 'Analytics' });
if (!user) throw new Error('redirecting');

const cssVar = c => c.startsWith('var(')
  ? getComputedStyle(document.documentElement).getPropertyValue(c.slice(4,-1)).trim() || '#5a8dee' : c;
const money = v => { const n = Number(v)||0;
  if (Math.abs(n)>=1e7) return '₹'+(n/1e7).toFixed(2).replace(/\.00$/,'')+'Cr';
  if (Math.abs(n)>=1e5) return '₹'+(n/1e5).toFixed(1).replace(/\.0$/,'')+'L';
  return '₹'+Math.round(n).toLocaleString('en-IN'); };

let months = 6;

async function load() {
  const from = new Date(); from.setMonth(from.getMonth()-(months-1)); from.setDate(1);
  const iso = from.toISOString().slice(0,10);

  const [fin, pays, exps, leads, stages] = await Promise.all([
    supabase.from('project_financials').select('*'),
    supabase.from('invoice_payments').select('amount,paid_on').gte('paid_on', iso),
    supabase.from('expenses').select('amount,category,status,expense_date').gte('expense_date', iso),
    supabase.from('leads').select('stage_key,budget,source'),
    supabase.from('lead_stage_config').select('*').order('sort_order')
  ]);
  if (fin.error) return fail(fin.error);

  revenue(pays.data ?? []);
  cost(exps.data ?? []);
  pipeline(leads.data ?? [], stages.data ?? []);
  sources(leads.data ?? []);
  projects(fin.data ?? []);
  insights(fin.data ?? [], leads.data ?? []);
}

function labels() {
  const out = [];
  for (let i = months-1; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    out.push({ key: d.toISOString().slice(0,7), label: d.toLocaleString('en-IN',{month:'short'}) });
  }
  return out;
}

function revenue(pays) {
  const c = $('#revChart'); if (!c || !window.Chart) return;
  const ms = labels();
  const data = ms.map(m => pays.filter(p => (p.paid_on||'').startsWith(m.key))
                               .reduce((a,p)=>a+Number(p.amount||0),0));
  new window.Chart(c, { type:'line',
    data:{ labels: ms.map(m=>m.label), datasets:[{ data, borderColor: cssVar('var(--accent)'),
      backgroundColor:'rgba(90,141,238,.14)', fill:true, tension:.35, pointRadius:3 }]},
    options:{ plugins:{legend:{display:false}}, maintainAspectRatio:false,
      scales:{ x:{grid:{display:false}}, y:{beginAtZero:true, ticks:{callback:v=>money(v)}}}}});
  const tag = $('#revTag');
  if (tag) tag.textContent = money(data.reduce((a,b)=>a+b,0)) + ` collected in ${months}m`;
}

function cost(exps) {
  const paid = exps.filter(e => e.status === 'paid');
  const map = new Map();
  paid.forEach(e => map.set(e.category, (map.get(e.category)||0) + Number(e.amount||0)));
  const rows = [...map].sort((a,b)=>b[1]-a[1]);
  const PAL = ['var(--accent)','var(--violet)','#38bdf8','var(--warning)','var(--success)','var(--danger)','#f59e0b','var(--text-3)'];

  const c = $('#costChart');
  if (c && window.Chart && rows.length) {
    new window.Chart(c, { type:'doughnut',
      data:{ labels: rows.map(r=>r[0]), datasets:[{ data: rows.map(r=>r[1]), borderWidth:0,
        backgroundColor: rows.map((_,i)=>cssVar(PAL[i%PAL.length])) }]},
      options:{ cutout:'66%', plugins:{legend:{display:false}}, maintainAspectRatio:false }});
  }
  const lg = $('#costLegend');
  if (lg) lg.innerHTML = rows.length
    ? rows.map(([k,v],i)=>`<li class="lg"><span class="lg__dot" style="background:${cssVar(PAL[i%PAL.length])}"></span>
        <span class="lg__nm">${esc(k)}</span><span class="lg__v">${money(v)}</span></li>`).join('')
    : '<li class="lg">No paid expenses in this period</li>';
}

function pipeline(leads, stages) {
  const open = stages.filter(s => !['won','lost'].includes(s.stage));
  const rows = open.map(s => ({ label: s.label, color: s.color,
    value: leads.filter(l=>l.stage_key===s.stage).reduce((a,l)=>a+Number(l.budget||0),0) })).filter(r=>r.value>0);

  const c = $('#pipeChart');
  if (c && window.Chart && rows.length) {
    new window.Chart(c, { type:'bar',
      data:{ labels: rows.map(r=>r.label), datasets:[{ data: rows.map(r=>r.value),
        backgroundColor: rows.map(r=>cssVar(r.color)), borderRadius:6 }]},
      options:{ plugins:{legend:{display:false}}, maintainAspectRatio:false,
        scales:{ x:{grid:{display:false}}, y:{beginAtZero:true, ticks:{callback:v=>'₹'+v+'L'}}}}});
  }
  const lg = $('#pipeLegend');
  if (lg) lg.innerHTML = rows.length
    ? rows.map(r=>`<li class="lg"><span class="lg__dot" style="background:${cssVar(r.color)}"></span>
        <span class="lg__nm">${esc(r.label)}</span><span class="lg__v">₹${r.value}L</span></li>`).join('')
    : '<li class="lg">Pipeline is empty</li>';
}

function sources(leads) {
  const c = $('#srcChart'); if (!c || !window.Chart) return;
  const map = new Map();
  leads.forEach(l => map.set(l.source || 'Unknown', (map.get(l.source||'Unknown')||0)+1));
  const rows = [...map].sort((a,b)=>b[1]-a[1]);
  if (!rows.length) return;
  new window.Chart(c, { type:'bar',
    data:{ labels: rows.map(r=>r[0]), datasets:[{ data: rows.map(r=>r[1]),
      backgroundColor: cssVar('var(--violet)'), borderRadius:6 }]},
    options:{ indexAxis:'y', plugins:{legend:{display:false}}, maintainAspectRatio:false,
      scales:{ x:{beginAtZero:true, grid:{display:false}} }}});
}

function projects(fin) {
  const body = $('#projBody'); if (!body) return;
  const rows = fin.filter(r => Number(r.billed) > 0 || Number(r.cost) > 0);
  body.innerHTML = rows.length ? rows.map(r => {
    const gm = r.gross_margin_pct;
    return `<tr><td>${esc(r.code)} · ${esc(r.name)}</td>
      <td class="num">${money(r.contract_value_inr)}</td>
      <td class="num">${money(r.billed)}</td>
      <td class="num">${money(r.received)}</td>
      <td class="num">${money(r.cost)}</td>
      <td class="num ${gm===null?'':gm<10?'bad':gm<20?'warn':'ok'}">${gm===null?'—':gm+'%'}</td></tr>`;
  }).join('')
  : '<tr><td colspan="6" class="tbl__empty">No project has been billed or costed yet</td></tr>';
}

function insights(fin, leads) {
  const el = $('#insList'); if (!el) return;
  const out = [];

  const thin = fin.filter(r => r.gross_margin_pct !== null && r.gross_margin_pct < 15);
  if (thin.length) out.push(`${thin.length} project${thin.length>1?'s are':' is'} running under 15% gross margin: ${thin.map(t=>t.code).join(', ')}.`);

  const stuck = leads.filter(l => ['proposal','nego'].includes(l.stage_key));
  if (stuck.length) out.push(`${stuck.length} lead${stuck.length>1?'s are':' is'} sitting at proposal or negotiation, worth ₹${stuck.reduce((a,l)=>a+Number(l.budget||0),0)}L.`);

  const unbilled = fin.filter(r => Number(r.contract_value_inr) > 0 && Number(r.billed) === 0);
  if (unbilled.length) out.push(`${unbilled.length} project${unbilled.length>1?'s have':' has'} a contract value but nothing billed yet.`);

  const owing = fin.reduce((a,r)=>a+Number(r.receivable||0),0);
  if (owing > 0) out.push(`${money(owing)} is billed but not yet collected.`);

  el.innerHTML = out.length
    ? out.map(t => `<li class="ins">${esc(t)}</li>`).join('')
    : '<li class="ins">Not enough data yet. Insights appear once projects are billed and costed.</li>';
}

$('#rangeSeg')?.addEventListener('click', e => {
  const b = e.target.closest('[data-months]'); if (!b) return;
  months = Number(b.dataset.months) || 6;
  $$('#rangeSeg [data-months]').forEach(x => x.classList.toggle('is-on', x === b));
  location.reload();
});

$('#exportBtn')?.addEventListener('click', async () => {
  const { data } = await supabase.from('project_financials').select('*');
  if (!data?.length) return toast('Nothing to export', 'err');
  const head = ['Code','Name','Status','Contract value','Billed','Received','Receivable','Cost','Gross margin','GM %'];
  const rows = data.map(r => [r.code,r.name,r.status,r.contract_value_inr,r.billed,r.received,r.receivable,r.cost,r.gross_margin,r.gross_margin_pct]);
  const csv = [head,...rows].map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url; a.download = `bindbuild-analytics-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url); toast('Exported');
});

await load();

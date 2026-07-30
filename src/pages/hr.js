import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'hr', title: 'HR' });
if (!user) throw new Error('redirecting');

const canHr = ['owner','admin','hr'].some(r => user.roles.includes(r));
const cssVar = c => c.startsWith('var(')
  ? getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim() || '#5a8dee'
  : c;
const DEPT_COLORS = ['var(--accent)','var(--violet)','#38bdf8','var(--warning)','var(--success)','var(--danger)'];

let TEAM = [], TODAY = [], LEAVES = [];

async function load() {
  const today = new Date().toISOString().slice(0, 10);
  const [tRes, aRes, lRes] = await Promise.all([
    supabase.from('employees').select('*, profiles(full_name,email,avatar_url)').eq('status','active'),
    supabase.from('attendance').select('*').eq('on_date', today),
    supabase.from('leave_requests')
      .select('*, leave_types(name), employees(profiles(full_name))')
      .eq('status','pending').order('from_date')
  ]);

  if (tRes.error) return fail(tRes.error);
  TEAM = tRes.data ?? []; TODAY = aRes.data ?? []; LEAVES = lRes.data ?? [];

  paintRoster();
  paintLeaves();
  paintDept();
  await paintAttendanceTrend();
  await paintUpcoming();
}

const statusOf = id => TODAY.find(a => a.employee_id === id)?.status || 'unmarked';
const LABEL = { present:'Present', absent:'Absent', leave:'On leave', half_day:'Half day',
                wfh:'Working remotely', holiday:'Holiday', week_off:'Week off', unmarked:'Not marked' };

function paintRoster() {
  const el = $('#roster');
  if (!el) return;
  el.innerHTML = TEAM.length
    ? TEAM.map(e => {
        const st = statusOf(e.id);
        const nm = e.profiles?.full_name || 'Unnamed';
        return `<li class="rr" data-id="${e.id}">
          <span class="rr__av">${esc(initials(nm))}</span>
          <span class="rr__body">
            <span class="rr__nm">${esc(nm)}</span>
            <span class="rr__role">${esc(e.designation || '—')}${e.department ? ' · ' + esc(e.department) : ''}</span>
          </span>
          <span class="rr__st st--${st}">${LABEL[st]}</span>
        </li>`;
      }).join('')
    : '<li class="rr"><span class="rr__body">No employees yet. Add the team from an employee profile.</span></li>';
}

function paintLeaves() {
  const el = $('#leaves');
  if (el) {
    el.innerHTML = LEAVES.length
      ? LEAVES.map(l => `<li class="lv" data-id="${l.id}">
          <span class="lv__body">
            <span class="lv__nm">${esc(l.employees?.profiles?.full_name || '—')}</span>
            <span class="lv__meta">${esc(l.leave_types?.name || 'Leave')} · ${fmtDate(l.from_date)}${l.days > 1 ? ` – ${fmtDate(l.to_date)}` : ''} · ${l.days}d</span>
            <span class="lv__why">${esc(l.reason || '')}</span>
          </span>
          ${canHr ? `<span class="lv__acts">
            <button class="lv__ok" data-approve="${l.id}">Approve</button>
            <button class="lv__no" data-reject="${l.id}">Reject</button>
          </span>` : ''}
        </li>`).join('')
      : '<li class="lv"><span class="lv__body">No pending leave requests</span></li>';
  }
  const tag = $('#lvTag');
  if (tag) { tag.textContent = String(LEAVES.length); tag.hidden = !LEAVES.length; }
}

function paintDept() {
  const map = new Map();
  TEAM.forEach(e => map.set(e.department || 'Unassigned', (map.get(e.department || 'Unassigned') || 0) + 1));
  const rows = [...map].sort((a, b) => b[1] - a[1]);

  const canvas = $('#deptChart');
  if (canvas && window.Chart && rows.length) {
    new window.Chart(canvas, {
      type: 'doughnut',
      data: { labels: rows.map(r => r[0]),
              datasets: [{ data: rows.map(r => r[1]), borderWidth: 0,
                           backgroundColor: rows.map((_, i) => cssVar(DEPT_COLORS[i % DEPT_COLORS.length])) }] },
      options: { cutout: '64%', plugins: { legend: { display: false } }, maintainAspectRatio: false }
    });
  }

  const lg = $('#deptLegend');
  if (lg) {
    lg.innerHTML = rows.length
      ? rows.map(([d, n], i) => `<li class="lg">
          <span class="lg__dot" style="background:${cssVar(DEPT_COLORS[i % DEPT_COLORS.length])}"></span>
          <span class="lg__nm">${esc(d)}</span><span class="lg__v">${n}</span>
        </li>`).join('')
      : '<li class="lg">No departments yet</li>';
  }
}

async function paintAttendanceTrend() {
  const canvas = $('#attChart');
  if (!canvas || !window.Chart) return;

  const from = new Date(); from.setDate(from.getDate() - 13);
  const { data } = await supabase.from('attendance')
    .select('on_date,status').gte('on_date', from.toISOString().slice(0, 10));

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const pct = days.map(d => {
    const rows = (data ?? []).filter(a => a.on_date === d);
    if (!rows.length || !TEAM.length) return 0;
    return Math.round(rows.filter(a => ['present','wfh','half_day'].includes(a.status)).length / TEAM.length * 100);
  });

  new window.Chart(canvas, {
    type: 'line',
    data: { labels: days.map(d => d.slice(8)),
            datasets: [{ data: pct, borderColor: cssVar('var(--accent)'),
                         backgroundColor: 'rgba(90,141,238,.14)', fill: true, tension: .3, pointRadius: 2 }] },
    options: { plugins: { legend: { display: false } },
               scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } },
                         x: { grid: { display: false } } },
               maintainAspectRatio: false }
  });
}

async function paintUpcoming() {
  const el = $('#ups');
  if (!el) return;
  const { data } = await supabase.from('celebrations').select('*');
  const rows = (data ?? [])
    .filter(c => c.days_away >= 0 && c.days_away <= 45)
    .sort((a, b) => a.days_away - b.days_away).slice(0, 6);

  el.innerHTML = rows.length
    ? rows.map(c => `<li class="up">
        <span class="up__av">${esc(initials(c.full_name))}</span>
        <span class="up__body">
          <span class="up__nm">${esc(c.full_name)}</span>
          <span class="up__meta">${c.kind === 'birthday' ? 'Birthday' : `${c.years} year${c.years === 1 ? '' : 's'} at Studio Bind`} · ${esc(c.label)}</span>
        </span>
        <span class="up__in">${c.days_away === 0 ? 'today' : `in ${c.days_away}d`}</span>
      </li>`).join('')
    : '<li class="up"><span class="up__body">Nothing coming up. Add dates of birth and joining to employee records.</span></li>';
}

/* leave approval */
document.addEventListener('click', async e => {
  const ap = e.target.closest('[data-approve]'), rj = e.target.closest('[data-reject]');
  const btn = ap || rj;
  if (!btn) return;
  const id = ap ? ap.dataset.approve : rj.dataset.reject;
  const { error } = await supabase.from('leave_requests').update({
    status: ap ? 'approved' : 'rejected',
    approved_by: user.id, approved_at: new Date().toISOString()
  }).eq('id', id);
  if (error) return fail(error);
  toast(`Leave ${ap ? 'approved' : 'rejected'}`);
  await load();
});

document.addEventListener('click', e => {
  const rr = e.target.closest('.rr[data-id]');
  if (rr) location.href = `/employee.html?id=${rr.dataset.id}`;
});

await load();

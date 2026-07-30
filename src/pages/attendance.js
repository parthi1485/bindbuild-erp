import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'hr', title: 'Attendance' });
if (!user) throw new Error('redirecting');

const canMark = ['owner','admin','hr','site_engineer','architect'].some(r => user.roles.includes(r));

let onDate = new URLSearchParams(location.search).get('date') || new Date().toISOString().slice(0, 10);
let TEAM = [], ATT = [], LEAVES = [];
let fStatus = '', fLoc = '', q = '';

const STATUSES = ['present','wfh','half_day','leave','absent'];
const LABEL = { present:'Present', wfh:'Remote', half_day:'Half day', leave:'On leave',
                absent:'Absent', holiday:'Holiday', week_off:'Week off', unmarked:'Not marked' };

async function load() {
  const [tRes, aRes, lRes] = await Promise.all([
    supabase.from('employees').select('*, profiles(full_name)').eq('status','active'),
    supabase.from('attendance').select('*').eq('on_date', onDate),
    supabase.from('leave_requests')
      .select('*, leave_types(name), employees(profiles(full_name))')
      .eq('status','approved').lte('from_date', onDate).gte('to_date', onDate)
  ]);
  if (tRes.error) return fail(tRes.error);
  TEAM = tRes.data ?? []; ATT = aRes.data ?? []; LEAVES = lRes.data ?? [];

  const lbl = $('#dLbl');
  if (lbl) lbl.textContent = fmtDate(onDate);
  const ctx = $('#ctxDate');
  if (ctx) ctx.textContent = onDate === new Date().toISOString().slice(0,10) ? 'Today' : fmtDate(onDate);

  render();
}

const rowFor = id => ATT.find(a => a.employee_id === id);
const statusOf = id => {
  const r = rowFor(id);
  if (r) return r.status;
  if (LEAVES.some(l => l.employee_id === id)) return 'leave';
  return 'unmarked';
};

function passes(e) {
  if (fStatus && statusOf(e.id) !== fStatus) return false;
  if (fLoc && (e.work_location || '') !== fLoc) return false;
  if (q && !(e.profiles?.full_name || '').toLowerCase().includes(q)) return false;
  return true;
}

function render() {
  const rows = TEAM.filter(passes);
  const el = $('#reg');
  if (el) {
    el.innerHTML = rows.length ? rows.map(e => {
      const r = rowFor(e.id), st = statusOf(e.id);
      const nm = e.profiles?.full_name || 'Unnamed';
      return `<li class="pr" data-id="${e.id}">
        <span class="pr__av">${esc(initials(nm))}</span>
        <span class="pr__body">
          <span class="pr__nm">${esc(nm)}</span>
          <span class="pr__role">${esc(e.designation || '—')} · ${esc(e.work_location || '—')}</span>
        </span>
        <span class="pr__in">${r?.check_in ? r.check_in.slice(0,5) : '—'}</span>
        <span class="pr__out">${r?.check_out ? r.check_out.slice(0,5) : '—'}</span>
        <span class="pr__st st--${st}">${LABEL[st]}</span>
        ${canMark ? `<span class="pr__acts">${
          STATUSES.map(s => `<button class="mk${st === s ? ' is-on' : ''}" data-mark="${e.id}:${s}" title="${LABEL[s]}">${LABEL[s][0]}</button>`).join('')
        }</span>` : ''}
      </li>`;
    }).join('')
    : '<li class="pr"><span class="pr__body">Nobody matches these filters.</span></li>';
  }

  const cnt = $('#regCount');
  if (cnt) cnt.textContent = `${rows.length} of ${TEAM.length}`;

  const tally = s => TEAM.filter(e => statusOf(e.id) === s).length;
  const present = tally('present') + tally('wfh') + tally('half_day');
  const pct = TEAM.length ? Math.round(present / TEAM.length * 100) : 0;

  const set = (id, v) => { const x = document.getElementById(id); if (x) x.textContent = v; };
  set('kPres', String(present)); set('sPres', String(present));
  set('kAbs',  String(tally('absent'))); set('sAbs', String(tally('absent')));
  set('kLeave',String(tally('leave')));  set('sLeave', String(tally('leave')));
  set('kLate', String(ATT.filter(a => a.check_in && a.check_in > '09:30').length));
  set('sLate', String(ATT.filter(a => a.check_in && a.check_in > '09:30').length));
  set('kPct', pct + '%'); set('ringPct', pct + '%');

  const ring = $('#ring');
  if (ring) {
    const r = Number(ring.getAttribute('r')) || 54;
    const c = 2 * Math.PI * r;
    ring.style.strokeDasharray = String(c);
    ring.style.strokeDashoffset = String(c * (1 - pct / 100));
  }

  const ll = $('#leavelist');
  if (ll) {
    ll.innerHTML = LEAVES.length
      ? LEAVES.map(l => `<li class="lvr">
          <span class="lvr__nm">${esc(l.employees?.profiles?.full_name || '—')}</span>
          <span class="lvr__meta">${esc(l.leave_types?.name || 'Leave')} · ${l.days}d</span>
        </li>`).join('')
      : '<li class="lvr">Nobody on leave</li>';
  }

  const locSeg = $('#locSeg');
  if (locSeg && !locSeg.dataset.filled) {
    const locs = [...new Set(TEAM.map(e => e.work_location).filter(Boolean))];
    locSeg.innerHTML = `<button data-loc="all" class="is-on">All</button>` +
      locs.map(l => `<button data-loc="${esc(l)}">${esc(l)}</button>`).join('');
    locSeg.dataset.filled = '1';
  }
}

/* ---- mark attendance ---- */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-mark]');
  if (!b) return;
  const [empId, status] = b.dataset.mark.split(':');
  const now = new Date().toTimeString().slice(0, 8);
  const existing = rowFor(empId);

  const payload = {
    employee_id: empId, on_date: onDate, status,
    marked_by: user.id,
    check_in: status === 'present' || status === 'wfh' || status === 'half_day'
      ? (existing?.check_in || now) : existing?.check_in ?? null
  };

  const { error } = existing
    ? await supabase.from('attendance').update(payload).eq('id', existing.id)
    : await supabase.from('attendance').insert(payload);

  if (error) return fail(error);
  await load();
});

$('#markAll')?.addEventListener('click', async () => {
  if (!canMark) return toast('You cannot mark attendance', 'err');
  const unmarked = TEAM.filter(e => statusOf(e.id) === 'unmarked');
  if (!unmarked.length) return toast('Everyone is already marked');
  if (!confirm(`Mark ${unmarked.length} unmarked as present?`)) return;

  const now = new Date().toTimeString().slice(0, 8);
  const { error } = await supabase.from('attendance').insert(
    unmarked.map(e => ({ employee_id: e.id, on_date: onDate, status: 'present',
                         check_in: now, marked_by: user.id })));
  if (error) return fail(error);
  toast(`${unmarked.length} marked present`);
  await load();
});

/* ---- date nav ---- */
const shift = n => {
  const d = new Date(onDate); d.setDate(d.getDate() + n);
  onDate = d.toISOString().slice(0, 10);
  load();
};
$('#dPrev')?.addEventListener('click', () => shift(-1));
$('#dNext')?.addEventListener('click', () => shift(1));

$('#statSel')?.addEventListener('change', e => { fStatus = e.target.value; render(); });
$('#regSearch')?.addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
$('#locSeg')?.addEventListener('click', e => {
  const b = e.target.closest('[data-loc]');
  if (!b) return;
  fLoc = b.dataset.loc === 'all' ? '' : b.dataset.loc;
  $$('#locSeg [data-loc]').forEach(x => x.classList.toggle('is-on', x === b));
  render();
});

await load();

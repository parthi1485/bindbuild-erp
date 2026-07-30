import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate } from '../lib/ui.js';
const $ = (s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user = await mountShell({ route: 'calendar', title: 'Calendar' });
if (!user) throw new Error('redirecting');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const KIND = { meeting:'Meeting', milestone:'Milestone', task:'Task', site_report:'Site report', action:'Action item' };

let cursor = new Date(); cursor.setDate(1);
let ITEMS = [];

async function load() {
  const from = new Date(cursor); from.setDate(1); from.setMonth(from.getMonth() - 1);
  const to   = new Date(cursor); to.setMonth(to.getMonth() + 2);
  const { data, error } = await supabase.from('calendar_items')
    .select('*').gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString());
  if (error) return fail(error);
  ITEMS = data ?? [];
  render();
}

const key = d => d.toISOString().slice(0,10);

function render() {
  const lbl = $('#mLabel');
  if (lbl) lbl.textContent = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const dl = $('#dl');
  if (dl) dl.innerHTML = DOW.map(d => `<span class="dow">${d}</span>`).join('');

  const first = new Date(cursor);
  const startPad = (first.getDay() + 6) % 7;         // week starts Monday
  const daysIn = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const today = key(new Date());

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));

  const grid = $('#month');
  if (grid) {
    grid.innerHTML = cells.map(d => {
      if (!d) return '<div class="cell cell--pad"></div>';
      const k = key(d);
      const items = ITEMS.filter(i => (i.starts_at || '').slice(0,10) === k);
      return `<div class="cell${k === today ? ' is-today' : ''}" data-date="${k}">
        <span class="cell__n">${d.getDate()}</span>
        <div class="cell__ev">${items.slice(0,3).map(i =>
          `<span class="ev ev--${i.kind}${i.complete ? ' is-done' : ''}" title="${esc(i.title)}">${esc(i.title)}</span>`
        ).join('')}${items.length > 3 ? `<span class="ev ev--more">+${items.length-3}</span>` : ''}</div>
      </div>`;
    }).join('');
  }

  const lg = $('#legend');
  if (lg) lg.innerHTML = Object.entries(KIND)
    .map(([k, v]) => `<span class="lgi lgi--${k}"><span class="lgi__dot"></span>${v}</span>`).join('');

  paintAgenda(today);
}

function paintAgenda(dayKey) {
  const el = $('#agenda');
  const t  = $('#agTitle');
  if (t) t.textContent = fmtDate(dayKey);
  if (!el) return;
  const items = ITEMS.filter(i => (i.starts_at || '').slice(0,10) === dayKey)
                     .sort((a,b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  el.innerHTML = items.length
    ? items.map(i => `<li class="ag ag--${i.kind}">
        <span class="ag__t">${new Date(i.starts_at).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})}</span>
        <span class="ag__body"><span class="ag__nm">${esc(i.title)}</span>
        <span class="ag__meta">${KIND[i.kind]}${i.location ? ' · ' + esc(i.location) : ''}</span></span>
      </li>`).join('')
    : '<li class="ag"><span class="ag__body"><span class="ag__nm">Nothing scheduled</span></span></li>';
}

document.addEventListener('click', e => {
  const c = e.target.closest('.cell[data-date]');
  if (c) {
    $$('.cell.is-sel').forEach(x => x.classList.remove('is-sel'));
    c.classList.add('is-sel');
    paintAgenda(c.dataset.date);
  }
});

const move = n => { cursor.setMonth(cursor.getMonth() + n); load(); };
$('#prevM')?.addEventListener('click', () => move(-1));
$('#nextM')?.addEventListener('click', () => move(1));
$('#todayBtn')?.addEventListener('click', () => { cursor = new Date(); cursor.setDate(1); load(); });

$('#newEventBtn')?.addEventListener('click', async () => {
  const title = prompt('Meeting title'); if (!title) return;
  const when = prompt('When? (YYYY-MM-DD HH:MM)', new Date().toISOString().slice(0,16).replace('T',' '));
  if (!when) return;
  const at = new Date(when.replace(' ','T'));
  if (isNaN(at)) return toast('Could not read that date', 'err');
  const { error } = await supabase.from('meetings')
    .insert({ title, scheduled_at: at.toISOString(), created_by: user.id });
  if (error) return fail(error);
  toast('Meeting added'); await load();
});

await load();

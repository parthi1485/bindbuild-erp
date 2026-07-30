import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'hr', title: 'Learning' });
if (!user) throw new Error('redirecting');

let COURSES = [], ENROL = [], CERTS = [];
let fCat = '';

async function load() {
  const [cRes, eRes, ctRes] = await Promise.all([
    supabase.from('courses').select('*').eq('status','active').order('title'),
    supabase.from('course_enrollments')
      .select('*, courses(title,category,duration_hours), employees(profiles(full_name))'),
    supabase.from('certifications')
      .select('*, employees(profiles(full_name))').order('issued_on', { ascending: false })
  ]);
  if (cRes.error) return fail(cRes.error);
  COURSES = cRes.data ?? []; ENROL = eRes.data ?? []; CERTS = ctRes.data ?? [];

  fillCats();
  render();
}

function fillCats() {
  const sel = $('#catFilter');
  if (!sel || sel.dataset.filled) return;
  [...new Set(COURSES.map(c => c.category).filter(Boolean))].sort()
    .forEach(c => sel.add(new Option(c, c)));
  sel.dataset.filled = '1';
}

const mine = id => ENROL.find(e => e.course_id === id && e.employee_id === user.id);

function render() {
  const rows = COURSES.filter(c => !fCat || c.category === fCat);

  const el = $('#cont');
  if (el) {
    el.innerHTML = rows.length ? rows.map(c => {
      const en = mine(c.id);
      return `<article class="cc" data-id="${c.id}">
        <div class="cc__cat">${esc(c.category)}${c.is_mandatory ? ' · required' : ''}</div>
        <div class="cc__t">${esc(c.title)}</div>
        <div class="cc__meta">${esc(c.provider || '')}${c.duration_hours ? ` · ${c.duration_hours}h` : ''}</div>
        ${en ? `<div class="cc__bar"><span style="width:${en.progress_pct}%"></span></div>
                <div class="cc__st">${en.status.replace('_',' ')} · ${en.progress_pct}%</div>`
             : `<button class="cc__go" data-enrol="${c.id}">Start</button>`}
      </article>`;
    }).join('')
    : '<div class="t-empty">No courses yet. HR can add them.</div>';
  }

  const cat = $('#cat');
  if (cat) {
    const map = new Map();
    COURSES.forEach(c => map.set(c.category, (map.get(c.category) || 0) + 1));
    const list = [...map].sort((a,b) => b[1]-a[1]);
    const top = Math.max(...list.map(l => l[1]), 1);
    cat.innerHTML = list.length
      ? list.map(([nm, n]) => `<div class="crow-wrap">
          <div class="crow__top"><span class="crow__nm">${esc(nm)}</span><span class="crow__amt">${n}</span></div>
          <div class="bar"><div class="bar__fill" style="width:${Math.round(n/top*100)}%"></div></div>
        </div>`).join('')
      : '<div class="t-empty">No categories</div>';
  }

  const ses = $('#ses');
  if (ses) {
    const active = ENROL.filter(e => e.status === 'in_progress');
    ses.innerHTML = active.length
      ? active.map(e => `<li class="sr2">
          <span class="sr2__nm">${esc(e.employees?.profiles?.full_name || '—')}</span>
          <span class="sr2__meta">${esc(e.courses?.title || '')} · ${e.progress_pct}%</span>
        </li>`).join('')
      : '<li class="sr2">Nobody mid-course right now</li>';
  }

  const certs = $('#certs');
  if (certs) {
    certs.innerHTML = CERTS.length
      ? CERTS.map(c => `<li class="ct">
          <span class="ct__nm">${esc(c.name)}</span>
          <span class="ct__meta">${esc(c.employees?.profiles?.full_name || '')}${c.issued_on ? ' · ' + fmtDate(c.issued_on) : ''}${
            c.expires_on ? ` · expires ${fmtDate(c.expires_on)}` : ''}</span>
        </li>`).join('')
      : '<li class="ct">No certifications recorded</li>';
  }

  const lb = $('#lb');
  if (lb) {
    const map = new Map();
    ENROL.filter(e => e.status === 'completed').forEach(e => {
      const nm = e.employees?.profiles?.full_name || '—';
      map.set(nm, (map.get(nm) || 0) + Number(e.courses?.duration_hours || 0));
    });
    const list = [...map].sort((a,b) => b[1]-a[1]).slice(0, 6);
    lb.innerHTML = list.length
      ? list.map(([nm, h], i) => `<li class="lbr">
          <span class="lbr__rk">${i + 1}</span>
          <span class="lbr__av">${esc(initials(nm))}</span>
          <span class="lbr__nm">${esc(nm)}</span>
          <span class="lbr__v">${h}h</span>
        </li>`).join('')
      : '<li class="lbr"><span class="lbr__nm">No courses completed yet</span></li>';
  }
}

/* enrol / progress */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-enrol]');
  if (!b) return;
  const { error } = await supabase.from('course_enrollments').insert({
    course_id: b.dataset.enrol, employee_id: user.id,
    status: 'in_progress', progress_pct: 0, started_on: new Date().toISOString().slice(0,10)
  });
  if (error) return fail(error);
  toast('Enrolled');
  await load();
});

document.addEventListener('click', async e => {
  const card = e.target.closest('.cc[data-id]');
  if (!card || e.target.closest('[data-enrol]')) return;
  const en = mine(card.dataset.id);
  if (!en) return;
  const raw = prompt('Progress %', String(en.progress_pct));
  if (raw === null) return;
  const pct = Math.max(0, Math.min(100, Number(raw) || 0));
  const { error } = await supabase.from('course_enrollments').update({
    progress_pct: pct,
    status: pct >= 100 ? 'completed' : 'in_progress',
    completed_on: pct >= 100 ? new Date().toISOString().slice(0,10) : null
  }).eq('id', en.id);
  if (error) return fail(error);
  toast(pct >= 100 ? 'Course completed' : 'Progress saved');
  await load();
});

$('#catFilter')?.addEventListener('change', e => { fCat = e.target.value; render(); });

await load();

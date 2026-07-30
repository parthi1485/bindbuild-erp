import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate, daysAgo } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'people', title: 'People & Culture' });
if (!user) throw new Error('redirecting');

let TEAM = [], KUDOS = [];

async function load() {
  const [tRes, kRes] = await Promise.all([
    supabase.from('profiles').select('id,full_name,job_title'),
    supabase.from('kudos')
      .select('*, from:from_id(full_name), to:to_id(full_name)')
      .order('created_at', { ascending: false }).limit(20)
  ]);
  TEAM  = tRes.data ?? [];
  KUDOS = kRes.error ? [] : (kRes.data ?? []);
  if (kRes.error) fail(kRes.error);

  fillTo();
  paintKudos();
  await paintCelebrations();
}

function fillTo() {
  const sel = $('#kmTo');
  if (!sel || sel.dataset.filled) return;
  TEAM.filter(p => p.id !== user.id)
      .forEach(p => sel.add(new Option(p.full_name || 'Unnamed', p.id)));
  sel.dataset.filled = '1';
  if (!sel.options.length) sel.add(new Option('No colleagues yet', ''));
}

function paintKudos() {
  const el = $('#kudos');
  if (el) {
    el.innerHTML = KUDOS.length
      ? KUDOS.map(k => `<li class="kd">
          <span class="kd__av">${esc(initials(k.from?.full_name || '?'))}</span>
          <span class="kd__body">
            <span class="kd__hd"><b>${esc(k.from?.full_name || '—')}</b> → <b>${esc(k.to?.full_name || '—')}</b></span>
            <span class="kd__msg">${esc(k.message)}</span>
            ${(k.value_tags || []).length ? `<span class="kd__tags">${k.value_tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</span>` : ''}
          </span>
          <span class="kd__when">${daysAgo(k.created_at)} ago</span>
        </li>`).join('')
      : '<li class="kd"><span class="kd__body">No kudos yet. Be the first.</span></li>';
  }
  const c = $('#kudoCount');
  if (c) c.textContent = String(KUDOS.length);
}

async function paintCelebrations() {
  const el = $('#celeb');
  if (!el) return;
  const { data } = await supabase.from('celebrations').select('*');
  const rows = (data ?? []).filter(c => c.days_away >= 0 && c.days_away <= 60)
                           .sort((a, b) => a.days_away - b.days_away).slice(0, 8);
  el.innerHTML = rows.length
    ? rows.map(c => `<li class="cel">
        <span class="cel__av">${esc(initials(c.full_name))}</span>
        <span class="cel__body">
          <span class="cel__nm">${esc(c.full_name)}</span>
          <span class="cel__meta">${c.kind === 'birthday' ? 'Birthday' : `${c.years} year${c.years === 1 ? '' : 's'}`} · ${esc(c.label)}</span>
        </span>
        <span class="cel__in">${c.days_away === 0 ? 'today' : `in ${c.days_away}d`}</span>
      </li>`).join('')
    : '<li class="cel"><span class="cel__body">Add dates of birth and joining to employee records to see these.</span></li>';
}

/* ---- send kudos ---- */
const modal = () => $('#kudoModal');
const open  = () => { modal()?.classList.add('is-open'); $('#kmMsg')?.focus(); };
const close = () => modal()?.classList.remove('is-open');

$('#kudoBtn')?.addEventListener('click', open);
$('#kudoBtn2')?.addEventListener('click', open);
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });

$('#kmSend')?.addEventListener('click', async () => {
  const to = $('#kmTo')?.value;
  const message = ($('#kmMsg')?.value || '').trim();
  if (!to) return toast('Pick a colleague', 'err');
  if (!message) return toast('Write a message', 'err');

  const tags = $$('#kmVals input:checked').map(i => i.value);

  /* from_id must be the caller — RLS enforces it, so no spoofing */
  const { error } = await supabase.from('kudos')
    .insert({ from_id: user.id, to_id: to, message, value_tags: tags });

  if (error) return fail(error);
  close();
  const box = $('#kmMsg'); if (box) box.value = '';
  toast('Kudos sent');
  await load();
});

await load();

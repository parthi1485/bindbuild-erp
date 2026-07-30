import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, daysAgo } from '../lib/ui.js';
const $ = (s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user = await mountShell({ route: 'settings', title: 'Notifications' });
if (!user) throw new Error('redirecting');

let NOTES = [], filter = 'all';

async function load() {
  const { data, error } = await supabase.from('notifications')
    .select('*').order('created_at', { ascending: false }).limit(80);
  if (error) return fail(error);
  NOTES = data ?? [];
  render();
}

function render() {
  const rows = NOTES.filter(n =>
    filter === 'all' ? true :
    filter === 'unread' ? !n.read_at :
    n.kind === filter);

  const el = $('#nWrap');
  if (el) el.innerHTML = rows.length
    ? rows.map(n => `<li class="nt${n.read_at ? '' : ' is-unread'} nt--${n.kind}" data-id="${n.id}">
        <span class="nt__body"><span class="nt__t">${esc(n.title)}</span>
          <span class="nt__d">${esc(n.body || '')}</span></span>
        <span class="nt__w">${daysAgo(n.created_at)} ago</span>
      </li>`).join('')
    : `<li class="nt"><span class="nt__body"><span class="nt__t">${
        NOTES.length ? 'Nothing matches this filter' : 'No notifications yet'}</span></span></li>`;

  const unread = NOTES.filter(n => !n.read_at).length;
  const c = $('#pcount');
  if (c) c.textContent = unread ? `${unread} unread` : 'All caught up';
  const dot = $('#bellDot');
  if (dot) dot.hidden = !unread;
}

document.addEventListener('click', async e => {
  const n = e.target.closest('.nt[data-id]');
  if (n) {
    const row = NOTES.find(x => x.id === n.dataset.id);
    if (row && !row.read_at) {
      await supabase.from('notifications')
        .update({ read_at: new Date().toISOString() }).eq('id', row.id);
      row.read_at = new Date().toISOString();
      render();
    }
    if (row?.link) location.href = row.link;
  }
});

$('#markAll')?.addEventListener('click', async () => {
  const unread = NOTES.filter(n => !n.read_at).map(n => n.id);
  if (!unread.length) return toast('Nothing unread');
  const { error } = await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() }).in('id', unread);
  if (error) return fail(error);
  toast('All marked read'); await load();
});

$('#filterSeg')?.addEventListener('click', e => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  filter = b.dataset.filter;
  $$('#filterSeg [data-filter]').forEach(x => x.classList.toggle('is-on', x === b));
  render();
});

await load();

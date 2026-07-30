import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate, daysAgo } from '../lib/ui.js';
const $ = (s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user = await mountShell({ route: 'settings', title: 'My profile' });
if (!user) throw new Error('redirecting');

function setKv(label, v) {
  const row = $$('.kv').find(r => $('.kv__k', r)?.textContent.trim().toLowerCase() === label.toLowerCase());
  if (row) $('.kv__v', row).textContent = v || '—';
}

async function load() {
  const [emp, acts, tasks] = await Promise.all([
    supabase.from('employees').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('activities').select('kind,detail,created_at')
      .eq('user_id', user.id).order('created_at',{ascending:false}).limit(12),
    supabase.from('tasks').select('id,title,board_column,due_date')
      .eq('assignee_id', user.id).neq('board_column','done').order('due_date').limit(8)
  ]);

  const nm = $('.p-name') || $('h1');
  if (nm) nm.textContent = user.name;
  const av = $('.p-avatar') || $('.avatar-lg');
  if (av) av.textContent = initials(user.name);
  const sub = $('.p-sub');
  if (sub) sub.textContent = [user.title, user.email].filter(Boolean).join(' · ');

  setKv('Email', user.email);
  setKv('Role', user.roles.join(', ') || '—');
  setKv('Department', emp.data?.department);
  setKv('Designation', emp.data?.designation);
  setKv('Joined', emp.data?.date_of_joining ? fmtDate(emp.data.date_of_joining) : '—');
  setKv('Location', emp.data?.work_location);

  const feed = $('#feed');
  if (feed) feed.innerHTML = (acts.data ?? []).length
    ? acts.data.map(a => `<li class="fd"><span class="fd__t">${esc(a.detail || a.kind)}</span>
        <span class="fd__w">${daysAgo(a.created_at)} ago</span></li>`).join('')
    : '<li class="fd"><span class="fd__t">No recent activity</span></li>';

  const pm = $('#pmini');
  if (pm) pm.innerHTML = (tasks.data ?? []).length
    ? tasks.data.map(t => `<li class="tk"><span class="tk__t">${esc(t.title)}</span>
        <span class="tk__w">${t.due_date ? fmtDate(t.due_date) : '—'}</span></li>`).join('')
    : '<li class="tk"><span class="tk__t">No open tasks assigned to you</span></li>';
}

document.addEventListener('click', async e => {
  if (!e.target.closest('#editProfile')) return;
  const name = prompt('Your name', user.name);
  if (!name) return;
  const title = prompt('Job title', user.title) || user.title;
  const { error } = await supabase.from('profiles')
    .update({ full_name: name, job_title: title }).eq('id', user.id);
  if (error) return fail(error);
  toast('Profile updated'); location.reload();
});

await load();

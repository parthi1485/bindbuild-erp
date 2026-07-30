import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { fail, esc, daysAgo, toast } from '../lib/ui.js';

const $ = s => document.querySelector(s);

const user = await mountShell({ route: 'dashboard', title: 'Dashboard' });
if (!user) throw new Error('redirecting');

/* ---------- greeting ---------- */
(function greet() {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const el = $('#greeting');
  if (el) el.textContent = `${part}, ${user.name.split(' ')[0]}`;
})();

const money = l => l >= 100
  ? '₹' + (l / 100).toFixed(1).replace(/\.0$/, '') + 'Cr'
  : '₹' + Math.round(l) + 'L';

/* ---------- pipeline by stage ---------- */
async function pipeline() {
  const [{ data: cfg, error: e1 }, { data: leads, error: e2 }] = await Promise.all([
    supabase.from('lead_stage_config').select('*').order('sort_order'),
    supabase.from('leads').select('stage_key,budget,name,service,updated_at')
  ]);
  if (e1) return fail(e1);
  if (e2) return fail(e2);

  const byStage = cfg.map(s => {
    const rows = leads.filter(l => l.stage_key === s.stage);
    return {
      ...s,
      count: rows.length,
      value: rows.reduce((a, r) => a + (Number(r.budget) || 0), 0)
    };
  });

  /* stage list */
  const list = $('#stageList');
  if (list) {
    list.innerHTML = byStage
      .filter(s => !['won', 'lost'].includes(s.stage))
      .map(s => `
        <li class="stage-row">
          <span class="stage-row__dot" style="background:${s.color}"></span>
          <span class="stage-row__name">${esc(s.label)}</span>
          <span class="stage-row__count">${s.count}</span>
          <span class="stage-row__val">${s.value ? money(s.value) : '—'}</span>
        </li>`).join('');
  }

  /* weighted forecast doughnut */
  const canvas = $('#stageChart');
  if (canvas && window.Chart) {
    const open = byStage.filter(s => !['won', 'lost'].includes(s.stage) && s.count);
    new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: open.map(s => s.label),
        datasets: [{
          data: open.map(s => s.value),
          borderWidth: 0,
          backgroundColor: open.map(s =>
            getComputedStyle(document.documentElement)
              .getPropertyValue(s.color.replace('var(', '').replace(')', '')).trim() || s.color)
        }]
      },
      options: {
        cutout: '68%',
        plugins: { legend: { display: false } },
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  /* recent activity feed */
  const feed = $('#feed');
  if (feed) {
    const { data: acts } = await supabase
      .from('activities')
      .select('kind,detail,created_at')
      .order('created_at', { ascending: false })
      .limit(8);

    feed.innerHTML = (acts ?? []).length
      ? acts.map(a => `
          <li class="feed__item">
            <span class="feed__txt">${esc(a.detail || a.kind)}</span>
            <span class="feed__time">${daysAgo(a.created_at)} ago</span>
          </li>`).join('')
      : `<li class="feed__item"><span class="feed__txt">No activity recorded yet.</span></li>`;
  }
}

/* ---------- upcoming meetings ---------- */
async function upcoming() {
  const el = $('#meetList');
  if (!el) return;

  const { data, error } = await supabase
    .from('meetings')
    .select('title,scheduled_at,meeting_type,location')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(5);

  if (error) return fail(error);

  el.innerHTML = data.length
    ? data.map(m => {
        const d = new Date(m.scheduled_at);
        return `<li class="meet">
          <span class="meet__date">
            <b>${String(d.getDate()).padStart(2, '0')}</b>
            <span>${d.toLocaleString('en-IN', { month: 'short' }).toUpperCase()}</span>
          </span>
          <span class="meet__body">
            <span class="meet__title">${esc(m.title)}</span>
            <span class="meet__meta">${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · ${esc(m.meeting_type || 'meeting')}${m.location ? ' · ' + esc(m.location) : ''}</span>
          </span>
        </li>`;
      }).join('')
    : `<li class="meet"><span class="meet__body"><span class="meet__title">Nothing scheduled</span><span class="meet__meta">Add a meeting from a lead or client</span></span></li>`;
}

await Promise.all([pipeline(), upcoming()]);


/* ---------------------------------------------------------------
   notification panel
--------------------------------------------------------------- */
async function paintNotifications() {
  const wrap = document.getElementById('notifList') || document.getElementById('notifWrap');
  const { data } = await supabase.from('notifications')
    .select('*').order('created_at', { ascending: false }).limit(10);

  const unread = (data ?? []).filter(n => !n.read_at).length;
  const dot = document.getElementById('bellDot') || document.querySelector('.bell__dot');
  if (dot) dot.hidden = !unread;

  if (!wrap) return;
  wrap.innerHTML = (data ?? []).length
    ? data.map(n => `<li class="nt${n.read_at ? '' : ' is-unread'}">
        <span class="nt__t">${esc(n.title)}</span>
        <span class="nt__w">${daysAgo(n.created_at)} ago</span></li>`).join('')
    : '<li class="nt"><span class="nt__t">Nothing new</span></li>';
}

document.getElementById('markRead')?.addEventListener('click', async () => {
  const { data } = await supabase.from('notifications')
    .select('id').is('read_at', null);
  if (!data?.length) return toast('Nothing unread');
  const { error } = await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', data.map(n => n.id));
  if (error) return fail(error);
  toast('All marked read');
  await paintNotifications();
});

document.getElementById('notifClose')?.addEventListener('click', () => {
  document.getElementById('notifPanel')?.classList.remove('is-open', 'open');
  document.querySelector('.notif-panel')?.classList.remove('is-open', 'open');
});

await paintNotifications();

import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'settings', title: 'Assistant' });
if (!user) throw new Error('redirecting');

const money = v => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e7) return '₹' + (n / 1e7).toFixed(2).replace(/\.00$/, '') + ' Cr';
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(2).replace(/\.00$/, '') + ' L';
  return '₹' + Math.round(n).toLocaleString('en-IN');
};
const lakh = v => '₹' + (Number(v) || 0) + ' L';

/* ---------------------------------------------------------------
   This answers from your own database. It is not a language model.

   An LLM needs an API key, and a key in a browser bundle is a key you
   have published — anyone can read it in devtools and spend your credits.
   Wiring one properly means a Supabase Edge Function holding the secret,
   which the README describes. Until then these are real queries against
   real data rather than a chat box that invents numbers.
--------------------------------------------------------------- */

const SKILLS = [
  {
    id: 'pipeline',
    match: /pipeline|leads?|funnel|enquir/i,
    label: 'What is in my pipeline?',
    async run() {
      const [{ data: leads }, { data: cfg }] = await Promise.all([
        supabase.from('leads').select('name,budget,stage_key,service,area'),
        supabase.from('lead_stage_config').select('*').order('sort_order')
      ]);
      const open = (leads ?? []).filter(l => !['won', 'lost'].includes(l.stage_key));
      if (!open.length) return 'There are no open leads right now.';

      const total = open.reduce((a, l) => a + Number(l.budget || 0), 0);
      const weighted = open.reduce((a, l) => {
        const p = Number((cfg ?? []).find(c => c.stage === l.stage_key)?.probability || 0);
        return a + Number(l.budget || 0) * p;
      }, 0);

      const byStage = (cfg ?? []).filter(c => !['won','lost'].includes(c.stage))
        .map(c => ({ label: c.label, n: open.filter(l => l.stage_key === c.stage).length }))
        .filter(s => s.n);

      return `**${open.length} open leads** worth ${lakh(total)}, weighted to ${lakh(Math.round(weighted))}.\n\n`
        + byStage.map(s => `- ${s.label}: ${s.n}`).join('\n')
        + `\n\nLargest: ${open.sort((a,b)=>Number(b.budget)-Number(a.budget))[0].name} at ${lakh(open[0].budget)}.`;
    }
  },
  {
    id: 'money',
    match: /owe|owed|outstanding|receivab|unpaid|collect/i,
    label: 'Who owes me money?',
    async run() {
      const { data, error } = await supabase.from('receivables_ageing').select('*');
      if (error) return 'I could not read receivables — you may not have finance access.';
      if (!data?.length) return 'Nothing is outstanding. Every invoice raised has been settled.';

      const total = data.reduce((a, r) => a + Number(r.balance || 0), 0);
      const overdue = data.filter(r => r.days_overdue > 0);
      const worst = [...data].sort((a, b) => b.days_overdue - a.days_overdue)[0];

      return `**${money(total)} outstanding** across ${data.length} invoice${data.length>1?'s':''}.\n\n`
        + `- Overdue: ${overdue.length} (${money(overdue.reduce((a,r)=>a+Number(r.balance||0),0))})\n`
        + `- Oldest: ${worst.invoice_no}, ${worst.days_overdue} days past due\n\n`
        + `Open Finance to chase them.`;
    }
  },
  {
    id: 'margin',
    match: /margin|profit|p&l|pnl|cost|losing/i,
    label: 'Which projects are losing money?',
    async run() {
      const { data, error } = await supabase.from('project_financials').select('*');
      if (error) return 'I could not read project financials.';
      const live = (data ?? []).filter(r => Number(r.billed) > 0 || Number(r.cost) > 0);
      if (!live.length) return 'No project has been billed or costed yet, so there is no margin to report.';

      const thin = live.filter(r => r.gross_margin_pct !== null && r.gross_margin_pct < 15);
      const best = [...live].sort((a,b) => (b.gross_margin_pct ?? -999) - (a.gross_margin_pct ?? -999))[0];

      return (thin.length
          ? `**${thin.length} project${thin.length>1?'s':''} under 15% gross margin:**\n\n`
            + thin.map(t => `- ${t.code} ${t.name}: ${t.gross_margin_pct}% (${money(t.gross_margin)})`).join('\n')
          : 'Every billed project is above 15% gross margin.')
        + `\n\nBest performer: ${best.code} at ${best.gross_margin_pct ?? '—'}%.`;
    }
  },
  {
    id: 'today',
    match: /today|due|overdue|task|deadline|this week/i,
    label: 'What needs attention today?',
    async run() {
      const today = new Date().toISOString().slice(0, 10);
      const week  = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

      const [tasks, acts, meets] = await Promise.all([
        supabase.from('tasks').select('title,due_date,board_column')
          .lte('due_date', week).neq('board_column','done').order('due_date'),
        supabase.from('action_items').select('title,due_date').eq('done', false).lte('due_date', week),
        supabase.from('meetings').select('title,scheduled_at')
          .gte('scheduled_at', today).lte('scheduled_at', week + 'T23:59:59').order('scheduled_at')
      ]);

      const overdue = (tasks.data ?? []).filter(t => t.due_date < today);
      const lines = [];
      if (overdue.length) lines.push(`**${overdue.length} overdue task${overdue.length>1?'s':''}:**\n` + overdue.slice(0,5).map(t => `- ${t.title} (${t.due_date})`).join('\n'));
      if ((meets.data ?? []).length) lines.push(`**${meets.data.length} meeting${meets.data.length>1?'s':''} this week:**\n` + meets.data.slice(0,5).map(m => `- ${m.title}`).join('\n'));
      if ((acts.data ?? []).length) lines.push(`**${acts.data.length} open action item${acts.data.length>1?'s':''}**`);

      return lines.length ? lines.join('\n\n') : 'Nothing is overdue and nothing is scheduled this week.';
    }
  },
  {
    id: 'stock',
    match: /stock|inventory|material|reorder|running out/i,
    label: 'What is running low in stock?',
    async run() {
      const { data, error } = await supabase.from('stock_balances').select('*');
      if (error) return 'I could not read stock balances.';
      const low = (data ?? []).filter(b => b.stock_status !== 'ok');
      if (!low.length) return (data ?? []).length
        ? 'Everything is above its reorder level.'
        : 'No materials are set up yet. Run the seed catalogue from supabase/seed.';
      return `**${low.length} item${low.length>1?'s':''} at or below reorder level:**\n\n`
        + low.slice(0, 10).map(b => `- ${b.name} at ${b.store_name}: ${b.qty} ${b.unit} (reorder at ${b.reorder_level})`).join('\n');
    }
  },
  {
    id: 'team',
    match: /team|who is|attendance|present|leave|staff|employee/i,
    label: 'Who is in today?',
    async run() {
      const today = new Date().toISOString().slice(0, 10);
      const [emp, att, lv] = await Promise.all([
        supabase.from('employees').select('id, profiles(full_name)').eq('status','active'),
        supabase.from('attendance').select('employee_id,status').eq('on_date', today),
        supabase.from('leave_requests').select('employee_id').eq('status','approved')
          .lte('from_date', today).gte('to_date', today)
      ]);
      const team = emp.data ?? [];
      if (!team.length) return 'No employee records yet.';
      const present = (att.data ?? []).filter(a => ['present','wfh','half_day'].includes(a.status));
      const onLeave = lv.data ?? [];
      const unmarked = team.length - (att.data ?? []).length;

      return `**${present.length} of ${team.length} in today.**\n\n`
        + `- On leave: ${onLeave.length}\n`
        + `- Not yet marked: ${unmarked}\n\n`
        + (unmarked ? 'Open Attendance to mark the register.' : 'The register is complete.');
    }
  }
];

/* ---------------------------------------------------------------
   conversation
--------------------------------------------------------------- */
let convId = null;

function bubble(role, text) {
  const t = $('#thread');
  if (!t) return;
  const html = esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
  t.insertAdjacentHTML('beforeend',
    `<li class="bub bub--${role}"><span class="bub__b">${html}</span></li>`);
  t.scrollTop = t.scrollHeight;
  $('#welcome')?.setAttribute('hidden', '');
}

async function ensureConv() {
  if (convId) return convId;
  const { data, error } = await supabase.from('ai_conversations')
    .insert({ user_id: user.id, title: 'Conversation' }).select('id').single();
  if (error) { fail(error); return null; }
  convId = data.id;
  return convId;
}

async function ask(text) {
  bubble('user', text);
  const id = await ensureConv();
  if (id) await supabase.from('ai_messages').insert({ conversation_id: id, role: 'user', content: text });

  const skill = SKILLS.find(s => s.match.test(text));
  let answer;
  try {
    answer = skill
      ? await skill.run()
      : `I can answer these from your data:\n\n${SKILLS.map(s => `- ${s.label}`).join('\n')}\n\n`
        + `I am not a language model — I run real queries against your ERP rather than guessing. `
        + `Connecting a language model needs a Supabase Edge Function to hold the API key; the README explains why.`;
  } catch (err) {
    answer = 'Something went wrong running that query: ' + (err?.message || err);
  }

  bubble('assistant', answer);
  if (id) await supabase.from('ai_messages').insert({ conversation_id: id, role: 'assistant', content: answer });
}

/* suggestion chips */
const chips = $('#chips');
if (chips) {
  chips.innerHTML = SKILLS.map(s => `<button class="chip" data-ask="${esc(s.label)}">${esc(s.label)}</button>`).join('');
}

document.addEventListener('click', e => {
  const c = e.target.closest('[data-ask]');
  if (c) ask(c.dataset.ask);
});

function send() {
  const box = $('#input') || $('#threadIn');
  const text = (box?.value || '').trim();
  if (!text) return;
  box.value = '';
  ask(text);
}

$('#send')?.addEventListener('click', send);
($('#input') || $('#threadIn'))?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

/* newChat sits in the prototype topbar, which the shell replaces. Put it back
   next to the composer so the control is not simply lost. */
if (!document.getElementById('newChat')) {
  const composer = $('#send')?.parentElement || $('#chips')?.parentElement;
  composer?.insertAdjacentHTML('beforebegin',
    '<button class="btn btn--sm" id="newChat" style="margin:0 0 8px">New chat</button>');
}

$('#newChat')?.addEventListener('click', () => {
  convId = null;
  const t = $('#thread');
  if (t) t.innerHTML = '';
  $('#welcome')?.removeAttribute('hidden');
});

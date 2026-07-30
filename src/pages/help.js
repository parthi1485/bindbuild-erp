import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { esc } from '../lib/ui.js';
const $ = (s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user = await mountShell({ route: 'settings', title: 'Help centre' });
if (!user) throw new Error('redirecting');

let FAQ = [], q = '';

async function load() {
  const { data } = await supabase.from('faq_items')
    .select('*').eq('status','published').order('sort_order');
  FAQ = data ?? [];
  render();
}

function render() {
  const rows = FAQ.filter(f => !q ||
    (f.question + ' ' + f.answer + ' ' + f.category).toLowerCase().includes(q));

  const el = $('#faqList');
  if (el) el.innerHTML = rows.map(f => `
    <details class="fq">
      <summary class="fq__q">${esc(f.question)}<span class="fq__cat">${esc(f.category)}</span></summary>
      <div class="fq__a">${esc(f.answer)}</div>
    </details>`).join('');

  const none = $('#noResult');
  if (none) none.hidden = rows.length > 0;
  if (none && !FAQ.length) {
    none.hidden = false;
    none.textContent = 'No help articles yet. An admin can add them to faq_items.';
  }
}

$('#faqSearch')?.addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });

await load();

import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, initials } from '../lib/ui.js';
const $ = (s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user = await mountShell({ route: 'meetings', title: 'Meetings' });
if (!user) throw new Error('redirecting');

let MTG = [], ACTS = [], sel = null;

async function load() {
  const [m, a] = await Promise.all([
    supabase.from('meetings').select('*, clients(name)').order('scheduled_at', { ascending: false }).limit(60),
    supabase.from('action_items').select('*, owner:owner_id(full_name)').eq('done', false).order('due_date')
  ]);
  if (m.error) return fail(m.error);
  MTG = m.data ?? []; ACTS = a.data ?? [];
  if (!sel && MTG.length) sel = MTG[0].id;
  render();
  if (sel) await paintDetail(sel);
}

function render() {
  const upcoming = MTG.filter(m => new Date(m.scheduled_at) >= new Date());
  const el = $('#mlist');
  if (el) {
    el.innerHTML = MTG.length ? MTG.map(m => {
      const d = new Date(m.scheduled_at);
      return `<li class="mi${sel===m.id?' is-sel':''}" data-id="${m.id}">
        <span class="mi__date"><b>${String(d.getDate()).padStart(2,'0')}</b>
          <span>${d.toLocaleString('en-IN',{month:'short'}).toUpperCase()}</span></span>
        <span class="mi__body"><span class="mi__nm">${esc(m.title)}</span>
          <span class="mi__meta">${d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})} · ${esc(m.meeting_type||'meeting')}${
            m.clients ? ' · ' + esc(m.clients.name) : ''}</span></span>
        ${m.done ? '<span class="mi__done">done</span>' : ''}
      </li>`;
    }).join('')
    : '<li class="mi"><span class="mi__body"><span class="mi__nm">No meetings yet</span></span></li>';
  }

  const set=(id,v)=>{const x=document.getElementById(id); if(x)x.textContent=v;};
  set('mCount', String(upcoming.length));
  set('kOpen', String(ACTS.length));
  set('oaCount', String(ACTS.length));

  const oa = $('#oa');
  if (oa) {
    oa.innerHTML = ACTS.length
      ? ACTS.map(a => `<li class="oai" data-act="${a.id}">
          <button class="oai__box" data-done="${a.id}" aria-label="Mark done"></button>
          <span class="oai__body"><span class="oai__nm">${esc(a.title)}</span>
          <span class="oai__meta">${esc(a.owner?.full_name || 'unassigned')}${a.due_date ? ' · due ' + fmtDate(a.due_date) : ''}</span></span>
        </li>`).join('')
      : '<li class="oai"><span class="oai__body"><span class="oai__nm">No open actions</span></span></li>';
  }

  const wk = $('#wk');
  if (wk) {
    const days = [];
    for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate()+i); days.push(d); }
    wk.innerHTML = days.map(d => {
      const k = d.toISOString().slice(0,10);
      const n = MTG.filter(m => (m.scheduled_at||'').slice(0,10) === k).length;
      return `<div class="wd"><span class="wd__d">${d.toLocaleString('en-IN',{weekday:'short'})}</span>
        <span class="wd__n${n?' has':''}">${n||''}</span></div>`;
    }).join('');
  }
}

async function paintDetail(id) {
  const m = MTG.find(x => x.id === id);
  const el = $('#detail');
  if (!m || !el) return;

  const [notes, att] = await Promise.all([
    supabase.from('meeting_notes').select('*').eq('meeting_id', id).order('sort_order'),
    supabase.from('meeting_attendees').select('*, profiles(full_name)').eq('meeting_id', id)
  ]);

  const d = new Date(m.scheduled_at);
  el.innerHTML = `
    <h2 class="dt__t">${esc(m.title)}</h2>
    <p class="dt__meta">${fmtDate(m.scheduled_at)} · ${d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})} · ${esc(m.meeting_type||'meeting')}${m.location ? ' · ' + esc(m.location) : ''}</p>
    <div class="dt__people">${(att.data ?? []).map(a =>
      `<span class="dt__av" title="${esc(a.profiles?.full_name || a.name || '')}">${esc(initials(a.profiles?.full_name || a.name || '?'))}</span>`).join('')
      || '<span class="dt__none">No attendees recorded</span>'}</div>
    ${['agenda','minutes','decision'].map(kind => {
      const rows = (notes.data ?? []).filter(n => n.kind === kind);
      if (!rows.length) return '';
      return `<section class="dt__sec"><h3>${kind[0].toUpperCase()+kind.slice(1)}</h3>
        <ul>${rows.map(n => `<li>${esc(n.body)}</li>`).join('')}</ul></section>`;
    }).join('')}
    <div class="dt__acts">
      <button class="btn" id="addNote">Add minute</button>
      <button class="btn" id="addAct">Add action item</button>
    </div>`;
}

document.addEventListener('click', async e => {
  const mi = e.target.closest('.mi[data-id]');
  if (mi) { sel = mi.dataset.id; render(); return paintDetail(sel); }

  const dn = e.target.closest('[data-done]');
  if (dn) {
    const { error } = await supabase.from('action_items')
      .update({ done: true, done_at: new Date().toISOString() }).eq('id', dn.dataset.done);
    if (error) return fail(error);
    toast('Action closed'); return load();
  }

  if (e.target.id === 'addNote' && sel) {
    const body = prompt('Minute / note'); if (!body) return;
    const { error } = await supabase.from('meeting_notes')
      .insert({ meeting_id: sel, kind: 'minutes', body, created_by: user.id });
    if (error) return fail(error);
    toast('Saved'); return paintDetail(sel);
  }

  if (e.target.id === 'addAct' && sel) {
    const title = prompt('Action item'); if (!title) return;
    const due = prompt('Due date (YYYY-MM-DD)', new Date(Date.now()+7*864e5).toISOString().slice(0,10));
    const { error } = await supabase.from('action_items')
      .insert({ meeting_id: sel, title, due_date: due || null, owner_id: user.id, created_by: user.id });
    if (error) return fail(error);
    toast('Action added'); return load();
  }
});

$('#scheduleBtn')?.addEventListener('click', async () => {
  const title = prompt('Meeting title'); if (!title) return;
  const when = prompt('When? (YYYY-MM-DD HH:MM)', new Date().toISOString().slice(0,16).replace('T',' '));
  if (!when) return;
  const at = new Date(when.replace(' ','T'));
  if (isNaN(at)) return toast('Could not read that date','err');
  const { error } = await supabase.from('meetings')
    .insert({ title, scheduled_at: at.toISOString(), created_by: user.id });
  if (error) return fail(error);
  toast('Scheduled'); await load();
});

await load();

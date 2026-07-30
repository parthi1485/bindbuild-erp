import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate } from '../lib/ui.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route: 'crm', title: 'Lead details' });
if (!user) throw new Error('redirecting');

const leadId = new URLSearchParams(location.search).get('id');
if (!leadId) {
  toast('No lead selected', 'err');
  setTimeout(() => location.replace('/crm.html'), 1200);
  throw new Error('no id');
}

const money = l => l >= 100
  ? '₹' + (l / 100).toFixed(2).replace(/\.00$/, '') + ' Cr'
  : '₹' + l + ' L';

let LEAD = null, STAGES = [];

/** Fill a .kv row by its visible key label. */
function setKv(label, value) {
  const row = $$('.kv').find(r => $('.kv__k', r)?.textContent.trim().toLowerCase() === label.toLowerCase());
  if (row) $('.kv__v', row).textContent = value || '—';
}

/* ---------------------------------------------------------------
   load
--------------------------------------------------------------- */
async function load() {
  const [leadRes, stageRes] = await Promise.all([
    supabase.from('leads').select('*').eq('id', leadId).maybeSingle(),
    supabase.from('lead_stage_config').select('*').order('sort_order')
  ]);

  if (leadRes.error) return fail(leadRes.error);
  if (!leadRes.data) {
    toast('Lead not found', 'err');
    return setTimeout(() => location.replace('/crm.html'), 1200);
  }

  LEAD   = leadRes.data;
  STAGES = stageRes.data ?? [];

  paintHeader();
  paintStage();
  await Promise.all([paintTimeline(), paintNotes(), paintMeetings(), paintFiles()]);
}

function paintHeader() {
  const av = $('.lead-avatar');
  if (av) av.textContent = initials(LEAD.name);

  const nm = $('.lead-head__name');
  if (nm) nm.textContent = LEAD.name;

  const sub = $('.lead-head__sub');
  if (sub) {
    const bits = [LEAD.service, LEAD.sqft ? `${Number(LEAD.sqft).toLocaleString('en-IN')} sq ft` : null, LEAD.area]
      .filter(Boolean).join(' · ');
    sub.textContent = `${bits} · Lead since ${fmtDate(LEAD.created_at)}`;
  }

  setKv('Phone',   LEAD.phone ? `+91 ${LEAD.phone}` : '—');
  setKv('Email',   LEAD.email);
  setKv('Site',    LEAD.area);
  setKv('Budget',  LEAD.budget ? money(Number(LEAD.budget)) : 'Not discussed');
  setKv('Scope',   LEAD.service);
  setKv('Plot',    LEAD.sqft ? `${Number(LEAD.sqft).toLocaleString('en-IN')} sq ft` : '—');
  setKv('Source',  LEAD.source);
  setKv('Owner',   user.name);

  document.title = `${LEAD.name} · Bind Build ERP`;
  const here = $('.crumbs .here');
  if (here) here.textContent = LEAD.name;
}

function paintStage() {
  const cfg = STAGES.find(s => s.stage === LEAD.stage_key);

  const chip = $('#stageChip');
  if (chip && cfg) {
    chip.textContent = cfg.label;
    chip.style.color = cfg.color;
  }

  const fill = $('#probFill');
  if (fill && cfg) {
    const pct = Math.round(Number(cfg.probability) * 100);
    fill.style.width = pct + '%';
    fill.setAttribute('aria-valuenow', String(pct));
    const lbl = fill.closest('[data-prob]')?.querySelector('.prob__pct')
             || fill.parentElement?.querySelector('.prob__pct');
    if (lbl) lbl.textContent = pct + '%';
  }

  /* stepper: mark every stage up to the current one as done */
  const stepper = $('#stepper');
  if (stepper) {
    const order = STAGES.filter(s => !['won', 'lost'].includes(s.stage));
    const idx = order.findIndex(s => s.stage === LEAD.stage_key);
    stepper.innerHTML = order.map((s, i) => `
      <li class="step ${i < idx ? 'is-done' : i === idx ? 'is-now' : ''}" data-stage="${s.stage}">
        <span class="step__dot"></span>
        <span class="step__label">${esc(s.label)}</span>
      </li>`).join('');
  }
}

/* ---------------------------------------------------------------
   timeline — activities grouped by day
--------------------------------------------------------------- */
const TL_ICON = {
  call:'call', whatsapp:'wa', wa:'wa', email:'email',
  note:'note', stage:'stage', stage_change:'stage', proposal:'email', meeting:'call'
};

async function paintTimeline() {
  const { data, error } = await supabase
    .from('activities')
    .select('kind,detail,created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) return fail(error);

  const el = $('#timeline');
  const n  = $('#nTimeline');
  if (n) n.textContent = data.length;
  if (!el) return;

  if (!data.length) {
    el.innerHTML = `<li class="tl-empty">No activity logged yet. Use the box below to record a call, message or note.</li>`;
    return;
  }

  const groups = new Map();
  for (const a of data) {
    const key = fmtDate(a.created_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }

  el.innerHTML = [...groups].map(([day, items]) => `
    <li class="tl-day">
      <div class="tl-day__label">${esc(day)}</div>
      <ul class="tl-items">
        ${items.map(a => `
          <li class="tl-item tl-item--${TL_ICON[a.kind] || 'note'}">
            <span class="tl-item__txt">${esc(a.detail || a.kind)}</span>
            <span class="tl-item__time">${new Date(a.created_at)
              .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
          </li>`).join('')}
      </ul>
    </li>`).join('');
}

/* ---------------------------------------------------------------
   notes
--------------------------------------------------------------- */
async function paintNotes() {
  const { data, error } = await supabase
    .from('lead_notes')
    .select('id,body,pinned,created_at,created_by')
    .eq('lead_id', leadId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return fail(error);

  const el = $('#noteList');
  const n  = $('#nNotes');
  if (n) n.textContent = data.length;
  if (!el) return;

  el.innerHTML = data.length
    ? data.map(nt => `
        <li class="note ${nt.pinned ? 'is-pinned' : ''}" data-id="${nt.id}">
          <p class="note__txt">${esc(nt.body)}</p>
          <p class="note__meta">${esc(user.name)} · ${fmtDate(nt.created_at)}</p>
          <button class="note__pin" data-pin="${nt.id}" data-on="${nt.pinned}"
                  aria-label="${nt.pinned ? 'Unpin note' : 'Pin note'}">${nt.pinned ? '★' : '☆'}</button>
        </li>`).join('')
    : `<li class="note"><p class="note__txt">No notes yet.</p></li>`;
}

/* ---------------------------------------------------------------
   meetings
--------------------------------------------------------------- */
async function paintMeetings() {
  const { data, error } = await supabase
    .from('meetings')
    .select('id,title,meeting_type,scheduled_at,duration_min,done')
    .eq('lead_id', leadId)
    .order('scheduled_at', { ascending: false });

  if (error) return fail(error);

  const el = $('#meetList');
  const n  = $('#nMeet');
  if (n) n.textContent = data.length;
  if (!el) return;

  el.innerHTML = data.length
    ? data.map(m => {
        const d = new Date(m.scheduled_at);
        return `<li class="mt ${m.done ? 'is-done' : ''}" data-id="${m.id}">
          <span class="mt__date"><b>${String(d.getDate()).padStart(2,'0')}</b>
            <span>${d.toLocaleString('en-IN',{month:'short'}).toUpperCase()}</span></span>
          <span class="mt__body">
            <span class="mt__title">${esc(m.title)}</span>
            <span class="mt__meta">${d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})} · ${esc(m.meeting_type||'meeting')}${m.duration_min ? ' · ' + m.duration_min + 'm' : ''}</span>
          </span>
        </li>`;
      }).join('')
    : `<li class="mt"><span class="mt__body"><span class="mt__title">Nothing scheduled</span></span></li>`;
}

/* ---------------------------------------------------------------
   files
--------------------------------------------------------------- */
const extKind = n => {
  const e = (n.split('.').pop() || '').toLowerCase();
  if (e === 'pdf') return 'pdf';
  if (['png','jpg','jpeg','webp','gif','zip'].includes(e)) return 'img';
  if (['dwg','dxf'].includes(e)) return 'dwg';
  return 'doc';
};

async function paintFiles() {
  const { data, error } = await supabase
    .from('lead_files')
    .select('id,file_name,storage_path,size_bytes,kind,created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) return fail(error);

  const el = $('#fileList');
  const n  = $('#nFiles');
  if (n) n.textContent = data.length;
  if (!el) return;

  el.innerHTML = data.length
    ? data.map(f => `
        <li class="file file--${esc(f.kind || extKind(f.file_name))}" data-path="${esc(f.storage_path)}">
          <span class="file__name">${esc(f.file_name)}</span>
          <span class="file__meta">${(Number(f.size_bytes || 0) / 1048576).toFixed(1)} MB · ${fmtDate(f.created_at)}</span>
        </li>`).join('')
    : `<li class="file"><span class="file__name">No files uploaded</span></li>`;
}

/* ---------------------------------------------------------------
   actions
--------------------------------------------------------------- */
async function logActivity(kind, detail) {
  const { error } = await supabase.from('activities')
    .insert({ lead_id: leadId, user_id: user.id, kind, detail });
  if (error) return fail(error);
  await supabase.from('leads')
    .update({ last_contact_at: new Date().toISOString() }).eq('id', leadId);
  await paintTimeline();
}

async function setStage(stage) {
  const { error } = await supabase.from('leads')
    .update({ stage_key: stage, last_contact_at: new Date().toISOString() })
    .eq('id', leadId);
  if (error) return fail(error);

  LEAD.stage_key = stage;
  paintStage();
  const label = STAGES.find(s => s.stage === stage)?.label || stage;
  toast(`Moved to ${label}`);
  await logActivity('stage_change', `Stage changed to ${label}`);
}

$('#btnWon') ?.addEventListener('click', () => setStage('won'));
$('#btnLost')?.addEventListener('click', async () => {
  const why = prompt('Why was this lead lost?');
  if (why === null) return;
  await supabase.from('leads').update({ lost_reason: why }).eq('id', leadId);
  await setStage('lost');
});

$('#logBtn')?.addEventListener('click', async () => {
  const box = $('#logText');
  const txt = (box?.value || '').trim();
  if (!txt) return toast('Write something to log first', 'err');
  await logActivity('note', txt);
  box.value = '';
  toast('Activity logged');
});

$('#noteBtn')?.addEventListener('click', async () => {
  const box = $('#noteText');
  const txt = (box?.value || '').trim();
  if (!txt) return toast('Write a note first', 'err');
  const { error } = await supabase.from('lead_notes')
    .insert({ lead_id: leadId, body: txt, created_by: user.id });
  if (error) return fail(error);
  box.value = '';
  toast('Note saved');
  await paintNotes();
});

document.addEventListener('click', async e => {
  const pin = e.target.closest('[data-pin]');
  if (!pin) return;
  const on = pin.dataset.on === 'true';
  const { error } = await supabase.from('lead_notes')
    .update({ pinned: !on }).eq('id', pin.dataset.pin);
  if (error) return fail(error);
  await paintNotes();
});

$('#schedBtn')?.addEventListener('click', async () => {
  const title = prompt('Meeting title');
  if (!title) return;
  const when = prompt('When? (YYYY-MM-DD HH:MM)', new Date().toISOString().slice(0, 16).replace('T', ' '));
  if (!when) return;
  const at = new Date(when.replace(' ', 'T'));
  if (isNaN(at)) return toast('Could not read that date', 'err');

  const { error } = await supabase.from('meetings').insert({
    lead_id: leadId, title, scheduled_at: at.toISOString(), created_by: user.id
  });
  if (error) return fail(error);
  toast('Meeting scheduled');
  await paintMeetings();
});

$('#remindBtn')?.addEventListener('click', async () => {
  const when = prompt('Follow up on? (YYYY-MM-DD)', new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  if (!when) return;
  const { error } = await supabase.from('leads').update({ next_follow_up: when }).eq('id', leadId);
  if (error) return fail(error);
  toast(`Reminder set for ${fmtDate(when)}`);
});

/* ---- file upload ---- */
async function upload(files) {
  for (const file of files) {
    const path = `${leadId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    const up = await supabase.storage.from('lead-files').upload(path, file);
    if (up.error) { fail(up.error); continue; }

    const { error } = await supabase.from('lead_files').insert({
      lead_id: leadId, file_name: file.name, storage_path: path,
      kind: extKind(file.name), mime_type: file.type, size_bytes: file.size,
      uploaded_by: user.id
    });
    if (error) fail(error);
  }
  toast('Upload complete');
  await paintFiles();
}

$('#fileInput')?.addEventListener('change', e => e.target.files.length && upload(e.target.files));
const dz = $('#dropzone');
dz?.addEventListener('click', () => $('#fileInput')?.click());
dz?.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('is-over'); });
dz?.addEventListener('dragleave', () => dz.classList.remove('is-over'));
dz?.addEventListener('drop', e => {
  e.preventDefault();
  dz.classList.remove('is-over');
  if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
});

/* open a stored file in a new tab via a signed URL */
document.addEventListener('click', async e => {
  const f = e.target.closest('.file[data-path]');
  if (!f) return;
  const { data, error } = await supabase.storage
    .from('lead-files').createSignedUrl(f.dataset.path, 60);
  if (error) return fail(error);
  window.open(data.signedUrl, '_blank');
});

/* tabs */
$$('.tab[data-tab]').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x => { x.classList.remove('is-on'); x.setAttribute('aria-selected', 'false'); });
  t.classList.add('is-on'); t.setAttribute('aria-selected', 'true');
  $$('[data-panel]').forEach(p => p.classList.toggle('is-on', p.dataset.panel === t.dataset.tab));
}));

await load();

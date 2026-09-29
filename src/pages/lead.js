import { supabase } from '../lib/supabase.js';
import { mountShell, activeUnit } from '../lib/shell.js';
import { toast, fail, esc, initials, fmtDate, openModal, closeAllModals, wireModalDismiss, val, setVal } from '../lib/ui.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const user = await mountShell({ route:'crm', title:'Lead details' });
if (!user) throw new Error('redirecting');

const leadId = new URLSearchParams(location.search).get('id');
if (!leadId) {
  location.replace('/crm.html');
  throw new Error('no lead id');
}

const STAGES = [
  { id:'new', name:'New', probability:0.10 },
  { id:'contacted', name:'Contacted', probability:0.20 },
  { id:'meeting', name:'Site / Office Meet', probability:0.35 },
  { id:'proposal', name:'Proposal', probability:0.55 },
  { id:'follow_up', name:'Follow-up', probability:0.70 },
  { id:'won', name:'Won', probability:1 },
  { id:'lost', name:'Lost', probability:0 }
];

let LEAD = null;

const money = v => {
  const n = Number(v || 0);
  if (n >= 1e7) return '₹' + (n/1e7).toFixed(2).replace(/\.00$/,'') + ' Cr';
  if (n >= 1e5) return '₹' + (n/1e5).toFixed(1).replace(/\.0$/,'') + ' L';
  return '₹' + Math.round(n).toLocaleString('en-IN');
};

function setKv(label, value) {
  const row = $$('.kv').find(r => $('.kv__k',r)?.textContent.trim().toLowerCase() === label.toLowerCase());
  if (row) {
    const out = $('.kv__v',row);
    if (out) out.textContent = value || '—';
  }
}

function stageLabel(stage) {
  return STAGES.find(s=>s.id===stage)?.name || stage || 'New';
}

async function load() {
  const { data, error } = await supabase.from('leads').select('*').eq('id',leadId).is('deleted_at',null).maybeSingle();
  if (error) return fail(error);
  if (!data) {
    toast('Lead not found','err');
    setTimeout(()=>location.replace('/crm.html'),800);
    return;
  }
  LEAD=data;
  paintHeader();
  paintStage();
  paintCorePanels();
  await paintCommercials();
}

function paintHeader() {
  if ($('.lead-avatar')) $('.lead-avatar').textContent = initials(LEAD.name);
  if ($('.lead-head__name')) $('.lead-head__name').textContent = LEAD.name;

  const sub = $('.lead-head__sub');
  if (sub) sub.textContent = [LEAD.lead_no, LEAD.service, LEAD.area || LEAD.city, 'Lead since ' + fmtDate(LEAD.created_at)].filter(Boolean).join(' · ');

  setKv('Phone', LEAD.phone ? '+91 ' + LEAD.phone : '—');
  setKv('Email', LEAD.email || '—');
  setKv('Site', LEAD.area || LEAD.city || '—');
  setKv('Budget', LEAD.expected_value ? money(LEAD.expected_value) : 'Not discussed');
  setKv('Scope', LEAD.service || '—');
  setKv('Plot', '—');
  setKv('Source', LEAD.source || '—');
  setKv('Owner', user.name);
  setKv('Built-up', 'Not captured');
  setKv('Start', 'Not scheduled');

  document.title = `${LEAD.lead_no || 'Lead'} · ${LEAD.name} · Bind Builds ERP`;
  const here=$('.crumbs .here');
  if (here) here.textContent = LEAD.lead_no || LEAD.name;
}

function paintStage() {
  const cfg = STAGES.find(s=>s.id===LEAD.stage) || STAGES[0];
  const chip=$('#stageChip');
  if (chip) chip.textContent = cfg.name;

  const fill=$('#probFill');
  if (fill) {
    const pct=Math.round(cfg.probability*100);
    fill.style.width=pct+'%';
    fill.setAttribute('aria-valuenow',String(pct));
    const lbl=fill.closest('[data-prob]')?.querySelector('.prob__pct') || fill.parentElement?.querySelector('.prob__pct');
    if (lbl) lbl.textContent=pct+'%';
    const railPct = $('.deal-prob__row b');
    if (railPct) railPct.textContent = pct + '%';
  }

  const stepper=$('#stepper');
  if (stepper) {
    const order=STAGES.filter(s=>!['won','lost'].includes(s.id));
    const idx=order.findIndex(s=>s.id===LEAD.stage);
    stepper.innerHTML=order.map((s,i)=>`<li class="step ${i<idx?'is-done':i===idx?'is-now':''}" data-stage="${s.id}">
      <span class="step__dot"></span><span class="step__label">${esc(s.name)}</span>
    </li>`).join('');
  }
}

function paintCorePanels() {
  const timeline=$('#timeline');
  if (timeline) timeline.innerHTML = `
    <li class="tl-day"><div class="tl-day__label">LIVE ERP RECORD</div>
      <ul class="tl-items">
        <li class="tl-item tl-item--stage"><span class="tl-item__txt">Current stage: ${esc(stageLabel(LEAD.stage))}</span><span class="tl-item__time">${fmtDate(LEAD.updated_at)}</span></li>
        <li class="tl-item tl-item--note"><span class="tl-item__txt">Lead ${esc(LEAD.lead_no || '')} created</span><span class="tl-item__time">${fmtDate(LEAD.created_at)}</span></li>
      </ul>
    </li>`;
  if ($('#nTimeline')) $('#nTimeline').textContent='2';

  const notes=$('#noteList');
  if (notes) notes.innerHTML = LEAD.notes
    ? `<li class="note"><p class="note__txt">${esc(LEAD.notes).replaceAll('\n','<br>')}</p><p class="note__meta">Lead notes · ${fmtDate(LEAD.updated_at)}</p></li>`
    : '<li class="note"><p class="note__txt">No notes yet.</p></li>';
  if ($('#nNotes')) $('#nNotes').textContent = LEAD.notes ? '1' : '0';

  const meetings=$('#meetList');
  if (meetings) meetings.innerHTML='<li class="mt"><span class="mt__body"><span class="mt__title">Calendar module will be connected in the next migration stage</span></span></li>';
  if ($('#nMeet')) $('#nMeet').textContent='0';

  const files=$('#fileList');
  if (files) files.innerHTML='<li class="file"><span class="file__name">Project file storage will be connected after Sales → Project conversion.</span></li>';
  if ($('#nFiles')) $('#nFiles').textContent='0';
}

async function paintCommercials() {
  const [estRes, propRes, taskRes] = await Promise.all([
    supabase.from('estimates')
      .select('id,estimate_no,title,status,total,created_at')
      .eq('lead_id', leadId).is('deleted_at', null)
      .order('created_at', { ascending:false }).limit(1),
    supabase.from('proposals')
      .select('id,proposal_no,title,status,grand_total,sent_at,accepted_at,created_at')
      .eq('lead_id', leadId).is('deleted_at', null)
      .order('created_at', { ascending:false }).limit(1),
    supabase.from('tasks')
      .select('id,title,due_at,status')
      .ilike('title', '%'+(LEAD.lead_no || LEAD.name)+'%')
      .not('status','in','("done","cancelled")')
      .order('due_at',{ascending:true}).limit(1)
  ]);

  if (estRes.error) fail(estRes.error);
  if (propRes.error) fail(propRes.error);

  const estimate = estRes.data?.[0] || null;
  const proposal = propRes.data?.[0] || null;

  const propCard = $('.card.prop');
  if (propCard) {
    const doc = proposal || estimate;
    const kind = proposal ? 'Proposal' : estimate ? 'Estimate' : 'Commercials';
    propCard.innerHTML = doc ? `
      <h2 class="rail__title">${kind} status</h2>
      <div class="prop__ver"><span class="prop__badge">${esc(proposal?.proposal_no || estimate?.estimate_no || 'DRAFT')}</span></div>
      <p class="prop__val">${money(proposal?.grand_total ?? estimate?.total ?? 0)}</p>
      <p class="prop__meta">${esc(doc.status || 'draft')}${proposal?.sent_at ? ' · sent ' + fmtDate(proposal.sent_at) : ''}${proposal?.accepted_at ? ' · accepted ' + fmtDate(proposal.accepted_at) : ''}</p>
      <div class="prop__acts">
        <button class="act-btn" id="openCommercialBtn">Open ${kind.toLowerCase()}</button>
        <button class="act-btn" id="remindBtn">Remind</button>
      </div>`
      : `
      <h2 class="rail__title">Commercials</h2>
      <p class="prop__meta">No estimate or proposal created yet.</p>
      <div class="prop__acts"><button class="act-btn" id="railEstimateBtn">Create estimate</button></div>`;

    $('#openCommercialBtn')?.addEventListener('click', () => {
      location.href = proposal ? '/proposal.html?id='+proposal.id : '/estimate.html?id='+estimate.id;
    });
    $('#railEstimateBtn')?.addEventListener('click', () => location.href='/estimate.html?lead='+leadId);
  }

  const next = $('.card.next');
  if (next) {
    const task = taskRes.data?.[0];
    next.innerHTML = task ? `
      <h2 class="rail__title">Next action</h2>
      <p class="next__due">${task.due_at ? fmtDate(task.due_at) : 'No due date'}</p>
      <p class="next__txt">${esc(task.title)}</p>`
      : `
      <h2 class="rail__title">Next action</h2>
      <p class="next__txt">No open follow-up task. Use Remind to create one.</p>`;
  }

  const tags = $('#tags');
  if (tags) {
    const found = [...String(LEAD.notes || '').matchAll(/#([\w-]+)/g)].map(m => m[1]);
    tags.innerHTML = [...new Set(found)].map(t => `<span class="tag">${esc(t)}</span>`).join('')
      + '<button class="tag tag--add" id="addTag">＋ Add tag</button>';
  }
}

async function setStage(stage) {
  const { error } = await supabase.from('leads').update({stage}).eq('id',leadId);
  if (error) return fail(error);
  LEAD.stage=stage;
  LEAD.updated_at=new Date().toISOString();
  paintStage();
  paintCorePanels();
  toast(`Moved to ${stageLabel(stage)}`);
}

async function appendNote(text) {
  const clean=String(text||'').trim();
  if (!clean) return;
  const stamp=new Date().toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
  const next=[LEAD.notes, `[${stamp}] ${clean}`].filter(Boolean).join('\n');
  const { error } = await supabase.from('leads').update({notes:next}).eq('id',leadId);
  if (error) return fail(error);
  LEAD.notes=next;
  LEAD.updated_at=new Date().toISOString();
  paintCorePanels();
  await paintCommercials();
}

wireModalDismiss();

$('#estimateBtn')?.addEventListener('click', async () => {
  const { data, error } = await supabase.from('estimates')
    .select('id').eq('lead_id',leadId).is('deleted_at',null)
    .order('created_at',{ascending:false}).limit(1);
  if (error) return fail(error);
  location.href = data?.length ? '/estimate.html?id='+data[0].id : '/estimate.html?lead='+leadId;
});

$('#proposalQuickBtn')?.addEventListener('click', async () => {
  const { data, error } = await supabase.from('proposals')
    .select('id').eq('lead_id',leadId).is('deleted_at',null)
    .order('created_at',{ascending:false}).limit(1);
  if (error) return fail(error);
  location.href = data?.length ? '/proposal.html?id='+data[0].id : '/proposal.html?lead='+leadId;
});

$('#btnWon')?.addEventListener('click', async () => {
  await setStage('won');

  const existing = await supabase.from('clients').select('id').eq('lead_id',leadId).is('deleted_at',null).maybeSingle();
  if (existing.error) return fail(existing.error);
  if (existing.data) return toast('Lead won · client already exists');

  const { data, error } = await supabase.from('clients').insert({
    business_unit_id: LEAD.business_unit_id || activeUnit(),
    lead_id: LEAD.id,
    name: LEAD.name,
    phone: LEAD.phone || null,
    email: LEAD.email || null,
    city: LEAD.city || 'Chennai',
    address: LEAD.area || null
  }).select('id').single();

  if (error) return fail(error);
  toast('Lead won · client record created');
});

$('#btnLost')?.addEventListener('click', () => {
  setVal('lostNote','');
  openModal('lostModal');
});

$('#confirmLost')?.addEventListener('click', async () => {
  const reason=$('input[name="lr"]:checked')?.value || 'Lost';
  const detail=val('lostNote');
  await appendNote(`Lost reason: ${reason}${detail?' — '+detail:''}`);
  closeAllModals();
  await setStage('lost');
});

$('#logBtn')?.addEventListener('click', async () => {
  const box=$('#logText');
  const txt=(box?.value||'').trim();
  if (!txt) return toast('Write something to log first','err');
  await appendNote('Activity: '+txt);
  if (box) box.value='';
  toast('Activity recorded in lead notes');
});

$('#noteBtn')?.addEventListener('click', async () => {
  const box=$('#noteText');
  const txt=(box?.value||'').trim();
  if (!txt) return toast('Write a note first','err');
  await appendNote(txt);
  if (box) box.value='';
  toast('Note saved');
});

$('#schedBtn')?.addEventListener('click', () => toast('Calendar/meeting module is the next backend stage.'));

document.addEventListener('click', async e => {
  if (!e.target.closest('#addTag')) return;
  const tag=val('tagIn') || prompt('Add a tag');
  if (!tag) return;
  await appendNote('#'+tag.replace(/^#/,''));
  setVal('tagIn','');
  toast('Tag saved in lead notes');
});

document.addEventListener('click', async e => {
  if (!e.target.closest('#remindBtn')) return;
  const when=prompt('Follow up on? (YYYY-MM-DD)',new Date(Date.now()+3*86400000).toISOString().slice(0,10));
  if (!when) return;
  const at=new Date(when+'T10:00:00');
  if (Number.isNaN(at.valueOf())) return toast('Use YYYY-MM-DD','err');

  const { error }=await supabase.from('tasks').insert({
    title:`Follow up · ${LEAD.lead_no || LEAD.name} · ${LEAD.name}`,
    description:`Sales follow-up for lead ${LEAD.lead_no || ''}`,
    priority:LEAD.priority==='hot'?'high':'medium',
    status:'todo',
    assigned_to:user.id,
    due_at:at.toISOString()
  });
  if (error) return fail(error);
  toast(`Follow-up task created for ${fmtDate(at)}`);
  await paintCommercials();
});

$('#fileInput')?.addEventListener('change', e => {
  e.target.value='';
  toast('File storage will be enabled when Documents is migrated.');
});
$('#dropzone')?.addEventListener('click', e => {
  e.preventDefault();
  toast('File storage will be enabled when Documents is migrated.');
});


document.addEventListener('click', e => {
  const btn=e.target.closest('[data-contact]');
  if(!btn)return;
  const kind=String(btn.dataset.contact||'').toLowerCase();
  if(kind==='call'){
    if(!LEAD?.phone)return toast('No mobile number on this lead','err');
    location.href='tel:+91'+String(LEAD.phone).replace(/\D/g,'').slice(-10);
  }
  if(kind==='whatsapp'){
    if(!LEAD?.phone)return toast('No mobile number on this lead','err');
    const phone=String(LEAD.phone).replace(/\D/g,'').slice(-10);
    window.open('https://wa.me/91'+phone,'_blank');
  }
  if(kind==='email'){
    if(!LEAD?.email)return toast('No email address on this lead','err');
    location.href='mailto:'+LEAD.email;
  }
});

document.addEventListener('click', e => {
  const step = e.target.closest('.step[data-stage]');
  if (step) setStage(step.dataset.stage);
});

$$('.tab[data-tab]').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x => { x.classList.remove('is-on'); x.setAttribute('aria-selected','false'); });
  t.classList.add('is-on'); t.setAttribute('aria-selected','true');
  $$('[data-panel]').forEach(p => p.classList.toggle('is-on', p.dataset.panel===t.dataset.tab));
}));

await load();

import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast, fail, esc, fmtDate, daysAgo } from '../lib/ui.js';
const $ = (s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];

const user = await mountShell({ route: 'documents', title: 'Documents' });
if (!user) throw new Error('redirecting');

let FOLDERS = [], FILES = [], SIGN = [];
let fFolder = '', fType = '', q = '';
const sizeOf = b => !b ? '—' : b > 1048576 ? (b/1048576).toFixed(1)+' MB' : Math.round(b/1024)+' KB';
const extOf  = n => (n.split('.').pop() || '').toLowerCase();

async function load() {
  const [fo, fi, sg] = await Promise.all([
    supabase.from('document_folders').select('*').order('sort_order'),
    supabase.from('documents').select('*, projects(code)').order('created_at', { ascending: false }),
    supabase.from('document_signatures').select('*, documents(name)').neq('status','signed').order('created_at')
  ]);
  if (fi.error) return fail(fi.error);
  FOLDERS = fo.data ?? []; FILES = fi.data ?? []; SIGN = sg.data ?? [];
  render();
}

const passes = f =>
  (!fFolder || f.folder_id === fFolder) &&
  (!fType || extOf(f.name) === fType) &&
  (!q || f.name.toLowerCase().includes(q));

function render() {
  const fl = $('#folders');
  if (fl) {
    fl.innerHTML = `<li class="fo${fFolder ? '' : ' is-on'}" data-folder="">All documents<span>${FILES.length}</span></li>` +
      FOLDERS.map(f => `<li class="fo${fFolder===f.id?' is-on':''}" data-folder="${f.id}">${esc(f.name)}
        <span>${FILES.filter(x=>x.folder_id===f.id).length}</span></li>`).join('');
  }
  const tag = $('#folderTag');
  if (tag) tag.textContent = FOLDERS.length ? `${FOLDERS.length} folders` : 'No folders';

  const rows = FILES.filter(passes);
  const el = $('#flist');
  if (el) {
    el.innerHTML = rows.length ? rows.map(f => `
      <li class="fi" data-id="${f.id}" data-path="${esc(f.storage_path)}">
        <span class="fi__ic ${esc(extOf(f.name))}">${esc(extOf(f.name).slice(0,3).toUpperCase())}</span>
        <span class="fi__body">
          <span class="fi__nm">${esc(f.name)}</span>
          <span class="fi__meta">${sizeOf(f.size_bytes)} · v${f.version} · ${daysAgo(f.created_at)} ago${
            f.projects ? ' · ' + esc(f.projects.code) : ''}</span>
        </span>
        <span class="fi__st st--${f.status}">${f.status}</span>
        ${f.shared_with_client ? '<span class="fi__shared" title="Visible in the client portal">shared</span>' : ''}
      </li>`).join('')
    : `<li class="fi"><span class="fi__body"><span class="fi__nm">${
        FILES.length ? 'Nothing matches these filters' : 'No documents yet — upload one'}</span></span></li>`;
  }
  const c = $('#fileCount');
  if (c) c.textContent = `${rows.length} file${rows.length===1?'':'s'}`;

  const sg = $('#sgn');
  if (sg) {
    sg.innerHTML = SIGN.length
      ? SIGN.map(s => `<li class="sg">
          <span class="sg__nm">${esc(s.documents?.name || '—')}</span>
          <span class="sg__meta">${esc(s.signer_name)} · ${s.status}</span></li>`).join('')
      : '<li class="sg">Nothing awaiting signature</li>';
  }
  const sc = $('#signCount');
  if (sc) { sc.textContent = String(SIGN.length); sc.hidden = !SIGN.length; }

  const act = $('#act');
  if (act) {
    act.innerHTML = FILES.slice(0,8).map(f => `<li class="ac">
      <span class="ac__txt">${esc(f.name)} uploaded</span>
      <span class="ac__when">${daysAgo(f.created_at)} ago</span></li>`).join('')
      || '<li class="ac"><span class="ac__txt">No activity</span></li>';
  }
}

/* upload */
$('#uploadBtn')?.addEventListener('click', () => {
  const inp = Object.assign(document.createElement('input'), { type: 'file', multiple: true });
  inp.onchange = async () => {
    for (const file of inp.files) {
      const path = `${fFolder || 'unfiled'}/${Date.now()}-${file.name.replace(/[^\w.\-]/g,'_')}`;
      const up = await supabase.storage.from('documents').upload(path, file);
      if (up.error) { fail(up.error); continue; }
      const { error } = await supabase.from('documents').insert({
        folder_id: fFolder || null, name: file.name, storage_path: path,
        mime_type: file.type, size_bytes: file.size, uploaded_by: user.id
      });
      if (error) fail(error);
    }
    toast('Upload complete');
    await load();
  };
  inp.click();
});

document.addEventListener('click', async e => {
  const fo = e.target.closest('[data-folder]');
  if (fo) { fFolder = fo.dataset.folder; return render(); }

  const fi = e.target.closest('.fi[data-path]');
  if (fi) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(fi.dataset.path, 60);
    if (error) return fail(error);
    window.open(data.signedUrl, '_blank');
  }
});

$('#fileSearch')?.addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
$('#typeSeg')?.addEventListener('click', e => {
  const b = e.target.closest('[data-type]'); if (!b) return;
  fType = b.dataset.type === 'all' ? '' : b.dataset.type;
  $$('#typeSeg [data-type]').forEach(x => x.classList.toggle('is-on', x === b));
  render();
});

await load();

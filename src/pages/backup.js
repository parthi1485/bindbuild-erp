import { supabase } from '../lib/supabase.js';
import { mountShell } from '../lib/shell.js';
import { toast,fail,esc,fmtDate } from '../lib/ui.js';
import { createStoreZip,parseStoreZip,utf8Bytes,utf8Text } from '../lib/zip-store.js';

const $=(s,c=document)=>c.querySelector(s);
const user=await mountShell({route:'backup',title:'Backup & Operations'});
if(!user)throw new Error('redirecting');

const can=['founder','admin'].includes(user.role);
const STORAGE_BUCKET='erp-documents';
const STORAGE_MANIFEST='__BIND_BUILD_STORAGE_MANIFEST__.json';
const STORAGE_LIMIT=250*1024*1024;
let PAYLOAD=null,VALID=null,STORAGE_RESTORE=null;

const bytes=n=>{n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB';};

async function load(){
  try{
    const [b,r,n]=await Promise.all([
      supabase.from('application_backup_log').select('*').order('created_at',{ascending:false}).limit(20),
      supabase.from('automation_runs').select('*').order('started_at',{ascending:false}).limit(12),
      supabase.from('erp_notifications').select('*').order('created_at',{ascending:false}).limit(20)
    ]);
    [b,r,n].forEach(x=>{if(x.error)throw x.error;});
    const alerts=n.data||[];let readMap=new Map();
    if(alerts.length){
      const rr=await supabase.from('erp_notification_reads').select('notification_id,status').eq('user_id',user.id).in('notification_id',alerts.map(x=>x.id));
      if(!rr.error)readMap=new Map((rr.data||[]).map(x=>[x.notification_id,x.status]));
    }
    paint(b.data||[],r.data||[],alerts.map(x=>({...x,user_status:readMap.get(x.id)||'unread'})));
  }catch(e){fail(e);}
}

function paint(backups,runs,alerts){
  const last=backups.find(x=>x.operation==='export'&&x.status==='success'),run=runs[0];
  $('#kAlerts').textContent=String(alerts.filter(x=>x.user_status==='unread').length);
  $('#kBackup').textContent=last?fmtDate(last.created_at):'None';
  $('#kRun').textContent=run?fmtDate(run.started_at):'None';
  $('#exportBackupBtn').disabled=!can;$('#runAutomationBtn').disabled=!can;
  $('#storageBackupBtn').disabled=!can;$('#storageExportBtn').disabled=!can;
  $('#backupBody').innerHTML=backups.length?backups.map(x=>'<tr><td>'+fmtDate(x.created_at)+'</td><td>'+esc(x.operation)+'</td><td>'+Number(x.row_count||0).toLocaleString('en-IN')+'</td><td>'+bytes(x.byte_estimate)+'</td><td><span class="sys-status '+esc(x.status)+'">'+esc(x.status)+'</span></td></tr>').join(''):'<tr><td colspan="5">No backup operations yet.</td></tr>';
  $('#runList').innerHTML=runs.length?runs.map(x=>'<div class="sys-row"><div class="sys-row__body"><div class="sys-row__title">'+esc(x.job_name)+'</div><div class="sys-row__meta">'+fmtDate(x.started_at)+(x.result?.notifications_created!==undefined?' · '+x.result.notifications_created+' alerts created':'')+(x.error?' · '+esc(x.error):'')+'</div></div><span class="sys-status '+esc(x.status)+'">'+esc(x.status)+'</span></div>').join(''):'<div class="sys-row__meta">No automation runs recorded yet.</div>';
  $('#alertList').innerHTML=alerts.length?alerts.slice(0,10).map(x=>'<div class="sys-row"><div class="sys-row__body"><div class="sys-row__title">'+esc(x.title)+'</div><div class="sys-row__meta">'+esc(x.body||'')+' · '+fmtDate(x.created_at)+'</div></div><span class="sys-status '+(x.severity==='critical'?'failed':x.user_status==='unread'?'blocked':'ok')+'">'+esc(x.severity)+'</span></div>').join(''):'<div class="sys-row__meta">No operational alerts.</div>';
}

function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function listStorageFiles(prefix=''){
  const out=[];
  async function walk(folder){
    let offset=0;
    while(true){
      const {data,error}=await supabase.storage.from(STORAGE_BUCKET).list(folder,{limit:1000,offset,sortBy:{column:'name',order:'asc'}});
      if(error)throw error;
      const rows=data||[];
      for(const item of rows){
        const path=folder?folder+'/'+item.name:item.name;
        const isFile=Boolean(item.id)||Boolean(item.metadata&&('size' in item.metadata||'mimetype' in item.metadata||'contentType' in item.metadata));
        if(isFile)out.push({path,item});
        else await walk(path);
      }
      if(rows.length<1000)break;
      offset+=rows.length;
    }
  }
  await walk(prefix);
  return out;
}

async function exportStorageZip(){
  if(!can)return;
  const btns=[$('#storageBackupBtn'),$('#storageExportBtn')].filter(Boolean);
  btns.forEach(b=>b.disabled=true);
  try{
    $('#storageStatus').textContent='Scanning private document bucket…';
    const files=await listStorageFiles();
    if(files.some(x=>x.path===STORAGE_MANIFEST))throw new Error('Reserved manifest filename already exists in Storage.');
    if(files.length>5000)throw new Error('Browser backup supports up to 5,000 objects. Use Supabase CLI for larger buckets.');
    const declared=files.reduce((n,x)=>n+Number(x.item.metadata?.size||0),0);
    if(declared>STORAGE_LIMIT)throw new Error('Document bucket is '+bytes(declared)+'. Browser ZIP backup is capped at '+bytes(STORAGE_LIMIT)+'.');

    const zipEntries=[],objects=[];let total=0,done=0;
    for(const file of files){
      $('#storageStatus').textContent='Downloading '+(++done)+' / '+files.length+' · '+file.path;
      const {data,error}=await supabase.storage.from(STORAGE_BUCKET).download(file.path);
      if(error)throw error;
      const arr=new Uint8Array(await data.arrayBuffer());
      total+=arr.length;
      if(total>STORAGE_LIMIT)throw new Error('Downloaded document bytes exceed '+bytes(STORAGE_LIMIT)+' browser backup cap.');
      zipEntries.push({name:file.path,data:arr,mtime:new Date(file.item.updated_at||file.item.created_at||Date.now())});
      objects.push({path:file.path,size:arr.length,content_type:data.type||file.item.metadata?.mimetype||file.item.metadata?.contentType||'application/octet-stream'});
    }
    const manifest={format:'bindbuild-erp-storage-backup',format_version:1,bucket:STORAGE_BUCKET,created_at:new Date().toISOString(),object_count:objects.length,total_bytes:total,objects};
    zipEntries.push({name:STORAGE_MANIFEST,data:utf8Bytes(JSON.stringify(manifest,null,2)),mtime:new Date()});
    $('#storageStatus').textContent='Building ZIP · '+objects.length+' files · '+bytes(total);
    const zip=createStoreZip(zipEntries);
    downloadBlob(new Blob([zip],{type:'application/zip'}),'bindbuild-erp-documents-'+new Date().toISOString().replace(/[:.]/g,'-')+'.zip');
    $('#storageStatus').textContent='Storage ZIP downloaded · '+objects.length+' files · '+bytes(total)+'. Keep it with the matching application JSON backup.';
    toast('Documents ZIP downloaded · '+objects.length+' files');
  }catch(e){fail(e);$('#storageStatus').textContent='Storage backup failed: '+(e.message||String(e));}
  finally{btns.forEach(b=>b.disabled=!can);}
}

function safeStoragePath(path){
  return typeof path==='string'&&path.length>0&&!path.startsWith('/')&&!path.includes('\\')&&!path.split('/').some(x=>x===''||x==='.'||x==='..')&&path!==STORAGE_MANIFEST;
}

async function validateStorageZip(file){
  STORAGE_RESTORE=null;$('#storageRestoreBtn').disabled=true;$('#storageValidation').innerHTML='';
  if(!file)return;
  if(file.size>STORAGE_LIMIT+10*1024*1024)throw new Error('ZIP exceeds browser restore limit.');
  const entries=parseStoreZip(await file.arrayBuffer());
  const manifestEntry=entries.find(x=>x.name===STORAGE_MANIFEST);
  if(!manifestEntry)throw new Error('Bind Build Storage manifest is missing.');
  const manifest=JSON.parse(utf8Text(manifestEntry.data));
  if(manifest.format!=='bindbuild-erp-storage-backup'||Number(manifest.format_version)!==1||manifest.bucket!==STORAGE_BUCKET)throw new Error('Unsupported Storage backup format.');
  const files=entries.filter(x=>x.name!==STORAGE_MANIFEST),map=new Map(files.map(x=>[x.name,x]));
  if(files.length!==Number(manifest.object_count))throw new Error('Storage object count does not match manifest.');
  let total=0;
  for(const obj of manifest.objects||[]){
    if(!safeStoragePath(obj.path))throw new Error('Unsafe Storage path in backup: '+String(obj.path));
    const entry=map.get(obj.path);if(!entry)throw new Error('ZIP is missing '+obj.path);
    if(entry.data.length!==Number(obj.size))throw new Error('Size mismatch for '+obj.path);
    total+=entry.data.length;
  }
  if(total!==Number(manifest.total_bytes))throw new Error('Storage total byte count does not match manifest.');
  if(total>STORAGE_LIMIT)throw new Error('Storage backup exceeds '+bytes(STORAGE_LIMIT)+' restore cap.');
  const existing=await listStorageFiles();
  const empty=existing.length===0;
  STORAGE_RESTORE={manifest,files,map,empty,fileName:file.name};
  $('#storageValidation').innerHTML='<div class="sys-file">'+esc(file.name)+'</div><div class="sys-kv"><span>Format</span><b>Storage v1</b></div><div class="sys-kv"><span>Files</span><b>'+files.length.toLocaleString('en-IN')+'</b></div><div class="sys-kv"><span>Bytes</span><b>'+bytes(total)+'</b></div><div class="sys-kv"><span>Current bucket</span><b>'+(empty?'Empty / restore allowed':existing.length+' files / blocked')+'</b></div><div class="sys-note '+(empty?'':'warn')+'">'+(empty?'ZIP checksums and manifest validated.':'Restore is blocked to prevent overwriting live document files.')+'</div>';
  $('#storageRestoreBtn').disabled=!(can&&empty);
  toast('Document ZIP validated');
}

async function restoreStorageZip(){
  if(!can||!STORAGE_RESTORE?.empty)return;
  if(prompt('Type RESTORE FILES to confirm document-byte restore')!=='RESTORE FILES')return toast('Storage restore cancelled','err');
  if(!confirm('Final confirmation: restore '+STORAGE_RESTORE.files.length+' files into the empty private document bucket?'))return;
  const btn=$('#storageRestoreBtn');btn.disabled=true;const uploaded=[];
  try{
    let i=0;
    for(const obj of STORAGE_RESTORE.manifest.objects){
      $('#storageStatus').textContent='Restoring '+(++i)+' / '+STORAGE_RESTORE.manifest.object_count+' · '+obj.path;
      const entry=STORAGE_RESTORE.map.get(obj.path);
      const {error}=await supabase.storage.from(STORAGE_BUCKET).upload(obj.path,new Blob([entry.data],{type:obj.content_type||'application/octet-stream'}),{upsert:false,contentType:obj.content_type||undefined});
      if(error)throw error;
      uploaded.push(obj.path);
    }
    $('#storageStatus').textContent='Storage restore complete · '+uploaded.length+' files.';
    toast('Document files restored · '+uploaded.length);
    STORAGE_RESTORE=null;$('#storageRestoreFile').value='';$('#storageValidation').innerHTML='';$('#storageRestoreBtn').disabled=true;
  }catch(e){
    for(let i=0;i<uploaded.length;i+=100){
      try{await supabase.storage.from(STORAGE_BUCKET).remove(uploaded.slice(i,i+100));}catch{}
    }
    $('#storageStatus').textContent='Storage restore failed; uploaded files were rolled back where permitted.';
    fail(e);
  }finally{if(STORAGE_RESTORE)btn.disabled=!(can&&STORAGE_RESTORE.empty);}
}

$('#exportBackupBtn').addEventListener('click',async()=>{
  if(!can)return;
  try{
    $('#exportBackupBtn').disabled=true;toast('Building ERP backup…');
    const {data,error}=await supabase.rpc('export_application_backup');if(error)throw error;
    const raw=JSON.stringify(data,null,2);
    downloadBlob(new Blob([raw],{type:'application/json'}),'bindbuild-erp-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
    toast('Backup downloaded · '+Number(data.row_count||0).toLocaleString('en-IN')+' rows');await load();
  }catch(e){fail(e);}finally{$('#exportBackupBtn').disabled=!can;}
});

$('#backupFile').addEventListener('change',async e=>{
  PAYLOAD=null;VALID=null;$('#restoreBtn').disabled=true;
  const file=e.target.files?.[0];if(!file)return;
  try{
    PAYLOAD=JSON.parse(await file.text());
    const {data,error}=await supabase.rpc('validate_application_backup',{p_payload:PAYLOAD});if(error)throw error;
    VALID=data;
    $('#validationBox').innerHTML='<div class="sys-file">'+esc(file.name)+'</div><div class="sys-kv"><span>Format</span><b>v'+data.format_version+'</b></div><div class="sys-kv"><span>Tables</span><b>'+data.table_count+'</b></div><div class="sys-kv"><span>Rows</span><b>'+Number(data.row_count).toLocaleString('en-IN')+'</b></div><div class="sys-kv"><span>Auth ID mismatches</span><b>'+Number(data.auth_id_mismatches||0)+'</b></div><div class="sys-kv"><span>Restore target</span><b>'+(data.restore_allowed?'Compatible / allowed':'Blocked')+'</b></div><div class="sys-note '+(data.restore_allowed?'':'warn')+'">'+esc(data.note)+'</div>';
    $('#restoreBtn').disabled=!(can&&data.restore_allowed);toast('Backup validated');await load();
  }catch(err){PAYLOAD=null;VALID=null;$('#validationBox').innerHTML='<div class="sys-note warn">'+esc(err.message||String(err))+'</div>';fail(err);}
});

$('#restoreBtn').addEventListener('click',async()=>{
  if(!can||!PAYLOAD||!VALID?.restore_allowed)return;
  if(prompt('Type RESTORE to confirm importing this backup into the empty ERP')!=='RESTORE')return toast('Restore cancelled','err');
  if(!confirm('Final confirmation: restore the validated backup?'))return;
  try{
    $('#restoreBtn').disabled=true;
    const {data,error}=await supabase.rpc('restore_application_backup',{p_payload:PAYLOAD});if(error)throw error;
    toast('Restore complete · '+Number(data.rows_inserted||0).toLocaleString('en-IN')+' rows');await load();
  }catch(e){fail(e);}finally{$('#restoreBtn').disabled=!(can&&VALID?.restore_allowed);}
});

$('#storageBackupBtn').addEventListener('click',exportStorageZip);
$('#storageExportBtn').addEventListener('click',exportStorageZip);
$('#storageRestoreFile').addEventListener('change',async e=>{try{await validateStorageZip(e.target.files?.[0]);}catch(err){STORAGE_RESTORE=null;$('#storageRestoreBtn').disabled=true;$('#storageValidation').innerHTML='<div class="sys-note warn">'+esc(err.message||String(err))+'</div>';fail(err);}});
$('#storageRestoreBtn').addEventListener('click',restoreStorageZip);

$('#runAutomationBtn').addEventListener('click',async()=>{
  if(!can)return;
  try{
    $('#runAutomationBtn').disabled=true;
    const {data,error}=await supabase.rpc('run_erp_automations_now');if(error)throw error;
    toast('Automation scan complete · '+Number(data.notifications_created||0)+' new alerts');await load();
  }catch(e){fail(e);}finally{$('#runAutomationBtn').disabled=!can;}
});

await load();
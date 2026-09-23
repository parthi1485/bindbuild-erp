import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { createStoreZip, parseStoreZip, utf8Bytes, utf8Text } from '../src/lib/zip-store.js';

const root=process.cwd();
const errors=[];
const warnings=[];

const requiredPages=[
  'login.html','dashboard.html','analytics.html','crm.html','lead.html','sales.html',
  'estimate.html','proposal.html','client.html','projects.html','project.html',
  'design.html','progress.html','procurement.html','inventory.html','finance.html',
  'hr.html','attendance.html','people.html','documents.html','meetings.html',
  'client-portal.html','vendor-portal.html','backup.html','settings.html'
];

for(const p of requiredPages) if(!existsSync(resolve(root,p))) errors.push('Missing required ERP route: '+p);

function walk(dir){
  const out=[];
  for(const name of readdirSync(dir)){
    if(name==='node_modules'||name==='dist'||name==='.git')continue;
    const p=join(dir,name),st=statSync(p);
    if(st.isDirectory())out.push(...walk(p)); else out.push(p);
  }
  return out;
}
const files=walk(root);
const html=files.filter(f=>dirname(f)===root&&extname(f)==='.html');
const js=files.filter(f=>f.includes(join(root,'src'))&&extname(f)==='.js');

function localTarget(base,raw){
  if(!raw||/^(?:https?:|data:|mailto:|tel:|#|javascript:)/i.test(raw))return null;
  const clean=raw.split(/[?#]/)[0];
  if(!clean)return null;
  return clean.startsWith('/')?resolve(root,'.'+clean):resolve(dirname(base),clean);
}
function existsAsset(p){
  if(!p)return true;
  if(existsSync(p))return true;
  if(!extname(p)&&existsSync(p+'.js'))return true;
  if(!extname(p)&&existsSync(p+'.css'))return true;
  return false;
}

for(const file of html){
  const src=readFileSync(file,'utf8');
  const refs=[...src.matchAll(/<(?:script|link)\b[^>]+?(?:src|href)=["']([^"']+)["']/gi)].map(m=>m[1]);
  for(const ref of refs){
    const p=localTarget(file,ref);
    if(p&&!existsAsset(p))errors.push(file.replace(root+'/','')+' references missing asset '+ref);
  }
}

for(const file of js){
  const src=readFileSync(file,'utf8');
  const imports=[
    ...src.matchAll(/\bfrom\s+["']([^"']+)["']/g),
    ...src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)
  ].map(m=>m[1]).filter(x=>x.startsWith('.')||x.startsWith('/'));
  for(const ref of imports){
    const p=localTarget(file,ref);
    if(p&&!existsAsset(p))errors.push(file.replace(root+'/','')+' imports missing module '+ref);
  }
}

const shell=resolve(root,'src/lib/shell-template.js');
if(existsSync(shell)){
  const src=readFileSync(shell,'utf8');
  for(const m of src.matchAll(/href=["'](\/[^"'?#]+\.html)/g)){
    const p=resolve(root,'.'+m[1]);
    if(!existsSync(p))errors.push('Shell navigation points to missing route '+m[1]);
  }
}

for(const file of js){
  const rel=file.replace(root+'/','');
  const src=readFileSync(file,'utf8');
  if(/SUPABASE_SERVICE_ROLE_KEY|service[_-]?role\s*[:=]/i.test(src))errors.push('Privileged Supabase key reference in browser source: '+rel);
  if(/sk-[A-Za-z0-9_-]{20,}/.test(src))errors.push('Possible secret API key in browser source: '+rel);
}

// Supply-chain / deploy reproducibility.
const pkgPath=resolve(root,'package.json');
const lockPath=resolve(root,'package-lock.json');
if(existsSync(pkgPath)){
  const pkg=JSON.parse(readFileSync(pkgPath,'utf8'));
  for(const group of ['dependencies','devDependencies']){
    for(const [name,version] of Object.entries(pkg[group]||{})){
      if(!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(version))){
        errors.push('Dependency is not exactly pinned: '+name+'@'+version);
      }
    }
  }
}
if(!existsSync(lockPath))errors.push('package-lock.json is required for reproducible npm ci builds');

const vercelPath=resolve(root,'vercel.json');
if(existsSync(vercelPath)){
  const cfg=JSON.parse(readFileSync(vercelPath,'utf8'));
  if(cfg.buildCommand!=='npm run build')errors.push('Vercel must use npm run build so QA cannot be bypassed');
}

// Consolidated Supabase bootstrap baseline.
const baseline=resolve(root,'supabase/baseline/current_schema.sql');
if(!existsSync(baseline))errors.push('Missing consolidated Supabase schema baseline');
else{
  const src=readFileSync(baseline,'utf8');
  const markers=['project_documents','payroll_runs','portal_memberships','vendor_rfq_invites','management_dashboard','erp_notification_reads','application_backup_log'];
  for(const marker of markers)if(!src.includes(marker))errors.push('Supabase baseline missing critical object: '+marker);
  if(src.length<100000)errors.push('Supabase baseline looks unexpectedly small');
}

// Built-in document Storage ZIP engine regression.
try{
  const entries=[
    {name:'folder/test.txt',data:utf8Bytes('Bind Build ERP')},
    {name:'தமிழ்/door schedule.json',data:utf8Bytes('{"ok":true}')},
    {name:'empty.bin',data:new Uint8Array()}
  ];
  const zip=createStoreZip(entries);
  const parsed=parseStoreZip(zip);
  if(parsed.length!==3||utf8Text(parsed[0].data)!=='Bind Build ERP'||parsed[1].name!=='தமிழ்/door schedule.json'){
    errors.push('Storage ZIP round-trip regression failed');
  }
  const corrupt=zip.slice();
  let flip=-1;
  for(let i=35;i<corrupt.length;i++){if(corrupt[i]===66){flip=i;break;}}
  if(flip>=0){
    corrupt[flip]^=1;
    let blocked=false;try{parseStoreZip(corrupt);}catch{blocked=true;}
    if(!blocked)errors.push('Storage ZIP CRC corruption was not rejected');
  }
}catch(e){errors.push('Storage ZIP regression threw: '+(e?.message||e));}

const config=resolve(root,'src/lib/config.js');
if(existsSync(config)){
  const src=readFileSync(config,'utf8');
  if(!/supabase\.co/.test(src))warnings.push('Supabase project URL not found in src/lib/config.js');
}

if(warnings.length){
  console.warn('\nQA warnings:');
  warnings.forEach(x=>console.warn(' - '+x));
}
if(errors.length){
  console.error('\nQA failed:');
  errors.forEach(x=>console.error(' - '+x));
  process.exit(1);
}
console.log('QA passed · '+html.length+' HTML entries · '+js.length+' browser JS modules checked.');

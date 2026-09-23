import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

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

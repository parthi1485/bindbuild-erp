import { supabase } from '../lib/supabase.js';
import { mountShell, activeUnit } from '../lib/shell.js';
import { toast, fail, esc } from '../lib/ui.js';
const $=(s,c=document)=>c.querySelector(s),$$=(s,c=document)=>[...c.querySelectorAll(s)];
const user=await mountShell({route:'analytics',title:'Analytics'});if(!user)throw new Error('redirecting');
const money=v=>{const n=Number(v)||0;if(Math.abs(n)>=1e7)return '₹'+(n/1e7).toFixed(2).replace(/\.00$/,'')+'Cr';if(Math.abs(n)>=1e5)return '₹'+(n/1e5).toFixed(1).replace(/\.0$/,'')+'L';return '₹'+Math.round(n).toLocaleString('en-IN');};
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let RANGE='6m',DATA=null,CHARTS=[];
function dates(){
 const now=new Date(),to=now.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),d=new Date(to+'T12:00:00');
 if(RANGE==='90d')d.setDate(d.getDate()-89);
 else if(RANGE==='6m')d.setMonth(d.getMonth()-5,1);
 else if(RANGE==='12m')d.setMonth(d.getMonth()-11,1);
 else {const m=d.getMonth();d.setFullYear(m>=3?d.getFullYear():d.getFullYear()-1,3,1);}
 return {from:d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),to};
}
async function load(){
 try{
  const r=dates();$('#rangeLabel').textContent=r.from+' → '+r.to+' · live ERP records';
  const {data,error}=await supabase.rpc('management_dashboard',{p_business_unit_id:activeUnit(),p_from:r.from,p_to:r.to});
  if(error)throw error;DATA=data;render();
 }catch(e){fail(e);}
}
function render(){
 const k=DATA.kpis||{};
 $('#kCollections').textContent=money(k.collections);$('#kCollectionsSub').textContent=money(k.booked_cost)+' booked cost';
 $('#kReceivables').textContent=money(k.receivables);$('#kReceivableSub').textContent=money(k.invoiced)+' invoiced in range';
 $('#kPayables').textContent=money(k.vendor_payables);$('#kPipeline').textContent=money(k.open_pipeline);$('#kLeadsSub').textContent=(k.new_leads||0)+' new leads';
 $('#kWin').textContent=Number(k.win_rate||0).toFixed(1).replace('.0','')+'%';$('#kWinSub').textContent=(k.won_leads||0)+' won · '+(k.lost_leads||0)+' lost';
 $('#kRisk').textContent=String(k.at_risk_projects||0);$('#kRiskSub').textContent=(k.overdue_projects||0)+' overdue projects';
 $('#opProjects').textContent=String(k.active_projects||0);$('#opTasks').textContent=String(k.overdue_tasks||0);$('#opApprovals').textContent=String(k.pending_approvals||0);$('#opHead').textContent=String(k.headcount||0);$('#opCapacity').textContent=Number(k.avg_capacity||0).toFixed(0)+'%';$('#opPO').textContent=money(k.open_po_commitment);
 renderCharts();renderProjects();renderRisks();
}
function chart(el,type,data,options={}){if(!window.Chart||!$(el))return;CHARTS.push(new Chart($(el),{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},...options}}));}
function renderCharts(){
 CHARTS.forEach(c=>c.destroy());CHARTS=[];
 const accent=css('--accent')||'#5a8dee',muted=css('--text-3')||'#657079',success=css('--success')||'#41d1a0',danger=css('--danger')||'#ef4444',warning=css('--warning')||'#f59e0b';
 const m=DATA.monthly||[];chart('#cashChart','bar',{labels:m.map(x=>x.label),datasets:[{label:'Collections',data:m.map(x=>x.collections),backgroundColor:accent,borderRadius:5},{label:'Booked cost',data:m.map(x=>x.booked_cost),backgroundColor:muted,borderRadius:5}]},{plugins:{legend:{display:true,labels:{color:css('--text-2')}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{callback:v=>money(v)}}}});$('#cashTag').textContent=money(m.reduce((a,x)=>a+Number(x.collections||0),0))+' collected';
 const p=DATA.pipeline||[];chart('#pipeChart','bar',{labels:p.map(x=>x.stage),datasets:[{data:p.map(x=>x.value),backgroundColor:accent,borderRadius:5}]},{indexAxis:'y',scales:{x:{beginAtZero:true,ticks:{callback:v=>money(v)}},y:{grid:{display:false}}}});$('#pipeLegend').innerHTML=p.map(x=>'<span class="lg"><span class="lg__nm">'+esc(x.stage)+'</span><span class="lg__v">'+money(x.value)+' · '+x.count+'</span></span>').join('')||'<span class="lg">No open pipeline</span>';
 const s=DATA.sources||[];chart('#sourceChart','bar',{labels:s.map(x=>x.source),datasets:[{data:s.map(x=>x.count),backgroundColor:accent,borderRadius:5}]},{indexAxis:'y',scales:{x:{beginAtZero:true,grid:{display:false}}}});
 const c=DATA.expense_categories||[];chart('#costChart','doughnut',{labels:c.map(x=>x.category),datasets:[{data:c.map(x=>x.amount),backgroundColor:[accent,success,warning,danger,'#a78bfa','#38bdf8',muted],borderWidth:0}]},{cutout:'66%'});$('#costLegend').innerHTML=c.map(x=>'<span class="lg"><span class="lg__nm">'+esc(x.category)+'</span><span class="lg__v">'+money(x.amount)+'</span></span>').join('')||'<span class="lg">No booked costs</span>';
 const h=DATA.project_health||[];chart('#healthChart','doughnut',{labels:h.map(x=>x.health),datasets:[{data:h.map(x=>x.count),backgroundColor:h.map(x=>['critical','atrisk','at_risk'].includes(x.health)?danger:x.health==='ontrack'?success:warning),borderWidth:0}]},{cutout:'62%',plugins:{legend:{display:true,position:'bottom'}}});
}
function renderProjects(){
 const rows=DATA.top_projects||[];$('#projBody').innerHTML=rows.length?rows.map(p=>'<tr><td><div class="tbl__nm">'+esc(p.project_no||p.code||'Project')+' · '+esc(p.name)+'</div></td><td class="num">'+money(p.contract_value)+'</td><td><b>'+Number(p.progress_pct||0)+'%</b><div class="bar"><div class="bar__f" style="width:'+Math.min(100,Number(p.progress_pct||0))+'%"></div></div></td><td class="num">'+money(p.collected)+'</td><td class="num">'+money(p.receivable)+'</td><td class="num">'+money(p.booked_cost)+'</td><td><span class="pill '+(['critical','atrisk','at_risk'].includes(p.health)?'risk':'on')+'">'+esc(p.health||'—')+'</span></td></tr>').join(''):'<tr><td colspan="7" class="tbl__empty">No projects yet.</td></tr>';
}
function renderRisks(){
 const out=[],k=DATA.kpis||{},r=DATA.risks||{};
 if(k.overdue_tasks)out.push(k.overdue_tasks+' overdue task'+(k.overdue_tasks===1?'':'s')+' require follow-up.');
 if(k.pending_approvals)out.push(k.pending_approvals+' project approval'+(k.pending_approvals===1?' is':'s are')+' pending.');
 (r.overdue_invoices||[]).slice(0,4).forEach(x=>out.push((x.invoice_no||'Invoice')+' overdue · '+money(x.balance)+' outstanding.'));
 (r.overdue_vendor_bills||[]).slice(0,4).forEach(x=>out.push((x.bill_no||'Vendor bill')+' overdue · '+money(x.balance)+' payable.'));
 if(k.avg_capacity<50&&k.headcount>0)out.push('Average active manpower allocation is '+Number(k.avg_capacity).toFixed(0)+'%.');
 $('#riskList').innerHTML=out.length?out.map(x=>'<div class="ins__row"><div><div class="ins__t">'+esc(x)+'</div></div></div>').join(''):'<div class="ins__row"><div><div class="ins__t">No high-priority management exceptions in the current snapshot.</div></div></div>';
}
$('#rangeSeg').addEventListener('click',e=>{const b=e.target.closest('[data-range]');if(!b)return;RANGE=b.dataset.range;$$('#rangeSeg [data-range]').forEach(x=>x.classList.toggle('on',x===b));load();});
$('#refreshBtn').addEventListener('click',load);
$('#exportBtn').addEventListener('click',()=>{if(!DATA)return;const rows=[['Project','Contract','Progress %','Collected','Receivable','Booked cost','Health'],...(DATA.top_projects||[]).map(p=>[p.project_no||p.code,p.contract_value,p.progress_pct,p.collected,p.receivable,p.booked_cost,p.health])];const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=u;a.download='bindbuild-management-analytics-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(u);toast('Analytics CSV exported');});
await load();
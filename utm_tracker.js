// === UTM Tracking + Report Addon v2 ===
(function(){
'use strict';

function ready(){
if(typeof firebase==='undefined'||typeof window.refreshAdmin==='undefined'){
return setTimeout(ready,300);
}

var DB_BASE='https://studycare-chemistry-default-rtdb.firebaseio.com';

function getTodayIST(){
var d=new Date();
return d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
}
function nowIST(){
return new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
}

function captureUTM(){
var params=new URLSearchParams(window.location.search);
var keys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
var utm={};var hasUTM=false;
keys.forEach(function(k){var v=params.get(k);if(v){utm[k]=v;hasUTM=true;}});
if(document.referrer)utm.referrer=document.referrer;
var today=getTodayIST();
if(hasUTM){
utm.capturedAt=nowIST();
utm.capturedDate=today;
utm.capturedTs=Date.now();
try{sessionStorage.setItem('sc_utm_current',JSON.stringify(utm));}catch(e){}
try{
if(!localStorage.getItem('sc_utm_first')){
utm.firstTouch=true;
localStorage.setItem('sc_utm_first',JSON.stringify(utm));
}
}catch(e){}
}
var cur={};
try{var s=sessionStorage.getItem('sc_utm_current');if(s)cur=JSON.parse(s);}catch(e){}
if(!cur.utm_source){
try{
var f=localStorage.getItem('sc_utm_first');
if(f){var ft=JSON.parse(f);for(var k in ft)cur[k]=ft[k];cur.isFirstTouch=true;}
}catch(e){}
}
if(!cur.utm_source){cur.utm_source=utm.referrer?'referral':'direct';cur.utm_medium='none';}
return{cur:cur,hasUTM:hasUTM,today:today};
}

var captured=captureUTM();
var currentUTM=captured.cur;
var deviceId=null;
try{deviceId=localStorage.getItem('sc_chem_device_id');}catch(e){}

if(deviceId){
// Save current UTM to info
fetch(DB_BASE+'/devices/'+deviceId+'/info/utm.json',{
method:'PUT',headers:{'Content-Type':'application/json'},
body:JSON.stringify(currentUTM)
}).catch(function(){});

// Log EVERY UTM visit with today's date (for daily report)
if(captured.hasUTM){
var visitKey=captured.today.replace(/-/g,'')+'_'+Date.now();
var visitData={
source:currentUTM.utm_source||'direct',
medium:currentUTM.utm_medium||'',
campaign:currentUTM.utm_campaign||'',
content:currentUTM.utm_content||'',
term:currentUTM.utm_term||'',
date:captured.today,
timeIST:currentUTM.capturedAt,
ts:currentUTM.capturedTs
};
fetch(DB_BASE+'/devices/'+deviceId+'/utm_visits/'+visitKey+'.json',{
method:'PUT',headers:{'Content-Type':'application/json'},
body:JSON.stringify(visitData)
}).catch(function(){});
}
}

// ===== Admin Table Decoration =====
function decorateAdmin(){
var panel=document.getElementById('admin-panel');
if(!panel||panel.style.display==='none')return;

var thead=panel.querySelector('thead tr');
if(thead&&!thead.querySelector('.utm-th')){
var sourceTh=document.createElement('th');
sourceTh.className='utm-th';
sourceTh.textContent='Source';
sourceTh.style.cssText='background:#4f46e5;color:#fff;';
var infoTh=thead.querySelector('th:nth-child(9)');
if(infoTh)infoTh.parentNode.insertBefore(sourceTh,infoTh);
}

var tbody=document.getElementById('admin-device-body');
if(!tbody)return;
var rows=tbody.querySelectorAll('tr');
var cache=window.allDevicesCache||[];
var sorted=cache.slice().sort(function(a,b){
var aOn=a.info&&a.info.online&&(Date.now()-(a.info.lastSeenTs||0)<300000)?1:0;
var bOn=b.info&&b.info.online&&(Date.now()-(b.info.lastSeenTs||0)<300000)?1:0;
if(bOn!==aOn)return bOn-aOn;
return (b.submitCount||0)-(a.submitCount||0);
});

rows.forEach(function(tr,idx){
if(!sorted[idx])return;
if(tr.querySelector('.utm-td'))return;
var dev=sorted[idx];
var utm=(dev.info&&dev.info.utm)||{};
var source=utm.utm_source||'direct';
var map={
whatsapp:{c:'#25D366',i:'W'},
instagram:{c:'#E1306C',i:'I'},
facebook:{c:'#1877F2',i:'F'},
telegram:{c:'#0088cc',i:'T'},
direct:{c:'#64748b',i:'D'},
referral:{c:'#f59e0b',i:'R'}
};
var b=map[source]||{c:'#94a3b8',i:'?'};
var cell=document.createElement('td');
cell.className='utm-td';
cell.style.cssText='font-size:10px;text-align:center;';
cell.innerHTML='<span style="color:'+b.c+';font-weight:700;">'+b.i+' '+source+'</span>';
var infoTd=tr.children[8];
if(infoTd)tr.insertBefore(cell,infoTd);
else tr.appendChild(cell);
});
}

var origRefresh=window.refreshAdmin;
window.refreshAdmin=function(f){
origRefresh(f);
setTimeout(decorateAdmin,300);
setTimeout(decorateAdmin,1000);
};

setInterval(decorateAdmin,2000);

// ===== Build Reports (Source/Daily/Campaign) =====
function buildReports(){
var cache=window.allDevicesCache||[];
var sources={};var campaigns={};var days={};

cache.forEach(function(dev){
var info=dev.info||{};
var utm=info.utm||{};
var src=utm.utm_source||'direct';
if(!sources[src])sources[src]={devices:0,visits:0,submits:0,scores:[],lastSeen:''};
sources[src].devices++;
sources[src].visits+=(dev.visitCount||0);
sources[src].submits+=(dev.submitCount||0);
if(dev.bestScore)sources[src].scores.push(dev.bestScore);
if(info.lastSeen&&(!sources[src].lastSeen||info.lastSeen>sources[src].lastSeen))sources[src].lastSeen=info.lastSeen;

if(utm.utm_campaign){
var c=utm.utm_campaign;
if(!campaigns[c])campaigns[c]={devices:0,visits:0,submits:0,source:src};
campaigns[c].devices++;
campaigns[c].visits+=(dev.visitCount||0);
campaigns[c].submits+=(dev.submitCount||0);
}

// utm_visits per day
if(dev.utm_visits){
Object.values(dev.utm_visits).forEach(function(v){
if(!v.date||!v.source)return;
if(!days[v.date])days[v.date]={};
if(!days[v.date][v.source])days[v.date][v.source]={visits:0,devices:{}};
days[v.date][v.source].visits++;
days[v.date][v.source].devices[dev.key]=true;
});
}
});

return{sources:sources,campaigns:campaigns,days:days};
}

function renderReport(){
var r=buildReports();
var wrap=document.getElementById('utm-report-body');
if(!wrap)return;

// Source Summary
var srcRows=Object.entries(r.sources).sort(function(a,b){return b[1].devices-a[1].devices;});
var srcHTML='<h3 style="color:#a5b4fc;margin-top:20px;">📊 Source Summary (All Time)</h3>'+
'<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;">'+
'<thead><tr style="background:#0f172a;color:#cbd5e1;">'+
'<th style="padding:8px;text-align:left;">Source</th>'+
'<th style="padding:8px;">Devices</th>'+
'<th style="padding:8px;">Visits</th>'+
'<th style="padding:8px;">Submits</th>'+
'<th style="padding:8px;">Avg Best</th>'+
'<th style="padding:8px;">Last Active</th>'+
'</tr></thead><tbody>';
srcRows.forEach(function(e){
var name=e[0],s=e[1];
var avg=s.scores.length?Math.round(s.scores.reduce(function(a,b){return a+b;},0)/s.scores.length):0;
var colors={whatsapp:'#25D366',instagram:'#E1306C',facebook:'#1877F2',telegram:'#0088cc',direct:'#64748b',referral:'#f59e0b'};
var c=colors[name]||'#94a3b8';
var last=s.lastSeen?s.lastSeen.split(',')[1]||s.lastSeen:'-';
srcHTML+='<tr style="border-bottom:1px solid #334155;">'+
'<td style="padding:8px;text-align:left;"><span style="color:'+c+';font-weight:700;">'+name+'</span></td>'+
'<td style="padding:8px;text-align:center;color:#fff;font-weight:700;">'+s.devices+'</td>'+
'<td style="padding:8px;text-align:center;color:#cbd5e1;">'+s.visits+'</td>'+
'<td style="padding:8px;text-align:center;color:#818cf8;">'+s.submits+'</td>'+
'<td style="padding:8px;text-align:center;color:#10b981;">'+avg+'/70</td>'+
'<td style="padding:8px;text-align:center;color:#94a3b8;font-size:10px;">'+last.trim()+'</td>'+
'</tr>';
});
srcHTML+='</tbody></table>';

// Daily Breakdown
var allDates=Object.keys(r.days).sort().reverse().slice(0,14);
var allSources=Object.keys(r.sources).sort();
var dailyHTML='<h3 style="color:#a5b4fc;margin-top:20px;">📅 Daily Breakdown (Last 14 Days)</h3>'+
'<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;">'+
'<thead><tr style="background:#0f172a;color:#cbd5e1;">'+
'<th style="padding:8px;text-align:left;">Date</th>';
allSources.forEach(function(s){dailyHTML+='<th style="padding:8px;">'+s+'</th>';});
dailyHTML+='<th style="padding:8px;">Total</th></tr></thead><tbody>';

if(allDates.length===0){
dailyHTML+='<tr><td colspan="'+(allSources.length+2)+'" style="padding:20px;text-align:center;color:#64748b;">No UTM visits yet. Share links with ?utm_source=whatsapp etc.</td></tr>';
}

allDates.forEach(function(date){
var dayData=r.days[date]||{};
var total=0;var cells='';
allSources.forEach(function(s){
var count=dayData[s]?Object.keys(dayData[s].devices).length:0;
total+=count;
var colors={whatsapp:'#25D366',instagram:'#E1306C',facebook:'#1877F2',telegram:'#0088cc',direct:'#64748b',referral:'#f59e0b'};
var c=colors[s]||'#94a3b8';
cells+='<td style="padding:8px;text-align:center;color:'+(count>0?c:'#475569')+';font-weight:'+(count>0?'700':'400')+';">'+(count>0?count:'—')+'</td>';
});
var dateStr=date.slice(8)+'/'+date.slice(5,7)+'/'+date.slice(0,4);
dailyHTML+='<tr style="border-bottom:1px solid #334155;">'+
'<td style="padding:8px;text-align:left;color:#e2e8f0;font-weight:600;">'+dateStr+'</td>'+
cells+
'<td style="padding:8px;text-align:center;color:#818cf8;font-weight:700;">'+(total||'—')+'</td>'+
'</tr>';
});
dailyHTML+='</tbody></table></div>';

// Campaign Summary
var campEntries=Object.entries(r.campaigns).sort(function(a,b){return b[1].devices-a[1].devices;});
var campHTML='';
if(campEntries.length>0){
campHTML='<h3 style="color:#a5b4fc;margin-top:20px;">🎯 Campaign Performance</h3>'+
'<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;">'+
'<thead><tr style="background:#0f172a;color:#cbd5e1;">'+
'<th style="padding:8px;text-align:left;">Campaign</th>'+
'<th style="padding:8px;">Source</th>'+
'<th style="padding:8px;">Devices</th>'+
'<th style="padding:8px;">Visits</th>'+
'<th style="padding:8px;">Submits</th>'+
'</tr></thead><tbody>';
campEntries.forEach(function(e){
var name=e[0],c=e[1];
campHTML+='<tr style="border-bottom:1px solid #334155;">'+
'<td style="padding:8px;text-align:left;color:#fbbf24;font-weight:600;">'+name+'</td>'+
'<td style="padding:8px;text-align:center;color:#cbd5e1;font-size:10px;">'+c.source+'</td>'+
'<td style="padding:8px;text-align:center;color:#fff;font-weight:700;">'+c.devices+'</td>'+
'<td style="padding:8px;text-align:center;color:#cbd5e1;">'+c.visits+'</td>'+
'<td style="padding:8px;text-align:center;color:#818cf8;">'+c.submits+'</td>'+
'</tr>';
});
campHTML+='</tbody></table>';
}

wrap.innerHTML=srcHTML+dailyHTML+campHTML;
}

// Inject Report Section into admin panel
setTimeout(function(){
var panel=document.getElementById('admin-panel');
if(!panel||document.getElementById('utm-report'))return;

var report=document.createElement('div');
report.id='utm-report';
report.style.cssText='margin-top:20px;padding:16px;background:#0f172a;border-radius:12px;border:1px solid #334155;';
report.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px;">'+
'<h2 style="color:#a5b4fc;font-size:16px;margin:0;">📈 UTM Source Report</h2>'+
'<button id="utm-report-toggle" style="padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Show / Hide</button>'+
'</div>'+
'<div id="utm-report-body" style="display:none;"></div>';

var deviceInfo=document.getElementById('user-device-info');
if(deviceInfo&&deviceInfo.nextSibling){
deviceInfo.parentNode.insertBefore(report,deviceInfo.nextSibling);
}else{
panel.appendChild(report);
}

document.getElementById('utm-report-toggle').addEventListener('click',function(){
var body=document.getElementById('utm-report-body');
if(body.style.display==='none'){body.style.display='block';renderReport();}
else{body.style.display='none';}
});

var origR=window.refreshAdmin;
window.refreshAdmin=function(f){
origR(f);
setTimeout(function(){
var b=document.getElementById('utm-report-body');
if(b&&b.style.display==='block')renderReport();
},500);
};
},3000);

// Self info
var infoBox=document.getElementById('user-device-info');
if(infoBox&&!infoBox.querySelector('.utm-self')){
var div=document.createElement('div');
div.className='utm-self';
div.innerHTML='<b>Source:</b> '+(currentUTM.utm_source||'direct')+' ('+(currentUTM.utm_medium||'none')+')';
infoBox.appendChild(div);
}

console.log('UTM v2 active:',currentUTM);
}

ready();
})();

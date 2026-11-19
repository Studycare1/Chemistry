// === UTM Tracking Addon ===
(function(){
'use strict';

function ready(){
if(typeof firebase==='undefined'||typeof window.refreshAdmin==='undefined'){
return setTimeout(ready,300);
}

var DB_BASE='https://studycare-chemistry-default-rtdb.firebaseio.com';

function captureUTM(){
var params=new URLSearchParams(window.location.search);
var keys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
var utm={};var hasUTM=false;
keys.forEach(function(k){var v=params.get(k);if(v){utm[k]=v;hasUTM=true;}});
if(document.referrer)utm.referrer=document.referrer;
if(hasUTM){
utm.capturedAt=new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});
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
return cur;
}

var currentUTM=captureUTM();
var deviceId=null;
try{deviceId=localStorage.getItem('sc_chem_device_id');}catch(e){}
if(deviceId){
fetch(DB_BASE+'/devices/'+deviceId+'/info/utm.json',{
method:'PUT',headers:{'Content-Type':'application/json'},
body:JSON.stringify(currentUTM)
}).catch(function(){});
}

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

setTimeout(function(){
var stats=document.querySelector('#admin-panel .admin-stats');
if(stats&&!document.getElementById('utm-filter-wrap')){
var wrap=document.createElement('div');
wrap.id='utm-filter-wrap';
wrap.style.cssText='margin:15px 0;padding:12px;background:#334155;border-radius:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;';
wrap.innerHTML='<label style="color:#cbd5e1;font-size:12px;font-weight:600;">Filter by Source:</label>'+
'<select id="utm-source-select" style="padding:6px 12px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#fff;font-size:12px;">'+
'<option value="all">All Sources</option>'+
'<option value="whatsapp">WhatsApp</option>'+
'<option value="instagram">Instagram</option>'+
'<option value="facebook">Facebook</option>'+
'<option value="telegram">Telegram</option>'+
'<option value="direct">Direct</option>'+
'<option value="referral">Referral</option>'+
'</select>'+
'<span id="utm-count" style="color:#818cf8;font-size:12px;font-weight:700;"></span>';
stats.parentNode.insertBefore(wrap,stats);

document.getElementById('utm-source-select').addEventListener('change',function(){
var source=this.value;
var rows=document.querySelectorAll('#admin-device-body tr');
var cache=window.allDevicesCache||[];
var sorted=cache.slice().sort(function(a,b){
var aOn=a.info&&a.info.online?1:0;
var bOn=b.info&&b.info.online?1:0;
if(bOn!==aOn)return bOn-aOn;
return (b.submitCount||0)-(a.submitCount||0);
});
var visible=0;
rows.forEach(function(tr,idx){
if(!sorted[idx])return;
var utm=(sorted[idx].info&&sorted[idx].info.utm)||{};
var devSource=utm.utm_source||'direct';
if(source==='all'||devSource===source){tr.style.display='';visible++;}
else{tr.style.display='none';}
});
document.getElementById('utm-count').textContent='('+visible+' devices)';
});
}
},3000);

var infoBox=document.getElementById('user-device-info');
if(infoBox&&!infoBox.querySelector('.utm-self')){
var div=document.createElement('div');
div.className='utm-self';
div.innerHTML='<b>Source:</b> '+(currentUTM.utm_source||'direct');
infoBox.appendChild(div);
}

console.log('UTM active:',currentUTM);
}

ready();
})();

/* GA Scheduler 0.54.18f Data Manager persistence, bulk URL save, and Form access diagnostics. */
(function(){
  if (window.__gaDataManagerV05418F) return;
  window.__gaDataManagerV05418F = true;

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function msg(text,type){ try{ if(typeof window.setMsg==='function') window.setMsg(text,type||'ok'); }catch(e){} }
  function schoolPayload(){
    var out={};
    try{
      var ctx=window.campusContextV5253||window.campusContext||window.selectedCampusContext||{};
      var cur=ctx.currentCampus||{};
      var sel=by('campusSelector');
      var opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;
      var sid=clean((sel&&sel.value)||ctx.selectedCampusId||ctx.schoolId||ctx.campusId||cur.campusId||cur.id||'');
      var ss=clean(ctx.selectedSpreadsheetId||ctx.spreadsheetId||cur.spreadsheetId||(opt&&(opt.getAttribute('data-spreadsheet-id')||opt.getAttribute('data-ss-id')))||'');
      var nm=clean(ctx.selectedCampusName||ctx.schoolName||ctx.campusName||cur.campusName||cur.name||(opt&&opt.textContent)||'');
      if(sid) out.school=out.schoolId=out.selectedCampusId=out.campusId=sid;
      if(ss) out.spreadsheetId=out.selectedSpreadsheetId=ss;
      if(nm) out.name=out.schoolName=out.selectedCampusName=out.campusName=nm;
    }catch(e){}
    return out;
  }
  function qsPayload(){ var p=schoolPayload(), q=new URLSearchParams(); Object.keys(p).forEach(function(k){ if(p[k]) q.set(k,p[k]); }); q.set('_t',String(Date.now())); return q.toString(); }
  function jsonFetch(url, opts){
    opts=opts||{}; opts.credentials='same-origin'; opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});
    return fetch(url,opts).then(function(res){ return res.json().catch(function(){return {};}).then(function(j){ if(!res.ok||j.ok===false){var err=new Error(j.error||j.message||('Request failed: HTTP '+res.status)); err.response=j; throw err;} return j; }); });
  }
  function downloadJson(name,data){
    try{ var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href); a.remove();},1000); }catch(e){ console.log(data); }
  }
  function formatStamp(value){
    var s=clean(value); if(!s) return '';
    if(/^\d{1,2}\/\d{1,2}\/\d{4}\s*@\s*/.test(s)) return s;
    var d=new Date(s); if(Number.isNaN(d.getTime())) return s;
    var mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'), yyyy=d.getFullYear();
    var h=d.getHours(), ap=h>=12?'PM':'AM'; h=h%12||12;
    return mm+'/'+dd+'/'+yyyy+' @ '+String(h).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+' '+ap;
  }
  function setLastRefresh(value){
    var stamp=formatStamp(value)||'Not recorded';
    window.portalSettingsData=window.portalSettingsData||{};
    if(stamp!=='Not recorded') window.portalSettingsData.folderLastRefresh=stamp;
    ['dataManagerLastRefresh','folderLastRefresh'].forEach(function(id){ var el=by(id); if(el) el.textContent='Last refreshed on: '+stamp; });
    return stamp;
  }
  function rowIndexOf(st){ return Number(st&&(st.rowIndex||st.row||st.index)||0); }
  function patchStudent(rowIndex, patch){
    rowIndex=Number(rowIndex||0); if(!rowIndex) return;
    try{ var list=(window.studentData&&window.studentData.students)||[]; list.forEach(function(st){ if(rowIndexOf(st)===rowIndex) Object.assign(st,patch||{}); }); }catch(e){}
  }
  function patchDataFileRows(rows){
    (rows||[]).forEach(function(r){ patchStudent(r.rowIndex,{dataFiles:r.url||'',dataPoints:r.points||r.dataPoints||'',dataFilesLastUpdated:r.lastUpdated||r.dataFilesLastUpdated||''}); });
  }
  function staffKey(name){ return clean(name).toLowerCase().replace(/\s+/g,' '); }
  var staffMetricCacheF={};
  function applyStaffStats(stats){
    staffMetricCacheF=stats||staffMetricCacheF||{};
    try{ var list=(window.staffData&&window.staffData.staff)||[]; list.forEach(function(st){ var x=staffMetricCacheF[staffKey(st.name)]||staffMetricCacheF[clean(st.name)]||null; if(x){ st.lastDataSubmitted=x.lastSubmitted||x.lastDataSubmitted||''; st.dataPointsContributed=Number(x.count!=null?x.count:(x.dataPointsContributed||0)); } }); }catch(e){}
    try{ var cur=window.currentStaff||(typeof currentStaff!=='undefined'?currentStaff:null); if(cur){ var y=staffMetricCacheF[staffKey(cur.name)]||staffMetricCacheF[clean(cur.name)]||null; if(y){ cur.lastDataSubmitted=y.lastSubmitted||y.lastDataSubmitted||''; cur.dataPointsContributed=Number(y.count!=null?y.count:(y.dataPointsContributed||0)); } if(typeof window.updateStaffDataStatsUiV5288==='function') window.updateStaffDataStatsUiV5288(cur); } }catch(e2){}
  }
  function renderDataManagerSoon(){ try{ if(document.querySelector('#dataManager.active')&&typeof window.renderDataManager==='function') setTimeout(function(){window.renderDataManager(); enforceLastRefreshFromCache(); ensureDiagnosticButton();},30); }catch(e){} }
  function enforceLastRefreshFromCache(){ try{ if(window.portalSettingsData&&window.portalSettingsData.folderLastRefresh) setLastRefresh(window.portalSettingsData.folderLastRefresh); }catch(e){} }
  function applyMetricsResponse(r, opts){
    opts=opts||{}; r=r||{};
    var stamp=r.lastRefresh||(r.dataFiles&&r.dataFiles.summary&&r.dataFiles.summary.lastRefresh)||'';
    if(stamp) setLastRefresh(stamp);
    if(r.dataFiles&&r.dataFiles.rows) patchDataFileRows(r.dataFiles.rows);
    if(r.staffStats) applyStaffStats(r.staffStats);
    if(opts.render) renderDataManagerSoon();
    return r;
  }
  function loadPersistedMetrics(opts){
    opts=opts||{};
    return jsonFetch('/api/v054/data-metrics?'+qsPayload()).then(function(r){ return applyMetricsResponse(r,{render:!!opts.render}); }).catch(function(e){ if(opts.showErrors) msg('Could not load saved data metrics: '+(e.message||e),'err'); return null; });
  }
  function collectUrlRows(){
    return Array.prototype.slice.call(document.querySelectorAll('.dataManagerUrl')).map(function(input){ return { rowIndex:Number(input.getAttribute('data-data-url-row')||0), url:input.value||'' }; }).filter(function(r){return r.rowIndex>=2;});
  }
  function saveAllUrlsBulk(){
    var rows=collectUrlRows(); if(!rows.length){ msg('No data links to save.','warn'); return Promise.resolve(null); }
    msg('Saving all data links...','warn');
    return jsonFetch('/api/v05418f/student-data-urls/save-bulk',{method:'POST',body:JSON.stringify(Object.assign({},schoolPayload(),{rows:rows}))}).then(function(r){
      (r.rows||[]).forEach(function(x){ patchStudent(x.rowIndex,{dataFiles:x.url||'',dataPoints:x.dataPoints||'',dataFilesLastUpdated:x.dataFilesLastUpdated||''}); });
      msg(r.message||('Saved '+rows.length+' data link field(s).'),'ok');
      renderDataManagerSoon();
      return r;
    }).catch(function(e){ msg('Could not save all data links: '+(e.message||e),'err'); throw e; });
  }
  function refreshMetrics(){
    msg('Updating data points...','warn');
    return jsonFetch('/api/v054/data-metrics/refresh',{method:'POST',body:JSON.stringify(schoolPayload())}).then(function(r){
      applyMetricsResponse(r,{render:true});
      try{ if(typeof window.v5268CacheClear==='function'){ window.v5268CacheClear('students'); window.v5268CacheClear('staff'); window.v5268CacheClear('dashboard'); window.v5268CacheClear('settings'); } }catch(e){}
      var suffix=r.errors?' Some forms still failed response access.':'';
      msg((r.message||'Data points updated.')+suffix,r.errors?'warn':'ok');
      return r;
    }).catch(function(e){ msg('Could not update data points: '+(e.message||e),'err'); throw e; });
  }
  function ensureDiagnosticButton(){
    var old=by('dataFormDiagBtnV05418F');
    if(old&&old.parentNode)old.parentNode.removeChild(old);
  }
  function runFormDiagnostic(){
    msg('Running Form Access Diagnostic...','warn');
    var payload=Object.assign({},schoolPayload(),{limit:25});
    return jsonFetch('/api/v05418f/data-form-diagnostics',{method:'POST',body:JSON.stringify(payload)}).then(function(r){
      downloadJson('form-access-diagnostic-'+(r.version||'05418f')+'.json',r);
      var failed=(r.checked||[]).filter(function(x){return !x.ok;}).length;
      msg(failed?('Diagnostic complete: '+failed+' form(s) failed. JSON downloaded.'):'Diagnostic complete: checked forms passed. JSON downloaded.',failed?'warn':'ok');
      return r;
    }).catch(function(e){ msg('Could not run Form Access Diagnostic: '+(e.message||e),'err'); throw e; });
  }
  window.saveAllDataManagerUrlsV05418F=saveAllUrlsBulk;
  window.refreshDataMetricsV05418F=refreshMetrics;
  window.loadPersistedDataMetricsV05418F=loadPersistedMetrics;
  window.runDataFormAccessDiagnosticsV05418F=runFormDiagnostic;

  window.addEventListener('click',function(e){
    var t=e.target&&e.target.closest?e.target.closest('[data-action],[data-run]'):null; if(!t) return;
    var a=t.getAttribute('data-action')||'', run=t.getAttribute('data-run')||'';
    if(a==='data-save-all-urls'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); saveAllUrlsBulk(); return false; }
    if(a==='data-form-diagnostic'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); runFormDiagnostic(); return false; }
    if(run==='folders'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); refreshMetrics(); return false; }
  },true);

  var baseRender=window.renderDataManager;
  if(typeof baseRender==='function'&&!baseRender.__v05418F){
    window.renderDataManager=function(){ var r=baseRender.apply(this,arguments); enforceLastRefreshFromCache(); ensureDiagnosticButton(); clearTimeout(window.__dmMetricsF); window.__dmMetricsF=setTimeout(function(){loadPersistedMetrics({render:false});},100); return r; };
    window.renderDataManager.__v05418F=true; try{renderDataManager=window.renderDataManager;}catch(e){}
  }
  if(typeof window.registerNavigationAfterHookV5_==='function'){
    window.registerNavigationAfterHookV5_(function(page){ if(page==='dataManager'||page==='staff'||page==='students'||page==='settings'){ setTimeout(function(){ensureDiagnosticButton(); loadPersistedMetrics({render:false});},160); setTimeout(enforceLastRefreshFromCache,500); } },'v05418fDataMetricsPersistence');
  }
  function boot(){ ensureDiagnosticButton(); loadPersistedMetrics({render:false}); setTimeout(enforceLastRefreshFromCache,400); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,80);}); else setTimeout(boot,80);
})();

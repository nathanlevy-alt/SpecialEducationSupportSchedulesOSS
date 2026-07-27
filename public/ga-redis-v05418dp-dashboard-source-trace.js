(function(){
  if(window.__GA_V05418DP_DASHBOARD_CONTENT_GUARD__)return;
  window.__GA_V05418DP_DASHBOARD_CONTENT_GUARD__=true;
  var VERSION='v05418dp';
  var activeRequest=0;
  function by(id){return document.getElementById(id);} 
  function clean(v){return String(v==null?'':v).trim();}
  function lower(v){return clean(v).toLowerCase();}
  function esc(v){return clean(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function dashboardActive(){var d=by('dashboard');return !!(d&&d.classList&&d.classList.contains('active'));}
  function payload(){
    var p=null;
    try{if(typeof window.selectedSchoolPayloadForRedisV05418DJ==='function')p=window.selectedSchoolPayloadForRedisV05418DJ()||null;}catch(e){}
    if(!p){try{p=window.selectedSchoolPayloadV683&&window.selectedSchoolPayloadV683();}catch(e2){p=null;}}
    if(!p){try{p=window.calendarSelectedSchoolPayloadV5440&&window.calendarSelectedSchoolPayloadV5440();}catch(e3){p=null;}}
    if(!p){
      try{
        var s=JSON.parse(sessionStorage.getItem('gaSchedulerSchoolSessionV5450')||'null')||{};
        if(s.campusId||s.spreadsheetId)p={school:s.campusId,schoolId:s.campusId,campusId:s.campusId,selectedCampusId:s.campusId,schoolName:s.campusName,campusName:s.campusName,spreadsheetId:s.spreadsheetId,selectedSpreadsheetId:s.spreadsheetId};
      }catch(e4){}
    }
    if(!p){
      try{var sel=by('campusSelector');var opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;if(sel&&clean(sel.value))p={school:sel.value,schoolId:sel.value,campusId:sel.value,selectedCampusId:sel.value,schoolName:(opt&&opt.textContent)||sel.value,campusName:(opt&&opt.textContent)||sel.value,spreadsheetId:(opt&&(opt.getAttribute('data-spreadsheet-id')||opt.getAttribute('data-ss-id')||opt.getAttribute('data-sheet-id')))||'',selectedSpreadsheetId:(opt&&(opt.getAttribute('data-spreadsheet-id')||opt.getAttribute('data-ss-id')||opt.getAttribute('data-sheet-id')))||''};}catch(e5){}
    }
    p=p||{};
    var sid=clean(p.school||p.schoolId||p.campusId||p.selectedCampusId||p.id||'');
    var ss=clean(p.spreadsheetId||p.selectedSpreadsheetId||p.ssId||p.sheetId||'');
    var nm=clean(p.schoolName||p.campusName||p.selectedCampusName||p.name||sid);
    return {school:sid,schoolId:sid,campusId:sid,selectedCampusId:sid,id:sid,schoolName:nm,campusName:nm,selectedCampusName:nm,name:nm,spreadsheetId:ss,selectedSpreadsheetId:ss,ssId:ss,_dashboardAuthority:VERSION};
  }
  function scopeOf(o){o=o||{};return o.schoolScope||o.guard||o._schoolScope||(o.dashboardSummary&&o.dashboardSummary.schoolScope)||(o.scheduleNow&&o.scheduleNow.schoolScope)||(o.todo&&o.todo.schoolScope)||{};}
  function keyOf(p){p=p||{};return lower(p.school||p.schoolId||p.campusId||p.selectedCampusId||'')+'|'+lower(p.spreadsheetId||p.selectedSpreadsheetId||'');}
  function matches(o,p){
    if(!o||typeof o!=='object')return false;
    var s=scopeOf(o); if(!s||(!clean(s.school||s.schoolId||s.campusId||s.selectedCampusId)&&!clean(s.spreadsheetId||s.selectedSpreadsheetId)))return false;
    p=p||payload();
    var pc=lower(p.school||p.schoolId||p.campusId||p.selectedCampusId||'');
    var ps=lower(p.spreadsheetId||p.selectedSpreadsheetId||'');
    var sc=lower(s.school||s.schoolId||s.campusId||s.selectedCampusId||'');
    var ss=lower(s.spreadsheetId||s.selectedSpreadsheetId||'');
    if(pc&&sc&&pc!==sc)return false;
    if(ps&&ss&&ps!==ss)return false;
    return true;
  }
  function ownerMatches(o){return !!(o&&o.__dashboardOwnerV05418DP&&o.__dashboardOwnerV05418DP===window.__dashboardOwnerV05418DP);}
  function stamp(o,p){if(o&&typeof o==='object'){o.__dashboardOwnerV05418DP=window.__dashboardOwnerV05418DP;o.__dashboardOwnerSchoolKeyV05418DP=keyOf(p);o.__dashboardOwnerVersionV05418DP=VERSION;}return o;}
  function purgeCaches(){
    try{for(var i=sessionStorage.length-1;i>=0;i--){var k=sessionStorage.key(i)||'';if(/Dashboard|DashSummary|ScheduleNow|TodoItems|v5195|v5380|v5391|v5443|v5444|v686m20/i.test(k))sessionStorage.removeItem(k);}}catch(e){}
    try{if(typeof v5268CacheClear==='function')v5268CacheClear('dashboard');}catch(e2){}
  }
  function setHtml(id,html){var el=by(id);if(el)el.innerHTML=html;}
  function clearTiles(msg){
    try{window.dashboardSummary=null;dashboardSummary=null;}catch(e){window.dashboardSummary=null;}
    try{window.scheduleNowData=null;scheduleNowData=null;}catch(e2){window.scheduleNowData=null;}
    try{window.todoItemsData=[];todoItemsData=[];}catch(e3){window.todoItemsData=[];}
    setHtml('todaySummary','<div class="pill">Selected school</div>');
    setHtml('scheduleNowBox','<div class="muted">Loading selected-school schedule...</div>');
    setHtml('todoList','<div class="muted">Loading selected-school tasks...</div>');
    setHtml('dashUnassigned','<div class="muted">Loading selected-school unassigned assignments...</div>');
    setHtml('dashFreeTime','<div class="muted">Loading selected-school free-time data...</div>');
    setHtml('dashAbsences','<div class="muted">Loading selected-school attendance...</div>');
    setHtml('dashAttendance','<div class="muted">Loading selected-school attendance...</div>');
    setHtml('dashDataUpdates','<div class="muted">Loading selected-school data updates...</div>');
    setHtml('dashWarnings','<div class="muted">Loading selected-school warnings...</div>');
    try{var c=by('scheduleNowClock');if(c)c.textContent='';var h=by('scheduleNowHeaderToggle');if(h)h.innerHTML='';}catch(e4){}
    if(msg){try{if(typeof setMsg==='function')setMsg(msg,'warn');}catch(e5){}}
  }
  function callAdmin(fn,args,ok,fail){
    try{
      var r=google.script.run.withSuccessHandler(function(v){if(ok)ok(v);}).withFailureHandler(function(e){if(fail)fail(e);else if(typeof gsFailure==='function')gsFailure(e);});
      return r[fn].apply(r,args||[]);
    }catch(e){if(fail)fail(e);else if(typeof gsFailure==='function')gsFailure(e);}
  }
  var priorRenderSummary=typeof window.renderDashboardSummary==='function'?window.renderDashboardSummary:null;
  if(priorRenderSummary&&!priorRenderSummary.__v05418dp){
    var guardedSummary=function(){
      var d=null;try{d=window.dashboardSummary||((typeof dashboardSummary!=='undefined')?dashboardSummary:null);}catch(e){d=window.dashboardSummary;}
      if(d&&!ownerMatches(d)){setHtml('dashFreeTime','<div class="muted">Dashboard data was not loaded by the selected-school Dashboard loader. Use Refresh Data.</div>');return false;}
      return priorRenderSummary.apply(this,arguments);
    };
    guardedSummary.__v05418dp=true;window.renderDashboardSummary=guardedSummary;try{renderDashboardSummary=guardedSummary;}catch(e6){}
  }
  var priorRenderNow=typeof window.renderScheduleNow==='function'?window.renderScheduleNow:null;
  if(priorRenderNow&&!priorRenderNow.__v05418dp){
    var guardedNow=function(){
      var d=null;try{d=window.scheduleNowData||((typeof scheduleNowData!=='undefined')?scheduleNowData:null);}catch(e){d=window.scheduleNowData;}
      if(d&&!ownerMatches(d)){setHtml('scheduleNowBox','<div class="muted">Current schedule data was not loaded by the selected-school Dashboard loader. Use Refresh Data.</div>');return false;}
      return priorRenderNow.apply(this,arguments);
    };
    guardedNow.__v05418dp=true;window.renderScheduleNow=guardedNow;try{renderScheduleNow=guardedNow;}catch(e7){}
  }
  var priorRenderTodo=typeof window.renderTodoItems==='function'?window.renderTodoItems:null;
  if(priorRenderTodo&&!priorRenderTodo.__v05418dp){
    var guardedTodo=function(){
      var d=null;try{d=window.todoItemsData||((typeof todoItemsData!=='undefined')?todoItemsData:null);}catch(e){d=window.todoItemsData;}
      if(d&&d.__dashboardOwnerV05418DP&&d.__dashboardOwnerV05418DP!==window.__dashboardOwnerV05418DP){setHtml('todoList','<div class="muted">Tasks were not loaded by the selected-school Dashboard loader. Use Refresh Data.</div>');return false;}
      return priorRenderTodo.apply(this,arguments);
    };
    guardedTodo.__v05418dp=true;window.renderTodoItems=guardedTodo;try{renderTodoItems=guardedTodo;}catch(e8){}
  }
  function renderPage(resp,p,req){
    if(req!==activeRequest)return;
    resp=resp||{};
    try{window.__gaDashboardLastSourceTraceV05418DP=resp.__dashboardSourceTraceV05418DP||resp.__dashboardSourceTraceV05418DO||resp.__legacySourceTraceV05418DP||resp.__legacySourceTraceV05418DO||null;}catch(_e){}
    if(!matches(resp,p)){clearTiles('Blocked Dashboard page because it did not match the selected school.');return;}
    var summary=resp.dashboardSummary||resp.summary||{};
    var now=resp.scheduleNow||{};
    try{if(summary&&typeof summary==='object')summary.__dashboardSourceTraceV05418DP=window.__gaDashboardLastSourceTraceV05418DP||null;if(now&&typeof now==='object')now.__dashboardSourceTraceV05418DP=window.__gaDashboardLastSourceTraceV05418DP||null;}catch(_e2){}
    if(!matches(summary,p)){clearTiles('Blocked Dashboard summary because it did not match the selected school.');return;}
    if(!matches(now,p)){setHtml('scheduleNowBox','<div class="muted">Current schedule did not match the selected school.</div>');now={schoolScope:scopeOf(resp),studentRows:[],staffRows:[],itemTitle:'Schedule'};}
    window.__dashboardOwnerV05418DP=VERSION+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,8)+'_'+keyOf(p);
    stamp(summary,p); stamp(now,p);
    try{window.dashboardSummary=summary;dashboardSummary=summary;}catch(e){window.dashboardSummary=summary;}
    try{window.scheduleNowData=now;scheduleNowData=now;}catch(e2){window.scheduleNowData=now;}
    try{if(typeof renderDashboardSummary==='function')renderDashboardSummary();}catch(e3){try{console.error('[v05418dp] Dashboard summary render failed',e3);}catch(x){}}
    try{if(typeof renderScheduleNow==='function')renderScheduleNow();}catch(e4){try{console.error('[v05418dp] Schedule Now render failed',e4);}catch(x2){}}
    try{if(typeof applyDashboardLayout==='function')applyDashboardLayout();}catch(e5){}
  }
  function loadTodo(p,req){
    callAdmin('getTodoItemsFastV5444',[p],function(resp){
      if(req!==activeRequest)return;
      if(!matches(resp,p)){setHtml('todoList','<div class="muted">Tasks did not match the selected school.</div>');return;}
      var items=(resp&&((resp.items)||(resp.todoItems)))||[];
      try{items.__dashboardOwnerV05418DP=window.__dashboardOwnerV05418DP;window.todoItemsData=items;todoItemsData=items;}catch(e){window.todoItemsData=items;}
      try{if(typeof renderTodoItems==='function')renderTodoItems();}catch(e2){setHtml('todoList','<div class="muted">Tasks loaded but could not render.</div>');}
    },function(){if(req===activeRequest)setHtml('todoList','<div class="muted">Tasks could not load.</div>');});
  }
  function loadDashboard(opts){
    opts=opts||{};
    if(opts.silentPrefetch&&!dashboardActive())return;
    var p=payload();
    if(!clean(p.school||p.campusId)&&!clean(p.spreadsheetId)){clearTiles('Select a school before loading Dashboard.');return;}
    var req=++activeRequest;
    purgeCaches();
    if(!opts.keepPaint)clearTiles('Loading selected school Dashboard...');
    var days=(by('dashDaysStale')&&by('dashDaysStale').value)||14;
    callAdmin('getDashboardPageFastV5443',[days,p],function(resp){renderPage(resp,p,req);loadTodo(p,req);if(req===activeRequest&&!opts.silentPrefetch){try{if(typeof setMsg==='function')setMsg('Dashboard refreshed.','ok');}catch(e){}}},function(err){if(req!==activeRequest)return;clearTiles('Dashboard could not load for the selected school.');try{if(typeof setMsg==='function')setMsg('Dashboard could not load: '+((err&&err.message)||err||'Unknown error'),'err');}catch(e){}});
  }
  loadDashboard.__v05418dp=true;
  window.loadDashboardSummary=loadDashboard;try{loadDashboardSummary=loadDashboard;}catch(e9){}
  window.loadScheduleNow=function(){return loadDashboard({refresh:true,forceRefresh:true,keepPaint:true});};try{loadScheduleNow=window.loadScheduleNow;}catch(e10){}
  document.addEventListener('click',function(e){var t=e&&e.target&&e.target.closest?e.target.closest('[data-action="refresh-all"],[data-action="dash-refresh"],[data-nav="dashboard"]'):null;if(!t)return;var a=t.getAttribute('data-action')||'';var nav=t.getAttribute('data-nav')||'';if(a==='refresh-all'&&dashboardActive()){e.preventDefault();e.stopPropagation();loadDashboard({refresh:true,forceRefresh:true});return;}if(a==='dash-refresh'){e.preventDefault();e.stopPropagation();loadDashboard({refresh:true,forceRefresh:true});return;}if(nav==='dashboard'){setTimeout(function(){loadDashboard({refresh:true,forceRefresh:true});},20);}},true);
  if(typeof window.registerNavigationAfterHookV5_==='function'){
    window.registerNavigationAfterHookV5_(function(page){if(page==='dashboard')setTimeout(function(){loadDashboard({refresh:true,forceRefresh:true});},60);},'v05418dpDashboardSingleSource');
  }
  document.addEventListener('change',function(e){var t=e&&e.target;if(t&&t.id==='campusSelector'){activeRequest++;purgeCaches();clearTiles('School changed. Loading selected school Dashboard...');}},true);
  function storageKeys(){
    var out=[];
    try{for(var i=0;i<sessionStorage.length;i++){var k=sessionStorage.key(i)||'';if(/dashboard|schedulenow|todo|v5195|v5443/i.test(k))out.push({store:'session',key:k,value:String(sessionStorage.getItem(k)||'').slice(0,300)});}}catch(e){}
    try{for(var j=0;j<localStorage.length;j++){var k2=localStorage.key(j)||'';if(/dashboard|schedulenow|todo|v5195|v5443/i.test(k2))out.push({store:'local',key:k2,value:String(localStorage.getItem(k2)||'').slice(0,300)});}}catch(e2){}
    return out.slice(0,120);
  }
  function textOf(id){var el=by(id);return (el&&el.innerText||'').slice(0,1200);}
  function findVisibleNamesFromText(text){
    return String(text||'').split(/\n+/).map(function(x){return clean(x).replace(/^[-•·\s]+/,'');}).filter(function(x){return x&&x.length>2&&!/^(No support needed|Students|Staff|Now:|Loading|Refresh|Data|Add|Display|Apply|days|No stale data updates|No active staff|Unassigned Assignments|Staff Free Time)$/i.test(x);}).slice(0,60);
  }
  window.gaV05418DPDashboardDiag=function(){return window.gaV05418DPDashboardSourceTrace();};
  window.gaV05418DPDashboardSourceTrace=function(){
    var ds=null,now=null,todo=null;try{ds=window.dashboardSummary||((typeof dashboardSummary!=='undefined')?dashboardSummary:null);}catch(e){ds=window.dashboardSummary;}try{now=window.scheduleNowData||((typeof scheduleNowData!=='undefined')?scheduleNowData:null);}catch(e2){now=window.scheduleNowData;}try{todo=window.todoItemsData||((typeof todoItemsData!=='undefined')?todoItemsData:null);}catch(e3){todo=window.todoItemsData;}
    var trace=window.__gaDashboardLastSourceTraceV05418DP||((ds&&ds.__dashboardSourceTraceV05418DP)||(now&&now.__dashboardSourceTraceV05418DP))||null;
    return {version:VERSION,selectedSchool:payload(),activeRequest:activeRequest,dashboardOwner:window.__dashboardOwnerV05418DP||'',dashboardScope:scopeOf(ds||{}),scheduleNowScope:scopeOf(now||{}),dashboardMatches:matches(ds||{},payload()),scheduleNowMatches:matches(now||{},payload()),dashboardOwnerMatches:ownerMatches(ds),scheduleNowOwnerMatches:ownerMatches(now),todoOwner:todo&&todo.__dashboardOwnerV05418DP||'',visible:{now:textOf('scheduleNowBox'),freeTime:textOf('dashFreeTime'),unassigned:textOf('dashUnassigned'),attendance:textOf('dashAttendance')||textOf('dashAbsences'),todo:textOf('todoList')},visibleNames:{now:findVisibleNamesFromText(textOf('scheduleNowBox')),freeTime:findVisibleNamesFromText(textOf('dashFreeTime'))},storageKeys:storageKeys(),crossSchoolContentBlocked:!!((ds&&ds.crossSchoolContentBlocked)||(now&&now.crossSchoolContentBlocked)),dashboardRosterGuard:(ds&&ds.dashboardRosterGuardV05418DP)||null,contentMismatches:((ds&&ds.crossSchoolContentMismatches)||(now&&now.crossSchoolContentMismatches)||[]).slice(0,20),sourceTrace:trace};
  };
})();

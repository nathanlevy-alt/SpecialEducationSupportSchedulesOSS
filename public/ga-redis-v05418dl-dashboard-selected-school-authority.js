(function(){
  if(window.__GA_V05418DL_DASHBOARD_SELECTED_SCHOOL_AUTHORITY__)return;
  window.__GA_V05418DL_DASHBOARD_SELECTED_SCHOOL_AUTHORITY__=true;
  var VERSION='v05418dl';
  function clean(v){return String(v==null?'':v).trim();}
  function lower(v){return clean(v).toLowerCase();}
  function by(id){return document.getElementById(id);}
  function esc(v){return clean(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function tabSchool(){
    var out=null;
    try{if(typeof window.selectedSchoolPayloadForRedisV05418DJ==='function')out=window.selectedSchoolPayloadForRedisV05418DJ()||null;}catch(e){}
    if(out&&(out.school||out.schoolId||out.campusId||out.selectedCampusId||out.spreadsheetId||out.selectedSpreadsheetId))return out;
    try{out=window.__schoolSessionV5450||JSON.parse(sessionStorage.getItem('gaSchedulerSchoolSessionV5450')||'null');}catch(e2){out=null;}
    if(out&&(out.campusId||out.schoolId||out.spreadsheetId))return {school:out.campusId||out.schoolId||out.school||'',schoolId:out.campusId||out.schoolId||out.school||'',campusId:out.campusId||out.schoolId||out.school||'',selectedCampusId:out.campusId||out.schoolId||out.school||'',schoolName:out.campusName||out.schoolName||'',campusName:out.campusName||out.schoolName||'',spreadsheetId:out.spreadsheetId||out.selectedSpreadsheetId||'',selectedSpreadsheetId:out.spreadsheetId||out.selectedSpreadsheetId||''};
    try{var sel=by('campusSelector');var opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;if(sel&&clean(sel.value)){var ss=opt&&(opt.getAttribute('data-spreadsheet-id')||opt.getAttribute('data-ss-id')||opt.getAttribute('data-sheet-id')||'');var nm=opt&&(opt.getAttribute('data-campus-name')||opt.getAttribute('data-school-name')||opt.textContent||'');return {school:sel.value,schoolId:sel.value,campusId:sel.value,selectedCampusId:sel.value,schoolName:nm,campusName:nm,spreadsheetId:ss,selectedSpreadsheetId:ss};}}catch(e3){}
    return {};
  }
  function canonicalPayload(){
    var p=tabSchool()||{};
    var sid=clean(p.school||p.schoolId||p.campusId||p.selectedCampusId||p.id||'');
    var ss=clean(p.spreadsheetId||p.selectedSpreadsheetId||p.ssId||'');
    var nm=clean(p.schoolName||p.campusName||p.selectedCampusName||p.name||'');
    return {school:sid,schoolId:sid,campusId:sid,selectedCampusId:sid,id:sid,schoolName:nm,campusName:nm,selectedCampusName:nm,name:nm,spreadsheetId:ss,selectedSpreadsheetId:ss,ssId:ss};
  }
  function forceCanonicalPayload(obj){
    obj=obj||{}; var p=canonicalPayload(); var out={};
    Object.keys(obj).forEach(function(k){out[k]=obj[k];});
    Object.keys(p).forEach(function(k){if(p[k])out[k]=p[k];});
    out._selectedSchool=Object.assign({},p);
    return out;
  }
  function scopeOf(obj){obj=obj||{};return obj.schoolScope||obj.guard||obj._schoolScope||(obj.dashboardSummary&&obj.dashboardSummary.schoolScope)||(obj.scheduleNow&&obj.scheduleNow.schoolScope)||(obj.todo&&obj.todo.schoolScope)||{};}
  function hasScope(obj){var s=scopeOf(obj);return !!(s&&(s.school||s.schoolId||s.campusId||s.selectedCampusId||s.spreadsheetId||s.selectedSpreadsheetId));}
  function matchesSchool(obj){
    if(!obj||typeof obj!=='object')return true;
    var s=scopeOf(obj); if(!hasScope(obj))return false;
    var p=canonicalPayload();
    var pc=lower(p.school||p.schoolId||p.campusId||p.selectedCampusId||'');
    var ps=lower(p.spreadsheetId||p.selectedSpreadsheetId||'');
    var sc=lower(s.school||s.schoolId||s.campusId||s.selectedCampusId||'');
    var ss=lower(s.spreadsheetId||s.selectedSpreadsheetId||'');
    if(pc&&sc&&pc!==sc)return false;
    if(ps&&ss&&ps!==ss)return false;
    return true;
  }
  function clearTiles(reason){
    try{window.dashboardSummary=null;dashboardSummary=null;}catch(e){window.dashboardSummary=null;}
    try{window.scheduleNowData=null;scheduleNowData=null;}catch(e2){window.scheduleNowData=null;}
    try{window.todoItemsData=[];todoItemsData=[];}catch(e3){window.todoItemsData=[];}
    var map={todaySummary:'<div class="pill">Selected school</div>',dashAbsences:'<div class="muted">No selected-school absences loaded.</div>',dashAttendance:'<div class="muted">No selected-school absences loaded.</div>',dashUnassigned:'<div class="muted">No selected-school unassigned assignments loaded.</div>',dashFreeTime:'<div class="muted">No selected-school free-time data loaded.</div>',dashDataUpdates:'<div class="muted">No selected-school data updates loaded.</div>',dashWarnings:'<div class="muted">No selected-school warnings loaded.</div>',scheduleNowBox:'<div class="muted">No selected-school schedule data loaded.</div>',todoList:'<div class="muted">No selected-school tasks loaded.</div>'};
    Object.keys(map).forEach(function(id){var el=by(id);if(el)el.innerHTML=map[id];});
    try{var c=by('scheduleNowClock');if(c)c.textContent=''; var h=by('scheduleNowHeaderToggle');if(h)h.innerHTML='';}catch(e4){}
    if(reason){try{if(typeof setMsg==='function')setMsg(reason,'warn');}catch(e5){}}
  }
  function purgeDashboardCaches(){
    try{if(typeof v5268CacheClear==='function')v5268CacheClear('dashboard');}catch(e){}
    try{for(var i=sessionStorage.length-1;i>=0;i--){var k=sessionStorage.key(i)||'';if(/Dashboard|DashSummary|ScheduleNow|TodoItems|v5195|v5380|v5391|v5443|v5444/i.test(k))sessionStorage.removeItem(k);}}catch(e2){}
  }
  function isDashboardActive(){var el=by('dashboard');return !!(el&&el.classList&&el.classList.contains('active'));}

  // v0.54.18dl: Dashboard must not be prewarmed in the background. This was the
  // re-entry contamination pattern: a silent Dashboard refresh could run while another
  // page owned stale school globals and then repaint when Dashboard was opened again.
  window.v5268StartBackgroundPrefetch=function(){return;};

  // Make older client payload helpers authoritative too. Server-side enforcement is the
  // main fix, but this prevents stale spreadsheetId fields from even leaving the browser.
  try{
    window.selectedSchoolPayloadV683=function(){return canonicalPayload();};
    selectedSchoolPayloadV683=window.selectedSchoolPayloadV683;
  }catch(e6){}
  try{
    window.calendarSelectedSchoolPayloadV5440=function(){return canonicalPayload();};
    calendarSelectedSchoolPayloadV5440=window.calendarSelectedSchoolPayloadV5440;
  }catch(e7){}

  var baseRenderSummary=(typeof window.renderDashboardSummary==='function')?window.renderDashboardSummary:null;
  if(baseRenderSummary&&!baseRenderSummary.__v05418dl){
    var renderSummary=function(){
      var ds=null;try{ds=window.dashboardSummary||((typeof dashboardSummary!=='undefined')?dashboardSummary:null);}catch(e){ds=window.dashboardSummary;}
      if(ds&&!matchesSchool(ds)){clearTiles('Blocked Dashboard data that was missing or did not match the selected school. Refreshing selected school data.');return false;}
      return baseRenderSummary.apply(this,arguments);
    };
    renderSummary.__v05418dl=true;window.renderDashboardSummary=renderSummary;try{renderDashboardSummary=renderSummary;}catch(e8){}
  }
  var baseRenderNow=(typeof window.renderScheduleNow==='function')?window.renderScheduleNow:null;
  if(baseRenderNow&&!baseRenderNow.__v05418dl){
    var renderNow=function(){
      var d=null;try{d=window.scheduleNowData||((typeof scheduleNowData!=='undefined')?scheduleNowData:null);}catch(e){d=window.scheduleNowData;}
      if(d&&!matchesSchool(d)){var el=by('scheduleNowBox');if(el)el.innerHTML='<div class="muted">Blocked current schedule data that did not match the selected school.</div>';return false;}
      return baseRenderNow.apply(this,arguments);
    };
    renderNow.__v05418dl=true;window.renderScheduleNow=renderNow;try{renderScheduleNow=renderNow;}catch(e9){}
  }

  var baseLoadDash=(typeof window.loadDashboardSummary==='function')?window.loadDashboardSummary:null;
  if(baseLoadDash&&!baseLoadDash.__v05418dl){
    var lastStarted=0;
    var loadDash=function(opts){
      opts=opts||{};
      if(opts.silentPrefetch&&!isDashboardActive())return;
      var now=Date.now();
      var fresh=Object.assign({},opts,{preferCache:false,refresh:true,forceRefresh:true,forceFresh:true});
      if(!opts.silentPrefetch){
        if(now-lastStarted>300){purgeDashboardCaches();clearTiles('Loading selected school Dashboard...');}
        lastStarted=now;
      }
      return baseLoadDash.call(this,fresh);
    };
    loadDash.__v05418dl=true;window.loadDashboardSummary=loadDash;try{loadDashboardSummary=loadDash;}catch(e10){}
  }

  document.addEventListener('click',function(e){var t=e&&e.target&&e.target.closest?e.target.closest('[data-nav="dashboard"],[data-action="dash-refresh"],[data-action="refresh-all"]'):null;if(!t)return;if(t.getAttribute('data-nav')==='dashboard'||t.getAttribute('data-action')==='dash-refresh'||t.getAttribute('data-action')==='refresh-all'){purgeDashboardCaches();clearTiles('Loading selected school Dashboard...');}},true);
  if(typeof window.registerNavigationAfterHookV5_==='function'){
    window.registerNavigationAfterHookV5_(function(page){if(page==='dashboard'){setTimeout(function(){try{if(typeof window.loadDashboardSummary==='function')window.loadDashboardSummary({preferCache:false,refresh:true,forceRefresh:true});}catch(e){}},30);}},'v05418dlDashboardAuthority');
  }
  window.gaV05418DLDashboardDiag=function(){return {version:VERSION,selectedSchool:canonicalPayload(),dashboardScope:scopeOf(window.dashboardSummary||{}),scheduleNowScope:scopeOf(window.scheduleNowData||{}),dashboardMatches:matchesSchool(window.dashboardSummary||{}),scheduleNowMatches:matchesSchool(window.scheduleNowData||{})};};
})();

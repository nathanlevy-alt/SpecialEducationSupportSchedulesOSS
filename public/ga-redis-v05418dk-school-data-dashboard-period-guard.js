(function(){
  if(window.__GA_V05418DK_SCHOOL_DATA_DASHBOARD_PERIOD_GUARD__)return;
  window.__GA_V05418DK_SCHOOL_DATA_DASHBOARD_PERIOD_GUARD__=true;
  var VERSION='v05418dk';
  function clean(v){return String(v==null?'':v).trim();}
  function lower(v){return clean(v).toLowerCase();}
  function by(id){return document.getElementById(id);}
  function schoolPayload(){
    try{if(typeof window.selectedSchoolPayloadForRedisV05418DJ==='function'){var p=window.selectedSchoolPayloadForRedisV05418DJ()||{};if(p.campusId||p.schoolId||p.school||p.spreadsheetId)return p;}}catch(e){}
    try{var sel=by('campusSelector');var opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;if(sel&&clean(sel.value)){var ss=opt&&(opt.getAttribute('data-spreadsheet-id')||opt.getAttribute('data-ss-id')||'');var nm=opt&&(opt.getAttribute('data-campus-name')||opt.getAttribute('data-school-name')||opt.textContent||'');return {school:sel.value,schoolId:sel.value,campusId:sel.value,campusName:nm,schoolName:nm,spreadsheetId:ss,selectedSpreadsheetId:ss};}}catch(e2){}
    return {};
  }
  function scopeOf(obj){return (obj&&(obj.schoolScope||obj.guard||obj._schoolScope))||{};}
  function matches(obj){
    if(!obj||typeof obj!=='object')return true;
    var scope=scopeOf(obj); if(!scope||(!scope.campusId&&!scope.schoolId&&!scope.school&&!scope.spreadsheetId&&!scope.selectedSpreadsheetId))return true;
    var p=schoolPayload();
    var pc=lower(p.campusId||p.schoolId||p.school||p.selectedCampusId||'');
    var ps=lower(p.spreadsheetId||p.selectedSpreadsheetId||'');
    var sc=lower(scope.campusId||scope.schoolId||scope.school||scope.selectedCampusId||'');
    var ss=lower(scope.spreadsheetId||scope.selectedSpreadsheetId||'');
    if(pc&&sc&&pc!==sc)return false;
    if(ps&&ss&&ps!==ss)return false;
    return true;
  }
  function msg(text,type){try{if(typeof setMsg==='function')setMsg(text,type||'warn');}catch(e){}}
  function clearDashboardPaint(){
    try{window.dashboardSummary=null;dashboardSummary=null;}catch(e){}
    try{window.scheduleNowData=null;scheduleNowData=null;}catch(e2){}
    try{window.todoItemsData=[];todoItemsData=[];}catch(e3){}
    ['dashAbsences','dashUnassigned','dashFreeTime','dashDataUpdates','dashWarnings','scheduleNowBox','todoList'].forEach(function(id){var el=by(id);if(el)el.innerHTML='<div class="muted">No selected-school data loaded.</div>';});
  }
  function clearSchoolScopedSessionCaches(){
    try{for(var i=sessionStorage.length-1;i>=0;i--){var k=sessionStorage.key(i)||'';if(/Dash|Dashboard|ScheduleNow|Todo|Student|Staff|ScheduleViews|Period|period|v5444|v5443|v5380|v5195|v686m20/i.test(k))sessionStorage.removeItem(k);}}catch(e){}
    try{if(typeof v5268CacheClear==='function'){v5268CacheClear('dashboard');v5268CacheClear('students');v5268CacheClear('staff');v5268CacheClear('scheduleViews');}}catch(e2){}
  }
  var baseRenderDashboard=typeof window.renderDashboardSummary==='function'?window.renderDashboardSummary:null;
  if(baseRenderDashboard&&!baseRenderDashboard.__v05418dkGuarded){
    var wrapped=function(){
      try{var d=window.dashboardSummary||dashboardSummary;if(d&&!matches(d)){clearDashboardPaint();msg('Dashboard data from another school was blocked. Refreshing selected school data.','err');return false;}}catch(e){}
      return baseRenderDashboard.apply(this,arguments);
    };
    wrapped.__v05418dkGuarded=true;window.renderDashboardSummary=wrapped;try{renderDashboardSummary=wrapped;}catch(e){}
  }
  var baseRenderNow=typeof window.renderScheduleNow==='function'?window.renderScheduleNow:null;
  if(baseRenderNow&&!baseRenderNow.__v05418dkGuarded){
    var wrappedNow=function(){try{var d=window.scheduleNowData||scheduleNowData;if(d&&!matches(d)){var el=by('scheduleNowBox');if(el)el.innerHTML='<div class="muted">Current schedule data was blocked because it belonged to another school.</div>';return false;}}catch(e){}return baseRenderNow.apply(this,arguments);};
    wrappedNow.__v05418dkGuarded=true;window.renderScheduleNow=wrappedNow;try{renderScheduleNow=wrappedNow;}catch(e){}
  }
  document.addEventListener('change',function(e){var t=e&&e.target;if(t&&t.id==='campusSelector'){clearSchoolScopedSessionCaches();clearDashboardPaint();try{if(window.gaV05418aiPeriodDiag&&typeof window.gaV05418aiPeriodDiag==='function'){} }catch(x){}}},true);
  window.gaV05418DKSchoolGuardDiag=function(){return {version:VERSION,school:schoolPayload(),dashboardScope:scopeOf(window.dashboardSummary||{}),scheduleNowScope:scopeOf(window.scheduleNowData||{}),dashboardMatches:matches(window.dashboardSummary||{})};};
})();

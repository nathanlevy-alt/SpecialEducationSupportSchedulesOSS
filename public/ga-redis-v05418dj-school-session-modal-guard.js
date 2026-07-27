(function(){
  if(window.__GA_V05418DJ_SCHOOL_SESSION_MODAL_GUARD__)return;
  window.__GA_V05418DJ_SCHOOL_SESSION_MODAL_GUARD__=true;
  var VERSION='v05418dk';
  function clean(v){return String(v==null?'':v).trim();}
  function lower(v){return clean(v).toLowerCase();}
  function by(id){return document.getElementById(id);}
  function msg(text,type){try{if(typeof setMsg==='function')setMsg(text,type||'warn');}catch(e){}}
  function tabId(){try{if(typeof window.gaSchedulerTabIdV05418DJ==='function')return window.gaSchedulerTabIdV05418DJ();}catch(e){}var id='';try{id=sessionStorage.getItem('gaSchedulerTabIdV05418DJ')||'';}catch(e2){}if(!id){id='tab_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);try{sessionStorage.setItem('gaSchedulerTabIdV05418DJ',id);}catch(e3){}}return id;}
  function selectedSchool(){try{if(typeof window.selectedSchoolPayloadForRedisV05418DJ==='function')return window.selectedSchoolPayloadForRedisV05418DJ()||{};}catch(e){}try{var ss=window.__schoolSessionV5450||JSON.parse(sessionStorage.getItem('gaSchedulerSchoolSessionV5450')||'{}');if(ss&&(ss.campusId||ss.spreadsheetId))return {campusId:ss.campusId,schoolId:ss.campusId,school:ss.campusId,campusName:ss.campusName,schoolName:ss.campusName,spreadsheetId:ss.spreadsheetId};}catch(e2){}try{var sel=by('campusSelector');var opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;return {campusId:(sel&&sel.value)||'',schoolId:(sel&&sel.value)||'',school:(sel&&sel.value)||'',campusName:(opt&&opt.textContent)||'',schoolName:(opt&&opt.textContent)||'',spreadsheetId:(opt&&(opt.getAttribute('data-spreadsheet-id')||opt.getAttribute('data-ss-id')||''))||''};}catch(e3){return {};}}
  function schoolKey(p){p=p||selectedSchool();return lower(p.campusId||p.schoolId||p.school||p.selectedCampusId||'')+'|'+lower(p.spreadsheetId||p.selectedSpreadsheetId||'');}
  function stripSchoolCaches(){try{for(var i=sessionStorage.length-1;i>=0;i--){var k=sessionStorage.key(i)||'';if(/Dash|Dashboard|ScheduleNow|Todo|Student|Staff|Calendar|Attendance|ScheduleViews|v5195|v5380|v5391|v5392|v5443|v5444|v5447|v5448|v686/i.test(k))sessionStorage.removeItem(k);}}catch(e){}try{if(typeof v5268CacheClear==='function')v5268CacheClear();}catch(e2){}try{window.dashboardSummary=null;dashboardSummary=null;}catch(e3){}try{window.scheduleNowData=null;scheduleNowData=null;}catch(e4){}try{window.todoItemsData=[];todoItemsData=[];}catch(e5){} }
  function stampSession(){var p=selectedSchool();var key=schoolKey(p);var s={tabId:tabId(),schoolKey:key,campusId:clean(p.campusId||p.schoolId||p.school||p.selectedCampusId||''),campusName:clean(p.campusName||p.schoolName||p.name||''),spreadsheetId:clean(p.spreadsheetId||p.selectedSpreadsheetId||''),updatedAt:new Date().toISOString(),version:VERSION};window.__gaSchoolIsolationV05418DJ=s;try{sessionStorage.setItem('gaSchoolIsolationV05418DJ',JSON.stringify(s));}catch(e){}return s;}
  function currentIsolation(){try{return window.__gaSchoolIsolationV05418DJ||JSON.parse(sessionStorage.getItem('gaSchoolIsolationV05418DJ')||'{}')||{};}catch(e){return {};}}
  function schoolMatchesScope(scope){scope=scope||{};var p=selectedSchool();var sc=lower(scope.campusId||scope.schoolId||scope.school||scope.selectedCampusId||'');var ss=lower(scope.spreadsheetId||scope.selectedSpreadsheetId||'');var pc=lower(p.campusId||p.schoolId||p.school||p.selectedCampusId||'');var ps=lower(p.spreadsheetId||p.selectedSpreadsheetId||'');if(sc&&pc&&sc!==pc)return false;if(ss&&ps&&ss!==ps)return false;return true;}
  window.gaSchoolIsolationGuardV05418DJ={version:VERSION,tabId:tabId,selectedSchool:selectedSchool,schoolKey:schoolKey,stamp:stampSession,clearCaches:stripSchoolCaches,schoolMatchesScope:schoolMatchesScope};

  var lastSchoolKey=schoolKey();
  stampSession();
  document.addEventListener('change',function(e){var t=e&&e.target;if(t&&t.id==='campusSelector'){var next=schoolKey();if(next!==lastSchoolKey){lastSchoolKey=next;stripSchoolCaches();stampSession();try{if(typeof clearDashboardStateAndCachesV5452==='function')clearDashboardStateAndCachesV5452('Switching school...');}catch(x){}}}},true);
  document.addEventListener('click',function(e){var t=e&&e.target&&e.target.closest?e.target.closest('[data-school-id],#schoolExitV5450,[data-action="system-admin-return-dashboard-v5456"]'):null;if(t){setTimeout(function(){lastSchoolKey=schoolKey();stripSchoolCaches();stampSession();},0);}},true);

  // Trusted UI action tracker. A modal should open because this tab's user clicked/typed,
  // not because another browser/device changed a shared server-side value.
  var lastTrustedAt=0;
  function markTrusted(e){try{if(!e||e.isTrusted!==false)lastTrustedAt=Date.now();window.__gaLastTrustedUiActionV05418DJ=lastTrustedAt;}catch(x){}}
  document.addEventListener('click',markTrusted,true);
  document.addEventListener('keydown',markTrusted,true);
  document.addEventListener('pointerdown',markTrusted,true);
  function recentTrusted(ms){return Date.now()-Math.max(lastTrustedAt,Number(window.__gaLastTrustedUiActionV05418DJ||0))<(ms||30000);}
  window.gaRecentTrustedUiActionV05418DJ=recentTrusted;
  function modalAllowList(el){var id=clean(el&&el.id);return /schoolLanding|schoolBoot|globalSearchModal|emulationModalOverlay|portalConfirm|publicCommPrefsModal|ssPasscode|lock|formPickerModal|advancedSchedulingModalV05418AQ|advancedSchedulingModal/i.test(id);}
  function isModal(el){if(!el||!el.classList)return false;var id=clean(el.id);var cls=clean(el.className);if(/modal|overlay|dialog/i.test(id+' '+cls))return true;return false;}
  function closeSuspiciousModal(el){try{if(!el||modalAllowList(el))return;if(!isModal(el))return;if(recentTrusted(30000))return;el.classList.remove('active','open','show');if(el.style&&/block|flex|grid/i.test(el.style.display||''))el.style.display='none';console.warn('Support Schedules modal guard blocked a non-local modal open:',el.id||el.className);msg('A modal was blocked because it was not opened by this browser tab. Refresh if you intended to open it.','warn');}catch(e){} }
  function scanModals(){try{Array.prototype.slice.call(document.querySelectorAll('.modal.active,.modal.show,.modal.open,[id*="Modal"].active,[id*="modal"].active,[role="dialog"]')).forEach(closeSuspiciousModal);}catch(e){}}
  if(typeof MutationObserver!=='undefined'){
    var mo=new MutationObserver(function(muts){var should=false;muts.forEach(function(m){if(m.type==='attributes'&&(m.attributeName==='class'||m.attributeName==='style'))should=true;if(m.addedNodes&&m.addedNodes.length)should=true;});if(should)setTimeout(scanModals,0);});
    try{mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});}catch(e){}
  }
  setTimeout(scanModals,1200);

  // Harden Advanced Scheduling specifically: it should only open from a trusted click in
  // this tab. This prevents any stale/synthetic cross-session open behavior.
  function wrapAdvanced(name){try{var fn=window[name];if(typeof fn!=='function'||fn.__gaV05418DJWrapped)return;var wrapped=function(ev){if(ev&&ev.isTrusted!==false)markTrusted(ev);if(!recentTrusted(30000)){console.warn('Blocked non-local advanced scheduling open:',name);return false;}return fn.apply(this,arguments);};wrapped.__gaV05418DJWrapped=true;window[name]=wrapped;try{eval(name+'=window[name]');}catch(e){}}catch(e2){}}
  function wrapKnown(){['openAdvancedSchedulingV05418Z','openAdvancedSchedulingV05418AB','openAdvancedSchedulingV05418AA','openAdvancedSchedulingV05418AQ'].forEach(wrapAdvanced);}
  wrapKnown();setTimeout(wrapKnown,500);setTimeout(wrapKnown,1500);
})();

(function(){
  'use strict';
  if(window.__gaRedisV054Loaded) return; window.__gaRedisV054Loaded = true;
  var VERSION='0.54.0';
  var scheduleShell=null;
  var lastSchoolKey='';
  var staffMetricCache={};
  function by(id){return document.getElementById(id);} 
  function qs(sel,root){return (root||document).querySelector(sel);} 
  function qsa(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel));}
  function clean(v){return String(v==null?'':v).trim();}
  function norm(v){return clean(v).toLowerCase().replace(/\s+/g,' ');} 
  function activePage(){try{if(typeof window.activeSectionIdV51229==='function')return window.activeSectionIdV51229()||'';}catch(e){}var s=qs('.section.active');return s?s.id:'';}
  function payload(){try{if(typeof window.selectedSchoolPayloadV683==='function')return window.selectedSchoolPayloadV683()||{};}catch(e){}try{if(typeof window.selectedSchoolPayloadV686m20==='function')return window.selectedSchoolPayloadV686m20()||{};}catch(e2){}try{var sel=by('campusSelector'), opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;return {school:(sel&&sel.value)||'',schoolId:(sel&&sel.value)||'',campusId:(sel&&sel.value)||'',spreadsheetId:(opt&&opt.getAttribute('data-spreadsheet-id'))||''};}catch(e3){return {};}}
  function schoolKey(){var p=payload();return clean(p.spreadsheetId||p.school||p.schoolId||p.campusId||'default').toLowerCase();}
  function api(path){var p=payload();var u=new URL(path,location.origin);['school','schoolId','campusId','spreadsheetId'].forEach(function(k){if(p[k])u.searchParams.set(k,p[k]);});return u.pathname+u.search;}
  function fetchJson(path,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(path,opts).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||j.message||('HTTP '+r.status));return j;});});}
  function addStyles(){
    if(by('gaRedisV054Styles')) return;
    var css=[
      '/* v054 */',
      '#dashboard .dashboardTile[data-tile="warnings"]{display:none!important}',
      '#staff .staffDataStatsV5288{display:grid!important;grid-template-columns:175px 270px minmax(250px,300px) minmax(320px,0.9fr) 150px!important;gap:8px!important;align-items:end!important;grid-column:1/-1!important;width:100%!important;max-width:none!important;margin:8px 0 0!important;overflow:visible!important}',
      '#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffPortalLinkFieldV5312,#staff #staffLastViewFieldV053,#staff #staffLastViewFieldV054{display:flex!important;flex-direction:column!important;justify-content:flex-end!important;align-self:end!important;min-width:0!important;width:100%!important;margin:0!important;padding:0!important;box-sizing:border-box!important;position:static!important;float:none!important}',
      '#staff #staffDataSubmittedFieldV5288 label,#staff #staffDataPointsFieldV5288 label,#staff #staffEmailFieldV024 label,#staff .staffEmailFieldV024 label,#staff #staffPortalLinkFieldV5312 label,#staff #staffLastViewFieldV053 label,#staff #staffLastViewFieldV054 label{display:inline-flex!important;align-items:center!important;gap:3px!important;height:17px!important;line-height:17px!important;min-height:17px!important;margin:0 0 5px!important;padding:0!important;white-space:nowrap!important;font-family:inherit!important;font-size:12px!important;font-weight:700!important;color:#0f172a!important;text-transform:none!important;letter-spacing:0!important}',
      '#staff #staffLastDataSubmittedV5288,#staff #staffDataPointsContributedV5288,#staff #staffNotificationEmailV686m41,#staff #staffPortalLinkV5312,#staff #staffLastViewV053,#staff #staffLastViewV054{height:32px!important;min-height:32px!important;line-height:30px!important;border-radius:12px!important;box-sizing:border-box!important;font-family:inherit!important;font-size:12px!important;font-weight:400!important;min-width:0!important;margin:0!important;padding:7px 10px!important;opacity:1!important}',
      '#staff #staffDataSubmittedFieldV5288{max-width:175px!important}#staff #staffLastDataSubmittedV5288{width:100%!important}',
      '#staff #staffDataPointsFieldV5288{max-width:270px!important}#staff #staffDataPointsFieldV5288 .staffDataContributionLineV5301{display:grid!important;grid-template-columns:86px 68px!important;gap:6px!important;align-items:center!important;justify-content:start!important;width:auto!important}#staff #staffDataPointsContributedV5288{width:86px!important;max-width:86px!important;text-align:left!important}#staff #staffDataViewBtnV5289{width:68px!important}',
      '#staff #staffEmailFieldV024,#staff .staffEmailFieldV024{max-width:300px!important}#staff #staffEmailFieldV024 .staffEmailInputLockWrapV025,#staff .staffEmailFieldV024 .staffEmailInputLockWrapV025{display:grid!important;grid-template-columns:minmax(0,1fr) 24px!important;gap:5px!important;align-items:center!important;width:100%!important}',
      '#staffEmailLockBtnV025,.staffEmailLockBtnV025.historyRegularBtn,.staffEmailLockBtnV025.historyLockV018{height:32px!important;min-height:32px!important;width:24px!important;min-width:24px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;color:#0f2a44!important;transition:none!important}',
      '#staffEmailLockBtnV025:hover,#staffEmailLockBtnV025:focus{background:transparent!important;border:0!important;box-shadow:none!important;outline:none!important}',
      '#staff #staffPortalLinkFieldV5312{max-width:none!important}#staff #staffPortalLinkFieldV5312 .staffPortalLinkLineV5312,#staff #staffPortalLinkFieldV5312 .inline{display:grid!important;grid-template-columns:minmax(0,1fr) 94px!important;gap:7px!important;align-items:center!important;width:100%!important}#staff .staffPortalCopyBtnV5312{width:94px!important}',
      '#staff #staffLastViewFieldV053,#staff #staffLastViewFieldV054{max-width:150px!important}#staff #staffLastViewV053,#staff #staffLastViewV054{width:100%!important;background:#f8fafc!important;color:#475569!important;border:1px solid #d8e1ef!important;text-align:left!important;font-weight:400!important}',
      '#staff #staffLastViewV053.staleV052,#staff #staffLastViewV054.staleV052,#staff #staffLastViewV053.staleV053,#staff #staffLastViewV054.staleV053,#staff #staffLastViewV053.staleV054,#staff #staffLastViewV054.staleV054,#staff #staffLastViewV053.staleViewV027,#staff #staffLastViewV054.staleViewV027{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important;font-weight:400!important}',
      '#staff .staffDataViewBtnV5289,#staff .staffPortalCopyBtnV5312{height:32px!important;min-height:32px!important;padding:6px 10px!important;border-radius:12px!important;font-family:inherit!important;font-size:12px!important;font-weight:800!important;line-height:1.1!important;white-space:nowrap!important;margin:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}',
      '@media(max-width:1500px){#staff .staffDataStatsV5288{grid-template-columns:160px 250px minmax(230px,280px) minmax(280px,0.9fr) 140px!important;gap:7px!important}#staff #staffEmailFieldV024,#staff .staffEmailFieldV024{max-width:280px!important}#staff #staffLastViewFieldV053,#staff #staffLastViewFieldV054{max-width:140px!important}}',
      '@media(max-width:1180px){#staff .staffDataStatsV5288{grid-template-columns:repeat(2,minmax(220px,1fr))!important}#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffLastViewFieldV053,#staff #staffLastViewFieldV054{max-width:none!important}}'
    ].join('\n');
    var st=document.createElement('style');st.id='gaRedisV054Styles';st.textContent=css;document.head.appendChild(st);
  }
  function normalizeStaffRow(){
    if(activePage()!=='staff') return;
    addStyles();
    var wrap=qs('#staff .staffDataStatsV5288'); if(!wrap) return;
    var lastField=by('staffLastViewFieldV054')||by('staffLastViewFieldV053')||by('staffLastViewFieldV052')||qs('#staff [id^="staffLastViewField"]');
    if(lastField){lastField.id='staffLastViewFieldV054'; var inp=lastField.querySelector('input'); if(inp){inp.id='staffLastViewV054';inp.style.fontWeight='400';}}
    qsa('#staff [id^="staffLastViewField"]').forEach(function(el){if(el.id!=='staffLastViewFieldV054'){try{el.remove();}catch(e){el.style.display='none';}}});
    qsa('#staff input[id^="staffLastView"]').forEach(function(el){if(el.id!=='staffLastViewV054'){var f=el.closest('[id^="staffLastViewField"]');if(f&&f.id!=='staffLastViewFieldV054'){try{f.remove();}catch(e){f.style.display='none';}}}});
    var order=['staffDataSubmittedFieldV5288','staffDataPointsFieldV5288','staffEmailFieldV024','staffPortalLinkFieldV5312','staffLastViewFieldV054'];
    order.forEach(function(id){var el=by(id)||qs('#staff .'+id); if(el&&el.parentNode!==wrap)wrap.appendChild(el);});
    var lock=by('staffEmailLockBtnV025');if(lock){lock.style.background='transparent';lock.style.border='0';lock.style.boxShadow='none';lock.style.borderRadius='0';lock.classList.add('historyLockV018');}
    var view=by('staffDataViewBtnV5289');if(view)view.classList.add('btn','small','staffDataViewBtnV5289');
    var copy=qs('#staff .staffPortalCopyBtnV5312');if(copy)copy.classList.add('btn','small','staffPortalCopyBtnV5312');
  }
  function scheduleStaffRow(){if(activePage()!=='staff')return;[0,80,250,600].forEach(function(ms){setTimeout(normalizeStaffRow,ms);});}

  function captureScheduleShell(){try{if(!scheduleShell&&by('schedule'))scheduleShell=by('schedule').innerHTML;}catch(e){}}
  function restoreScheduleShell(){try{if(scheduleShell&&by('schedule')){by('schedule').innerHTML=scheduleShell;try{window.scheduleData=null;scheduleData=null;}catch(e1){}try{window.selectedSchedule='';selectedSchedule='';}catch(e2){}return true;}}catch(e){}return false;}
  function installBellLifecycle(){
    captureScheduleShell();
    var prior=window.gaV049BeforePageSwitch;
    if(prior&&prior.__v054BellWrap) return;
    var wrapped=function(nextPage,btn,currentPage){
      currentPage=currentPage||activePage();
      if(currentPage==='schedule'&&nextPage!=='schedule') restoreScheduleShell();
      if(typeof prior==='function') return prior.apply(this,arguments);
      return true;
    };
    wrapped.__v054BellWrap=true;window.gaV049BeforePageSwitch=wrapped;
    if(typeof window.loadScheduleData==='function'&&!window.loadScheduleData.__v054SchoolWrap){
      var baseLoad=window.loadScheduleData;
      window.loadScheduleData=function(opts){
        opts=opts||{};
        var sk=schoolKey();
        if(lastSchoolKey&&sk&&sk!==lastSchoolKey){try{window.scheduleData=null;scheduleData=null;window.advancedSetupDataV5131=null;advancedSetupDataV5131=null;}catch(e){} opts.preferCache=false; opts.forceRefresh=true;}
        lastSchoolKey=sk;
        return baseLoad.call(this,opts);
      };
      window.loadScheduleData.__v054SchoolWrap=true;try{loadScheduleData=window.loadScheduleData;}catch(e){}
    }
    if(typeof window.loadAdvancedSetupDataV5131==='function'&&!window.loadAdvancedSetupDataV5131.__v054SchoolWrap){
      var baseAdv=window.loadAdvancedSetupDataV5131;
      window.loadAdvancedSetupDataV5131=function(cb){
        var sk=schoolKey();
        if(lastSchoolKey&&sk&&sk!==lastSchoolKey){try{window.advancedSetupDataV5131=null;advancedSetupDataV5131=null;}catch(e){}}
        lastSchoolKey=sk;
        return baseAdv.call(this,cb);
      };
      window.loadAdvancedSetupDataV5131.__v054SchoolWrap=true;try{loadAdvancedSetupDataV5131=window.loadAdvancedSetupDataV5131;}catch(e){}
    }
  }

  function staffStatsKey(name){return norm(name||'');}
  function mergeStaffMetricsIntoData(staffStats){
    staffMetricCache=staffStats||{};
    try{
      var list=(window.staffData&&window.staffData.staff)||(typeof staffData!=='undefined'&&staffData&&staffData.staff)||[];
      (list||[]).forEach(function(st){var k=staffStatsKey(st.name);var x=staffMetricCache[k]||staffMetricCache[clean(st.name)]||null;if(x){st.lastDataSubmitted=x.lastSubmitted||x.lastDataSubmitted||'';st.dataPointsContributed=Number(x.count!=null?x.count:(x.dataPointsContributed||0));}});
    }catch(e){}
  }
  function refreshStaffMetricUi(){
    try{var st=window.currentStaff||(typeof currentStaff!=='undefined'?currentStaff:null);if(!st)return;var x=staffMetricCache[staffStatsKey(st.name)]||staffMetricCache[clean(st.name)]||null;if(x){st.lastDataSubmitted=x.lastSubmitted||x.lastDataSubmitted||'';st.dataPointsContributed=Number(x.count!=null?x.count:(x.dataPointsContributed||0));} if(typeof window.updateStaffDataStatsUiV5288==='function')window.updateStaffDataStatsUiV5288(st); else {var last=by('staffLastDataSubmittedV5288'),cnt=by('staffDataPointsContributedV5288'); if(last)last.value=(st.lastDataSubmitted||''); if(cnt)cnt.value=String(st.dataPointsContributed||0);} }catch(e){}
  }
  function loadDataMetrics(){
    return fetchJson(api('/api/v054/data-metrics')).then(function(j){mergeStaffMetricsIntoData(j.staffStats||{});refreshStaffMetricUi();try{var sync=by('dashDataLastSynced');if(sync)sync.textContent=j.lastRefresh||'';}catch(e){}return j;}).catch(function(e){try{console.warn('v054 data metrics load failed',e);}catch(x){}return null;});
  }
  function installDataRefresh(){
    var baseRun=window.runAction;
    if(typeof baseRun==='function'&&!baseRun.__v054DataWrap){
      window.runAction=function(action){
        if(action==='folders'){
          try{if(typeof setMsg==='function')setMsg('Updating data points...','warn');}catch(e){}
          return fetchJson('/api/v054/data-metrics/refresh',{method:'POST',body:JSON.stringify(payload())}).then(function(j){
            mergeStaffMetricsIntoData(j.staffStats||{});refreshStaffMetricUi();
            try{if(typeof v5268CacheClear==='function'){v5268CacheClear('staff');v5268CacheClear('students');v5268CacheClear('dashboard');}}catch(e0){}
            try{if(typeof loadStudentData==='function')loadStudentData(null,{preferCache:false,forceRefresh:true,skipNew:true});}catch(e1){}
            try{if(typeof loadStaffData==='function')loadStaffData(null,{preferCache:false,forceRefresh:true,keepRowIndex:(window.currentStaff&&currentStaff.rowIndex)||0,keepName:(window.currentStaff&&currentStaff.name)||''});}catch(e2){}
            try{if(typeof loadDashboardSummary==='function')loadDashboardSummary({preferCache:false,forceRefresh:true,refresh:true});}catch(e3){}
            try{if(activePage()==='dataManager'&&typeof renderDataManager==='function')setTimeout(renderDataManager,300);}catch(e4){}
            try{if(typeof setMsg==='function')setMsg((j&&j.message)||'Data points updated.','ok');}catch(e5){}
            return j;
          }).catch(function(e){try{if(typeof setMsg==='function')setMsg('Could not update data points: '+((e&&e.message)||e),'err');}catch(x){} if(baseRun)return baseRun.apply(this,arguments);});
        }
        return baseRun.apply(this,arguments);
      };
      window.runAction.__v054DataWrap=true;try{runAction=window.runAction;}catch(e){}
    }
    var baseSelect=window.selectStaff;
    if(typeof baseSelect==='function'&&!baseSelect.__v054MetricsWrap){
      window.selectStaff=function(){var r=baseSelect.apply(this,arguments);refreshStaffMetricUi();scheduleStaffRow();return r;};
      window.selectStaff.__v054MetricsWrap=true;try{selectStaff=window.selectStaff;}catch(e){}
    }
  }
  function installNavWrap(){
    var baseShow=window.showPage;
    if(typeof baseShow==='function'&&!baseShow.__v054Wrap){
      window.showPage=function(page,btn){var r=baseShow.apply(this,arguments);if(page==='staff')scheduleStaffRow();if(page==='schedule')setTimeout(captureScheduleShell,100);if(page==='dashboard'){setTimeout(function(){var w=qs('#dashboard .dashboardTile[data-tile="warnings"]');if(w)w.style.display='none';},60);}return r;};
      window.showPage.__v054Wrap=true;try{showPage=window.showPage;}catch(e){}
    }
  }
  function boot(){addStyles();captureScheduleShell();installBellLifecycle();installDataRefresh();installNavWrap();scheduleStaffRow();loadDataMetrics();setTimeout(function(){var w=qs('#dashboard .dashboardTile[data-tile="warnings"]');if(w)w.style.display='none';},120);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,30);}); else setTimeout(boot,30);
  setTimeout(function(){try{captureScheduleShell();scheduleStaffRow();loadDataMetrics();}catch(e){}},900);
  window.gaV054Diag=function(){return {version:VERSION,active:activePage(),school:schoolKey(),hasScheduleShell:!!scheduleShell,staffMetricCount:Object.keys(staffMetricCache||{}).length};};
})();

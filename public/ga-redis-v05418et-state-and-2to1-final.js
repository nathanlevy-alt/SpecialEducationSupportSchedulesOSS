(function(){
  if(window.__SUPPORT_SCHEDULES_V05418ET_STATE_AND_2TO1_FINAL__) return;
  window.__SUPPORT_SCHEDULES_V05418ET_STATE_AND_2TO1_FINAL__ = true;
  var VERSION='0.54.18et';
  var publishSeq=0, scheduleSeq=0;
  function by(id){return document.getElementById(id);} 
  function qa(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel));}
  function clean(v){return String(v==null?'':v).trim();}
  function norm(v){return clean(v).toLowerCase().replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/[^a-z0-9:]+/g,' ').replace(/\s+/g,' ').trim();}
  function esc(v){return clean(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function payload(){
    try{if(typeof window.selectedSchoolPayloadForRedisV05418DJ==='function'){var g=window.selectedSchoolPayloadForRedisV05418DJ()||{}; if(g.campusId||g.schoolId||g.school||g.spreadsheetId)return g;}}catch(e0){}
    try{if(typeof window.selectedSchoolPayloadV683==='function'){var p=window.selectedSchoolPayloadV683()||{}; if(p.campusId||p.schoolId||p.school||p.spreadsheetId)return p;}}catch(e1){}
    try{if(typeof window.selectedSchoolPayloadV686m20==='function'){var q=window.selectedSchoolPayloadV686m20()||{}; if(q.campusId||q.schoolId||q.school||q.spreadsheetId)return q;}}catch(e2){}
    try{var sel=by('campusSelector');var opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;var cid=clean(sel&&sel.value);var ss=clean((opt&&opt.getAttribute('data-spreadsheet-id'))||'');var nm=clean((opt&&(opt.getAttribute('data-campus-name')||opt.getAttribute('data-school-name')||opt.textContent))||cid);return {campusId:cid,schoolId:cid,school:cid,campusName:nm,schoolName:nm,spreadsheetId:ss,selectedSpreadsheetId:ss};}catch(e3){return {};}
  }
  function callDirect(name,args,ok,fail){
    args=args||[];
    try{if(typeof window.callServer==='function')return window.callServer(name,args,ok,fail);}catch(e0){}
    try{if(!window.google||!google.script||!google.script.run)throw new Error('google.script.run unavailable');var r=google.script.run.withSuccessHandler(function(v){if(ok)ok(v);}).withFailureHandler(function(e){if(fail)fail(e);});return r[name].apply(r,args);}catch(e){if(fail)fail(e);}
  }
  function activePage(){try{if(typeof window.activeSectionIdV51229==='function'){var p=window.activeSectionIdV51229();if(p)return p;}}catch(e0){}try{var a=document.querySelector('.section.active,.page.active');return (a&&a.id)||'';}catch(e){return '';}}
  function normalizePage(page){page=clean(page||activePage());return (page==='staffSchedules'||page==='studentSchedules'||page==='breaks')?page:'';}
  function boxId(page){return page==='studentSchedules'?'studentSchedulesTable':(page==='breaks'?'breaksTable':'staffSchedulesTable');}
  function clearScheduleCaches(){
    try{Object.keys(sessionStorage||{}).forEach(function(k){if(/^v686/.test(k)||/schedule/i.test(k))sessionStorage.removeItem(k);});}catch(e){}
    try{if(typeof window.v5268CacheClear==='function')window.v5268CacheClear();}catch(e2){}
    try{window.scheduleViewsData=null;scheduleViewsData=null;}catch(e3){}
  }
  window.clearScheduleDisplayCacheV05418ET = clearScheduleCaches;
  function setBox(page,html){var b=by(boxId(page));if(b)b.innerHTML=html;}
  function applyPage(page,resp){resp=resp||{};setBox(page,resp.html||'<div class="muted" style="padding:12px">No saved schedule HTML was returned.</div>');try{window.scheduleViewsData=resp.data||window.scheduleViewsData||{};scheduleViewsData=window.scheduleViewsData;}catch(e){} }
  window.loadScheduleViewsData=function(opts){
    opts=opts||{};var page=normalizePage(opts.page);if(!page){if(typeof opts.done==='function')opts.done(null);return;}
    // v0.54.18et: schedule display pages are operational views. Do not use the old 30-minute
    // session cache here; it made Staff/Student/Break pages require hard refresh after changes.
    var seq=++scheduleSeq;var b=by(boxId(page));if(b&&!/Loading saved schedule snapshot/i.test(clean(b.textContent)))b.innerHTML='<div class="muted" style="padding:12px">Loading saved schedule snapshot...</div>';
    callDirect('getAdminSchedulePageHtmlFastV686m17',[payload(),page],function(resp){if(seq!==scheduleSeq)return;applyPage(page,resp||{});if(typeof opts.done==='function')opts.done(resp||{});},function(e){if(seq!==scheduleSeq)return;setBox(page,'<div class="muted" style="padding:12px">Could not load saved schedule snapshot: '+esc((e&&e.message)||e)+'</div>');if(typeof opts.done==='function')opts.done(null);});
  };
  try{loadScheduleViewsData=window.loadScheduleViewsData;}catch(e){}
  window.loadAdminSchedulePageDirectV686m14=function(page,opts){opts=opts||{};opts.page=page;return window.loadScheduleViewsData(opts);};
  try{loadAdminSchedulePageDirectV686m14=window.loadAdminSchedulePageDirectV686m14;}catch(e){}

  var lastGoodStatus=null;
  function isUnpublished(st){return !!(st&&(st.unpublished||st.unpublishedChanges||st.workingDirty));}
  function statusText(st){st=st||{};var stamp=clean(st.publishedAt||st.lastPublishedAt||st.publishedTime||'');var text=clean(st.navText||'');if(text)return text;if(isUnpublished(st))return stamp?('Last published '+stamp):'Unpublished schedule';return stamp?('Published '+stamp):'Never published';}
  function statusDetail(st){st=st||{};var stamp=clean(st.publishedAt||st.lastPublishedAt||st.publishedTime||'');var version=clean(st.versionLabel||st.scheduleVersion||st.version||'');var base=clean(st.detailText||'');if(base)return base;if(isUnpublished(st))return (version?('Draft Schedule · '+version):'Draft Schedule')+(stamp?' · Last published '+stamp:' · Not published');return (version?('Published Schedule · '+version):'Published Schedule')+(stamp?' · '+stamp:'');}
  function applyStatus(st){
    st=st||{};var text=statusText(st);var unpublished=isUnpublished(st);var nav=by('publishNavStatus');if(nav)nav.textContent=text;
    try{if(typeof window.renderPublishStatus==='function')window.renderPublishStatus(st);}catch(e){}
    if(nav)nav.textContent=text;
    var group=by('navScheduleGroup');if(group)group.classList.toggle('unpublished',unpublished);
    var detail=statusDetail(st);
    ['staffSchedulePublishNote','studentSchedulePublishNote','breakSchedulePublishNote'].forEach(function(idv){var el=by(idv);if(el){el.textContent=detail;el.classList.toggle('unpublished',unpublished);}});
    qa('.schedulePublishMetaV05418EO,.schedulePublishNote').forEach(function(el){ if(/Published Schedule|Draft Schedule|Last published|Not published|Published at|Unpublished/i.test(clean(el.textContent))){ el.classList.toggle('unpublished',unpublished); } });
    var btn=by('publishScheduleBtn');if(btn)btn.style.display=unpublished?'inline-flex':'none';var pill=by('unpublishedSchedulePill');if(pill)pill.style.display=unpublished?'inline-flex':'none';
    if(clean(st.publishedAt||st.lastPublishedAt||'')||!unpublished)lastGoodStatus=st;
  }
  var baseRenderStatus=window.renderPublishStatus;
  if(typeof baseRenderStatus==='function'&&!baseRenderStatus.__v05418etWrapped){
    var wrapped=function(st){
      var incomingText=statusText(st||{});
      if(lastGoodStatus&&/Never published/i.test(incomingText)&&clean(lastGoodStatus.publishedAt||lastGoodStatus.lastPublishedAt||'')){
        applyStatus(lastGoodStatus);return;
      }
      return baseRenderStatus.apply(this,arguments);
    };
    wrapped.__v05418etWrapped=true;window.renderPublishStatus=wrapped;try{renderPublishStatus=window.renderPublishStatus;}catch(e){}
  }
  window.loadPublishStatus=function(){
    var seq=++publishSeq;
    callDirect('getSchedulePublishStatusFastV686m17',[payload()],function(st){if(seq!==publishSeq)return;applyStatus(st||{});},function(e){if(seq!==publishSeq)return;var nav=by('publishNavStatus');if(nav&&!lastGoodStatus)nav.textContent='Schedule status unavailable';else if(lastGoodStatus)applyStatus(lastGoodStatus);});
  };
  try{loadPublishStatus=window.loadPublishStatus;}catch(e){}
  ['publishSchedule','cancelUnpublishedSchedule','clearCustomizationStatus','publishScenario','publishBuilder','restoreHistory','runAction'].forEach(function(name){
    try{var base=window[name]||eval(name);if(typeof base!=='function'||base.__v05418etWrapped)return;var w=function(){clearScheduleCaches();var ret=base.apply(this,arguments);setTimeout(function(){try{window.loadPublishStatus();}catch(e){}var p=normalizePage(activePage());if(p)try{window.loadScheduleViewsData({page:p,refresh:true,preferCache:false});}catch(e2){}},700);return ret;};w.__v05418etWrapped=true;window[name]=w;try{eval(name+'=window["'+name+'"]');}catch(e){} }catch(e0){}
  });

  // Final 2:1 cleanup: allow users to leave the 2nd field blank and prevent stale saved
  // sidecar data from forcing a row back to 2:1 after the row was changed away from 2:1.
  document.addEventListener('change',function(e){
    var t=e.target;if(!t||!t.classList)return;
    if(t.classList.contains('studentSupport')){
      var tr=t.closest&&t.closest('tr');if(tr&&tr.dataset)tr.dataset.twoToOneUserOverride=(t.value==='2:1')?'':'off';
      setTimeout(function(){try{if(typeof window.syncTwoToOneRowsV05418AQ==='function')window.syncTwoToOneRowsV05418AQ();}catch(_e){}try{if(typeof window.persistStudentAdvancedSchedulingV05418AQ==='function')window.persistStudentAdvancedSchedulingV05418AQ({replaceTwoToOneStaff:true,replaceTwoToOnePeriods:true});}catch(_e2){}},260);
    }
    if(t.classList.contains('studentPrimary2')||t.classList.contains('studentSecondary2')){
      setTimeout(function(){try{if(typeof window.persistStudentAdvancedSchedulingV05418AQ==='function')window.persistStudentAdvancedSchedulingV05418AQ({replaceTwoToOneStaff:true,replaceTwoToOnePeriods:true});}catch(_e3){}},180);
    }
  },true);
  setTimeout(function(){try{window.loadPublishStatus();}catch(e){}},450);
})();

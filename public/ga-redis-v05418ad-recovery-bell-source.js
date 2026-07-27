// Support Schedules 0.54.18ad recovery hotfix
// - keeps AC load-loop patch out
// - modalizes Advanced Scheduling
// - pins left navigation open by default
// - de-dupes Communication Manager nav items
// - centralizes selected-school bell display labels on the client
(function(){
  if(window.__SUPPORT_SCHEDULES_V05418AD_RECOVERY__)return;
  window.__SUPPORT_SCHEDULES_V05418AD_RECOVERY__=true;
  var VERSION='0.54.18ad';
  function by(id){return document.getElementById(id)}
  function qa(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel))}
  function clean(v){return String(v==null?'':v).trim()}
  function norm(v){return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  function esc(v){try{if(typeof window.esc==='function')return window.esc(v)}catch(e){}return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c})}
  function selectedSchoolKey(){
    var sel=by('campusSelector');
    if(sel&&clean(sel.value))return clean(sel.value);
    try{var p=(typeof window.selectedSchoolPayloadV686m20==='function'&&window.selectedSchoolPayloadV686m20())||{}; if(clean(p.schoolId||p.campusId||p.school))return clean(p.schoolId||p.campusId||p.school);}catch(e){}
    try{var p2=(typeof window.selectedSchoolPayloadV683==='function'&&window.selectedSchoolPayloadV683())||{}; if(clean(p2.schoolId||p2.campusId||p2.school))return clean(p2.schoolId||p2.campusId||p2.school);}catch(e2){}
    try{var p3=window.campusContextV5253||{}; if(clean(p3.schoolId||p3.campusId||p3.school))return clean(p3.schoolId||p3.campusId||p3.school);}catch(e3){}
    return 'default';
  }
  function selectedSchoolPayload(){
    var sel=by('campusSelector'), opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;
    var out={};
    try{out=(typeof window.selectedSchoolPayloadV686m20==='function'&&window.selectedSchoolPayloadV686m20())||{};}catch(e){}
    if(!out||!Object.keys(out).length){try{out=(typeof window.selectedSchoolPayloadV683==='function'&&window.selectedSchoolPayloadV683())||{};}catch(e2){}}
    out=out||{};
    if(sel&&clean(sel.value)){out.school=clean(sel.value);out.schoolId=clean(sel.value);out.campusId=clean(sel.value);}
    if(opt&&clean(opt.getAttribute('data-spreadsheet-id')))out.spreadsheetId=clean(opt.getAttribute('data-spreadsheet-id'));
    return out;
  }
  function callServerAD(name,args,ok,bad){
    try{if(typeof window.serverV661==='function')return window.serverV661(name,args||[],ok,bad||function(){})}catch(e){}
    try{if(typeof window.callServer==='function')return window.callServer(name,args||[],ok,bad||function(){})}catch(e2){}
    try{var r=google.script.run.withSuccessHandler(ok).withFailureHandler(bad||function(){}); return r[name].apply(r,args||[]);}catch(e3){if(bad)bad(e3)}
  }
  function installCss(){
    if(by('v05418adRecoveryCss'))return;
    var s=document.createElement('style');
    s.id='v05418adRecoveryCss';
    s.textContent='\n#advancedSchedulingModalV05418X.modal{display:none;position:fixed!important;inset:0!important;z-index:30000!important;background:rgba(15,23,42,.42)!important;align-items:center!important;justify-content:center!important;padding:24px!important;box-sizing:border-box!important;}\n#advancedSchedulingModalV05418X.modal.active{display:flex!important;}\n#advancedSchedulingModalV05418X .modalCard{width:min(860px,94vw)!important;max-height:88vh!important;overflow:auto!important;background:#fff!important;border:1px solid #dbe5f3!important;border-radius:20px!important;box-shadow:0 28px 80px rgba(15,23,42,.32)!important;padding:18px!important;position:relative!important;margin:0!important;}\n#advancedSchedulingModalV05418X .advancedSchedulingCardV05418X{max-width:min(860px,94vw)!important;}\n#advancedSchedulingModalV05418X .modalTitleRow{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;margin-bottom:8px!important;}\n#advancedSchedulingModalV05418X .modalTitleRow h3{margin:0!important;}\n#advancedSchedulingModalV05418X .modalCloseX{border:0!important;background:transparent!important;font-size:26px!important;line-height:1!important;cursor:pointer!important;color:#64748b!important;}\n.studentAdvancedSchedulingLinkV05418X{display:inline!important;border:0!important;background:transparent!important;color:#64748b!important;font-size:12px!important;font-style:italic!important;text-decoration:none!important;cursor:pointer!important;padding-left:6px!important;}\n.studentAdvancedSchedulingLinkV05418X:hover{color:#1d4ed8!important;text-decoration:underline!important;}\n.nav button[data-nav="communicationManager"].v05418adHiddenDuplicate{display:none!important;}\n';
    document.head.appendChild(s);
  }
  function pinNavOpen(){
    try{localStorage.setItem('gaSchedulerNavPinned','1')}catch(e){}
    var app=by('app');
    if(app){app.classList.add('nav-pinned','nav-open');}
    var btn=by('navPinToggle');
    if(btn){btn.setAttribute('aria-pressed','true');btn.title='Allow sidebar to auto-hide';btn.setAttribute('aria-label','Allow sidebar to auto-hide');}
    try{if(typeof window.updateNavPinButton==='function')window.updateNavPinButton()}catch(e2){}
  }
  function dedupeCommunicationNav(){
    var buttons=qa('.nav button[data-nav="communicationManager"]');
    buttons.forEach(function(btn,i){btn.classList.toggle('v05418adHiddenDuplicate',i>0); if(i>0)btn.setAttribute('aria-hidden','true');});
  }
  function forceAdvancedLink(){
    var link=by('studentAdvancedSchedulingLinkV05418X');
    if(link){
      link.removeAttribute('href');
      link.setAttribute('role','button');
      link.setAttribute('tabindex','0');
      link.onclick=function(ev){
        if(ev){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();}
        openAdvancedPopupAD();
        return false;
      };
    }
  }
  function openAdvancedPopupAD(){
    installCss();
    try{
      if(typeof window.openAdvancedSchedulingV05418Z==='function'){window.openAdvancedSchedulingV05418Z();}
      else if(typeof window.openAdvancedSchedulingV05418AB==='function'){window.openAdvancedSchedulingV05418AB();}
      else if(typeof window.openAdvancedSchedulingV05418AA==='function'){window.openAdvancedSchedulingV05418AA();}
    }catch(e){try{if(typeof window.setMsg==='function')window.setMsg('Could not open Advanced Scheduling: '+(e&&e.message||e),'err')}catch(x){}}
    setTimeout(function(){
      var m=by('advancedSchedulingModalV05418X');
      if(m){m.classList.add('modal','active');m.style.display='flex';}
    },30);
  }
  function periodKeyAliases(source){
    source=source||window.__supportSchedulesBellSourceV05418AD||{};
    var map=Object.create(null);
    function add(k,v){k=clean(k);v=clean(v);if(!k||!v)return; map[norm(k)]=v;}
    var labels=source.itemLabels||{};
    Object.keys(labels).forEach(function(k){add(k,labels[k]);add(labels[k],labels[k]);});
    (source.periodMeta||[]).forEach(function(r){if(!r)return; var key=r.key||r.item||r.period||r.name||r.label||r.title; var label=r.displayName||r.display||r.label||r.title||r.name||key; add(key,label); add(label,label);});
    (source.itemOrder||source.items||[]).forEach(function(it){if(typeof it==='object'){add(it.item||it.key||it.label||it.title,it.displayName||it.label||it.title||it.item||it.key)}else add(it,it)});
    return map;
  }
  function mergeBellSource(payload){
    payload=payload||{};
    var existing=window.__supportSchedulesBellSourceV05418AD||{};
    var labels=Object.assign({},existing.itemLabels||{},payload.itemLabels||{});
    var meta=(payload.periodMeta&&payload.periodMeta.length?payload.periodMeta:existing.periodMeta)||[];
    var order=[]; var seen=Object.create(null);
    function add(item){item=clean(item); if(!item)return; var k=norm(item); if(seen[k])return; seen[k]=true; order.push(item);}
    (existing.itemOrder||existing.items||[]).forEach(function(x){add(typeof x==='object'?(x.item||x.key||x.label||x.title):x)});
    (payload.itemOrder||payload.items||[]).forEach(function(x){add(typeof x==='object'?(x.item||x.key||x.label||x.title):x)});
    meta.forEach(function(r){if(r)add(r.key||r.item||r.period||r.name||r.label||r.title)});
    Object.keys(labels).forEach(add);
    var source={version:VERSION,schoolKey:selectedSchoolKey(),itemLabels:labels,periodMeta:meta,itemOrder:order,items:order,periodDisplaySource:payload.periodDisplaySource||existing.periodDisplaySource||'v05418ad-client'};
    window.__supportSchedulesBellSourceV05418AD=source;
    ['scheduleData','studentData','staffData','advancedSetupDataV5131','scheduleViewsData'].forEach(function(k){
      try{var obj=window[k]; if(obj&&typeof obj==='object'){obj.itemLabels=Object.assign({},obj.itemLabels||{},labels); obj.periodMeta=meta.length?meta:(obj.periodMeta||[]); obj.itemOrder=order.length?order:(obj.itemOrder||[]); if(k==='studentData'||k==='staffData'||k==='scheduleData'){obj.items=order.length?order:(obj.items||[]);} }}catch(e){}
    });
    return source;
  }
  function resolveLabel(item){
    item=clean(item); if(!item)return '';
    var source=window.__supportSchedulesBellSourceV05418AD||{};
    var labels=source.itemLabels||{};
    if(labels[item])return labels[item];
    var aliases=periodKeyAliases(source), hit=aliases[norm(item)];
    return hit||item;
  }
  function patchBellFunctions(){
    if(window.__V05418AD_BELL_FUNCTIONS_PATCHED__)return;
    window.__V05418AD_BELL_FUNCTIONS_PATCHED__=true;
    var baseNormalize=window.normalizeSchedulePayload;
    if(typeof baseNormalize==='function'){
      window.normalizeSchedulePayload=function(d){var out=baseNormalize.apply(this,arguments)||d||{}; try{mergeBellSource(Object.assign({},d||{},out||{}));}catch(e){} return out;};
      try{normalizeSchedulePayload=window.normalizeSchedulePayload}catch(e){}
    }
    var baseMeta=window.periodMetaBaseRowsV5139;
    if(typeof baseMeta==='function'){
      window.periodMetaBaseRowsV5139=function(){
        var rows=[]; try{rows=baseMeta.apply(this,arguments)||[]}catch(e){rows=[]}
        var source=window.__supportSchedulesBellSourceV05418AD||{};
        var seen=Object.create(null), out=[];
        function push(r){if(!r)return; var key=clean(r.key||r.item||r.period||r.name||r.label||r.title); if(!key)return; var n=norm(key); if(seen[n])return; seen[n]=true; var label=r.displayName||r.display||r.label||r.title||source.itemLabels&&source.itemLabels[key]||key; out.push(Object.assign({},r,{key:key,label:label,displayName:label}));}
        (source.periodMeta||[]).forEach(push);
        (source.itemOrder||[]).forEach(function(key){push({key:key,label:resolveLabel(key),displayName:resolveLabel(key)});});
        rows.forEach(push);
        return out;
      };
      try{periodMetaBaseRowsV5139=window.periodMetaBaseRowsV5139}catch(e2){}
    }
    ['periodDisplayNameV5140','studentItemLabelV5141','staffScheduleItemLabelV5154','displayPeriodLabelClientV5323'].forEach(function(name){
      var base=window[name];
      if(typeof base!=='function')return;
      window[name]=function(v){var r=resolveLabel(v); if(r&&r!==clean(v))return r; try{return base.apply(this,arguments)}catch(e){return clean(v)}};
      try{eval(name+'=window[name]')}catch(e){}
    });
  }
  function requestBellSource(force){
    var now=Date.now();
    if(!force&&window.__supportSchedulesBellSourceV05418AD&&window.__supportSchedulesBellSourceV05418AD.schoolKey===selectedSchoolKey()&&now-(window.__supportSchedulesBellSourceV05418AD.loadedAt||0)<60000)return;
    var reqSchool=selectedSchoolKey();
    callServerAD('getSchoolBellDisplaySourceV05418AD',[selectedSchoolPayload()],function(d){
      if(selectedSchoolKey()!==reqSchool)return;
      var source=mergeBellSource(d||{}); source.loadedAt=Date.now(); source.schoolKey=reqSchool;
      try{if(typeof window.renderPeriodMetaRowsV5131==='function'&&((document.querySelector('.section.active')||{}).id==='schedule'))window.renderPeriodMetaRowsV5131()}catch(e){}
    },function(){});
  }
  function boot(){
    installCss(); pinNavOpen(); dedupeCommunicationNav(); forceAdvancedLink(); patchBellFunctions();
    setTimeout(function(){requestBellSource(false);},250);
    try{if(typeof window.registerNavigationAfterHookV5_==='function')window.registerNavigationAfterHookV5_(function(page){pinNavOpen();dedupeCommunicationNav();if(page==='students')setTimeout(forceAdvancedLink,80);if(page==='schedule'||page==='students'||page==='staff'||page==='staffSchedules'||page==='studentSchedules'||page==='breaks'){requestBellSource(page==='schedule');}},'v05418adRecovery');}catch(e){}
  }
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest&&e.target.closest('#studentAdvancedSchedulingLinkV05418X,.studentAdvancedSchedulingLinkV05418X,[data-action="student-advanced-scheduling-v05418ab"],[data-action="student-advanced-scheduling-v05418ad"]');
    if(!t)return;
    e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation();
    openAdvancedPopupAD();
    return false;
  },true);
  document.addEventListener('keydown',function(e){var t=e.target&&e.target.closest&&e.target.closest('#studentAdvancedSchedulingLinkV05418X,.studentAdvancedSchedulingLinkV05418X'); if(t&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openAdvancedPopupAD();}},true);
  document.addEventListener('change',function(e){if(e.target&&e.target.id==='campusSelector'){window.__supportSchedulesBellSourceV05418AD=null;setTimeout(function(){pinNavOpen();requestBellSource(true);},180);}},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
  window.gaV05418ADRecoveryDiag=function(){return {version:VERSION,school:selectedSchoolKey(),source:window.__supportSchedulesBellSourceV05418AD||null,modal:!!by('advancedSchedulingModalV05418X'),navPinned:!!(by('app')&&by('app').classList.contains('nav-pinned')),communicationNavCount:qa('.nav button[data-nav="communicationManager"]:not(.v05418adHiddenDuplicate)').length};};
})();

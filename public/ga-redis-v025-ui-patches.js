(function(){
  if (window.__gaRedisV025UiPatchesInstalled) return;
  window.__gaRedisV025UiPatchesInstalled = true;
  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function compact(v){ return clean(v).toLowerCase().replace(/\s+/g,' '); }
  function activePage(){ try { if (typeof activeSectionIdV51229 === 'function') return activeSectionIdV51229(); } catch(e) {} var a=document.querySelector('.page.active,.section.active,[data-page].active'); return (a&&a.id)||''; }
  function isStaffActive(){ return activePage()==='staff' || !!document.querySelector('#staff.active'); }
  function isRegularActive(){ return activePage()==='regularSchedule' || !!document.querySelector('#regularSchedule.active'); }
  function selectedSchoolId(){
    try { if (typeof schoolKeyV686f === 'function') return clean(schoolKeyV686f()); } catch(e) {}
    try { if (typeof schoolKeyV683 === 'function') return clean(schoolKeyV683()); } catch(e2) {}
    try { var ctx = window.campusContextV5253 || window.campusContext || null; if (ctx) return clean(ctx.selectedCampusId || ctx.campusId || ctx.schoolId || ctx.id); } catch(e3) {}
    var sel = by('campusSelector') || document.querySelector('[data-campus-selector]') || document.querySelector('select[name="campus"]');
    return sel ? clean(sel.value) : 'default';
  }
  function selectedSchoolPayload(){
    var out={ school:selectedSchoolId(), schoolId:selectedSchoolId(), selectedCampusId:selectedSchoolId() };
    try { var ctx=window.campusContextV5253||window.campusContext||null; if(ctx){ out.name=ctx.selectedCampusName||ctx.campusName||ctx.schoolName||ctx.name||''; out.spreadsheetId=ctx.selectedSpreadsheetId||ctx.spreadsheetId||ctx.ssId||''; } } catch(e) {}
    try { var sel=by('campusSelector')||document.querySelector('[data-campus-selector]'); var opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null; if(opt){ out.name=out.name||clean(opt.getAttribute('data-campus-name')||opt.getAttribute('data-school-name')||opt.textContent); out.spreadsheetId=out.spreadsheetId||clean(opt.getAttribute('data-spreadsheet-id')||opt.getAttribute('data-ss-id')||opt.getAttribute('data-sheet-id')); } } catch(e2) {}
    return out;
  }
  function staffInfo(){
    var cur=null; try { cur = window.currentStaff || currentStaff || null; } catch(e) { cur = window.currentStaff || null; }
    var name = clean(cur && (cur.name || cur.staffName));
    var rowIndex = Number(cur && (cur.rowIndex || cur.rowNumber || cur.row)) || 0;
    if (!name) {
      var sel = document.querySelector('#staffList .active,[data-staff-row].active,[data-staff-name].active');
      if (sel) { name = clean(sel.getAttribute('data-staff-name') || sel.textContent); rowIndex = Number(sel.getAttribute('data-row-index') || sel.getAttribute('data-staff-row') || rowIndex) || rowIndex; }
    }
    return { name:name, rowIndex:rowIndex };
  }
  function fetchJson(url, opts){ opts=opts||{}; opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{}); opts.credentials='same-origin'; return fetch(url,opts).then(function(r){ return r.json().then(function(j){ if(!r.ok||j.ok===false) throw new Error(j.error||j.message||('HTTP '+r.status)); return j; }); }); }
  function esc(s){ return String(s||'').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  function installStyles(){
    if (by('gaRedisV025Styles')) return;
    var st=document.createElement('style'); st.id='gaRedisV025Styles';
    st.textContent=[
      '.topActions .shareSchedulesPillV686m26,.portalTopActions .shareSchedulesPillV686m26{font-family:inherit!important;font-size:12px!important;font-weight:700!important;line-height:normal!important;border-radius:9px!important;padding:7px 10px!important;min-height:auto!important;gap:6px!important}',
      '.topActions .shareSchedulesPillV686m26 i,.portalTopActions .shareSchedulesPillV686m26 i{display:none!important}',
      '.topActions .shareSchedulesPillV686m26 .shareMainV018,.portalTopActions .shareSchedulesPillV686m26 .shareMainV018{font:inherit!important;font-size:12px!important;font-weight:700!important;line-height:normal!important}',
      '#staff .staffDataStatsV5288{display:grid!important;grid-template-columns:minmax(150px,190px) minmax(190px,230px) minmax(260px,320px) minmax(380px,1fr)!important;gap:10px!important;align-items:start!important;max-width:none!important;overflow:visible!important}',
      '#staff .staffEmailFieldV024{grid-column:auto!important;min-width:0!important;max-width:none!important}',
      '#staff #staffPortalLinkFieldV5312{grid-column:auto!important;min-width:360px!important;max-width:none!important;margin:0!important;align-self:start!important}',
      '#staff .staffEmailInputLockWrapV025{display:grid!important;grid-template-columns:minmax(0,1fr) 36px!important;gap:6px!important;align-items:center!important}',
      '#staff .staffEmailLockBtnV025{height:34px!important;width:36px!important;min-width:36px!important;border:1px solid #d8e1ef!important;border-radius:10px!important;background:#fff!important;color:#334155!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;box-shadow:none!important;cursor:pointer!important;font-size:14px!important}',
      '#staff .staffEmailLockBtnV025.active{background:#fff7ed!important;border-color:#fdba74!important;color:#9a3412!important}',
      '#staff .staffEmailLockBtnV025:disabled{opacity:.55!important;cursor:not-allowed!important}',
      '#staff .timeBlockPanel .inline{display:grid!important;grid-template-columns:minmax(250px,1fr) max-content!important;gap:8px!important;align-items:end!important;overflow:visible!important}',
      '#staff .timeBlockPanel .inline button,#staff button[data-action="staff-add-timeblock"],#staff button[data-action="staff-add-hold"]{width:auto!important;min-width:58px!important;max-width:none!important;border-radius:12px!important;padding:7px 12px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important;line-height:1.2!important;overflow:visible!important}',
      '#regularScheduleStaffPortalToggle:not([data-redis-regular-loaded="1"]){visibility:hidden!important}',
      '@media(max-width:1220px){#staff .staffDataStatsV5288{grid-template-columns:1fr 1fr!important}#staff #staffPortalLinkFieldV5312{min-width:0!important}}',
      '@media(max-width:820px){#staff .staffDataStatsV5288{grid-template-columns:1fr!important}#staff #staffPortalLinkFieldV5312{min-width:0!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function cleanSharePill(){
    try {
      Array.prototype.slice.call(document.querySelectorAll('#shareSchedulesPillV686m26,.shareSchedulesPillV686m26')).forEach(function(pill){
        var main = pill.querySelector('.shareMainV018,[data-redis-v018-action="share-open"]') || pill;
        Array.prototype.slice.call(main.querySelectorAll('i,.fa,.fa-solid,.fa-regular')).forEach(function(i){ try{i.remove();}catch(e){} });
        var txt = clean(main.textContent || '').replace(/^✉\s*/,'').replace(/^✉️\s*/,'').replace(/^📧\s*/,'');
        if (/share schedules/i.test(txt) || main !== pill) main.textContent = 'Share Schedules';
      });
    } catch(e) {}
  }

  function ensureStaffEmailLockUi(){
    var input = by('staffNotificationEmailV686m41'); if (!input) return null;
    var field = by('staffEmailFieldV024') || (input.closest && input.closest('.staffEmailFieldV024,.staffDataFieldV5289'));
    if (!field) return input;
    var wrap = by('staffEmailInputLockWrapV025');
    if (!wrap) {
      wrap = document.createElement('div'); wrap.id='staffEmailInputLockWrapV025'; wrap.className='staffEmailInputLockWrapV025';
      input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    }
    var btn = by('staffEmailLockBtnV025');
    if (!btn) {
      btn = document.createElement('button'); btn.type='button'; btn.id='staffEmailLockBtnV025'; btn.className='staffEmailLockBtnV025'; btn.setAttribute('aria-label','Lock staff email editing'); btn.innerHTML='<i class="fa-solid fa-lock" aria-hidden="true"></i>';
      wrap.appendChild(btn);
      btn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); toggleStaffEmailLock(); });
    } else if (btn.parentNode !== wrap) wrap.appendChild(btn);
    return input;
  }
  function setLockUi(locked){
    var btn=by('staffEmailLockBtnV025'), input=by('staffNotificationEmailV686m41');
    if (!btn) return;
    btn.classList.toggle('active', !!locked);
    btn.dataset.locked = locked ? '1' : '0';
    btn.title = locked ? 'Email locked: Staff Portal cannot change it' : 'Email unlocked: Staff Portal can update it';
    btn.innerHTML = '<i class="fa-solid fa-lock" aria-hidden="true"></i>'; btn.setAttribute('aria-pressed', locked ? 'true' : 'false');
    if (input) input.dataset.emailLocked = locked ? '1' : '0';
  }
  function loadStaffEmailLock(){
    var input=ensureStaffEmailLockUi(); if(!input) return;
    var info=staffInfo(), school=selectedSchoolId(); if(!school||!info.name){ setLockUi(false); return; }
    fetchJson('/api/staff/email-v022?'+new URLSearchParams({school:school,staff:info.name,rowIndex:String(info.rowIndex||'')}).toString()).then(function(j){
      if (compact(staffInfo().name)!==compact(info.name)) return;
      setLockUi(!!j.locked);
      if (document.activeElement !== input && input.getAttribute('data-dirty') !== '1') input.value = j.email || input.value || '';
    }).catch(function(){});
  }
  function toggleStaffEmailLock(){
    var btn=by('staffEmailLockBtnV025'); if(!btn) return;
    var info=staffInfo(), school=selectedSchoolId(); if(!school||!info.name) return;
    var next = btn.dataset.locked !== '1'; btn.disabled=true;
    fetchJson('/api/staff/email-lock-v025',{method:'POST',body:JSON.stringify({school:school,staff:info.name,rowIndex:info.rowIndex,locked:next})}).then(function(j){
      setLockUi(!!j.locked);
      var msg=by('staffEmailMsgV024'); if(msg){ msg.textContent=j.locked?'Locked for Staff Portal edits.':'Unlocked for Staff Portal edits.'; setTimeout(function(){ if(msg) msg.textContent=''; },1600); }
    }).catch(function(e){ var msg=by('staffEmailMsgV024'); if(msg) msg.textContent='Could not update lock.'; }).then(function(){ btn.disabled=false; });
  }

  function syncStaffEmailLayout(){
    if(!isStaffActive()) return;
    try {
      var wrap=document.querySelector('#staff .staffDataStatsV5288');
      var email=by('staffEmailFieldV024'); var link=by('staffPortalLinkFieldV5312');
      if(wrap&&email&&link&&email.parentNode===wrap&&link.parentNode===wrap&&email.nextSibling!==link) wrap.insertBefore(email,link);
      ensureStaffEmailLockUi(); loadStaffEmailLock();
    } catch(e) {}
  }

  function regularToggle(){ return by('regularScheduleStaffPortalToggle') || by('displayRegularScheduleOnStaffPortal') || document.querySelector('#regularSchedule input[type="checkbox"][data-regular-display],#regularSchedule input[type="checkbox"][name*="StaffPortal"]'); }
  function loadRegularDisplay(){
    var cb=regularToggle(); if(!cb) return;
    cb.removeAttribute('data-redis-regular-loaded');
    fetchJson('/api/history/regular-display-v022?'+new URLSearchParams({school:selectedSchoolId()}).toString()).then(function(j){ cb.checked=!!j.displayOnStaffPortal; cb.setAttribute('data-redis-regular-loaded','1'); cb.dataset.saving='0'; }).catch(function(){ cb.setAttribute('data-redis-regular-loaded','1'); });
  }
  function saveRegularDisplay(cb){
    if(!cb || cb.dataset.saving==='1') return;
    cb.dataset.saving='1';
    fetchJson('/api/history/regular-display-v022',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),display:!!cb.checked})}).then(function(j){ cb.checked=!!j.displayOnStaffPortal; cb.setAttribute('data-redis-regular-loaded','1'); cb.dataset.saving='0'; }).catch(function(){ cb.dataset.saving='0'; });
  }

  function patchRunAction(){
    try {
      var base = window.runAction || (typeof runAction === 'function' ? runAction : null);
      if (!base || base.__redisV025SchoolScoped) return;
      var labels={assignments:'Updating assignments and dashboard...',runBreaks:'Rebuilding break schedule...',refreshDashboard:'Refreshing dashboard display...',setup:'Refreshing lists...',email:'Sending daily schedule...',folders:'Updating data points...'};
      var map={assignments:'runAssignmentsAndDashboardV5',runBreaks:'runBreaksOnlyV5',refreshDashboard:'refreshHomeDashboardV5',setup:'setupV5Sheets',email:'emailDailyScheduleV5',folders:'updateFolderDatesV5'};
      var wrapped=function(action){
        if(!map[action]) return base.apply(this, arguments);
        try { if (typeof setMsg === 'function') setMsg(labels[action] || 'Running action...', 'warn'); } catch(e) {}
        var payload=selectedSchoolPayload();
        try {
          if (typeof google !== 'undefined' && google.script && google.script.run) {
            google.script.run.withSuccessHandler(function(){ try{ if(typeof setMsg==='function')setMsg('Action complete. Refreshing data...','ok'); }catch(e){} try{ if(typeof refreshAll==='function')refreshAll(); }catch(e2){} }).withFailureHandler(function(err){ try{ if(typeof gsFailure==='function')gsFailure(err); else if(typeof setMsg==='function')setMsg(String(err),'err'); }catch(e3){} })[map[action]](payload);
            return;
          }
        } catch(e4) {}
        return base.apply(this, arguments);
      };
      wrapped.__redisV025SchoolScoped=true; window.runAction=wrapped; try{ runAction=wrapped; }catch(e){}
    } catch(e) {}
  }

  function boot(){ installStyles(); cleanSharePill(); patchRunAction(); if(isRegularActive()) { var cb=regularToggle(); if(cb && cb.getAttribute('data-redis-regular-loaded')!=='1') loadRegularDisplay(); } }
  window.addEventListener('change', function(e){ var t=e.target; if(t && t===regularToggle()){ t.setAttribute('data-redis-regular-loaded','1'); saveRegularDisplay(t); } }, true);
  window.addEventListener('click', function(e){ var nav=e.target&&e.target.closest&&e.target.closest('[data-nav="staff"],[data-nav="regularSchedule"],#staffList .active,[data-staff-row],[data-staff-name]'); if(nav){ setTimeout(boot,80); setTimeout(boot,350); } }, true);
  try { new MutationObserver(function(){ clearTimeout(window.__gaRedisV025MutTimer); window.__gaRedisV025MutTimer=setTimeout(boot,180); }).observe(document.body,{childList:true,subtree:true}); } catch(e) {}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot,80); }); else setTimeout(boot,80);
  [500,1200,2500,5000].forEach(function(ms){ setTimeout(boot,ms); });
})();

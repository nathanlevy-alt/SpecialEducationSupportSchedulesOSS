(function(){
  'use strict';
  if(window.__gaRedisV050Loaded) return; window.__gaRedisV050Loaded = true;
  var VERSION = '0.50.0';
  var trace = [];
  var shells = { calendar: null, attendanceManager: null };
  var base = {};
  var lifecycle = { active: '', generation: 0, unmounting: false };
  function now(){ try{return new Date().toISOString();}catch(e){return String(Date.now());} }
  function log(step, detail){
    var row = { t: now(), step: String(step||''), detail: detail || '' };
    trace.push(row); if(trace.length > 160) trace.shift();
    try{ sessionStorage.setItem('gaV050CalendarAttendanceTrace', JSON.stringify(trace)); }catch(e){}
    try{ console.debug('[v050 calendar/attendance]', step, detail||''); }catch(e2){}
  }
  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function htmlEscape(v){ return clean(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;}); }
  function activePage(){
    try{ if(typeof activeSectionIdV51229 === 'function') return activeSectionIdV51229() || ''; }catch(e){}
    try{ var a = document.querySelector('.section.active'); return (a && a.id) || ''; }catch(e2){ return ''; }
  }
  function isCalendarOrAttendance(page){ return page === 'calendar' || page === 'attendanceManager'; }
  function isActive(page){ return activePage() === page; }
  function setMsgSafe(msg,type){ try{ if(typeof window.setMsg === 'function') window.setMsg(msg, type || 'warn'); }catch(e){} }
  function captureShells(){
    try{ if(!shells.calendar && by('calendar')) shells.calendar = by('calendar').innerHTML; }catch(e){ log('capture-calendar-shell-error', (e&&e.message)||e); }
    try{ if(!shells.attendanceManager && by('attendanceManager')) shells.attendanceManager = by('attendanceManager').innerHTML; }catch(e2){ log('capture-attendance-shell-error', (e2&&e2.message)||e2); }
  }
  function restoreShell(page){
    var sec = by(page);
    if(!sec) return false;
    var shell = shells[page];
    if(!shell) return false;
    try{
      sec.innerHTML = shell;
      log('shell-restored', page);
      return true;
    }catch(e){ log('shell-restore-error', page + ': ' + ((e&&e.message)||e)); return false; }
  }
  function setGlobalsInactive(page){
    try{ lifecycle.generation++; lifecycle.active = ''; lifecycle.unmounting = true; }catch(e){}
    if(page === 'calendar'){
      try{ window.calendarData = null; }catch(e1){}
      try{ calendarData = null; }catch(e2){}
      try{ window.__gaV050CalendarMounted = false; }catch(e3){}
    }
    if(page === 'attendanceManager'){
      try{ window.attendanceManagerData = null; }catch(e4){}
      try{ attendanceManagerData = null; }catch(e5){}
      try{ window.attendanceSelectedStaff = ''; }catch(e6){}
      try{ attendanceSelectedStaff = ''; }catch(e7){}
      try{ window.attendanceReturnSource = 'manager'; }catch(e8){}
      try{ attendanceReturnSource = 'manager'; }catch(e9){}
      try{ window.__attendanceGenericModeV5416 = true; window.__attendanceScopedStaffName = ''; }catch(e10){}
      try{ window.__gaV050AttendanceMounted = false; }catch(e11){}
    }
  }
  function unmount(page){
    if(!isCalendarOrAttendance(page)) return true;
    log('unmount-start', page);
    setGlobalsInactive(page);
    // Reset the entire heavy section back to its original shell before the portal hides it.
    // This removes page-owned DOM/listeners and prevents delayed legacy renders from walking stale grids.
    restoreShell(page);
    setTimeout(function(){ lifecycle.unmounting = false; }, 50);
    log('unmount-complete', page);
    return true;
  }
  function mount(page){
    if(!isCalendarOrAttendance(page)) return;
    lifecycle.active = page;
    lifecycle.generation++;
    lifecycle.unmounting = false;
    log('mount', page + ' gen=' + lifecycle.generation);
    if(page === 'calendar') try{ window.__gaV050CalendarMounted = true; }catch(e){}
    if(page === 'attendanceManager') try{ window.__gaV050AttendanceMounted = true; }catch(e2){}
  }
  function shouldRender(page){
    if(lifecycle.unmounting) return false;
    if(!isActive(page)) return false;
    return true;
  }
  function wrapRenderers(){
    if(typeof window.renderPortalCalendar === 'function' && !window.renderPortalCalendar.__v050Wrapped){
      base.renderPortalCalendar = window.renderPortalCalendar;
      window.renderPortalCalendar = function(){
        if(!shouldRender('calendar')){ log('skip-calendar-render-not-active', activePage()); return null; }
        return base.renderPortalCalendar.apply(this, arguments);
      };
      window.renderPortalCalendar.__v050Wrapped = true;
      try{ renderPortalCalendar = window.renderPortalCalendar; }catch(e){}
    }
    if(typeof window.renderAttendanceManager === 'function' && !window.renderAttendanceManager.__v050Wrapped){
      base.renderAttendanceManager = window.renderAttendanceManager;
      window.renderAttendanceManager = function(){
        if(!shouldRender('attendanceManager')){ log('skip-attendance-render-not-active', activePage()); return null; }
        var result = base.renderAttendanceManager.apply(this, arguments);
        try{ tuneDetailedAttendance(); }catch(e){ log('attendance-tune-after-render-error', (e&&e.message)||e); }
        return result;
      };
      window.renderAttendanceManager.__v050Wrapped = true;
      try{ renderAttendanceManager = window.renderAttendanceManager; }catch(e2){}
    }
    if(typeof window.renderAttendanceHistory === 'function' && !window.renderAttendanceHistory.__v050Wrapped){
      base.renderAttendanceHistory = window.renderAttendanceHistory;
      window.renderAttendanceHistory = function(staffName){
        if(!shouldRender('attendanceManager')){ log('skip-attendance-history-render-not-active', activePage()); return null; }
        var result = base.renderAttendanceHistory.apply(this, arguments);
        try{ tuneDetailedAttendance(staffName); }catch(e){ log('attendance-history-tune-error', (e&&e.message)||e); }
        return result;
      };
      window.renderAttendanceHistory.__v050Wrapped = true;
      try{ renderAttendanceHistory = window.renderAttendanceHistory; }catch(e3){}
    }
  }
  function wrapLoaders(){
    if(typeof window.loadCalendarData === 'function' && !window.loadCalendarData.__v050Wrapped){
      base.loadCalendarData = window.loadCalendarData;
      window.loadCalendarData = function(){
        if(!isActive('calendar')){ log('skip-calendar-load-not-active', activePage()); return null; }
        mount('calendar');
        return base.loadCalendarData.apply(this, arguments);
      };
      window.loadCalendarData.__v050Wrapped = true;
      try{ loadCalendarData = window.loadCalendarData; }catch(e){}
    }
    if(typeof window.loadAttendanceManager === 'function' && !window.loadAttendanceManager.__v050Wrapped){
      base.loadAttendanceManager = window.loadAttendanceManager;
      window.loadAttendanceManager = function(staffName){
        if(!isActive('attendanceManager')){ log('skip-attendance-load-not-active', activePage()); return null; }
        mount('attendanceManager');
        return base.loadAttendanceManager.apply(this, arguments);
      };
      window.loadAttendanceManager.__v050Wrapped = true;
      try{ loadAttendanceManager = window.loadAttendanceManager; }catch(e2){}
    }
  }
  function installLifecycleHook(){
    // showPage in this build already calls gaV049BeforePageSwitch. Keep the same hook name
    // so we do not need to patch core navigation, but replace its implementation with the v050 lifecycle.
    window.gaV049BeforePageSwitch = function(nextPage, btn, currentPage){
      currentPage = currentPage || activePage();
      nextPage = clean(nextPage);
      log('before-page-switch', currentPage + ' -> ' + nextPage);
      if(isCalendarOrAttendance(currentPage) && currentPage !== nextPage) unmount(currentPage);
      if(isCalendarOrAttendance(nextPage)) mount(nextPage);
      return true;
    };
  }
  function monthNameDate(v){
    var raw = clean(v);
    if(!raw) return '';
    var d = null;
    if(/^\d{4}-\d{2}-\d{2}/.test(raw)){
      var parts = raw.slice(0,10).split('-');
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }else{
      var t = Date.parse(raw);
      if(!isNaN(t)) d = new Date(t);
    }
    if(!d || isNaN(d.getTime())) return raw;
    var mm = String(d.getMonth()+1).padStart(2,'0');
    var dd = String(d.getDate()).padStart(2,'0');
    var yy = String(d.getFullYear());
    return mm + '-' + dd + '-' + yy;
  }
  function selectedAttendanceStaffName(fallback){
    var name = clean(fallback);
    if(name) return name;
    try{ if(window.attendanceSelectedStaff) return clean(window.attendanceSelectedStaff); }catch(e){}
    try{ if(typeof attendanceSelectedStaff !== 'undefined' && attendanceSelectedStaff) return clean(attendanceSelectedStaff); }catch(e2){}
    try{ if(typeof selectedAttendanceStaff === 'function') return clean(selectedAttendanceStaff()); }catch(e3){}
    try{ var sel = by('attEditStaff'); if(sel && sel.value) return clean(sel.value); }catch(e4){}
    return '';
  }
  function tuneDetailedAttendance(staffName){
    var box = by('attendanceHistoryBox');
    if(!box || box.style.display === 'none' || !clean(box.textContent)) return;
    var staff = selectedAttendanceStaffName(staffName);
    if(staff){
      var heading = by('attendanceMonthHeading');
      if(heading) heading.textContent = staff;
    }
    var table = box.querySelector('table.attendanceRecordTable, table');
    if(table){
      var rows = table.querySelectorAll('tbody tr');
      Array.prototype.forEach.call(rows, function(tr){
        var td = tr.children && tr.children[0];
        if(!td) return;
        var current = clean(td.textContent);
        var fmt = monthNameDate(current);
        if(fmt && fmt !== current) td.textContent = fmt;
      });
    }
  }
  function fetchAttendanceDataForStaff(staffName, done, fail){
    var params = new URLSearchParams();
    var month = '';
    try{ month = (by('attendanceMonthSelect') && by('attendanceMonthSelect').value) || ''; }catch(e){}
    if(month) params.set('month', month);
    params.set('staff', staffName || '');
    try{ if(by('attendanceShowNonActiveV5340') && by('attendanceShowNonActiveV5340').checked) params.set('showNonActive', 'true'); }catch(e2){}
    try{ if(typeof selectedSchoolPayloadV686m20 === 'function'){ var p = selectedSchoolPayloadV686m20() || {}; if(p.school || p.schoolId || p.campusId) params.set('school', p.school || p.schoolId || p.campusId); } }catch(e3){}
    if(!params.get('school')){ try{ var sel = by('campusSelector'); if(sel && sel.value) params.set('school', sel.value); }catch(e4){} }
    var url = '/api/v034/attendance-safe?' + params.toString();
    log('attendance-staff-fetch', staffName + ' :: ' + url);
    fetch(url, { credentials: 'same-origin' }).then(function(r){
      return r.json().then(function(j){ if(!r.ok || !j || j.ok === false) throw new Error((j && j.error) || ('HTTP '+r.status)); return j; });
    }).then(function(j){ done(j.result || j.data || {}); }).catch(function(e){ if(fail) fail(e); else setMsgSafe('Could not load attendance history: '+((e&&e.message)||e),'err'); });
  }
  function renderStaffAttendanceHistory(staffName, source){
    staffName = clean(staffName);
    if(!staffName){ setMsgSafe('Select a staff member first.','warn'); return false; }
    log('open-staff-attendance', staffName);
    if(!isActive('attendanceManager')){
      var btn = document.querySelector('[data-nav="attendanceManager"]');
      try{ if(typeof window.goToPageV5_ === 'function') window.goToPageV5_('attendanceManager', btn); else if(typeof showPage === 'function') showPage('attendanceManager', btn); }catch(navErr){ log('attendance-staff-nav-error', (navErr&&navErr.message)||navErr); }
    }
    try{ window.attendanceReturnSource = source || 'manager'; attendanceReturnSource = source || 'manager'; }catch(e0){}
    try{ window.attendanceSelectedStaff = staffName; attendanceSelectedStaff = staffName; }catch(e1){}
    try{ window.__attendanceGenericModeV5416 = false; window.__attendanceScopedStaffName = staffName; }catch(e2){}
    var grid = by('attendanceGrid'); if(grid) grid.style.display = 'none';
    var hist = by('attendanceHistoryBox'); if(hist){ hist.style.display = 'block'; hist.innerHTML = '<div class="muted" style="padding:12px">Loading attendance history...</div>'; }
    var heading = by('attendanceMonthHeading'); if(heading) heading.textContent = staffName;
    fetchAttendanceDataForStaff(staffName, function(data){
      try{ window.attendanceManagerData = data || {}; attendanceManagerData = data || {}; }catch(e3){}
      try{ window.attendanceSelectedStaff = staffName; attendanceSelectedStaff = staffName; }catch(e4){}
      try{
        if(typeof window.renderAttendanceHistory === 'function') window.renderAttendanceHistory(staffName);
        else if(typeof window.renderAttendanceManager === 'function') window.renderAttendanceManager();
        tuneDetailedAttendance(staffName);
        log('attendance-staff-rendered', staffName);
      }catch(renderErr){
        log('attendance-staff-render-error', (renderErr&&renderErr.message)||renderErr);
        setMsgSafe('Attendance history loaded, but could not render: '+((renderErr&&renderErr.message)||renderErr), 'err');
        if(hist) hist.innerHTML = '<div class="msg err">Attendance history loaded, but could not render. '+htmlEscape((renderErr&&renderErr.message)||renderErr)+'</div>';
      }
    }, function(err){
      log('attendance-staff-fetch-error', (err&&err.message)||err);
      setMsgSafe('Could not load attendance history: '+((err&&err.message)||err),'err');
      if(hist) hist.innerHTML = '<div class="msg err">Could not load attendance history: '+htmlEscape((err&&err.message)||err)+'</div>';
    });
    return false;
  }
  function installAttendanceHistoryClickHandler(){
    window.openAttendanceForStaff = renderStaffAttendanceHistory;
    try{ openAttendanceForStaff = renderStaffAttendanceHistory; }catch(e){}
    document.addEventListener('click', function(e){
      var t = e.target && e.target.closest && e.target.closest('[data-action="attendance-staff"], .attendanceStaffLink, [data-action="staff-attendance-history"], [data-action="view-staff-attendance"]');
      if(!t) return;
      var action = t.getAttribute('data-action') || '';
      var nm = '';
      if(action === 'staff-attendance-history'){
        try{ nm = (by('staffName') && by('staffName').value) || t.getAttribute('data-staff-name') || t.getAttribute('data-staff') || ''; }catch(e0){}
      }else{
        nm = t.getAttribute('data-staff-name') || t.getAttribute('data-staff') || clean(t.textContent);
      }
      e.preventDefault(); e.stopImmediatePropagation();
      renderStaffAttendanceHistory(nm, action === 'staff-attendance-history' ? 'staff' : 'manager');
      return false;
    }, true);
  }
  function installStyles(){
    if(by('gaRedisV050Styles')) return;
    var st = document.createElement('style'); st.id = 'gaRedisV050Styles';
    st.textContent = [
      '#attendanceManager .attendanceStaffLink{color:#1d4ed8!important;text-decoration:underline!important;background:transparent!important;border:0!important;padding:0!important;font:inherit!important;font-weight:700!important;cursor:pointer!important}',
      '#attendanceManager .attendanceRecordTable td:first-child{white-space:nowrap!important}',
      '#attendanceManager .attendanceMonthTitle{min-height:34px!important}'
    ].join('\n');
    document.head.appendChild(st);
  }
  window.gaV050CalendarAttendanceDiag = function(){
    return {
      version: VERSION,
      active: activePage(),
      lifecycle: { active: lifecycle.active, generation: lifecycle.generation, unmounting: lifecycle.unmounting },
      shellsCaptured: { calendar: !!shells.calendar, attendanceManager: !!shells.attendanceManager },
      trace: trace.slice(-50),
      calendarData: !!window.calendarData,
      attendanceManagerData: !!window.attendanceManagerData,
      hasBaseRenderCalendar: !!base.renderPortalCalendar,
      hasBaseRenderAttendance: !!base.renderAttendanceManager,
      hasBaseRenderAttendanceHistory: !!base.renderAttendanceHistory
    };
  };
  function boot(){
    captureShells();
    installStyles();
    installLifecycleHook();
    wrapRenderers();
    wrapLoaders();
    installAttendanceHistoryClickHandler();
    log('boot');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 20); }); else setTimeout(boot, 20);
  setTimeout(function(){ try{ captureShells(); wrapRenderers(); wrapLoaders(); }catch(e){} }, 700);
})();

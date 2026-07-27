(function(){
  if(window.__SUPPORT_SCHEDULES_V05418DE_TWO_TO_ONE_RENDER_BRIDGE__) return;
  window.__SUPPORT_SCHEDULES_V05418DE_TWO_TO_ONE_RENDER_BRIDGE__ = true;
  var VERSION = '0.54.18de';
  var cache = {};
  var inflight = {};
  var timer = null;
  var observer = null;
  var syncing = false;

  function by(id){ return document.getElementById(id); }
  function qa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/\s+/g,' '); }
  function selectedSchool(){
    try{ if(typeof selectedSchoolPayloadV683 === 'function'){ var p = selectedSchoolPayloadV683() || {}; return p.school || p.schoolId || p.campusId || ''; } }catch(e){}
    try{ if(typeof selectedSchoolPayloadV686m20 === 'function'){ var q = selectedSchoolPayloadV686m20() || {}; return q.school || q.schoolId || q.campusId || ''; } }catch(e){}
    var sel = by('campusSelector'); return clean((sel && sel.value) || '');
  }
  function currentStudentName(){ return clean((by('studentName') || {}).value || ((window.currentStudent || {}).name) || ''); }
  function cacheKey(name){ return String(selectedSchool() || '') + '::' + norm(name || currentStudentName()); }
  function rowItem(tr){ return tr && clean(tr.getAttribute('data-item') || ''); }
  function hasAnyTwo(rec){
    rec = rec || {};
    try{ if(!!rec.enableTwoToOne) return true; }catch(e){}
    try{ if(Object.keys(rec.twoToOnePeriods || {}).some(function(k){ return !!(rec.twoToOnePeriods || {})[k]; })) return true; }catch(e2){}
    try{ if(Object.keys(rec.twoToOneStaff || {}).some(function(k){ var v = (rec.twoToOneStaff || {})[k] || {}; return !!(v.primary2 || v.secondary2); })) return true; }catch(e3){}
    return false;
  }
  function normalizeRec(rec, name){
    rec = rec || {};
    var out = Object.assign({}, rec);
    out.student = clean(out.student || name || currentStudentName());
    out.enableTwoToOne = !!out.enableTwoToOne;
    out.twoToOnePeriods = (out.twoToOnePeriods && typeof out.twoToOnePeriods === 'object') ? Object.assign({}, out.twoToOnePeriods) : {};
    out.twoToOneStaff = (out.twoToOneStaff && typeof out.twoToOneStaff === 'object') ? Object.assign({}, out.twoToOneStaff) : {};
    out.splitPeriodSupport = Array.isArray(out.splitPeriodSupport) ? out.splitPeriodSupport : [];
    if(hasAnyTwo(out)) out.enableTwoToOne = true;
    return out;
  }
  function mergeRec(a, b, name){
    a = normalizeRec(a || {}, name); b = normalizeRec(b || {}, name);
    var out = normalizeRec(Object.assign({}, a, b), name);
    out.twoToOnePeriods = Object.assign({}, a.twoToOnePeriods || {}, b.twoToOnePeriods || {});
    out.twoToOneStaff = Object.assign({}, a.twoToOneStaff || {}, b.twoToOneStaff || {});
    out.splitPeriodSupport = (b.splitPeriodSupport && b.splitPeriodSupport.length) ? b.splitPeriodSupport : (a.splitPeriodSupport || []);
    if(hasAnyTwo(out)) out.enableTwoToOne = true;
    return normalizeRec(out, name);
  }
  function activeStudentRecord(){
    var name = currentStudentName();
    try{
      var rows = ((window.studentData || {}).students) || [];
      for(var i=0;i<rows.length;i++){ if(norm(rows[i].name) === norm(name)) return rows[i]; }
    }catch(e){}
    try{ if(window.currentStudent && norm(window.currentStudent.name) === norm(name)) return window.currentStudent; }catch(e2){}
    return null;
  }
  function remember(rec){
    rec = normalizeRec(rec);
    if(!rec.student) return rec;
    cache[cacheKey(rec.student)] = rec;
    try{
      var st = activeStudentRecord();
      if(st && norm(st.name) === norm(rec.student)) st.advancedScheduling = rec;
      if(window.currentStudent && norm(window.currentStudent.name) === norm(rec.student)) window.currentStudent.advancedScheduling = rec;
      var rows = ((window.studentData || {}).students) || [];
      rows.forEach(function(s){ if(s && norm(s.name) === norm(rec.student)) s.advancedScheduling = rec; });
    }catch(e){}
    return rec;
  }
  function currentRec(){
    var name = currentStudentName();
    var st = activeStudentRecord() || {};
    return mergeRec(st.advancedScheduling || {}, cache[cacheKey(name)] || {}, name);
  }
  function fetchAdvanced(name){
    name = clean(name || currentStudentName());
    if(!name) return Promise.resolve(normalizeRec({}, ''));
    var key = cacheKey(name);
    if(cache[key]) return Promise.resolve(cache[key]);
    if(inflight[key]) return inflight[key];
    var params = new URLSearchParams({school:selectedSchool() || '', student:name, _t:String(Date.now())});
    inflight[key] = fetch('/api/v05418x/student-advanced?' + params.toString(), {credentials:'same-origin', cache:'no-store'})
      .then(function(r){ return r.text().then(function(t){ var j = {}; try{ j = t ? JSON.parse(t) : {}; }catch(e){ j = {}; } if(!r.ok || j.ok === false) throw new Error(j.error || ('HTTP '+r.status)); return remember(j.record || {student:name}); }); })
      .catch(function(){ return currentRec(); })
      .then(function(rec){ delete inflight[key]; return rec; }, function(err){ delete inflight[key]; throw err; });
    return inflight[key];
  }
  function ensureTwoOption(sel){
    if(!sel) return;
    var has = false;
    Array.prototype.slice.call(sel.options || []).forEach(function(o){ if(o.value === '2:1' || norm(o.textContent) === '2:1') has = true; });
    if(!has){ var opt = document.createElement('option'); opt.value = '2:1'; opt.textContent = '2:1'; sel.appendChild(opt); }
  }
  function supportIsTwo(sel){ return !!(sel && (sel.value === '2:1' || norm(sel.value) === '2:1')); }
  function markRowsFromRec(rec){
    rec = normalizeRec(rec || currentRec());
    if(!hasAnyTwo(rec)) return false;
    var changed = false;
    qa('#studentPeriodRows tr').forEach(function(tr){
      var item = rowItem(tr);
      var sel = tr.querySelector('.studentSupport');
      if(!sel) return;
      ensureTwoOption(sel);
      var savedTwo = !!(item && (((rec.twoToOnePeriods || {})[item]) || ((rec.twoToOneStaff || {})[item])));
      if(savedTwo && sel.value !== '2:1'){ sel.value = '2:1'; changed = true; }
    });
    return changed;
  }
  function collectVisibleIntoRec(rec){
    rec = normalizeRec(rec || currentRec());
    qa('#studentPeriodRows tr').forEach(function(tr){
      var item = rowItem(tr); if(!item) return;
      var support = tr.querySelector('.studentSupport');
      var p2 = clean((tr.querySelector('.studentPrimary2') || {}).value || '');
      var s2 = clean((tr.querySelector('.studentSecondary2') || {}).value || '');
      if(supportIsTwo(support) || p2 || s2){
        rec.enableTwoToOne = true;
        rec.twoToOnePeriods[item] = true;
      }
      if(p2 || s2){ rec.twoToOneStaff[item] = {primary2:p2, secondary2:s2}; }
    });
    return remember(rec);
  }
  function syncRows(rec){
    if(syncing) return;
    var name = currentStudentName();
    if(!name || !by('studentPeriodRows')) return;
    syncing = true;
    try{
      rec = collectVisibleIntoRec(rec || currentRec());
      markRowsFromRec(rec);
      try{ if(typeof window.syncTwoToOneRowsV05418AQ === 'function') window.syncTwoToOneRowsV05418AQ(); }catch(e){}
      // AQ is the owner of the actual second-staff row renderer. Re-apply once more
      // after row/value mutations so rows saved as 2:1 do not remain visually hidden.
      setTimeout(function(){
        try{
          var latest = collectVisibleIntoRec(currentRec());
          markRowsFromRec(latest);
          if(typeof window.syncTwoToOneRowsV05418AQ === 'function') window.syncTwoToOneRowsV05418AQ();
        }catch(e){}
      }, 0);
    }finally{
      setTimeout(function(){ syncing = false; }, 80);
    }
  }
  function hydrate(delays){
    var name = currentStudentName();
    if(!name) return;
    delays = Array.isArray(delays) ? delays : [delays == null ? 80 : delays];
    delays.forEach(function(delay){
      setTimeout(function(){
        var nm = currentStudentName(); if(!nm) return;
        fetchAdvanced(nm).then(function(rec){ if(norm(nm) === norm(currentStudentName())) syncRows(rec); });
      }, delay || 0);
    });
  }
  function installObserver(){
    var tbody = by('studentPeriodRows');
    if(!tbody || observer) return;
    observer = new MutationObserver(function(muts){
      if(syncing) return;
      var direct = muts.some(function(m){ return m.type === 'childList'; });
      if(!direct) return;
      clearTimeout(timer);
      timer = setTimeout(function(){
        // Only hydrate when a visible row is already 2:1 or cached/server metadata says 2:1.
        var hasVisibleTwo = qa('#studentPeriodRows .studentSupport').some(function(sel){ return supportIsTwo(sel); });
        if(hasVisibleTwo || hasAnyTwo(currentRec())) hydrate([20, 180]);
      }, 90);
    });
    try{ observer.observe(tbody, {childList:true, subtree:true}); }catch(e){}
  }
  function patchStudentHooks(){
    if(!window.__V05418DE_SELECT_PATCHED__ && typeof window.selectStudent === 'function'){
      window.__V05418DE_SELECT_PATCHED__ = true;
      var baseSelect = window.selectStudent;
      window.selectStudent = function(){ var ret = baseSelect.apply(this, arguments); installObserver(); hydrate([100, 320, 900]); return ret; };
      try{ selectStudent = window.selectStudent; }catch(e){}
    }
    if(!window.__V05418DE_RENDER_PATCHED__ && typeof window.renderStudentPeriodRows === 'function'){
      window.__V05418DE_RENDER_PATCHED__ = true;
      var baseRender = window.renderStudentPeriodRows;
      window.renderStudentPeriodRows = function(){ var ret = baseRender.apply(this, arguments); installObserver(); hydrate([80, 260, 760]); return ret; };
      try{ renderStudentPeriodRows = window.renderStudentPeriodRows; }catch(e){}
    }
    if(!window.__V05418DE_SAVE_PATCHED__ && typeof window.saveStudent === 'function'){
      window.__V05418DE_SAVE_PATCHED__ = true;
      var baseSave = window.saveStudent;
      window.saveStudent = function(){ try{ collectVisibleIntoRec(currentRec()); }catch(e){} var ret = baseSave.apply(this, arguments); hydrate([220, 700, 1600]); return ret; };
      try{ saveStudent = window.saveStudent; }catch(e){}
    }
  }
  function boot(){
    patchStudentHooks();
    installObserver();
    hydrate([180, 700]);
    try{ if(typeof window.registerNavigationAfterHookV5_ === 'function') window.registerNavigationAfterHookV5_(function(page){ if(page === 'students'){ patchStudentHooks(); installObserver(); hydrate([160, 520, 1100]); } }, 'v05418deTwoToOneRenderBridge'); }catch(e){}
  }
  document.addEventListener('change', function(e){
    var t = e.target;
    if(!t || !t.classList) return;
    if(t.classList.contains('studentSupport') || t.classList.contains('studentPrimary2') || t.classList.contains('studentSecondary2')){
      if(t.classList.contains('studentSupport') && t.value !== '2:1'){
        var tr = t.closest('tr'); var item = rowItem(tr); var rec = currentRec();
        if(item && rec && rec.twoToOnePeriods && rec.twoToOneStaff){ delete rec.twoToOnePeriods[item]; delete rec.twoToOneStaff[item]; remember(rec); }
      }
      setTimeout(function(){ syncRows(currentRec()); }, 20);
    }
  }, true);
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('#apSaveAdvanced')) hydrate([220, 700, 1400]);
  }, true);
  document.addEventListener('focusin', function(e){ if(e.target && e.target.classList && e.target.classList.contains('studentSupport')) hydrate([0]); }, true);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.gaV05418DETwoToOneDiag = function(){ return {version:VERSION, school:selectedSchool(), student:currentStudentName(), current:currentRec(), visibleTwo:qa('#studentPeriodRows .studentSupport').filter(supportIsTwo).length, secondRows:qa('.twoToOneSecondStaffRowV05418AR,.twoToOneSecondStaffRowV05418X').length}; };
})();

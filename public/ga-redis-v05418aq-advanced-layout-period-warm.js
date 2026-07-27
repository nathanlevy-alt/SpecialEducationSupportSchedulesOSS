(function(){
  if(window.__SUPPORT_SCHEDULES_V05418AQ_ADVANCED_LAYOUT_PERIOD_WARM__) return;
  window.__SUPPORT_SCHEDULES_V05418AQ_ADVANCED_LAYOUT_PERIOD_WARM__ = true;
  var VERSION = '0.54.18et';
  var advCache = {};
  var agencyCacheBySchool = {};
  var periodWarmState = {};
  var syncTimer = null;
  function by(id){ return document.getElementById(id); }
  function qa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/\s+/g,' '); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function isStudentSupportKindNA(v){
    try{ if(typeof window.isStudentSupportKindNA === 'function') return !!window.isStudentSupportKindNA(v); }catch(e){}
    var k = norm(v);
    return !k || k === 'n/a' || k === 'na' || k === 'none' || k === 'no support needed';
  }
  function selectedSchool(){
    try{ if(typeof selectedSchoolPayloadV683 === 'function'){ var p = selectedSchoolPayloadV683() || {}; return p.school || p.schoolId || p.campusId || ''; } }catch(e){}
    try{ if(typeof selectedSchoolPayloadV686m20 === 'function'){ var q = selectedSchoolPayloadV686m20() || {}; return q.school || q.schoolId || q.campusId || ''; } }catch(e){}
    var sel = by('campusSelector'); return (sel && sel.value) || '';
  }
  function currentStudentName(){ return clean((by('studentName') || {}).value || ((window.currentStudent || {}).name) || ''); }
  function cacheKey(student){ return String(selectedSchool() || '') + '::' + norm(student || currentStudentName()); }
  function parseResponse(r, path){ return r.text().then(function(t){ var j = {}; try{ j = t ? JSON.parse(t) : {}; }catch(e){ throw new Error('Expected JSON from '+path+', got '+String(t || '').slice(0,120)); } if(!r.ok || j.ok === false) throw new Error(j.error || j.message || ('HTTP '+r.status)); return j; }); }
  function url(path, params){ params = params || {}; if(!params.school) params.school = selectedSchool(); params._t = Date.now(); return path + '?' + new URLSearchParams(params).toString(); }
  function get(path, params){ var u = url(path, params || {}); return fetch(u, {credentials:'same-origin', cache:'no-store'}).then(function(r){ return parseResponse(r, u); }); }
  function post(path, body){ body = body || {}; if(!body.school) body.school = selectedSchool(); return fetch(path, {method:'POST', credentials:'same-origin', cache:'no-store', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}).then(function(r){ return parseResponse(r, path); }); }
  // v0.54.18es: 2:1 second-staff is a sidecar Advanced Scheduling value, not a
  // normal Student Manager field. Persist it directly before/when Save Student re-renders
  // the table so the selected 2nd staff value is not lost between display, save, and reload.
  var advancedPersistTimer = null;
  function persistAdvancedRecord(rec, opts){
    opts = opts || {};
    rec = normalizeRec(rec || currentAdvanced());
    if(!rec.student) rec.student = currentStudentName();
    if(!rec.student) return Promise.resolve(null);
    var body = Object.assign({}, rec);
    if(opts.replaceTwoToOneStaff) body.__replaceTwoToOneStaff = true;
    if(opts.replaceTwoToOnePeriods) body.__replaceTwoToOnePeriods = true;
    return post('/api/v05418x/student-advanced', body).then(function(j){
      if(j && j.record){ j.record.__advancedLoadedFromServerV05418EL = true; j.record.__splitPeriodSupportExplicitV05418EL = true; remember(j.record); return j.record; }
      return remember(rec);
    }).catch(function(e){ try{ console.warn('Advanced scheduling persistence failed', e); }catch(_e){} return rec; });
  }
  function scheduleAdvancedPersist(rec, opts){
    opts = opts || {};
    clearTimeout(advancedPersistTimer);
    advancedPersistTimer = setTimeout(function(){ persistAdvancedRecord(rec || currentAdvanced(), opts); }, opts.delay == null ? 160 : opts.delay);
  }
  function activeStudentRecord(){
    var name = currentStudentName();
    try{ var rows = ((window.studentData || {}).students) || []; for(var i=0;i<rows.length;i++){ if(norm(rows[i].name) === norm(name)) return rows[i]; } }catch(e){}
    return window.currentStudent || null;
  }
  function showMsg(msg, type){ try{ if(typeof setMsg === 'function') setMsg(msg, type || 'ok'); }catch(e){} }
  function markDirty(){ try{ if(typeof markProfileDirtyV51229 === 'function') markProfileDirtyV51229('student'); }catch(e){} }
  function defaultRec(student){ return {student:student || currentStudentName(), enableTwoToOne:false, noTemporaryGrouping:false, prioritizeSameStaff:false, avoidBackToBackStaffChanges:false, twoToOnePeriods:{}, splitPeriodSupport:[], twoToOneStaff:{}}; }
  function normalizeRec(rec, student){
    rec = rec || defaultRec(student);
    rec.student = clean(rec.student || student || currentStudentName());
    rec.enableTwoToOne = !!rec.enableTwoToOne;
    rec.noTemporaryGrouping = !!rec.noTemporaryGrouping;
    rec.prioritizeSameStaff = !!rec.prioritizeSameStaff;
    rec.avoidBackToBackStaffChanges = !!rec.avoidBackToBackStaffChanges;
    rec.twoToOnePeriods = (rec.twoToOnePeriods && typeof rec.twoToOnePeriods === 'object') ? rec.twoToOnePeriods : {};
    rec.splitPeriodSupport = Array.isArray(rec.splitPeriodSupport) ? rec.splitPeriodSupport : [];
    // FEATURE (explicit 2:1 staff): per-period second-slot staff picks, keyed by period
    // item -> {primary2, secondary2}. See docs/scheduling-logic.md.
    rec.twoToOneStaff = (rec.twoToOneStaff && typeof rec.twoToOneStaff === 'object') ? rec.twoToOneStaff : {};
    try{
      var hasTwoPeriods = Object.keys(rec.twoToOnePeriods || {}).some(function(k){ return !!(rec.twoToOnePeriods || {})[k]; });
      var hasTwoStaff = Object.keys(rec.twoToOneStaff || {}).some(function(k){ var v=(rec.twoToOneStaff || {})[k] || {}; return !!(v.primary2 || v.secondary2); });
      if(hasTwoPeriods || hasTwoStaff) rec.enableTwoToOne = true;
    }catch(e){}
    return rec;
  }
  function remember(rec){
    rec = normalizeRec(rec);
    if(!rec.student) return rec;
    rec.__advancedLoadedV05418EK = true;
    advCache[cacheKey(rec.student)] = rec;
    try{ var st = activeStudentRecord(); if(st && norm(st.name) === norm(rec.student)) st.advancedScheduling = rec; if(window.currentStudent && norm(window.currentStudent.name) === norm(rec.student)) window.currentStudent.advancedScheduling = rec; }catch(e){}
    return rec;
  }
  function hasMeaningfulAdvanced(rec){
    rec = normalizeRec(rec || {});
    return !!(rec.enableTwoToOne || rec.noTemporaryGrouping || rec.prioritizeSameStaff || rec.avoidBackToBackStaffChanges || (rec.splitPeriodSupport || []).length || Object.keys(rec.twoToOnePeriods || {}).length || Object.keys(rec.twoToOneStaff || {}).length);
  }
  function mergeAdvancedRec(a, b, name){
    a = normalizeRec(a || {}, name); b = normalizeRec(b || {}, name);
    var rec = normalizeRec(Object.assign({}, a, b), name);
    rec.twoToOnePeriods = Object.assign({}, a.twoToOnePeriods || {}, b.twoToOnePeriods || {});
    rec.twoToOneStaff = Object.assign({}, a.twoToOneStaff || {}, b.twoToOneStaff || {});
    // Do not let an empty, client-derived cache record erase split support that came from the
    // student record. An empty split list only wins when it was loaded/saved explicitly.
    var bExplicitSplit = !!(b.__advancedLoadedFromServerV05418EL || b.__splitPeriodSupportExplicitV05418EL || (Array.isArray(b.splitPeriodSupport) && b.splitPeriodSupport.length));
    rec.splitPeriodSupport = bExplicitSplit ? (Array.isArray(b.splitPeriodSupport) ? b.splitPeriodSupport : []) : (Array.isArray(a.splitPeriodSupport) ? a.splitPeriodSupport : []);
    return normalizeRec(rec, name);
  }
  function currentAdvanced(){
    var st = activeStudentRecord() || {}; var name = currentStudentName();
    var rec = mergeAdvancedRec(st.advancedScheduling || {}, advCache[cacheKey(name)] || {}, name);
    try{
      qa('#studentPeriodRows tr').forEach(function(tr){
        var item = tr.getAttribute('data-item'); if(!item) return;
        var sel = tr.querySelector('.studentSupport');
        var p2 = clean((tr.querySelector('.studentPrimary2') || {}).value || '');
        var s2 = clean((tr.querySelector('.studentSecondary2') || {}).value || '');
        deleteTwoToOneAliases(rec.twoToOnePeriods, item);
        deleteTwoToOneAliases(rec.twoToOneStaff, item);
        if(sel && sel.value === '2:1') rec.twoToOnePeriods[item] = true;
        if(p2 || s2){ rec.twoToOnePeriods[item] = true; rec.twoToOneStaff[item] = {primary2:p2, secondary2:s2}; }
      });
    }catch(e){}
    return normalizeRec(rec, name);
  }
  function loadAdvanced(student, force){
    student = clean(student || currentStudentName());
    if(!student) return Promise.resolve(defaultRec(''));
    var key = cacheKey(student);
    if(!force && advCache[key] && (advCache[key].__advancedLoadedFromServerV05418EL || hasMeaningfulAdvanced(advCache[key]))) return Promise.resolve(advCache[key]);
    return get('/api/v05418x/student-advanced', {student:student}).then(function(j){ var rec = j.record || defaultRec(student); rec.__advancedLoadedFromServerV05418EL = true; rec.__splitPeriodSupportExplicitV05418EL = true; return remember(rec); }).catch(function(){ return normalizeRec((activeStudentRecord() || {}).advancedScheduling || defaultRec(student), student); });
  }

  function isStudentsPageActive(){ var sec = by('students'); return !!(sec && sec.classList && sec.classList.contains('active')); }
  function studentProfileDirty(){ try{ return !!window.profileDirtyV51229 && window.profileDirtyAreaV51229 === 'student'; }catch(e){ return false; } }
  function mergePeriodSourceIntoStudentData(source){
    source = source || {};
    var items = Array.isArray(source.items) ? source.items : (Array.isArray(source.itemOrder) ? source.itemOrder : []);
    if(!items.length) return false;
    var sd = window.studentData || {};
    var before = Array.isArray(sd.items) ? sd.items.slice() : [];
    var labels = Object.assign({}, sd.itemLabels || {}, source.itemLabels || {});
    var seen = {};
    var merged = [];
    function add(v){ v = clean(v); if(!v) return; var k = norm(v); if(seen[k]) return; seen[k]=true; merged.push(v); }
    items.forEach(add);
    before.forEach(add);
    if(merged.length <= before.length) { if(Object.keys(source.itemLabels || {}).length){ sd.itemLabels = labels; try{ studentData = sd; }catch(e){} window.studentData = sd; } return false; }
    sd.items = merged;
    sd.itemLabels = labels;
    try{ studentData = sd; }catch(e){}
    window.studentData = sd;
    return true;
  }
  function warmStudentPeriodSourceOnce(){
    var school = selectedSchool();
    if(!school || !isStudentsPageActive()) return;
    if(studentProfileDirty()) return;
    var state = periodWarmState[school] || (periodWarmState[school] = {done:false,inFlight:false});
    if(state.inFlight || state.done) return;
    var sd = window.studentData || {};
    var currentItems = Array.isArray(sd.items) ? sd.items : [];
    var rows = qa('#studentPeriodRows tr');
    var defaultOnly = currentItems.length <= 8 || rows.length <= 8;
    if(!defaultOnly) { state.done = true; return; }
    state.inFlight = true;
    get('/api/v05418af/period-meta', {school:school}).then(function(j){
      state.inFlight = false; state.done = true;
      if(selectedSchool() !== school || !isStudentsPageActive() || studentProfileDirty()) return;
      var changed = mergePeriodSourceIntoStudentData(j || {});
      if(!changed) return;
      var st = window.currentStudent || activeStudentRecord();
      if(st && st.rowIndex != null && typeof window.selectStudent === 'function'){
        try{ window.selectStudent(st.rowIndex, true); }catch(e){}
        try{ scheduleStudentSync(120); }catch(e2){}
      } else if(typeof window.renderStudentPeriodRows === 'function') {
        try{ window.renderStudentPeriodRows(); }catch(e3){}
      }
    }).catch(function(){ state.inFlight = false; state.done = true; });
  }
  function loadAgenciesForSchool(){
    var school = selectedSchool();
    if(!school) return Promise.resolve([]);
    var cached = agencyCacheBySchool[school];
    if(cached && cached.rows) return Promise.resolve(cached.rows);
    if(cached && cached.promise) return cached.promise;
    var rec = agencyCacheBySchool[school] = {};
    rec.promise = get('/api/v05418x/agencies', {school:school}).then(function(j){ rec.rows = Array.isArray(j.rows) ? j.rows : []; return rec.rows; }).catch(function(){ rec.rows = []; return rec.rows; });
    return rec.promise;
  }
  function agencyRowMatchesStudent(row, student){
    if(!row || row.active === false || norm(row.active) === 'no' || norm(row.status) === 'inactive') return false;
    var s = clean(row.student || row.studentName || row.name || '');
    return !!s && norm(s) === norm(student);
  }
  function renderAgencyFlag(){
    var name = currentStudentName();
    var input = by('studentName');
    if(!input) return;
    var wrap = input.parentNode;
    if(!wrap) return;
    var flag = by('studentAgencySupportedFlagV05418AQ');
    if(!flag){ flag = document.createElement('div'); flag.id = 'studentAgencySupportedFlagV05418AQ'; flag.className = 'studentAgencySupportedFlagV05418AQ'; flag.textContent = 'Agency Supported'; wrap.appendChild(flag); }
    if(!name){ flag.style.display = 'none'; return; }
    loadAgenciesForSchool().then(function(rows){
      if(currentStudentName() !== name) return;
      var hit = (rows || []).some(function(r){ return agencyRowMatchesStudent(r, name); });
      flag.style.display = hit ? 'inline-flex' : 'none';
    });
  }
  // FEATURE (agency emergency coverage / student list alert): the request specifically asked
  // for the "Agency Supported" alert to show next to each student's name in the left list
  // (the browsable roster), not just on the currently-open profile panel where
  // renderAgencyFlag() above already shows it. renderIssueBadgesForStudent is the existing,
  // synchronous badge function renderStudentList() already calls per row, so we patch it to
  // append the same badge style used for every other alert in that list. Agency data loads
  // async, so this returns immediately from cache when available and otherwise kicks off a
  // load and re-renders the list once it resolves.
  function isAgencySupportedActive(studentName){
    var school = selectedSchool();
    var cached = agencyCacheBySchool[school];
    if(cached && cached.rows) return (cached.rows || []).some(function(r){ return agencyRowMatchesStudent(r, studentName); });
    loadAgenciesForSchool().then(function(){ try{ if(typeof window.renderStudentList === 'function') window.renderStudentList(); }catch(e){} });
    return false;
  }
  function patchStudentListBadges(){
    if(window.__V05418AR_BADGE_PATCHED__) return;
    var base = window.renderIssueBadgesForStudent;
    if(typeof base !== 'function') return;
    window.__V05418AR_BADGE_PATCHED__ = true;
    window.renderIssueBadgesForStudent = function(s){
      var html = base.apply(this, arguments) || '';
      try{
        var toggle = by('studentBadgeToggle');
        var suppressed = (toggle && !toggle.checked) || (document.body && document.body.classList.contains('noBadges'));
        if(!suppressed && s && s.name && isAgencySupportedActive(s.name)) html += '<span class="badge warn">Agency Supported</span>';
      }catch(e){}
      return html;
    };
    try{ renderIssueBadgesForStudent = window.renderIssueBadgesForStudent; }catch(e2){}
  }
  function hideStaffEmailOrphans(){
    var ids = ['staffNotificationEmailV686m41','staffNotificationEmailV686m26','staffNotificationEmailV024','staffEmailFieldV024'];
    ids.forEach(function(idv){
      var el = by(idv); if(!el) return;
      if(el.closest && el.closest('#staffMetricsContactRowV0545')) return;
      var node = el.closest && (el.closest('.staffMetricFieldV0545') || el.closest('[id$="FieldV024"]') || el.closest('.inline') || el.parentElement);
      if(node) node.style.display = 'none';
      el.style.display = 'none';
      var prev = node && node.previousElementSibling;
      if(prev && /^label$/i.test(prev.tagName || '') && /email/i.test(prev.textContent || '')) prev.style.display = 'none';
    });
    qa('#staff > .split > .card:first-child label').forEach(function(label){
      if(!/email/i.test(label.textContent || '')) return;
      var next = label.nextElementSibling;
      if(next && (next.tagName === 'INPUT' || (next.querySelector && next.querySelector('input[id*="Email"],input[id*="email"]')))){
        label.style.display = 'none'; next.style.display = 'none';
      }
    });
  }
  function studentItems(){
    var out = [], seen = {};
    function add(value, label){ value = clean(value); label = clean(label || value); if(!value && !label) return; var k = norm(value || label); if(seen[k]) return; seen[k] = true; out.push({value:value || label, label:label || value}); }
    try{ var sd = window.studentData || {}; (sd.items || []).forEach(function(it){ add(it, (sd.itemLabels && sd.itemLabels[it]) || it); }); }catch(e){}
    try{ qa('#studentPeriodRows tr').forEach(function(tr){ var item = tr.getAttribute('data-item') || ''; var cell = tr.querySelector('td:first-child b') || tr.querySelector('td:first-child'); var label = cell ? clean(cell.textContent.replace(/2:1|Split/g,'')) : item; add(item, label); }); }catch(e){}
    if(!out.length) ['Period 1','Period 2','Period 3','Period 4','Period 5','Period 6','Break','Lunch'].forEach(function(x){ add(x,x); });
    return out;
  }
  function labelForItem(value){ var n = norm(value); var items = studentItems(); for(var i=0;i<items.length;i++){ if(norm(items[i].value) === n || norm(items[i].label) === n) return items[i].label; } return value; }
  function twoToOneKeyAliases(item){
    item = clean(item);
    var out = [], seen = {};
    function add(v){ v = clean(v); if(!v) return; var k = norm(v); if(seen[k]) return; seen[k] = true; out.push(v); }
    add(item); add(labelForItem(item));
    try{ var items = studentItems(); items.forEach(function(it){ if(norm(it.value) === norm(item) || norm(it.label) === norm(item) || norm(it.value) === norm(labelForItem(item)) || norm(it.label) === norm(labelForItem(item))){ add(it.value); add(it.label); } }); }catch(e){}
    return out;
  }
  function findTwoToOneKey(map, item){
    map = (map && typeof map === 'object') ? map : {};
    var aliases = twoToOneKeyAliases(item).map(norm);
    var keys = Object.keys(map || {});
    for(var i=0;i<keys.length;i++){ if(aliases.indexOf(norm(keys[i])) >= 0) return keys[i]; }
    return '';
  }
  function deleteTwoToOneAliases(map, item){
    map = (map && typeof map === 'object') ? map : {};
    var aliases = twoToOneKeyAliases(item).map(norm);
    Object.keys(map || {}).forEach(function(k){ if(aliases.indexOf(norm(k)) >= 0) delete map[k]; });
    return map;
  }
  function hasAnyTwoToOneState(rec){
    rec = rec || {};
    return Object.keys(rec.twoToOnePeriods || {}).some(function(k){ return !!(rec.twoToOnePeriods || {})[k]; }) || Object.keys(rec.twoToOneStaff || {}).some(function(k){ var v=(rec.twoToOneStaff || {})[k] || {}; return !!(clean(v.primary2) || clean(v.secondary2)); });
  }
  function hasTwoToOneForItem(rec, item){
    rec = rec || {};
    var pKey = findTwoToOneKey(rec.twoToOnePeriods || {}, item);
    var sKey = findTwoToOneKey(rec.twoToOneStaff || {}, item);
    return !!((pKey && (rec.twoToOnePeriods || {})[pKey]) || (sKey && (rec.twoToOneStaff || {})[sKey]));
  }
  function twoToOnePickForItem(rec, item){
    rec = rec || {};
    var staff = rec.twoToOneStaff || {};
    var key = findTwoToOneKey(staff, item);
    return key ? (staff[key] || {}) : {};
  }
  function addTwoToOneOption(sel, enabled){
    if(!sel) return;
    var opts = Array.prototype.slice.call(sel.options || []);
    var has = opts.some(function(o){ return o.value === '2:1' || norm(o.textContent) === '2:1'; });
    if(enabled && !has){ var opt = document.createElement('option'); opt.value = '2:1'; opt.textContent = '2:1'; sel.appendChild(opt); }
    if(!enabled && has && sel.value !== '2:1') opts.forEach(function(o){ if(o.value === '2:1' || norm(o.textContent) === '2:1') o.remove(); });
  }
  function collectTwoToOnePeriodsFromRows(opts){
    opts = opts || {};
    var out = {};
    if(opts.preserveExisting !== false){
      try{
        var name = currentStudentName();
        var st = activeStudentRecord() || {};
        var rec = mergeAdvancedRec(st.advancedScheduling || {}, advCache[cacheKey(name)] || {}, name);
        out = Object.assign({}, rec.twoToOnePeriods || {});
      }catch(e){}
    }
    qa('#studentPeriodRows tr').forEach(function(tr){
      var item = tr.getAttribute('data-item'); if(!item) return;
      var sel = tr.querySelector('.studentSupport');
      var p2 = clean((tr.querySelector('.studentPrimary2') || {}).value || '');
      var s2 = clean((tr.querySelector('.studentSecondary2') || {}).value || '');
      // Rendered rows are authoritative. If an admin changes a period away from 2:1,
      // remove all saved aliases for that period instead of preserving stale sidecar state.
      deleteTwoToOneAliases(out, item);
      if(sel && sel.value === '2:1') out[item] = true;
      if(p2 || s2) out[item] = true;
    });
    return out;
  }
  function syncTwoToOneOptions(rec){
    rec = normalizeRec(rec || currentAdvanced());
    var enabled = !!rec.enableTwoToOne || Object.keys(rec.twoToOnePeriods || {}).some(function(k){ return !!(rec.twoToOnePeriods || {})[k]; }) || Object.keys(rec.twoToOneStaff || {}).some(function(k){ var v=(rec.twoToOneStaff || {})[k] || {}; return !!(v.primary2 || v.secondary2); });
    if(enabled) rec.enableTwoToOne = true;
    qa('#studentPeriodRows .studentSupport').forEach(function(sel){
      var tr = sel.closest('tr'); var item = tr && tr.getAttribute('data-item');
      var hasSavedTwo = !!(item && hasTwoToOneForItem(rec, item));
      var userCleared = !!(tr && tr.dataset && tr.dataset.twoToOneUserOverride === 'off');
      addTwoToOneOption(sel, enabled || sel.value === '2:1' || hasSavedTwo);
      if(enabled && hasSavedTwo && !userCleared){ addTwoToOneOption(sel, true); sel.value = '2:1'; }
      if((!enabled || userCleared) && sel.value === '2:1') sel.value = '';
    });
    remember(rec);
    renderRowChips(rec);
    renderTwoToOneStaffRows(rec);
  }
  // FEATURE (explicit 2:1 staff): when a period's Degree of Support is 2:1, add a second
  // line under Primary Staff and under Secondary Staff so the two staff working that
  // period together can be explicitly picked, instead of only one preferred staff member
  // with the second slot left to auto-assignment. Feeds twoToOneStaff[item] = {primary2,
  // secondary2}, which the assignment engine's cloneNeedForTwoToOneSecondStaffV05418X_
  // already reads (see docs/scheduling-logic.md) — this was the missing UI half.
  function rowNeedTypeForSecondStaff(tr){
    try{
      var kindEl = tr && tr.querySelector ? tr.querySelector('.studentSupportKind') : null;
      if(kindEl && typeof window.selectedStudentSupportKindTextV5278 === 'function') return window.selectedStudentSupportKindTextV5278(kindEl);
      var raw = clean((kindEl || {}).value || '');
      if(raw && !isStudentSupportKindNA(raw)) return raw;
    }catch(e){}
    return 'Instruction';
  }
  function ensureSelectedStaffOption(sel, selected){
    selected = clean(selected);
    if(!sel || !selected) return;
    try{ if(typeof window.setStudentStaffSelectValueV5272 === 'function'){ window.setStudentStaffSelectValueV5272(sel, selected); return; } }catch(e){}
    var matched = false;
    try{ Array.prototype.slice.call(sel.options || []).forEach(function(o){ if(norm(o.value) === norm(selected)){ o.selected = true; matched = true; } }); }catch(e2){}
    if(!matched){
      try{ sel.insertAdjacentHTML('beforeend','<option value="'+esc(selected)+'" selected>'+esc(selected)+'</option>'); }catch(e3){}
    }
    try{ sel.value = selected; }catch(e4){}
  }
  function staffSelectOptionsHtml(needType, selected, sourceSel){
    needType = clean(needType || 'Instruction');
    if(isStudentSupportKindNA(needType)) needType = 'Instruction';
    // Mirror the existing Primary/Secondary dropdown whenever possible, but NEVER copy its
    // selected state into the 2nd-staff selector. Copying selected="selected" from the first
    // staff field caused the 2nd staff value to become the first staff member after save.
    try{
      if(sourceSel && sourceSel.tagName && String(sourceSel.tagName).toLowerCase() === 'select' && sourceSel.innerHTML){
        var html = String(sourceSel.innerHTML || '').replace(/\sselected(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/ig, '');
        if(!/<option[^>]*value=(?:""|''|\s|>)/i.test(html)) html = '<option value=""></option>' + html;
        return html;
      }
    }catch(e0){}
    try{ if(typeof window.studentStaffOptionsV5271 === 'function') return window.studentStaffOptionsV5271(needType, selected || ''); }catch(e){}
    try{ if(typeof studentStaffOptionsV5271 === 'function') return studentStaffOptionsV5271(needType, selected || ''); }catch(e1){}
    var out = ['<option value=""></option>'];
    try{
      (((window.staffData && window.staffData.staff) || (window.studentData && window.studentData.staff) || [])).forEach(function(s){
        var nm = clean(s && (s.name || s)); if(!nm) return;
        out.push('<option value="'+esc(nm)+'" '+(norm(nm)===norm(selected)?'selected':'')+'>'+esc(nm)+'</option>');
      });
    }catch(e2){}
    return out.join('');
  }
  function ensureSecondStaffSelect(cell, cls, label, value, needType, sourceSel){
    if(!cell) return null;
    value = clean(value || '');
    var matches = qa('.'+cls, cell);
    var sel = matches[0] || null;
    matches.slice(1).forEach(function(extra){ try{ var row = extra.closest && extra.closest('.twoToOneSecondStaffRowV05418AR,.twoToOneSecondStaffRowV05418X'); if(row) row.remove(); else extra.remove(); }catch(e){} });
    if(!sel){
      var wrap = document.createElement('div'); wrap.className = 'twoToOneSecondStaffRowV05418AR';
      var tag = document.createElement('span'); tag.className = 'twoToOneSecondStaffTagV05418AR'; tag.textContent = label;
      sel = document.createElement('select'); sel.className = cls + ' twoToOneSecondStaffSelectV05418AR';
      wrap.appendChild(tag); wrap.appendChild(sel); cell.appendChild(wrap);
    }
    var existing = clean(sel.value || '');
    sel.innerHTML = staffSelectOptionsHtml(needType || 'Instruction', value || existing, sourceSel);
    ensureSelectedStaffOption(sel, value || existing);
    try{ sel.disabled = !!(sourceSel && sourceSel.disabled); }catch(e){}
    sel.title = (sourceSel && sourceSel.title) || 'Select the additional 2:1 staff member for this period.';
    try{ sel.setAttribute('data-v05418aq-owner','1'); }catch(e){}
    return sel;
  }
  function renderTwoToOneStaffRows(rec){
    rec = normalizeRec(rec || currentAdvanced());
    var staffPicks = rec.twoToOneStaff || {};
    qa('#studentPeriodRows tr').forEach(function(tr){
      try{ qa('.twoToOneSecondStaffRowV05418X', tr).forEach(function(el){ el.remove(); }); }catch(e){}
      try{ ['studentPrimary2','studentSecondary2'].forEach(function(cls){ var rows = qa('.'+cls, tr).map(function(sel){ return sel.closest && sel.closest('.twoToOneSecondStaffRowV05418AR,.twoToOneSecondStaffRowV05418X'); }).filter(Boolean); rows.slice(1).forEach(function(row){ try{ row.remove(); }catch(e){} }); }); }catch(e){}
      var item = tr.getAttribute('data-item');
      var supportSel = tr.querySelector('.studentSupport');
      var isTwoToOne = !!(supportSel && supportSel.value === '2:1');
      var primarySel = tr.querySelector('.studentPrimary');
      var secondarySel = tr.querySelector('.studentSecondary');
      var primaryCell = primarySel && primarySel.parentNode ? primarySel.parentNode : (tr.children && tr.children[4]);
      var secondaryCell = secondarySel && secondarySel.parentNode ? secondarySel.parentNode : (tr.children && tr.children[5]);
      if(!isTwoToOne){
        qa('.twoToOneSecondStaffRowV05418AR', tr).forEach(function(el){ el.remove(); });
        return;
      }
      var pick = twoToOnePickForItem(rec, item);
      var needType = rowNeedTypeForSecondStaff(tr);
      ensureSecondStaffSelect(primaryCell, 'studentPrimary2', '2nd:', pick.primary2 || '', needType, primarySel);
      ensureSecondStaffSelect(secondaryCell, 'studentSecondary2', '2nd:', pick.secondary2 || '', needType, secondarySel);
    });
  }
  function setSupportSelectToIndividual(sel){
    if(!sel) return;
    var opts = Array.prototype.slice.call(sel.options || []);
    var individual = opts.find(function(o){ return norm(o.value) === 'individual' || norm(o.textContent) === 'individual'; });
    if(individual){ sel.value = individual.value; return; }
    var blank = opts.find(function(o){ return !clean(o.value) && !clean(o.textContent); });
    sel.value = blank ? blank.value : '';
  }
  function clearTwoToOneRowsAndFields(){
    qa('#studentPeriodRows tr').forEach(function(tr){
      var sel = tr.querySelector('.studentSupport');
      if(sel && sel.value === '2:1') setSupportSelectToIndividual(sel);
      qa('.studentPrimary2,.studentSecondary2', tr).forEach(function(x){ try{ x.value = ''; }catch(e){} });
      qa('.twoToOneSecondStaffRowV05418AR,.twoToOneSecondStaffRowV05418X', tr).forEach(function(el){ try{ el.remove(); }catch(e){} });
    });
    try{ renderRowChips(normalizeRec({student:currentStudentName(), enableTwoToOne:false, twoToOnePeriods:{}, twoToOneStaff:{}})); }catch(e){}
  }
  function collectTwoToOneStaffFromRows(opts){
    opts = opts || {};
    var out = {};
    if(opts.preserveExisting !== false){
      try{
        var name = currentStudentName();
        var st = activeStudentRecord() || {};
        var rec = mergeAdvancedRec(st.advancedScheduling || {}, advCache[cacheKey(name)] || {}, name);
        out = Object.assign({}, rec.twoToOneStaff || {});
      }catch(e){}
    }
    qa('#studentPeriodRows tr').forEach(function(tr){
      var item = tr.getAttribute('data-item');
      var supportSel = tr.querySelector('.studentSupport');
      if(!item) return;
      // Rendered rows are authoritative for this period. This permits clearing a saved
      // 2nd staff name and permits changing a 2:1 period back to Individual/Group/etc.
      deleteTwoToOneAliases(out, item);
      if(!supportSel || supportSel.value !== '2:1') return;
      var p2 = clean((tr.querySelector('.studentPrimary2') || {}).value || '');
      var s2 = clean((tr.querySelector('.studentSecondary2') || {}).value || '');
      if(p2 || s2) out[item] = {primary2:p2, secondary2:s2};
    });
    return out;
  }
  function optionHtml(selected){ return studentItems().map(function(it){ return '<option value="'+esc(it.value)+'" '+(norm(it.value)===norm(selected)||norm(it.label)===norm(selected)?'selected':'')+'>'+esc(it.label)+'</option>'; }).join(''); }
  function splitRowHtml(row, idx){
    row = row || {}; var mode = clean(row.mode || row.position || (row.startMinute != null || row.endMinute != null ? 'between' : 'first')) || 'first';
    var minutes = clean(row.minutes || row.lengthMinutes || '');
    var startMinute = clean(row.startMinute != null ? row.startMinute : (row.betweenStart != null ? row.betweenStart : ''));
    var endMinute = clean(row.endMinute != null ? row.endMinute : (row.betweenEnd != null ? row.betweenEnd : ''));
    if(mode === 'between' && !minutes){ minutes = startMinute || endMinute || ''; }
    return '<div class="apSplitRow" data-split-index="'+idx+'">'
      + '<select class="apSplitItem" aria-label="Period">'+optionHtml(row.item)+'</select>'
      + '<select class="apSplitMode" aria-label="Window type"><option value="first" '+(mode==='first'?'selected':'')+'>first</option><option value="last" '+(mode==='last'?'selected':'')+'>last</option><option value="between" '+(mode==='between'?'selected':'')+'>between</option></select>'
      + '<input class="apSplitMinutes" type="number" min="1" step="1" placeholder="minutes" value="'+esc(minutes)+'">'
      + '<input class="apSplitStart" type="number" min="0" step="1" placeholder="start min" value="'+esc(startMinute)+'">'
      + '<input class="apSplitEnd" type="number" min="1" step="1" placeholder="end min" value="'+esc(endMinute)+'">'
      + '<button type="button" class="attendanceTinyAction trash apRemoveSplit" title="Remove split window"><i class="fa fa-trash" aria-hidden="true"></i></button>'
      + '</div>';
  }
  function updateSplitRowMode(row){
    if(!row) return;
    var mode = clean((row.querySelector('.apSplitMode') || {}).value || 'first');
    row.setAttribute('data-window-mode', mode);
    var min = row.querySelector('.apSplitMinutes'), st = row.querySelector('.apSplitStart'), en = row.querySelector('.apSplitEnd');
    function show(el, visible){
      if(!el) return;
      el.style.display = '';
      el.style.visibility = visible ? '' : 'hidden';
      el.setAttribute('aria-hidden', visible ? 'false' : 'true');
      el.tabIndex = visible ? 0 : -1;
    }
    show(min, true);
    show(st, false);
    show(en, false);
  }
  function syncSplitModes(){ qa('#advancedSchedulingModalV05418AQ .apSplitRow').forEach(updateSplitRowMode); }
  function isMeaningfulSplitRow(row){
    row = row || {};
    var mode = clean(row.mode || row.position || (row.startMinute != null || row.endMinute != null ? 'between' : 'first')) || 'first';
    var mins = Number(clean(row.minutes || row.lengthMinutes || (mode === 'between' ? (row.startMinute != null ? row.startMinute : '') : '')));
    return isFinite(mins) && mins > 0;
  }
  function splitRowsHtml(rows){ rows = (Array.isArray(rows) ? rows : []).filter(isMeaningfulSplitRow); return '<div class="apSplitRows">'+rows.map(splitRowHtml).join('')+'</div><button type="button" class="btn small" id="apAddSplitWindow">+ Add structured split window</button>'; }
  function collectSplitRows(){
    return qa('#advancedSchedulingModalV05418AQ .apSplitRow').map(function(row){
      var mode = clean((row.querySelector('.apSplitMode') || {}).value || 'first');
      var item = clean((row.querySelector('.apSplitItem') || {}).value);
      var out = {item:item, mode:mode};
      out.minutes = Number(clean((row.querySelector('.apSplitMinutes') || {}).value));
      if(!isFinite(out.minutes) || out.minutes <= 0) return null;
      out.label = labelForItem(item);
      return out;
    }).filter(Boolean);
  }
  function splitChipLabelV05418EK(row){
    row = row || {};
    var cap = clean(row.splitWindowCaption || row.caption || row.splitWindowLabel || row.splitLabel || '');
    if(cap && !/^split$/i.test(cap)) return cap.replace(/minutes\b/i, 'min');
    var mode = clean(row.mode || row.windowMode || row.type || row.segment || row.position || row.splitWindowMode).toLowerCase();
    var mins = clean(row.minutes || row.duration || row.minuteCount || row.lengthMinutes || row.splitWindowMinutes);
    if(mode === 'first' && mins) return 'First ' + mins + ' min';
    if(mode === 'last' && mins) return 'Last ' + mins + ' min';
    if(mode === 'between' && mins) return 'Between ' + mins + ' min';
    if((row.start || row.startTime) && (row.end || row.endTime)) return clean(row.start || row.startTime) + ' - ' + clean(row.end || row.endTime);
    return '';
  }
  function splitRowsForChipsV05418EK(rec){
    rec = normalizeRec(rec || currentAdvanced());
    var rows = [];
    if(Array.isArray(rec.splitPeriodSupport)) rows = rows.concat(rec.splitPeriodSupport);
    if(Array.isArray(rec.splitPeriodSupportParsed)) rows = rows.concat(rec.splitPeriodSupportParsed);
    var seen = {};
    return rows.filter(function(r){
      if(!r || typeof r !== 'object') return false;
      var k = norm((r.item || r.periodValue || r.period || r.label || '') + '|' + (r.mode || r.windowMode || r.type || r.segment || r.position || '') + '|' + (r.minutes || r.duration || r.minuteCount || r.lengthMinutes || '') + '|' + (r.start || r.startTime || '') + '|' + (r.end || r.endTime || ''));
      if(!k || seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }
  function renderRowChips(rec){
    rec = normalizeRec(rec || currentAdvanced());
    var rows = splitRowsForChipsV05418EK(rec);
    qa('#studentPeriodRows tr').forEach(function(tr){
      var item = tr.getAttribute('data-item'); var first = tr.querySelector('td:first-child'); if(!first) return;
      qa('.advancedRowChipsV05418AQ,.advancedRowChipsV05418AO,.advancedRowChipsV05418X,.advancedRowChipsV05418EO,.splitChipV05418EE,.splitChipV05418EG,.splitChipV05418EH,.splitChipV05418EI,.splitChipV05418EJ', first).forEach(function(old){ old.remove(); });
      var chips = []; var sel = tr.querySelector('.studentSupport'); if(sel && sel.value === '2:1') chips.push('2:1');
      var labels = [];
      rows.forEach(function(r){
        var wanted = norm(r.item || r.periodValue || r.period || r.label || '');
        if(!wanted || (wanted !== norm(item) && wanted !== norm(labelForItem(item)))) return;
        var lbl = splitChipLabelV05418EK(r);
        if(lbl && !labels.some(function(x){ return norm(x) === norm(lbl); })) labels.push(lbl);
      });
      if(labels.length) chips.push('Split: ' + labels.join(' + '));
      if(!chips.length) return;
      var div = document.createElement('div'); div.className = 'advancedRowChipsV05418AQ'; div.innerHTML = chips.map(function(c){ return '<span>'+esc(c)+'</span>'; }).join(''); first.appendChild(div);
    });
  }
  function modalHtml(name, rec){
    var max = (by('studentMaxGroupSize') || {}).value;
    return '<div class="apModalBackdrop" data-ap-close="1"></div><div class="modalCard advancedSchedulingCardV05418AQ" role="dialog" aria-modal="true" aria-labelledby="apAdvancedTitle">'
      + '<div class="modalTitleRow apTitleRow"><h3 id="apAdvancedTitle">Advanced Scheduling Options</h3><button class="modalCloseX" type="button" data-ap-close="1" aria-label="Close">×</button></div>'
      + '<div class="muted apStudentLine">Student: <b>'+esc(name)+'</b></div>'
      + '<div class="apOptionList">'
      + '<label class="advancedOptionV05418AQ"><input type="checkbox" id="apEnableTwoToOne" '+(rec.enableTwoToOne?'checked':'')+'> <span><b>Enable 2:1 Support</b><em>Adds 2:1 as an available Degree of Support option for this student.</em></span></label>'
      + '<label class="advancedOptionV05418AQ"><input type="checkbox" id="apNoTempGroup" '+(rec.noTemporaryGrouping || max === '0' ? 'checked' : '')+'> <span><b>Do not temporarily group this student for staff breaks/lunches</b><em>Sets Max Group Size to 0 for this student.</em></span></label>'
      + '<label class="advancedOptionV05418AQ"><input type="checkbox" id="apSameStaff" '+(rec.prioritizeSameStaff?'checked':'')+'> <span><b>Prioritize same staff across the day</b><em>Scheduling preference, provided when staffing permits.</em></span></label>'
      + '<label class="advancedOptionV05418AQ"><input type="checkbox" id="apAvoidBackToBack" '+(rec.avoidBackToBackStaffChanges?'checked':'')+'> <span><b>Avoid back-to-back staff changes</b><em>Scheduling preference, provided when staffing permits.</em></span></label>'
      + '</div>'
      + '<div class="advancedSplitBoxV05418AQ"><h4>Split-period support</h4><div class="muted">Use only when staff will support the student for part of a selected period. First = period start to start + minutes. Last = period end - minutes to period end. Between = start + minutes to end - minutes.</div><div class="apSplitHeader"><span>Period</span><span>Window</span><span>Minutes</span><span></span><span></span><span></span></div>'+splitRowsHtml(rec.splitPeriodSupport)+'</div>'
      + '<div id="apAdvancedMsg" class="muted"></div><div class="toolbar apFooter"><button class="btn" type="button" data-ap-close="1">Cancel</button><button class="btn primary" id="apSaveAdvanced" type="button">Save advanced options</button></div>'
      + '</div>';
  }
  function openModal(){
    var name = currentStudentName(); if(!name){ showMsg('Choose a student before opening advanced scheduling options.','warn'); return; }
    loadAdvanced(name).then(function(rec){
      rec = remember(rec); var modal = by('advancedSchedulingModalV05418AQ');
      if(!modal){ modal = document.createElement('div'); modal.id = 'advancedSchedulingModalV05418AQ'; modal.className = 'modal advancedSchedulingModalV05418AQ'; document.body.appendChild(modal); }
      ['advancedSchedulingModalV05418X','advancedSchedulingModalV05418AO'].forEach(function(id){ var old = by(id); if(old) old.classList.remove('active'); });
      modal.innerHTML = modalHtml(name, rec); modal.classList.add('active'); syncSplitModes(); syncTwoToOneOptions(rec);
      setTimeout(function(){ var first = by('apEnableTwoToOne'); if(first) first.focus(); }, 20);
    });
  }
  function closeModal(){ var m = by('advancedSchedulingModalV05418AQ'); if(m) m.classList.remove('active'); }
  function saveAdvanced(){
    var name = currentStudentName(); if(!name) return;
    var rec = currentAdvanced();
    rec.student = name;
    rec.enableTwoToOne = !!(by('apEnableTwoToOne') || {}).checked;
    rec.noTemporaryGrouping = !!(by('apNoTempGroup') || {}).checked;
    rec.prioritizeSameStaff = !!(by('apSameStaff') || {}).checked;
    rec.avoidBackToBackStaffChanges = !!(by('apAvoidBackToBack') || {}).checked;
    var mg = by('studentMaxGroupSize'); if(mg){ mg.value = rec.noTemporaryGrouping ? '0' : ''; try{ mg.dispatchEvent(new Event('input', {bubbles:true})); }catch(e){} }
    if(!rec.enableTwoToOne){
      rec.twoToOnePeriods = {};
      rec.twoToOneStaff = {};
      clearTwoToOneRowsAndFields();
      syncTwoToOneOptions(rec);
    } else {
      syncTwoToOneOptions(rec);
      rec.twoToOnePeriods = collectTwoToOnePeriodsFromRows();
      rec.twoToOneStaff = collectTwoToOneStaffFromRows();
    }
    rec.splitPeriodSupport = collectSplitRows();
    rec.__replaceTwoToOnePeriods = true;
    rec.__replaceTwoToOneStaff = true;
    var msg = by('apAdvancedMsg'); if(msg) msg.textContent = 'Saving...';
    post('/api/v05418x/student-advanced', rec).then(function(j){
      if(j && j.record){ j.record.__advancedLoadedFromServerV05418EL = true; j.record.__splitPeriodSupportExplicitV05418EL = true; }
      rec = remember(j.record || rec);
      syncTwoToOneOptions(rec);
      markDirty();
      if(msg) msg.textContent = 'Saved. Save the student card to keep any row-level Degree of Support changes.';
      showMsg('Advanced scheduling options saved.','ok');
      setTimeout(closeModal, 450);
      setTimeout(function(){ scheduleStudentSync(80, true); }, 520);
    }).catch(function(e){ if(msg) msg.textContent = 'Could not save: ' + (e.message || e); showMsg('Advanced scheduling options were not saved: ' + (e.message || e), 'err'); });
  }
  function normalizeAdvancedLinkOnce(){
    var header = document.querySelector('#students .scheduleHeaderRow h3'); if(!header) return;
    var links = qa('#students .scheduleHeaderRow h3 .studentAdvancedSchedulingLinkV05418X, #students .scheduleHeaderRow h3 [data-action="student-advanced-scheduling-v05418ab"], #students .scheduleHeaderRow h3 [title="Open advanced scheduling options for this student"]');
    var keep = by('studentAdvancedSchedulingLinkV05418X') || links[0];
    if(!keep){ keep = document.createElement('span'); header.appendChild(document.createTextNode(' ')); header.appendChild(keep); }
    keep.id = 'studentAdvancedSchedulingLinkV05418X'; keep.className = 'studentAdvancedSchedulingLinkV05418X'; keep.setAttribute('role','button'); keep.setAttribute('tabindex','0'); keep.setAttribute('data-action','student-advanced-scheduling-v05418ab'); keep.setAttribute('title','Open advanced scheduling options for this student'); keep.textContent = 'Advanced scheduling options';
    keep.onclick = function(ev){ if(ev){ ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation(); } openModal(); return false; };
    links.forEach(function(el){ if(el !== keep && el.parentNode) el.parentNode.removeChild(el); });
  }
  function scheduleStudentSync(delay, force){
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function(){ normalizeAdvancedLinkOnce(); hideStaffEmailOrphans(); warmStudentPeriodSourceOnce(); renderAgencyFlag(); var name = currentStudentName(); if(!name) return; loadAdvanced(name, !!force).then(function(r){ if(norm(r.student) === norm(currentStudentName())){ syncTwoToOneOptions(r); renderRowChips(r); } renderAgencyFlag(); }); }, delay == null ? 140 : delay);
  }
  function patchCollectStudent(){
    if(window.__V05418AQ_COLLECT_PATCHED__) return;
    var base = window.collectStudent;
    if(typeof base !== 'function') return;
    window.__V05418AQ_COLLECT_PATCHED__ = true;
    window.collectStudent = function(){
      var p = base.apply(this, arguments) || {};
      var rec = currentAdvanced();
      rec.twoToOnePeriods = collectTwoToOnePeriodsFromRows();
      rec.twoToOneStaff = collectTwoToOneStaffFromRows();
      var hasTwo = Object.keys(rec.twoToOnePeriods || {}).some(function(k){ return !!rec.twoToOnePeriods[k]; }) || Object.keys(rec.twoToOneStaff || {}).some(function(k){ var v=rec.twoToOneStaff[k] || {}; return !!(v.primary2 || v.secondary2); });
      if(hasTwo) rec.enableTwoToOne = true;
      try{
        Object.keys(p.periods || {}).forEach(function(item){
          if((rec.twoToOnePeriods || {})[item] || (rec.twoToOneStaff || {})[item]){
            var row = p.periods[item] || {};
            if(!isStudentSupportKindNA(row.supportType || '') && !isStudentSupportKindNA(row.support || '')) row.support = '2:1';
            p.periods[item] = row;
          }
        });
      }catch(e){}
      remember(rec);
      var hasAdvancedData = !!rec.__advancedLoadedV05418EK || !!rec.enableTwoToOne || !!rec.noTemporaryGrouping || !!rec.prioritizeSameStaff || !!rec.avoidBackToBackStaffChanges || (rec.splitPeriodSupport || []).length || Object.keys(rec.twoToOnePeriods || {}).length || Object.keys(rec.twoToOneStaff || {}).length;
      if(hasAdvancedData){
        p.advancedScheduling = {
          enableTwoToOne: !!rec.enableTwoToOne,
          noTemporaryGrouping: !!rec.noTemporaryGrouping,
          prioritizeSameStaff: !!rec.prioritizeSameStaff,
          avoidBackToBackStaffChanges: !!rec.avoidBackToBackStaffChanges,
          twoToOnePeriods: rec.twoToOnePeriods || {},
          splitPeriodSupport: rec.splitPeriodSupport || [],
          twoToOneStaff: rec.twoToOneStaff || {}
        };
      }
      return p;
    };
    try{ collectStudent = window.collectStudent; }catch(e){}
  }
  function patchStudentSelect(){
    if(window.__V05418AQ_SELECT_PATCHED__) return;
    var baseSelect = window.selectStudent;
    if(typeof baseSelect === 'function'){
      window.__V05418AQ_SELECT_PATCHED__ = true;
      window.selectStudent = function(){ var ret = baseSelect.apply(this, arguments); scheduleStudentSync(160); return ret; };
      try{ selectStudent = window.selectStudent; }catch(e){}
    }
  }
  function patchStudentRender(){
    if(window.__V05418AQ_RENDER_PATCHED__) return;
    var baseRender = window.renderStudentPeriodRows;
    if(typeof baseRender === 'function'){
      window.__V05418AQ_RENDER_PATCHED__ = true;
      window.renderStudentPeriodRows = function(){
        var ret = baseRender.apply(this, arguments);
        scheduleStudentSync(90);
        return ret;
      };
      try{ renderStudentPeriodRows = window.renderStudentPeriodRows; }catch(e){}
    }
  }
  function patchStudentSave(){
    if(window.__V05418AQ_SAVE_PATCHED__) return;
    var baseSave = window.saveStudent;
    if(typeof baseSave === 'function'){
      window.__V05418AQ_SAVE_PATCHED__ = true;
      window.saveStudent = function(){
        var captured = null;
        try{
          captured = currentAdvanced();
          captured.twoToOnePeriods = collectTwoToOnePeriodsFromRows();
          captured.twoToOneStaff = collectTwoToOneStaffFromRows({preserveExisting:true});
          var hasStaff = Object.keys(captured.twoToOneStaff || {}).some(function(k){ var v = captured.twoToOneStaff[k] || {}; return !!(clean(v.primary2) || clean(v.secondary2)); });
          if(Object.keys(captured.twoToOnePeriods || {}).length || hasStaff) captured.enableTwoToOne = true;
          remember(captured);
          persistAdvancedRecord(captured, {replaceTwoToOneStaff:true, replaceTwoToOnePeriods:true});
        }catch(e){}
        var ret = baseSave.apply(this, arguments);
        setTimeout(function(){ try{ if(captured) remember(captured); }catch(_e){} scheduleStudentSync(80, true); }, 250);
        setTimeout(function(){ try{ if(captured) persistAdvancedRecord(captured, {replaceTwoToOneStaff:true, replaceTwoToOnePeriods:true}); }catch(_e2){} scheduleStudentSync(80, true); }, 900);
        setTimeout(function(){ scheduleStudentSync(80, true); }, 1500);
        return ret;
      };
      try{ saveStudent = window.saveStudent; }catch(e){}
    }
  }
  function installCss(){
    if(by('v05418aqAdvancedCss')) return;
    var s = document.createElement('style'); s.id = 'v05418aqAdvancedCss';
    s.textContent = '.advancedSchedulingModalV05418AQ.modal{display:none;align-items:center;justify-content:center;position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.34);padding:18px}.advancedSchedulingModalV05418AQ.modal.active{display:flex}.advancedSchedulingCardV05418AQ{position:relative;width:min(920px,96vw);max-height:88vh;overflow:auto;background:#fff;border:1px solid #d9e2ef;border-radius:14px;box-shadow:0 24px 80px rgba(15,23,42,.24);padding:18px}.apTitleRow{position:sticky;top:-18px;background:#fff;z-index:2;padding:0 0 10px;border-bottom:1px solid #eef2f7}.apTitleRow h3{margin:0;font-size:20px;line-height:1.2}.apStudentLine{margin:10px 0 12px}.advancedOptionV05418AQ{display:flex;gap:10px;align-items:flex-start;border:1px solid #e5e7eb;border-radius:12px;padding:10px;margin:8px 0;background:#fff}.advancedOptionV05418AQ input{width:auto;margin-top:3px}.advancedOptionV05418AQ span{display:flex;flex-direction:column;gap:2px}.advancedOptionV05418AQ em{font-size:12px;color:#64748b;font-style:normal}.advancedSplitBoxV05418AQ{border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:12px 0;background:#f8fafc}.advancedSplitBoxV05418AQ h4{margin:0 0 4px}.apSplitHeader,.apSplitRow{display:grid!important;grid-template-columns:minmax(240px,2fr) 96px 92px 44px!important;gap:8px;align-items:center}.apSplitHeader{font-size:11px;font-weight:800;color:#64748b;margin:10px 0 4px;text-transform:uppercase;letter-spacing:.02em}.apSplitHeader span:nth-child(1),.apSplitRow .apSplitItem{grid-column:1}.apSplitHeader span:nth-child(2),.apSplitRow .apSplitMode{grid-column:2}.apSplitHeader span:nth-child(3),.apSplitRow .apSplitMinutes{grid-column:3}.apSplitHeader span:nth-child(4),.apSplitRow .apRemoveSplit{grid-column:4}.apSplitRow .apSplitStart,.apSplitRow .apSplitEnd{display:none!important}.apSplitRow{margin:8px 0}.apSplitRow select,.apSplitRow input{width:100%;min-width:0;box-sizing:border-box}.apSplitRow .apRemoveSplit{justify-self:end;align-self:center;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center}.apSplitRows:empty{display:none}.apFooter{position:sticky;bottom:-18px;background:#fff;border-top:1px solid #eef2f7;padding-top:12px;justify-content:flex-end}.advancedRowChipsV05418AQ span{display:inline-block;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:800;margin-right:4px}.apModalBackdrop{position:fixed;inset:0}.studentAgencySupportedFlagV05418AQ{display:none;margin-top:5px;width:max-content;border:1px solid #f59e0b;background:#fffbeb;color:#92400e;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:900;line-height:1.3}#staff .staffEmailOrphanHiddenV05418AQ{display:none!important}.twoToOneSecondStaffRowV05418AR{display:flex;align-items:center;gap:5px;margin-top:4px}.twoToOneSecondStaffTagV05418AR{font-size:9px;font-weight:900;color:#7c3aed;text-transform:uppercase;letter-spacing:.03em;flex:0 0 auto}.twoToOneSecondStaffSelectV05418AR{border:1px solid #ddd6fe!important;background:#f5f3ff!important;flex:1 1 auto;min-width:0}@media(max-width:760px){.apSplitHeader{display:none}.apSplitRow{grid-template-columns:1fr 1fr 44px!important}.apSplitRow .apSplitItem{grid-column:1 / -1}.apSplitRow .apSplitMode{grid-column:1}.apSplitRow .apSplitMinutes{grid-column:2}.apSplitRow .apRemoveSplit{grid-column:3;justify-self:end}.advancedSchedulingCardV05418AQ{padding:14px}}';
    document.head.appendChild(s);
  }
  window.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('#studentAdvancedSchedulingLinkV05418X,.studentAdvancedSchedulingLinkV05418X,[data-action="student-advanced-scheduling-v05418ab"],#advancedSchedulingModalV05418AQ [data-ap-close],#apSaveAdvanced,#apAddSplitWindow,#advancedSchedulingModalV05418AQ .apRemoveSplit');
    if(!t) return;
    e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    if(t.id === 'studentAdvancedSchedulingLinkV05418X' || (t.classList && t.classList.contains('studentAdvancedSchedulingLinkV05418X')) || t.getAttribute('data-action') === 'student-advanced-scheduling-v05418ab'){ openModal(); return false; }
    if(t.hasAttribute('data-ap-close')){ closeModal(); return false; }
    if(t.id === 'apSaveAdvanced'){ saveAdvanced(); return false; }
    if(t.id === 'apAddSplitWindow'){ var box = document.querySelector('#advancedSchedulingModalV05418AQ .apSplitRows'); if(box){ box.insertAdjacentHTML('beforeend', splitRowHtml({}, box.querySelectorAll('.apSplitRow').length)); syncSplitModes(); } return false; }
    if(t.classList && t.classList.contains('apRemoveSplit')){ var row = t.closest('.apSplitRow'); if(row) row.remove(); try{markDirty();}catch(_e){} return false; }
    return false;
  }, true);
  window.addEventListener('change', function(e){
    var t = e.target;
    if(!t) return;
    if(t.id === 'apEnableTwoToOne'){ var rec = currentAdvanced(); rec.enableTwoToOne = !!t.checked; if(!rec.enableTwoToOne){ rec.twoToOnePeriods = {}; rec.twoToOneStaff = {}; clearTwoToOneRowsAndFields(); } remember(rec); syncTwoToOneOptions(rec); }
    if(t.classList && t.classList.contains('apSplitMode')) updateSplitRowMode(t.closest('.apSplitRow'));
    if(t.classList && t.classList.contains('studentSupport')) setTimeout(function(){
      var tr = t.closest && t.closest('tr');
      if(tr && tr.dataset) tr.dataset.twoToOneUserOverride = (t.value === '2:1') ? '' : 'off';
      if(t.value !== '2:1' && tr){ qa('.studentPrimary2,.studentSecondary2', tr).forEach(function(x){ try{x.value='';}catch(e){} }); qa('.twoToOneSecondStaffRowV05418AR,.twoToOneSecondStaffRowV05418X', tr).forEach(function(el){ try{el.remove();}catch(e){} }); }
      var rec = currentAdvanced();
      rec.twoToOnePeriods = collectTwoToOnePeriodsFromRows();
      rec.twoToOneStaff = collectTwoToOneStaffFromRows();
      rec.enableTwoToOne = !!(by('apEnableTwoToOne') || {}).checked || hasAnyTwoToOneState(rec);
      remember(rec);
      renderRowChips(rec);
      renderTwoToOneStaffRows(rec);
      scheduleAdvancedPersist(rec, {replaceTwoToOneStaff:true, replaceTwoToOnePeriods:true, delay:180});
    }, 30);
    if(t.classList && (t.classList.contains('studentPrimary2') || t.classList.contains('studentSecondary2'))){ setTimeout(function(){ var rec = currentAdvanced(); rec.twoToOnePeriods = collectTwoToOnePeriodsFromRows(); rec.twoToOneStaff = collectTwoToOneStaffFromRows(); rec.enableTwoToOne = !!(by('apEnableTwoToOne') || {}).checked || hasAnyTwoToOneState(rec); remember(rec); scheduleAdvancedPersist(rec, {replaceTwoToOneStaff:true, replaceTwoToOnePeriods:true, delay:120}); }, 0); markDirty(); }
  }, true);
  window.addEventListener('keydown', function(e){
    var modal = by('advancedSchedulingModalV05418AQ');
    if(e.key === 'Escape' && modal && modal.classList.contains('active')){ e.preventDefault(); closeModal(); }
    var t = e.target && e.target.closest && e.target.closest('#studentAdvancedSchedulingLinkV05418X,.studentAdvancedSchedulingLinkV05418X');
    if(t && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); openModal(); }
  }, true);
  function boot(){
    installCss();
    patchCollectStudent();
    patchStudentSelect();
    patchStudentRender();
    patchStudentSave();
    patchStudentListBadges();
    normalizeAdvancedLinkOnce();
    hideStaffEmailOrphans();
    renderAgencyFlag();
    loadAgenciesForSchool().then(function(){ try{ if(typeof window.renderStudentList === 'function') window.renderStudentList(); }catch(e){} });
    scheduleStudentSync(220);
    window.openAdvancedSchedulingV05418AQ = openModal;
    window.openAdvancedSchedulingV05418Z = openModal;
    window.openAdvancedSchedulingV05418AB = function(ev){ if(ev){ ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation(); } openModal(); return false; };
    window.openAdvancedSchedulingV05418AA = window.openAdvancedSchedulingV05418AB;
    window.syncTwoToOneRowsV05418AQ = function(){ var rec = currentAdvanced(); rec.twoToOnePeriods = collectTwoToOnePeriodsFromRows(); rec.twoToOneStaff = collectTwoToOneStaffFromRows(); if(Object.keys(rec.twoToOneStaff || {}).some(function(k){ var v = rec.twoToOneStaff[k] || {}; return !!(v.primary2 || v.secondary2); })) rec.enableTwoToOne = true; remember(rec); syncTwoToOneOptions(rec); return rec; };
    window.persistStudentAdvancedSchedulingV05418AQ = function(opts){ return persistAdvancedRecord(currentAdvanced(), opts || {}); };
    window.clearTwoToOneRowsV05418AQ = function(){ var rec = normalizeRec({student:currentStudentName(), enableTwoToOne:false, twoToOnePeriods:{}, twoToOneStaff:{}}); clearTwoToOneRowsAndFields(); remember(rec); syncTwoToOneOptions(rec); return rec; };
    try{ if(typeof window.registerNavigationAfterHookV5_ === 'function') window.registerNavigationAfterHookV5_(function(page){ if(page === 'students'){ scheduleStudentSync(180); loadAgenciesForSchool().then(function(){ try{ if(typeof window.renderStudentList === 'function') window.renderStudentList(); }catch(e){} }); } if(page === 'staff') setTimeout(hideStaffEmailOrphans, 120); }, 'v05418aqAdvancedNoLoop'); }catch(e){}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.gaV05418ARInvalidateAgencyCache = function(school){
    if(school){ delete agencyCacheBySchool[school]; } else { agencyCacheBySchool = {}; }
    loadAgenciesForSchool().then(function(){
      try{ if(typeof window.renderStudentList === 'function') window.renderStudentList(); }catch(e){}
      try{ renderAgencyFlag(); }catch(e2){}
    });
  };
  window.gaV05418AQAdvancedDiag = function(){ return {version:VERSION, school:selectedSchool(), student:currentStudentName(), advanced:currentAdvanced(), linkCount:qa('#students .scheduleHeaderRow h3 .studentAdvancedSchedulingLinkV05418X,#students .scheduleHeaderRow h3 [data-action="student-advanced-scheduling-v05418ab"]').length, observer:false}; };
})();

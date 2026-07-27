(function(){
  'use strict';
  if (window.__GA_REDIS_V05418AI_PERIOD_SOURCE_MODAL_UNIFIER__) return;
  window.__GA_REDIS_V05418AI_PERIOD_SOURCE_MODAL_UNIFIER__ = true;
  var VERSION = '0.54.18dk';
  var SOURCE_KEYS = ['__bellDisplaySourceV05418AE','__supportSchedulesBellSourceV05418AD'];
  var state = { school:'', source:null, loading:false, loaded:false, waiters:[], stamp:0 };
  var fetchSeqV05423 = 0;

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
  function esc(v){ return clean(v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c; }); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function selectedSchoolPayload(){
    try { if (typeof window.selectedSchoolPayloadForRedisV05418DJ === 'function') { var g = window.selectedSchoolPayloadForRedisV05418DJ() || {}; if (clean(g.school || g.schoolId || g.campusId || g.spreadsheetId)) return g; } } catch(eGuard) {}
    var sel = by('campusSelector') || by('schoolSelector') || by('schoolSelect') || by('siteSelector');
    if (sel && clean(sel.value)) {
      var opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      var ss = opt ? clean(opt.getAttribute('data-spreadsheet-id') || opt.getAttribute('data-ss-id') || opt.getAttribute('data-sheet-id') || '') : '';
      var nm = opt ? clean(opt.getAttribute('data-campus-name') || opt.getAttribute('data-school-name') || opt.textContent || '') : '';
      return {school:clean(sel.value),schoolId:clean(sel.value),campusId:clean(sel.value),campusName:nm,schoolName:nm,spreadsheetId:ss,selectedSpreadsheetId:ss};
    }
    try { if (typeof window.selectedSchoolPayloadV686m20 === 'function') { var p = window.selectedSchoolPayloadV686m20() || {}; if (clean(p.school || p.schoolId || p.campusId || p.spreadsheetId)) return p; } } catch(e) {}
    try { if (typeof window.selectedSchoolPayloadV683 === 'function') { var q = window.selectedSchoolPayloadV683() || {}; if (clean(q.school || q.schoolId || q.campusId || q.spreadsheetId)) return q; } } catch(e2) {}
    try { var c = window.campusContextV5253 || {}; if (clean(c.school || c.schoolId || c.campusId || c.spreadsheetId)) return c; } catch(e3) {}
    return {};
  }
  function selectedSchool(){
    var p = selectedSchoolPayload();
    return clean(p.school || p.schoolId || p.campusId || p.selectedCampusId || 'default');
  }
  function selectedSchoolKey(){
    var p = selectedSchoolPayload();
    return norm(p.school || p.schoolId || p.campusId || p.selectedCampusId || 'default') + '|' + norm(p.spreadsheetId || p.selectedSpreadsheetId || '');
  }
  function sourceSchoolKey(d){
    d = d || {};
    var scope = d.schoolScope || d.guard || {};
    return norm(d.school || d.schoolId || d.campusId || d.selectedCampusId || scope.school || scope.schoolId || scope.campusId || 'default') + '|' + norm(d.spreadsheetId || d.selectedSpreadsheetId || scope.spreadsheetId || scope.selectedSpreadsheetId || '');
  }
  function sourceMatchesSelected(d){
    if(!d || typeof d !== 'object') return false;
    if(d === state.source) return true;
    var p = selectedSchoolPayload();
    var ps = norm(p.spreadsheetId || p.selectedSpreadsheetId || '');
    var pc = norm(p.school || p.schoolId || p.campusId || p.selectedCampusId || '');
    var scope = d.schoolScope || d.guard || {};
    var ds = norm(d.spreadsheetId || d.selectedSpreadsheetId || scope.spreadsheetId || scope.selectedSpreadsheetId || '');
    var dc = norm(d.school || d.schoolId || d.campusId || d.selectedCampusId || scope.school || scope.schoolId || scope.campusId || '');
    if(ps && ds && ps !== ds) return false;
    if(pc && dc && pc !== dc) return false;
    // Once a direct period source for the selected school is loaded, do not let unscoped
    // stale student/staff/schedule globals or DOM options from another school override it.
    if(state.loaded && state.source && Array.isArray(state.source.periodMeta) && state.source.periodMeta.length && !ds && !dc) return false;
    return true;
  }
  function coreOrder(){ return ['Period 1','Period 2','Period 3','Period 4','Period 5','Period 6','Break','Lunch']; }
  function stripScope(v){
    var s = clean(v);
    s = s.replace(/^campus_[a-z0-9_]+__/i, '');
    s = s.replace(/^school_[a-z0-9_]+__/i, '');
    s = s.replace(/^site_[a-z0-9_]+__/i, '');
    return s.replace(/_/g, ' ').trim();
  }
  function periodNumber(v){
    var stripped = stripScope(v);
    var m = stripped.match(/^period\s*(\d+)$/i);
    if (m) return Number(m[1]);
    m = clean(v).match(/(?:^|[_\s])period[_\s]*(\d+)(?:$|[_\s])/i);
    return m ? Number(m[1]) : null;
  }
  function identity(v){
    var n = periodNumber(v);
    if (n != null) return 'period:' + n;
    var x = norm(stripScope(v));
    if (x === 'break' || x === 'lunch') return x;
    return x ? 'label:' + x : '';
  }
  function isPeriodLike(v){
    var x = norm(stripScope(v));
    return periodNumber(v) != null || x === 'break' || x === 'lunch' || /^(campus|school|site)_/i.test(clean(v));
  }
  function defaultLabel(v){
    var n = periodNumber(v);
    if (n != null) return 'Period ' + n;
    var x = stripScope(v);
    return x ? x.replace(/\b\w/g, function(m){ return m.toUpperCase(); }) : clean(v);
  }
  function isDefaultDisplay(v){ return /^period\s*\d+$/i.test(clean(v)) || norm(v) === 'break' || norm(v) === 'lunch'; }
  function labelPriority(raw, label){
    raw = clean(raw); label = clean(label);
    if (!label) return 0;
    if (norm(label) === norm(raw) || norm(label) === norm(stripScope(raw))) return 1;
    if (isDefaultDisplay(label)) return 2;
    return 8;
  }
  function dataSources(){
    var out = [];
    if (state.source) out.push(state.source);
    SOURCE_KEYS.forEach(function(k){ if (window[k] && typeof window[k] === 'object' && sourceMatchesSelected(window[k])) out.push(window[k]); });
    ['advancedSetupDataV5131','scheduleData','studentData','staffData','scheduleViewsData'].forEach(function(k){ if (window[k] && typeof window[k] === 'object' && sourceMatchesSelected(window[k])) out.push(window[k]); });
    return out;
  }
  function sourceRowsFrom(d){
    var rows = [];
    if (!d || typeof d !== 'object') return rows;
    (d.periodMeta || []).forEach(function(r){
      if (!r) return;
      var key = clean(r.key || r.item || r.period || r.name || r.displayName || r.label);
      var label = clean(r.displayName || r.label || r.title || r.name || key);
      if (key) rows.push({ key:key, displayName:label || key, blockType:clean(r.blockType || r.type || '') });
    });
    var labels = d.itemLabels || d.labels || {};
    Object.keys(labels || {}).forEach(function(k){ if (clean(k)) rows.push({ key:k, displayName:clean(labels[k]) || k }); });
    [].concat(d.itemOrder || [], d.items || [], d.periods || [], d.scheduleTemplateItems || []).forEach(function(it){
      if (typeof it === 'string') rows.push({ key:it, displayName:(labels && labels[it]) || it });
      else if (it && typeof it === 'object') {
        var key = clean(it.key || it.item || it.period || it.name || it.label || it.title || it.displayName);
        var label = clean(it.displayName || it.label || it.title || it.name || (labels && labels[key]) || key);
        if (key) rows.push({ key:key, displayName:label || key });
      }
    });
    return rows;
  }
  function addAlias(cat, raw, label, source){
    raw = clean(raw); label = clean(label || raw);
    if (!raw || !label) return;
    var pri = labelPriority(raw, label);
    var aliases = [raw, stripScope(raw), defaultLabel(raw)];
    var n = periodNumber(raw);
    if (n != null) { var schAlias = norm(selectedSchool()).replace(/[^a-z0-9]+/g, '_'); aliases.push('Period ' + n, 'period_' + n); if(schAlias) aliases.push('campus_' + schAlias + '__period_' + n, 'campus_' + schAlias + '_period_' + n); }
    aliases.forEach(function(a){
      var k = norm(a);
      if (!k) return;
      var old = cat.alias[k];
      if (!old || pri >= old.priority) cat.alias[k] = { label:label, priority:pri, raw:raw, source:source || '' };
    });
    if (n != null) {
      var oldN = cat.byNumber[n];
      if (!oldN || pri >= oldN.priority) cat.byNumber[n] = { label:label, priority:pri, raw:raw, source:source || '' };
    }
  }
  function buildCatalog(){
    var cat = { alias:{}, byNumber:{}, rows:[], seenRows:{} };
    coreOrder().forEach(function(k){ addAlias(cat, k, k, 'core'); });
    dataSources().forEach(function(d, idx){
      sourceRowsFrom(d).forEach(function(r){
        addAlias(cat, r.key, r.displayName, 'data' + idx);
        var id = identity(r.key);
        if (id && !cat.seenRows[id]) { cat.seenRows[id] = true; cat.rows.push({ key:r.key, displayName:r.displayName, blockType:r.blockType || '' }); }
      });
    });
    // DOM options often already have the correct custom name even when a later table is still using a raw storage key.
    qsa('select option').forEach(function(opt){
      var raw = clean(opt.value || opt.textContent);
      var label = clean(opt.textContent || opt.value);
      if (!raw || !label || !isPeriodLike(raw)) return;
      addAlias(cat, raw, label, 'dom-option');
    });
    qsa('[data-item]').forEach(function(el){
      var raw = clean(el.getAttribute('data-item'));
      if (!raw || !isPeriodLike(raw)) return;
      var labelEl = el.querySelector('.onPaperPeriodTitle,.schedulePeriod,td:first-child b,th:first-child b,b');
      var label = clean(labelEl && labelEl.textContent);
      if (label) addAlias(cat, raw, label, 'dom-data-item');
    });
    return cat;
  }
  var catalogCache = null;
  function catalog(force){ if (force || !catalogCache || Date.now() - state.stamp > 500) { catalogCache = buildCatalog(); state.stamp = Date.now(); } return catalogCache; }
  function visibleLabel(raw){
    raw = clean(raw);
    if (!raw) return '';
    var cat = catalog(false);
    var exact = cat.alias[norm(raw)];
    if (exact && exact.label) return exact.label;
    var stripped = stripScope(raw);
    var strippedHit = cat.alias[norm(stripped)];
    if (strippedHit && strippedHit.label) return strippedHit.label;
    var n = periodNumber(raw);
    if (n != null && cat.byNumber[n] && cat.byNumber[n].label) return cat.byNumber[n].label;
    return defaultLabel(raw) || raw;
  }
  function periodItems(){
    var cat = catalog(false);
    var out = [], seen = {};
    function add(raw){
      raw = clean(raw);
      if (!raw || !isPeriodLike(raw)) return;
      var id = identity(raw);
      if (!id || seen[id]) return;
      seen[id] = true;
      out.push(raw);
    }
    // Use the direct Redis source first. It contains the saved full school-specific period metadata.
    if (state.source) {
      (state.source.periodMeta || []).forEach(function(r){ add(r && (r.key || r.item || r.period || r.name || r.displayName)); });
      [].concat(state.source.itemOrder || [], state.source.items || [], state.source.periods || []).forEach(function(v){ add(typeof v === 'string' ? v : (v && (v.key || v.item || v.period || v.name || v.displayName))); });
    }
    cat.rows.forEach(function(r){ add(r.key); });
    dataSources().forEach(function(d){
      [].concat(d.itemOrder || [], d.items || [], d.periods || []).forEach(function(v){ add(typeof v === 'string' ? v : (v && (v.key || v.item || v.period || v.name || v.displayName))); });
    });
    qsa('#studentPeriodRows tr[data-item],#scheduleRows tr[data-item],#onPaperEditorBody [data-item]').forEach(function(el){ add(el.getAttribute('data-item')); });
    coreOrder().forEach(add);
    return out;
  }
  function mergeSource(src){
    if (!src || typeof src !== 'object') return;
    if(!sourceMatchesSelected(src)) return;
    var school = selectedSchoolKey();
    var meta = Array.isArray(src.periodMeta) ? src.periodMeta.slice() : [];
    var labels = Object.assign({}, src.itemLabels || {});
    var order = [].concat(src.itemOrder || [], src.items || [], src.periods || []).map(function(v){ return typeof v === 'string' ? v : (v && (v.key || v.item || v.period || v.name || v.displayName)); }).map(clean).filter(Boolean);
    meta.forEach(function(r){
      if (!r) return;
      var key = clean(r.key || r.item || r.period || r.name || r.displayName);
      var label = clean(r.displayName || r.label || r.title || r.name || labels[key] || key);
      if (key && label) labels[key] = label;
      if (key && order.indexOf(key) < 0) order.push(key);
      var n = periodNumber(key);
      if (n != null && label) {
        labels['Period ' + n] = label;
        labels['period_' + n] = label;
        var schAlias = norm(selectedSchool()).replace(/[^a-z0-9]+/g, '_');
        if(schAlias){ labels['campus_' + schAlias + '__period_' + n] = label; labels['campus_' + schAlias + '_period_' + n] = label; }
      }
    });
    coreOrder().forEach(function(k){ if (order.indexOf(k) < 0) order.push(k); if (!labels[k]) labels[k] = visibleLabel(k) || k; });
    var unified = Object.assign({}, src, { version:VERSION, schoolKey:school, periodMeta:meta, itemLabels:labels, itemOrder:order, items:order, periods:order, periodDisplaySource:'v05418dk-direct-period-source' });
    state.school = school;
    state.source = unified;
    state.loaded = true;
    SOURCE_KEYS.forEach(function(k){ window[k] = Object.assign({}, window[k] || {}, unified); });
    ['advancedSetupDataV5131','scheduleData','studentData','staffData','scheduleViewsData'].forEach(function(name){
      var d = window[name];
      if (!d || typeof d !== 'object') return;
      d.itemLabels = Object.assign({}, d.itemLabels || {}, labels);
      if (meta.length) d.periodMeta = meta.slice();
      d.itemOrder = order.slice();
      if (name === 'studentData' || name === 'scheduleData') d.items = order.slice();
      if (name === 'staffData') { d.periods = order.slice(); d.items = order.slice(); }
    });
    try { window.ITEMS = order.slice(); window.eval('ITEMS = window.ITEMS;'); } catch(e) {}
    catalogCache = null;
  }
  function fetchPeriodSource(force, cb){
    var school = selectedSchoolKey();
    if (!force && state.loaded && state.school === school && state.source && Array.isArray(state.source.periodMeta) && state.source.periodMeta.length) { if (cb) cb(state.source); return Promise.resolve(state.source); }
    if (state.loading && state.school === school) { if (cb) state.waiters.push(cb); return Promise.resolve(state.source || null); }
    state.loading = true;
    state.school = school;
    var seq = ++fetchSeqV05423;
    var payload = selectedSchoolPayload(); var qs = new URLSearchParams(); qs.set('school', selectedSchool()); qs.set('schoolId', selectedSchool()); qs.set('campusId', selectedSchool()); if(payload.spreadsheetId || payload.selectedSpreadsheetId) qs.set('spreadsheetId', payload.spreadsheetId || payload.selectedSpreadsheetId); qs.set('_t', Date.now()); var url = '/api/v05418af/period-meta?' + qs.toString();
    return fetch(url, { credentials:'same-origin', cache:'no-store' }).then(function(r){ return r.json(); }).then(function(json){
      if (!json || json.ok === false) throw new Error((json && json.error) || 'Period metadata load failed');
      if (seq !== fetchSeqV05423 || selectedSchoolKey() !== school) return state.source || null;
      mergeSource(json);
      state.loading = false;
      var waiters = state.waiters.splice(0);
      waiters.forEach(function(fn){ try { fn(state.source); } catch(e) {} });
      if (cb) cb(state.source);
      refreshSurfaces('fetch');
      return state.source;
    }).catch(function(){
      state.loading = false;
      var waiters = state.waiters.splice(0);
      waiters.forEach(function(fn){ try { fn(state.source); } catch(e) {} });
      if (cb) cb(state.source);
      return state.source || null;
    });
  }
  function nativeOptionList(values, selected){
    if (typeof window.optionList === 'function') { try { return window.optionList(values, selected); } catch(e) {} }
    return (values || []).map(function(v){ return '<option value="' + esc(v) + '"' + (norm(v) === norm(selected) ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
  }
  function optionHtml(values, selected){
    return (values || []).map(function(v){ return '<option value="' + esc(v) + '"' + (norm(v) === norm(selected) ? ' selected' : '') + '>' + esc(visibleLabel(v)) + '</option>'; }).join('');
  }
  function setSelectValue(sel, value){
    if (!sel) return;
    value = clean(value);
    sel.value = value;
    if (!value || sel.value === value) return;
    var wanted = norm(value), wantedLabel = norm(visibleLabel(value));
    var hit = qsa('option', sel).find(function(o){ return norm(o.value) === wanted || norm(o.textContent) === wanted || norm(o.textContent) === wantedLabel || norm(visibleLabel(o.value)) === wantedLabel; });
    if (hit) sel.value = hit.value;
  }
  function periodRecordFor(student, item){
    var periods = (student && student.periods) || {};
    if (periods[item]) return periods[item];
    var id = identity(item), label = norm(visibleLabel(item)), ni = norm(item);
    var keys = Object.keys(periods || {});
    for (var i=0; i<keys.length; i++) {
      var k = keys[i];
      if (identity(k) === id || norm(k) === ni || norm(visibleLabel(k)) === label) return periods[k] || {};
    }
    return {};
  }
  function patchGlobalName(name, fn){
    window[name] = fn;
    try { window.eval(name + ' = window["' + name + '"];'); } catch(e) {}
  }
  function patchLabelHelpers(){
    ['periodDisplayNameV5140','studentItemLabelV5141','staffScheduleItemLabelV5154','displayPeriodLabelClientV5323'].forEach(function(name){
      var base = window[name];
      if (base && base.__v05418ai) return;
      var fn = function(item){
        var label = visibleLabel(item);
        if (label) return label;
        if (typeof base === 'function') { try { return base.apply(this, arguments); } catch(e) {} }
        return clean(item);
      };
      fn.__v05418ai = true;
      patchGlobalName(name, fn);
    });
  }
  function patchStudent(){
    var basePopulate = window.populateStudentStatic;
    if (typeof basePopulate === 'function' && !basePopulate.__v05418ai) {
      var pop = function(){
        try { basePopulate.apply(this, arguments); } catch(e) {}
        var copy = by('copyFrom');
        if (copy) copy.innerHTML = optionHtml(periodItems(), copy.value);
        fetchPeriodSource(false);
      };
      pop.__v05418ai = true;
      patchGlobalName('populateStudentStatic', pop);
    }
    var baseRender = window.renderStudentPeriodRows;
    if (typeof baseRender === 'function' && !baseRender.__v05418ai) {
      var render = function(){
        var data = window.studentData;
        var box = by('studentPeriodRows');
        if (!data || !box) { return baseRender.apply(this, arguments); }
        var items = periodItems();
        if (!items.length) items = (data.items || coreOrder()).slice();
        function locOptions(item){ try { if (typeof window.studentLocationOptionsV5150 === 'function') return window.studentLocationOptionsV5150(item); } catch(e) {} return data.locations || []; }
        function supportKinds(){ return data.supportNeedTypes || ['N/A','Behavior','Instruction']; }
        function degreeHtml(){ try { if (typeof window.studentDegreeOptionsHtmlV5278 === 'function') return window.studentDegreeOptionsHtmlV5278(''); } catch(e) {} return nativeOptionList(data.supportLevels || ['N/A'], 'N/A'); }
        function staffHtml(){ try { if (typeof window.studentStaffOptionsV5271 === 'function') return window.studentStaffOptionsV5271('N/A',''); } catch(e) {} return '<option value=""></option>'; }
        box.innerHTML = items.map(function(item){
          return '<tr data-item="' + esc(item) + '"><td><b>' + esc(visibleLabel(item)) + '</b><div class="studentRowWarnings"></div></td>' +
            '<td><select class="studentLoc">' + nativeOptionList(locOptions(item), '') + '</select></td>' +
            '<td><select class="studentSupportKind">' + nativeOptionList(supportKinds(), 'N/A') + '</select></td>' +
            '<td><select class="studentSupport">' + degreeHtml() + '</select></td>' +
            '<td><select class="studentPrimary">' + staffHtml() + '</select></td>' +
            '<td><select class="studentSecondary">' + staffHtml() + '</select></td>' +
            '<td class="copyTargetCell"><label class="muted"><input type="checkbox" class="copyTargetBox" value="' + esc(item) + '"> Copy here</label></td></tr>';
        }).join('');
        try { if (typeof window.syncAllStudentDegreeRows === 'function') window.syncAllStudentDegreeRows(); } catch(e2) {}
        relabelAll();
        fetchPeriodSource(false);
      };
      render.__v05418ai = true;
      patchGlobalName('renderStudentPeriodRows', render);
    }
    var baseSelect = window.selectStudent;
    if (typeof baseSelect === 'function' && !baseSelect.__v05418ai) {
      var sel = function(){
        var ret = baseSelect.apply(this, arguments);
        setTimeout(function(){ applyCurrentStudentValues(); relabelAll(); fetchPeriodSource(false, function(){ applyCurrentStudentValues(); }); }, 40);
        return ret;
      };
      sel.__v05418ai = true;
      patchGlobalName('selectStudent', sel);
    }
    var baseNew = window.newStudent;
    if (typeof baseNew === 'function' && !baseNew.__v05418ai) {
      var neu = function(){ var ret = baseNew.apply(this, arguments); setTimeout(function(){ relabelAll(); fetchPeriodSource(false); }, 40); return ret; };
      neu.__v05418ai = true;
      patchGlobalName('newStudent', neu);
    }
  }
  function applyCurrentStudentValues(){
    var s = window.currentStudent;
    if (!s) return;
    qsa('#studentPeriodRows tr[data-item]').forEach(function(tr){
      var item = tr.getAttribute('data-item');
      var p = periodRecordFor(s, item);
      setSelectValue(tr.querySelector('.studentLoc'), p.location);
      setSelectValue(tr.querySelector('.studentSupport'), p.support || 'N/A');
      setSelectValue(tr.querySelector('.studentSupportKind'), p.supportType || p.studentSupportType || 'N/A');
      setSelectValue(tr.querySelector('.studentPrimary'), p.primary);
      setSelectValue(tr.querySelector('.studentSecondary'), p.secondary);
    });
    try { if (typeof window.syncAllStudentDegreeRows === 'function') window.syncAllStudentDegreeRows(); } catch(e) {}
    try { if (typeof window.refreshAllStudentRowStatesV5271 === 'function') window.refreshAllStudentRowStatesV5271(); } catch(e2) {}
  }
  function patchStaff(){
    var basePopulate = window.populateStaffStatic;
    if (typeof basePopulate === 'function' && !basePopulate.__v05418ai) {
      var pop = function(){
        try { basePopulate.apply(this, arguments); } catch(e) {}
        var items = periodItems();
        var hold = by('holdPeriod');
        if (hold) hold.innerHTML = optionHtml(['Coach'].concat(items), hold.value || '');
        try { if (typeof window.refreshStaffPeriodPlaceholdersV5323 === 'function') window.refreshStaffPeriodPlaceholdersV5323(); } catch(e2) {}
        relabelAll();
        fetchPeriodSource(false);
      };
      pop.__v05418ai = true;
      patchGlobalName('populateStaffStatic', pop);
    }
    var baseSchedule = window.renderStaffOnPaperSchedule;
    if (typeof baseSchedule === 'function' && !baseSchedule.__v05418ai) {
      var sched = function(rows){
        rows = Array.isArray(rows) ? rows : [];
        var box = by('staffOnPaperSchedule');
        if (!box) return baseSchedule.apply(this, arguments);
        var html = '<table class="onPaperTable"><thead><tr><th>Item</th><th>Primary</th><th>Secondary</th></tr></thead><tbody>';
        html += rows.map(function(r){
          var item = clean(r && r.item);
          return '<tr data-item="' + esc(item) + '"><td><b>' + esc(visibleLabel(item)) + '</b></td><td>' + ((r.primary && r.primary.length) ? r.primary.map(esc).join('<br>') : '<span class="empty">None</span>') + '</td><td>' + ((r.secondary && r.secondary.length) ? r.secondary.map(esc).join('<br>') : '<span class="empty">None</span>') + '</td></tr>';
        }).join('');
        html += '</tbody></table>';
        box.innerHTML = html;
        fetchPeriodSource(false, function(){ relabelAll(); });
      };
      sched.__v05418ai = true;
      patchGlobalName('renderStaffOnPaperSchedule', sched);
    }
    var baseEditor = window.renderStaffOnPaperEditor;
    if (typeof baseEditor === 'function' && !baseEditor.__v05418ai) {
      var editor = function(){
        var ret;
        try { ret = baseEditor.apply(this, arguments); } catch(e) { ret = undefined; }
        setTimeout(function(){ relabelAll(); fetchPeriodSource(false, function(){ relabelAll(); }); }, 30);
        return ret;
      };
      editor.__v05418ai = true;
      patchGlobalName('renderStaffOnPaperEditor', editor);
    }
  }
  function patchAdvancedPeriodOptions(){
    // The structured split-window modal builds its period list from studentData.items. Keep that list full before it opens.
    ['openAdvancedSchedulingV05418Z','openAdvancedSchedulingV05418AB','openAdvancedSchedulingV05418AA'].forEach(function(name){
      var base = window[name];
      if (typeof base !== 'function' || base.__v05418ai) return;
      var fn = function(ev){
        syncItemsIntoData();
        fetchPeriodSource(false, function(){ syncItemsIntoData(); setTimeout(function(){ relabelAll(); polishAdvancedModal(); }, 30); });
        var ret = base.apply(this, arguments);
        setTimeout(function(){ relabelAll(); polishAdvancedModal(); fetchPeriodSource(false, function(){ relabelAll(); polishAdvancedModal(); }); }, 120);
        return ret;
      };
      fn.__v05418ai = true;
      patchGlobalName(name, fn);
    });
  }
  function syncItemsIntoData(){
    var items = periodItems();
    if (!items.length) return;
    var labels = {};
    items.forEach(function(item){ labels[item] = visibleLabel(item); });
    ['studentData','staffData','scheduleData','advancedSetupDataV5131','scheduleViewsData'].forEach(function(name){
      var d = window[name];
      if (!d || typeof d !== 'object') return;
      d.itemLabels = Object.assign({}, d.itemLabels || {}, labels);
      d.itemOrder = items.slice();
      if (name === 'studentData' || name === 'scheduleData') d.items = items.slice();
      if (name === 'staffData') { d.periods = items.slice(); d.items = items.slice(); }
    });
    try { window.ITEMS = items.slice(); window.eval('ITEMS = window.ITEMS;'); } catch(e) {}
  }
  function relabelSelectOptions(root){
    qsa('select option', root || document).forEach(function(opt){
      var raw = clean(opt.value || opt.textContent);
      if (!raw || !isPeriodLike(raw)) return;
      var label = visibleLabel(raw);
      if (label && opt.textContent !== label) opt.textContent = label;
    });
  }
  function relabelDataItems(root){
    qsa('[data-item]', root || document).forEach(function(el){
      var raw = clean(el.getAttribute('data-item'));
      if (!raw || !isPeriodLike(raw)) return;
      var label = visibleLabel(raw);
      var targets = qsa('.onPaperPeriodTitle,.schedulePeriod,td:first-child b,th:first-child b', el);
      if (!targets.length && el.matches && el.matches('tr')) targets = qsa('td:first-child b,td:first-child,strong,b', el).slice(0,1);
      targets.forEach(function(t){ if (label && clean(t.textContent) !== label) t.textContent = label; });
    });
  }
  function relabelExactText(root){
    var scope = root || document;
    var selectors = '#staffOnPaperSchedule td:first-child b,#studentPeriodRows td:first-child b,#scheduleRows td:first-child b,#advancedSchedulingModalV05418X label,#advancedSchedulingModalV05418X option,#advancedSchedulingModalV05418X .splitSupportExplainV05418AE,#advancedSchedulingModalV05418X .splitHintV05418AE,.schedulePeriod';
    qsa(selectors, scope).forEach(function(el){
      if (el.tagName === 'OPTION') return;
      if (el.children && el.children.length) return;
      var txt = clean(el.textContent);
      if (!txt || !isPeriodLike(txt)) return;
      var label = visibleLabel(txt);
      if (label && label !== txt) el.textContent = label;
    });
  }
  function relabelAll(root){
    catalogCache = null;
    relabelSelectOptions(root || document);
    relabelDataItems(root || document);
    relabelExactText(root || document);
  }
  function polishAdvancedModal(){
    var modal = by('advancedSchedulingModalV05418X');
    if (!modal || !modal.classList.contains('active')) return;
    var box = modal.querySelector('.modalBox,.modalCard');
    if (box) { box.classList.add('card','advancedSchedulingCardV05418AI'); box.style.maxWidth = ''; box.style.width = ''; box.style.padding = ''; }
    var header = modal.querySelector('.modalHeader,.modalTitleRow');
    if (header) header.classList.add('advancedSchedulingTitleRowV05418AI');
    var body = modal.querySelector('.modalBody');
    if (body) body.classList.add('advancedSchedulingBodyV05418AI');
    var footer = modal.querySelector('.modalFooter,.toolbar');
    if (footer) footer.classList.add('toolbar','advancedSchedulingToolbarV05418AI');
    qsa('[data-save-adv-v05418ae],#saveAdvancedSchedulingV05418X,.primaryBtn', modal).forEach(function(btn){ btn.classList.add('btn','primary'); btn.textContent = /^saving/i.test(clean(btn.textContent)) ? btn.textContent : 'Save Advanced Scheduling'; });
    qsa('[data-close-adv-v05418ae],[data-close-adv-v05418x]', modal).forEach(function(btn){ if (!btn.classList.contains('modalCloseX')) { btn.classList.add('btn'); btn.textContent = 'Cancel'; } });
    qsa('[data-add-split-v05418ae],#addSplitSupportRowV05418X,.addSplitV05418AE', modal).forEach(function(btn){ btn.classList.add('btn','small','advancedAddSplitBtnV05418AI'); btn.textContent = '+ Add Split Window'; });
    qsa('[data-remove-split-v05418ae],[data-remove-split-v05418x],.removeSplitV05418AE', modal).forEach(function(btn){ btn.classList.add('btn','small','advancedRemoveSplitBtnV05418AI'); if (!clean(btn.textContent) || clean(btn.textContent) === '×') btn.textContent = 'Remove'; });
    var rows = by('splitRowsV05418AE') || by('splitSupportRowsV05418X');
    if (rows && !modal.querySelector('.splitHeaderV05418AI')) {
      rows.insertAdjacentHTML('beforebegin','<div class="splitHeaderV05418AI"><span>Period</span><span>Window</span><span>Minutes</span><span></span></div>');
    }
    relabelAll(modal);
  }
  function installCss(){
    if (by('v05418ai-style')) return;
    var st = document.createElement('style');
    st.id = 'v05418ai-style';
    st.textContent = [
      '#advancedSchedulingModalV05418X.modal,#advancedSchedulingModalV05418X{position:fixed!important;inset:0!important;z-index:30000!important;background:rgba(15,23,42,.42)!important;display:none;align-items:center!important;justify-content:center!important;padding:24px!important;box-sizing:border-box!important;}',
      '#advancedSchedulingModalV05418X.active{display:flex!important;}',
      '#advancedSchedulingModalV05418X .advancedSchedulingCardV05418AI,#advancedSchedulingModalV05418X .modalBox,#advancedSchedulingModalV05418X .modalCard{width:min(820px,94vw)!important;max-width:min(820px,94vw)!important;max-height:88vh!important;overflow:auto!important;background:linear-gradient(180deg,#fff,#fbfdff)!important;border:1px solid var(--line,#dbe3ef)!important;border-radius:16px!important;box-shadow:var(--shadow2,0 6px 18px rgba(15,23,42,.10))!important;padding:13px!important;color:#0f172a!important;}',
      '#advancedSchedulingModalV05418X .advancedSchedulingTitleRowV05418AI,#advancedSchedulingModalV05418X .modalHeader,#advancedSchedulingModalV05418X .modalTitleRow{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin:0 0 8px!important;padding:0 0 8px!important;border-bottom:1px solid #e5e7eb!important;background:transparent!important;position:static!important;}',
      '#advancedSchedulingModalV05418X h3{margin:0!important;font-size:16px!important;color:#111827!important;}',
      '#advancedSchedulingModalV05418X .advancedSchedulingBodyV05418AI,#advancedSchedulingModalV05418X .modalBody{padding:0!important;margin:0!important;}',
      '#advancedSchedulingModalV05418X .modalCloseX{border:0!important;background:transparent!important;color:#64748b!important;font-size:24px!important;line-height:1!important;padding:0 4px!important;border-radius:999px!important;cursor:pointer!important;}',
      '#advancedSchedulingModalV05418X .modalCloseX:hover{background:#f1f5f9!important;color:#0f172a!important;}',
      '#advancedSchedulingModalV05418X .checkRow,#advancedSchedulingModalV05418X .advancedOptionV05418X{display:flex!important;align-items:flex-start!important;gap:8px!important;border:1px solid #e5e7eb!important;border-radius:12px!important;padding:9px 10px!important;margin:7px 0!important;background:#fff!important;font-weight:700!important;}',
      '#advancedSchedulingModalV05418X .checkRow input,#advancedSchedulingModalV05418X .advancedOptionV05418X input{width:auto!important;margin:2px 0 0!important;flex:0 0 auto!important;}',
      '#advancedSchedulingModalV05418X .advancedSplitBoxV05418X,#advancedSchedulingModalV05418X .fieldGroup{border:1px solid #e5e7eb!important;border-radius:12px!important;background:#f8fafc!important;padding:10px!important;margin:10px 0!important;}',
      '#advancedSchedulingModalV05418X .splitSupportExplainV05418AE{background:#fff!important;border:1px solid #dbe3ef!important;border-radius:10px!important;padding:9px 10px!important;margin:7px 0!important;color:#475569!important;font-size:12px!important;line-height:1.4!important;}',
      '#advancedSchedulingModalV05418X .splitHeaderV05418AI{display:grid!important;grid-template-columns:minmax(180px,1.3fr) minmax(105px,.7fr) minmax(120px,.8fr) 78px!important;gap:8px!important;margin:8px 0 4px!important;color:#64748b!important;font-size:10px!important;font-weight:900!important;text-transform:uppercase!important;letter-spacing:.04em!important;}',
      '#advancedSchedulingModalV05418X .splitRowsV05418AE,#advancedSchedulingModalV05418X #splitSupportRowsV05418X{display:flex!important;flex-direction:column!important;gap:6px!important;margin:0 0 8px!important;}',
      '#advancedSchedulingModalV05418X .splitRowV05418AE,#advancedSchedulingModalV05418X .splitSupportRowV05418X{display:grid!important;grid-template-columns:minmax(180px,1.3fr) minmax(105px,.7fr) minmax(120px,.8fr) 78px!important;gap:8px!important;align-items:center!important;background:#fff!important;border:1px solid #e5e7eb!important;border-radius:10px!important;padding:8px!important;box-shadow:none!important;}',
      '#advancedSchedulingModalV05418X .splitRowV05418AE select,#advancedSchedulingModalV05418X .splitRowV05418AE input,#advancedSchedulingModalV05418X .splitSupportRowV05418X select,#advancedSchedulingModalV05418X .splitSupportRowV05418X input,#advancedSchedulingModalV05418X textarea{width:100%!important;min-width:0!important;box-sizing:border-box!important;border:1px solid #dadce0!important;border-radius:9px!important;background:#fff!important;color:#0f172a!important;font:inherit!important;font-size:12px!important;padding:7px 9px!important;height:34px!important;}',
      '#advancedSchedulingModalV05418X textarea{height:auto!important;min-height:56px!important;resize:vertical!important;}',
      '#advancedSchedulingModalV05418X .btn,#advancedSchedulingModalV05418X .secondaryBtn,#advancedSchedulingModalV05418X .primaryBtn,#advancedSchedulingModalV05418X .addSplitV05418AE,#advancedSchedulingModalV05418X .removeSplitV05418AE{border:1px solid #dadce0!important;background:#fff!important;color:#0f172a!important;border-radius:9px!important;padding:7px 10px!important;cursor:pointer!important;font-weight:700!important;font-size:12px!important;line-height:1.1!important;height:auto!important;min-height:30px!important;box-shadow:none!important;}',
      '#advancedSchedulingModalV05418X .btn.primary,#advancedSchedulingModalV05418X .primaryBtn{background:linear-gradient(180deg,#2f6fed,#1d4ed8)!important;border-color:#1d4ed8!important;color:#fff!important;box-shadow:0 2px 6px rgba(37,99,235,.22)!important;}',
      '#advancedSchedulingModalV05418X .advancedRemoveSplitBtnV05418AI,#advancedSchedulingModalV05418X .removeSplitV05418AE{color:#b91c1c!important;border-color:#fecaca!important;background:#fff!important;width:auto!important;font-size:11px!important;}',
      '#advancedSchedulingModalV05418X .advancedSchedulingToolbarV05418AI,#advancedSchedulingModalV05418X .modalFooter,#advancedSchedulingModalV05418X .toolbar{display:flex!important;justify-content:flex-end!important;gap:6px!important;flex-wrap:wrap!important;margin:8px 0 0!important;padding:8px 0 0!important;border-top:1px solid #e5e7eb!important;background:transparent!important;position:static!important;}',
      '#advancedSchedulingModalV05418X .splitHintV05418AE{color:#64748b!important;font-size:11px!important;margin-top:5px!important;}',
      '@media(max-width:720px){#advancedSchedulingModalV05418X{padding:12px!important}#advancedSchedulingModalV05418X .splitHeaderV05418AI{display:none!important}#advancedSchedulingModalV05418X .splitRowV05418AE,#advancedSchedulingModalV05418X .splitSupportRowV05418X{grid-template-columns:1fr!important}#advancedSchedulingModalV05418X .advancedRemoveSplitBtnV05418AI{width:100%!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function refreshSurfaces(reason){
    syncItemsIntoData();
    relabelAll();
    polishAdvancedModal();
    if (reason === 'fetch') {
      try { if (by('studentPeriodRows') && by('students') && by('students').classList.contains('active') && typeof window.renderStudentPeriodRows === 'function') { window.renderStudentPeriodRows(); applyCurrentStudentValues(); } } catch(e) {}
      try { if (by('holdPeriod') && typeof window.populateStaffStatic === 'function' && by('staff') && by('staff').classList.contains('active')) window.populateStaffStatic(); } catch(e2) {}
    }
  }
  function boot(){
    installCss();
    patchLabelHelpers();
    syncItemsIntoData();
    patchStudent();
    patchStaff();
    patchAdvancedPeriodOptions();
    fetchPeriodSource(false);
    relabelAll();
    polishAdvancedModal();
    setTimeout(function(){ patchLabelHelpers(); patchStudent(); patchStaff(); patchAdvancedPeriodOptions(); fetchPeriodSource(false); relabelAll(); polishAdvancedModal(); }, 700);
  }
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('[data-nav="students"],[data-nav="staff"],#studentAdvancedSchedulingLinkV05418X,[data-action="open-onpaper-editor"],[data-add-split-v05418ae],[data-remove-split-v05418ae],[data-close-adv-v05418ae],[data-close-adv-v05418x],#saveAdvancedSchedulingV05418X,[data-save-adv-v05418ae]');
    if (t) setTimeout(function(){ fetchPeriodSource(false); relabelAll(); polishAdvancedModal(); }, 80);
  }, true);
  document.addEventListener('change', function(e){
    var t = e.target;
    if (t && /^(campusSelector|schoolSelector|schoolSelect|siteSelector)$/.test(t.id || '')) {
      fetchSeqV05423++; state.loaded = false; state.source = null; catalogCache = null; try{SOURCE_KEYS.forEach(function(k){if(window[k])window[k]={};});}catch(e){}
      setTimeout(function(){ fetchPeriodSource(true); }, 100);
    }
    if (t && (t.matches && t.matches('#copyFrom,#holdPeriod,#staffLunchPreference,#staffBreakPreference,#advancedSchedulingModalV05418X select'))) setTimeout(function(){ relabelAll(); }, 30);
  }, true);
  if (window.MutationObserver) {
    var obs = new MutationObserver(function(muts){
      var ok = false;
      for (var i=0; i<muts.length; i++) { var target = muts[i].target; if (target && target.nodeType === 1 && (target.id === 'staffOnPaperSchedule' || target.id === 'studentPeriodRows' || target.id === 'advancedSchedulingModalV05418X' || (target.closest && target.closest('#staff,#students,#advancedSchedulingModalV05418X')))) { ok = true; break; } }
      if (ok) setTimeout(function(){ relabelAll(); polishAdvancedModal(); }, 40);
    });
    var start = function(){ obs.observe(document.body || document.documentElement, { childList:true, subtree:true }); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.gaV05418aiPeriodDiag = function(){ return { version:VERSION, school:selectedSchool(), loaded:state.loaded, items:periodItems(), source:state.source, labels:catalog(true).alias }; };
})();

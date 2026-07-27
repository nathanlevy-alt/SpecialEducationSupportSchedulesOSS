(function(){
  'use strict';
  if (window.__GA_REDIS_V05418AE_PERIODS_ADVANCED__) return;
  window.__GA_REDIS_V05418AE_PERIODS_ADVANCED__ = true;

  var VERSION = '0.54.18ct';
  var SOURCE_FN = 'getSchoolBellDisplaySourceV05418AD';
  var SOURCE_KEY = '__bellDisplaySourceV05418AE';
  var ADV_CACHE_KEY = '__studentAdvancedSchedulingCacheV05418AE';
  var advancedSaveBusyV05418CT = false;

  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
  function esc(v){ return clean(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function byId(id){ return document.getElementById(id); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function uniqPush(list, value){ value = clean(value); if (value && list.indexOf(value) < 0) list.push(value); }
  function safeJson(v, fallback){ try { return JSON.parse(v); } catch(e){ return fallback; } }
  function isObject(v){ return v && typeof v === 'object' && !Array.isArray(v); }
  function coreOrder(){ return ['Period 1','Period 2','Period 3','Period 4','Period 5','Period 6','Break','Lunch']; }
  function isSpecial(item){ var n = norm(item); return n === 'break' || n === 'lunch'; }
  function looksLikePeriod(item){ var n = norm(item); return n.indexOf('period ') === 0 || n.indexOf('campus ') === 0 || (!isSpecial(item) && !!clean(item)); }
  function stripCampusPrefix(item){ return clean(item).replace(/^campus_[a-z0-9_]+__/i, '').replace(/_/g, ' '); }
  function titleizeKey(item){ var s = stripCampusPrefix(item); if (!s) return clean(item); return s.replace(/\b\w/g, function(m){ return m.toUpperCase(); }); }

  function selectedSchoolKey(){
    var el = byId('campusSelector') || byId('schoolSelector') || byId('schoolSelect') || byId('siteSelector');
    var vals = [];
    if (el) {
      vals.push(clean(el.value));
      if (el.options && el.selectedIndex >= 0) vals.push(clean(el.options[el.selectedIndex].text));
    }
    ['selectedSchool','currentSchool','activeSchool','schoolId','selectedCampus','currentCampus','campusId'].forEach(function(k){
      if (window[k]) vals.push(clean(window[k]));
    });
    for (var i = 0; i < vals.length; i++) if (vals[i]) return vals[i];
    return 'default';
  }

  function selectedSchoolPayload(){
    var key = selectedSchoolKey();
    var payload = { school: key, schoolId: key, campus: key, campusId: key, site: key, siteId: key };
    var el = byId('campusSelector') || byId('schoolSelector') || byId('schoolSelect') || byId('siteSelector');
    if (el) {
      payload.selectorValue = clean(el.value);
      if (el.options && el.selectedIndex >= 0) payload.selectorText = clean(el.options[el.selectedIndex].text);
    }
    if (window.currentSchoolSpreadsheetId) payload.spreadsheetId = window.currentSchoolSpreadsheetId;
    if (window.selectedSpreadsheetId) payload.spreadsheetId = window.selectedSpreadsheetId;
    if (window.activeSpreadsheetId) payload.spreadsheetId = window.activeSpreadsheetId;
    return payload;
  }

  function storageKey(student){ return selectedSchoolKey() + '::' + norm(student || currentStudentName()); }

  function getSource(){ return window[SOURCE_KEY] || null; }
  function setSource(source){ window[SOURCE_KEY] = source || null; }

  function getLabelMap(){
    var source = getSource() || {};
    var maps = [source.itemLabels, (window.scheduleData || {}).itemLabels, (window.studentData || {}).itemLabels, (window.staffData || {}).itemLabels];
    var out = {};
    maps.forEach(function(map){ if (map && typeof map === 'object') Object.keys(map).forEach(function(k){ if (clean(k) && clean(map[k])) out[k] = clean(map[k]); }); });
    return out;
  }

  function labelFor(item, explicitSource){
    item = clean(item);
    if (!item) return '';
    var source = explicitSource || getSource() || {};
    var labels = Object.assign({}, (window.scheduleData || {}).itemLabels || {}, (window.studentData || {}).itemLabels || {}, (window.staffData || {}).itemLabels || {}, source.itemLabels || {});
    if (labels[item]) return clean(labels[item]);
    var ni = norm(item);
    var keys = Object.keys(labels);
    for (var i = 0; i < keys.length; i++) {
      if (norm(keys[i]) === ni && clean(labels[keys[i]])) return clean(labels[keys[i]]);
    }
    var rows = [].concat(source.periodMeta || [], (window.scheduleData || {}).periodMeta || [], (window.studentData || {}).periodMeta || []);
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j] || {};
      if (norm(r.key || r.item || r.name || r.displayName) === ni && clean(r.displayName || r.label || r.name)) return clean(r.displayName || r.label || r.name);
      if (norm(r.displayName || r.label || r.name) === ni && clean(r.displayName || r.label || r.name)) return clean(r.displayName || r.label || r.name);
    }
    return titleizeKey(item);
  }

  function extractItemsFromPayload(data, out){
    out = out || [];
    if (!data || typeof data !== 'object') return out;
    function add(v){
      if (!v) return;
      if (typeof v === 'string') return uniqPush(out, v);
      if (typeof v === 'object') uniqPush(out, v.item || v.key || v.name || v.label || v.period || v.displayName);
    }
    (data.itemOrder || []).forEach(add);
    (data.items || []).forEach(add);
    (data.periods || []).forEach(add);
    (data.periodMeta || []).forEach(add);
    (data.schedules || data.scheduleRows || data.rows || []).forEach(function(row){
      if (row && Array.isArray(row.rows)) row.rows.forEach(add); else add(row);
    });
    if (data.templates && typeof data.templates === 'object') {
      Object.keys(data.templates).forEach(function(k){
        var t = data.templates[k];
        if (Array.isArray(t)) t.forEach(add);
        else if (t && Array.isArray(t.rows)) t.rows.forEach(add);
      });
    }
    return out;
  }

  function mergeBellSourceAE(payload){
    if (!payload || typeof payload !== 'object') return getSource();
    var key = payload.schoolKey || payload.selectedSchoolKey || selectedSchoolKey();
    var prior = getSource();
    if (!prior || prior.schoolKey !== key) prior = { schoolKey: key, itemLabels: {}, periodMeta: [], itemOrder: [] };
    var source = {
      schoolKey: key,
      version: VERSION,
      itemLabels: Object.assign({}, prior.itemLabels || {}, payload.itemLabels || {}, payload.labels || {}),
      periodMeta: [],
      itemOrder: []
    };
    var seenRows = {};
    function addRow(row){
      if (!row) return;
      var keyValue = clean(row.key || row.item || row.name || row.displayName || row.label);
      if (!keyValue) return;
      var nk = norm(keyValue);
      if (seenRows[nk]) {
        if (!seenRows[nk].displayName && clean(row.displayName || row.label || row.name)) seenRows[nk].displayName = clean(row.displayName || row.label || row.name);
        return;
      }
      var display = clean(row.displayName || row.label || row.name || source.itemLabels[keyValue] || keyValue);
      var copy = Object.assign({}, row, { key: keyValue, displayName: display || titleizeKey(keyValue) });
      seenRows[nk] = copy;
      source.periodMeta.push(copy);
      if (copy.displayName) source.itemLabels[keyValue] = copy.displayName;
    }
    [].concat(prior.periodMeta || [], payload.periodMeta || [], payload.periods || []).forEach(addRow);
    function addOrder(v){
      var item = typeof v === 'string' ? v : clean((v || {}).item || (v || {}).key || (v || {}).name || (v || {}).label || (v || {}).displayName);
      if (!item) return;
      uniqPush(source.itemOrder, item);
      if (!seenRows[norm(item)]) addRow({ key: item, displayName: source.itemLabels[item] || labelFor(item, source), blockType: isSpecial(item) ? norm(item) : 'instruction', inferredFromBellSchedule: true });
    }
    coreOrder().forEach(addOrder);
    [].concat(prior.itemOrder || [], payload.itemOrder || [], payload.items || []).forEach(addOrder);
    extractItemsFromPayload(payload, source.itemOrder).forEach(addOrder);
    source.periodMeta.forEach(function(row){ if (row && row.key && row.displayName) source.itemLabels[row.key] = row.displayName; });
    setSource(source);
    mergeIntoDataObjects(source);
    return source;
  }

  function mergeIntoDataObjects(source){
    ['scheduleData','studentData','staffData'].forEach(function(name){
      var d = window[name];
      if (!d || typeof d !== 'object') return;
      d.itemLabels = Object.assign({}, d.itemLabels || {}, source.itemLabels || {});
      var meta = [].concat(d.periodMeta || []);
      (source.periodMeta || []).forEach(function(row){
        if (!meta.some(function(r){ return norm((r || {}).key || (r || {}).item || (r || {}).name || (r || {}).displayName) === norm(row.key); })) meta.push(row);
      });
      d.periodMeta = meta;
      var order = [];
      extractItemsFromPayload(d, order);
      (source.itemOrder || []).forEach(function(item){ uniqPush(order, item); });
      if (order.length) {
        d.itemOrder = order;
        if (name === 'studentData' || Array.isArray(d.items)) d.items = order;
      }
    });
  }

  function callServer(fn, payload, ok, fail){
    if (window.google && google.script && google.script.run) {
      try {
        google.script.run.withSuccessHandler(function(res){ ok && ok(res); }).withFailureHandler(function(err){ fail && fail(err); })[fn](payload || {});
        return;
      } catch(e) {}
    }
    if (typeof window.serverV686 === 'function') {
      try {
        window.serverV686(fn, payload || {}, function(res){ ok && ok(res); }, function(err){ fail && fail(err); });
        return;
      } catch(e2) {}
    }
    if (typeof window.callServer === 'function') {
      try {
        window.callServer(fn, payload || {}, function(res){ ok && ok(res); }, function(err){ fail && fail(err); });
        return;
      } catch(e3) {}
    }
    fail && fail(new Error('No server bridge available'));
  }

  var sourceInFlight = false;
  function requestBellSourceAE(force){
    var key = selectedSchoolKey();
    var existing = getSource();
    if (!force && existing && existing.schoolKey === key && existing.itemOrder && existing.itemOrder.length) return;
    if (sourceInFlight) return;
    sourceInFlight = true;
    callServer(SOURCE_FN, selectedSchoolPayload(), function(res){
      sourceInFlight = false;
      if (res && res.ok !== false) {
        res.schoolKey = res.schoolKey || key;
        mergeBellSourceAE(res);
        rerenderPeriodSurfacesAE();
      }
    }, function(){ sourceInFlight = false; });
  }

  function patchFunctionGlobal(name, fn){
    try { window[name] = fn; }
    catch(e) { return; }
    try { window.eval(name + ' = window["' + name + '"];'); } catch(e2) {}
  }

  function patchLabels(){
    ['periodDisplayNameV5140','studentItemLabelV5141','staffScheduleItemLabelV5154','displayPeriodLabelClientV5323'].forEach(function(name){
      var base = window[name];
      if (base && base.__v05418ae) return;
      var wrapped = function(item){
        var direct = labelFor(item);
        if (direct) return direct;
        if (typeof base === 'function') {
          try { return base.apply(this, arguments); } catch(e) {}
        }
        return clean(item);
      };
      wrapped.__v05418ae = true;
      patchFunctionGlobal(name, wrapped);
    });
  }

  function patchNormalize(){
    var base = window.normalizeSchedulePayload;
    if (!base || base.__v05418ae) return;
    var wrapped = function(data){
      var result;
      try { result = base.apply(this, arguments); } catch(e) { result = data; }
      if (result && typeof result === 'object') {
        if (result.periodMeta || result.itemLabels || result.itemOrder || result.items || result.schedules || result.templates) mergeBellSourceAE(result);
        var source = getSource();
        if (source) {
          result.periodMeta = [].concat(result.periodMeta || []);
          (source.periodMeta || []).forEach(function(row){ if (!result.periodMeta.some(function(r){ return norm((r || {}).key || (r || {}).item || (r || {}).name || (r || {}).displayName) === norm(row.key); })) result.periodMeta.push(row); });
          result.itemLabels = Object.assign({}, result.itemLabels || {}, source.itemLabels || {});
          var order = [];
          extractItemsFromPayload(result, order);
          (source.itemOrder || []).forEach(function(item){ uniqPush(order, item); });
          result.itemOrder = order;
          result.items = order;
        }
      }
      return result;
    };
    wrapped.__v05418ae = true;
    patchFunctionGlobal('normalizeSchedulePayload', wrapped);
  }

  function patchPeriodMetaRows(){
    var base = window.periodMetaBaseRowsV5139;
    if (!base || base.__v05418ae) return;
    var wrapped = function(){
      var rows = [];
      try { rows = base.apply(this, arguments) || []; } catch(e) { rows = []; }
      var source = getSource();
      if (!source) return rows;
      var seen = {};
      rows.forEach(function(r){ var key = clean((r || {}).key || (r || {}).item || (r || {}).name || (r || {}).displayName); if (key) seen[norm(key)] = true; });
      (source.periodMeta || []).forEach(function(row){
        var key = clean(row.key || row.item || row.name || row.displayName);
        if (key && !seen[norm(key)] && looksLikePeriod(key)) {
          rows.push(Object.assign({}, row, { key: key, displayName: row.displayName || labelFor(key) }));
          seen[norm(key)] = true;
        }
      });
      (source.itemOrder || []).forEach(function(item){
        if (clean(item) && !seen[norm(item)] && looksLikePeriod(item)) {
          rows.push({ key: item, displayName: labelFor(item), blockType: isSpecial(item) ? norm(item) : 'instruction', inferredFromBellSchedule: true });
          seen[norm(item)] = true;
        }
      });
      return rows;
    };
    wrapped.__v05418ae = true;
    patchFunctionGlobal('periodMetaBaseRowsV5139', wrapped);
  }

  function rerenderPeriodSurfacesAE(){
    try { if (typeof window.renderPeriodMetaRowsV5131 === 'function') window.renderPeriodMetaRowsV5131(); } catch(e) {}
    try {
      if (typeof window.renderScheduleRows === 'function' && window.scheduleData) {
        var rows = window.scheduleData.schedules || window.scheduleData.rows || [];
        if (Array.isArray(rows)) window.renderScheduleRows(rows);
      }
    } catch(e2) {}
    try { renderAdvancedRowChipsAE(); } catch(e3) {}
  }

  function patchLoaders(){
    ['loadScheduleData','loadStudentData','loadStaffData','selectCampus','selectSchool','setActiveSchool'].forEach(function(name){
      var base = window[name];
      if (!base || base.__v05418ae) return;
      var wrapped = function(){
        var oldSchool = (getSource() || {}).schoolKey;
        var result = base.apply(this, arguments);
        var newSchool = selectedSchoolKey();
        if (oldSchool && oldSchool !== newSchool) setSource(null);
        setTimeout(function(){ requestBellSourceAE(oldSchool !== newSchool); }, 25);
        return result;
      };
      wrapped.__v05418ae = true;
      patchFunctionGlobal(name, wrapped);
    });
    document.addEventListener('change', function(ev){
      if (ev.target && /^(campusSelector|schoolSelector|schoolSelect|siteSelector)$/.test(ev.target.id || '')) {
        setSource(null);
        setTimeout(function(){ requestBellSourceAE(true); }, 50);
      }
    }, true);
  }

  function installCss(){
    if (byId('v05418ae-style')) return;
    var st = document.createElement('style');
    st.id = 'v05418ae-style';
    st.textContent = [
      '#advancedSchedulingModalV05418X{z-index:9999;}',
      '#advancedSchedulingModalV05418X:not(.active){display:none!important;}',
      '.advancedStudentNameV05418CT{margin:0 0 10px;color:#475569;font-size:13px;line-height:1.35;}',
      '.advancedStudentNameV05418CT strong{color:#0f172a;font-weight:800;}',
      '.splitSupportExplainV05418AE{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin:8px 0 12px;color:#334155;font-size:13px;line-height:1.45;}',
      '.splitRowsV05418AE{display:flex;flex-direction:column;gap:8px;margin-top:8px;}',
      '.splitRowV05418AE{display:grid;grid-template-columns:minmax(160px,1.4fr) minmax(110px,.8fr) minmax(120px,.8fr) auto;gap:8px;align-items:center;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:8px;}',
      '.splitRowV05418AE select,.splitRowV05418AE input{width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;}',
      '.splitRowV05418AE .removeSplitV05418AE{border:0;background:#fee2e2;color:#991b1b;border-radius:8px;padding:8px 10px;font-weight:700;cursor:pointer;}',
      '.addSplitV05418AE{border:1px solid #2563eb;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:8px 12px;font-weight:700;cursor:pointer;}',
      '.splitHintV05418AE{font-size:12px;color:#64748b;margin-top:6px;}',
      '.splitErrorV05418AE{display:none;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 10px;margin-top:8px;font-size:13px;}',
      '.chipV05418AE{display:inline-flex;align-items:center;border-radius:999px;padding:2px 7px;background:#e0f2fe;color:#075985;font-size:11px;font-weight:700;margin-left:4px;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function currentStudentName(){
    var el = byId('studentName') || document.querySelector('[data-student-name].active');
    if (el && el.value) return clean(el.value);
    if (el && el.textContent) return clean(el.textContent);
    if (window.currentStudent && (window.currentStudent.name || window.currentStudent.student)) return clean(window.currentStudent.name || window.currentStudent.student);
    if (window.selectedStudent && (window.selectedStudent.name || window.selectedStudent.student)) return clean(window.selectedStudent.name || window.selectedStudent.student);
    return '';
  }

  function activeStudentRecord(){
    var name = currentStudentName();
    if (window.currentStudent && (norm(window.currentStudent.name || window.currentStudent.student) === norm(name) || !name)) return window.currentStudent;
    var list = (window.studentData && window.studentData.students) || [];
    for (var i = 0; i < list.length; i++) if (norm(list[i].name || list[i].student) === norm(name)) return list[i];
    return window.currentStudent || {};
  }

  function getAdvCache(){ if (!window[ADV_CACHE_KEY]) window[ADV_CACHE_KEY] = {}; return window[ADV_CACHE_KEY]; }
  function getCachedAdvanced(student){ return getAdvCache()[storageKey(student)] || null; }
  function setCachedAdvanced(student, rec){ getAdvCache()[storageKey(student)] = rec || {}; }
  function currentAdvancedAE(){
    var student = activeStudentRecord();
    var name = currentStudentName() || student.name || student.student;
    return getCachedAdvanced(name) || student.advancedScheduling || student.advanced || {};
  }

  function fetchAdvancedAE(studentName, cb){
    studentName = clean(studentName || currentStudentName());
    if (!studentName) { cb && cb({}); return; }
    var url = '/api/v05418x/student-advanced?school=' + encodeURIComponent(selectedSchoolKey()) + '&student=' + encodeURIComponent(studentName);
    fetch(url, { credentials: 'same-origin' }).then(function(r){ return r.json(); }).then(function(json){
      var rec = (json && (json.record || json.advancedScheduling || json)) || {};
      setCachedAdvanced(studentName, rec);
      cb && cb(rec);
    }).catch(function(){ cb && cb(currentAdvancedAE()); });
  }

  function saveAdvancedAE(studentName, rec, cb, fail){
    studentName = clean(studentName || currentStudentName());
    var payload = Object.assign({}, rec || {}, { school: selectedSchoolKey(), student: studentName });
    fetch('/api/v05418x/student-advanced', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    }).then(function(r){ return r.text().then(function(text){
      var json = {};
      try { json = text ? JSON.parse(text) : {}; }
      catch(e) { throw new Error('Expected JSON from advanced scheduling save, got: ' + String(text || '').slice(0, 120)); }
      if (!r.ok || (json && json.ok === false)) throw new Error((json && (json.error || json.message)) || ('HTTP ' + r.status));
      return json;
    }); }).then(function(json){
      var saved = (json && json.record) || payload;
      setCachedAdvanced(studentName, saved);
      var student = activeStudentRecord();
      if (student) student.advancedScheduling = saved;
      if (window.currentStudent) window.currentStudent.advancedScheduling = saved;
      cb && cb(json || { ok: true, record: saved });
    }).catch(function(err){ fail && fail(err); });
  }

  function splitRowsFromAdvanced(adv){
    var rows = [];
    if (Array.isArray(adv && adv.splitPeriodSupport)) rows = adv.splitPeriodSupport.slice();
    else if (Array.isArray(adv && adv.splitPeriodSupportParsed)) rows = adv.splitPeriodSupportParsed.slice();
    else if (clean(adv && adv.splitPeriodSupportRaw)) rows = safeJson(adv.splitPeriodSupportRaw, []);
    if (!Array.isArray(rows)) rows = [];
    return rows.filter(function(r){ return r && typeof r === 'object'; });
  }

  function periodOptionsHtml(selected){
    var items = [];
    var source = getSource() || {};
    [].concat(source.itemOrder || [], (window.studentData || {}).items || [], (window.scheduleData || {}).itemOrder || []).forEach(function(item){ uniqPush(items, item); });
    qsa('#studentPeriodRows [data-item], [data-student-period-item]').forEach(function(el){ uniqPush(items, el.getAttribute('data-item') || el.getAttribute('data-student-period-item')); });
    if (!items.length) items = coreOrder();
    return items.map(function(item){ var sel = norm(item) === norm(selected) ? ' selected' : ''; return '<option value="' + esc(item) + '"' + sel + '>' + esc(labelFor(item)) + '</option>'; }).join('');
  }

  function normalizeSplitRowForUi(row){
    row = row || {};
    var mode = clean(row.mode || row.windowMode || row.type || row.segment).toLowerCase();
    if (mode !== 'first' && mode !== 'last' && mode !== 'between') {
      if (clean(row.start) && clean(row.end)) mode = 'legacy';
      else mode = 'last';
    }
    var value = '';
    if (mode === 'between') value = clean((row.startMinute != null ? row.startMinute : row.startOffset)) + '-' + clean((row.endMinute != null ? row.endMinute : row.endOffset));
    else if (mode === 'legacy') value = clean(row.start) + ' - ' + clean(row.end);
    else value = clean(row.minutes || row.duration || row.length || row.minuteCount);
    return { item: clean(row.item || row.period || row.key || row.label), mode: mode, value: value, legacyStart: clean(row.start), legacyEnd: clean(row.end) };
  }

  function splitRowHtml(row){
    var ui = normalizeSplitRowForUi(row);
    var modeOptions = [
      ['first','first'],
      ['last','last'],
      ['between','between']
    ];
    if (ui.mode === 'legacy') modeOptions.push(['legacy','exact time']);
    return '<div class="splitRowV05418AE" data-split-row-v05418ae data-legacy-start="' + esc(ui.legacyStart) + '" data-legacy-end="' + esc(ui.legacyEnd) + '">' +
      '<select data-split-item-v05418ae>' + periodOptionsHtml(ui.item) + '</select>' +
      '<select data-split-mode-v05418ae>' + modeOptions.map(function(pair){ return '<option value="' + pair[0] + '"' + (pair[0] === ui.mode ? ' selected' : '') + '>' + pair[1] + '</option>'; }).join('') + '</select>' +
      '<input data-split-minutes-v05418ae placeholder="30 or 15-30" value="' + esc(ui.value) + '">' +
      '<button type="button" class="removeSplitV05418AE" data-remove-split-v05418ae title="Remove split window">×</button>' +
      '</div>';
  }

  function boolAttr(adv, key){ return adv && (adv[key] === true || adv[key] === 'true' || adv[key] === 'Yes' || adv[key] === 'yes'); }
  function advancedModalBody(adv){
    adv = adv || {};
    var rows = splitRowsFromAdvanced(adv);
    return '<div class="modalBox" style="max-width:760px;width:min(760px,94vw);max-height:90vh;overflow:auto;">' +
      '<div class="modalHeader" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
        '<h3 style="margin:0;">Advanced Scheduling</h3>' +
        '<button type="button" class="modalCloseX" data-close-adv-v05418ae aria-label="Close advanced scheduling">×</button>' +
      '</div>' +
      '<div class="advancedStudentNameV05418CT">Student: <strong>' + esc(currentStudentName()) + '</strong></div>' +
      '<div class="modalBody">' +
        '<label class="checkRow"><input type="checkbox" id="twoToOneV05418AE"' + (boolAttr(adv,'twoToOne') ? ' checked' : '') + '> Two-to-one support allowed</label>' +
        '<label class="checkRow"><input type="checkbox" id="avoidOneToOneV05418AE"' + (boolAttr(adv,'avoidOneToOne') ? ' checked' : '') + '> Avoid one-to-one support when possible</label>' +
        '<label class="checkRow"><input type="checkbox" id="requiresConsistentStaffV05418AE"' + (boolAttr(adv,'requiresConsistentStaff') ? ' checked' : '') + '> Prefer consistent staff</label>' +
        '<div class="fieldGroup" style="margin-top:14px;">' +
          '<label style="font-weight:700;display:block;margin-bottom:6px;">Split-period support</label>' +
          '<div class="splitSupportExplainV05418AE"><strong>Definition:</strong> each split window is the time staff WILL support this student inside the selected period. The scheduler may treat the assigned staff member as free outside that support window for break/lunch coverage. Example: <em>Period 1 / last / 30 minutes</em> means support is needed only during the last 30 minutes of Period 1.</div>' +
          '<div class="splitRowsV05418AE" id="splitRowsV05418AE">' + (rows.length ? rows.map(splitRowHtml).join('') : '') + '</div>' +
          '<button type="button" class="addSplitV05418AE" data-add-split-v05418ae>+ Add structured split window</button>' +
          '<div class="splitHintV05418AE">Use a single number of minutes for first, last, or between. Between means start + minutes through end - minutes.</div>' +
          '<div class="splitErrorV05418AE" id="splitErrorV05418AE"></div>' +
        '</div>' +
      '</div>' +
      '<div class="modalFooter" style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">' +
        '<button type="button" class="secondaryBtn" data-close-adv-v05418ae>Cancel</button>' +
        '<button type="button" class="primaryBtn" data-save-adv-v05418ae>Save Advanced Scheduling</button>' +
      '</div>' +
    '</div>';
  }

  function showSplitError(msg){ var el = byId('splitErrorV05418AE'); if (!el) return; el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }
  function ensureModal(){
    var modal = byId('advancedSchedulingModalV05418X');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'advancedSchedulingModalV05418X';
      modal.className = 'modal';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function openAdvancedModalAE(ev){
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    installCss();
    requestBellSourceAE(false);
    var modal = ensureModal();
    modal.innerHTML = '<div class="modalBox"><p>Loading advanced scheduling...</p></div>';
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    fetchAdvancedAE(currentStudentName(), function(adv){
      modal.innerHTML = advancedModalBody(adv || currentAdvancedAE() || {});
      // v0.54.18ct: do not create a default split window on open.
      // Empty advanced scheduling records should stay empty until an admin explicitly clicks Add Split Window.
    });
    return false;
  }

  function closeAdvancedModalAE(ev){
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    var modal = byId('advancedSchedulingModalV05418X');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    return false;
  }

  function addSplitRowAE(row){
    var box = byId('splitRowsV05418AE');
    if (!box) return;
    var temp = document.createElement('div');
    temp.innerHTML = splitRowHtml(row || { mode: 'last', minutes: 30 });
    box.appendChild(temp.firstChild);
  }

  function parseSplitRowsAE(){
    var errors = [];
    var rows = [];
    qsa('[data-split-row-v05418ae]').forEach(function(el, idx){
      var item = clean((el.querySelector('[data-split-item-v05418ae]') || {}).value);
      var mode = clean((el.querySelector('[data-split-mode-v05418ae]') || {}).value).toLowerCase();
      var value = clean((el.querySelector('[data-split-minutes-v05418ae]') || {}).value);
      if (!item) return;
      if (mode === 'legacy') {
        var start = el.getAttribute('data-legacy-start') || value.split('-')[0] || '';
        var end = el.getAttribute('data-legacy-end') || value.split('-').slice(1).join('-') || '';
        if (clean(start) && clean(end)) rows.push({ item: item, mode: 'legacy', start: clean(start), end: clean(end), semantics: 'will_support' });
        return;
      }
      if (mode === 'first' || mode === 'last') {
        var minutes = parseInt(value, 10);
        if (!isFinite(minutes) || minutes <= 0) { errors.push('Row ' + (idx + 1) + ': enter minutes greater than 0.'); return; }
        rows.push({ item: item, mode: mode, minutes: minutes, semantics: 'will_support' });
        return;
      }
      if (mode === 'between') {
        var minutes = parseInt(value, 10);
        if (!isFinite(minutes) || minutes <= 0) { errors.push('Row ' + (idx + 1) + ': enter minutes greater than 0.'); return; }
        rows.push({ item: item, mode: 'between', minutes: minutes, semantics: 'will_support' });
      }
    });
    return { rows: rows, errors: errors };
  }

  function saveAdvancedModalAE(ev){
    if (ev) { ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); }
    if (advancedSaveBusyV05418CT) return false;
    advancedSaveBusyV05418CT = true;
    var parsed = parseSplitRowsAE();
    if (parsed.errors.length) { advancedSaveBusyV05418CT = false; showSplitError(parsed.errors.join(' ')); return false; }
    showSplitError('');
    var studentName = currentStudentName();
    var rec = Object.assign({}, currentAdvancedAE() || {}, {
      student: studentName,
      twoToOne: !!(byId('twoToOneV05418AE') && byId('twoToOneV05418AE').checked),
      avoidOneToOne: !!(byId('avoidOneToOneV05418AE') && byId('avoidOneToOneV05418AE').checked),
      requiresConsistentStaff: !!(byId('requiresConsistentStaffV05418AE') && byId('requiresConsistentStaffV05418AE').checked),
      splitPeriodSupport: parsed.rows,
      splitPeriodSupportRaw: '',
      splitPeriodSupportParsed: parsed.rows,
      splitPeriodSupportSemantics: 'will_support_within_window'
    });
    var btn = document.querySelector('[data-save-adv-v05418ae]');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    saveAdvancedAE(studentName, rec, function(){
      advancedSaveBusyV05418CT = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Save Advanced Scheduling'; }
      try { if (typeof window.syncTwoToOneOptionsV05418X === 'function') window.syncTwoToOneOptionsV05418X(); } catch(e) {}
      try { if (typeof window.markDirty === 'function') window.markDirty(); else if (typeof window.markProfileDirtyV51229 === 'function') window.markProfileDirtyV51229('student'); } catch(e2) {}
      renderAdvancedRowChipsAE();
      closeAdvancedModalAE();
    }, function(err){
      advancedSaveBusyV05418CT = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Save Advanced Scheduling'; }
      showSplitError((err && err.message) || 'Advanced scheduling could not be saved.');
    });
    return false;
  }

  function splitAppliesToItem(adv, item){
    var rows = splitRowsFromAdvanced(adv);
    var ni = norm(item), nl = norm(labelFor(item));
    return rows.some(function(r){ var ri = norm(r.item || r.period || r.key || r.label); return ri && (ri === ni || ri === nl); });
  }

  function renderAdvancedRowChipsAE(){
    var adv = currentAdvancedAE();
    qsa('.chipV05418AE').forEach(function(el){ el.parentNode && el.parentNode.removeChild(el); });
    qsa('#studentPeriodRows [data-item], [data-student-period-item]').forEach(function(row){
      var item = row.getAttribute('data-item') || row.getAttribute('data-student-period-item');
      if (!splitAppliesToItem(adv, item)) return;
      var host = row.querySelector('.rowChips,.periodChips,.chips') || row;
      var chip = document.createElement('span');
      chip.className = 'chipV05418AE';
      chip.textContent = 'Split support';
      host.appendChild(chip);
    });
  }

  function patchAdvancedEntryPoints(){
    patchFunctionGlobal('openAdvancedSchedulingV05418Z', openAdvancedModalAE);
    patchFunctionGlobal('openAdvancedSchedulingV05418AB', openAdvancedModalAE);
    patchFunctionGlobal('openAdvancedSchedulingV05418AA', openAdvancedModalAE);
    document.addEventListener('click', function(ev){
      var close = ev.target && ev.target.closest && ev.target.closest('[data-close-adv-v05418x],[data-close-adv-v05418ae],.modalCloseX');
      if (close) return closeAdvancedModalAE(ev);
      var save = ev.target && ev.target.closest && ev.target.closest('[data-save-adv-v05418ae]');
      if (save) return saveAdvancedModalAE(ev);
      var add = ev.target && ev.target.closest && ev.target.closest('[data-add-split-v05418ae]');
      if (add) { ev.preventDefault(); ev.stopPropagation(); addSplitRowAE({ mode: 'last', minutes: 30 }); return false; }
      var rm = ev.target && ev.target.closest && ev.target.closest('[data-remove-split-v05418ae]');
      if (rm) { ev.preventDefault(); ev.stopPropagation(); var row = rm.closest('[data-split-row-v05418ae]'); if (row && row.parentNode) row.parentNode.removeChild(row); return false; }
      var modal = byId('advancedSchedulingModalV05418X');
      if (modal && ev.target === modal) return closeAdvancedModalAE(ev);
    }, true);
    document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape') closeAdvancedModalAE(ev); }, true);
    var baseRender = window.renderStudentPeriodRows;
    if (baseRender && !baseRender.__v05418ae) {
      var wrapped = function(){ var res = baseRender.apply(this, arguments); setTimeout(renderAdvancedRowChipsAE, 0); return res; };
      wrapped.__v05418ae = true;
      patchFunctionGlobal('renderStudentPeriodRows', wrapped);
    }
  }

  function boot(){
    installCss();
    patchLabels();
    patchNormalize();
    patchPeriodMetaRows();
    patchLoaders();
    patchAdvancedEntryPoints();
    requestBellSourceAE(false);
    setTimeout(function(){ patchAdvancedEntryPoints(); requestBellSourceAE(false); }, 500);
    setTimeout(function(){ patchLabels(); patchNormalize(); patchPeriodMetaRows(); rerenderPeriodSurfacesAE(); }, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

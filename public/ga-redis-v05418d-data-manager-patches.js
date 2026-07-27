/* GA Scheduler 0.54.18d Data Manager / Google Forms metrics fixes. */
(function(){
  if (window.__gaDataManagerV05418D) return;
  window.__gaDataManagerV05418D = true;

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function msg(text, type){ try { if (typeof window.setMsg === 'function') window.setMsg(text, type || 'ok'); } catch(e) {} }
  function esc(v){
    try { if (typeof window.esc === 'function') return window.esc(v); } catch(e) {}
    return clean(v).replace(/[&<>\"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c] || c; });
  }
  function schoolPayload(){
    var out = {};
    try {
      var ctx = window.campusContextV5253 || window.campusContext || window.selectedCampusContext || {};
      var cur = ctx.currentCampus || {};
      var sel = by('campusSelector');
      var opt = sel && sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      var sid = clean((sel && sel.value) || ctx.selectedCampusId || ctx.schoolId || ctx.campusId || cur.campusId || cur.id || '');
      var ss = clean(ctx.selectedSpreadsheetId || ctx.spreadsheetId || cur.spreadsheetId || (opt && (opt.getAttribute('data-spreadsheet-id') || opt.getAttribute('data-ss-id'))) || '');
      var nm = clean(ctx.selectedCampusName || ctx.schoolName || ctx.campusName || cur.campusName || cur.name || (opt && opt.textContent) || '');
      if (sid) out.school = out.schoolId = out.selectedCampusId = out.campusId = sid;
      if (ss) out.spreadsheetId = out.selectedSpreadsheetId = ss;
      if (nm) out.name = out.schoolName = out.selectedCampusName = out.campusName = nm;
    } catch(e) {}
    return out;
  }
  function jsonFetch(url, opts){
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.headers = Object.assign({'Content-Type':'application/json'}, opts.headers || {});
    return fetch(url, opts).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(json){
        if (!res.ok || json.ok === false) {
          var err = new Error(json.error || json.message || ('Request failed: HTTP ' + res.status));
          err.response = json;
          throw err;
        }
        return json;
      });
    });
  }
  function normalizeRefreshStamp(value){
    var s = clean(value);
    if (!s) return '';
    if (/^\d{1,2}\/\d{1,2}\/\d{4}\s*@\s*/.test(s)) return s;
    var d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    var yyyy = d.getFullYear();
    var h = d.getHours();
    var ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    var hh = String(h).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return mm + '/' + dd + '/' + yyyy + ' @ ' + hh + ':' + min + ' ' + ap;
  }
  function setLastRefresh(value){
    var stamp = normalizeRefreshStamp(value) || 'Not recorded';
    if (window.portalSettingsData) window.portalSettingsData.folderLastRefresh = stamp;
    ['dataManagerLastRefresh','folderLastRefresh'].forEach(function(id){ var el = by(id); if (el) el.textContent = 'Last refreshed on: ' + stamp; });
  }
  function updateLocalStudent(rowIndex, patch){
    rowIndex = Number(rowIndex || 0);
    if (!rowIndex || !window.studentData || !Array.isArray(window.studentData.students)) return;
    window.studentData.students.forEach(function(st){
      if (Number(st.rowIndex || 0) === rowIndex) Object.assign(st, patch || {});
    });
  }
  function applyDataFiles(dataFiles){
    var rows = (dataFiles && dataFiles.rows) || [];
    rows.forEach(function(r){
      updateLocalStudent(r.rowIndex, {
        dataFiles: r.url || '',
        dataPoints: r.points || '',
        dataFilesLastUpdated: r.lastUpdated || ''
      });
    });
    try { if (typeof window.renderDataManager === 'function') window.renderDataManager(); } catch(e) {}
    try {
      var st = window.currentStudent || window.currentStudentData || null;
      if (st && st.rowIndex) {
        var match = rows.filter(function(r){ return Number(r.rowIndex) === Number(st.rowIndex); })[0];
        if (match) {
          if (by('studentDataPoints')) by('studentDataPoints').value = match.points || '';
          if (by('studentDataFilesLastUpdated')) by('studentDataFilesLastUpdated').value = match.lastUpdated || '';
          if (by('studentDataFiles') && match.url) by('studentDataFiles').value = match.url;
        }
      }
    } catch(e2) {}
  }
  function saveDataUrl(row, url){
    var payload = Object.assign({}, schoolPayload(), { rowIndex: Number(row || 0), url: clean(url) });
    return jsonFetch('/api/v0544/student-data-url/save', { method:'POST', body: JSON.stringify(payload) }).then(function(r){
      var savedUrl = r.url || payload.url || '';
      updateLocalStudent(payload.rowIndex, { dataFiles: savedUrl });
      var input = document.querySelector('[data-data-url-row="' + payload.rowIndex + '"]');
      if (input) input.value = savedUrl;
      return r;
    });
  }
  function refreshDataMetrics(){
    msg('Updating data points...', 'warn');
    return jsonFetch('/api/v054/data-metrics/refresh', { method:'POST', body: JSON.stringify(schoolPayload()) }).then(function(r){
      setLastRefresh(r.lastRefresh || (r.dataFiles && r.dataFiles.summary && r.dataFiles.summary.lastRefresh) || '');
      applyDataFiles(r.dataFiles || {});
      try { if (typeof window.v5268CacheClear === 'function') { window.v5268CacheClear('students'); window.v5268CacheClear('settings'); window.v5268CacheClear('dashboard'); } } catch(e) {}
      msg((r.message || 'Data points updated.') + (r.errors ? ' Check rows marked Form Access Error.' : ''), r.errors ? 'warn' : 'ok');
      return r;
    }).catch(function(err){
      var text = (err && err.message) || String(err || 'Unknown error');
      msg('Could not update data points: ' + text, 'err');
      throw err;
    });
  }

  var baseRenderDataManager = window.renderDataManager;
  window.renderDataManager = function(){
    if (typeof baseRenderDataManager === 'function') baseRenderDataManager.apply(this, arguments);
    try { if (window.portalSettingsData && window.portalSettingsData.folderLastRefresh) setLastRefresh(window.portalSettingsData.folderLastRefresh); } catch(e) {}
  };

  var baseSaveDataManagerUrl = window.saveDataManagerUrl;
  window.saveDataManagerUrl = function(row){
    try {
      var input = document.querySelector('[data-data-url-row="' + row + '"]');
      if (!input) { msg('Could not find URL field.', 'err'); return; }
      msg('Saving data link...', 'warn');
      return saveDataUrl(row, input.value).then(function(r){ msg(r.message || 'Data link saved.', 'ok'); });
    } catch(e) {
      if (typeof baseSaveDataManagerUrl === 'function') return baseSaveDataManagerUrl.apply(this, arguments);
      msg('Could not save data link: ' + (e.message || e), 'err');
    }
  };

  var baseSaveAllDataManagerUrls = window.saveAllDataManagerUrls;
  window.saveAllDataManagerUrls = function(){
    try {
      var inputs = Array.prototype.slice.call(document.querySelectorAll('.dataManagerUrl'));
      if (!inputs.length) { msg('No data links to save.', 'warn'); return; }
      msg('Saving data links...', 'warn');
      return Promise.all(inputs.map(function(input){ return saveDataUrl(input.getAttribute('data-data-url-row'), input.value); }))
        .then(function(){ msg('All data links saved.', 'ok'); });
    } catch(e) {
      if (typeof baseSaveAllDataManagerUrls === 'function') return baseSaveAllDataManagerUrls.apply(this, arguments);
      msg('Could not save data links: ' + (e.message || e), 'err');
    }
  };

  var baseChooseGoogleForm = window.chooseGoogleForm;
  window.chooseGoogleForm = function(url){
    url = clean(url);
    if (!url) return;
    var modal = by('formPickerModal'); if (modal) modal.classList.remove('active');
    var targetRow = clean(window.formPickerTargetRow || (typeof formPickerTargetRow !== 'undefined' ? formPickerTargetRow : ''));
    if (targetRow) {
      try { window.formPickerTargetRow = null; } catch(e) {}
      try { formPickerTargetRow = null; } catch(e2) {}
      var input = document.querySelector('[data-data-url-row="' + targetRow + '"]');
      if (input) input.value = url;
      msg('Saving selected data file/form...', 'warn');
      return saveDataUrl(targetRow, url).then(function(r){ msg(r.message || 'Data file saved.', 'ok'); }).catch(function(err){ msg('Could not save data file URL: ' + ((err && err.message) || err), 'err'); });
    }
    if (by('studentDataFiles')) by('studentDataFiles').value = url;
    if (typeof baseChooseGoogleForm === 'function') {
      try { return baseChooseGoogleForm.apply(this, arguments); } catch(e3) {}
    }
    msg('Selected data file form. Save the student to keep this link.', 'ok');
  };

  document.addEventListener('click', function(e){
    var run = e.target && e.target.closest ? e.target.closest('[data-run="folders"]') : null;
    if (run) {
      e.preventDefault();
      e.stopImmediatePropagation();
      refreshDataMetrics();
      return false;
    }
  }, true);

  window.refreshDataMetricsV05418D = refreshDataMetrics;
})();

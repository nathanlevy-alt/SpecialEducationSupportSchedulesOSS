/* GA Scheduler 0.54.18e Data Manager persistence/access fixes. */
(function(){
  if (window.__gaDataManagerV05418E) return;
  window.__gaDataManagerV05418E = true;

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
  function qsPayload(){
    var p = schoolPayload();
    var q = new URLSearchParams();
    Object.keys(p).forEach(function(k){ if (p[k]) q.set(k, p[k]); });
    q.set('_t', String(Date.now()));
    return q.toString();
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
    window.portalSettingsData = window.portalSettingsData || {};
    window.portalSettingsData.folderLastRefresh = stamp === 'Not recorded' ? '' : stamp;
    ['dataManagerLastRefresh','folderLastRefresh'].forEach(function(id){ var el = by(id); if (el) el.textContent = 'Last refreshed on: ' + stamp; });
  }
  function rowIndexOf(st){ return Number(st && (st.rowIndex || st.row || st.index) || 0); }
  function updateLocalStudent(rowIndex, patch){
    rowIndex = Number(rowIndex || 0);
    if (!rowIndex) return;
    if (window.studentData && Array.isArray(window.studentData.students)) {
      window.studentData.students.forEach(function(st){ if (rowIndexOf(st) === rowIndex) Object.assign(st, patch || {}); });
    }
  }
  function patchLocalFromDataFiles(dataFiles){
    var rows = (dataFiles && dataFiles.rows) || [];
    rows.forEach(function(r){
      updateLocalStudent(r.rowIndex, { dataFiles: r.url || '', dataPoints: r.points || '', dataFilesLastUpdated: r.lastUpdated || '' });
    });
    return rows;
  }
  function renderIfDataManager(){
    try { if (document.querySelector('#dataManager.active') && typeof window.renderDataManager === 'function') window.renderDataManager(); } catch(e) {}
  }
  function loadPersistedMetrics(opts){
    opts = opts || {};
    return jsonFetch('/api/v054/data-metrics?' + qsPayload()).then(function(r){
      setLastRefresh(r.lastRefresh || (r.dataFiles && r.dataFiles.summary && r.dataFiles.summary.lastRefresh) || '');
      patchLocalFromDataFiles(r.dataFiles || {});
      if (opts.render) renderIfDataManager();
      return r;
    }).catch(function(e){
      if (opts.showErrors) msg('Could not load saved data refresh status: ' + (e.message || e), 'err');
      return null;
    });
  }
  function saveDataUrl(row, url){
    row = Number(row || 0);
    var cleaned = clean(url);
    var payload = Object.assign({}, schoolPayload(), { rowIndex: row, url: cleaned });
    return jsonFetch('/api/v0544/student-data-url/save', { method:'POST', body: JSON.stringify(payload) }).then(function(r){
      var savedUrl = r.url || '';
      updateLocalStudent(row, { dataFiles: savedUrl, dataPoints: r.dataPoints || '', dataFilesLastUpdated: r.dataFilesLastUpdated || '' });
      var input = document.querySelector('[data-data-url-row="' + row + '"]');
      if (input) input.value = savedUrl;
      return r;
    });
  }
  function saveAllUrls(){
    var inputs = Array.prototype.slice.call(document.querySelectorAll('.dataManagerUrl'));
    if (!inputs.length) { msg('No data links to save.', 'warn'); return Promise.resolve(null); }
    msg('Saving data links...', 'warn');
    var rows = inputs.map(function(input){ return { rowIndex: Number(input.getAttribute('data-data-url-row') || 0), url: input.value || '' }; });
    return Promise.all(rows.map(function(row){ return saveDataUrl(row.rowIndex, row.url); })).then(function(results){
      var cleared = rows.filter(function(row){ return !clean(row.url); }).length;
      var saved = rows.length - cleared;
      msg('Saved ' + saved + ' data link(s)' + (cleared ? (', ' + cleared + ' cleared') : '') + '.', 'ok');
      renderIfDataManager();
      return { ok:true, saved:saved, cleared:cleared, results:results };
    });
  }
  function refreshDataMetrics(){
    msg('Updating data points...', 'warn');
    return jsonFetch('/api/v054/data-metrics/refresh', { method:'POST', body: JSON.stringify(schoolPayload()) }).then(function(r){
      setLastRefresh(r.lastRefresh || (r.dataFiles && r.dataFiles.summary && r.dataFiles.summary.lastRefresh) || '');
      patchLocalFromDataFiles(r.dataFiles || {});
      renderIfDataManager();
      try { if (typeof window.v5268CacheClear === 'function') { window.v5268CacheClear('students'); window.v5268CacheClear('settings'); window.v5268CacheClear('dashboard'); } } catch(e) {}
      var suffix = r.errors ? ' Some forms still need response access; rows with access problems remain marked.' : '';
      msg((r.message || 'Data points updated.') + suffix, r.errors ? 'warn' : 'ok');
      return r;
    }).catch(function(err){
      msg('Could not update data points: ' + ((err && err.message) || err || 'Unknown error'), 'err');
      throw err;
    });
  }

  var baseRenderDataManager = window.renderDataManager;
  window.renderDataManager = function(){
    if (typeof baseRenderDataManager === 'function') baseRenderDataManager.apply(this, arguments);
    try { if (window.portalSettingsData && window.portalSettingsData.folderLastRefresh) setLastRefresh(window.portalSettingsData.folderLastRefresh); } catch(e) {}
    clearTimeout(window.__dataMetricsLoadTimerV05418E);
    window.__dataMetricsLoadTimerV05418E = setTimeout(function(){ loadPersistedMetrics({ render:false }); }, 50);
  };
  try { renderDataManager = window.renderDataManager; } catch(e) {}

  window.saveDataManagerUrl = function(row){
    var input = document.querySelector('[data-data-url-row="' + row + '"]');
    if (!input) { msg('Could not find URL field.', 'err'); return; }
    msg(clean(input.value) ? 'Saving data link...' : 'Clearing data link...', 'warn');
    return saveDataUrl(row, input.value).then(function(r){ msg((r && r.message) || 'Data link saved.', 'ok'); renderIfDataManager(); return r; }).catch(function(e){ msg('Could not save data link: ' + (e.message || e), 'err'); });
  };
  try { saveDataManagerUrl = window.saveDataManagerUrl; } catch(e) {}

  window.saveAllDataManagerUrls = function(){ return saveAllUrls().catch(function(e){ msg('Could not save data links: ' + (e.message || e), 'err'); }); };
  try { saveAllDataManagerUrls = window.saveAllDataManagerUrls; } catch(e) {}

  var baseChooseGoogleForm = window.chooseGoogleForm;
  window.chooseGoogleForm = function(url){
    url = clean(url);
    if (!url) return;
    var modal = by('formPickerModal'); if (modal) modal.classList.remove('active');
    var targetRow = '';
    try { targetRow = clean(window.formPickerTargetRow || formPickerTargetRow || ''); } catch(e) { targetRow = clean(window.formPickerTargetRow || ''); }
    if (targetRow) {
      try { window.formPickerTargetRow = null; } catch(e2) {}
      try { formPickerTargetRow = null; } catch(e3) {}
      var input = document.querySelector('[data-data-url-row="' + targetRow + '"]');
      if (input) input.value = url;
      msg('Saving selected data file/form...', 'warn');
      return saveDataUrl(targetRow, url).then(function(r){ msg((r && r.message) || 'Data file saved.', 'ok'); renderIfDataManager(); return r; }).catch(function(err){ msg('Could not save data file URL: ' + ((err && err.message) || err), 'err'); });
    }
    if (by('studentDataFiles')) by('studentDataFiles').value = url;
    if (typeof baseChooseGoogleForm === 'function') { try { return baseChooseGoogleForm.apply(this, arguments); } catch(e4) {} }
    msg('Selected data file form. Save the student to keep this link.', 'ok');
  };
  try { chooseGoogleForm = window.chooseGoogleForm; } catch(e) {}

  document.addEventListener('input', function(e){
    var t = e.target;
    if (t && t.classList && t.classList.contains('dataManagerUrl')) {
      updateLocalStudent(Number(t.getAttribute('data-data-url-row') || 0), { dataFiles: t.value || '' });
    }
  }, true);

  document.addEventListener('click', function(e){
    var target = e.target && e.target.closest ? e.target.closest('[data-action],[data-run]') : null;
    if (!target) return;
    var action = target.getAttribute('data-action') || '';
    var run = target.getAttribute('data-run') || '';
    if (run === 'folders') { e.preventDefault(); e.stopImmediatePropagation(); refreshDataMetrics(); return false; }
    if (action === 'data-save-all-urls') { e.preventDefault(); e.stopImmediatePropagation(); window.saveAllDataManagerUrls(); return false; }
  }, true);

  function boot(){
    if (document.querySelector('#dataManager.active') || by('dataManagerRows')) loadPersistedMetrics({ render:false });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 80);
  window.refreshDataMetricsV05418E = refreshDataMetrics;
  window.loadPersistedDataMetricsV05418E = loadPersistedMetrics;
})();

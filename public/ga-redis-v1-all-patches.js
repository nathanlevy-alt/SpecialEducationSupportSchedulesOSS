
/* ===== BEGIN ga-redis-v015-ui-patches.js ===== */
(function(){
  if (window.__gaRedisV015UiPatches) return;
  window.__gaRedisV015UiPatches = true;

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function setMsgSafe(msg,type){ try { if (typeof setMsg === 'function') setMsg(msg, type || 'ok'); } catch(e) {} }
  function selectedSchoolId(){
    try { if (typeof selectedSchoolIdV5312 === 'function') { var s = clean(selectedSchoolIdV5312()); if (s) return s; } } catch(e) {}
    try { var ctx = window.campusContextV5253 || campusContextV5253 || {}; var s2 = clean(ctx.selectedCampusId || (ctx.currentCampus && (ctx.currentCampus.campusId || ctx.currentCampus.id)) || ''); if (s2) return s2; } catch(e2) {}
    try { var sel = by('campusSelector'); var s3 = clean(sel && sel.value); if (s3) return s3; } catch(e3) {}
    return '';
  }
  function fetchJson(url, opts){
    opts = opts || {};
    opts.credentials = opts.credentials || 'same-origin';
    if (opts.body && !opts.headers) opts.headers = { 'Content-Type':'application/json' };
    return fetch(url, opts).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) { var err = new Error((j && (j.error || j.message)) || ('HTTP '+r.status)); err.payload = j; throw err; } return j; }); });
  }
  function fmtHistoryStamp(v){ try { if (typeof formatHistoryStamp === 'function') return formatHistoryStamp(v || ''); } catch(e) {} return clean(v); }
  function getHistoryRows(){ try { return (window.historyData || historyData || []); } catch(e) { return window.historyData || []; } }
  function setHistoryRows(rows){
    rows = Array.isArray(rows) ? rows : [];
    try { window.historyData = rows; } catch(e) {}
    try { historyData = rows; } catch(e2) {}
    try { historySnapshotCache = {}; historyPage = 1; } catch(e3) {}
  }
  function getFavoritesOnly(){ try { return !!window.historyFavoritesOnly || !!historyFavoritesOnly; } catch(e) { return !!window.historyFavoritesOnly; } }
  function setFavoritesOnly(v){ try { window.historyFavoritesOnly = !!v; } catch(e) {} try { historyFavoritesOnly = !!v; } catch(e2) {} }

  function normalizeHistoryRows(rows){
    return (Array.isArray(rows) ? rows : []).map(function(r){
      r = r || {};
      var id = clean(r.id || r.historyId || r.key || r.hash || '');
      return Object.assign({}, r, {
        id: id,
        starred: !!(r.starred || r.favorite || r.isFavorite),
        regularLocked: !!(r.regularLocked || r.locked || r.isRegular || r.regular),
        publishedAt: r.publishedAt || r.savedAt || r.timestamp || r.createdAt || '',
        summary: r.summary || r.title || '',
        notes: r.notes || ''
      });
    }).filter(function(r){ return r.id; });
  }

  function renderHistoryRowsV015(){
    var box = by('historyTable');
    if (!box) return;
    var rows = normalizeHistoryRows(getHistoryRows());
    if (getFavoritesOnly()) rows = rows.filter(function(r){ return !!r.starred; });
    var favBtn = by('historyFavoritesToggle');
    if (favBtn) favBtn.textContent = 'Favorites only: ' + (getFavoritesOnly() ? 'On' : 'Off');
    if (!rows.length) {
      box.innerHTML = '<p class="muted">' + (getFavoritesOnly() ? 'No favorite schedules loaded yet.' : 'No published schedules saved yet.') + '</p><div id="historyViewBox" class="card" style="margin-top:10px;display:none"></div>';
      return;
    }
    var body = rows.map(function(r){
      var rid = esc(r.id);
      var stamp = esc(fmtHistoryStamp(r.publishedAt || r.savedAt || r.timestamp || r.createdAt || ''));
      var lockLabel = r.regularLocked ? 'Unlock regular schedule' : 'Lock as regular schedule';
      return '<tr data-v018-history-row="'+(Number(r.row||0)||0)+'" data-v018-history-id="'+rid+'">'
        + '<td class="historyDate">'+stamp+'</td>'
        + '<td>'+esc(r.summary || '')+'</td>'
        + '<td class="notesCell"><textarea data-history-note="'+rid+'">'+esc(r.notes || '')+'</textarea></td>'
        + '<td class="historyActionsCell"><div class="historyActions">'
        + '<button type="button" class="starBtn historyStarV018 '+(r.starred?'active':'')+'" title="Favorite" aria-pressed="'+(r.starred?'true':'false')+'" data-v018-history-star-row="'+(Number(r.row||0)||0)+'" data-v018-history-id="'+rid+'">★</button>'
        + '<button class="btn small" data-action="history-view" data-history-id="'+rid+'">View</button>'
        + '<button class="btn small" title="Edit in Customize Schedule" data-action="history-edit-custom" data-history-id="'+rid+'"><i class="fa-solid fa-pencil" aria-hidden="true"></i></button>'
        + '<button class="btn small publishBtn historyPublishBtn" style="display:inline-flex" data-action="history-restore" data-history-id="'+rid+'">Publish</button>'
        + '<button type="button" class="historyRegularBtn historyLockV018 '+(r.regularLocked?'active':'')+'" title="'+esc(lockLabel)+'" aria-pressed="'+(r.regularLocked?'true':'false')+'" data-v018-history-lock-row="'+(Number(r.row||0)||0)+'" data-v018-history-id="'+rid+'"><i class="fa-solid fa-lock" aria-hidden="true"></i></button>'
        + '<button class="btn small" data-action="history-save-note" data-history-id="'+rid+'">Save Notes</button>'
        + '<button class="iconBtn danger historyDeleteBtn historyDeleteIconBtnV5329" title="Delete historical schedule" aria-label="Delete historical schedule" data-action="history-delete" data-history-id="'+rid+'">🗑</button>'
        + '</div></td></tr>';
    }).join('');
    box.innerHTML = '<table class="historyTable"><thead><tr><th>Published / Saved</th><th>Summary</th><th>Notes</th><th class="historyActionsCell">Actions</th></tr></thead><tbody>'+body+'</tbody></table><div class="muted" style="margin-top:8px">Showing '+esc(rows.length)+' historical schedule'+(rows.length===1?'':'s')+'.</div><div id="historyViewBox" class="card" style="margin-top:10px;display:none"></div>';
  }

  function loadScheduleHistoryV015(opts){
    opts = opts || {};
    var school = selectedSchoolId();
    if (!school) { setMsgSafe('Choose a school before loading schedule history.','warn'); return; }
    setMsgSafe('Loading schedule history...','warn');
    fetchJson('/api/history/list-v017?'+new URLSearchParams({ school: school }).toString())
      .then(function(j){ setHistoryRows(normalizeHistoryRows(j.rows || [])); renderHistoryRowsV015(); setMsgSafe('', ''); })
      .catch(function(e){ setMsgSafe('Could not load schedule history: '+clean(e.message || e),'err'); });
  }

  function setHistoryStar(id, starred){
    var school = selectedSchoolId();
    if (!school || !id) return;
    setMsgSafe(starred ? 'Marking schedule as favorite...' : 'Removing favorite...','warn');
    fetchJson('/api/history/star', { method:'POST', body: JSON.stringify({ school: school, id: id, starred: !!starred }) })
      .then(function(j){ setHistoryRows(normalizeHistoryRows(j.rows || [])); renderHistoryRowsV015(); setMsgSafe(starred ? 'Favorite saved.' : 'Favorite removed.','ok'); })
      .catch(function(e){ setMsgSafe('Could not update favorite: '+clean(e.message || e),'err'); });
  }
  function setHistoryLock(id, locked){
    var school = selectedSchoolId();
    if (!school || !id) return;
    setMsgSafe(locked ? 'Locking regular schedule...' : 'Unlocking regular schedule...','warn');
    fetchJson('/api/history/regular-lock', { method:'POST', body: JSON.stringify({ school: school, id: id, locked: !!locked }) })
      .then(function(j){
        setHistoryRows(normalizeHistoryRows(j.rows || []));
        renderHistoryRowsV015();
        try { if (typeof loadRegularSchedulePage === 'function') loadRegularSchedulePage(); } catch(e) {}
        setMsgSafe(locked ? 'Regular schedule locked.' : 'Regular schedule unlocked.','ok');
      })
      .catch(function(e){ setMsgSafe('Could not update regular schedule lock: '+clean(e.message || e),'err'); });
  }

  window.loadScheduleHistory = loadScheduleHistoryV015;
  window.renderScheduleHistory = renderHistoryRowsV015;
  window.starHistory = function(id){ var r = normalizeHistoryRows(getHistoryRows()).filter(function(x){ return x.id === String(id); })[0]; setHistoryStar(id, !(r && r.starred)); };
  window.lockRegularHistory = function(id){ var r = normalizeHistoryRows(getHistoryRows()).filter(function(x){ return x.id === String(id); })[0]; setHistoryLock(id, !(r && r.regularLocked)); };

  document.addEventListener('click', function(e){
    var star = e.target && e.target.closest && e.target.closest('[data-v015-history-star]');
    if (star) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); var sid = star.getAttribute('data-v015-history-star'); setHistoryStar(sid, !star.classList.contains('active')); return false; }
    var lock = e.target && e.target.closest && e.target.closest('[data-v015-history-lock]');
    if (lock) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); var lid = lock.getAttribute('data-v015-history-lock'); setHistoryLock(lid, !lock.classList.contains('active')); return false; }
    var a = e.target && e.target.closest && e.target.closest('[data-action]');
    if (!a) return;
    var action = a.getAttribute('data-action');
    if (action === 'history-load') { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); loadScheduleHistoryV015(); return false; }
    if (action === 'history-toggle-favorites') { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); setFavoritesOnly(!getFavoritesOnly()); renderHistoryRowsV015(); return false; }
  }, true);

  function removeEmailPlaceholder(){
    try { Array.prototype.forEach.call(document.querySelectorAll('#staffNotificationEmailV686m41,#staffNotificationEmailV686m26,input[autocomplete="email"]'), function(input){ if (input && /staff@district\.org/i.test(input.getAttribute('placeholder') || '')) input.setAttribute('placeholder',''); }); } catch(e) {}
  }

  function formatMonthLabel(value){
    var s = clean(value);
    var m = s.match(/^(\d{4})-(\d{1,2})/);
    if (!m) return s || '';
    var d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    try { return d.toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'long',year:'numeric'}); } catch(e) { return s; }
  }
  function tidyAttendanceManager(){
    var section = by('attendanceManager'); if (!section) return;
    var rootCard = section.querySelector(':scope > .card') || section.querySelector('.card'); if (!rootCard) return;
    var entry = by('adminAttendanceEntryV5398');
    var tools = section.querySelector('.attendanceTools');
    if (entry && tools && entry.parentNode === rootCard && tools.parentNode === rootCard && tools.previousElementSibling !== entry) {
      rootCard.insertBefore(entry, tools);
    }
    if (entry) {
      Array.prototype.forEach.call(entry.querySelectorAll('p.muted'), function(p){ p.remove(); });
      var h = entry.querySelector('h3'); if (h) h.style.margin = '0 0 8px';
    }
    var heading = by('attendanceMonthHeading');
    var sel = by('attendanceMonthSelect');
    if (heading) {
      var label = sel && (sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].textContent || sel.value);
      var monthText = formatMonthLabel(label || (sel && sel.value) || '');
      if (monthText) heading.childNodes[0].nodeValue = monthText + ' ';
      else heading.childNodes[0].nodeValue = 'Attendance ';
    }
  }

  function cleanSystemAdminLanguage(){
    var section = by('multiCampus'); if (!section) return;
    var card = section.querySelector('.mcCreateCardV5301'); if (!card) return;
    Array.prototype.forEach.call(card.querySelectorAll('label'), function(label){
      var txt = clean(label.textContent);
      if (/^(Data Workbook Source|Template Spreadsheet ID|Destination Drive Folder ID)$/i.test(txt)) {
        label.style.display = 'none';
        var next = label.nextElementSibling; if (next) next.style.display = 'none';
      }
    });
    var mode = by('mcCreateMode'); if (mode) { mode.value = 'blank'; mode.style.display = 'none'; }
    var help = card.querySelector('h2 .helpDot'); if (help) help.setAttribute('data-tip','Creates or edits a Redis-backed school data set. Google spreadsheet/template fields are no longer used in this deployment.');
    var muted = card.querySelector('.muted');
    if (muted && !muted.getAttribute('data-v015-redis-copy')) {
      muted.textContent = 'Create or edit a Redis-backed school data set. Data is stored in Redis and can be mass-edited through the Redis Data Editor below.';
      muted.setAttribute('data-v015-redis-copy','1');
    }
  }

  function ensureDbEditor(){
    var settings = by('settings'); if (!settings || by('gaRedisDbEditorCardV015')) return;
    var card = document.createElement('div');
    card.id = 'gaRedisDbEditorCardV015';
    card.className = 'card directDatabaseCardV015';
    card.innerHTML = '<h2>Redis Data Editor <span class="muted">Beta</span></h2>'
      + '<p class="muted">Fast mass review/editing of key Redis-backed tables. Edits here bypass normal form validation, so use carefully.</p>'
      + '<div class="toolbar"><button class="btn danger directDbBtnV015" type="button" data-action="redis-db-open-v015">Open Redis Data Editor</button><span id="gaRedisDbEditorMsgV015" class="muted"></span></div>';
    settings.appendChild(card);
  }
  function openDbEditor(){
    var existing = by('gaRedisDbEditorModalV015'); if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'gaRedisDbEditorModalV015';
    modal.innerHTML = '<div class="gaRedisDbBackdropV015"></div><div class="gaRedisDbPanelV015"><div class="toolbar" style="justify-content:space-between"><h2 style="margin:0">Redis Data Editor</h2><button class="btn" data-action="redis-db-close-v015">Close</button></div><p class="muted">Choose a Redis-backed table, edit cells, then Save Sheet. For large sheets, use browser find/scroll. Header row is row 1.</p><div class="toolbar"><label>Sheet <select id="gaRedisDbSheetSelectV015"></select></label><button class="btn" data-action="redis-db-load-sheet-v015">Load</button><button class="btn" data-action="redis-db-add-row-v015">Add Row</button><button class="btn primary" data-action="redis-db-save-sheet-v015">Save Sheet</button><span id="gaRedisDbModalMsgV015" class="muted"></span></div><div id="gaRedisDbGridV015" class="gaRedisDbGridV015 scroll"></div></div>';
    document.body.appendChild(modal);
    loadDbSheets();
  }
  function closeDbEditor(){ var m = by('gaRedisDbEditorModalV015'); if (m) m.remove(); }
  function dbMsg(msg,type){ var el = by('gaRedisDbModalMsgV015') || by('gaRedisDbEditorMsgV015'); if (el) el.textContent = msg || ''; if (type === 'err') setMsgSafe(msg,'err'); }
  function loadDbSheets(){
    dbMsg('Loading sheets...');
    fetchJson('/api/db-editor/sheets?'+new URLSearchParams({ school:selectedSchoolId() }).toString())
      .then(function(j){ var sel = by('gaRedisDbSheetSelectV015'); if (!sel) return; sel.innerHTML = (j.sheets || []).map(function(s){ return '<option value="'+esc(s)+'">'+esc(s)+'</option>'; }).join(''); dbMsg((j.sheets||[]).length+' sheet(s).'); if (sel.value) loadDbSheet(); })
      .catch(function(e){ dbMsg('Could not load sheets: '+clean(e.message || e),'err'); });
  }
  function loadDbSheet(){
    var sel = by('gaRedisDbSheetSelectV015'); var sheet = sel && sel.value; if (!sheet) return;
    dbMsg('Loading '+sheet+'...');
    fetchJson('/api/db-editor/sheet?'+new URLSearchParams({ school:selectedSchoolId(), sheet:sheet }).toString())
      .then(function(j){ renderDbGrid(j.values || []); dbMsg('Loaded '+(j.values||[]).length+' row(s).'); })
      .catch(function(e){ dbMsg('Could not load sheet: '+clean(e.message || e),'err'); });
  }
  function renderDbGrid(values){
    var grid = by('gaRedisDbGridV015'); if (!grid) return;
    values = Array.isArray(values) ? values : [];
    var maxCols = values.reduce(function(m,r){ return Math.max(m, Array.isArray(r)?r.length:1); }, 1);
    maxCols = Math.min(Math.max(maxCols, 1), 80);
    var html = '<table class="gaRedisDbTableV015"><tbody>';
    for (var r=0; r<Math.max(values.length, 1); r++) {
      var row = Array.isArray(values[r]) ? values[r] : [];
      html += '<tr data-row="'+r+'"><th>'+(r+1)+'</th>';
      for (var c=0; c<maxCols; c++) html += '<td><input data-r="'+r+'" data-c="'+c+'" value="'+esc(row[c] == null ? '' : row[c])+'"></td>';
      html += '</tr>';
    }
    html += '</tbody></table>';
    grid.innerHTML = html;
  }
  function readDbGridValues(){
    var inputs = Array.prototype.slice.call(document.querySelectorAll('#gaRedisDbGridV015 input[data-r][data-c]'));
    var rows = [];
    inputs.forEach(function(inp){ var r=Number(inp.getAttribute('data-r')), c=Number(inp.getAttribute('data-c')); if (!rows[r]) rows[r]=[]; rows[r][c]=inp.value; });
    rows = rows.map(function(r){ r = r || []; var last = r.length - 1; while (last >= 0 && clean(r[last]) === '') last--; return r.slice(0, last + 1); });
    while (rows.length && rows[rows.length-1].every(function(x){ return clean(x)===''; })) rows.pop();
    return rows;
  }
  function addDbRow(){ var values = readDbGridValues(); var cols = values.reduce(function(m,r){return Math.max(m,r.length);},1); var row=[]; for(var i=0;i<cols;i++) row.push(''); values.push(row); renderDbGrid(values); }
  function saveDbSheet(){
    var sel = by('gaRedisDbSheetSelectV015'); var sheet = sel && sel.value; if (!sheet) return;
    if (!confirm('Save changes to Redis sheet "'+sheet+'"? This bypasses normal UI validation.')) return;
    dbMsg('Saving '+sheet+'...');
    fetchJson('/api/db-editor/sheet', { method:'POST', body: JSON.stringify({ school:selectedSchoolId(), sheet:sheet, values:readDbGridValues() }) })
      .then(function(j){ dbMsg('Saved '+j.rows+' row(s).'); setMsgSafe('Redis sheet saved.','ok'); })
      .catch(function(e){ dbMsg('Could not save sheet: '+clean(e.message || e),'err'); });
  }

  function enhanceCommunicationCard(){
    var card = by('gaRedisEmailCommCardV010'); if (!card || by('gaRedisCommV015')) return;
    var box = document.createElement('div');
    box.id = 'gaRedisCommV015';
    box.innerHTML = '<div class="toolbar" style="margin-top:10px"><button class="btn" type="button" data-action="redis-comm-preview-v015">Preview Published Email List</button><button class="btn primary" type="button" data-action="redis-comm-send-v015">Email Published Schedules</button><span id="gaRedisCommStatusV015" class="muted"></span></div><div id="gaRedisCommPreviewV015" class="muted" style="margin-top:8px"></div>';
    card.appendChild(box);
  }
  function commMsg(msg,type){ var el = by('gaRedisCommStatusV015') || by('gaRedisCommMsgV010'); if (el) el.textContent = msg || ''; if (type === 'err' || type === 'ok' || type === 'warn') setMsgSafe(msg,type); }
  function previewComm(){
    commMsg('Loading published schedule email list...','warn');
    fetchJson('/api/communication/published-candidates?'+new URLSearchParams({ school:selectedSchoolId() }).toString())
      .then(function(j){ var list = by('gaRedisCommPreviewV015'); var rows = j.candidates || []; if (list) list.innerHTML = rows.length ? '<strong>'+rows.length+' eligible staff email(s):</strong><br>'+rows.slice(0,50).map(function(c){ return esc(c.staff)+' &lt;'+esc(c.email)+'&gt;'; }).join('<br>') + (rows.length>50?'<br>...':'') : 'No active staff with email addresses and published schedule data were found.'; commMsg('Loaded '+rows.length+' candidate(s).','ok'); })
      .catch(function(e){ commMsg('Could not load email list: '+clean(e.message || e),'err'); });
  }
  function sendComm(){
    if (!confirm('Email the published schedule to all active staff with an email address?')) return;
    var from = (by('commEmailFromNameV010') && by('commEmailFromNameV010').value) || 'Support Schedules Schedule Update';
    commMsg('Sending published schedule emails...','warn');
    fetchJson('/api/communication/send-published', { method:'POST', body: JSON.stringify({ school:selectedSchoolId(), fromName:from }) })
      .then(function(j){ commMsg(j.message || ('Sent: '+j.sent+', skipped: '+j.skipped+', failed: '+j.failed+'.'),'ok'); previewComm(); })
      .catch(function(e){ commMsg('Could not send published schedule emails: '+clean(e.message || e),'err'); });
  }

  function installStyles(){
    if (by('gaRedisV015Styles')) return;
    var st = document.createElement('style'); st.id='gaRedisV015Styles';
    st.textContent = '.historyRegularBtn.active,.starBtn.active{background:#fde68a!important;border-color:#f59e0b!important;color:#78350f!important}.directDbBtnV015,.btn.danger.directDbBtnV015{background:#dc2626!important;border-color:#b91c1c!important;color:#fff!important}.gaRedisDbBackdropV015{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9998}.gaRedisDbPanelV015{position:fixed;z-index:9999;inset:4vh 3vw;background:#fff;border-radius:18px;border:1px solid #dbe3ef;box-shadow:0 20px 60px rgba(15,23,42,.22);padding:16px;display:flex;flex-direction:column;gap:10px}.gaRedisDbGridV015{flex:1;min-height:300px;max-height:70vh;overflow:auto;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc}.gaRedisDbTableV015{border-collapse:collapse;font-size:12px;background:#fff}.gaRedisDbTableV015 th{position:sticky;left:0;background:#f1f5f9;z-index:2;border:1px solid #e2e8f0;padding:4px 6px;color:#64748b}.gaRedisDbTableV015 td{border:1px solid #e2e8f0;padding:0}.gaRedisDbTableV015 input{width:160px;min-width:160px;border:0!important;border-radius:0!important;padding:5px 7px!important;font-size:12px!important;background:#fff!important}.gaRedisDbTableV015 tr:first-child input{font-weight:800;background:#f8fafc!important}#attendanceManager #adminAttendanceEntryV5398{margin-top:0!important;margin-bottom:12px!important}.attendanceTools{margin-top:8px!important}';
    document.head.appendChild(st);
  }

  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('[data-action]'); if (!t) return;
    var a = t.getAttribute('data-action');
    if (a === 'redis-db-open-v015') { e.preventDefault(); openDbEditor(); return; }
    if (a === 'redis-db-close-v015') { e.preventDefault(); closeDbEditor(); return; }
    if (a === 'redis-db-load-sheet-v015') { e.preventDefault(); loadDbSheet(); return; }
    if (a === 'redis-db-add-row-v015') { e.preventDefault(); addDbRow(); return; }
    if (a === 'redis-db-save-sheet-v015') { e.preventDefault(); saveDbSheet(); return; }
    if (a === 'redis-comm-preview-v015') { e.preventDefault(); previewComm(); return; }
    if (a === 'redis-comm-send-v015') { e.preventDefault(); sendComm(); return; }
  }, true);

  document.addEventListener('change', function(e){
    var t = e && e.target; if (!t) return;
    if (t.id === 'attendanceMonthSelect') setTimeout(tidyAttendanceManager, 40);
    if (t.id === 'gaRedisDbSheetSelectV015') setTimeout(loadDbSheet, 0);
  }, true);

  function periodic(){
    installStyles();
    removeEmailPlaceholder();
    tidyAttendanceManager();
    cleanSystemAdminLanguage();
    ensureDbEditor();
    enhanceCommunicationCard();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', periodic); else periodic();
  [200,700,1500,3000].forEach(function(ms){ setTimeout(periodic, ms); });
  try { if (typeof window.registerNavigationAfterHookV5_ === 'function') window.registerNavigationAfterHookV5_(function(page){ setTimeout(periodic,150); if (page === 'history') setTimeout(loadScheduleHistoryV015, 250); }, 'redisV015ParityPatches'); } catch(e) {}
})();

/* ===== END ga-redis-v015-ui-patches.js ===== */

/* ===== BEGIN ga-redis-v05418bv-share-schedules-push.js ===== */
(function(){
  if (window.__gaRedisV05418BQUiPatches) return;
  window.__gaRedisV05418BQUiPatches = true;

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c; }); }
  function msg(t, kind){ try { if (typeof setMsg === 'function') setMsg(t || '', kind || 'ok'); } catch(e) {} }
  function selectedSchoolId(){
    try { if (typeof selectedSchoolIdV5312 === 'function') { var s = clean(selectedSchoolIdV5312()); if (s) return s; } } catch(e) {}
    try { var ctx = window.campusContextV5253 || campusContextV5253 || {}; var s2 = clean(ctx.selectedCampusId || (ctx.currentCampus && (ctx.currentCampus.campusId || ctx.currentCampus.id)) || ''); if (s2) return s2; } catch(e2) {}
    try { var sel = by('campusSelector'); var s3 = clean(sel && sel.value); if (s3) return s3; } catch(e3) {}
    return '';
  }
  function fetchJson(url, opts){
    opts = opts || {};
    opts.credentials = opts.credentials || 'same-origin';
    if (opts.body && !opts.headers) opts.headers = { 'Content-Type':'application/json' };
    return fetch(url, opts).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) { var err = new Error((j && (j.error || j.message)) || ('HTTP '+r.status)); err.payload = j; throw err; } return j; }); });
  }
  function currentMode(){ var checked = document.querySelector('input[name="redisShareModeV018"]:checked'); return (checked && checked.value === 'changed') ? 'changed' : 'all'; }
  var shareData = null;
  var promptState = null;
  var promptTimer = null;
  var shareEmailStatusRows = [];
  var shareAccessRows = [];
  var shareCurrentHash = '';
  var shareCurrentPublishedAt = '';
  function snoozeKey(hash){ return 'gaSharePillSnoozedV05418S:' + selectedSchoolId() + ':' + clean(hash || ''); }
  function isLocallySnoozed(hash){ try { return !!hash && localStorage.getItem(snoozeKey(hash)) === '1'; } catch(e) { return false; } }
  function rememberLocalSnooze(hash){ try { if (hash) localStorage.setItem(snoozeKey(hash), '1'); } catch(e) {} }

  function installStyles(){
    if (by('gaRedisV018Styles')) return;
    var st = document.createElement('style'); st.id = 'gaRedisV018Styles';
    st.textContent = ''
      + '.topActions .shareSchedulesPillV686m26{display:none;align-items:center;gap:6px;border:1px solid #86efac!important;background:#dcfce7!important;color:#166534!important;border-radius:9px!important;padding:7px 10px!important;min-height:auto!important;font-size:12px!important;font-weight:700!important;line-height:normal!important;box-shadow:0 3px 10px rgba(22,101,52,.14)!important;white-space:nowrap;cursor:pointer;position:relative;z-index:12}'
      + '.topActions .shareSchedulesPillV686m26.active{display:inline-flex!important}'
      + '.topActions .shareSchedulesPillV686m26 .shareMainV018{cursor:pointer!important;display:inline-flex;align-items:center;gap:5px}'
      + '.topActions .shareSchedulesPillV686m26 .shareX{border:0!important;background:transparent!important;color:#166534!important;font-size:13px!important;font-weight:900!important;cursor:pointer;border-radius:999px!important;width:18px!important;height:18px!important;padding:0!important;box-shadow:none!important;line-height:1}'
      + '#redisShareSchedulesModalV018{display:none;position:fixed;inset:0;background:rgba(15,23,42,.42);z-index:99999;align-items:center;justify-content:center;padding:18px}'
      + '#redisShareSchedulesModalV018.active{display:flex!important}'
      + '#redisShareSchedulesModalV018 .sharePanelV018{width:min(980px,96vw);max-height:92vh;overflow:auto;background:white;border-radius:20px;box-shadow:0 24px 60px rgba(15,23,42,.26);border:1px solid #e5e7eb;padding:16px}'
      + '.shareHeadV018{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #e5e7eb;padding-bottom:10px;margin-bottom:12px}'
      + '.shareHeadV018 h2{margin:0;font-size:18px}.shareHeadV018 .xBtnV018{border:0;background:#f8fafc;border-radius:999px;width:30px;height:30px;cursor:pointer;font-weight:900}'
      + '.shareModeGridV018{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.shareModeCardV018{border:1px solid #e5e7eb;border-radius:14px;padding:10px;background:#f8fafc;cursor:pointer}.shareModeCardV018.active{border-color:#2563eb;background:#eff6ff}'
      + '.shareStaffListV018{border:1px solid #e5e7eb;border-radius:14px;max-height:42vh;overflow:auto;margin-top:8px}.shareStaffRowV018{display:grid;grid-template-columns:28px 1.05fr 1.25fr;gap:10px;align-items:start;padding:10px 12px;border-bottom:1px solid #f1f5f9}.shareStaffRowV018:last-child{border-bottom:0}.shareStaffRowV018.disabled{opacity:.62;background:#f8fafc}.shareBadgeV018{display:inline-flex;align-items:center;border-radius:999px;font-size:11px;padding:2px 7px;font-weight:800;margin-left:6px}.shareBadgeChangedV018{background:#fef3c7;color:#92400e}.shareBadgeAllV018{background:#dcfce7;color:#166534}.shareSmallV018{font-size:12px;color:#64748b}.shareSummaryV018{font-size:12px;color:#334155;white-space:pre-wrap}.shareModeNoteV018{font-size:12px;color:#475569;line-height:1.4}.shareStatusV018{font-size:12px;color:#475569;margin-top:8px;white-space:pre-wrap}.shareToolbarV018{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px}.shareActionsV018{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:12px;flex-wrap:wrap}.shareSendPreferredV018{background:#dcfce7!important;border-color:#86efac!important;color:#166534!important;font-weight:800!important}.sharePrefTagV018{display:inline-block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:#64748b;margin-left:6px}'
      + '#redisShareProgressModalV05418U{display:none;position:fixed;inset:0;background:rgba(15,23,42,.42);z-index:100000;align-items:center;justify-content:center;padding:18px}#redisShareProgressModalV05418U.active{display:flex!important}.shareProgressPanelV05418U{width:min(520px,94vw);background:#fff;border:1px solid #e5e7eb;border-radius:20px;box-shadow:0 24px 60px rgba(15,23,42,.26);padding:22px;text-align:center}.shareProgressSpinnerV05418U{width:38px;height:38px;border-radius:999px;border:4px solid #dbeafe;border-top-color:#2563eb;margin:4px auto 14px;animation:shareSpinV05418U .9s linear infinite}@keyframes shareSpinV05418U{to{transform:rotate(360deg)}}.shareProgressTitleV05418U{font-size:20px;font-weight:900;margin:0 0 8px;color:#0f172a}.shareProgressTextV05418U{font-size:14px;color:#475569;line-height:1.45;white-space:pre-wrap}.shareProgressActionsV05418U{margin-top:16px;display:flex;justify-content:center;gap:8px}'
      + '#redisShareSchedulesModalV017{display:none!important}';
    document.head.appendChild(st);
  }

  function ensureSharePill(){
    var toolbar = document.querySelector('.topActions') || document.querySelector('.portalTopActions') || document.querySelector('header .toolbar');
    if (!toolbar) return null;
    var pill = by('shareSchedulesPillV686m26') || by('shareSchedulesPillRedisV017') || by('shareSchedulesPillRedisV018');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'shareSchedulesPillV686m26';
      pill.className = 'shareSchedulesPillV686m26';
      var pub = by('publishScheduleBtn') || document.querySelector('[data-action="publish"]') || document.querySelector('[data-action="publish-schedule"]');
      if (pub && pub.parentNode) pub.parentNode.insertBefore(pill, pub.nextSibling); else toolbar.appendChild(pill);
    }
    pill.id = 'shareSchedulesPillV686m26';
    try { pill.classList.remove('btn'); pill.style.display = ''; } catch(e) {}
    pill.innerHTML = '<span class="shareMainV018" data-redis-v018-action="share-open">Share Schedules</span><button type="button" class="shareX" title="Hide until schedule is republished" data-redis-v018-action="share-dismiss">×</button>';
    return pill;
  }

  function refreshSharePill(){
    installStyles();
    var pill = ensureSharePill();
    if (!pill) return;
    var school = selectedSchoolId();
    if (!school) { pill.classList.remove('active'); return; }
    fetchJson('/api/communication/prompt-state-v018?' + new URLSearchParams({ school: school }).toString())
      .then(function(j){
        promptState = j || {};
        var hash = clean(j && (j.publishInstance || j.publishedInstance || j.hash || j.publishedHash || j.scheduleHash));
        var localSnoozed = isLocallySnoozed(hash);
        pill.classList.toggle('active', !!j.show && !localSnoozed);
        if (hash) { pill.setAttribute('data-published-hash', hash); pill.setAttribute('data-publish-instance', hash); }
        var c = j.counts || {};
        pill.title = (!!j.show && !localSnoozed) ? ('Share published schedules. All eligible: ' + (c.allEligible || 0) + '; changed eligible: ' + (c.changedEligible || 0) + '.') : (localSnoozed ? 'Snoozed for this published schedule.' : (j.reason || 'No schedule communication prompt.'));
      })
      .catch(function(){ pill.classList.remove('active'); });
  }

  function ensureModal(){
    var m = by('redisShareSchedulesModalV018');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'redisShareSchedulesModalV018';
    m.innerHTML = '<div class="sharePanelV018">'
      + '<div class="shareHeadV018"><div><h2>Share Schedules</h2><div id="shareIntroV018" class="shareSmallV018">Loading schedule communication options...</div></div><button type="button" class="xBtnV018" data-redis-v018-action="share-close" aria-label="Close">×</button></div>'
      + '<div id="shareModeWrapV018" class="shareModeGridV018">'
      + '<label class="shareModeCardV018" data-share-mode-card-v018="all"><input type="radio" name="redisShareModeV018" value="all" style="width:auto"> <strong>All staff</strong><div class="shareModeNoteV018">Notify each selected active staff member with their current published schedule and Staff Portal link, by email and/or push notification.</div></label>'
      + '<label class="shareModeCardV018" data-share-mode-card-v018="changed"><input type="radio" name="redisShareModeV018" value="changed" style="width:auto"> <strong>Changed staff only</strong><div class="shareModeNoteV018">Notify only selected staff whose schedule changed since the last completed communication, by email and/or push notification.</div></label>'
      + '</div>'
      + '<div class="shareToolbarV018"><div><button type="button" class="btn small" data-redis-v018-action="share-select-all">Select All</button> <button type="button" class="btn small" data-redis-v018-action="share-select-none">Select None</button> <button type="button" class="btn small" data-redis-v018-action="share-select-unopened">Select Not Opened</button> <button type="button" class="btn small" data-redis-v018-action="share-select-unviewed">Select Not Viewed Portal</button></div><div id="shareCountsV018" class="shareSmallV018"></div></div>'
      + '<div id="shareStaffListV018" class="shareStaffListV018"><div class="shareSmallV018" style="padding:12px">Loading staff...</div></div>'
      + '<div class="shareActionsV018"><button type="button" class="btn" data-redis-v018-action="share-close">Cancel</button><button type="button" class="btn primary" data-redis-v018-action="share-send-push">Send Push Notification</button><button type="button" class="btn primary" data-redis-v018-action="share-send">Send Emails</button><button type="button" class="btn shareSendPreferredV018" data-redis-v018-action="share-send-preferred">Send via Preferred Communication</button></div>'
      + '<div id="shareStatusV018" class="shareStatusV018"></div>'
      + '</div>';
    document.body.appendChild(m);
    return m;
  }

  function normNameV018(v){ return clean(v).toLowerCase().replace(/\s+/g,' '); }
  function splitEmailsV018(v){ return clean(v).toLowerCase().split(/[;,\s]+/).filter(function(x){ return /@/.test(x); }); }
  function latestStatusForCandidateV018(c){
    c = c || {}; var staffKey = normNameV018(c.staff || c.name || c.key || ''); var emails = splitEmailsV018(c.notificationEmail || c.email || ''); var best = null;
    (shareEmailStatusRows || []).forEach(function(r){
      var isCurrent = !!(shareCurrentHash && clean(r.scheduleHash || r.hash || '') === shareCurrentHash) || !!(shareCurrentPublishedAt && clean(r.publishedAt || '') === shareCurrentPublishedAt) || !!(shareData && shareData.publishInstance && clean(r.publishInstance || '') === clean(shareData.publishInstance));
      if (!isCurrent) return;
      var staffMatch = staffKey && normNameV018(r.staff || '') === staffKey;
      var emailMatch = emails.indexOf(clean(r.email || '').toLowerCase()) >= 0;
      if (!staffMatch && !emailMatch) return;
      if (!best || clean(r.updatedAt || r.sentAt).localeCompare(clean(best.updatedAt || best.sentAt)) > 0) best = r;
    });
    return best;
  }
  function accessForCandidateV018(c){
    c = c || {}; var staffKey = normNameV018(c.staff || c.name || c.key || ''); var rows = shareAccessRows || [];
    for (var i=0;i<rows.length;i++){ if (normNameV018(rows[i].staff || rows[i].name || '') === staffKey) return rows[i]; }
    return null;
  }
  function hydrateShareStatusFlagsV018(){
    var lists = [((shareData && shareData.all) || []), ((shareData && shareData.changed) || [])];
    lists.forEach(function(list){ list.forEach(function(c){ var st = latestStatusForCandidateV018(c); var ac = accessForCandidateV018(c); c.emailCurrentSent = !!st; c.emailCurrentOpened = !!(st && (st.lastOpenedAt || st.firstOpenedAt)); c.emailCurrentFailed = !!(st && st.failedAt); c.portalViewedCurrent = !!(ac && ac.viewedAfterPublish); }); });
  }
  function selectedPool(){ if (!shareData) return []; return currentMode() === 'changed' ? (shareData.changed || []) : (shareData.all || []); }
  function renderModeCards(){ var mode = currentMode(); document.querySelectorAll('[data-share-mode-card-v018]').forEach(function(card){ card.classList.toggle('active', card.getAttribute('data-share-mode-card-v018') === mode); }); }
  function renderShareList(){
    renderModeCards();
    var list = by('shareStaffListV018'); var counts = by('shareCountsV018'); var intro = by('shareIntroV018'); if (!list) return;
    var pool = selectedPool(); var eligible = pool.filter(function(c){ return !c.skipReason; });
    if (counts && shareData) { var c = shareData.counts || {}; counts.textContent = 'All eligible: ' + (c.allEligible || 0) + ' · Changed eligible: ' + (c.changedEligible || 0) + ' · Showing: ' + eligible.length; }
    if (intro && shareData) intro.textContent = currentMode() === 'changed' ? 'Changed-staff mode compares this published schedule to the last successfully communicated schedule.' : 'All-staff mode notifies each selected staff member with their current published schedule and Staff Portal link, by email and/or push notification.';
    if (!pool.length) { list.innerHTML = '<div class="shareSmallV018" style="padding:12px">No staff are available for this mode.</div>'; return; }
    list.innerHTML = pool.map(function(c){
      c = c || {}; var k = esc(c.key || c.staff || ''); var disabled = c.skipReason ? ' disabled' : ''; var checked = (!c.skipReason && ((currentMode()==='changed') ? c.selectedChanged !== false : c.selectedAll !== false)) ? ' checked' : ''; var summary = currentMode()==='changed' && c.changeSummary && c.changeSummary.length ? c.changeSummary.slice(0,4).join('\n') : (c.schedulePreview || 'Current published schedule will be included.');
      var showBadges = Number((shareData && shareData.scheduleVersion) || 0) >= 2;
      var changeBadge = showBadges ? (c.changed?'<span class="shareBadgeV018 shareBadgeChangedV018">Changed</span>':'<span class="shareBadgeV018 shareBadgeAllV018">No change</span>') : '';
      var followBadges = (showBadges && !c.skipReason ? ((c.emailCurrentSent ? (c.emailCurrentOpened ? '<span class="shareBadgeV018 shareBadgeAllV018">Email opened</span>' : '<span class="shareBadgeV018 shareBadgeChangedV018">Not opened</span>') : '') + (c.portalViewedCurrent ? '<span class="shareBadgeV018 shareBadgeAllV018">Portal viewed</span>' : '<span class="shareBadgeV018 shareBadgeChangedV018">Portal not viewed</span>')) : '');
      // Subtle communication-preference tag -- plain, quiet text rather than a colored badge,
      // since this is informational context rather than a status worth calling attention to.
      var prefLabel = c.preference === 'both' ? 'Email + Push' : c.preference === 'push' ? 'Push' : 'Email';
      var prefTag = '<span class="sharePrefTagV018">' + prefLabel + '</span>';
      // App paired now shown as plain text alongside email, matching how the email address
      // itself is displayed -- not a colored pill, per direction.
      var contactLine = [c.notificationEmail || c.email || '', c.hasPushDevice ? 'Paired' : ''].filter(Boolean).join(' · ') || c.skipReason || '';
      return '<label class="shareStaffRowV018'+disabled+'"><input type="checkbox" class="shareCheckV018" value="'+k+'" '+checked+(c.skipReason?' disabled':'')+' style="width:auto"><div><strong>'+esc(c.staff || '')+'</strong>'+prefTag+changeBadge+followBadges+'<div class="shareSmallV018">'+esc(contactLine)+'</div></div><div class="shareSummaryV018">'+esc(c.skipReason || summary)+'</div></label>';
    }).join('');
  }

  function openShareModal(){
    var school = selectedSchoolId(); var m = ensureModal(); m.classList.add('active'); var status = by('shareStatusV018'); if (status) status.textContent = ''; var intro = by('shareIntroV018'); if (intro) intro.textContent = 'Loading schedule communication options...';
    Promise.all([
      fetchJson('/api/communication/candidates-v018?' + new URLSearchParams({ school: school }).toString()),
      fetchJson('/api/communication/brevo-staff-email-status-v05418u?' + new URLSearchParams({ school: school, limit: '500' }).toString()).catch(function(){ return { rows: [] }; }),
      fetchJson('/api/v027/staff-portal/access-summary?' + new URLSearchParams({ school: school }).toString()).catch(function(){ return { staff: [] }; })
    ])
      .then(function(arr){ var j = arr[0] || {}; shareData = j; shareEmailStatusRows = (arr[1] && arr[1].rows) || []; shareAccessRows = (arr[2] && arr[2].staff) || []; shareCurrentHash = clean(j.hash || (arr[1] && arr[1].currentScheduleHash) || ''); shareCurrentPublishedAt = clean(j.publishedAt || (arr[1] && arr[1].currentPublishedAt) || ''); hydrateShareStatusFlagsV018(); var version = Number(j.scheduleVersion || (arr[1] && arr[1].currentDailyVersion) || 0) || 0; var changedEligible = Number(j.counts && j.counts.changedEligible || 0) || 0; var mode = (version >= 2 && changedEligible > 0 && j.recommendedMode === 'changed') ? 'changed' : 'all'; var radio = document.querySelector('input[name="redisShareModeV018"][value="'+mode+'"]') || document.querySelector('input[name="redisShareModeV018"][value="all"]'); if (radio) radio.checked = true; renderShareList(); })
      .catch(function(e){ shareData = null; if (intro) intro.textContent = 'Could not load communication options: ' + clean(e.message || e); if (by('shareStaffListV018')) by('shareStaffListV018').innerHTML = ''; });
  }
  function closeShareModal(){ var m = by('redisShareSchedulesModalV018'); if (m) m.classList.remove('active'); }
  function selectedStaffKeys(){ return Array.prototype.slice.call(document.querySelectorAll('.shareCheckV018:checked')).map(function(cb){ return cb.value; }).filter(Boolean); }
  // FEATURE: dedicated push-notification send, separate from "Send Selected Emails". Reads
  // each checked row's own visible staff name (the <strong> text) rather than assuming the
  // checkbox's `value` (c.key || c.staff) is guaranteed to match the display name exactly.
  function selectedStaffNamesForPush(){
    return Array.prototype.slice.call(document.querySelectorAll('.shareCheckV018:checked')).map(function(cb){
      var row=cb.closest('.shareStaffRowV018'); var nameEl=row&&row.querySelector('strong');
      return nameEl?nameEl.textContent.trim():'';
    }).filter(Boolean);
  }
  function sendSharePush(){
    var status=by('shareStatusV018'); var names=selectedStaffNamesForPush();
    if(!names.length){ if(status)status.textContent='Select at least one staff member.'; return; }
    if(status)status.textContent='Sending push notifications...';
    fetchJson('/api/v05418y/push/send', { method:'POST', body: JSON.stringify({ school: selectedSchoolId(), staffNames: names, title: 'Schedule update', body: 'Your Support Schedules schedule has been updated. Open the app to view it.' }) })
      .then(function(j){
        if(!j.configured){ if(status)status.textContent=j.message||'Push is not configured yet.'; return; }
        var results=j.results||[];
        var sent=results.filter(function(r){return r.status==='sent';}).length;
        var noDevice=results.filter(function(r){return r.status==='no-device';}).length;
        var failed=results.filter(function(r){return r.status==='failed';}).length;
        var parts=[sent+' sent']; if(noDevice)parts.push(noDevice+' not paired'); if(failed)parts.push(failed+' failed');
        if(status)status.textContent='Push notifications: '+parts.join(', ')+'.';
      })
      .catch(function(e){ if(status)status.textContent='Could not send push: '+clean(e.message||e); });
  }
  function ensureShareProgressModalV05418U(){
    var m=by('redisShareProgressModalV05418U');
    if(!m){m=document.createElement('div');m.id='redisShareProgressModalV05418U';document.body.appendChild(m);}
    return m;
  }
  function showShareProgressV05418U(title,text,done){
    var m=ensureShareProgressModalV05418U();
    m.innerHTML='<div class="shareProgressPanelV05418U">'+(done?'':'<div class="shareProgressSpinnerV05418U" aria-hidden="true"></div>')+'<h2 class="shareProgressTitleV05418U">'+esc(title||'Sending')+'</h2><div class="shareProgressTextV05418U">'+esc(text||'')+'</div>'+(done?'<div class="shareProgressActionsV05418U"><button type="button" class="btn primary" data-redis-v018-action="share-progress-close">Close</button></div>':'')+'</div>';
    m.classList.add('active');
  }
  function closeShareProgressV05418U(){var m=by('redisShareProgressModalV05418U'); if(m)m.classList.remove('active');}
  function selectByPredicateV018(pred){
    var pool = selectedPool(); var allowed = {};
    pool.forEach(function(c){ if (!c.skipReason && pred(c || {})) allowed[clean(c.key || c.staff || '')] = true; });
    document.querySelectorAll('.shareCheckV018').forEach(function(cb){ cb.checked = !!allowed[clean(cb.value)]; });
  }
  function sendShare(){
    var status = by('shareStatusV018'); var keys = selectedStaffKeys(); if (!keys.length) { if (status) status.textContent = 'Select at least one staff member.'; return; }
    var mode = currentMode();
    closeShareModal();
    showShareProgressV05418U('Sending schedule emails','Sending '+keys.length+' selected staff notification'+(keys.length===1?'':'s')+'...',false);
    fetchJson('/api/communication/send-v018', { method:'POST', body: JSON.stringify({ school: selectedSchoolId(), mode: mode, staffKeys: keys }) })
      .then(function(j){
        var text=(j.message || 'Schedule communication complete.') + (j.recordedAsCommunicated ? '\nThis published schedule has been marked communicated.' : '');
        showShareProgressV05418U('Schedule emails sent', text, true);
        if (j.recordedAsCommunicated) { var pill = by('shareSchedulesPillV686m26') || document.querySelector('.shareSchedulesPillV686m26'); if (pill) pill.classList.remove('active'); }
        try { window.dispatchEvent(new CustomEvent('supportSchedulesShareCommunicationSentV05418U',{detail:j||{}})); } catch(e) {}
        try { if (typeof window.loadCommunicationManagerV05418R === 'function') setTimeout(window.loadCommunicationManagerV05418R,250); } catch(e2) {}
        [100,600,1400,3000].forEach(function(ms){ setTimeout(refreshSharePill,ms); });
      })
      .catch(function(e){ showShareProgressV05418U('Schedule emails were not sent','Could not send schedule communication: '+clean(e.message || e),true); });
  }
  // Routes each selected staff member to email, push, or both based on THEIR OWN
  // preference (set via their Staff Portal gear settings) rather than sending everyone the
  // same channel -- see /api/communication/send-preferred-v018 on the server for the actual
  // per-person routing logic.
  function sendSharePreferred(){
    var status = by('shareStatusV018'); var keys = selectedStaffKeys(); if (!keys.length) { if (status) status.textContent = 'Select at least one staff member.'; return; }
    var mode = currentMode();
    closeShareModal();
    showShareProgressV05418U('Sending via preferred communication','Sending '+keys.length+' selected staff notification'+(keys.length===1?'':'s')+' by their preferred method...',false);
    fetchJson('/api/communication/send-preferred-v018', { method:'POST', body: JSON.stringify({ school: selectedSchoolId(), mode: mode, staffKeys: keys }) })
      .then(function(j){
        var parts=[];
        if (j.email) parts.push('Email: '+j.email.sent+' sent'+(j.email.skipped?', '+j.email.skipped+' skipped':'')+(j.email.failed?', '+j.email.failed+' failed':''));
        if (j.push) parts.push('Push: '+j.push.sent+' sent'+(j.push.notPaired?', '+j.push.notPaired+' not paired':'')+(j.push.failed?', '+j.push.failed+' failed':''));
        var text = parts.join('\n') + (j.recordedAsCommunicated ? '\nThis published schedule has been marked communicated.' : '');
        showShareProgressV05418U('Sent via preferred communication', text, true);
        if (j.recordedAsCommunicated) { var pill = by('shareSchedulesPillV686m26') || document.querySelector('.shareSchedulesPillV686m26'); if (pill) pill.classList.remove('active'); }
        try { window.dispatchEvent(new CustomEvent('supportSchedulesShareCommunicationSentV05418U',{detail:j||{}})); } catch(e) {}
        try { if (typeof window.loadCommunicationManagerV05418R === 'function') setTimeout(window.loadCommunicationManagerV05418R,250); } catch(e2) {}
        [100,600,1400,3000].forEach(function(ms){ setTimeout(refreshSharePill,ms); });
      })
      .catch(function(e){ showShareProgressV05418U('Could not send','Could not send via preferred communication: '+clean(e.message || e),true); });
  }
  function hideSharePillNow(hash){ var pill = by('shareSchedulesPillV686m26') || document.querySelector('.shareSchedulesPillV686m26'); if (pill) { pill.classList.remove('active'); pill.setAttribute('data-snoozed','1'); } if (hash) rememberLocalSnooze(hash); }
  function dismissPrompt(){
    var pill = by('shareSchedulesPillV686m26') || document.querySelector('.shareSchedulesPillV686m26');
    var hash = clean((promptState && (promptState.publishInstance || promptState.publishedInstance || promptState.hash || promptState.publishedHash || promptState.scheduleHash)) || (pill && (pill.getAttribute('data-publish-instance') || pill.getAttribute('data-published-hash'))) || '');
    hideSharePillNow(hash);
    fetchJson('/api/communication/dismiss-v018', { method:'POST', body: JSON.stringify({ school: selectedSchoolId(), hash: hash }) })
      .then(function(j){ var h = clean((j && (j.dismissedHash || j.hash || j.publishedHash)) || hash); hideSharePillNow(h); })
      .catch(function(e){ msg('Could not persist Share Schedules snooze: ' + clean(e.message || e), 'err'); hideSharePillNow(hash); });
  }

  window.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('[data-redis-v018-action]');
    if (t) {
      var act = t.getAttribute('data-redis-v018-action'); e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (act === 'share-open') openShareModal(); else if (act === 'share-close') closeShareModal(); else if (act === 'share-progress-close') closeShareProgressV05418U(); else if (act === 'share-dismiss') dismissPrompt(); else if (act === 'share-send') sendShare(); else if (act === 'share-send-push') sendSharePush(); else if (act === 'share-send-preferred') sendSharePreferred(); else if (act === 'share-select-all') document.querySelectorAll('.shareCheckV018:not(:disabled)').forEach(function(cb){ cb.checked = true; }); else if (act === 'share-select-none') document.querySelectorAll('.shareCheckV018:not(:disabled)').forEach(function(cb){ cb.checked = false; }); else if (act === 'share-select-unopened') selectByPredicateV018(function(c){ return c.emailCurrentSent && !c.emailCurrentOpened; }); else if (act === 'share-select-unviewed') selectByPredicateV018(function(c){ return !c.portalViewedCurrent; });
      return false;
    }
  }, true);
  window.addEventListener('change', function(e){ if (e.target && e.target.name === 'redisShareModeV018') renderShareList(); }, true);
  function periodic(){ installStyles(); ensureSharePill(); if (promptTimer) clearTimeout(promptTimer); promptTimer = setTimeout(refreshSharePill, 60); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', periodic); else periodic();
  [250, 750, 1400, 2600, 5000, 9000].forEach(function(ms){ setTimeout(periodic, ms); });
  try { if (typeof window.registerNavigationAfterHookV5_ === 'function') window.registerNavigationAfterHookV5_(function(){ setTimeout(periodic, 150); }, 'redisV018CommunicationWorkflow'); } catch(e) {}
  try { var basePublish = window.publishSchedule || (typeof publishSchedule === 'function' ? publishSchedule : null); if (basePublish && !basePublish.__redisV018Wrapped) { var wrapped = function(){ var ret = basePublish.apply(this, arguments); [150, 350, 700, 1200, 2200, 4200, 8000].forEach(function(ms){ setTimeout(refreshSharePill, ms); }); try{ if(ret && typeof ret.then==='function') ret.then(function(){[80,250,700,1500].forEach(function(ms){setTimeout(refreshSharePill,ms);});}); }catch(e){} return ret; }; wrapped.__redisV018Wrapped = true; window.publishSchedule = wrapped; try { publishSchedule = wrapped; } catch(e2) {} } } catch(e3) {}
})();

;(function(){
  if (window.__gaRedisV05418BQHistoryPatch) return;
  window.__gaRedisV05418BQHistoryPatch = true;
  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c; }); }
  function msg(t, kind){ try { if (typeof setMsg === 'function') setMsg(t || '', kind || 'ok'); } catch(e) {} }
  function selectedSchoolId(){
    try { if (typeof selectedSchoolIdV5312 === 'function') { var s = clean(selectedSchoolIdV5312()); if (s) return s; } } catch(e) {}
    try { var ctx = window.campusContextV5253 || campusContextV5253 || {}; var s2 = clean(ctx.selectedCampusId || (ctx.currentCampus && (ctx.currentCampus.campusId || ctx.currentCampus.id)) || ''); if (s2) return s2; } catch(e2) {}
    try { var sel = by('campusSelector'); var s3 = clean(sel && sel.value); if (s3) return s3; } catch(e3) {}
    return '';
  }
  function fetchJson(url, opts){ opts = opts || {}; opts.credentials = opts.credentials || 'same-origin'; if (opts.body && !opts.headers) opts.headers = { 'Content-Type':'application/json' }; return fetch(url, opts).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) { var err = new Error((j && (j.error || j.message)) || ('HTTP '+r.status)); err.payload = j; throw err; } return j; }); }); }
  function fmt(v){ try { if (typeof formatHistoryStamp === 'function') return formatHistoryStamp(v || ''); } catch(e) {} return clean(v); }
  var rows = [];
  var favoritesOnly = false;
  var loading = false;
  function normalize(list){ return (Array.isArray(list) ? list : []).map(function(r){ r = r || {}; return Object.assign({}, r, { row: Number(r.row || r.rowNumber || 0) || 0, id: clean(r.id || r.historyId || r.key || r.hash || ''), starred: !!r.starred, regularLocked: !!(r.regularLocked || r.locked) }); }).filter(function(r){ return r.id; }); }
  function setRows(list){ rows = normalize(list); try { window.historyData = rows; historyData = rows; window.historyFavoritesOnly = favoritesOnly; historyFavoritesOnly = favoritesOnly; historySnapshotCache = {}; historyPage = 1; } catch(e) {} }
  function visibleRows(){ return favoritesOnly ? rows.filter(function(r){ return r.starred; }) : rows; }
  function render(){
    var box = by('historyTable'); if (!box) return;
    var favBtn = by('historyFavoritesToggle'); if (favBtn) favBtn.textContent = 'Favorites only: ' + (favoritesOnly ? 'On' : 'Off');
    var list = visibleRows();
    if (!list.length) { box.innerHTML = '<p class="muted">' + (favoritesOnly ? 'No favorite schedules loaded yet.' : 'No published schedules saved yet.') + '</p><div id="historyViewBox" class="card" style="margin-top:10px;display:none"></div>'; return; }
    var body = list.map(function(r){
      var id = esc(r.id), row = Number(r.row || 0) || 0;
      return '<tr data-v018-history-row="'+row+'" data-v018-history-id="'+id+'"><td class="historyDate">'+esc(fmt(r.publishedAt || ''))+'</td><td><strong>'+esc(r.summary || 'Published schedule')+'</strong><div class="muted">'+esc(r.id || '')+'</div></td><td class="notesCell"><textarea data-history-note="'+id+'">'+esc(r.notes || '')+'</textarea></td><td class="historyActionsCell"><div class="historyActions"><button type="button" class="starBtn historyStarV018 '+(r.starred?'active':'')+'" title="Favorite" aria-pressed="'+(r.starred?'true':'false')+'" data-v018-history-star-row="'+row+'" data-v018-history-id="'+id+'">★</button><button type="button" class="btn small" data-action="history-view" data-history-id="'+id+'">View</button><button type="button" class="btn small" title="Edit in Customize Schedule" data-action="history-edit-custom" data-history-id="'+id+'"><i class="fa-solid fa-pencil" aria-hidden="true"></i></button><button type="button" class="btn small publishBtn historyPublishBtn" style="display:inline-flex" data-action="history-restore" data-history-id="'+id+'">Publish</button><button type="button" class="historyRegularBtn historyLockV018 '+(r.regularLocked?'active':'')+'" title="'+(r.regularLocked?'Unlock regular schedule':'Lock as regular schedule')+'" aria-pressed="'+(r.regularLocked?'true':'false')+'" data-v018-history-lock-row="'+row+'" data-v018-history-id="'+id+'"><i class="fa-solid fa-lock" aria-hidden="true"></i></button><button type="button" class="btn small" data-action="history-save-note" data-history-id="'+id+'">Save Notes</button><button type="button" class="iconBtn danger historyDeleteBtn historyDeleteIconBtnV5329" title="Delete historical schedule" aria-label="Delete historical schedule" data-action="history-delete" data-history-id="'+id+'">🗑</button></div></td></tr>';
    }).join('');
    box.innerHTML = '<table class="historyTable"><thead><tr><th>Published / Saved</th><th>Summary</th><th>Notes</th><th class="historyActionsCell">Actions</th></tr></thead><tbody>'+body+'</tbody></table><div class="muted" style="margin-top:8px">Showing '+esc(list.length)+' historical schedule'+(list.length===1?'':'s')+'.</div><div id="historyViewBox" class="card" style="margin-top:10px;display:none"></div>';
  }
  function load(){
    if (loading) return;
    var school = selectedSchoolId(); if (!school) { msg('Choose a school before loading schedule history.','warn'); return; }
    loading = true; msg('Loading schedule history...','warn');
    fetchJson('/api/history/list-v017?' + new URLSearchParams({ school: school }).toString()).then(function(j){ setRows(j.rows || []); render(); msg('Schedule history loaded.','ok'); }).catch(function(e){ msg('Could not load schedule history: ' + clean(e.message || e), 'err'); }).finally(function(){ loading = false; });
  }
  function findRow(row, id){ row = Number(row || 0) || 0; id = clean(id); return rows.filter(function(r){ return (row && Number(r.row) === row) || (id && r.id === id); })[0] || null; }
  function setStar(row, id, starred){ var school = selectedSchoolId(); if (!school) return; msg(starred ? 'Marking favorite...' : 'Removing favorite...', 'warn'); fetchJson('/api/history/star-row-v017', { method:'POST', body: JSON.stringify({ school: school, row: Number(row), id: id || '', starred: !!starred }) }).then(function(j){ setRows(j.rows || []); render(); msg(starred ? 'Favorite saved.' : 'Favorite removed.','ok'); }).catch(function(e){ msg('Could not update favorite: ' + clean(e.message || e), 'err'); load(); }); }
  function setLock(row, id, locked){ var school = selectedSchoolId(); if (!school) return; msg(locked ? 'Locking regular schedule...' : 'Unlocking regular schedule...', 'warn'); fetchJson('/api/history/regular-lock-row-v017', { method:'POST', body: JSON.stringify({ school: school, row: Number(row), id: id || '', locked: !!locked }) }).then(function(j){ setRows(j.rows || []); render(); msg(locked ? 'Regular schedule lock saved.' : 'Regular schedule unlocked.','ok'); try { if (typeof loadRegularSchedulePage === 'function') setTimeout(loadRegularSchedulePage, 250); } catch(e) {} }).catch(function(e){ msg('Could not update regular schedule lock: ' + clean(e.message || e), 'err'); load(); }); }
  window.addEventListener('click', function(e){
    var star = e.target && e.target.closest && e.target.closest('[data-v018-history-star-row]');
    if (star) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); var sr = star.getAttribute('data-v018-history-star-row'), sid = star.getAttribute('data-v018-history-id'); var srow = findRow(sr, sid); setStar(sr, sid, !(srow && srow.starred)); return false; }
    var lock = e.target && e.target.closest && e.target.closest('[data-v018-history-lock-row]');
    if (lock) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); var lr = lock.getAttribute('data-v018-history-lock-row'), lid = lock.getAttribute('data-v018-history-id'); var lrow = findRow(lr, lid); setLock(lr, lid, !(lrow && lrow.regularLocked)); return false; }
    var da = e.target && e.target.closest && e.target.closest('[data-action]'); if (!da) return;
    var a = da.getAttribute('data-action') || '';
    if (a === 'history-load' || a === 'history-load-more') { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); load(); return false; }
    if (a === 'history-toggle-favorites') { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); favoritesOnly = !favoritesOnly; try { window.historyFavoritesOnly = favoritesOnly; historyFavoritesOnly = favoritesOnly; } catch(x) {} render(); return false; }
  }, true);
  function styles(){ if (by('gaRedisV018HistoryStyles')) return; var st = document.createElement('style'); st.id = 'gaRedisV018HistoryStyles'; st.textContent = '.historyActions .historyStarV018{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#94a3b8!important;width:30px!important;min-width:30px!important;height:32px!important;padding:0!important;font-size:18px!important}.historyActions .historyStarV018.active{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#d4a017!important}.historyActions .historyLockV018{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#94a3b8!important;width:30px!important;min-width:30px!important;height:32px!important;padding:0!important}.historyActions .historyLockV018.active{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#d4a017!important}'; document.head.appendChild(st); }
  function boot(){ styles(); if ((by('history') && by('history').classList.contains('active')) || /#history/.test(location.hash || '')) setTimeout(load, 250); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  try { if (typeof window.registerNavigationAfterHookV5_ === 'function') window.registerNavigationAfterHookV5_(function(page){ if (page === 'history') setTimeout(load, 350); }, 'redisV018HistoryStableRows'); } catch(e) {}
})();

/* ===== END ga-redis-v05418bv-share-schedules-push.js ===== */

/* ===== BEGIN ga-redis-v022-ui-patches.js ===== */
(function(){
  if (window.__gaRedisV022UiPatches) return;
  window.__gaRedisV022UiPatches = true;

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c; }); }
  function norm(v){ return String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function compact(v){ return norm(v).replace(/\s+/g,''); }
  function msg(t, kind){ try { if (typeof setMsg === 'function') setMsg(t || '', kind || 'ok'); } catch(e) {} }
  function fetchJson(url, opts){ opts = opts || {}; opts.credentials = opts.credentials || 'same-origin'; if (opts.body && !opts.headers) opts.headers = { 'Content-Type':'application/json' }; return fetch(url, opts).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) { var err = new Error((j && (j.error || j.message)) || ('HTTP '+r.status)); err.payload = j; throw err; } return j; }); }); }
  function selectedSchoolId(){
    try { if (typeof selectedSchoolIdV5312 === 'function') { var s = clean(selectedSchoolIdV5312()); if (s) return s; } } catch(e) {}
    try { var ctx = window.campusContextV5253 || campusContextV5253 || {}; var s2 = clean(ctx.selectedCampusId || (ctx.currentCampus && (ctx.currentCampus.campusId || ctx.currentCampus.id)) || ''); if (s2) return s2; } catch(e2) {}
    try { var sel = by('campusSelector'); var s3 = clean(sel && sel.value); if (s3) return s3; } catch(e3) {}
    return '';
  }

  // ===================================================================================
  // Regular Schedule: read only explicit Historical Schedule locks, render locally, and
  // save the Staff Portal display toggle through Redis so it does not remain "unsaved".
  // ===================================================================================
  var lastRegular = null;
  function formatStamp(v){ try { if (typeof formatHistoryStamp === 'function') return formatHistoryStamp(v || ''); } catch(e) {} return clean(v); }
  function itemList(views, rows){
    views = views || {}; rows = rows || [];
    var items = Array.isArray(views.items) ? views.items.slice() : [];
    if (!items.length && rows.length && Array.isArray(rows[0].rows)) items = rows[0].rows.map(function(r){ return { label:r.period || r.item || r.label, title:r.period || r.item || r.label }; });
    return items.map(function(it){ return { label: clean(it && (it.label || it.key || it.title)) || String(it || ''), title: clean(it && (it.title || it.displayName || it.label || it.key)) || String(it || '') }; }).filter(function(it){ return it.label || it.title; });
  }
  function rowMap(rows){ var m = {}; (rows || []).forEach(function(r){ r = r || {}; var k = clean(r.period || r.item || r.label || r.title); if (k) m[k] = r; }); return m; }
  function studentLabel(st){ st = st || {}; if (typeof st !== 'object') return esc(st); var name = clean(st.name || st.student || st.label || ''); var url = clean(st.url || st.dataUrl || ''); var html = url ? '<a class="studentLink" target="_blank" href="'+esc(url)+'">'+esc(name)+'</a>' : '<span class="studentLink">'+esc(name)+'</span>'; return html; }
  function cleanBreak(v){ v = clean(v); return /^(na|n\/a)$/i.test(v) ? '' : v; }
  function roomSortKey(x){ x = clean(x); var m = x.match(/^(\d+)/); return m ? ('000000'+m[1]).slice(-6)+'|'+x.toLowerCase() : 'zzzzzz|'+x.toLowerCase(); }
  function groupedStudents(students, fallback){
    students = Array.isArray(students) ? students : [];
    if (!students.length) return '';
    var groups = [];
    students.forEach(function(st){ var loc = clean((st && st.location) || fallback || ''); var key = loc || '__none__'; var g = groups.filter(function(x){ return x.key === key; })[0]; if (!g) { g = { key:key, location:loc, students:[] }; groups.push(g); } g.students.push(st); });
    groups.sort(function(a,b){ return roomSortKey(a.location).localeCompare(roomSortKey(b.location)); });
    return groups.map(function(g){ return '<div class="studentRoomGroup">'+g.students.map(studentLabel).join('<br>')+(g.location ? '<div class="muted">'+esc(g.location)+'</div>' : '')+'</div>'; }).join('');
  }
  function restHtml(events){
    return (events || []).map(function(ev){ ev = ev || {}; var type = clean(ev.type || ''); var lower = type.toLowerCase(); var kind = lower.indexOf('lunch') >= 0 ? 'Lunch' : (lower.indexOf('break') >= 0 ? 'Break' : 'Rest'); var who = ev.role === 'helperCover' ? ('Covering for '+(ev.helperCoveringFor || ev.coveringStaff || 'staff')) : (ev.role === 'cover' ? ('Covering '+(ev.staffOnBreak || 'staff')+"'s "+kind) : kind); if (ev.role === 'cover' && ev.daisyChain && ev.helperStaff) who = 'Covered by '+ev.helperStaff+'; '+who; var standalone = ev.role !== 'cover' && ev.role !== 'helperCover' && (who === 'Break' || who === 'Lunch'); var students = cleanBreak(ev.students || ''); var loc = cleanBreak(ev.location || ''); var html = '<div class="rest"><b>'+(standalone ? '<span style="background:#fff59d;padding:1px 3px;border-radius:3px">'+esc(who)+'</span>' : esc(who))+'</b>'+(ev.time ? '<br>'+esc(ev.time) : ''); if (students) html += '<br>'+esc(students); if (loc) html += '<div class="muted">'+esc(loc)+'</div>'; return html+'</div>'; }).join('');
  }
  function staffFreeText(r, views){ r = r || {}; if (r.status === 'timeBlocked') return 'Blocked'; if (r.seeLead) return 'See Lead'; return 'Support ' + clean((views && views.unassignedSupportLocation) || ''); }
  function staffCell(r, views){ r = r || {}; if (r.hideAssignmentForDesignatedRest) return restHtml(r.restEvents || []); var html = ''; if (Array.isArray(r.students) && r.students.length) html += groupedStudents(r.students, r.location); else html += '<span class="free">'+esc(staffFreeText(r, views))+'</span>'; if (Array.isArray(r.restEvents) && r.restEvents.length) html += restHtml(r.restEvents); return html; }
  function studentCell(r){ r = r || {}; var support = clean(r.support || ''); var location = clean(r.location || ''); var sNorm = support.toUpperCase(), lNorm = location.toUpperCase(); var noSupport = !support || sNorm === 'N/A' || sNorm === 'NA' || sNorm === 'NONE' || sNorm === 'NO SUPPORT NEEDED'; var noLocation = !location || lNorm === 'N/A' || lNorm === 'NA'; var hasNeed = !noSupport && !noLocation; var top = r.staff ? esc(r.staff) : (r.allowedUnstaffed ? '<span class="scheduleNoNeed">Allowed unstaffed</span>' : (hasNeed ? '<span class="scheduleNeed">Needs support - unassigned</span>' : '<span class="scheduleNoNeed">No support needed</span>')); var meta = (hasNeed ? '<div class="dashMeta">'+esc(location)+' · '+esc(support)+'</div>' : ''); return '<td>'+top+meta+'</td>'; }
  function renderStaffTable(views){ views = views || {}; var rows = views.staffSchedules || []; var items = itemList(views, rows); if (!rows.length) return '<div style="padding:12px" class="muted">No regular staff schedule found.</div>'; return '<table class="scheduleGridTable wide"><thead><tr><th>Staff</th>'+items.map(function(it){return '<th>'+esc(it.title || it.label)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(s){ var map = rowMap(s.rows || []); return '<tr><td>'+esc(s.staff || s.name || '')+'</td>'+items.map(function(it){ var r = map[it.label] || map[it.title] || {}; return '<td>'+staffCell(r, views)+'</td>'; }).join('')+'</tr>'; }).join('')+'</tbody></table>'; }
  function renderStudentTable(views){ views = views || {}; var rows = views.studentSchedules || []; var items = itemList(views, rows); if (!rows.length) return '<div style="padding:12px" class="muted">No regular student schedule found.</div>'; return '<table class="scheduleGridTable wide"><thead><tr><th>Student</th>'+items.map(function(it){return '<th>'+esc(it.title || it.label)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(s){ var map = rowMap(s.rows || []); return '<tr><td>'+studentLabel({name:s.student || s.name || '', url:s.url || ''})+'</td>'+items.map(function(it){ return studentCell(map[it.label] || map[it.title] || {}); }).join('')+'</tr>'; }).join('')+'</tbody></table>'; }
  function renderBreakTable(views){ views = views || {}; var rows = views.breakItems || []; if (!rows.length) return '<div style="padding:12px" class="muted">No regular break schedule found.</div>'; function fmtMin(m){ m = Number(m); if (!isFinite(m)) return ''; var h = Math.floor(m/60), mn = m % 60, ap = h >= 12 ? 'PM' : 'AM'; var hh = h % 12; if (hh === 0) hh = 12; return hh+':'+String(mn).padStart(2,'0')+' '+ap; } function timeFor(b){ return b.time || ((b.startMinutes != null && b.endMinutes != null) ? (fmtMin(b.startMinutes)+' - '+fmtMin(b.endMinutes)) : ''); } return '<table class="scheduleGridTable wide timeColNormal"><thead><tr><th>Time</th><th>Staff on break</th><th>Type</th><th>Covering staff</th><th>Students / Location</th></tr></thead><tbody>'+rows.map(function(b){ b = b || {}; var detail = [cleanBreak(b.students), cleanBreak(b.location)].filter(Boolean).join(' · '); return '<tr><td>'+esc(timeFor(b))+'</td><td>'+esc(b.staffOnBreak || b.staff || '')+'</td><td>'+esc(b.type || '')+'</td><td>'+esc(b.coveringStaff || '')+'</td><td>'+esc(detail)+'</td></tr>'; }).join('')+'</tbody></table>'; }
  function drawRegularScheduleV022(data){
    data = data || {}; lastRegular = data;
    var cb = by('regularScheduleStaffPortalToggle');
    if (cb) { cb.checked = !!data.displayOnStaffPortal; cb.onchange = function(){ var school = selectedSchoolId(); if (!school) return; var val = !!cb.checked; msg('Saving Regular Schedule Staff Portal display setting...','warn'); fetchJson('/api/history/regular-display-v022', { method:'POST', body: JSON.stringify({ school:school, display:val }) }).then(function(j){ lastRegular = j; cb.checked = !!j.displayOnStaffPortal; msg(val ? 'Regular Schedule will display in Staff Portal.' : 'Regular Schedule hidden from Staff Portal.','ok'); }).catch(function(e){ cb.checked = !val; msg('Could not save Regular Schedule Staff Portal setting: '+clean(e.message || e),'err'); }); }; }
    var box = by('regularScheduleView'); if (!box) return;
    var schedules = Array.isArray(data.schedules) ? data.schedules : [];
    if (!schedules.length) { box.innerHTML = '<p class="muted">No schedule has been marked as the regular schedule yet. Use the lock icon on Historical Schedules.</p>'; return; }
    function drawOne(s){ s = s || {}; var v = s.views || {}; return '<div class="muted" style="margin-bottom:8px"><strong>'+esc(s.label || 'Regular Schedule')+'</strong>'+(s.publishedAt ? ' · '+esc(formatStamp(s.publishedAt)) : '')+'</div><h3>Staff Schedule</h3><div class="scroll">'+renderStaffTable(v)+'</div><h3>Student Schedule</h3><div class="scroll">'+renderStudentTable(v)+'</div><h3>Break Schedule</h3><div class="scroll">'+renderBreakTable(v)+'</div>'; }
    var tabs = '<div class="scenarioSubtabs">'+schedules.map(function(s,i){ return '<button type="button" class="btn small '+(i===0?'primary':'')+'" data-regular-v022-index="'+i+'">'+esc(s.label || ('Regular '+(i+1)))+'</button>'; }).join('')+'</div>';
    box.innerHTML = tabs + '<div id="regularAdminScheduleBoxV022">'+drawOne(schedules[0])+'</div>';
    Array.prototype.slice.call(box.querySelectorAll('[data-regular-v022-index]')).forEach(function(btn){ btn.onclick = function(){ Array.prototype.slice.call(box.querySelectorAll('[data-regular-v022-index]')).forEach(function(x){ x.classList.remove('primary'); }); btn.classList.add('primary'); var idx = Number(btn.getAttribute('data-regular-v022-index') || 0); var target = by('regularAdminScheduleBoxV022'); if (target) target.innerHTML = drawOne(schedules[idx]); }; });
  }
  function loadRegularSchedulePageV022(){ var school = selectedSchoolId(); if (!school) { msg('Choose a school before loading the regular schedule.','warn'); return; } msg('Loading regular schedule...','warn'); fetchJson('/api/history/regular-v022?' + new URLSearchParams({ school:school }).toString()).then(function(j){ drawRegularScheduleV022(j); msg('', ''); }).catch(function(e){ msg('Could not load regular schedule: '+clean(e.message || e),'err'); }); }
  window.renderRegularSchedulePage = drawRegularScheduleV022;
  window.loadRegularSchedulePage = loadRegularSchedulePageV022;
  try { renderRegularSchedulePage = drawRegularScheduleV022; loadRegularSchedulePage = loadRegularSchedulePageV022; } catch(e) {}

  // ===================================================================================
  // Month headings: force Calendar/Attendance headers to Month Year, even if old runtime
  // data still contains a localized Date string such as 5/31/2026, 5:00:00 PM.
  // ===================================================================================
  function monthFromYm(ym){ var m = clean(ym).match(/^(\d{4})-(\d{1,2})/); if (!m) return ''; return new Date(Number(m[1]), Number(m[2])-1, 1).toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'long',year:'numeric'}); }
  function monthFromDateString(s){ s = clean(s); if (!s) return ''; var ym = s.match(/^(\d{4})-(\d{1,2})/); if (ym) return monthFromYm(ym[1]+'-'+ym[2]); var d = new Date(s); if (!isNaN(d.getTime())) { if (d.getHours() >= 16 && d.getDate() >= 28) d = new Date(d.getFullYear(), d.getMonth()+1, 1); return d.toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'long',year:'numeric'}); } return ''; }
  function fixMonthHeaders(){
    var att = by('attendanceMonthHeading');
    if (att) { var txt = clean(att.textContent || ''); if (!/Attendance\s+History\s*$/i.test(txt)) { var ym = clean((by('attendanceMonthSelect') || {}).value || ''); try { if (!ym && window.attendanceManagerData && attendanceManagerData.month) ym = attendanceManagerData.month; } catch(e) {} var label = monthFromYm(ym) || monthFromDateString(txt); if (label) att.textContent = label; } }
    var cal = by('portalCalTitle');
    if (cal) { var cur = clean(cal.textContent || ''); var ym2 = ''; try { if (window.calendarViewDate || calendarViewDate) { var d = window.calendarViewDate || calendarViewDate; ym2 = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); } } catch(e2) {} try { if (!ym2 && window.calendarData && calendarData.year && calendarData.month) ym2 = calendarData.year+'-'+String(calendarData.month).padStart(2,'0'); } catch(e3) {} var label2 = monthFromYm(ym2) || monthFromDateString(cur); if (label2) cal.textContent = label2; }
  }
  function wrapMonthRenderers(){
    try { var oldA = window.renderAttendanceManager || (typeof renderAttendanceManager === 'function' ? renderAttendanceManager : null); if (typeof oldA === 'function' && !oldA.__redisV022) { var newA = function(){ var out = oldA.apply(this, arguments); setTimeout(fixMonthHeaders,0); setTimeout(fixMonthHeaders,80); return out; }; newA.__redisV022 = true; window.renderAttendanceManager = newA; try { renderAttendanceManager = newA; } catch(e) {} } } catch(e1) {}
    try { var oldC = window.renderPortalCalendar || (typeof renderPortalCalendar === 'function' ? renderPortalCalendar : null); if (typeof oldC === 'function' && !oldC.__redisV022) { var newC = function(){ var out = oldC.apply(this, arguments); setTimeout(fixMonthHeaders,0); setTimeout(fixMonthHeaders,80); return out; }; newC.__redisV022 = true; window.renderPortalCalendar = newC; try { renderPortalCalendar = newC; } catch(e) {} } } catch(e2) {}
  }

  // ===================================================================================
  // Bell Schedule alert badges: custom period metadata with blockType Break/Lunch must
  // satisfy Break/Lunch alerts. Reinstall after legacy renderers load/overwrite.
  // ===================================================================================
  function metaRows(){
    var rows = [];
    try { rows = rows.concat(((window.advancedSetupDataV5131 || advancedSetupDataV5131 || {}).periodMeta || [])); } catch(e) {}
    try { rows = rows.concat(((window.scheduleData || scheduleData || {}).periodMeta || [])); } catch(e2) {}
    Array.prototype.slice.call(document.querySelectorAll('#periodMetaRows .periodMetaRow')).forEach(function(row){ rows.push({ key: clean((row.querySelector('.periodMetaKey') || {}).value || ''), displayName: clean((row.querySelector('.periodMetaDisplay') || {}).value || ''), blockType: clean((row.querySelector('.periodMetaBlockType') || {}).value || '') }); });
    return rows;
  }
  function blockTypeForItem(item){
    var k = norm(item); if (k === 'break') return 'break'; if (k === 'lunch') return 'lunch';
    var rows = metaRows();
    for (var i=0;i<rows.length;i++) { var r = rows[i] || {}; var aliases = [r.key, r.displayName, r.label, r.title].map(norm); if (aliases.indexOf(k) >= 0 || aliases.map(function(x){return x.replace(/\s+/g,'');}).indexOf(k.replace(/\s+/g,'')) >= 0) { var t = norm(r.blockType || r.type || ''); if (t === 'break' || t === 'lunch') return t; } }
    return 'instruction';
  }
  function parseTimeLocal(t){ try { if (typeof parseTime === 'function') return parseTime(t); } catch(e) {} var d = Date.parse('January 1, 2000 '+clean(t)); if (!isNaN(d)) { var dt = new Date(d); return dt.getHours()*60+dt.getMinutes(); } return null; }
  function rowBadge(r){ r = r || {}; if (!r.active) return ''; var out = []; var st = parseTimeLocal(r.start), en = parseTimeLocal(r.end); if (!clean(r.start) || !clean(r.end)) out.push('<span class="badge warn">Missing Time</span>'); else if (st === null || en === null) out.push('<span class="badge bad">Invalid Time</span>'); else if (en <= st) out.push('<span class="badge bad">End Before Start</span>'); else if (en - st < 15) out.push('<span class="badge warn">Very Short</span>'); return out.join(''); }
  function installScheduleBadgePatch(){
    var replacement = function(rows){
      try { if (by('scheduleBadgeToggle') && !by('scheduleBadgeToggle').checked) return ''; } catch(e) {}
      try { if (document.body.classList.contains('noBadges')) return ''; } catch(e2) {}
      rows = Array.isArray(rows) ? rows : []; var active = rows.filter(function(r){ return r && r.active; }); var out = [];
      if (!active.some(function(r){ return blockTypeForItem(r.item || r.key || r.label || r.displayName) === 'break'; })) out.push('<span class="badge warn">No Break</span>');
      if (!active.some(function(r){ return blockTypeForItem(r.item || r.key || r.label || r.displayName) === 'lunch'; })) out.push('<span class="badge warn">No Lunch</span>');
      active.forEach(function(r){ var b = rowBadge(r); if (b) out.push(b); });
      var intervals = []; active.forEach(function(r){ var st = parseTimeLocal(r.start), en = parseTimeLocal(r.end); if (st !== null && en !== null && en > st) intervals.push({start:st,end:en}); }); intervals.sort(function(a,b){ return a.start-b.start; }); for (var i=1;i<intervals.length;i++) { if (intervals[i].start < intervals[i-1].end) { out.push('<span class="badge bad">Overlap</span>'); break; } }
      var seen = {}; return out.filter(function(x){ if (seen[x]) return false; seen[x]=true; return true; }).join('');
    };
    window.periodItemBlockTypeV5308 = function(item){ return blockTypeForItem(item); };
    window.renderScheduleBadges = replacement;
    try { periodItemBlockTypeV5308 = window.periodItemBlockTypeV5308; renderScheduleBadges = replacement; } catch(e) {}
  }

  // ===================================================================================
  // Staff Manager Email: Staff column K is canonical. Load from Redis on staff selection,
  // include in collectStaff, and save explicitly after edits/Staff save.
  // ===================================================================================
  var emailSaveTimer = null;
  function ensureStaffEmailField(){
    var input = by('staffNotificationEmailV686m41');
    if (input) {
      var owner = input.closest ? input.closest('#staffEmailFieldV686m41,.staffEmailFieldV686m41') : null;
      var goodHost = owner && owner.parentNode && owner.parentNode.classList && owner.parentNode.classList.contains('staffDataStatsV5288');
      // v05418di: never allow this legacy Redis email helper to attach to the left Staff
      // sidebar card. When no staff is selected, #staff .card points at the staff list panel,
      // which is why an orphan Email field appeared below Delete. Keep the helper only in the
      // real metrics/contact row and remove any sidebar instance it previously created.
      if (owner && !goodHost) { try { owner.remove(); } catch(e) {} input = null; }
    }
    if (!input) {
      var stats = document.querySelector('#staff .staffDataStatsV5288');
      if (stats) {
        var field = document.createElement('div'); field.id = 'staffEmailFieldV686m41'; field.className = 'staffEmailFieldV686m41';
        field.innerHTML = '<label>Email</label><input id="staffNotificationEmailV686m41" type="email" autocomplete="email"><div id="staffEmailMsgV022" class="staffEmailHelpV686m41"></div>';
        stats.appendChild(field); input = by('staffNotificationEmailV686m41');
      }
    }
    if (input) { input.placeholder = ''; input.setAttribute('autocomplete','email'); if (!input.__redisV022Bound) { input.__redisV022Bound = true; input.addEventListener('input', function(){ input.setAttribute('data-dirty','1'); }); input.addEventListener('change', function(){ scheduleSaveStaffEmail(); }); input.addEventListener('blur', function(){ scheduleSaveStaffEmail(50); }); } }
    return input;
  }
  function currentStaffInfo(){ var cs = null; try { cs = window.currentStaff || currentStaff || null; } catch(e) {} var row = Number((cs && cs.rowIndex) || 0); var name = clean((cs && cs.name) || (by('staffName') && by('staffName').value) || ''); return { rowIndex: row, name: name }; }
  function loadStaffEmail(){ var input = ensureStaffEmailField(); if (!input) return; var info = currentStaffInfo(); var school = selectedSchoolId(); if (!school || !info.name) return; var key = school+'|'+info.rowIndex+'|'+info.name; if (input.getAttribute('data-load-key') === key && input.getAttribute('data-dirty') === '1') return; fetchJson('/api/staff/email-v022?' + new URLSearchParams({ school:school, staff:info.name, rowIndex:String(info.rowIndex || '') }).toString()).then(function(j){ if (document.activeElement === input && input.getAttribute('data-dirty') === '1') return; input.value = j.email || ''; input.setAttribute('data-load-key', key); input.setAttribute('data-staff-key', info.rowIndex+'|'+info.name); input.setAttribute('data-dirty','0'); try { if (window.currentStaff) currentStaff.notificationEmail = j.email || ''; } catch(e) {} }).catch(function(){}); }
  function saveStaffEmailNow(silent){ var input = ensureStaffEmailField(); if (!input) return Promise.resolve(null); var info = currentStaffInfo(); var school = selectedSchoolId(); if (!school || !info.name) return Promise.resolve(null); var email = clean(input.value || ''); if (!silent) msg('Saving staff email...','warn'); return fetchJson('/api/staff/email-v022', { method:'POST', body: JSON.stringify({ school:school, staff:info.name, rowIndex:info.rowIndex, email:email }) }).then(function(j){ input.setAttribute('data-dirty','0'); try { if (window.currentStaff) currentStaff.notificationEmail = j.email || ''; } catch(e) {} try { var data = window.staffData || staffData || {}; (data.staff || []).forEach(function(s){ if (Number(s.rowIndex) === Number(j.rowIndex) || compact(s.name) === compact(j.staff)) s.notificationEmail = j.email || ''; }); } catch(e2) {} if (!silent) msg(j.message || 'Email saved.','ok'); return j; }).catch(function(e){ if (!silent) msg('Could not save staff email: '+clean(e.message || e),'err'); throw e; }); }
  function scheduleSaveStaffEmail(delay){ clearTimeout(emailSaveTimer); emailSaveTimer = setTimeout(function(){ saveStaffEmailNow(true).catch(function(){}); }, delay == null ? 400 : delay); }
  function patchStaffEmail(){
    ensureStaffEmailField();
    try { var baseSelect = window.selectStaff || (typeof selectStaff === 'function' ? selectStaff : null); if (typeof baseSelect === 'function' && !baseSelect.__redisV022) { var newSelect = function(){ var out = baseSelect.apply(this, arguments); setTimeout(loadStaffEmail, 0); setTimeout(loadStaffEmail, 250); return out; }; newSelect.__redisV022 = true; window.selectStaff = newSelect; try { selectStaff = newSelect; } catch(e) {} } } catch(e1) {}
    try { var baseCollect = window.collectStaff || (typeof collectStaff === 'function' ? collectStaff : null); if (typeof baseCollect === 'function' && !baseCollect.__redisV022) { var newCollect = function(){ var p = baseCollect.apply(this, arguments) || {}; var input = ensureStaffEmailField(); p.notificationEmail = input ? clean(input.value || '') : clean(p.notificationEmail || p.email || ''); p.email = p.notificationEmail; p.communicationPreference = 'Email'; p.googleChatUser = ''; p.teamsUser = ''; return p; }; newCollect.__redisV022 = true; window.collectStaff = newCollect; try { collectStaff = newCollect; } catch(e) {} } } catch(e2) {}
    try { var baseSave = window.saveStaff || (typeof saveStaff === 'function' ? saveStaff : null); if (typeof baseSave === 'function' && !baseSave.__redisV022) { var newSave = function(){ var out = baseSave.apply(this, arguments); setTimeout(function(){ saveStaffEmailNow(true).catch(function(){}); }, 900); return out; }; newSave.__redisV022 = true; window.saveStaff = newSave; try { saveStaff = newSave; } catch(e) {} } } catch(e3) {}
  }

  function installStyles(){ if (by('gaRedisV022Styles')) return; var st = document.createElement('style'); st.id = 'gaRedisV022Styles'; st.textContent = '#staffNotificationEmailV686m41::placeholder{color:transparent!important}.staffEmailFieldV686m41 input::placeholder{color:transparent!important}'; document.head.appendChild(st); }

  function boot(){ installStyles(); wrapMonthRenderers(); fixMonthHeaders(); installScheduleBadgePatch(); if (by('regularSchedule') && by('regularSchedule').classList.contains('active')) setTimeout(loadRegularSchedulePageV022,80); }
  window.addEventListener('change', function(e){ var t = e && e.target; if (!t) return; if (t.id === 'attendanceMonthSelect' || t.id === 'portalBulkSchedule') setTimeout(fixMonthHeaders, 60); if (t.classList && (t.classList.contains('periodMetaBlockType') || t.classList.contains('schedActive') || t.classList.contains('schedStart') || t.classList.contains('schedEnd'))) setTimeout(function(){ installScheduleBadgePatch(); try { if (typeof renderScheduleList === 'function') renderScheduleList(); if (typeof previewSchedule === 'function') previewSchedule(); } catch(e) {} }, 60); }, true);
  window.addEventListener('click', function(e){ var t = e && e.target; if (t && t.closest && t.closest('[data-action="period-meta-save"],[data-action="period-meta-add"],[data-action="period-meta-delete"],[data-action="schedule-save"],[data-action="schedule-load"],[data-nav="schedule"],[data-nav="regularSchedule"]')) setTimeout(boot, 300); }, true);
  try { new MutationObserver(function(){ var a=(document.querySelector('.section.active')||{}).id||''; if(a==='calendar'||a==='attendanceManager') return; fixMonthHeaders(); }).observe(document.body, { childList:true, subtree:true }); } catch(e) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  [100,300,800,1500,3000,6000,10000,15000].forEach(function(ms){ setTimeout(boot, ms); });
  try { if (typeof window.registerNavigationAfterHookV5_ === 'function') window.registerNavigationAfterHookV5_(function(page){ setTimeout(boot,120); if (page === 'regularSchedule') setTimeout(loadRegularSchedulePageV022,180); }, 'redisV022RegularDateBellEmailFixes'); } catch(e) {}
})();

/* ===== END ga-redis-v022-ui-patches.js ===== */

/* ===== BEGIN ga-redis-v023-ui-patches.js ===== */
(function(){
  // v0.24.0 Redis UI fixes loaded through the existing v023 patch filename.
  // Goals: no boot mutation, Staff Manager email column K, no duplicate email box,
  // instant-save Regular Schedule Staff Portal toggle, Bell Schedule Break/Lunch badge cleanup.
  if (window.__gaRedisV024UiPatches) return;
  window.__gaRedisV024UiPatches = true;

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c; }); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
  function compact(v){ return norm(v).replace(/\s+/g,''); }
  function activePage(){ try { return (typeof activeSectionIdV51229 === 'function' && activeSectionIdV51229()) || ''; } catch(e) { return ''; } }
  function isActiveSection(id){ try { var sec = by(id); return !!(sec && sec.classList && sec.classList.contains('active')); } catch(e) { return false; } }
  function portalReady(){
    try {
      if (document.body && document.body.classList && document.body.classList.contains('schoolAccessResolvedV657')) return true;
      var boot = by('schoolBootOverlayV5537');
      if (!boot) return true;
      var cs = window.getComputedStyle ? getComputedStyle(boot) : null;
      return !!(cs && (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity || 1) === 0));
    } catch(e) { return false; }
  }
  function msg(t, k){ try { if (typeof setMsg === 'function') setMsg(t || '', k || 'ok'); } catch(e) {} }
  function selectedSchoolId(){
    try { if (typeof selectedSchoolIdV5312 === 'function') { var s = clean(selectedSchoolIdV5312()); if (s) return s; } } catch(e) {}
    try { var ctx = window.campusContextV5253 || campusContextV5253 || {}; var s2 = clean(ctx.selectedCampusId || (ctx.currentCampus && (ctx.currentCampus.campusId || ctx.currentCampus.id)) || ''); if (s2) return s2; } catch(e2) {}
    try { var sel = by('campusSelector'); var s3 = clean(sel && sel.value); if (s3) return s3; } catch(e3) {}
    return '';
  }
  function fetchJson(url, opts){
    opts = opts || {}; opts.credentials = opts.credentials || 'same-origin';
    if (opts.body && !opts.headers) opts.headers = { 'Content-Type':'application/json' };
    return fetch(url, opts).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j || j.ok === false) { var err = new Error((j && (j.error || j.message)) || ('HTTP ' + r.status)); err.payload = j; throw err; } return j; }); });
  }
  function clearDirty(section){
    try { if (typeof clearManagerDirtyV5322 === 'function') clearManagerDirtyV5322(section); } catch(e) {}
    try { if (window.dirtySectionsV5322) delete window.dirtySectionsV5322[section]; } catch(e2) {}
    try { if (typeof updateDirtyBadgeV5326 === 'function') updateDirtyBadgeV5326(); } catch(e3) {}
    try { var badge = by('topUnsavedBadge'); if (badge) badge.classList.remove('active'); } catch(e4) {}
    try { document.body.classList.remove('hasUnsavedChanges','portalDirty','dirty'); } catch(e5) {}
  }

  // ---------------------------------------------------------------------------
  // Regular Schedule display toggle: instant save, no extra save button, no hint.
  // The setting controls whether Regular Schedule is visible in Staff Portal only.
  // Admin Regular Schedule remains visible to admins.
  // ---------------------------------------------------------------------------
  var regularSaveTimer = null;
  function regularToggle(){ return by('regularScheduleStaffPortalToggle'); }
  function regularSectionActive(){ return activePage() === 'regularSchedule' || isActiveSection('regularSchedule'); }
  function removeAutosaveText(){
    try { Array.prototype.slice.call(document.querySelectorAll('.redisInstantSavedHintV023,.redisInstantSavedHintV024')).forEach(function(n){ n.remove(); }); } catch(e) {}
    try { Array.prototype.slice.call(document.querySelectorAll('#regularSchedule label, #regularSchedule .formHint, #regularSchedule .muted')).forEach(function(n){ if (/auto\-?saves/i.test(n.textContent || '')) n.textContent = (n.textContent || '').replace(/\s*Auto\-?saves\.?\s*/ig,''); }); } catch(e2) {}
  }
  function markRegularToggleNoDirty(){
    var cb = regularToggle();
    removeAutosaveText();
    if (!cb) return;
    cb.setAttribute('data-no-dirty','1');
    cb.setAttribute('data-redis-instant-save','1');
  }
  function loadRegularDisplayState(){
    var cb = regularToggle(); if (!cb) return;
    var school = selectedSchoolId(); if (!school) return;
    if (!cb.__redisV024LoadedOnce) { cb.__redisV024LoadedOnce = true; cb.style.visibility = 'hidden'; }
    fetchJson('/api/history/regular-v022?' + new URLSearchParams({ school: school }).toString())
      .then(function(j){ cb.checked = !!j.displayOnStaffPortal; cb.style.visibility = ''; clearDirty('regularSchedule'); removeAutosaveText(); })
      .catch(function(){ cb.style.visibility = ''; removeAutosaveText(); });
  }
  function saveRegularDisplayInstant(val){
    var school = selectedSchoolId(); if (!school) return;
    clearTimeout(regularSaveTimer);
    regularSaveTimer = setTimeout(function(){
      var cb = regularToggle(); if (cb) { cb.disabled = true; cb.setAttribute('data-no-dirty','1'); }
      fetchJson('/api/history/regular-display-v022', { method:'POST', body: JSON.stringify({ school: school, display: !!val }) })
        .then(function(j){ if (cb) { cb.checked = !!j.displayOnStaffPortal; cb.disabled = false; } clearDirty('regularSchedule'); removeAutosaveText(); msg(!!j.displayOnStaffPortal ? 'Regular Schedule will display in Staff Portal.' : 'Regular Schedule hidden from Staff Portal.', 'ok'); })
        .catch(function(e){ if (cb) cb.disabled = false; msg('Could not save Regular Schedule Staff Portal display setting: ' + clean(e.message || e), 'err'); });
    }, 50);
  }
  window.addEventListener('change', function(e){
    var t = e && e.target;
    if (!t || t.id !== 'regularScheduleStaffPortalToggle') return;
    t.setAttribute('data-no-dirty','1');
    e.stopImmediatePropagation();
    saveRegularDisplayInstant(!!t.checked);
    setTimeout(function(){ clearDirty('regularSchedule'); removeAutosaveText(); }, 0);
    setTimeout(function(){ clearDirty('regularSchedule'); removeAutosaveText(); }, 250);
    setTimeout(function(){ clearDirty('regularSchedule'); removeAutosaveText(); }, 1000);
  }, true);

  // ---------------------------------------------------------------------------
  // Staff Manager Email field: keep exactly one field in the top stats row and
  // bind it to Redis Staff column K. Remove legacy/side-panel duplicate boxes.
  // ---------------------------------------------------------------------------
  var emailTimer = null;
  var lastEmailLoadKey = '';
  function staffSectionActive(){ return activePage() === 'staff' || isActiveSection('staff'); }
  function staffInfo(){
    var cs = null; try { cs = window.currentStaff || currentStaff || null; } catch(e) {}
    var name = clean((cs && cs.name) || (by('staffName') && by('staffName').value) || '');
    var row = Number((cs && cs.rowIndex) || 0) || 0;
    return { rowIndex: row, name: name };
  }
  function ensureStaffStats(){
    if (!portalReady() || !staffSectionActive()) return null;
    try { if (typeof ensureStaffDataStatsUiV5288 === 'function') ensureStaffDataStatsUiV5288(); } catch(e) {}
    return by('staffDataStatsV5288') || document.querySelector('#staff .staffDataStatsV5288');
  }
  function removeDuplicateStaffEmailBoxes(){
    if (!staffSectionActive()) return;
    try {
      var keep = by('staffEmailFieldV024');
      var inputs = Array.prototype.slice.call(document.querySelectorAll('#staff input[type="email"], #staff input[id*="Email"], #staff input[id*="email"], #staff input[name*="email"], #staff input[name*="Email"]'));
      inputs.forEach(function(inp){
        if (!inp || inp.id === 'staffNotificationEmailV686m41') return;
        if (keep && keep.contains(inp)) return;
        var box = inp.closest('.staffEmailFieldV023,.staffEmailFieldV024,.staffEmailFieldV686m41,.staffDataFieldV5289,.card,.panel,div') || inp.parentNode;
        // Remove only simple orphan email boxes, not Settings/Communication sections.
        var text = clean((box && box.textContent) || '');
        var inStats = !!(box && (box.id === 'staffDataStatsV5288' || (box.closest && box.closest('#staffDataStatsV5288'))));
        var inSide = !!(box && box.closest && (box.closest('#staffListPanel,#staffSidebar,.managerSidebar,.leftPane,.sidebar') || (box.getBoundingClientRect && box.getBoundingClientRect().left < 310)));
        if (!inStats && inSide && /^Email\b/i.test(text)) { try { box.remove(); } catch(e) {} }
      });
      // Also remove label/input pairs left by older patches in the left staff list area.
      Array.prototype.slice.call(document.querySelectorAll('#staff label')).forEach(function(lbl){
        if (clean(lbl.textContent || '').replace(/\s+/g,' ') !== 'Email') return;
        var box = lbl.closest('.staffEmailFieldV023,.staffEmailFieldV024,.staffDataFieldV5289,div') || lbl.parentNode;
        if (keep && keep.contains(lbl)) return;
        var inStats = !!(box && box.closest && box.closest('#staffDataStatsV5288'));
        var rect = box && box.getBoundingClientRect ? box.getBoundingClientRect() : null;
        if (!inStats && rect && rect.left < 310) { try { box.remove(); } catch(e) {} }
      });
    } catch(e) {}
  }
  function ensureStaffEmailField(){
    var wrap = ensureStaffStats(); if (!wrap) return null;
    var field = by('staffEmailFieldV024');
    var input = by('staffNotificationEmailV686m41');
    if (!field || !input || !wrap.contains(field)) {
      if (input && input.closest) { var old = input.closest('.staffEmailFieldV023,.staffEmailFieldV024,.staffEmailFieldV686m41,.staffDataFieldV5289'); if (old) try { old.remove(); } catch(e) {} }
      field = document.createElement('div');
      field.id = 'staffEmailFieldV024';
      field.className = 'staffEmailFieldV024 staffDataFieldV5289';
      field.innerHTML = '<label>Email <span class="helpDot" tabindex="0" data-tip="Email address saved to Staff column K and used for schedule communication.">?</span></label><input id="staffNotificationEmailV686m41" class="staffEmailInputV024" type="email" autocomplete="email"><div id="staffEmailMsgV024" class="staffEmailMsgV024"></div>';
      var link = by('staffPortalLinkFieldV5312');
      if (link && link.parentNode === wrap) wrap.insertBefore(field, link); else wrap.appendChild(field);
      try { if (typeof initHelpTooltipOverlayV5254 === 'function') initHelpTooltipOverlayV5254(); } catch(e2) {}
    } else {
      field.className = 'staffEmailFieldV024 staffDataFieldV5289';
      var link2 = by('staffPortalLinkFieldV5312');
      if (link2 && link2.parentNode === wrap && field.nextSibling !== link2) wrap.insertBefore(field, link2);
    }
    input = by('staffNotificationEmailV686m41');
    if (input) {
      input.placeholder = '';
      input.setAttribute('autocomplete','email');
      if (!input.__redisV024Bound) {
        input.__redisV024Bound = true;
        input.addEventListener('input', function(){ input.setAttribute('data-dirty','1'); });
        input.addEventListener('change', function(){ saveStaffEmailSoon(0); });
        input.addEventListener('blur', function(){ saveStaffEmailSoon(50); });
      }
    }
    removeDuplicateStaffEmailBoxes();
    return input;
  }
  function saveStaffEmailSoon(delay){ clearTimeout(emailTimer); emailTimer = setTimeout(function(){ saveStaffEmail(true); }, delay == null ? 250 : delay); }
  function loadStaffEmail(force){
    var input = ensureStaffEmailField(); if (!input) return;
    var info = staffInfo(), school = selectedSchoolId();
    if (!school || !info.name) { input.value = ''; return; }
    var key = school + '|' + (info.rowIndex || '') + '|' + info.name;
    if (!force && lastEmailLoadKey === key && input.getAttribute('data-dirty') === '1') return;
    lastEmailLoadKey = key;
    if (document.activeElement !== input) { input.value = ''; input.setAttribute('data-dirty','0'); }
    fetchJson('/api/staff/email-v022?' + new URLSearchParams({ school: school, staff: info.name, rowIndex: String(info.rowIndex || '') }).toString())
      .then(function(j){
        if (staffInfo().name !== info.name) return;
        if (document.activeElement === input && input.getAttribute('data-dirty') === '1') return;
        input.value = j.email || '';
        input.setAttribute('data-dirty','0');
        input.setAttribute('data-load-key', key);
        try { if (window.currentStaff) { currentStaff.notificationEmail = j.email || ''; currentStaff.email = j.email || ''; } } catch(e) {}
        removeDuplicateStaffEmailBoxes();
      })
      .catch(function(){ removeDuplicateStaffEmailBoxes(); });
  }
  function saveStaffEmail(silent){
    var input = ensureStaffEmailField(); if (!input) return Promise.resolve(null);
    var info = staffInfo(), school = selectedSchoolId();
    if (!school || !info.name) return Promise.resolve(null);
    var email = clean(input.value || '');
    var msgEl = by('staffEmailMsgV024'); if (msgEl && !silent) msgEl.textContent = 'Saving...';
    return fetchJson('/api/staff/email-v022', { method:'POST', body: JSON.stringify({ school: school, staff: info.name, rowIndex: info.rowIndex, email: email }) })
      .then(function(j){
        input.setAttribute('data-dirty','0');
        if (msgEl) { msgEl.textContent = silent ? '' : 'Saved.'; if (!silent) setTimeout(function(){ if (msgEl) msgEl.textContent = ''; }, 1200); }
        try { if (window.currentStaff) { currentStaff.notificationEmail = j.email || ''; currentStaff.email = j.email || ''; } } catch(e) {}
        try { var d = window.staffData || staffData || {}; (d.staff || []).forEach(function(s){ if (Number(s.rowIndex) === Number(j.rowIndex) || compact(s.name) === compact(j.staff)) { s.notificationEmail = j.email || ''; s.email = j.email || ''; } }); } catch(e2) {}
        removeDuplicateStaffEmailBoxes();
        return j;
      })
      .catch(function(e){ if (msgEl) msgEl.textContent = 'Could not save email.'; if (!silent) msg('Could not save staff email: ' + clean(e.message || e), 'err'); throw e; });
  }
  function patchStaffEmailFunctions(){
    try {
      var baseSelect = window.selectStaff || (typeof selectStaff === 'function' ? selectStaff : null);
      if (typeof baseSelect === 'function' && !baseSelect.__redisV024Email) {
        var wrappedSelect = function(){ var out = baseSelect.apply(this, arguments); setTimeout(function(){ ensureStaffEmailField(); loadStaffEmail(true); }, 0); setTimeout(function(){ loadStaffEmail(true); }, 250); return out; };
        wrappedSelect.__redisV024Email = true; window.selectStaff = wrappedSelect; try { selectStaff = wrappedSelect; } catch(e) {}
      }
    } catch(e1) {}
    try {
      var baseCollect = window.collectStaff || (typeof collectStaff === 'function' ? collectStaff : null);
      if (typeof baseCollect === 'function' && !baseCollect.__redisV024Email) {
        var wrappedCollect = function(){ var p = baseCollect.apply(this, arguments) || {}; var input = ensureStaffEmailField(); var email = input ? clean(input.value || '') : clean(p.notificationEmail || p.email || ''); p.notificationEmail = email; p.email = email; p.communicationPreference = 'Email'; p.googleChatUser = ''; p.teamsUser = ''; return p; };
        wrappedCollect.__redisV024Email = true; window.collectStaff = wrappedCollect; try { collectStaff = wrappedCollect; } catch(e) {}
      }
    } catch(e2) {}
    try {
      var baseSave = window.saveStaff || (typeof saveStaff === 'function' ? saveStaff : null);
      if (typeof baseSave === 'function' && !baseSave.__redisV024Email) {
        var wrappedSave = function(){ var out = baseSave.apply(this, arguments); setTimeout(function(){ saveStaffEmail(true).catch(function(){}); }, 600); return out; };
        wrappedSave.__redisV024Email = true; window.saveStaff = wrappedSave; try { saveStaff = wrappedSave; } catch(e) {}
      }
    } catch(e3) {}
  }

  // ---------------------------------------------------------------------------
  // Bell Schedule badges: false No Break / No Lunch cleanup.
  // The legacy renderer can briefly render old flags; hide until rewritten.
  // ---------------------------------------------------------------------------
  function scheduleSectionActive(){ return activePage() === 'schedule' || isActiveSection('schedule'); }
  function parseTimeLocal(t){ try { if (typeof parseTime === 'function') return parseTime(t); } catch(e) {} var d = Date.parse('January 1, 2000 ' + clean(t)); if (!isNaN(d)) { var dt = new Date(d); return dt.getHours()*60 + dt.getMinutes(); } return null; }
  function metaRows(){
    var out = [];
    try { var d = window.advancedSetupDataV5131 || advancedSetupDataV5131 || {}; if (Array.isArray(d.periodMeta)) out = out.concat(d.periodMeta); } catch(e) {}
    try { var sd = window.scheduleData || scheduleData || {}; if (Array.isArray(sd.periodMeta)) out = out.concat(sd.periodMeta); } catch(e2) {}
    try { Array.prototype.slice.call(document.querySelectorAll('#periodMetaRows .periodMetaRow')).forEach(function(row){ out.push({ key: clean((row.querySelector('.periodMetaKey') || {}).value || ''), displayName: clean((row.querySelector('.periodMetaDisplay') || {}).value || ''), blockType: clean((row.querySelector('.periodMetaBlockType') || {}).value || '') }); }); } catch(e3) {}
    try { Array.prototype.slice.call(document.querySelectorAll('section.active select, #schedule select')).forEach(function(sel){ var val = clean(sel.value); if (/^(break|lunch)$/i.test(val)) { var row = sel.closest('tr,.periodMetaRow,.row,div'); var label = ''; if (row) label = clean(row.textContent || ''); out.push({ key: label, displayName: label, blockType: val }); } }); } catch(e4) {}
    return out;
  }
  function blockTypeForItem(item){
    var raw = clean(item), k = norm(raw), ck = compact(raw);
    if (!k) return 'instruction';
    if (/\bbreak\b/i.test(raw) || ck.indexOf('break') >= 0) return 'break';
    if (/\blunch\b/i.test(raw) || ck.indexOf('lunch') >= 0) return 'lunch';
    var rows = metaRows();
    for (var i=0;i<rows.length;i++) {
      var r = rows[i] || {}; var aliases = [r.key, r.displayName, r.label, r.title, r.item].map(function(x){ return compact(x); }).filter(Boolean);
      if (aliases.indexOf(ck) >= 0) { var t = norm(r.blockType || r.type || ''); if (t.indexOf('break') >= 0) return 'break'; if (t.indexOf('lunch') >= 0) return 'lunch'; }
    }
    return 'instruction';
  }
  function activeVal(v){ return v === true || /^yes|true|1|active$/i.test(clean(v)); }
  function rowBadges(r){
    r = r || {}; if (!activeVal(r.active)) return '';
    var out = [], st = parseTimeLocal(r.start), en = parseTimeLocal(r.end);
    if (!clean(r.start) || !clean(r.end)) out.push('<span class="badge warn">Missing Time</span>');
    else if (st === null || en === null) out.push('<span class="badge bad">Invalid Time</span>');
    else if (en <= st) out.push('<span class="badge bad">End Before Start</span>');
    else if (en - st < 15) out.push('<span class="badge warn">Very Short</span>');
    return out.join('');
  }
  function betterScheduleBadges(rows){
    try { if (by('scheduleBadgeToggle') && !by('scheduleBadgeToggle').checked) return ''; } catch(e) {}
    rows = Array.isArray(rows) ? rows : [];
    var active = rows.filter(function(r){ return r && activeVal(r.active); });
    var hasBreak = active.some(function(r){ return blockTypeForItem(r.item || r.key || r.label || r.displayName || r.name) === 'break'; });
    var hasLunch = active.some(function(r){ return blockTypeForItem(r.item || r.key || r.label || r.displayName || r.name) === 'lunch'; });
    var out = [];
    if (!hasBreak) out.push('<span class="badge warn">No Break</span>');
    if (!hasLunch) out.push('<span class="badge warn">No Lunch</span>');
    active.forEach(function(r){ var b = rowBadges(r); if (b) out.push(b); });
    var ints = [];
    active.forEach(function(r){ var st = parseTimeLocal(r.start), en = parseTimeLocal(r.end); if (st !== null && en !== null && en > st) ints.push({ start:st, end:en }); });
    ints.sort(function(a,b){ return a.start - b.start; });
    for (var i=1;i<ints.length;i++) if (ints[i].start < ints[i-1].end) { out.push('<span class="badge bad">Overlap</span>'); break; }
    var seen = {}; return out.filter(function(x){ if (seen[x]) return false; seen[x] = true; return true; }).join('');
  }
  function patchScheduleBadges(){
    if (!portalReady() || !scheduleSectionActive()) return;
    try { window.periodItemBlockTypeV5308 = blockTypeForItem; window.renderScheduleBadges = betterScheduleBadges; periodItemBlockTypeV5308 = blockTypeForItem; renderScheduleBadges = betterScheduleBadges; } catch(e) {}
    var list = by('scheduleList'); if (!list) return;
    try {
      var data = window.scheduleData || scheduleData || null; if (!data || !Array.isArray(data.schedules)) { cleanupScheduleBadgeDom(); return; }
      var selected = ''; try { selected = selectedSchedule || window.selectedSchedule || ''; } catch(e0) {}
      var q = norm((by('scheduleSearch') || {}).value || '');
      var names = data.schedules.map(function(s){ return s.name; }).filter(function(n){ return !q || norm(n).indexOf(q) >= 0; });
      list.innerHTML = names.map(function(n){
        var sc = data.schedules.find(function(x){ return x.name === n; }) || {};
        var b = betterScheduleBadges(sc.rows || []);
        return '<button draggable="true" data-schedule="'+esc(n)+'" data-schedule-name="'+esc(n)+'" class="'+(n === selected ? 'active' : '')+'">☰ '+esc(n)+(b ? '<span class="scheduleBadgeLine redisBadgeReadyV024">'+b+'</span>' : '')+'</button>';
      }).join('') || '<div class="muted" style="padding:10px">No schedules.</div>';
    } catch(e1) { cleanupScheduleBadgeDom(); }
  }
  function cleanupScheduleBadgeDom(){
    try {
      Array.prototype.slice.call(document.querySelectorAll('#scheduleList button')).forEach(function(btn){
        var text = clean(btn.textContent || '');
        if (!/(no break|no lunch)/i.test(text)) return;
        var name = btn.getAttribute('data-schedule') || btn.getAttribute('data-schedule-name') || text.split('No ')[0].replace(/^☰\s*/, '').trim();
        var data = window.scheduleData || scheduleData || {}; var sc = (data.schedules || []).find(function(s){ return s.name === name; });
        if (!sc) return;
        var b = betterScheduleBadges(sc.rows || []);
        var existing = btn.querySelector('.scheduleBadgeLine'); if (existing) existing.remove();
        btn.childNodes.forEach(function(n){ if (n.nodeType === 3) n.nodeValue = n.nodeValue.replace(/\s*No Break\s*/g,' ').replace(/\s*No Lunch\s*/g,' '); });
        if (b) { var span = document.createElement('span'); span.className = 'scheduleBadgeLine redisBadgeReadyV024'; span.innerHTML = b; btn.appendChild(span); }
      });
    } catch(e) {}
  }

  function cleanSharePill(){
    try { Array.prototype.slice.call(document.querySelectorAll('.shareMainV018,[data-redis-v018-action="share-open"]')).forEach(function(el){ var txt = clean(el.textContent || '').replace(/^✉\s*/, '').replace(/^📧\s*/, '').replace(/^✉️\s*/, ''); if (/share schedules/i.test(txt)) el.textContent = 'Share Schedules'; }); } catch(e) {}
  }

  function installStyles(){
    if (by('gaRedisV024Styles')) return;
    var st = document.createElement('style'); st.id = 'gaRedisV024Styles';
    st.textContent = [
      '#staffNotificationEmailV686m41::placeholder{color:transparent!important}',
      '#staff .staffDataStatsV5288{display:grid!important;grid-template-columns:170px 220px minmax(260px,360px) minmax(520px,1fr)!important;gap:10px!important;align-items:start!important;max-width:none!important;margin-top:8px!important}',
      '#staff .staffEmailFieldV024{align-self:start!important;margin:0!important;min-width:0!important;display:flex!important;flex-direction:column!important;justify-content:flex-start!important}',
      '#staff .staffEmailFieldV024 label{display:block!important;font-weight:700!important;font-size:12px!important;line-height:16px!important;min-height:16px!important;margin:0 0 5px!important;color:#0f172a!important}',
      '#staff #staffNotificationEmailV686m41{width:100%!important;height:34px!important;min-height:0!important;border:1px solid #d8e1ef!important;border-radius:12px!important;background:#fff!important;color:#0f172a!important;padding:8px 10px!important;font:inherit!important;font-size:12px!important;box-sizing:border-box!important}',
      '#staff .staffEmailMsgV024{font-size:11px;color:#64748b;min-height:13px;margin-top:3px}',
      '#regularSchedule .redisInstantSavedHintV023,#regularSchedule .redisInstantSavedHintV024{display:none!important}',
      '#scheduleList .scheduleBadgeLine{visibility:hidden}',
      '#scheduleList .scheduleBadgeLine.redisBadgeReadyV024{visibility:visible}',
      '@media(max-width:1450px){#staff .staffDataStatsV5288{grid-template-columns:160px 210px minmax(230px,310px) minmax(460px,1fr)!important}}',
      '@media(max-width:1100px){#staff .staffDataStatsV5288{grid-template-columns:1fr!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function boot(){
    if (!portalReady()) return false;
    installStyles();
    cleanSharePill();
    if (regularSectionActive()) { markRegularToggleNoDirty(); loadRegularDisplayState(); }
    if (scheduleSectionActive()) { patchScheduleBadges(); }
    return true;
  }
  function bootSoon(delay){ setTimeout(function(){ if(!boot()) bootSoon(400); }, delay || 0); }

  window.addEventListener('click', function(e){
    var t = e && e.target && e.target.closest ? e.target.closest('[data-nav="regularSchedule"],[data-nav="staff"],[data-nav="schedule"],[data-action="schedule-save"],[data-action="period-meta-save"],[data-action="period-meta-add"],[data-action="period-meta-delete"]') : null;
    if (!t) return;
    setTimeout(boot, 120); setTimeout(boot, 500); setTimeout(boot, 1200);
  }, true);
  window.addEventListener('change', function(e){
    var t = e && e.target; if (!t) return;
    if (t.classList && (t.classList.contains('schedActive') || t.classList.contains('schedStart') || t.classList.contains('schedEnd') || t.classList.contains('periodMetaBlockType') || t.classList.contains('periodMetaDisplay'))) {
      setTimeout(patchScheduleBadges, 50); setTimeout(patchScheduleBadges, 250); setTimeout(patchScheduleBadges, 900);
    }
  }, true);
  var mutationTimerV024 = null;
  try { new MutationObserver(function(){
    if (!portalReady()) return;
    clearTimeout(mutationTimerV024);
    mutationTimerV024 = setTimeout(function(){
      cleanSharePill(); removeAutosaveText();
      if (regularSectionActive()) markRegularToggleNoDirty();
      if (scheduleSectionActive()) patchScheduleBadges();
    }, 250);
  }).observe(document.body, { childList:true, subtree:true }); } catch(e) {}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ bootSoon(100); }); else bootSoon(100);
  [600, 1500, 3000, 6000].forEach(function(ms){ setTimeout(function(){ boot(); }, ms); });
  try { if (typeof window.registerNavigationAfterHookV5_ === 'function') window.registerNavigationAfterHookV5_(function(page){ setTimeout(boot, 120); }, 'redisV024StaffEmailRegularBellFix'); } catch(e) {}
})();

/* ===== END ga-redis-v023-ui-patches.js ===== */

/* ===== BEGIN ga-redis-v025-ui-patches.js ===== */
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

/* ===== END ga-redis-v025-ui-patches.js ===== */

/* ===== BEGIN ga-redis-v034-ui-patches.js ===== */
(function(){
  'use strict';
  if(window.__gaRedisV034Loaded) return; window.__gaRedisV034Loaded=true;
  function by(id){return document.getElementById(id);} 
  function clean(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c;});}
  function activePage(){try{if(typeof window.activeSectionIdV51229==='function')return window.activeSectionIdV51229()||'';}catch(e){}var s=document.querySelector('.section.active');return s?s.id:'';}
  function selectedSchoolId(){try{if(typeof window.selectedSchoolPayloadV686m20==='function'){var p=window.selectedSchoolPayloadV686m20()||{};return clean(p.school||p.schoolId||p.campusId||p.selectedCampusId||'');}}catch(e){}try{var ctx=window.campusContextV5253||{};return clean(ctx.selectedCampusId||(ctx.currentCampus&&ctx.currentCampus.campusId)||ctx.schoolId||ctx.campusId||'');}catch(e2){}var sel=by('campusSelector');return sel?clean(sel.value):'';}
  function api(path,params){params=params||{};if(!params.school)params.school=selectedSchoolId();params._t=Date.now();return path+'?'+new URLSearchParams(params).toString();}
  function fetchJson(url,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(url,opts).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||j.message||('HTTP '+r.status));return j;});});}
  function setMsg(msg,type){try{if(typeof window.setMsg==='function')return window.setMsg(msg,type||'warn');}catch(e){}var el=by('globalMsg');if(el){el.className='msg '+(type||'');el.style.display=msg?'block':'none';el.textContent=msg||'';}}
  function normName(v){return clean(v).toLowerCase().replace(/\s+/g,' ');}  
  function fmtDateTime(v){
    if(!v) return '';
    if(/\d{2}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+[AP]M/i.test(String(v))) return String(v);
    var d=new Date(v); if(isNaN(d.getTime())) return String(v);
    var mm=String(d.getMonth()+1).padStart(2,'0'); var dd=String(d.getDate()).padStart(2,'0'); var yy=String(d.getFullYear()).slice(-2);
    var h=d.getHours(); var ap=h>=12?'PM':'AM'; h=h%12||12; var mi=String(d.getMinutes()).padStart(2,'0');
    return mm+'-'+dd+'-'+yy+' '+h+':'+mi+' '+ap;
  }
  function installStyles(){
    if(by('gaRedisV034Styles'))return;
    var css=[
      '.reauthErrorV034{position:relative!important;display:none;width:100%!important;max-width:none!important;box-sizing:border-box!important;margin:8px 0 10px!important;padding:10px 42px 10px 12px!important;border-radius:12px!important;border:1px solid #fecaca!important;background:#fef2f2!important;color:#991b1b!important;font-weight:400!important;line-height:1.35!important}.reauthErrorV034.active{display:block!important}.reauthErrorV034 a{font-weight:800!important;color:inherit!important;text-decoration:underline!important}.reauthErrorV034 .x{position:absolute!important;right:10px!important;top:7px!important;border:0!important;background:transparent!important;color:inherit!important;font-size:18px!important;font-weight:900!important;cursor:pointer!important}',
      '#dataManager #dataFormsActiveNoteV034{display:block!important;margin:10px 0 0!important;padding:8px 10px!important;border:1px solid #bbf7d0!important;background:#ecfdf5!important;color:#166534!important;border-radius:12px!important;font-weight:700!important;line-height:1.35!important}#dataManager .dataFormsActiveNoteV026,#dataManager .dataFormsActiveNoteV028,#dataManager .dataFormsActiveNoteV029,#dataManager .dataFormsActiveNoteV031,#dataManager #dataFormsActiveNoteV026,#dataManager #dataFormsActiveNoteV028,#dataManager #dataFormsActiveNoteV029,#dataManager #dataFormsActiveNoteV031{display:none!important}',
      '#formPickerResults.gaStableFormsV034{min-height:96px!important;max-height:380px!important;overflow:auto!important;border:1px solid #dbe3ef!important;border-radius:12px!important;padding:6px!important;background:#fff!important}.theme-dark #formPickerResults.gaStableFormsV034,body.theme-dark #formPickerResults.gaStableFormsV034,body[data-theme="dark"] #formPickerResults.gaStableFormsV034{background:#111827!important;border-color:#334155!important}.gaStableFormsV034 .searchResultBtn{display:block!important;width:100%!important;text-align:left!important;margin:4px 0!important;white-space:normal!important}',
      '#staff .staffDataStatsV5288{display:grid!important;grid-template-columns:170px 150px 310px 360px 165px!important;gap:8px!important;align-items:end!important;grid-column:1/-1!important;width:100%!important;max-width:none!important;margin-top:8px!important;overflow:visible!important}',
      '#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffPortalLinkFieldV5312,#staff #staffLastViewFieldV034{grid-column:auto!important;width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;align-self:end!important;box-sizing:border-box!important}',
      '#staff #staffDataSubmittedFieldV5288 input,#staff #staffDataPointsFieldV5288 input,#staff #staffEmailFieldV024 input,#staff .staffEmailFieldV024 input,#staff #staffPortalLinkFieldV5312 input,#staff #staffLastViewFieldV034 input{width:100%!important;min-width:0!important;box-sizing:border-box!important;height:32px!important;min-height:0!important;font-size:12px!important;font-weight:400!important}',
      '#staff #staffDataPointsFieldV5288 .staffDataContributionLineV5301{display:grid!important;grid-template-columns:minmax(0,1fr) 58px!important;gap:6px!important;align-items:center!important}',
      '#staff #staffEmailFieldV024 .staffEmailInputLockWrapV025,#staff .staffEmailFieldV024 .staffEmailInputLockWrapV025{display:grid!important;grid-template-columns:minmax(0,1fr) 26px!important;gap:4px!important;align-items:center!important}',
      '#staff #staffPortalLinkFieldV5312 .staffPortalLinkLineV5312,#staff #staffPortalLinkFieldV5312 .inline{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:6px!important;align-items:center!important}',
      '#staff #staffPortalLinkFieldV5312 input{font-size:12px!important}',
      '#staff #staffLastViewV034.staleV034{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important;font-weight:400!important}',
      '#staff #staffLastViewV034{font-weight:400!important;color:#475569!important}',
      '#staffEmailLockBtnV025,.staffEmailLockBtnV025.historyRegularBtn,.staffEmailLockBtnV025.historyLockV018{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#94a3b8!important;width:26px!important;min-width:26px!important;height:32px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;transition:none!important}',
      '#staffEmailLockBtnV025.active,#staffEmailLockBtnV025[aria-pressed="true"]{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#d4a017!important}',
      '#studentMaxGroupSize.maxGroupZeroV034{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important}',
      '.communicationManagerGridV034{display:grid;grid-template-columns:1fr;gap:12px}.communicationManagerCardV034{border:1px solid #dbe3ef;border-radius:14px;padding:12px;background:#fff}.v034Table{width:100%;border-collapse:collapse}.v034Table th,.v034Table td{border-bottom:1px solid #e5edf7;padding:7px;text-align:left;vertical-align:top}.v034Table th{font-size:12px;color:#64748b;background:#f8fafc}.commEmailRowV034{display:grid;grid-template-columns:minmax(220px,1fr) 64px;gap:6px;align-items:center}.commShareBtnV034{background:#dcfce7!important;border-color:#86efac!important;color:#166534!important;font-weight:900!important;border-radius:12px!important}.staleV034{background:#fef2f2!important;color:#991b1b!important}.okV034{font-weight:800;color:#166534}.errV034{font-weight:800;color:#991b1b}.commLogActionsV034{display:flex;gap:8px;align-items:center;margin-bottom:8px}.logNoteV034{font-size:12px;color:#64748b}',
      '#appearanceCardV034 select{max-width:240px}.settingsUtilityCardV034{margin-top:12px}',
      'body.darkModeV034{--bg:#0f172a;--card:#172033;--text:#f8fafc;--muted:#cbd5e1;--line:#334155;background:#0f172a!important;color:#f8fafc!important}body.darkModeV034 .card,body.darkModeV034 .communicationManagerCardV034{background:#172033!important;border-color:#334155!important;color:#f8fafc!important}body.darkModeV034 input,body.darkModeV034 select,body.darkModeV034 textarea{background:#0f172a!important;color:#f8fafc!important;border-color:#475569!important}body.darkModeV034 .btn:not(.primary):not(.danger):not(.commShareBtnV034){background:#fff!important;color:#111827!important}body.darkModeV034 .muted{color:#cbd5e1!important}',
      '@media(max-width:1400px){#staff .staffDataStatsV5288{grid-template-columns:155px 135px 280px 315px 155px!important;gap:7px!important}}@media(max-width:1120px){#staff .staffDataStatsV5288{grid-template-columns:repeat(2,minmax(220px,1fr))!important}}@media(max-width:760px){#staff .staffDataStatsV5288{grid-template-columns:1fr!important}}'
    ].join('\n');
    var st=document.createElement('style');st.id='gaRedisV034Styles';st.textContent=css;document.head.appendChild(st);
  }
  function normalizeTitle(){
    var pt=by('pageTitle');
    document.querySelectorAll('[data-nav="scheduleChanges"]').forEach(function(b){b.textContent='Schedule Analysis';});
    document.querySelectorAll('[data-nav="communicationManager"],#communicationManagerNavV034,#communicationManagerNavV028').forEach(function(b){b.textContent='Communication Manager';});
    if(pt){if(clean(pt.textContent)==='communicationManager')pt.textContent='Communication Manager'; if(/Schedule Changes|Schedule Compare/i.test(pt.textContent))pt.textContent='Schedule Analysis'; var txt=clean(pt.textContent); if(txt)document.title=txt+' - Support Schedules';}
    else if(/^GA Schedule|GA Scheduler|Admin Portal|Support Schedules/i.test(document.title||'')){document.title='Support Schedules';}
  }
  function cleanSharePill(){
    document.querySelectorAll('#shareSchedulesPillV686m26,.shareSchedulesPillV686m26').forEach(function(pill){
      pill.querySelectorAll('i,.fa,.fa-solid,.fa-regular,svg').forEach(function(icon){try{icon.remove();}catch(e){}});
      var main=pill.querySelector('.shareMainV018,[data-redis-v018-action="share-open"]')||pill; if(/share/i.test(clean(main.textContent))||main!==pill)main.textContent='Share Schedules';
    });
  }
  function installReauthError(){
    var msg=by('globalMsg'); if(!msg || by('reauthErrorV034')) return;
    var box=document.createElement('div'); box.id='reauthErrorV034'; box.className='reauthErrorV034';
    box.innerHTML='<span>Google Drive/Forms access needs attention. <a href="/auth/logout">Sign out</a> and sign back in again.</span><button class="x" type="button" data-v034-action="close-reauth" aria-label="Close">×</button>';
    msg.parentNode.insertBefore(box,msg.nextSibling);
  }
  function refreshReauthError(){
    var box=by('reauthErrorV034'); if(!box || box.dataset.dismissed==='1')return;
    fetchJson(api('/api/v027/diagnostics')).then(function(j){
      if(!j.googleAccessTokenPresent || !j.googleFormsSearchOk) box.classList.add('active'); else box.classList.remove('active');
      updateDataFormsNote(j && j.googleFormsSearchOk);
    }).catch(function(){box.classList.add('active'); updateDataFormsNote(false);});
  }
  function updateDataFormsNote(ok){
    var dm=by('dataManager'); if(!dm)return;
    dm.querySelectorAll('#dataFormsActiveNoteV026,#dataFormsActiveNoteV028,#dataFormsActiveNoteV029,#dataFormsActiveNoteV031,.dataFormsActiveNoteV026,.dataFormsActiveNoteV028,.dataFormsActiveNoteV029,.dataFormsActiveNoteV031').forEach(function(n){try{n.remove();}catch(e){}});
    var note=by('dataFormsActiveNoteV034'); if(!note){note=document.createElement('div');note.id='dataFormsActiveNoteV034';}
    note.textContent= ok===false ? 'Google Forms access needs attention.' : 'Google Forms link is active.';
    var card=dm.querySelector('.card')||dm; card.appendChild(note);
  }

  var formSeq=0;
  function renderForms(rows){
    var box=by('formPickerResults'); if(!box)return;
    rows=rows||[]; box.classList.add('gaStableFormsV034');
    if(!rows.length){box.innerHTML='<div class="muted"><b>No accessible Google Forms found.</b><br>Try Show All, search a different form name, or paste the Form URL/file ID above.</div>';return;}
    box.innerHTML=rows.map(function(r){
      var meta=[]; if(r.source)meta.push(r.source); if(r.updated)meta.push('Modified '+r.updated); if(r.driveName&&r.driveName!==r.name)meta.push('Drive file name '+r.driveName); if(r.formTitle&&r.formTitle!==r.name)meta.push('Form title '+r.formTitle);
      var url=r.url||r.editUrl||r.responderUri||'';
      return '<button type="button" class="searchResultBtn" data-form-url="'+esc(url)+'"><strong>'+esc(r.name||r.driveName||r.formTitle||'Untitled Google Form')+'</strong><div class="dashMeta">'+esc(meta.join(' · '))+'</div></button>';
    }).join('');
  }
  function patchFormPickerText(){
    var modal=by('formPickerModal'); if(!modal)return;
    var search=by('formPickerSearch'); if(search) search.placeholder='Search forms by name or leave blank';
    var manual=by('formPickerManual'); if(manual) manual.placeholder='Paste a Google Form URL or file ID';
    var help=by('formPickerHelpV5215')||by('formPickerHelpV5218'); if(help){help.id='formPickerHelpV5215'; help.textContent='Select a Google Form accessible to your signed-in Google account. No DATA_FILE name or special sharing rule is required.';}
    var box=by('formPickerResults'); if(box) box.classList.add('gaStableFormsV034');
  }
  function stableSearchForms(showAll){
    patchFormPickerText(); var modal=by('formPickerModal'); if(modal)modal.classList.add('active');
    var q=by('formPickerSearch'); if(showAll&&q)q.value=''; var query=q?clean(q.value):'';
    var box=by('formPickerResults'); if(box){box.classList.add('gaStableFormsV034'); box.innerHTML='<div class="muted">Searching accessible Google Forms...</div>';}
    var seq=++formSeq;
    return fetchJson('/api/google/forms/search-v026?'+new URLSearchParams({query:query,limit:'100',_t:String(Date.now())}).toString()).then(function(j){if(seq!==formSeq)return;renderForms(j.rows||j.forms||[]);}).catch(function(err){
      if(seq!==formSeq)return;
      if(box)box.innerHTML='<div class="muted"><b>Could not search Google Forms.</b><br>'+esc(err.message||err)+'</div>';
    });
  }
  function openFormPickerStable(target,row,name){
    try{window.formPickerTargetRow=row||null; formPickerTargetRow=row||null;}catch(e){}
    var m=by('formPickerModal'); if(m)m.classList.add('active');
    var q=by('formPickerSearch'); if(q)q.value=name||((by('studentName')&&by('studentName').value)||'');
    stableSearchForms(!name);
  }
  function useManualForm(){
    patchFormPickerText(); var input=by('formPickerManual'), msg=by('formPickerManualMsg'), raw=input?clean(input.value):'';
    if(!raw){if(msg)msg.textContent='Paste a Google Form URL or file ID first.';return;}
    if(msg)msg.textContent='Validating Google Form...';
    fetchJson('/api/google/forms/validate-v026',{method:'POST',body:JSON.stringify({input:raw})}).then(function(j){var r=j.row||j;if(input)input.value='';if(msg)msg.textContent='Validated '+(r.name||r.driveName||r.formTitle||'Google Form')+'.';chooseFormUrl(r.url||r.editUrl||raw);}).catch(function(e){if(msg)msg.textContent='That Google Form could not be validated: '+(e.message||e);});
  }
  function openDriveFormsSearch(){var q='type:forms'; var s=by('formPickerSearch'); if(s&&clean(s.value))q+=' '+clean(s.value); window.open('https://drive.google.com/drive/search?q='+encodeURIComponent(q),'_blank'); var msg=by('formPickerManualMsg'); if(msg)msg.textContent='Drive search opened in a new tab.';}
  function chooseFormUrl(url){try{if(typeof window.chooseGoogleForm==='function')return window.chooseGoogleForm(url);}catch(e){}var m=by('formPickerModal');if(m)m.classList.remove('active');var row=null;try{row=window.formPickerTargetRow||formPickerTargetRow||null;}catch(e2){row=window.formPickerTargetRow||null;}if(row){var input=document.querySelector('[data-data-url-row="'+row+'"]'); if(input)input.value=url;}else if(by('studentDataFiles'))by('studentDataFiles').value=url;}
  function installFormPickerOverrides(){
    window.searchForms=function(showAll){return stableSearchForms(!!showAll);};
    window.searchGoogleFormsFromPortal=function(){return stableSearchForms(false);};
    window.useManualGoogleFormFromPortal=useManualForm;
    window.openDriveDataFileSearchFromPortal=openDriveFormsSearch;
    try{searchForms=window.searchForms;}catch(e){} try{searchGoogleFormsFromPortal=window.searchGoogleFormsFromPortal;}catch(e2){} try{useManualGoogleFormFromPortal=useManualForm;}catch(e3){} try{openDriveDataFileSearchFromPortal=openDriveFormsSearch;}catch(e4){}
  }

  var accessCache=null, accessAt=0;
  function getStaffName(){var n=by('staffName'); return n?clean(n.value):'';}
  function loadAccess(cb){if(accessCache&&Date.now()-accessAt<10000){cb(accessCache);return;}fetchJson(api('/api/v027/staff-portal/access-summary')).then(function(j){accessCache=j;accessAt=Date.now();cb(j);}).catch(function(){cb(null);});}
  function ensureStaffRow(){
    var wrap=document.querySelector('#staff .staffDataStatsV5288'); if(!wrap) return;
    var lastData=by('staffLastDataSubmittedV5288'), points=by('staffDataPointsContributedV5288');
    var lastField=lastData&&(lastData.closest('.staffDataFieldV5289')||lastData.parentNode); if(lastField)lastField.id='staffDataSubmittedFieldV5288';
    var pointsField=points&&(points.closest('.staffDataFieldV5289')||points.parentNode); if(pointsField)pointsField.id='staffDataPointsFieldV5288';
    var email=by('staffEmailFieldV024');
    if(!email){
      var input=by('staffNotificationEmailV686m41');
      email=document.createElement('div'); email.id='staffEmailFieldV024'; email.className='staffEmailFieldV024 staffDataFieldV5289';
      email.innerHTML='<label>Email <span class="helpDot" tabindex="0" data-tip="Email address used for schedule communication.">?</span></label><input id="staffNotificationEmailV686m41" class="staffEmailInputV024" type="email" autocomplete="email"><div id="staffEmailMsgV024" class="staffEmailMsgV024"></div>';
      if(input){try{input.remove();}catch(e){}}
    }
    var link=by('staffPortalLinkFieldV5312');
    var lastView=by('staffLastViewFieldV034')||by('staffLastViewFieldV028');
    if(!lastView){lastView=document.createElement('div'); lastView.id='staffLastViewFieldV034'; lastView.className='staffDataFieldV5289'; lastView.innerHTML='<label>Last View</label><input id="staffLastViewV034" class="staffDataReadonlyV5289" readonly disabled value="">';}
    else{lastView.id='staffLastViewFieldV034'; var inp=lastView.querySelector('input'); if(inp)inp.id='staffLastViewV034';}
    var cur=by('staffCurrentScheduleFieldV028'); if(cur)cur.remove();
    [lastField,pointsField,email,link,lastView].filter(Boolean).forEach(function(el){wrap.appendChild(el);});
    var lock=by('staffEmailLockBtnV025'); if(lock){lock.classList.add('historyRegularBtn','historyLockV018'); lock.innerHTML='<i class="fa-solid fa-lock" aria-hidden="true"></i>'; lock.setAttribute('aria-pressed',lock.classList.contains('active')||lock.dataset.locked==='1'?'true':'false');}
    updateLastView();
  }
  function updateLastView(){
    var lv=by('staffLastViewV034'); if(!lv)return;
    var name=getStaffName(); if(!name){lv.value=''; lv.classList.remove('staleV034'); return;}
    loadAccess(function(j){var rows=(j&&j.staff)||[]; var r=rows.find(function(x){return normName(x.staff)===normName(name);}); if(!r){lv.value='Not viewed'; lv.classList.add('staleV034'); return;} lv.value=r.lastViewed||'Not viewed'; var stale=!!(r.lastViewedRaw||r.lastViewed) && r.viewedAfterPublish===false; if(!r.lastViewed && j && j.publishedAt) stale=true; lv.classList.toggle('staleV034',stale);});
  }
  function patchStudentMaxGroup(){var el=by('studentMaxGroupSize'); if(!el)return; var upd=function(){el.classList.toggle('maxGroupZeroV034',clean(el.value)==='0');}; if(!el.__v034Max){el.__v034Max=true;el.addEventListener('input',upd,true);el.addEventListener('change',upd,true);} upd();}

  function ensureCommunicationManager(){
    var nav=document.querySelector('.nav'); if(nav && !document.querySelector('[data-nav="communicationManager"]')){var ref=document.querySelector('[data-nav="dataManager"]')||document.querySelector('[data-nav="staff"]'); var btn=document.createElement('button'); btn.id='communicationManagerNavV034'; btn.setAttribute('data-nav','communicationManager'); btn.textContent='Communication Manager'; if(ref&&ref.parentNode)ref.parentNode.insertBefore(btn,ref.nextSibling); else nav.appendChild(btn);}
    var main=document.querySelector('main'); if(main && !by('communicationManager')){var sec=document.createElement('section'); sec.id='communicationManager'; sec.className='section'; sec.innerHTML='<div class="card"><div class="toolbar" style="justify-content:flex-end;align-items:center"><button class="btn commShareBtnV034" data-v034-action="open-share-schedules">Relaunch Share Schedules</button></div><div id="communicationManagerBodyV034" class="communicationManagerGridV034" style="margin-top:12px"></div></div>'; var settings=by('settings'); if(settings)main.insertBefore(sec,settings); else main.appendChild(sec);}
  }
  function loadCommunicationManager(){
    ensureCommunicationManager(); var box=by('communicationManagerBodyV034'); if(!box)return; box.innerHTML='<div class="communicationManagerCardV034 muted">Loading communication details...</div>';
    Promise.all([fetchJson(api('/api/v027/staff-portal/access-summary')).catch(function(e){return {error:e.message,staff:[]};}),fetchJson(api('/api/v027/communication/log',{limit:'75'})).catch(function(e){return {error:e.message,rows:[]};})]).then(function(arr){
      var access=arr[0]||{}, log=arr[1]||{}, staff=access.staff||[], rows=log.rows||[];
      box.innerHTML='<div class="communicationManagerCardV034"><h3>Staff Portal Access</h3><div class="muted">Times before the latest published schedule are shown in red. Edit emails here, then click Save.</div><table class="v034Table"><thead><tr><th>Staff</th><th>Email</th><th>Last Viewed</th><th>Current Schedule</th></tr></thead><tbody>'+staff.map(function(r){return '<tr><td>'+esc(r.staff)+'</td><td><div class="commEmailRowV034"><input class="commEmailInputV034" data-staff="'+esc(r.staff)+'" data-row="'+esc(r.rowIndex||'')+'" value="'+esc(r.email||'')+'"><button class="btn small" data-v034-action="save-comm-email">Save</button></div></td><td class="'+(r.stale?'staleV034':'')+'">'+esc(r.lastViewed||'Not viewed')+'</td><td>'+(r.viewedAfterPublish?'<span class="okV034">Yes</span>':'<span class="errV034">No</span>')+'</td></tr>';}).join('')+'</tbody></table></div><div class="communicationManagerCardV034"><h3>Communication Log</h3><div class="commLogActionsV034"><button class="btn danger" data-v034-action="clear-comm-log">Clear Communication Log</button><span class="logNoteV034">Showing latest 75 records. Stored log is capped at 250 records.</span></div>'+(rows.length?'<table class="v034Table"><thead><tr><th>When</th><th>Mode/Action</th><th>Staff</th><th>Status</th><th>Details</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+esc(r.timestamp||'')+'</td><td>'+esc(r.mode||r.action||'')+'</td><td>'+esc(r.staff||r.target||'')+'</td><td>'+esc(r.status||'')+'</td><td>'+esc(r.message||r.detail||r.recipient||'')+'</td></tr>';}).join('')+'</tbody></table>':'<p class="muted">No communication entries yet.</p>')+'</div>';
    });
  }
  function saveCommEmail(btn){var row=btn.closest('tr'), input=row&&row.querySelector('.commEmailInputV034'); if(!input)return; var staff=input.getAttribute('data-staff')||'', email=input.value||'', rowIndex=input.getAttribute('data-row')||''; btn.disabled=true; btn.textContent='Saving...'; fetchJson('/api/staff/email-v022',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),staff:staff,rowIndex:rowIndex,email:email})}).then(function(){setMsg('Saved email for '+staff+'.','ok'); accessCache=null; btn.textContent='Saved'; setTimeout(function(){btn.disabled=false;btn.textContent='Save';},700); setTimeout(function(){var gm=by('globalMsg'); if(gm && /Saved email for/.test(gm.textContent||'')){gm.textContent=''; gm.style.display='none';}},1800);}).catch(function(e){btn.disabled=false;btn.textContent='Save';setMsg('Could not save email for '+staff+': '+e.message,'err');});}
  function clearCommunicationLog(){if(!confirm('Clear the Communication Log for this school?'))return; fetchJson('/api/v029/communication/log/clear',{method:'POST',body:JSON.stringify({school:selectedSchoolId()})}).then(function(){setMsg('Communication Log cleared.','ok');loadCommunicationManager();}).catch(function(e){setMsg('Could not clear Communication Log: '+e.message,'err');});}
  function openShareSchedules(){var p=by('shareSchedulesPillV686m26')||document.querySelector('.shareSchedulesPillV686m26'); if(p){var m=p.querySelector('[data-redis-v018-action="share-open"],.shareMainV018')||p;m.click();} else setMsg('Share Schedules is not ready yet. Publish a schedule first.','warn');}

  function ensureSettingsCards(){
    var settings=by('settings'); if(!settings)return;
    if(!by('appearanceCardV034')){var card=document.createElement('div'); card.id='appearanceCardV034'; card.className='card settingsUtilityCardV034'; card.innerHTML='<h2>Appearance</h2><label>Mode</label><select id="themeSelectV034"><option value="light">Light</option><option value="dark">Dark (BETA)</option></select>'; settings.appendChild(card); var saved='light'; try{saved=localStorage.getItem('gaThemeV034')||localStorage.getItem('gaThemeV027')||'light';}catch(e){} by('themeSelectV034').value=saved==='dark'?'dark':'light'; applyTheme();}
    if(!by('diagnosticsCardV034')){var d=document.createElement('div'); d.id='diagnosticsCardV034'; d.className='card settingsUtilityCardV034'; d.innerHTML='<h2>Diagnostics Mode</h2><div class="muted">Optional troubleshooting details for the current deployment. Leave off during normal use.</div><label class="miniCheck"><input id="diagnosticsToggleV034" type="checkbox" style="width:auto;margin-right:6px"> Show diagnostics</label><div id="diagnosticsBoxV034" class="muted" style="display:none;margin-top:8px"></div>'; settings.appendChild(d);}
    if(!by('settingsAuditCardV034')){var a=document.createElement('div'); a.id='settingsAuditCardV034'; a.className='card settingsUtilityCardV034'; a.innerHTML='<h2>Saved Settings Review</h2><div class="muted">Read-only review of selected saved settings.</div><div class="toolbar" style="margin-top:8px"><button class="btn" data-v034-action="load-settings-audit">Load Saved Settings</button></div><div id="settingsAuditBodyV034" style="margin-top:8px"></div>'; settings.appendChild(a);}
  }
  function applyTheme(){var sel=by('themeSelectV034'); var v=sel?sel.value:'light'; document.body.classList.toggle('darkModeV034',v==='dark'); try{localStorage.setItem('gaThemeV034',v);}catch(e){}}
  function loadDiagnostics(){var box=by('diagnosticsBoxV034'); if(!box)return; box.style.display=(by('diagnosticsToggleV034')&&by('diagnosticsToggleV034').checked)?'block':'none'; if(box.style.display==='none')return; box.textContent='Loading diagnostics...'; fetchJson(api('/api/v027/diagnostics')).then(function(j){box.innerHTML='<pre style="white-space:pre-wrap;margin:0">'+esc(JSON.stringify(j,null,2))+'</pre>';}).catch(function(e){box.textContent='Could not load diagnostics: '+e.message;});}
  function loadSettingsAudit(){var box=by('settingsAuditBodyV034'); if(!box)return; box.innerHTML='<div class="muted">Loading saved settings...</div>'; fetchJson(api('/api/v027/settings-audit')).then(function(j){var rows=j.settings||[]; box.innerHTML='<table class="v034Table"><thead><tr><th>Setting</th><th>Saved Value</th><th>Key</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+esc(r.label)+'</td><td>'+esc(r.value)+'</td><td>'+esc(r.key)+'</td></tr>';}).join('')+'</tbody></table>';}).catch(function(e){box.innerHTML='<div class="errV034">Could not load saved settings: '+esc(e.message)+'</div>';});}
  function ensureScheduleAnalysis(){
    document.querySelectorAll('[data-nav="scheduleChanges"]').forEach(function(b){b.textContent='Schedule Analysis';}); var sec=by('scheduleChanges'); if(!sec)return; if(!by('scheduleExplainCardV034')){var card=document.createElement('div'); card.id='scheduleExplainCardV034'; card.className='card'; card.style.marginTop='12px'; card.innerHTML='<h2>Explain Assignment Logic</h2><div class="muted">Review assignment explanations from the current published schedule.</div><div class="toolbar" style="margin-top:8px"><button class="btn" data-v034-action="load-schedule-explain">Load Explanations</button></div><div id="scheduleExplainBodyV034" style="margin-top:8px"></div>'; sec.appendChild(card);} }
  function loadScheduleExplain(){var box=by('scheduleExplainBodyV034'); if(!box)return; box.innerHTML='<div class="muted">Loading assignment explanations...</div>'; fetchJson(api('/api/v027/schedule/explain')).then(function(j){var rows=j.rows||[]; box.innerHTML=rows.length?'<div class="compactList">'+rows.map(function(r){return '<details class="dashItem"><summary><b>'+esc(r.staff||'Staff')+'</b> · '+esc(r.period||'')+' · '+esc(r.assignment||'')+'</summary><ul>'+((r.why||[]).map(function(w){return '<li>'+esc(w)+'</li>';}).join('')||'<li>No explanation details found.</li>')+'</ul></details>';}).join('')+'</div>':'<div class="muted">No published assignment explanations found.</div>';}).catch(function(e){box.innerHTML='<div class="errV034">Could not load assignment explanations: '+esc(e.message)+'</div>';});}

  function boot(){installStyles(); installFormPickerOverrides(); installReauthError(); normalizeTitle(); cleanSharePill(); patchFormPickerText(); ensureCommunicationManager(); ensureSettingsCards(); ensureScheduleAnalysis(); var p=activePage(); if(p==='staff')ensureStaffRow(); if(p==='students')patchStudentMaxGroup(); if(p==='dataManager'){updateDataFormsNote(); refreshReauthError();} if(p==='communicationManager')loadCommunicationManager();}
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest&&e.target.closest('[data-action],[data-v034-action],[data-nav],.searchResultBtn[data-form-url]'); if(!t)return;
    var a=t.getAttribute('data-v034-action')||t.getAttribute('data-action')||'';
    if(a==='close-reauth'){e.preventDefault();var box=by('reauthErrorV034');if(box){box.dataset.dismissed='1';box.classList.remove('active');}return;}
    if(a==='form-picker-search'){e.preventDefault();e.stopImmediatePropagation();stableSearchForms(false);return false;}
    if(a==='form-picker-browse'){e.preventDefault();e.stopImmediatePropagation();var q=by('formPickerSearch');if(q)q.value='';stableSearchForms(true);return false;}
    if(a==='form-picker-use-manual'){e.preventDefault();e.stopImmediatePropagation();useManualForm();return false;}
    if(a==='form-picker-drive-search'){e.preventDefault();e.stopImmediatePropagation();openDriveFormsSearch();return false;}
    if(a==='data-select-form'){e.preventDefault();e.stopImmediatePropagation();var tr=t.closest('tr');openFormPickerStable('data',t.getAttribute('data-data-row')||'',tr?tr.getAttribute('data-student-name')||'':'');return false;}
    if(a==='student-select-form'){e.preventDefault();e.stopImmediatePropagation();openFormPickerStable('student',null,(by('studentName')&&by('studentName').value)||'');return false;}
    if(t.classList&&t.classList.contains('searchResultBtn')&&t.getAttribute('data-form-url')){e.preventDefault();e.stopImmediatePropagation();chooseFormUrl(t.getAttribute('data-form-url'));return false;}
    if(a==='open-share-schedules'){e.preventDefault();openShareSchedules();return;}
    if(a==='save-comm-email'){e.preventDefault();saveCommEmail(t);return;}
    if(a==='clear-comm-log'){e.preventDefault();clearCommunicationLog();return;}
    if(a==='load-settings-audit'){e.preventDefault();loadSettingsAudit();return;}
    if(a==='load-schedule-explain'){e.preventDefault();loadScheduleExplain();return;}
    var nav=t.getAttribute('data-nav'); if(nav){setTimeout(function(){normalizeTitle(); if(nav==='staff')ensureStaffRow(); if(nav==='students')patchStudentMaxGroup(); if(nav==='dataManager'){updateDataFormsNote(); refreshReauthError();} if(nav==='communicationManager')loadCommunicationManager(); if(nav==='scheduleChanges')ensureScheduleAnalysis();},220);}
  },true);
  document.addEventListener('change',function(e){if(e.target&&e.target.id==='themeSelectV034')applyTheme(); if(e.target&&e.target.id==='diagnosticsToggleV034')loadDiagnostics(); if(e.target&&e.target.id==='studentMaxGroupSize')patchStudentMaxGroup();},true);
  document.addEventListener('input',function(e){if(e.target&&e.target.id==='studentMaxGroupSize')patchStudentMaxGroup(); if(e.target&&e.target.id==='staffName')setTimeout(updateLastView,80);},true);
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#staffList .active,#staffList [data-staff-row],#staffList button')){accessCache=null;setTimeout(function(){ensureStaffRow();updateLastView();},260);}},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,80);}); else setTimeout(boot,80);
  [350,1000,2200,4200].forEach(function(ms){setTimeout(boot,ms);});
})();

// V0.34 hard safety layer: bypass legacy Calendar/Attendance render paths and force Staff Manager inline row.
(function(){
  'use strict';
  if(true){ window.__gaRedisV034SafePagesLoaded=true; return; } window.__gaRedisV034SafePagesLoaded=true;
  function by(id){return document.getElementById(id);} 
  function clean(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c;});}
  function schoolPayload(){
    try{ if(typeof window.selectedSchoolPayloadV686m20==='function'){var p=window.selectedSchoolPayloadV686m20()||{}; if(p.campusId||p.schoolId||p.school||p.spreadsheetId)return p;} }catch(e){}
    try{ if(typeof window.selectedSchoolPayloadV683==='function'){var q=window.selectedSchoolPayloadV683()||{}; if(q.campusId||q.schoolId||q.school||q.spreadsheetId)return q;} }catch(e2){}
    try{var sel=by('campusSelector');var opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;var ctx=window.campusContextV5253||{};var cur=ctx.currentCampus||{};var id=clean((sel&&sel.value)||ctx.selectedCampusId||cur.campusId||'');return {school:id,schoolId:id,campusId:id,schoolName:clean(cur.campusName||(opt&&opt.textContent)||id),campusName:clean(cur.campusName||(opt&&opt.textContent)||id),spreadsheetId:clean(cur.spreadsheetId||(opt&&opt.getAttribute('data-spreadsheet-id'))||'')};}catch(e3){return {};}
  }
  function schoolId(){var p=schoolPayload();return clean(p.school||p.schoolId||p.campusId||'');}
  function api(path,params){params=params||{};if(!params.school)params.school=schoolId();params._t=Date.now();return path+'?'+new URLSearchParams(params).toString();}
  function fetchJson(url,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(url,opts).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||j.message||('HTTP '+r.status));return j;});});}
  function setMsg(msg,type){try{if(typeof window.setMsg==='function')return window.setMsg(msg,type||'warn');}catch(e){}var el=by('globalMsg');if(el){el.textContent=msg||'';el.className='msg '+(type||'');el.style.display=msg?'block':'none';}}
  function installStyles(){
    if(by('gaRedisV034HardFixStyles'))return;
    var st=document.createElement('style');st.id='gaRedisV034HardFixStyles';
    st.textContent=[
      '#staff .staffDataStatsV5288{display:flex!important;flex-wrap:nowrap!important;gap:8px!important;align-items:flex-end!important;width:100%!important;max-width:none!important;overflow-x:auto!important;grid-template-columns:none!important;margin-top:8px!important}',
      '#staff #staffDataSubmittedFieldV5288{flex:0 0 180px!important;min-width:180px!important;max-width:180px!important}',
      '#staff #staffDataPointsFieldV5288{flex:0 0 194px!important;min-width:194px!important;max-width:194px!important}',
      '#staff #staffEmailFieldV024,#staff .staffEmailFieldV024{flex:0 1 350px!important;min-width:280px!important;max-width:350px!important}',
      '#staff #staffPortalLinkFieldV5312{flex:0 1 285px!important;min-width:235px!important;max-width:285px!important}',
      '#staff #staffLastViewFieldV034,#staff #staffLastViewFieldV033,#staff #staffLastViewFieldV028{flex:0 0 205px!important;min-width:205px!important;max-width:205px!important}',
      '#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffPortalLinkFieldV5312,#staff #staffLastViewFieldV034,#staff #staffLastViewFieldV033,#staff #staffLastViewFieldV028{width:auto!important;grid-column:auto!important;margin:0!important;align-self:flex-end!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important}',
      '#staff .staffDataStatsV5288 label{font-size:12px!important;line-height:16px!important;min-height:16px!important;margin:0 0 5px!important;white-space:nowrap!important}',
      '#staff #staffPortalLinkFieldV5312 .staffPortalLinkLineV5312,#staff #staffPortalLinkFieldV5312 .inline{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:6px!important;align-items:center!important}',
      '#staff #staffEmailFieldV024 .staffEmailInputLockWrapV025,#staff .staffEmailFieldV024 .staffEmailInputLockWrapV025{display:grid!important;grid-template-columns:minmax(0,1fr) 26px!important;gap:4px!important;align-items:center!important}',
      '#staff #staffPortalLinkV5312,#staff #staffNotificationEmailV686m41,#staff #staffLastViewV034,#staff #staffLastViewV033,#staff #staffLastViewV028,#staff #staffLastDataSubmittedV5288,#staff #staffDataPointsContributedV5288{height:32px!important;min-height:32px!important;font-size:12px!important;font-weight:400!important;box-sizing:border-box!important;width:100%!important;min-width:0!important}',
      '#staff #staffLastViewV034,#staff #staffLastViewV033,#staff #staffLastViewV028{font-weight:400!important;color:#475569!important;background:#f8fafc!important}',
      '#staff #staffLastViewV034.staleV034,#staff #staffLastViewV033.staleV034,#staff #staffLastViewV028.staleV034{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important;font-weight:400!important}',
      '#staffEmailLockBtnV025{transition:none!important}',
      '.v034SafePageNotice{border:1px solid #dbe3ef;background:#f8fafc;border-radius:12px;padding:8px 10px;margin:0 0 10px;color:#475569;font-size:12px}.v034SafeTable{width:100%;border-collapse:collapse}.v034SafeTable th,.v034SafeTable td{border:1px solid #e5edf7;padding:6px 7px;font-size:12px;text-align:left;vertical-align:top}.v034SafeTable th{background:#f8fafc;color:#475569}.v034CalGrid{display:grid;grid-template-columns:repeat(5,minmax(160px,1fr));gap:8px}.v034CalDay{border:1px solid #dbe3ef;border-radius:12px;padding:8px;background:#fff}.v034CalDay.out{opacity:.62}.v034CalHead{display:flex;justify-content:space-between;gap:6px;font-weight:800;margin-bottom:6px}.v034CalDay select,.v034CalDay input.note{width:100%;margin-top:6px}.v034AttendanceScroll{overflow:auto;max-height:68vh}.v034DiagLinks{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.v034DiagLinks a{font-size:12px;color:#2563eb;font-weight:800}',
      'body.darkModeV034 .v034CalDay,body.darkModeV034 .v034SafeTable th{background:#172033!important;border-color:#334155!important;color:#f8fafc!important}body.darkModeV034 .v034SafePageNotice{background:#172033!important;border-color:#334155!important;color:#cbd5e1!important}',
      '@media(max-width:1500px){#staff #staffDataSubmittedFieldV5288{flex-basis:165px!important;min-width:165px!important;max-width:165px!important}#staff #staffDataPointsFieldV5288{flex-basis:180px!important;min-width:180px!important;max-width:180px!important}#staff #staffEmailFieldV024,#staff .staffEmailFieldV024{flex-basis:320px!important;max-width:320px!important}#staff #staffPortalLinkFieldV5312{flex-basis:255px!important;max-width:255px!important}#staff #staffLastViewFieldV034,#staff #staffLastViewFieldV033,#staff #staffLastViewFieldV028{flex-basis:190px!important;min-width:190px!important;max-width:190px!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function activate(page,btn,label){
    document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active');});
    var sec=by(page); if(sec)sec.classList.add('active');
    document.querySelectorAll('.nav button').forEach(function(b){b.classList.remove('active');});
    if(btn)btn.classList.add('active'); else {var nb=document.querySelector('[data-nav="'+page+'"]'); if(nb)nb.classList.add('active');}
    var pt=by('pageTitle'); if(pt)pt.textContent=label||page; document.title=(label||page)+' - Support Schedules';
  }
  var calDate=new Date(); calDate.setDate(1);
  function optionHtml(names,val){var out='<option value=""></option>'; (names||[]).forEach(function(n){out+='<option value="'+esc(n)+'" '+(String(n)===String(val)?'selected':'')+'>'+esc(n)+'</option>';}); return out;}
  function renderCalendarShell(){
    var sec=by('calendar'); if(!sec)return null;
    sec.innerHTML='<div class="card"><div class="v034SafePageNotice"><b>Calendar Manager safe renderer v034.</b> This bypasses the legacy Calendar load path that was crashing the browser. <span class="v034DiagLinks"><a href="#" data-v034safe-action="calendar-reload">Reload safe calendar</a></span></div><div class="portalCalendarTools"><div><div id="portalCalTitle" class="calendarMonthTitle">Loading...</div></div><div><label>Bulk schedule</label><select id="portalBulkSchedule"></select></div><button class="btn" data-v034safe-action="cal-apply-selected">Apply to Selected Days</button><button class="btn" data-v034safe-action="cal-apply-all">Apply to All Days</button><button class="btn danger" data-v034safe-action="cal-clear-month">Clear Month</button></div><div class="toolbar"><button class="btn" data-v034safe-action="cal-prev">‹ Previous</button><button class="btn" data-v034safe-action="cal-today">Today</button><button class="btn" data-v034safe-action="cal-next">Next ›</button><button class="btn primary" data-v034safe-action="cal-save">Save Month</button></div><div class="portalDow"><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div></div><div id="portalCalendarGrid" class="v034CalGrid"></div><div id="calendarSafeStatusV034" class="muted" style="margin-top:8px"></div></div>';
    return sec;
  }
  function renderCalendarData(data){
    data=data||{}; var title=by('portalCalTitle'), bulk=by('portalBulkSchedule'), grid=by('portalCalendarGrid');
    if(title)title.textContent=data.monthName||''; if(bulk)bulk.innerHTML=optionHtml(data.scheduleNames||[],bulk.value||''); if(!grid)return;
    var days=(data.days||[]).filter(function(day){var d=new Date(day.dateIso+'T00:00:00');var dow=d.getDay();return dow!==0&&dow!==6;});
    grid.innerHTML=days.map(function(day){return '<div class="portalDay v034CalDay '+(day.inMonth?'':'out')+(day.isToday?' today':'')+'" data-iso="'+esc(day.dateIso)+'"><div class="v034CalHead"><label><input type="checkbox" class="portalDayPick"> '+esc(day.day)+'</label><span>'+esc(day.dateIso)+'</span></div><select class="portalSched">'+optionHtml(data.scheduleNames||[],day.scheduleType||'')+'</select><input class="portalNote note" placeholder="Notes" value="'+esc(day.notes||'')+'">'+(day.attendanceAbsenceCount?'<div class="dashMeta">Absences: '+esc(day.attendanceAbsenceCount)+'</div>':'')+'</div>';}).join('');
  }
  function openCalendarSafe(btn){activate('calendar',btn,'Calendar Manager');renderCalendarShell();loadCalendarSafe();}
  function loadCalendarSafe(){
    var status=by('calendarSafeStatusV034'); if(status)status.textContent='Loading safe calendar...';
    fetchJson(api('/api/v034/calendar-safe',{year:calDate.getFullYear(),month:calDate.getMonth()+1})).then(function(j){window.calendarData=j.result||{}; renderCalendarData(window.calendarData); if(status)status.textContent='Loaded by safe renderer v034.';}).catch(function(e){if(status)status.textContent='Calendar Manager could not load: '+e.message; setMsg('Calendar Manager could not load: '+e.message,'err');});
  }
  function collectCalendarDays(){return Array.prototype.slice.call(document.querySelectorAll('#calendar .portalDay')).map(function(d){return {dateIso:d.getAttribute('data-iso'),scheduleType:(d.querySelector('.portalSched')||{}).value||'',notes:(d.querySelector('.portalNote')||{}).value||''};});}
  function saveCalendarSafe(){var status=by('calendarSafeStatusV034'); if(status)status.textContent='Saving calendar...'; fetchJson('/api/v034/calendar-safe/save',{method:'POST',body:JSON.stringify(Object.assign({school:schoolId(),year:calDate.getFullYear(),month:calDate.getMonth()+1,days:collectCalendarDays()},schoolPayload()))}).then(function(j){window.calendarData=j.result||{}; renderCalendarData(window.calendarData); if(status)status.textContent='Calendar saved.'; setMsg('Calendar saved.','ok');}).catch(function(e){if(status)status.textContent='Calendar save failed: '+e.message;setMsg('Calendar save failed: '+e.message,'err');});}
  function applyCalendarSelected(all){var bulk=by('portalBulkSchedule'), val=bulk?bulk.value:''; if(!val){setMsg('Choose a bulk schedule first.','err');return;} document.querySelectorAll('#calendar .portalDay').forEach(function(d){if(all || (d.querySelector('.portalDayPick')&&d.querySelector('.portalDayPick').checked)){var s=d.querySelector('.portalSched'); if(s)s.value=val;}}); setMsg('Applied '+val+'.','ok');}
  function clearCalendarMonth(){document.querySelectorAll('#calendar .portalDay').forEach(function(d){if(!d.classList.contains('out')){var s=d.querySelector('.portalSched'), n=d.querySelector('.portalNote'); if(s)s.value=''; if(n)n.value='';}}); setMsg('Visible month cleared. Click Save Month to persist.','warn');}
  function monthOptions(current){var now=new Date(); now.setDate(1); var html=''; for(var off=-6;off<=12;off++){var d=new Date(now.getFullYear(),now.getMonth()+off,1); var key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); var label=d.toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'long',year:'numeric'}); html+='<option value="'+key+'" '+(key===current?'selected':'')+'>'+esc(label)+'</option>'; } return html;}
  function renderAttendanceShell(){
    var sec=by('attendanceManager'); if(!sec)return null; var now=new Date(), key=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    sec.innerHTML='<div class="card"><div class="v034SafePageNotice"><b>Attendance Manager safe renderer v034.</b> This bypasses the legacy Attendance load path that was crashing the browser. <span class="v034DiagLinks"><a href="#" data-v034safe-action="attendance-reload">Reload safe attendance</a></span></div><div class="attendanceTools"><div><div id="attendanceMonthHeading" class="attendanceMonthTitle">Attendance</div></div><div class="attendanceToolsRight noPrint"><label class="tinyCheck" style="display:flex;align-items:center;gap:6px;margin-top:20px"><input id="attendanceShowNonActiveV5340" type="checkbox" style="width:auto"> Show non-active current staff</label><div><label>Month</label><select id="attendanceMonthSelect">'+monthOptions(key)+'</select></div><button class="btn" data-v034safe-action="attendance-load">Load</button><button class="btn" data-v034safe-action="attendance-print">Print</button></div></div><div id="attendanceSafeStatusV034" class="muted" style="margin:8px 0"></div><div id="attendanceGrid" class="v034AttendanceScroll"></div></div>';
    return sec;
  }
  function openAttendanceSafe(btn,staff){activate('attendanceManager',btn||document.querySelector('[data-nav="attendanceManager"]'),'Attendance Manager');renderAttendanceShell();loadAttendanceSafe(staff||'');}
  function loadAttendanceSafe(staff){var sel=by('attendanceMonthSelect'), show=by('attendanceShowNonActiveV5340'), status=by('attendanceSafeStatusV034'); var month=sel?sel.value:''; if(status)status.textContent='Loading safe attendance...'; fetchJson(api('/api/v034/attendance-safe',{month:month,staff:staff||'',showNonActive:(show&&show.checked)?'true':'false'})).then(function(j){window.attendanceManagerData=j.result||{}; renderAttendanceData(window.attendanceManagerData); if(status)status.textContent='Loaded by safe renderer v034.';}).catch(function(e){if(status)status.textContent='Attendance Manager could not load: '+e.message; setMsg('Attendance Manager could not load: '+e.message,'err');});}
  function renderAttendanceData(data){data=data||{}; var heading=by('attendanceMonthHeading'); if(heading)heading.textContent='Attendance - '+(data.monthLabel||data.month||''); var grid=by('attendanceGrid'); if(!grid)return; var days=data.days||[], rows=data.rows||[]; if(!rows.length){grid.innerHTML='<div class="muted" style="padding:12px">No attendance rows found.</div>';return;} grid.innerHTML='<table class="v034SafeTable"><thead><tr><th>Staff</th>'+days.map(function(d){return '<th title="'+esc(d.label||d.key||'')+'">'+esc(d.day||String(d.key||'').slice(-2))+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(r){var cells=r.cells||{}; return '<tr><td><b>'+esc(r.staff||'')+'</b></td>'+days.map(function(d){var k=d.key||d.dateIso||''; return '<td>'+esc(cells[k]||'')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';}
  function forceStaffRow(){
    var wrap=document.querySelector('#staff .staffDataStatsV5288'); if(!wrap)return;
    var fields=[];
    var last=by('staffLastDataSubmittedV5288'); if(last){var f=last.closest('.staffDataFieldV5289')||last.parentNode; if(f){f.id='staffDataSubmittedFieldV5288'; fields.push(f);}}
    var pts=by('staffDataPointsContributedV5288'); if(pts){var pf=pts.closest('.staffDataFieldV5289')||pts.parentNode; if(pf){pf.id='staffDataPointsFieldV5288'; fields.push(pf);}}
    var email=by('staffEmailFieldV024')||document.querySelector('#staff .staffEmailFieldV024'); if(email)fields.push(email);
    var link=by('staffPortalLinkFieldV5312'); if(link)fields.push(link);
    var lv=by('staffLastViewFieldV034')||by('staffLastViewFieldV033')||by('staffLastViewFieldV028'); if(lv){lv.id='staffLastViewFieldV034'; var input=lv.querySelector('input'); if(input)input.id='staffLastViewV034'; fields.push(lv);}
    fields.filter(Boolean).forEach(function(f){wrap.appendChild(f);});
    var lock=by('staffEmailLockBtnV025'); if(lock){lock.style.transition='none'; if(!lock.dataset.v034Stable){lock.dataset.v034Stable='1'; lock.innerHTML='<i class="fa-solid fa-lock" aria-hidden="true"></i>';}}
  }
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest&&e.target.closest('[data-nav],[data-action],[data-v034safe-action]'); if(!t)return;
    var nav=t.getAttribute('data-nav')||'', a=t.getAttribute('data-v034safe-action')||t.getAttribute('data-action')||'';
    // v041: do not intercept Calendar/Attendance main-menu navigation here.
    // The base portal redirects these to standalone pages (/calendar-manager and /attendance-manager),
    // which are the confirmed stable path. Keeping the old in-portal safe renderer active here
    // caused the main-menu clicks to bypass the standalone pages and crash.
    if(false && nav==='calendar'){e.preventDefault();e.stopImmediatePropagation();openCalendarSafe(t);return false;}
    if(false && nav==='attendanceManager'){e.preventDefault();e.stopImmediatePropagation();openAttendanceSafe(t);return false;}
    if(false && a==='refresh-all' && (document.querySelector('#calendar.active')||document.querySelector('#attendanceManager.active'))){e.preventDefault();e.stopImmediatePropagation(); if(document.querySelector('#calendar.active'))loadCalendarSafe(); else loadAttendanceSafe(''); return false;}
    if(false && (a==='cal-prev'||a==='cal-next'||a==='cal-today'||a==='cal-save'||a==='cal-apply-selected'||a==='cal-apply-all'||a==='cal-clear-month'||a==='calendar-reload')){
      if(document.querySelector('#calendar.active')){e.preventDefault();e.stopImmediatePropagation(); if(a==='cal-prev')calDate.setMonth(calDate.getMonth()-1); else if(a==='cal-next')calDate.setMonth(calDate.getMonth()+1); else if(a==='cal-today'){calDate=new Date();calDate.setDate(1);} else if(a==='cal-save')return saveCalendarSafe(); else if(a==='cal-apply-selected')return applyCalendarSelected(false); else if(a==='cal-apply-all')return applyCalendarSelected(true); else if(a==='cal-clear-month')return clearCalendarMonth(); loadCalendarSafe(); return false;}
    }
    if(false && (a==='attendance-load'||a==='attendance-print'||a==='attendance-reload'||a==='staff-attendance-history')){
      if(a==='staff-attendance-history'){var nm=(by('staffName')&&by('staffName').value)||''; e.preventDefault();e.stopImmediatePropagation(); try{window.location.href=(typeof standaloneManagerUrlV039==='function'?standaloneManagerUrlV039('attendanceManager',nm):('/attendance-manager'+(nm?'?staff='+encodeURIComponent(nm):'')));}catch(x){window.location.href='/attendance-manager'+(nm?'?staff='+encodeURIComponent(nm):'');} return false;}
      if(document.querySelector('#attendanceManager.active')){e.preventDefault();e.stopImmediatePropagation(); if(a==='attendance-print')window.print(); else loadAttendanceSafe(''); return false;}
    }
  },true);
  document.addEventListener('change',function(e){if(false && e.target&&(e.target.id==='attendanceMonthSelect'||e.target.id==='attendanceShowNonActiveV5340')&&document.querySelector('#attendanceManager.active')){loadAttendanceSafe('');}},true);
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#staffList button,#staffList [data-staff-row]')){setTimeout(forceStaffRow,120);setTimeout(forceStaffRow,450);}},true);
  document.addEventListener('input',function(e){if(e.target&&e.target.id==='staffName'){setTimeout(forceStaffRow,80);}},true);
  function boot(){installStyles(); if(document.querySelector('#staff.active'))forceStaffRow();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,50);}); else setTimeout(boot,50);
  [250,800,1800,3600].forEach(function(ms){setTimeout(boot,ms);});
})();

/* ===== END ga-redis-v034-ui-patches.js ===== */

/* ===== BEGIN ga-redis-v038-ui-patches.js ===== */
(function(){
  'use strict';
  if(window.__gaRedisV038Loaded) return; window.__gaRedisV038Loaded = true;

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>\"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c] || c; }); }
  function selectedSchoolId(){
    try { if (typeof window.selectedSchoolPayloadV686m20 === 'function') { var p = window.selectedSchoolPayloadV686m20() || {}; return clean(p.school || p.schoolId || p.campusId || p.selectedCampusId || ''); } } catch(e) {}
    try { var ctx = window.campusContextV5253 || {}; return clean(ctx.selectedCampusId || (ctx.currentCampus && ctx.currentCampus.campusId) || ctx.schoolId || ctx.campusId || ''); } catch(e2) {}
    var sel = by('campusSelector'); return sel ? clean(sel.value) : '';
  }
  function api(path, params){ params=params||{}; if(!params.school) params.school=selectedSchoolId(); params._t=Date.now(); return path+'?'+new URLSearchParams(params).toString(); }
  function fetchJson(url, opts){
    opts=opts||{}; opts.credentials='same-origin'; opts.headers=Object.assign({'Content-Type':'application/json'}, opts.headers||{});
    return fetch(url, opts).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if(!r.ok || j.ok===false) throw new Error(j.error || j.message || ('HTTP '+r.status)); return j; }); });
  }
  function setMsg(msg,type){ try{ if(typeof window.setMsg==='function') return window.setMsg(msg,type||'warn'); }catch(e){} var el=by('globalMsg'); if(el){ el.textContent=msg||''; el.className='msg '+(type||''); el.style.display=msg?'block':'none'; } }

  function installStyles(){
    if(by('gaRedisV038Styles')) return;
    var css = [
      /* Uniform button shape without forcing hidden/dynamic pills to display. */
      '.btn,button.btn,.toolbar button,.topActions button,.topActions .btn,.portalTopActions button,.portalTopActions .btn,button[data-action],button[data-nav],button[data-v034safe-action],button[data-v038-action]{border-radius:10px!important;box-sizing:border-box!important}',
      '.topActions{align-items:center!important;gap:6px!important}.topActions button,.topActions .btn{height:34px!important;min-height:34px!important;max-height:34px!important;padding:0 12px!important;line-height:1.1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;vertical-align:middle!important}.topActions .activeOptPill{height:34px!important;min-height:34px!important;max-height:34px!important;padding:0 12px!important;line-height:1.1!important;align-items:center!important;justify-content:center!important;border-radius:10px!important;vertical-align:middle!important}.topActions .activeOptPill .x,.topActions .shareSchedulesPillV686m26 .shareX{height:18px!important;min-height:18px!important;width:18px!important;padding:0!important;line-height:16px!important;margin-left:5px!important;border-radius:8px!important}.topActions #publishScheduleBtn{display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:1.1!important}',
      '.topActions .activeOptPill:not([style*="inline-flex"]):not(.active){display:none!important}.topActions .customizationPill:not([style*="inline-flex"]):not(.active),.topActions .unpublishedSchedulePill:not([style*="inline-flex"]):not(.active){display:none!important}',
      '.shareSchedulesPillV686m26{border-radius:10px!important}.topActions .shareSchedulesPillV686m26{height:34px!important;min-height:34px!important;max-height:34px!important;padding:0 12px!important;line-height:1.1!important;align-items:center!important;justify-content:center!important}',
      /* Staff Manager: one clean data/contact row, no forced horizontal page scroll. */
      '#staff .staffDataStatsV5288{display:grid!important;grid-template-columns:180px 190px minmax(250px,1fr) minmax(260px,.95fr) 190px!important;gap:8px!important;align-items:end!important;width:100%!important;max-width:100%!important;overflow:visible!important;margin-top:8px!important;grid-column:1/-1!important}',
      '#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffPortalLinkFieldV5312,#staff #staffLastViewFieldV034,#staff #staffLastViewFieldV033,#staff #staffLastViewFieldV028{display:flex!important;flex-direction:column!important;justify-content:flex-end!important;align-self:end!important;min-width:0!important;width:100%!important;max-width:none!important;margin:0!important;box-sizing:border-box!important;grid-column:auto!important}',
      '#staff .staffDataStatsV5288 label{display:block!important;font-size:12px!important;line-height:16px!important;min-height:16px!important;margin:0 0 5px!important;white-space:nowrap!important;font-weight:800!important}',
      '#staff #staffDataSubmittedFieldV5288 input,#staff #staffDataPointsFieldV5288 input,#staff #staffEmailFieldV024 input,#staff .staffEmailFieldV024 input,#staff #staffPortalLinkFieldV5312 input,#staff #staffLastViewFieldV034 input,#staff #staffLastViewFieldV033 input,#staff #staffLastViewFieldV028 input{height:32px!important;min-height:32px!important;line-height:30px!important;font-size:12px!important;font-weight:400!important;box-sizing:border-box!important;width:100%!important;min-width:0!important;margin:0!important}',
      '#staff #staffDataPointsFieldV5288 .staffDataContributionLineV5301{display:grid!important;grid-template-columns:minmax(0,1fr) 62px!important;gap:6px!important;align-items:end!important}',
      '#staff #staffEmailFieldV024 .staffEmailInputLockWrapV025,#staff .staffEmailFieldV024 .staffEmailInputLockWrapV025{display:grid!important;grid-template-columns:minmax(0,1fr) 28px!important;gap:6px!important;align-items:end!important}',
      '#staff #staffPortalLinkFieldV5312 .staffPortalLinkLineV5312,#staff #staffPortalLinkFieldV5312 .inline{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:6px!important;align-items:end!important}',
      '#staff #staffPortalLinkFieldV5312 button,#staff #staffPortalLinkFieldV5312 .btn{height:32px!important;min-height:32px!important;max-height:32px!important;padding:0 12px!important;line-height:1.1!important;font-size:12px!important;font-weight:800!important;border-radius:10px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important}',
      '#staff #staffPortalLinkV5312{font-size:11.5px!important}',
      '#staff #staffLastViewV034,#staff #staffLastViewV033,#staff #staffLastViewV028{font-weight:400!important;color:#475569!important;text-align:left!important;background:#f8fafc!important}',
      '#staff #staffLastViewV034.staleV034,#staff #staffLastViewV033.staleV034,#staff #staffLastViewV028.staleV034{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important;font-weight:400!important}',
      '#staffEmailLockBtnV025{transition:none!important}',
      '#formPickerResults.gaStableFormsV038{min-height:96px!important;max-height:380px!important;overflow:auto!important;border:1px solid #dbe3ef!important;border-radius:12px!important;padding:6px!important;background:#fff!important;display:block!important;visibility:visible!important;opacity:1!important}.gaStableFormsV038 .searchResultBtn{display:block!important;width:100%!important;text-align:left!important;margin:4px 0!important;white-space:normal!important;border-radius:10px!important}',
      '@media(max-width:1350px){#staff .staffDataStatsV5288{grid-template-columns:155px 165px minmax(220px,1fr) minmax(230px,.85fr) 175px!important;gap:7px!important}}'
    ].join('\n');
    var st=document.createElement('style'); st.id='gaRedisV038Styles'; st.textContent=css; document.head.appendChild(st);
  }

  function responderUrlFromAny(input){
    var raw=clean(input); if(!raw) return '';
    var m=raw.match(/\/forms\/d\/(?:e\/)?([^\/\?#]+)/i) || raw.match(/[?&]id=([^&]+)/i);
    var id=m && m[1] ? decodeURIComponent(m[1]) : '';
    if(!id && /^[A-Za-z0-9_-]{20,}$/.test(raw)) id=raw;
    return id ? 'https://docs.google.com/forms/d/'+encodeURIComponent(id)+'/viewform' : raw.replace('/edit','/viewform').replace('/edit?usp=drivesdk','/viewform');
  }

  var formSeq=0;
  function patchFormPicker(){
    var search=by('formPickerSearch'); if(search) search.placeholder='Search forms by name or leave blank';
    var manual=by('formPickerManual'); if(manual) manual.placeholder='Paste a Google Form URL or file ID';
    var help=by('formPickerHelpV5215')||by('formPickerHelpV5218'); if(help){ help.id='formPickerHelpV5215'; help.textContent='Select a Google Form accessible to your signed-in Google account. No DATA_FILE name or special sharing rule is required.'; }
    var msg=by('formPickerManualMsg'); if(msg && /DATA_FILE|file name must/i.test(msg.textContent||'')) msg.textContent='';
    var box=by('formPickerResults'); if(box){ box.classList.remove('gaStableFormsV034','gaStableFormsV036','gaStableFormsV037'); box.classList.add('gaStableFormsV038'); }
  }
  function renderForms(rows){
    var box=by('formPickerResults'); if(!box) return;
    rows=rows||[]; box.classList.remove('gaStableFormsV034','gaStableFormsV036','gaStableFormsV037'); box.classList.add('gaStableFormsV038');
    if(!rows.length){ box.innerHTML='<div class="muted"><b>No accessible Google Forms found.</b><br>Try Show All, search a different form name, or paste the Form URL/file ID above.</div>'; return; }
    box.innerHTML = rows.map(function(r){
      var meta=[]; if(r.source)meta.push(r.source); if(r.updated)meta.push('Modified '+r.updated); if(r.driveName&&r.driveName!==r.name)meta.push('Drive file name '+r.driveName);
      var url=responderUrlFromAny(r.responderUrl||r.publishedUrl||r.url||r.editUrl||'');
      return '<button type="button" class="searchResultBtn" data-form-url="'+esc(url)+'"><strong>'+esc(r.name||r.driveName||r.formTitle||'Untitled Google Form')+'</strong><div class="dashMeta">'+esc(meta.join(' · '))+'</div></button>';
    }).join('');
  }
  function searchForms(showAll){
    patchFormPicker(); var modal=by('formPickerModal'); if(modal)modal.classList.add('active');
    var q=by('formPickerSearch'); if(showAll&&q)q.value=''; var query=q?clean(q.value):'';
    var box=by('formPickerResults'); if(box) box.innerHTML='<div class="muted">Searching accessible Google Forms...</div>';
    var seq=++formSeq;
    return fetchJson('/api/google/forms/search-v026?'+new URLSearchParams({query:query,limit:'100',_t:String(Date.now())}).toString()).then(function(j){ if(seq!==formSeq)return; renderForms(j.rows||j.forms||[]); }).catch(function(e){ if(seq!==formSeq)return; if(box)box.innerHTML='<div class="muted"><b>Could not search Google Forms.</b><br>'+esc(e.message||e)+'</div>'; });
  }
  function saveStudentDataUrl(row,url){
    row=clean(row); url=responderUrlFromAny(url); if(!row){ return Promise.resolve({ok:true,url:url}); }
    return fetchJson('/api/v037/student-data-url/save',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),rowIndex:Number(row),url:url})});
  }
  function chooseFormUrl(url){
    url=responderUrlFromAny(url); var modal=by('formPickerModal'); if(modal) modal.classList.remove('active');
    var row=null; try{ row=window.formPickerTargetRow || formPickerTargetRow || null; }catch(e){ row=window.formPickerTargetRow || null; }
    if(row){
      var input=document.querySelector('[data-data-url-row="'+row+'"]'); if(input) input.value=url;
      setMsg('Saving selected Google Form link...','warn');
      saveStudentDataUrl(row,url).then(function(r){ setMsg((r&&r.message)||'Google Form link saved.','ok'); try{ if(typeof loadStudentData==='function')loadStudentData(null,{preferCache:false,skipNew:true}); }catch(x){}; }).catch(function(e){ setMsg('Could not save Google Form link: '+(e.message||e),'err'); });
      return;
    }
    var stu=by('studentDataFiles'); if(stu) stu.value=url;
    setMsg('Selected fillable Google Form link. Save the student to keep this link.','ok');
  }
  function useManualForm(){
    patchFormPicker(); var input=by('formPickerManual'), msg=by('formPickerManualMsg'), raw=input?clean(input.value):'';
    if(!raw){ if(msg) msg.textContent='Paste a Google Form URL or file ID first.'; return; }
    if(msg) msg.textContent='Validating Google Form...';
    fetchJson('/api/google/forms/validate-v026',{method:'POST',body:JSON.stringify({input:raw})}).then(function(j){ var r=j.row||j||{}; var url=responderUrlFromAny(r.responderUrl||r.publishedUrl||r.url||r.editUrl||raw); if(input)input.value=''; if(msg)msg.textContent='Validated '+(r.name||r.driveName||r.formTitle||'Google Form')+'.'; chooseFormUrl(url); }).catch(function(e){ if(msg)msg.textContent='That Google Form could not be validated: '+(e.message||e); });
  }
  function openDriveFormsSearch(){ var q='type:forms'; var s=by('formPickerSearch'); if(s&&clean(s.value))q+=' '+clean(s.value); window.open('https://drive.google.com/drive/search?q='+encodeURIComponent(q),'_blank'); var msg=by('formPickerManualMsg'); if(msg)msg.textContent='Drive search opened in a new tab.'; }
  function installFormOverrides(){
    window.searchForms=function(showAll){ return searchForms(!!showAll); };
    window.searchGoogleFormsFromPortal=function(){ return searchForms(false); };
    window.chooseGoogleForm=chooseFormUrl;
    window.useManualGoogleFormFromPortal=useManualForm;
    window.openDriveDataFileSearchFromPortal=openDriveFormsSearch;
    try{ searchForms=window.searchForms; }catch(e){} try{ searchGoogleFormsFromPortal=window.searchGoogleFormsFromPortal; }catch(e2){} try{ chooseGoogleForm=chooseFormUrl; }catch(e3){} try{ useManualGoogleFormFromPortal=useManualForm; }catch(e4){}
  }

  function forceStaffRow(){
    var wrap=document.querySelector('#staff .staffDataStatsV5288'); if(!wrap) return;
    var last=by('staffLastDataSubmittedV5288'), pts=by('staffDataPointsContributedV5288');
    var lastField=last && (last.closest('.staffDataFieldV5289') || last.parentNode); if(lastField) lastField.id='staffDataSubmittedFieldV5288';
    var ptsField=pts && (pts.closest('.staffDataFieldV5289') || pts.parentNode); if(ptsField) ptsField.id='staffDataPointsFieldV5288';
    var email=by('staffEmailFieldV024') || document.querySelector('#staff .staffEmailFieldV024');
    var link=by('staffPortalLinkFieldV5312');
    var lv=by('staffLastViewFieldV034') || by('staffLastViewFieldV033') || by('staffLastViewFieldV028'); if(lv){ lv.id='staffLastViewFieldV034'; var inp=lv.querySelector('input'); if(inp){ inp.id='staffLastViewV034'; inp.style.fontWeight='400'; } }
    [lastField, ptsField, email, link, lv].filter(Boolean).forEach(function(el){ wrap.appendChild(el); });
    var lock=by('staffEmailLockBtnV025'); if(lock){ lock.style.transition='none'; if(!lock.dataset.v038Stable){ lock.dataset.v038Stable='1'; lock.innerHTML='<i class="fa-solid fa-lock" aria-hidden="true"></i>'; } }
  }

  function boot(){ installStyles(); installFormOverrides(); patchFormPicker(); if(document.querySelector('#staff.active')) forceStaffRow(); }
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest&&e.target.closest('[data-action],.searchResultBtn[data-form-url],[data-nav]'); if(!t) return;
    var a=t.getAttribute('data-action')||'';
    if(a==='form-picker-search'){ e.preventDefault(); e.stopImmediatePropagation(); searchForms(false); return false; }
    if(a==='form-picker-browse'){ e.preventDefault(); e.stopImmediatePropagation(); var q=by('formPickerSearch'); if(q)q.value=''; searchForms(true); return false; }
    if(a==='form-picker-use-manual'){ e.preventDefault(); e.stopImmediatePropagation(); useManualForm(); return false; }
    if(a==='form-picker-drive-search'){ e.preventDefault(); e.stopImmediatePropagation(); openDriveFormsSearch(); return false; }
    if(a==='data-select-form'){ e.preventDefault(); e.stopImmediatePropagation(); try{ window.formPickerTargetRow=t.getAttribute('data-data-row')||null; formPickerTargetRow=window.formPickerTargetRow; }catch(x){} var m=by('formPickerModal'); if(m)m.classList.add('active'); var q2=by('formPickerSearch'), tr=t.closest('tr'); if(q2)q2.value=(tr&&tr.getAttribute('data-student-name'))||''; searchForms(false); return false; }
    if(a==='data-save-url'){ e.preventDefault(); e.stopImmediatePropagation(); var row=t.getAttribute('data-data-row'); if(typeof window.saveDataManagerUrl==='function'){ window.saveDataManagerUrl(row); return false; } var input=document.querySelector('[data-data-url-row="'+row+'"]'); if(input){ saveStudentDataUrl(row,input.value).then(function(r){ setMsg((r&&r.message)||'Google Form link saved.','ok'); }).catch(function(err){ setMsg('Could not save Google Form link: '+(err.message||err),'err'); }); } return false; }
    if(t.classList&&t.classList.contains('searchResultBtn')&&t.getAttribute('data-form-url')){ e.preventDefault(); e.stopImmediatePropagation(); chooseFormUrl(t.getAttribute('data-form-url')); return false; }
    if(t.getAttribute('data-nav')==='staff'){ setTimeout(forceStaffRow,200); setTimeout(forceStaffRow,700); }
  },true);
  document.addEventListener('input',function(e){ if(e.target&&e.target.id==='staffName') setTimeout(forceStaffRow,80); },true);
  document.addEventListener('click',function(e){ if(e.target&&e.target.closest&&e.target.closest('#staffList button,#staffList [data-staff-row],#staffList .active')){ setTimeout(forceStaffRow,160); setTimeout(forceStaffRow,600); } },true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,50); }); else setTimeout(boot,50);
  [200,800,1800].forEach(function(ms){ setTimeout(boot,ms); });
})();

/* ===== END ga-redis-v038-ui-patches.js ===== */

/* ===== BEGIN ga-redis-v050-ui-patches.js ===== */
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

/* ===== END ga-redis-v050-ui-patches.js ===== */

/* ===== BEGIN ga-redis-v052-ui-patches.js ===== */
(function(){
  'use strict';
  if(window.__gaRedisV052Loaded) return; window.__gaRedisV052Loaded=true;
  return; // Disabled -- normalizeLastViewField() treats any input with an id starting "staffLastView" as a candidate to prune, scored partly by whether it already has a value. A freshly-created field is always empty at the moment this runs and reliably loses, getting deleted. Confirmed root cause via stack trace of the actual removal. This file's original purpose (consolidating old, scattered Last View field variants) is fully superseded by the current row implementation.
  function by(id){ return document.getElementById(id); }
  function q(sel,root){ return (root||document).querySelector(sel); }
  function qa(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function activePage(){ try{ if(typeof window.activeSectionIdV51229==='function') return window.activeSectionIdV51229()||''; }catch(e){} var s=q('.section.active'); return s?s.id:''; }
  function addStyle(){
    if(by('gaRedisV052Styles')) return;
    var css = [
      '#staff .staffDataStatsV5288{display:grid!important;grid-template-columns:190px 300px minmax(230px,280px) minmax(420px,1fr) 145px!important;gap:10px!important;align-items:end!important;grid-column:1/-1!important;width:100%!important;max-width:none!important;margin:8px 0 0!important;overflow:visible!important}',
      '#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffPortalLinkFieldV5312,#staff #staffLastViewFieldV052{display:flex!important;flex-direction:column!important;justify-content:flex-end!important;align-self:end!important;min-width:0!important;width:100%!important;max-width:none!important;margin:0!important;box-sizing:border-box!important;grid-column:auto!important;grid-row:auto!important;position:static!important;float:none!important}',
      '#staff #staffDataSubmittedFieldV5288{max-width:190px!important}',
      '#staff #staffDataPointsFieldV5288{max-width:300px!important}',
      '#staff #staffEmailFieldV024,#staff .staffEmailFieldV024{max-width:280px!important}',
      '#staff #staffPortalLinkFieldV5312{max-width:none!important}',
      '#staff #staffLastViewFieldV052{max-width:145px!important}',
      '#staff #staffDataSubmittedFieldV5288 label,#staff #staffDataPointsFieldV5288 label,#staff #staffEmailFieldV024 label,#staff .staffEmailFieldV024 label,#staff #staffPortalLinkFieldV5312 label,#staff #staffLastViewFieldV052 label{display:inline-flex!important;align-items:center!important;gap:3px!important;white-space:nowrap!important;width:auto!important;max-width:100%!important;min-height:17px!important;margin:0 0 5px!important;padding:0!important;line-height:1.15!important;font-family:inherit!important;font-size:12px!important;font-weight:700!important;color:#0f172a!important;text-transform:none!important;letter-spacing:0!important}',
      '#staff #staffLastDataSubmittedV5288,#staff #staffDataPointsContributedV5288,#staff #staffNotificationEmailV686m41,#staff #staffPortalLinkV5312,#staff #staffLastViewV052{height:32px!important;min-height:32px!important;line-height:30px!important;border-radius:12px!important;box-sizing:border-box!important;font-family:inherit!important;font-size:12px!important;font-weight:400!important;width:100%!important;min-width:0!important;margin:0!important;padding:7px 10px!important;opacity:1!important}',
      '#staff #staffDataPointsFieldV5288 .staffDataContributionLineV5301{display:grid!important;grid-template-columns:minmax(80px,1fr) 64px!important;gap:6px!important;align-items:center!important;width:100%!important}',
      '#staff #staffEmailFieldV024 .staffEmailInputLockWrapV025,#staff .staffEmailFieldV024 .staffEmailInputLockWrapV025{display:grid!important;grid-template-columns:minmax(0,1fr) 30px!important;gap:6px!important;align-items:center!important;width:100%!important}',
      '#staff #staffPortalLinkFieldV5312 .staffPortalLinkLineV5312,#staff #staffPortalLinkFieldV5312 .inline{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;width:100%!important}',
      '#staff .staffDataViewBtnV5289,#staff .staffPortalCopyBtnV5312{height:32px!important;min-height:32px!important;padding:6px 10px!important;border-radius:12px!important;font-family:inherit!important;font-size:12px!important;font-weight:800!important;line-height:1.1!important;white-space:nowrap!important;margin:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}',
      '#staff #staffLastViewV052{background:#f8fafc!important;color:#475569!important;border:1px solid #d8e1ef!important;text-align:left!important;font-weight:400!important}',
      '#staff #staffLastViewV052.staleV052,#staff #staffLastViewV052.staleV051,#staff #staffLastViewV052.staleV034,#staff #staffLastViewV052.staleViewV027,#staff #staffLastViewV052.staleV029,#staff #staffLastViewV052.staleV030,#staff #staffLastViewV052.staleV031,#staff #staffLastViewV052.staleV032,#staff #staffLastViewV052.staleV033{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important;font-weight:400!important}',
      '#staffEmailLockBtnV025,.staffEmailLockBtnV025.historyRegularBtn,.staffEmailLockBtnV025.historyLockV018{height:32px!important;min-height:32px!important;width:30px!important;min-width:30px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;transition:none!important}',
      '@media(max-width:1500px){#staff .staffDataStatsV5288{grid-template-columns:170px 285px minmax(210px,260px) minmax(340px,1fr) 135px!important;gap:8px!important}#staff #staffDataSubmittedFieldV5288{max-width:170px!important}#staff #staffDataPointsFieldV5288{max-width:285px!important}#staff #staffEmailFieldV024,#staff .staffEmailFieldV024{max-width:260px!important}#staff #staffLastViewFieldV052{max-width:135px!important}}',
      '@media(max-width:1180px){#staff .staffDataStatsV5288{grid-template-columns:repeat(2,minmax(220px,1fr))!important}#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffLastViewFieldV052{max-width:none!important}}',
      '@media(max-width:760px){#staff .staffDataStatsV5288{grid-template-columns:1fr!important}}'
    ].join('\n');
    var st=document.createElement('style'); st.id='gaRedisV052Styles'; st.textContent=css; document.head.appendChild(st);
  }

  function ensureWrap(){
    var wrap=q('#staff .staffDataStatsV5288');
    if(!wrap && typeof window.ensureStaffDataStatsUiV5288==='function'){
      try{ window.ensureStaffDataStatsUiV5288(); }catch(e){}
      wrap=q('#staff .staffDataStatsV5288');
    }
    if(!wrap){
      var top=q('#staff .staffProfileTop');
      if(top){ wrap=document.createElement('div'); wrap.id='staffDataStatsV5288'; wrap.className='staffDataStatsV5288'; top.appendChild(wrap); }
    }
    if(wrap) wrap.classList.add('staffDataStatsV5288');
    return wrap;
  }
  function fieldForInput(input){
    if(!input) return null;
    return input.closest('.staffDataFieldV5289,.staffPortalLinkFieldV5312,.staffEmailFieldV024,[id^="staffLastViewField"]') || input.parentNode;
  }
  function findEmailField(){
    var input=by('staffNotificationEmailV686m41');
    var field=by('staffEmailFieldV024') || q('#staff .staffEmailFieldV024') || fieldForInput(input);
    if(field){ field.id='staffEmailFieldV024'; field.classList.add('staffEmailFieldV024'); }
    return field;
  }
  function normalizeLinkField(){
    var field=by('staffPortalLinkFieldV5312');
    var input=by('staffPortalLinkV5312');
    if(!field && input) field=fieldForInput(input);
    if(field){ field.id='staffPortalLinkFieldV5312'; field.classList.add('staffPortalLinkFieldV5312'); }
    return field;
  }
  function hasRealValue(input){
    var v=(input&&input.value||'').trim();
    return !!v && v !== '—' && v !== '-';
  }
  function normalizeLastViewField(wrap){
    var candidates=[];
    qa('#staff [id^="staffLastViewField"]').forEach(function(el){ if(candidates.indexOf(el)<0)candidates.push(el); });
    qa('#staff input[id^="staffLastView"]').forEach(function(inp){ var f=fieldForInput(inp); if(f&&candidates.indexOf(f)<0)candidates.push(f); });
    var keep=null, keepScore=-1;
    candidates.forEach(function(f,idx){
      var inp=f.querySelector('input');
      var score=0;
      if(inp){ if(hasRealValue(inp)) score+=20; if(/not viewed/i.test(inp.value||'')) score+=15; if((inp.className||'').match(/stale|red|warn/i)) score+=8; }
      if((f.id||'')==='staffLastViewFieldV051') score+=5;
      if((f.id||'')==='staffLastViewFieldV052') score+=6;
      score+=idx/100;
      if(score>keepScore){ keep=f; keepScore=score; }
    });
    if(!keep){
      keep=document.createElement('div');
      keep.innerHTML='<label>Last View</label><input readonly disabled value="">';
    }
    candidates.forEach(function(f){ if(f!==keep){ try{ f.remove(); }catch(e){ f.style.display='none'; } } });
    keep.id='staffLastViewFieldV052';
    keep.classList.add('staffDataFieldV5289');
    var label=keep.querySelector('label');
    if(!label){ label=document.createElement('label'); label.textContent='Last View'; keep.insertBefore(label,keep.firstChild); }
    label.childNodes.forEach(function(n){ if(n.nodeType===3) n.nodeValue='Last View '; });
    if(!keep.querySelector('input')){ var inpNew=document.createElement('input'); inpNew.readOnly=true; inpNew.disabled=true; keep.appendChild(inpNew); }
    var inp=keep.querySelector('input');
    inp.id='staffLastViewV052';
    inp.readOnly=true; inp.disabled=true; inp.style.fontWeight='400';
    ['staleV034','staleViewV027','staleV029','staleV030','staleV031','staleV032','staleV033','staleV051'].forEach(function(c){ if(inp.classList.contains(c)) inp.classList.add('staleV052'); });
    return keep;
  }
  function normalizeDataFields(){
    var last=by('staffLastDataSubmittedV5288');
    var lastField=fieldForInput(last); if(lastField){ lastField.id='staffDataSubmittedFieldV5288'; lastField.classList.add('staffDataFieldV5289'); }
    var points=by('staffDataPointsContributedV5288');
    var pointsField=fieldForInput(points); if(pointsField){ pointsField.id='staffDataPointsFieldV5288'; pointsField.classList.add('staffDataFieldV5289'); }
    return { lastField:lastField, pointsField:pointsField };
  }
  function rebuildStaffRow(){
    if(activePage()!=='staff') return;
    addStyle();
    var wrap=ensureWrap(); if(!wrap) return;
    var d=normalizeDataFields();
    var emailField=findEmailField();
    var linkField=normalizeLinkField();
    var lastViewField=normalizeLastViewField(wrap);
    [d.lastField,d.pointsField,emailField,linkField,lastViewField].filter(Boolean).forEach(function(el){
      if(el.parentNode!==wrap) wrap.appendChild(el); else wrap.appendChild(el);
    });
    // Remove any last-view fields that were recreated after normalization.
    qa('#staff [id^="staffLastViewField"]').forEach(function(el){ if(el!==lastViewField){ try{ el.remove(); }catch(e){ el.style.display='none'; } } });
    var copy=q('#staff .staffPortalCopyBtnV5312'); if(copy){ copy.classList.add('btn','small'); }
    var view=by('staffDataViewBtnV5289'); if(view){ view.classList.add('btn','small','staffDataViewBtnV5289'); }
    var lock=by('staffEmailLockBtnV025'); if(lock){ lock.style.transition='none'; }
  }
  function schedule(){
    if(activePage()!=='staff') return;
    [0,80,240,600].forEach(function(ms){ setTimeout(rebuildStaffRow,ms); });
  }
  var baseShowPage=window.showPage;
  if(typeof baseShowPage==='function' && !baseShowPage.__v052StaffWrap){
    var sp=function(page,btn){ var r=baseShowPage.apply(this,arguments); if(page==='staff') schedule(); return r; };
    sp.__v052StaffWrap=true; window.showPage=sp;
  }
  var baseSelectStaff=window.selectStaff;
  if(typeof baseSelectStaff==='function' && !baseSelectStaff.__v052StaffWrap){
    var ss=function(){ var r=baseSelectStaff.apply(this,arguments); schedule(); return r; };
    ss.__v052StaffWrap=true; window.selectStaff=ss;
  }
  var baseNewStaff=window.newStaff;
  if(typeof baseNewStaff==='function' && !baseNewStaff.__v052StaffWrap){
    var ns=function(){ var r=baseNewStaff.apply(this,arguments); schedule(); return r; };
    ns.__v052StaffWrap=true; window.newStaff=ns;
  }
  document.addEventListener('click',function(e){
    if(e.target && e.target.closest && (e.target.closest('[data-nav="staff"]') || e.target.closest('#staffList button') || e.target.closest('[data-action="staff-new"]'))){ schedule(); }
  },true);
  setTimeout(schedule,0);
})();

/* ===== END ga-redis-v052-ui-patches.js ===== */

/* ===== BEGIN ga-redis-v054-ui-patches.js ===== */
(function(){
  'use strict';
  if(window.__gaRedisV054Loaded) return; window.__gaRedisV054Loaded = true;
  var VERSION='0.54.0';
  var scheduleShell=null;
  var lastSchoolKey='';
  var staffMetricCache={};
  function by(id){return document.getElementById(id);} 
  function qs(sel,root){return (root||document).querySelector(sel);} 
  function qsa(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel));}
  function clean(v){return String(v==null?'':v).trim();}
  function norm(v){return clean(v).toLowerCase().replace(/\s+/g,' ');} 
  function activePage(){try{if(typeof window.activeSectionIdV51229==='function')return window.activeSectionIdV51229()||'';}catch(e){}var s=qs('.section.active');return s?s.id:'';}
  function payload(){try{if(typeof window.selectedSchoolPayloadV683==='function')return window.selectedSchoolPayloadV683()||{};}catch(e){}try{if(typeof window.selectedSchoolPayloadV686m20==='function')return window.selectedSchoolPayloadV686m20()||{};}catch(e2){}try{var sel=by('campusSelector'), opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;return {school:(sel&&sel.value)||'',schoolId:(sel&&sel.value)||'',campusId:(sel&&sel.value)||'',spreadsheetId:(opt&&opt.getAttribute('data-spreadsheet-id'))||''};}catch(e3){return {};}}
  function schoolKey(){var p=payload();return clean(p.spreadsheetId||p.school||p.schoolId||p.campusId||'default').toLowerCase();}
  function api(path){var p=payload();var u=new URL(path,location.origin);['school','schoolId','campusId','spreadsheetId'].forEach(function(k){if(p[k])u.searchParams.set(k,p[k]);});return u.pathname+u.search;}
  function fetchJson(path,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(path,opts).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||j.message||('HTTP '+r.status));return j;});});}
  function addStyles(){
    if(by('gaRedisV054Styles')) return;
    var css=[
      '/* v054 */',
      '#dashboard .dashboardTile[data-tile="warnings"]{display:none!important}',
      '#staff .staffDataStatsV5288{display:grid!important;grid-template-columns:175px 270px minmax(250px,300px) minmax(320px,0.9fr) 150px!important;gap:8px!important;align-items:end!important;grid-column:1/-1!important;width:100%!important;max-width:none!important;margin:8px 0 0!important;overflow:visible!important}',
      '#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffPortalLinkFieldV5312,#staff #staffLastViewFieldV053,#staff #staffLastViewFieldV054{display:flex!important;flex-direction:column!important;justify-content:flex-end!important;align-self:end!important;min-width:0!important;width:100%!important;margin:0!important;padding:0!important;box-sizing:border-box!important;position:static!important;float:none!important}',
      '#staff #staffDataSubmittedFieldV5288 label,#staff #staffDataPointsFieldV5288 label,#staff #staffEmailFieldV024 label,#staff .staffEmailFieldV024 label,#staff #staffPortalLinkFieldV5312 label,#staff #staffLastViewFieldV053 label,#staff #staffLastViewFieldV054 label{display:inline-flex!important;align-items:center!important;gap:3px!important;height:17px!important;line-height:17px!important;min-height:17px!important;margin:0 0 5px!important;padding:0!important;white-space:nowrap!important;font-family:inherit!important;font-size:12px!important;font-weight:700!important;color:#0f172a!important;text-transform:none!important;letter-spacing:0!important}',
      '#staff #staffLastDataSubmittedV5288,#staff #staffDataPointsContributedV5288,#staff #staffNotificationEmailV686m41,#staff #staffPortalLinkV5312,#staff #staffLastViewV053,#staff #staffLastViewV054{height:32px!important;min-height:32px!important;line-height:30px!important;border-radius:12px!important;box-sizing:border-box!important;font-family:inherit!important;font-size:12px!important;font-weight:400!important;min-width:0!important;margin:0!important;padding:7px 10px!important;opacity:1!important}',
      '#staff #staffDataSubmittedFieldV5288{max-width:175px!important}#staff #staffLastDataSubmittedV5288{width:100%!important}',
      '#staff #staffDataPointsFieldV5288{max-width:270px!important}#staff #staffDataPointsFieldV5288 .staffDataContributionLineV5301{display:grid!important;grid-template-columns:86px 68px!important;gap:6px!important;align-items:center!important;justify-content:start!important;width:auto!important}#staff #staffDataPointsContributedV5288{width:86px!important;max-width:86px!important;text-align:left!important}#staff #staffDataViewBtnV5289{width:68px!important}',
      '#staff #staffEmailFieldV024,#staff .staffEmailFieldV024{max-width:300px!important}#staff #staffEmailFieldV024 .staffEmailInputLockWrapV025,#staff .staffEmailFieldV024 .staffEmailInputLockWrapV025{display:grid!important;grid-template-columns:minmax(0,1fr) 24px!important;gap:5px!important;align-items:center!important;width:100%!important}',
      '#staffEmailLockBtnV025,.staffEmailLockBtnV025.historyRegularBtn,.staffEmailLockBtnV025.historyLockV018{height:32px!important;min-height:32px!important;width:24px!important;min-width:24px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;color:#0f2a44!important;transition:none!important}',
      '#staffEmailLockBtnV025:hover,#staffEmailLockBtnV025:focus{background:transparent!important;border:0!important;box-shadow:none!important;outline:none!important}',
      '#staff #staffPortalLinkFieldV5312{max-width:none!important}#staff #staffPortalLinkFieldV5312 .staffPortalLinkLineV5312,#staff #staffPortalLinkFieldV5312 .inline{display:grid!important;grid-template-columns:minmax(0,1fr) 94px!important;gap:7px!important;align-items:center!important;width:100%!important}#staff .staffPortalCopyBtnV5312{width:94px!important}',
      '#staff #staffLastViewFieldV053,#staff #staffLastViewFieldV054{max-width:150px!important}#staff #staffLastViewV053,#staff #staffLastViewV054{width:100%!important;background:#f8fafc!important;color:#475569!important;border:1px solid #d8e1ef!important;text-align:left!important;font-weight:400!important}',
      '#staff #staffLastViewV053.staleV052,#staff #staffLastViewV054.staleV052,#staff #staffLastViewV053.staleV053,#staff #staffLastViewV054.staleV053,#staff #staffLastViewV053.staleV054,#staff #staffLastViewV054.staleV054,#staff #staffLastViewV053.staleViewV027,#staff #staffLastViewV054.staleViewV027{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important;font-weight:400!important}',
      '#staff .staffDataViewBtnV5289,#staff .staffPortalCopyBtnV5312{height:32px!important;min-height:32px!important;padding:6px 10px!important;border-radius:12px!important;font-family:inherit!important;font-size:12px!important;font-weight:800!important;line-height:1.1!important;white-space:nowrap!important;margin:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}',
      '@media(max-width:1500px){#staff .staffDataStatsV5288{grid-template-columns:160px 250px minmax(230px,280px) minmax(280px,0.9fr) 140px!important;gap:7px!important}#staff #staffEmailFieldV024,#staff .staffEmailFieldV024{max-width:280px!important}#staff #staffLastViewFieldV053,#staff #staffLastViewFieldV054{max-width:140px!important}}',
      '@media(max-width:1180px){#staff .staffDataStatsV5288{grid-template-columns:repeat(2,minmax(220px,1fr))!important}#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffLastViewFieldV053,#staff #staffLastViewFieldV054{max-width:none!important}}'
    ].join('\n');
    var st=document.createElement('style');st.id='gaRedisV054Styles';st.textContent=css;document.head.appendChild(st);
  }
  function normalizeStaffRow(){
    if(activePage()!=='staff') return;
    addStyles();
    var wrap=qs('#staff .staffDataStatsV5288'); if(!wrap) return;
    var lastField=by('staffLastViewFieldV054')||by('staffLastViewFieldV053')||by('staffLastViewFieldV052')||qs('#staff [id^="staffLastViewField"]');
    if(lastField){lastField.id='staffLastViewFieldV054'; var inp=lastField.querySelector('input'); if(inp){inp.id='staffLastViewV054';inp.style.fontWeight='400';}}
    qsa('#staff [id^="staffLastViewField"]').forEach(function(el){if(el.id!=='staffLastViewFieldV054'){try{el.remove();}catch(e){el.style.display='none';}}});
    qsa('#staff input[id^="staffLastView"]').forEach(function(el){if(el.id!=='staffLastViewV054'){var f=el.closest('[id^="staffLastViewField"]');if(f&&f.id!=='staffLastViewFieldV054'){try{f.remove();}catch(e){f.style.display='none';}}}});
    var order=['staffDataSubmittedFieldV5288','staffDataPointsFieldV5288','staffEmailFieldV024','staffPortalLinkFieldV5312','staffLastViewFieldV054'];
    order.forEach(function(id){var el=by(id)||qs('#staff .'+id); if(el&&el.parentNode!==wrap)wrap.appendChild(el);});
    var lock=by('staffEmailLockBtnV025');if(lock){lock.style.background='transparent';lock.style.border='0';lock.style.boxShadow='none';lock.style.borderRadius='0';lock.classList.add('historyLockV018');}
    var view=by('staffDataViewBtnV5289');if(view)view.classList.add('btn','small','staffDataViewBtnV5289');
    var copy=qs('#staff .staffPortalCopyBtnV5312');if(copy)copy.classList.add('btn','small','staffPortalCopyBtnV5312');
  }
  function scheduleStaffRow(){if(activePage()!=='staff')return;[0,80,250,600].forEach(function(ms){setTimeout(normalizeStaffRow,ms);});}

  function captureScheduleShell(){try{if(!scheduleShell&&by('schedule'))scheduleShell=by('schedule').innerHTML;}catch(e){}}
  function restoreScheduleShell(){try{if(scheduleShell&&by('schedule')){by('schedule').innerHTML=scheduleShell;try{window.scheduleData=null;scheduleData=null;}catch(e1){}try{window.selectedSchedule='';selectedSchedule='';}catch(e2){}return true;}}catch(e){}return false;}
  function installBellLifecycle(){
    captureScheduleShell();
    var prior=window.gaV049BeforePageSwitch;
    if(prior&&prior.__v054BellWrap) return;
    var wrapped=function(nextPage,btn,currentPage){
      currentPage=currentPage||activePage();
      if(currentPage==='schedule'&&nextPage!=='schedule') restoreScheduleShell();
      if(typeof prior==='function') return prior.apply(this,arguments);
      return true;
    };
    wrapped.__v054BellWrap=true;window.gaV049BeforePageSwitch=wrapped;
    if(typeof window.loadScheduleData==='function'&&!window.loadScheduleData.__v054SchoolWrap){
      var baseLoad=window.loadScheduleData;
      window.loadScheduleData=function(opts){
        opts=opts||{};
        var sk=schoolKey();
        if(lastSchoolKey&&sk&&sk!==lastSchoolKey){try{window.scheduleData=null;scheduleData=null;window.advancedSetupDataV5131=null;advancedSetupDataV5131=null;}catch(e){} opts.preferCache=false; opts.forceRefresh=true;}
        lastSchoolKey=sk;
        return baseLoad.call(this,opts);
      };
      window.loadScheduleData.__v054SchoolWrap=true;try{loadScheduleData=window.loadScheduleData;}catch(e){}
    }
    if(typeof window.loadAdvancedSetupDataV5131==='function'&&!window.loadAdvancedSetupDataV5131.__v054SchoolWrap){
      var baseAdv=window.loadAdvancedSetupDataV5131;
      window.loadAdvancedSetupDataV5131=function(cb){
        var sk=schoolKey();
        if(lastSchoolKey&&sk&&sk!==lastSchoolKey){try{window.advancedSetupDataV5131=null;advancedSetupDataV5131=null;}catch(e){}}
        lastSchoolKey=sk;
        return baseAdv.call(this,cb);
      };
      window.loadAdvancedSetupDataV5131.__v054SchoolWrap=true;try{loadAdvancedSetupDataV5131=window.loadAdvancedSetupDataV5131;}catch(e){}
    }
  }

  function staffStatsKey(name){return norm(name||'');}
  function mergeStaffMetricsIntoData(staffStats){
    staffMetricCache=staffStats||{};
    try{
      var list=(window.staffData&&window.staffData.staff)||(typeof staffData!=='undefined'&&staffData&&staffData.staff)||[];
      (list||[]).forEach(function(st){var k=staffStatsKey(st.name);var x=staffMetricCache[k]||staffMetricCache[clean(st.name)]||null;if(x){st.lastDataSubmitted=x.lastSubmitted||x.lastDataSubmitted||'';st.dataPointsContributed=Number(x.count!=null?x.count:(x.dataPointsContributed||0));}});
    }catch(e){}
  }
  function refreshStaffMetricUi(){
    try{var st=window.currentStaff||(typeof currentStaff!=='undefined'?currentStaff:null);if(!st)return;var x=staffMetricCache[staffStatsKey(st.name)]||staffMetricCache[clean(st.name)]||null;if(x){st.lastDataSubmitted=x.lastSubmitted||x.lastDataSubmitted||'';st.dataPointsContributed=Number(x.count!=null?x.count:(x.dataPointsContributed||0));} if(typeof window.updateStaffDataStatsUiV5288==='function')window.updateStaffDataStatsUiV5288(st); else {var last=by('staffLastDataSubmittedV5288'),cnt=by('staffDataPointsContributedV5288'); if(last)last.value=(st.lastDataSubmitted||''); if(cnt)cnt.value=String(st.dataPointsContributed||0);} }catch(e){}
  }
  function loadDataMetrics(){
    return fetchJson(api('/api/v054/data-metrics')).then(function(j){mergeStaffMetricsIntoData(j.staffStats||{});refreshStaffMetricUi();try{var sync=by('dashDataLastSynced');if(sync)sync.textContent=j.lastRefresh||'';}catch(e){}return j;}).catch(function(e){try{console.warn('v054 data metrics load failed',e);}catch(x){}return null;});
  }
  function installDataRefresh(){
    var baseRun=window.runAction;
    if(typeof baseRun==='function'&&!baseRun.__v054DataWrap){
      window.runAction=function(action){
        if(action==='folders'){
          try{if(typeof setMsg==='function')setMsg('Updating data points...','warn');}catch(e){}
          return fetchJson('/api/v054/data-metrics/refresh',{method:'POST',body:JSON.stringify(payload())}).then(function(j){
            mergeStaffMetricsIntoData(j.staffStats||{});refreshStaffMetricUi();
            try{if(typeof v5268CacheClear==='function'){v5268CacheClear('staff');v5268CacheClear('students');v5268CacheClear('dashboard');}}catch(e0){}
            try{if(typeof loadStudentData==='function')loadStudentData(null,{preferCache:false,forceRefresh:true,skipNew:true});}catch(e1){}
            try{if(typeof loadStaffData==='function')loadStaffData(null,{preferCache:false,forceRefresh:true,keepRowIndex:(window.currentStaff&&currentStaff.rowIndex)||0,keepName:(window.currentStaff&&currentStaff.name)||''});}catch(e2){}
            try{if(typeof loadDashboardSummary==='function')loadDashboardSummary({preferCache:false,forceRefresh:true,refresh:true});}catch(e3){}
            try{if(activePage()==='dataManager'&&typeof renderDataManager==='function')setTimeout(renderDataManager,300);}catch(e4){}
            try{if(typeof setMsg==='function')setMsg((j&&j.message)||'Data points updated.','ok');}catch(e5){}
            return j;
          }).catch(function(e){try{if(typeof setMsg==='function')setMsg('Could not update data points: '+((e&&e.message)||e),'err');}catch(x){} if(baseRun)return baseRun.apply(this,arguments);});
        }
        return baseRun.apply(this,arguments);
      };
      window.runAction.__v054DataWrap=true;try{runAction=window.runAction;}catch(e){}
    }
    var baseSelect=window.selectStaff;
    if(typeof baseSelect==='function'&&!baseSelect.__v054MetricsWrap){
      window.selectStaff=function(){var r=baseSelect.apply(this,arguments);refreshStaffMetricUi();scheduleStaffRow();return r;};
      window.selectStaff.__v054MetricsWrap=true;try{selectStaff=window.selectStaff;}catch(e){}
    }
  }
  function installNavWrap(){
    var baseShow=window.showPage;
    if(typeof baseShow==='function'&&!baseShow.__v054Wrap){
      window.showPage=function(page,btn){var r=baseShow.apply(this,arguments);if(page==='staff')scheduleStaffRow();if(page==='schedule')setTimeout(captureScheduleShell,100);if(page==='dashboard'){setTimeout(function(){var w=qs('#dashboard .dashboardTile[data-tile="warnings"]');if(w)w.style.display='none';},60);}return r;};
      window.showPage.__v054Wrap=true;try{showPage=window.showPage;}catch(e){}
    }
  }
  function boot(){addStyles();captureScheduleShell();installBellLifecycle();installDataRefresh();installNavWrap();scheduleStaffRow();loadDataMetrics();setTimeout(function(){var w=qs('#dashboard .dashboardTile[data-tile="warnings"]');if(w)w.style.display='none';},120);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,30);}); else setTimeout(boot,30);
  setTimeout(function(){try{captureScheduleShell();scheduleStaffRow();loadDataMetrics();}catch(e){}},900);
  window.gaV054Diag=function(){return {version:VERSION,active:activePage(),school:schoolKey(),hasScheduleShell:!!scheduleShell,staffMetricCount:Object.keys(staffMetricCache||{}).length};};
})();

/* ===== END ga-redis-v054-ui-patches.js ===== */

/* ===== BEGIN ga-redis-v05418d-data-manager-patches.js ===== */
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

/* ===== END ga-redis-v05418d-data-manager-patches.js ===== */

/* ===== BEGIN ga-redis-v05418e-data-manager-persistence.js ===== */
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

/* ===== END ga-redis-v05418e-data-manager-persistence.js ===== */

/* ===== BEGIN ga-redis-v05418f-data-manager-diagnostics.js ===== */
/* GA Scheduler 0.54.18f Data Manager persistence, bulk URL save, and Form access diagnostics. */
(function(){
  if (window.__gaDataManagerV05418F) return;
  window.__gaDataManagerV05418F = true;

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function msg(text,type){ try{ if(typeof window.setMsg==='function') window.setMsg(text,type||'ok'); }catch(e){} }
  function schoolPayload(){
    var out={};
    try{
      var ctx=window.campusContextV5253||window.campusContext||window.selectedCampusContext||{};
      var cur=ctx.currentCampus||{};
      var sel=by('campusSelector');
      var opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;
      var sid=clean((sel&&sel.value)||ctx.selectedCampusId||ctx.schoolId||ctx.campusId||cur.campusId||cur.id||'');
      var ss=clean(ctx.selectedSpreadsheetId||ctx.spreadsheetId||cur.spreadsheetId||(opt&&(opt.getAttribute('data-spreadsheet-id')||opt.getAttribute('data-ss-id')))||'');
      var nm=clean(ctx.selectedCampusName||ctx.schoolName||ctx.campusName||cur.campusName||cur.name||(opt&&opt.textContent)||'');
      if(sid) out.school=out.schoolId=out.selectedCampusId=out.campusId=sid;
      if(ss) out.spreadsheetId=out.selectedSpreadsheetId=ss;
      if(nm) out.name=out.schoolName=out.selectedCampusName=out.campusName=nm;
    }catch(e){}
    return out;
  }
  function qsPayload(){ var p=schoolPayload(), q=new URLSearchParams(); Object.keys(p).forEach(function(k){ if(p[k]) q.set(k,p[k]); }); q.set('_t',String(Date.now())); return q.toString(); }
  function jsonFetch(url, opts){
    opts=opts||{}; opts.credentials='same-origin'; opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});
    return fetch(url,opts).then(function(res){ return res.json().catch(function(){return {};}).then(function(j){ if(!res.ok||j.ok===false){var err=new Error(j.error||j.message||('Request failed: HTTP '+res.status)); err.response=j; throw err;} return j; }); });
  }
  function downloadJson(name,data){
    try{ var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href); a.remove();},1000); }catch(e){ console.log(data); }
  }
  function formatStamp(value){
    var s=clean(value); if(!s) return '';
    if(/^\d{1,2}\/\d{1,2}\/\d{4}\s*@\s*/.test(s)) return s;
    var d=new Date(s); if(Number.isNaN(d.getTime())) return s;
    var mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'), yyyy=d.getFullYear();
    var h=d.getHours(), ap=h>=12?'PM':'AM'; h=h%12||12;
    return mm+'/'+dd+'/'+yyyy+' @ '+String(h).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+' '+ap;
  }
  function setLastRefresh(value){
    var stamp=formatStamp(value)||'Not recorded';
    window.portalSettingsData=window.portalSettingsData||{};
    if(stamp!=='Not recorded') window.portalSettingsData.folderLastRefresh=stamp;
    ['dataManagerLastRefresh','folderLastRefresh'].forEach(function(id){ var el=by(id); if(el) el.textContent='Last refreshed on: '+stamp; });
    return stamp;
  }
  function rowIndexOf(st){ return Number(st&&(st.rowIndex||st.row||st.index)||0); }
  function patchStudent(rowIndex, patch){
    rowIndex=Number(rowIndex||0); if(!rowIndex) return;
    try{ var list=(window.studentData&&window.studentData.students)||[]; list.forEach(function(st){ if(rowIndexOf(st)===rowIndex) Object.assign(st,patch||{}); }); }catch(e){}
  }
  function patchDataFileRows(rows){
    (rows||[]).forEach(function(r){ patchStudent(r.rowIndex,{dataFiles:r.url||'',dataPoints:r.points||r.dataPoints||'',dataFilesLastUpdated:r.lastUpdated||r.dataFilesLastUpdated||''}); });
  }
  function staffKey(name){ return clean(name).toLowerCase().replace(/\s+/g,' '); }
  var staffMetricCacheF={};
  function applyStaffStats(stats){
    staffMetricCacheF=stats||staffMetricCacheF||{};
    try{ var list=(window.staffData&&window.staffData.staff)||[]; list.forEach(function(st){ var x=staffMetricCacheF[staffKey(st.name)]||staffMetricCacheF[clean(st.name)]||null; if(x){ st.lastDataSubmitted=x.lastSubmitted||x.lastDataSubmitted||''; st.dataPointsContributed=Number(x.count!=null?x.count:(x.dataPointsContributed||0)); } }); }catch(e){}
    try{ var cur=window.currentStaff||(typeof currentStaff!=='undefined'?currentStaff:null); if(cur){ var y=staffMetricCacheF[staffKey(cur.name)]||staffMetricCacheF[clean(cur.name)]||null; if(y){ cur.lastDataSubmitted=y.lastSubmitted||y.lastDataSubmitted||''; cur.dataPointsContributed=Number(y.count!=null?y.count:(y.dataPointsContributed||0)); } if(typeof window.updateStaffDataStatsUiV5288==='function') window.updateStaffDataStatsUiV5288(cur); } }catch(e2){}
  }
  function renderDataManagerSoon(){ try{ if(document.querySelector('#dataManager.active')&&typeof window.renderDataManager==='function') setTimeout(function(){window.renderDataManager(); enforceLastRefreshFromCache(); ensureDiagnosticButton();},30); }catch(e){} }
  function enforceLastRefreshFromCache(){ try{ if(window.portalSettingsData&&window.portalSettingsData.folderLastRefresh) setLastRefresh(window.portalSettingsData.folderLastRefresh); }catch(e){} }
  function applyMetricsResponse(r, opts){
    opts=opts||{}; r=r||{};
    var stamp=r.lastRefresh||(r.dataFiles&&r.dataFiles.summary&&r.dataFiles.summary.lastRefresh)||'';
    if(stamp) setLastRefresh(stamp);
    if(r.dataFiles&&r.dataFiles.rows) patchDataFileRows(r.dataFiles.rows);
    if(r.staffStats) applyStaffStats(r.staffStats);
    if(opts.render) renderDataManagerSoon();
    return r;
  }
  function loadPersistedMetrics(opts){
    opts=opts||{};
    return jsonFetch('/api/v054/data-metrics?'+qsPayload()).then(function(r){ return applyMetricsResponse(r,{render:!!opts.render}); }).catch(function(e){ if(opts.showErrors) msg('Could not load saved data metrics: '+(e.message||e),'err'); return null; });
  }
  function collectUrlRows(){
    return Array.prototype.slice.call(document.querySelectorAll('.dataManagerUrl')).map(function(input){ return { rowIndex:Number(input.getAttribute('data-data-url-row')||0), url:input.value||'' }; }).filter(function(r){return r.rowIndex>=2;});
  }
  function saveAllUrlsBulk(){
    var rows=collectUrlRows(); if(!rows.length){ msg('No data links to save.','warn'); return Promise.resolve(null); }
    msg('Saving all data links...','warn');
    return jsonFetch('/api/v05418f/student-data-urls/save-bulk',{method:'POST',body:JSON.stringify(Object.assign({},schoolPayload(),{rows:rows}))}).then(function(r){
      (r.rows||[]).forEach(function(x){ patchStudent(x.rowIndex,{dataFiles:x.url||'',dataPoints:x.dataPoints||'',dataFilesLastUpdated:x.dataFilesLastUpdated||''}); });
      msg(r.message||('Saved '+rows.length+' data link field(s).'),'ok');
      renderDataManagerSoon();
      return r;
    }).catch(function(e){ msg('Could not save all data links: '+(e.message||e),'err'); throw e; });
  }
  function refreshMetrics(){
    msg('Updating data points...','warn');
    return jsonFetch('/api/v054/data-metrics/refresh',{method:'POST',body:JSON.stringify(schoolPayload())}).then(function(r){
      applyMetricsResponse(r,{render:true});
      try{ if(typeof window.v5268CacheClear==='function'){ window.v5268CacheClear('students'); window.v5268CacheClear('staff'); window.v5268CacheClear('dashboard'); window.v5268CacheClear('settings'); } }catch(e){}
      var suffix=r.errors?' Some forms still failed response access.':'';
      msg((r.message||'Data points updated.')+suffix,r.errors?'warn':'ok');
      return r;
    }).catch(function(e){ msg('Could not update data points: '+(e.message||e),'err'); throw e; });
  }
  function ensureDiagnosticButton(){
    var old=by('dataFormDiagBtnV05418F');
    if(old&&old.parentNode)old.parentNode.removeChild(old);
  }
  function runFormDiagnostic(){
    msg('Running Form Access Diagnostic...','warn');
    var payload=Object.assign({},schoolPayload(),{limit:25});
    return jsonFetch('/api/v05418f/data-form-diagnostics',{method:'POST',body:JSON.stringify(payload)}).then(function(r){
      downloadJson('form-access-diagnostic-'+(r.version||'05418f')+'.json',r);
      var failed=(r.checked||[]).filter(function(x){return !x.ok;}).length;
      msg(failed?('Diagnostic complete: '+failed+' form(s) failed. JSON downloaded.'):'Diagnostic complete: checked forms passed. JSON downloaded.',failed?'warn':'ok');
      return r;
    }).catch(function(e){ msg('Could not run Form Access Diagnostic: '+(e.message||e),'err'); throw e; });
  }
  window.saveAllDataManagerUrlsV05418F=saveAllUrlsBulk;
  window.refreshDataMetricsV05418F=refreshMetrics;
  window.loadPersistedDataMetricsV05418F=loadPersistedMetrics;
  window.runDataFormAccessDiagnosticsV05418F=runFormDiagnostic;

  window.addEventListener('click',function(e){
    var t=e.target&&e.target.closest?e.target.closest('[data-action],[data-run]'):null; if(!t) return;
    var a=t.getAttribute('data-action')||'', run=t.getAttribute('data-run')||'';
    if(a==='data-save-all-urls'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); saveAllUrlsBulk(); return false; }
    if(a==='data-form-diagnostic'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); runFormDiagnostic(); return false; }
    if(run==='folders'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); refreshMetrics(); return false; }
  },true);

  var baseRender=window.renderDataManager;
  if(typeof baseRender==='function'&&!baseRender.__v05418F){
    window.renderDataManager=function(){ var r=baseRender.apply(this,arguments); enforceLastRefreshFromCache(); ensureDiagnosticButton(); clearTimeout(window.__dmMetricsF); window.__dmMetricsF=setTimeout(function(){loadPersistedMetrics({render:false});},100); return r; };
    window.renderDataManager.__v05418F=true; try{renderDataManager=window.renderDataManager;}catch(e){}
  }
  if(typeof window.registerNavigationAfterHookV5_==='function'){
    window.registerNavigationAfterHookV5_(function(page){ if(page==='dataManager'||page==='staff'||page==='students'||page==='settings'){ setTimeout(function(){ensureDiagnosticButton(); loadPersistedMetrics({render:false});},160); setTimeout(enforceLastRefreshFromCache,500); } },'v05418fDataMetricsPersistence');
  }
  function boot(){ ensureDiagnosticButton(); loadPersistedMetrics({render:false}); setTimeout(enforceLastRefreshFromCache,400); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,80);}); else setTimeout(boot,80);
})();

/* ===== END ga-redis-v05418f-data-manager-diagnostics.js ===== */

/* ===== BEGIN ga-redis-v05418q-system-admin-brevo.js ===== */
/* Support Schedules 0.54.18t Brevo System Admin provider settings + staff notification tracking diagnostics. */
(function(){
  if(window.__GA_V05418Q_BREVO_SYSTEM_ADMIN__) return;
  window.__GA_V05418Q_BREVO_SYSTEM_ADMIN__ = true;
  function by(id){ return document.getElementById(id); }
  function parseJsonResponse(res){ return res.text().then(function(txt){ var j={}; try{ j=txt?JSON.parse(txt):{}; }catch(e){ throw new Error('Expected JSON, got: '+String(txt||'').slice(0,120)); } if(!res.ok||j.ok===false) throw new Error(j.error||j.message||('HTTP '+res.status)); return j; }); }
  function getJson(url){ return fetch(url,{credentials:'same-origin',cache:'no-store'}).then(parseJsonResponse); }
  function postJson(url, body){ return fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})}).then(parseJsonResponse); }
  function host(){ return document.querySelector('#multiCampus .mcSystemLeftV5302') || document.querySelector('#multiCampus .mcSystemColV5302') || document.querySelector('#multiCampus .multiCampusGrid') || by('multiCampus'); }
  function removeOldSettingsCard(){ var old=by('brevoSettingsCardV05418N'); if(old && !old.closest('#multiCampus')) old.remove(); }
  function ensureCard(){
    removeOldSettingsCard();
    var h=host(); if(!h) return null;
    var existing=by('brevoSystemAdminCardV05418O'); if(existing) return existing;
    var card=document.createElement('div');
    card.id='brevoSystemAdminCardV05418O';
    card.className='card brevoSystemAdminCardV05418O';
    card.innerHTML=''+
      '<h2>Email (via Brevo)</h2>'+ 
      '<div class="muted">Global transactional email provider for Share Schedules, Staff Portal absence notifications, and public contact form leads.</div>'+ 
      '<div class="brevoGridV05418O" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px">'+
        '<label style="display:flex;align-items:center;gap:8px;font-weight:800"><input id="brevoEnabledV05418N" type="checkbox" style="width:auto"> Enable Brevo email</label>'+ 
        '<label style="display:flex;align-items:center;gap:8px;font-weight:800"><input id="brevoScheduleEnabledV05418N" type="checkbox" style="width:auto"> Share Schedules emails</label>'+ 
        '<label style="display:flex;align-items:center;gap:8px;font-weight:800"><input id="brevoAbsenceEnabledV05418N" type="checkbox" style="width:auto"> Absence notification emails</label>'+ 
        '<label style="display:flex;align-items:center;gap:8px;font-weight:800"><input id="brevoContactEnabledV05418O" type="checkbox" style="width:auto"> Contact form lead emails</label>'+ 
        '<div><label>From name</label><input id="brevoFromNameV05418N" placeholder="Support Schedules"></div>'+ 
        '<div><label>From email</label><input id="brevoFromEmailV05418N" placeholder="schedules@supportschedules.com"></div>'+ 
        '<div><label>Reply-to email</label><input id="brevoReplyToEmailV05418N" placeholder="optional"></div>'+ 
        '<div><label>Brevo API key</label><input id="brevoApiKeyV05418N" type="password" placeholder="Paste only when adding/replacing key"><div id="brevoApiKeyStatusV05418N" class="muted"></div></div>'+ 
        '<div><label>Test recipient</label><input id="brevoTestRecipientV05418N" placeholder="you@example.edu"></div>'+ 
        '<div><label>Contact form recipients</label><textarea id="brevoContactRecipientsV05418O" placeholder="sales@example.com" style="min-height:72px"></textarea></div>'+ 
        '<label style="display:flex;align-items:center;gap:8px;font-weight:800"><input id="brevoTrackingEnabledV05418Q" type="checkbox" style="width:auto"> Track staff email delivery/open/click events</label>'+ 
        '<div><label>Webhook token</label><input id="brevoWebhookTokenV05418Q" type="password" placeholder="Paste only when adding/replacing token"><div id="brevoWebhookTokenStatusV05418Q" class="muted"></div></div>'+ 
        '<div><label>Brevo webhook URL</label><input id="brevoWebhookUrlV05418Q" readonly value="/api/communication/brevo-webhook-v05418q?token=YOUR_TOKEN"><div class="muted">Use this path in Brevo transactional webhooks. This tracks Share Schedules emails only, not absence notifications.</div></div>'+ 
      '</div>'+ 
      '<div class="toolbar" style="margin-top:10px"><button class="btn primary" type="button" data-v05418o-brevo="save">Save Brevo Settings</button><button class="btn" type="button" data-v05418o-brevo="test">Send Test Email</button><button class="btn" type="button" data-v05418o-brevo="reload">Reload</button><button class="btn" type="button" data-v05418o-brevo="diag">Reload Webhook Diagnostics</button><span id="brevoMsgV05418N" class="muted"></span></div>'+
      '<div class="brevoDiagV05418T" style="margin-top:10px;border:1px solid #dbe3ef;border-radius:12px;padding:10px;background:#f8fafc"><strong>Webhook diagnostics</strong><div id="brevoWebhookDiagV05418T" class="muted" style="margin-top:4px">No webhook diagnostics loaded yet.</div></div>';
    h.appendChild(card);
    loadSettings();
    return card;
  }
  function setMsg(text, cls){ var m=by('brevoMsgV05418N'); if(m){ m.textContent=text||''; m.className='muted '+(cls||''); } }
  function loadWebhookDiagnosticsV05418T(){
    var el=by('brevoWebhookDiagV05418T'); if(!el) return;
    getJson('/api/communication/brevo-webhook-diagnostics-v05418t?_t='+Date.now()).then(function(j){
      var d=j.diagnostics||{};
      var recent=j.recent||[];
      var last=recent.length?recent[recent.length-1]:{};
      el.innerHTML='Last received: <b>'+(d.updatedAt||'none yet')+'</b> · matched: <b>'+(d.matched||'0')+'</b> · ignored: <b>'+(d.ignored||'0')+'</b> · duplicates: <b>'+(d.duplicates||'0')+'</b>'+(last.lastDetails?'<br><span>Latest detail: '+String(last.lastDetails).slice(0,220)+'</span>':'');
    }).catch(function(e){ el.textContent='Could not load webhook diagnostics: '+(e.message||e); });
  }
  function loadSettings(){
    if(!by('brevoSystemAdminCardV05418O')) return;
    setMsg('Loading Brevo email settings...');
    getJson('/api/communication/brevo-settings-v05418n?_t='+Date.now()).then(function(j){
      if(by('brevoEnabledV05418N')) by('brevoEnabledV05418N').checked=!!j.enabled;
      if(by('brevoScheduleEnabledV05418N')) by('brevoScheduleEnabledV05418N').checked=!!j.scheduleEnabled;
      if(by('brevoAbsenceEnabledV05418N')) by('brevoAbsenceEnabledV05418N').checked=!!j.absenceEnabled;
      if(by('brevoContactEnabledV05418O')) by('brevoContactEnabledV05418O').checked=!!j.contactEnabled;
      if(by('brevoTrackingEnabledV05418Q')) by('brevoTrackingEnabledV05418Q').checked=!!j.trackingEnabled;
      if(by('brevoFromNameV05418N')) by('brevoFromNameV05418N').value=j.fromName||'Support Schedules';
      if(by('brevoFromEmailV05418N')) by('brevoFromEmailV05418N').value=j.fromEmail||'schedules@supportschedules.com';
      if(by('brevoReplyToEmailV05418N')) by('brevoReplyToEmailV05418N').value=j.replyToEmail||'';
      if(by('brevoTestRecipientV05418N')) by('brevoTestRecipientV05418N').value=j.testRecipient||'';
      if(by('brevoContactRecipientsV05418O')) by('brevoContactRecipientsV05418O').value=j.contactRecipients||'';
      if(by('brevoApiKeyStatusV05418N')) by('brevoApiKeyStatusV05418N').textContent=j.apiKeySaved?('API key saved ('+(j.apiKeyMasked||'saved')+'). Leave blank to keep it.'):('No API key saved yet.');
      if(by('brevoWebhookTokenStatusV05418Q')) by('brevoWebhookTokenStatusV05418Q').textContent=j.webhookTokenSaved?('Webhook token saved ('+(j.webhookTokenMasked||'saved')+'). Leave blank to keep it.'):('No webhook token saved yet.');
      if(by('brevoWebhookUrlV05418Q')) by('brevoWebhookUrlV05418Q').value=(location.origin||'')+(j.webhookPath||'/api/communication/brevo-webhook-v05418q?token=YOUR_TOKEN');
      setMsg('Brevo email settings loaded.'); loadWebhookDiagnosticsV05418T();
    }).catch(function(e){ setMsg('Could not load Brevo settings: '+(e.message||e),'err'); });
  }
  function collect(){ return {
    enabled: !!(by('brevoEnabledV05418N')&&by('brevoEnabledV05418N').checked),
    scheduleEnabled: !!(by('brevoScheduleEnabledV05418N')&&by('brevoScheduleEnabledV05418N').checked),
    absenceEnabled: !!(by('brevoAbsenceEnabledV05418N')&&by('brevoAbsenceEnabledV05418N').checked),
    contactEnabled: !!(by('brevoContactEnabledV05418O')&&by('brevoContactEnabledV05418O').checked),
    trackingEnabled: !!(by('brevoTrackingEnabledV05418Q')&&by('brevoTrackingEnabledV05418Q').checked),
    fromName: (by('brevoFromNameV05418N')||{}).value||'',
    fromEmail: (by('brevoFromEmailV05418N')||{}).value||'',
    replyToEmail: (by('brevoReplyToEmailV05418N')||{}).value||'',
    apiKey: (by('brevoApiKeyV05418N')||{}).value||'',
    testRecipient: (by('brevoTestRecipientV05418N')||{}).value||'',
    contactRecipients: (by('brevoContactRecipientsV05418O')||{}).value||'',
    webhookToken: (by('brevoWebhookTokenV05418Q')||{}).value||''
  }; }
  function saveSettings(){
    var p=collect();
    setMsg('Saving Brevo email settings...');
    postJson('/api/communication/brevo-settings-v05418n', p).then(function(j){ if(by('brevoApiKeyV05418N')) by('brevoApiKeyV05418N').value=''; if(by('brevoWebhookTokenV05418Q')) by('brevoWebhookTokenV05418Q').value=''; setMsg(j.message||'Brevo settings saved.','ok'); loadSettings(); }).catch(function(e){ setMsg('Could not save Brevo settings: '+(e.message||e),'err'); });
  }
  function sendTest(){
    var p=collect();
    setMsg('Sending Brevo test email...');
    postJson('/api/communication/brevo-test-v05418n', {to:p.testRecipient,testRecipient:p.testRecipient}).then(function(j){ setMsg(j.message||'Brevo test email sent.','ok'); }).catch(function(e){ setMsg('Brevo test failed: '+(e.message||e),'err'); });
  }
  document.addEventListener('click',function(e){
    var b=e.target&&e.target.closest&&e.target.closest('[data-v05418o-brevo]'); if(!b) return;
    var a=b.getAttribute('data-v05418o-brevo'); e.preventDefault();
    if(a==='save') saveSettings(); else if(a==='test') sendTest(); else if(a==='reload') loadSettings(); else if(a==='diag') loadWebhookDiagnosticsV05418T();
  },true);
  function boot(){ ensureCard(); }
  try{ if(typeof window.registerNavigationAfterHookV5_==='function') window.registerNavigationAfterHookV5_(function(page){ if(page==='multiCampus') setTimeout(boot,120); },'v05418qBrevoSystemAdmin'); }catch(e){}
  var mo=new MutationObserver(function(){ if(by('multiCampus')&&!by('brevoSystemAdminCardV05418O')) setTimeout(boot,120); removeOldSettingsCard(); });
  try{ mo.observe(document.body,{childList:true,subtree:true}); }catch(e){}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else setTimeout(boot,250);
})();

/* ===== END ga-redis-v05418q-system-admin-brevo.js ===== */

/* ===== BEGIN ga-redis-v05418cb-communication-manager.js ===== */
/* Support Schedules 0.54.18ba Communication Manager: school-scoped, edit-safe loader. Adds App Push Notification column. */
(function(){
  'use strict';
  if(window.__GA_V05418BU_COMMUNICATION_MANAGER__) return;
  window.__GA_V05418BU_COMMUNICATION_MANAGER__ = true;
  function by(id){return document.getElementById(id);} 
  function clean(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function norm(v){return clean(v).toLowerCase().replace(/\s+/g,' ');} 
  function selectedSchoolId(){
    var sel=by('campusSelector');
    if(sel && clean(sel.value)) return clean(sel.value);
    try{var p=(typeof window.selectedSchoolPayloadV686m20==='function'?window.selectedSchoolPayloadV686m20():null)||{};var v=clean(p.school||p.schoolId||p.campusId||p.selectedCampusId||'');if(v)return v;}catch(e){}
    try{var p2=(typeof window.selectedSchoolPayloadV683==='function'?window.selectedSchoolPayloadV683():null)||{};var v2=clean(p2.school||p2.schoolId||p2.campusId||p2.selectedCampusId||'');if(v2)return v2;}catch(e2){}
    try{var ctx=window.campusContextV5253||{};return clean(ctx.selectedCampusId||(ctx.currentCampus&&ctx.currentCampus.campusId)||ctx.schoolId||ctx.campusId||'');}catch(e3){}
    return '';
  }
  function api(path,params){params=params||{};if(!params.school)params.school=selectedSchoolId();params._t=Date.now();return path+'?'+new URLSearchParams(params).toString();}
  function fetchJson(url,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(url,opts).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||j.message||('HTTP '+r.status));return j;});});}
  function setMsg(msg,type){try{if(typeof window.setMsg==='function')return window.setMsg(msg,type||'warn');}catch(e){}var el=by('globalMsg');if(el){el.className='msg '+(type||'');el.style.display=msg?'block':'none';el.textContent=msg||'';}}
  function transientMsg(msg,type,ms){setMsg(msg,type||'ok');var text=String(msg||'');setTimeout(function(){try{var el=by('globalMsg');if(el&&String(el.textContent||'')===text){el.textContent='';el.style.display='none';}}catch(e){}},ms||3200);}
  function activePage(){try{if(typeof window.activeSectionIdV51229==='function')return window.activeSectionIdV51229()||'';}catch(e){}var s=document.querySelector('.section.active');return s?s.id:'';}
  var commLoadSeq=0, commLastSchool='', commDirtySince=0, commLastRenderAt=0, lastLoadedStaffV05418R=[];
  function hasDirtyEmailEdit(){return !!document.querySelector('.emailInputV05418T[data-dirty="1"], .phoneInputV05418PH[data-dirty="1"]');}
  function emailEditActive(){var el=document.activeElement;return !!(el&&el.classList&&(el.classList.contains('emailInputV05418T')||el.classList.contains('phoneInputV05418PH')));}
  function canRefresh(force){if(force)return true;if(emailEditActive()||hasDirtyEmailEdit())return false;if(Date.now()-commDirtySince<10000)return false;return true;}
  function installStyles(){
    if(by('gaRedisV05418RCommStyles'))return;
    var css=''+
      '.communicationManagerGridV05418R{display:grid;grid-template-columns:1fr;gap:12px}.communicationManagerCardV05418R{border:1px solid #dbe3ef;border-radius:14px;padding:12px;background:#fff}.v05418RTable{width:100%;border-collapse:collapse}.v05418RTable th,.v05418RTable td{border-bottom:1px solid #e5edf7;padding:7px;text-align:left;vertical-align:middle}.v05418RTable th{font-size:12px;color:#64748b;background:#f8fafc}.v05418RStatus{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:900;white-space:nowrap}.v05418RStatus.ok{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0}.v05418RStatus.bad{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}.v05418RStatus.neutral{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}.linkBtnV05418R{border:0;background:transparent;color:#b91c1c;font-size:11px;font-weight:700;text-decoration:underline;cursor:pointer;padding:2px 0;margin-left:4px}.linkBtnV05418R:disabled{opacity:.5;cursor:wait}.portalLinkRowV05418R,.emailEditRowV05418T{display:grid;grid-template-columns:minmax(180px,1fr) 58px;gap:6px;align-items:center}.portalLinkInputV05418R,.emailInputV05418T{width:100%;min-width:0;height:32px;border:1px solid #dbe3ef;border-radius:10px;padding:0 8px;font-size:12px;color:#475569;background:#f8fafc}.emailInputV05418T[data-dirty="1"]{background:#fff7ed!important;border-color:#fdba74!important}.copyPortalBtnV05418R,.saveEmailBtnV05418T{height:32px!important;min-height:32px!important;width:58px!important;min-width:58px!important;padding:0 8px!important;text-align:center}.saveEmailBtnV05418T[data-saving="1"]{opacity:.68;cursor:wait!important}.communicationManagerCardV05418R[data-refreshing="1"]{position:relative}.communicationManagerCardV05418R[data-refreshing="1"]:after{content:"Updating...";position:absolute;right:12px;top:12px;font-size:11px;color:#64748b}.commShareBtnV05418R{background:#dcfce7!important;border-color:#86efac!important;color:#166534!important;font-weight:900!important;border-radius:12px!important}.commAnnounceBtnV05418R{background:#dbeafe!important;border-color:#93c5fd!important;color:#1d4ed8!important;font-weight:900!important;border-radius:12px!important}.commLogActionsV05418R{display:flex;gap:8px;align-items:center;margin-bottom:8px}.logNoteV05418R{font-size:12px;color:#64748b}.commManagerMetaV05418R{font-size:12px;color:#64748b;margin:4px 0 10px}body.darkModeV034 .communicationManagerCardV05418R{background:#172033!important;border-color:#334155!important;color:#f8fafc!important}body.darkModeV034 .portalLinkInputV05418R{background:#0f172a!important;color:#cbd5e1!important;border-color:#475569!important}.v05418RModalBackdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:none;align-items:center;justify-content:center;z-index:200;padding:16px}.v05418RModalBackdrop.open{display:flex}.v05418RModalPanel{width:min(560px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 20px 50px rgba(15,23,42,.25)}.v05418RModalHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.announceSectionV05418R{margin-bottom:16px}.announceTemplateRowV05418R{display:flex;gap:8px}.announceTemplateRowV05418R select{flex:1}.announceSectionV05418R:last-of-type{margin-bottom:0}.announceChannelsV05418R{display:flex;gap:10px;flex-wrap:wrap}.announceChannelChipV05418R{display:flex;align-items:center;gap:7px;border:1px solid #dbe3ef;background:#f8fafc;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:700;color:#334155;cursor:pointer;user-select:none}.announceChannelChipV05418R input{width:auto;margin:0;accent-color:#2563eb}.announceLabelV05418R{display:block;font-size:12px;font-weight:800;color:#334155;margin:0 0 6px}.announceInputV05418R{width:100%;height:38px;border:1px solid #dbe3ef;border-radius:10px;padding:0 10px;font-size:13px;box-sizing:border-box}.announceTextareaV05418R{width:100%;min-height:100px;border:1px solid #dbe3ef;border-radius:10px;padding:8px 10px;font-size:13px;box-sizing:border-box;font-family:inherit;resize:vertical}.announceStaffHeadV05418R{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.announceStaffListV05418R{max-height:220px;overflow:auto;border:1px solid #e5edf7;border-radius:10px}.announceStaffRowV05418R{display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:10px;padding:9px 12px;font-size:13px;border-bottom:1px solid #f1f5f9;cursor:pointer}.announceStaffRowV05418R:last-child{border-bottom:0}.announceStaffRowV05418R:hover{background:#f8fafc}.announceStaffRowV05418R input{width:auto;margin:0;accent-color:#2563eb}.announceStaffNameV05418R{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.announceStaffBadgesV05418R{display:flex;gap:6px;justify-self:end}.announceStaffBadgesV05418R:empty{display:none}.modalActions{display:flex;justify-content:flex-end;gap:8px}body.darkModeV034 .v05418RModalPanel{background:#172033!important;color:#f8fafc!important}body.darkModeV034 .announceInputV05418R,body.darkModeV034 .announceTextareaV05418R,body.darkModeV034 .announceStaffListV05418R{background:#0f172a!important;color:#cbd5e1!important;border-color:#475569!important}body.darkModeV034 .announceChannelChipV05418R{background:#0f172a!important;color:#cbd5e1!important;border-color:#475569!important}body.darkModeV034 .announceStaffRowV05418R:hover{background:#1e293b!important}.commManagerMetaV05418R.err{color:#b91c1c;font-weight:700}.announceSuccessV05418R{text-align:center;padding:20px 10px 6px}.announceSuccessIconV05418R{width:52px;height:52px;border-radius:50%;background:#ecfdf5;color:#166534;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;margin:0 auto}body.darkModeV034 .announceSuccessIconV05418R{background:#064e3b!important;color:#86efac!important}';
    var st=document.createElement('style');st.id='gaRedisV05418RCommStyles';st.textContent=css;document.head.appendChild(st);
  }
  function ensureSection(){
    var sec=by('communicationManager');
    if(!sec){var main=document.querySelector('main')||document.body;sec=document.createElement('section');sec.id='communicationManager';sec.className='section';main.appendChild(sec);} 
    var nav=document.querySelector('.nav'); if(nav && !document.querySelector('[data-nav="communicationManager"]')){var ref=document.querySelector('[data-nav="dataManager"]')||document.querySelector('[data-nav="staff"]'); var btn=document.createElement('button');btn.setAttribute('data-nav','communicationManager');btn.textContent='Communication Manager'; if(ref&&ref.parentNode)ref.parentNode.insertBefore(btn,ref.nextSibling); else nav.appendChild(btn);} 
    if(!by('communicationManagerBodyV05418R')){
      sec.innerHTML='<div class="card"><div class="toolbar" style="justify-content:space-between;align-items:center"><div></div><div style="display:flex;gap:8px"><button class="btn commAnnounceBtnV05418R" data-v05418r-action="open-announce">Send Announcement</button><button class="btn commShareBtnV05418R" data-v05418r-action="open-share-schedules">Relaunch Share Schedules</button></div></div><div id="communicationManagerBodyV05418R" class="communicationManagerGridV05418R" style="margin-top:12px"></div></div>';
    }
    ensureAnnounceModalShell();
    return sec;
  }
  // FEATURE: standalone broadcast, separate from Share Schedules -- for reminders, updates,
  // and anything else that isn't tied to publishing a schedule. Reuses the same staff list
  // already loaded for the main table (state.rows) rather than fetching it again.
  function ensureAnnounceModalShell(){
    if(by('announceModalV05418R'))return;
    var m=document.createElement('div');
    m.id='announceModalV05418R';
    m.className='v05418RModalBackdrop';
    (document.querySelector('main')||document.body).appendChild(m);
  }
  // Always rebuilds the compose form fresh -- important because a successful send replaces
  // this panel's content with a success screen (see showAnnounceSuccess), and without
  // rebuilding here, reopening the modal would show that stale success screen instead of a
  // usable form for the next announcement.
  function renderAnnounceForm(){
    var m=by('announceModalV05418R');
    if(!m)return;
    m.innerHTML='<div class="v05418RModalPanel">'
      + '<div class="v05418RModalHead"><h2 style="margin:0;font-size:16px">Send Announcement</h2><button class="btn" data-v05418r-action="close-announce">Close</button></div>'
      + '<p class="muted" style="margin:6px 0 16px">Send a one-off message to selected staff -- independent of any schedule. Choose how to send below; each recipient\'s email and app status is shown so you can see who\'s actually reachable by which method.</p>'
      + '<div class="announceSectionV05418R"><label class="announceLabelV05418R">Template</label><div class="announceTemplateRowV05418R"><select id="announceTemplateSelectV05418R" class="announceInputV05418R"><option value="">Start from scratch</option></select><button type="button" class="btn small" data-v05418r-action="announce-save-template">Save as template</button></div></div>'
      + '<div class="announceSectionV05418R"><label class="announceLabelV05418R">Subject</label><input type="text" id="announceSubjectV05418R" class="announceInputV05418R" placeholder="e.g. Reminder: early dismissal Friday"></div>'
      + '<div class="announceSectionV05418R"><label class="announceLabelV05418R">Message</label><textarea id="announceMessageV05418R" class="announceTextareaV05418R" placeholder="Write your message..."></textarea></div>'
      + '<div class="announceSectionV05418R">'
      + '<div class="announceStaffHeadV05418R"><label class="announceLabelV05418R" style="margin:0">Recipients</label><div><button type="button" class="linkBtnV05418R" data-v05418r-action="announce-select-all">Select all</button><button type="button" class="linkBtnV05418R" data-v05418r-action="announce-select-none">Select none</button></div></div>'
      + '<div id="announceStaffListV05418R" class="announceStaffListV05418R"></div>'
      + '</div>'
      + '<div id="announceMsgV05418R" class="commManagerMetaV05418R" style="margin-top:4px"></div>'
      + '<div class="modalActions" style="margin-top:6px"><button class="btn" data-v05418r-action="close-announce">Cancel</button><button class="btn primary" data-v05418r-action="send-announce-push">Send Push Notification</button><button class="btn primary" data-v05418r-action="send-announce-email">Send Email</button><button class="btn shareSendPreferredV018" data-v05418r-action="send-announce-preferred">Send via Preferred Communication</button></div>'
      + '</div>';
    loadAnnounceTemplates();
  }
  var announceTemplatesCache=[];
  function loadAnnounceTemplates(){
    var sel=by('announceTemplateSelectV05418R');
    if(!sel)return;
    fetchJson('/api/v05418y/templates'+(selectedSchoolId()?('?school='+encodeURIComponent(selectedSchoolId())):'')).then(function(j){
      announceTemplatesCache=j.templates||[];
      sel.innerHTML='<option value="">Start from scratch</option>'+announceTemplatesCache.map(function(t){return '<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>';}).join('');
    }).catch(function(){});
  }
  function applyAnnounceTemplate(id){
    var t=announceTemplatesCache.filter(function(x){return x.id===id;})[0];
    if(!t)return;
    var subjEl=by('announceSubjectV05418R'), msgEl=by('announceMessageV05418R');
    if(subjEl)subjEl.value=t.subject||'';
    if(msgEl)msgEl.value=t.message||'';
  }
  function saveAnnounceTemplate(){
    var subject=(by('announceSubjectV05418R')||{}).value||'';
    var message=(by('announceMessageV05418R')||{}).value||'';
    if(!message){window.alert('Write a message before saving it as a template.');return;}
    var name=window.prompt('Name this template (e.g. "Early dismissal"):','');
    if(!name)return;
    fetchJson('/api/v05418y/templates/save',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),name:name,subject:subject,message:message})}).then(function(){
      loadAnnounceTemplates();
    }).catch(function(e){window.alert('Could not save template: '+e.message);});
  }
  function openAnnounceModal(){
    ensureAnnounceModalShell();
    renderAnnounceForm();
    var list=by('announceStaffListV05418R');
    var rows=lastLoadedStaffV05418R;
    if(!rows.length){ list.innerHTML='<p class="muted" style="padding:8px">Load Communication Manager first to see staff.</p>'; }
    else {
      list.innerHTML=rows.map(function(r){
        var emailBadge=r.email?'<span class="v05418RStatus ok">Email</span>':'<span class="v05418RStatus neutral">No email</span>';
        var appBadge=r.appPaired?'<span class="v05418RStatus ok">App</span>':'<span class="v05418RStatus neutral">Not paired</span>';
        return '<label class="announceStaffRowV05418R"><input type="checkbox" class="announceStaffCheckV05418R" value="'+esc(r.staffName)+'" checked><span class="announceStaffNameV05418R">'+esc(r.staffName)+'</span><span class="announceStaffBadgesV05418R">'+emailBadge+appBadge+'</span></label>';
      }).join('');
    }
    by('announceMsgV05418R').textContent='';
    by('announceModalV05418R').classList.add('open');
  }
  function closeAnnounceModal(){ var m=by('announceModalV05418R'); if(m)m.classList.remove('open'); }
  function sendAnnouncement(mode){
    var subject=clean((by('announceSubjectV05418R')||{}).value);
    var message=clean((by('announceMessageV05418R')||{}).value);
    var staffNames=Array.prototype.slice.call(document.querySelectorAll('.announceStaffCheckV05418R:checked')).map(function(cb){return cb.value;});
    var msgEl=by('announceMsgV05418R');
    msgEl.className='commManagerMetaV05418R';
    if(!staffNames.length){msgEl.textContent='Select at least one recipient.';return;}
    if(!message){msgEl.textContent='Enter a message.';return;}
    var body={school:selectedSchoolId(),staffNames:staffNames,subject:subject,message:message};
    if(mode==='preferred'){body.mode='preferred';}
    else if(mode==='push'){body.sendEmail=false;body.sendPush=true;}
    else{body.sendEmail=true;body.sendPush=false;}
    var sendBtns=document.querySelectorAll('#announceModalV05418R [data-v05418r-action^="send-announce"]');
    sendBtns.forEach(function(b){b.disabled=true;});
    var clickedBtn=document.querySelector('#announceModalV05418R [data-v05418r-action="send-announce-'+mode+'"]');
    var clickedBtnOrigText=clickedBtn?clickedBtn.textContent:'';
    if(clickedBtn)clickedBtn.textContent='Sending...';
    msgEl.textContent='Sending...';
    fetchJson('/api/v05418y/broadcast',{method:'POST',body:JSON.stringify(body)}).then(function(j){
      var parts=[];
      if(j.results && j.results.email)parts.push('Email: '+j.results.email.sent+' sent'+(j.results.email.skipped?', '+j.results.email.skipped+' no email on file':'')+(j.results.email.failed?', '+j.results.email.failed+' failed':''));
      if(j.results && j.results.push){ if(!j.results.push.configured){parts.push('Push not configured yet.');} else {parts.push('Push: '+j.results.push.sent+' sent'+(j.results.push.notPaired?', '+j.results.push.notPaired+' not paired':'')+(j.results.push.failed?', '+j.results.push.failed+' failed':''));} }
      showAnnounceSuccess(parts.join(' · ')||'Sent.');
    }).catch(function(e){
      sendBtns.forEach(function(b){b.disabled=false;});
      if(clickedBtn)clickedBtn.textContent=clickedBtnOrigText;
      msgEl.className='commManagerMetaV05418R err';
      msgEl.textContent='Could not send: '+e.message;
    });
  }
  // Makes it unmistakable the send finished and the modal is done, rather than leaving the
  // compose form sitting there looking untouched with just a small status line -- easy to
  // read as "did that actually go through?" and leave the modal open by mistake.
  function showAnnounceSuccess(summary){
    var panel=document.querySelector('#announceModalV05418R .v05418RModalPanel');
    if(!panel)return;
    panel.innerHTML='<div class="announceSuccessV05418R">'
      + '<div class="announceSuccessIconV05418R">\u2713</div>'
      + '<h2 style="margin:10px 0 4px;font-size:17px">Announcement sent</h2>'
      + '<p class="muted" style="margin:0 0 18px">'+esc(summary)+'</p>'
      + '<button type="button" class="btn primary" data-v05418r-action="close-announce" style="min-width:140px">Close</button>'
      + '</div>';
  }
  function fmt(v){
    var raw=clean(v); if(!raw)return '';
    if(/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\s+\d{1,2}:\d{2}\s*(AM|PM)$/i.test(raw))return raw;
    if(/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\s+\d{1,2}:\d{2}:\d{2}\s*(AM|PM)$/i.test(raw))return raw.replace(/:(\d{2})\s*(AM|PM)$/i,' $2');
    var n=Number(raw), d=null;
    if(isFinite(n)&&n>0)d=new Date(n<100000000000?n*1000:n); else {var p=new Date(raw); if(!isNaN(p.getTime()))d=p;}
    if(!d)return raw;
    try{return new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'2-digit',day:'2-digit',year:'2-digit',hour:'numeric',minute:'2-digit',hour12:true}).format(d).replace(/\//g,'-');}catch(e){return raw;}
  }
  function statusDisplay(row,keys){row=row||{};for(var i=0;i<keys.length;i++){var k=keys[i];if(row[k+'Display'])return row[k+'Display'];}for(var j=0;j<keys.length;j++){if(row[keys[j]])return fmt(row[keys[j]]);}return '';}
  function buildStatusMaps(statusRows, currentHash, currentPublishedAt, currentPublishInstance){
    var byStaff={}, byEmail={}, oldOpenedByStaff={}, oldOpenedByEmail={};
    (statusRows||[]).forEach(function(s){
      var staff=norm(s.staff||''), email=clean(s.email||'').toLowerCase();
      var isCurrent=!!(currentHash && clean(s.scheduleHash)===clean(currentHash));
      if(!isCurrent && currentPublishedAt && clean(s.publishedAt)===clean(currentPublishedAt)) isCurrent=true;
      if(!isCurrent && currentPublishInstance && clean(s.publishInstance)===clean(currentPublishInstance)) isCurrent=true;
      if(isCurrent){
        if(staff && (!byStaff[staff] || clean(s.updatedAt||s.sentAt).localeCompare(clean(byStaff[staff].updatedAt||byStaff[staff].sentAt))>0)) byStaff[staff]=s;
        if(email && (!byEmail[email] || clean(s.updatedAt||s.sentAt).localeCompare(clean(byEmail[email].updatedAt||byEmail[email].sentAt))>0)) byEmail[email]=s;
      }
      if(s.lastOpenedAt||s.firstOpenedAt){
        if(staff && (!oldOpenedByStaff[staff] || clean(s.lastOpenedAt||s.firstOpenedAt).localeCompare(clean(oldOpenedByStaff[staff].lastOpenedAt||oldOpenedByStaff[staff].firstOpenedAt))>0)) oldOpenedByStaff[staff]=s;
        if(email && (!oldOpenedByEmail[email] || clean(s.lastOpenedAt||s.firstOpenedAt).localeCompare(clean(oldOpenedByEmail[email].lastOpenedAt||oldOpenedByEmail[email].firstOpenedAt))>0)) oldOpenedByEmail[email]=s;
      }
    });
    return {byStaff:byStaff,byEmail:byEmail,oldOpenedByStaff:oldOpenedByStaff,oldOpenedByEmail:oldOpenedByEmail};
  }
  function emailStatusHtml(staffName,email,maps){
    var staffKey=norm(staffName), emails=clean(email).toLowerCase().split(/[;,\s]+/).filter(Boolean);
    var cur=maps.byStaff[staffKey]||null; if(!cur){for(var i=0;i<emails.length;i++){if(maps.byEmail[emails[i]]){cur=maps.byEmail[emails[i]];break;}}}
    if(cur){
      var opened=statusDisplay(cur,['lastOpenedAt','firstOpenedAt']);
      if(opened) return '<span class="v05418RStatus ok">Opened '+esc(opened)+'</span>';
      var failed=statusDisplay(cur,['failedAt']);
      if(failed) return '<span class="v05418RStatus bad">Failed '+esc(failed)+'</span>';
      if(cur.deliveredAt) return '<span class="v05418RStatus bad">Delivered, not opened</span>';
      return '<span class="v05418RStatus bad">Sent, not opened</span>';
    }
    var old=maps.oldOpenedByStaff[staffKey]||null; if(!old){for(var j=0;j<emails.length;j++){if(maps.oldOpenedByEmail[emails[j]]){old=maps.oldOpenedByEmail[emails[j]];break;}}}
    if(old) return '<span class="v05418RStatus neutral">Last opened '+esc(statusDisplay(old,['lastOpenedAt','firstOpenedAt']))+'</span>';
    return '<span class="v05418RStatus neutral">No current email sent</span>';
  }
  function portalStatusHtml(r){
    if(r && r.viewedAfterPublish) return '<span class="v05418RStatus ok">Viewed current schedule'+(r.lastViewed?' · '+esc(r.lastViewed):'')+'</span>';
    return '<span class="v05418RStatus bad">Not viewed current schedule'+(r&&r.lastViewed?' · '+esc(r.lastViewed):'')+'</span>';
  }
  // FEATURE: App Push Notification column, added right after Portal Status per direction.
  // Reuses the same v05418RStatus ok/bad pill styling already used for Email Status and
  // Portal Status so it's visually consistent with the rest of this table, not a new style.
  function appStatusHtml(device,staffNameForRevoke){
    if(device) return '<span class="v05418RStatus ok">Paired'+(device.platform?' · '+esc(device.platform):'')+(device.lastSeenAt?' · seen '+esc(fmt(device.lastSeenAt)):'')+'</span> <button type="button" class="linkBtnV05418R" data-v05418r-action="revoke-device" data-staff="'+esc(staffNameForRevoke||'')+'">Unpair</button>';
    return '<span class="v05418RStatus neutral">Not paired</span>';
  }
  function renderLog(rows){
    rows=rows||[];
    return '<div class="communicationManagerCardV05418R"><h3>Communication Log</h3><div class="commLogActionsV05418R"><button class="btn danger" data-v05418r-action="clear-comm-log">Clear Communication Log</button><span class="logNoteV05418R">Showing latest 75 records. Stored log is capped at 250 records.</span></div>'+(rows.length?'<table class="v05418RTable"><thead><tr><th>When</th><th>Mode/Action</th><th>Staff</th><th>Status</th><th>Details</th></tr></thead><tbody>'+rows.map(function(r){
      var statusText=esc(r.status||'');
      if(r.tracked && String(r.status||'').toLowerCase()==='sent'){
        statusText = r.opened ? '<span class="v05418RStatus ok">Opened'+(r.openedAt?' \u00b7 '+esc(r.openedAt):'')+'</span>' : '<span class="v05418RStatus neutral">Sent \u00b7 not opened yet</span>';
      }
      return '<tr><td>'+esc(r.timestamp||'')+'</td><td>'+esc(r.mode||r.action||'')+'</td><td>'+esc(r.staff||r.target||'')+'</td><td>'+statusText+'</td><td>'+esc(r.message||r.detail||r.recipient||'')+'</td></tr>';
    }).join('')+'</tbody></table>':'<p class="muted">No communication entries yet.</p>')+'</div>';
  }
  function loadCommunicationManagerV05418R(force){
    installStyles(); ensureSection();
    var box=by('communicationManagerBodyV05418R'); if(!box)return;
    if(!canRefresh(!!force))return;
    var reqSchool=selectedSchoolId(); if(!reqSchool){box.innerHTML='<div class="communicationManagerCardV05418R muted">Choose a school first.</div>';return;}
    var seq=++commLoadSeq;
    if(commLastSchool!==reqSchool){commLastSchool=reqSchool;box.innerHTML='<div class="communicationManagerCardV05418R muted">Loading communication details...</div>';}
    if(!box.querySelector('.communicationManagerCardV05418R')) box.innerHTML='<div class="communicationManagerCardV05418R muted">Loading communication details...</div>'; else { var first=box.querySelector('.communicationManagerCardV05418R'); if(first) first.setAttribute('data-refreshing','1'); }
    Promise.all([
      fetchJson(api('/api/v027/staff-portal/access-summary',{school:reqSchool})).catch(function(e){return {error:e.message,staff:[]};}),
      fetchJson(api('/api/communication/candidates-v018',{school:reqSchool})).catch(function(e){return {error:e.message,all:[],hash:'',publishedAt:''};}),
      fetchJson(api('/api/communication/brevo-staff-email-status-v05418v',{school:reqSchool,limit:'500'})).catch(function(e){return {error:e.message,rows:[]};}),
      fetchJson(api('/api/v027/communication/log',{school:reqSchool,limit:'75'})).catch(function(e){return {error:e.message,rows:[]};}),
      fetchJson(api('/api/v05418y/app-devices',{school:reqSchool})).catch(function(e){return {error:e.message,rows:[]};})
    ]).then(function(arr){
      if(seq!==commLoadSeq || reqSchool!==selectedSchoolId())return;
      if(!canRefresh(!!force))return;
      var access=arr[0]||{}, cand=arr[1]||{}, emailStatus=arr[2]||{}, log=arr[3]||{}, devices=arr[4]||{};
      var staff=(access.staff||[]).slice().sort(function(a,b){return clean(a.staff||a.name).localeCompare(clean(b.staff||b.name));});
      var candidates=cand.all||[], statusRows=emailStatus.rows||[], rows=log.rows||[];
      var candidateByStaff={}; candidates.forEach(function(c){candidateByStaff[norm(c.staff||c.name)]=c;});
      var deviceByStaff={}; (devices.rows||[]).forEach(function(d){deviceByStaff[norm(d.staffName)]=d;});
      var maps=buildStatusMaps(statusRows, cand.hash||emailStatus.currentScheduleHash||'', cand.publishedAt||emailStatus.currentPublishedAt||'', cand.publishInstance||emailStatus.currentPublishInstance||'');
      var tableRows=staff.map(function(r){
        var staffName=clean(r.staff||r.name||''); if(!staffName)return '';
        var c=candidateByStaff[norm(staffName)]||{};
        var email=r.email||c.notificationEmail||c.email||'';
        var link=c.staffPortalLink||r.staffPortalLink||'';
        var device=deviceByStaff[norm(staffName)]||null;
        return '<tr><td><b>'+esc(staffName)+'</b></td><td><div class="emailEditRowV05418T"><input class="emailInputV05418T" data-staff="'+esc(staffName)+'" data-row="'+esc(r.rowIndex||'')+'" value="'+esc(email||'')+'"><button class="btn small saveEmailBtnV05418T" data-v05418r-action="save-email" data-staff="'+esc(staffName)+'" data-row="'+esc(r.rowIndex||'')+'">Save</button></div></td><td>'+emailStatusHtml(staffName,email,maps)+'</td><td><button class="btn small copyPortalBtnV05418R" data-v05418r-action="copy-portal-link" data-link="'+esc(link)+'">Copy Link</button></td><td>'+portalStatusHtml(r)+'</td><td>'+appStatusHtml(device,staffName)+'</td><td><div class="emailEditRowV05418T"><input class="phoneInputV05418PH" data-staff="'+esc(staffName)+'" data-row="'+esc(r.rowIndex||'')+'" value="'+esc(r.phone||'')+'" placeholder="(555) 555-5555"><button class="btn small savePhoneBtnV05418PH" data-v05418r-action="save-phone" data-staff="'+esc(staffName)+'" data-row="'+esc(r.rowIndex||'')+'">Save</button></div></td></tr>';
      }).join('');
      var schoolLabel=clean((by('campusSelector')&&by('campusSelector').options[by('campusSelector').selectedIndex]&&by('campusSelector').options[by('campusSelector').selectedIndex].text)||reqSchool);
      box.innerHTML='<div class="communicationManagerCardV05418R"><h3>Staff Schedule Communication</h3><div class="commManagerMetaV05418R">School: <b>'+esc(schoolLabel)+'</b>. Email status is green only when a staff notification for the current published schedule has been opened. Portal status is green when the staff member has viewed the current published schedule. App Push Notification is green once a staff member has paired a device from their Staff Portal settings. Unsaved email and phone edits are protected from background refresh.</div><table class="v05418RTable"><thead><tr><th>Staff</th><th>Email</th><th>Email Status</th><th>Portal Link</th><th>Portal Status</th><th>App Push Notification</th><th>Phone</th></tr></thead><tbody>'+(tableRows||'<tr><td colspan="7" class="muted">No active staff records found for this school.</td></tr>')+'</tbody></table></div>'+renderLog(rows);
      commLastRenderAt=Date.now();
      lastLoadedStaffV05418R=staff.map(function(r){
        var staffName=clean(r.staff||r.name||''); if(!staffName)return null;
        var c=candidateByStaff[norm(staffName)]||{};
        var email=r.email||c.notificationEmail||c.email||'';
        var device=deviceByStaff[norm(staffName)]||null;
        return {staffName:staffName, email:email, appPaired:!!device};
      }).filter(Boolean);
    }).catch(function(e){if(seq===commLoadSeq)box.innerHTML='<div class="communicationManagerCardV05418R"><div class="err">Could not load Communication Manager: '+esc(e.message||e)+'</div></div>';});
  }
  function openShareSchedules(){var p=by('shareSchedulesPillV686m26')||document.querySelector('.shareSchedulesPillV686m26'); if(p){var m=p.querySelector('[data-redis-v018-action="share-open"],.shareMainV018')||p;m.click();} else setMsg('Share Schedules is not ready yet. Publish a schedule first.','warn');}
  function clearCommunicationLog(){
    function doClear(){fetchJson('/api/v029/communication/log/clear',{method:'POST',body:JSON.stringify({school:selectedSchoolId()})}).then(function(){setMsg('Communication Log cleared.','ok');loadCommunicationManagerV05418R(true);}).catch(function(e){setMsg('Could not clear Communication Log: '+e.message,'err');});}
    if(typeof window.showPortalConfirmV51231==='function'){
      window.showPortalConfirmV51231({title:'Clear Communication Log',message:'Clear the Communication Log for this school?',okText:'Clear',danger:true,onOk:doClear});
    } else if(confirm('Clear the Communication Log for this school?')){
      doClear();
    }
  }
  function revokeDevice(btn){
    var staff=btn.getAttribute('data-staff')||'';
    if(!staff)return;
    function doRevoke(){
      btn.disabled=true;
      fetchJson('/api/v05418y/app-devices/revoke',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),staffName:staff})}).then(function(){
        setMsg('Unpaired '+staff+'\u2019s device(s).','ok');
        loadCommunicationManagerV05418R(true);
      }).catch(function(e){
        btn.disabled=false;
        setMsg('Could not revoke device: '+e.message,'err');
      });
    }
    var msg=staff+' will lose access to the mobile app immediately and need a new pairing code to use it again. Unpair their device(s)?';
    if(typeof window.showPortalConfirmV51231==='function'){
      window.showPortalConfirmV51231({title:'Unpair device',message:msg,okText:'Unpair',danger:true,onOk:doRevoke});
    } else if(confirm(msg)){
      doRevoke();
    }
  }
  function copyText(text,btn){
    text=clean(text); if(!text){setMsg('No portal link available for this staff member.','warn');return;}
    var done=function(){if(btn){var old=btn.textContent;btn.textContent='Copied';setTimeout(function(){btn.textContent=old||'Copy';},900);}else setMsg('Portal link copied.','ok');};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done).catch(function(){fallback();});}else fallback();
    function fallback(){var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){setMsg('Could not copy portal link.','err');}ta.remove();}
  }
  function saveEmail(btn){
    var staff=clean(btn&&btn.getAttribute('data-staff')); var row=clean(btn&&btn.getAttribute('data-row'));
    var input=Array.prototype.slice.call(document.querySelectorAll('.emailInputV05418T')).filter(function(x){return clean(x.getAttribute('data-staff'))===staff;})[0];
    var email=input?clean(input.value):'';
    if(!staff){transientMsg('Could not identify staff member for email save.','err');return;}
    btn.disabled=true; btn.setAttribute('data-saving','1'); btn.setAttribute('aria-busy','true');
    fetchJson('/api/staff/email-v022',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),staffName:staff,rowIndex:row,email:email})}).then(function(j){if(input)input.removeAttribute('data-dirty');transientMsg(j.message||'Email saved.','ok');setTimeout(function(){btn.disabled=false;btn.removeAttribute('data-saving');btn.removeAttribute('aria-busy');loadCommunicationManagerV05418R(true);},350);}).catch(function(e){btn.disabled=false;btn.removeAttribute('data-saving');btn.removeAttribute('aria-busy');transientMsg('Could not save email: '+(e.message||e),'err',4200);});
  }
  function savePhone(btn){
    var staff=clean(btn&&btn.getAttribute('data-staff')); var row=clean(btn&&btn.getAttribute('data-row'));
    var input=Array.prototype.slice.call(document.querySelectorAll('.phoneInputV05418PH')).filter(function(x){return clean(x.getAttribute('data-staff'))===staff;})[0];
    var phone=input?clean(input.value):'';
    if(!staff){transientMsg('Could not identify staff member for phone save.','err');return;}
    btn.disabled=true; btn.setAttribute('data-saving','1'); btn.setAttribute('aria-busy','true');
    fetchJson('/api/staff/phone-v05418ph',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),staffName:staff,rowIndex:row,phone:phone})}).then(function(j){if(input){input.removeAttribute('data-dirty');input.value=j.phone||phone;}transientMsg(j.message||'Phone saved.','ok');setTimeout(function(){btn.disabled=false;btn.removeAttribute('data-saving');btn.removeAttribute('aria-busy');},350);}).catch(function(e){btn.disabled=false;btn.removeAttribute('data-saving');btn.removeAttribute('aria-busy');transientMsg('Could not save phone: '+(e.message||e),'err',4200);});
  }
  try{window.loadCommunicationManagerV05418R=loadCommunicationManagerV05418R;}catch(e){}
  window.addEventListener('supportSchedulesShareCommunicationSentV05418U',function(){setTimeout(function(){loadCommunicationManagerV05418R(true);},180);setTimeout(function(){loadCommunicationManagerV05418R(true);},1400);});
  window.addEventListener('focus',function(){if(activePage()==='communicationManager'&&!hasDirtyEmailEdit())setTimeout(function(){loadCommunicationManagerV05418R(false);},250);});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&activePage()==='communicationManager'&&!hasDirtyEmailEdit())setTimeout(function(){loadCommunicationManagerV05418R(false);},250);});
  setInterval(function(){if(activePage()==='communicationManager'&&!document.hidden&&!hasDirtyEmailEdit()&&Date.now()-commLastRenderAt>55000)loadCommunicationManagerV05418R(false);},30000);
  document.addEventListener('input',function(e){
    var el=e.target;
    if(el&&el.classList&&el.classList.contains('emailInputV05418T')){el.setAttribute('data-dirty','1');commDirtySince=Date.now();}
    if(el&&el.classList&&el.classList.contains('phoneInputV05418PH')){
      if(window.formatPhoneInputV05418PH)window.formatPhoneInputV05418PH(el);
      el.setAttribute('data-dirty','1');commDirtySince=Date.now();
    }
  },true);
  document.addEventListener('change',function(e){
    if(e.target && e.target.id==='announceTemplateSelectV05418R'){applyAnnounceTemplate(e.target.value);}
  });
  document.addEventListener('click',function(e){
    var b=e.target&&e.target.closest&&e.target.closest('[data-v05418r-action],[data-nav]'); if(!b)return;
    var a=b.getAttribute('data-v05418r-action')||'';
    if(a==='open-share-schedules'){e.preventDefault();e.stopImmediatePropagation();openShareSchedules();return false;}
    if(a==='clear-comm-log'){e.preventDefault();e.stopImmediatePropagation();clearCommunicationLog();return false;}
    if(a==='copy-portal-link'){e.preventDefault();e.stopImmediatePropagation();copyText(b.getAttribute('data-link')||'',b);return false;}
    if(a==='save-email'){e.preventDefault();e.stopImmediatePropagation();saveEmail(b);return false;}
    if(a==='save-phone'){e.preventDefault();e.stopImmediatePropagation();savePhone(b);return false;}
    if(a==='revoke-device'){e.preventDefault();e.stopImmediatePropagation();revokeDevice(b);return false;}
    if(a==='open-announce'){e.preventDefault();e.stopImmediatePropagation();openAnnounceModal();return false;}
    if(a==='close-announce'){e.preventDefault();e.stopImmediatePropagation();closeAnnounceModal();return false;}
    if(a==='announce-select-all'){e.preventDefault();e.stopImmediatePropagation();document.querySelectorAll('.announceStaffCheckV05418R').forEach(function(cb){cb.checked=true;});return false;}
    if(a==='announce-select-none'){e.preventDefault();e.stopImmediatePropagation();document.querySelectorAll('.announceStaffCheckV05418R').forEach(function(cb){cb.checked=false;});return false;}
    if(a==='send-announce-push'){e.preventDefault();e.stopImmediatePropagation();sendAnnouncement('push');return false;}
    if(a==='send-announce-email'){e.preventDefault();e.stopImmediatePropagation();sendAnnouncement('email');return false;}
    if(a==='send-announce-preferred'){e.preventDefault();e.stopImmediatePropagation();sendAnnouncement('preferred');return false;}
    if(a==='announce-save-template'){e.preventDefault();e.stopImmediatePropagation();saveAnnounceTemplate();return false;}
    var nav=b.getAttribute('data-nav'); if(nav==='communicationManager'){setTimeout(function(){loadCommunicationManagerV05418R(true);},360);} 
  },true);
  document.addEventListener('change',function(e){if(e.target&&e.target.id==='campusSelector'){commLoadSeq++;commLastSchool='';commDirtySince=0;setTimeout(function(){if(activePage()==='communicationManager')loadCommunicationManagerV05418R(true);},300);}},true);
  function boot(){installStyles();ensureSection();if(activePage()==='communicationManager')loadCommunicationManagerV05418R(true);}
  try{if(typeof window.registerNavigationAfterHookV5_==='function')window.registerNavigationAfterHookV5_(function(page){if(page==='communicationManager')setTimeout(function(){loadCommunicationManagerV05418R(true);},240);},'v05418adCommunicationManager');}catch(e){}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,120);}); else setTimeout(boot,120);
})();

/* ===== END ga-redis-v05418cb-communication-manager.js ===== */

/* ===== BEGIN ga-redis-v05418ad-recovery-bell-source.js ===== */
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

/* ===== END ga-redis-v05418ad-recovery-bell-source.js ===== */

/* ===== BEGIN ga-redis-v05418ae-periods-advanced.js ===== */
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

/* ===== END ga-redis-v05418ae-periods-advanced.js ===== */

/* ===== BEGIN ga-redis-v05418af-period-meta-modal-fix.js ===== */
(function(){
  'use strict';
  if (window.__GA_REDIS_V05418AF_PERIOD_META_MODAL_FIX__) return;
  window.__GA_REDIS_V05418AF_PERIOD_META_MODAL_FIX__ = true;
  var VERSION = '0.54.18af';
  var SOURCE_KEY = '__bellDisplaySourceV05418AE';
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' '); }
  function esc(v){ return clean(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function by(id){ return document.getElementById(id); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function selectedSchoolPayload(){
    var out = {};
    try {
      var ctx = window.campusContextV5253 || window.campusContext || window.selectedCampusContext || null;
      if (ctx && typeof ctx === 'object') {
        out.school = out.schoolId = out.selectedCampusId = ctx.selectedCampusId || ctx.campusId || ctx.schoolId || ctx.id || '';
        out.name = out.schoolName = out.selectedCampusName = ctx.selectedCampusName || ctx.campusName || ctx.schoolName || ctx.name || '';
        out.spreadsheetId = out.selectedSpreadsheetId = ctx.selectedSpreadsheetId || ctx.spreadsheetId || ctx.ssId || '';
      }
    } catch(e) {}
    try {
      var sel = by('campusSelector') || by('schoolSelector') || by('schoolSelect') || by('siteSelector');
      if (sel) {
        var opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
        var val = clean(sel.value);
        if (val && !out.school) out.school = out.schoolId = out.selectedCampusId = val;
        if (opt) {
          var ss = opt.getAttribute('data-spreadsheet-id') || opt.getAttribute('data-ss-id') || opt.getAttribute('data-sheet-id') || '';
          if (ss && !out.spreadsheetId) out.spreadsheetId = out.selectedSpreadsheetId = ss;
          var nm = opt.getAttribute('data-campus-name') || opt.getAttribute('data-school-name') || opt.textContent || '';
          if (nm && !out.name) out.name = out.schoolName = out.selectedCampusName = clean(nm);
        }
      }
    } catch(e2) {}
    try { if (typeof window.selectedSchoolPayloadV686m20 === 'function') { var p = window.selectedSchoolPayloadV686m20() || {}; Object.keys(p).forEach(function(k){ if (p[k] && !out[k]) out[k] = p[k]; }); } } catch(e3) {}
    return out;
  }
  function apiQuery(){ var p=selectedSchoolPayload(); var qs=new URLSearchParams(); Object.keys(p).forEach(function(k){ if(p[k]) qs.set(k,p[k]); }); qs.set('_t', String(Date.now())); return qs.toString(); }
  function setMsgSafe(msg,type){ try { if (typeof window.setMsg === 'function') window.setMsg(msg,type||'ok'); } catch(e) {} }
  function mergeSource(source){
    if (!source || source.ok === false) return source;
    source.version = source.version || VERSION;
    window[SOURCE_KEY] = source;
    ['advancedSetupDataV5131','scheduleData','studentData','staffData','scheduleViewsData'].forEach(function(name){
      var d = window[name]; if (!d || typeof d !== 'object') return;
      d.periodMeta = (source.periodMeta || []).slice();
      d.itemLabels = Object.assign({}, d.itemLabels || {}, source.itemLabels || {});
      if (source.itemOrder && source.itemOrder.length) {
        d.itemOrder = source.itemOrder.slice();
        if (Array.isArray(d.items) || name === 'studentData') d.items = source.itemOrder.slice();
      }
    });
    try { if (typeof window.renderPeriodMetaRowsV5131 === 'function') window.renderPeriodMetaRowsV5131(); } catch(e) {}
    return source;
  }
  function fetchPeriodSource(cb, fail){
    fetch('/api/v05418af/period-meta?' + apiQuery(), { credentials:'same-origin' })
      .then(function(r){ return r.json().then(function(j){ if(!r.ok || j.ok === false) throw new Error(j.error || ('HTTP '+r.status)); return j; }); })
      .then(function(j){ mergeSource(j); if(cb)cb(j); })
      .catch(function(e){ if(fail)fail(e); });
  }
  function installCss(){
    if (by('v05418af-style')) return;
    var st=document.createElement('style'); st.id='v05418af-style';
    st.textContent=[
      '#advancedSchedulingModalV05418X{position:fixed!important;inset:0!important;z-index:10050!important;display:none;align-items:flex-start!important;justify-content:center!important;padding:72px 18px 18px!important;background:rgba(15,23,42,.38)!important;box-sizing:border-box!important;overflow:auto!important;}',
      '#advancedSchedulingModalV05418X.active{display:flex!important;}',
      '#advancedSchedulingModalV05418X:not(.active){display:none!important;}',
      '#advancedSchedulingModalV05418X .modalBox,#advancedSchedulingModalV05418X .modalCard{width:min(760px,94vw)!important;max-width:min(760px,94vw)!important;max-height:calc(100vh - 96px)!important;overflow:auto!important;background:#fff!important;color:#0f172a!important;border:1px solid #dbe3ef!important;border-radius:16px!important;box-shadow:0 22px 60px rgba(15,23,42,.28)!important;padding:14px!important;box-sizing:border-box!important;}',
      '#advancedSchedulingModalV05418X .modalHeader,#advancedSchedulingModalV05418X .modalTitleRow{position:sticky;top:0;background:#fff!important;z-index:2;border-bottom:1px solid #e5e7eb;margin:-14px -14px 12px!important;padding:14px!important;}',
      '#advancedSchedulingModalV05418X .modalFooter,#advancedSchedulingModalV05418X .toolbar{position:sticky;bottom:0;background:#fff!important;border-top:1px solid #e5e7eb;margin:14px -14px -14px!important;padding:12px 14px!important;}',
      '#advancedSchedulingModalV05418X .checkRow{display:flex!important;align-items:center!important;gap:8px!important;margin:8px 0!important;font-weight:700!important;}',
      '#advancedSchedulingModalV05418X input[type="checkbox"]{width:auto!important;min-width:16px!important;height:auto!important;}',
      '#advancedSchedulingModalV05418X .splitRowsV05418AE{display:flex!important;flex-direction:column!important;gap:8px!important;margin-top:8px!important;}',
      '#advancedSchedulingModalV05418X .splitRowV05418AE{display:grid!important;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr) minmax(0,.75fr) 42px!important;gap:8px!important;align-items:center!important;background:#fff!important;border:1px solid #e5e7eb!important;border-radius:12px!important;padding:8px!important;box-sizing:border-box!important;max-width:100%!important;}',
      '#advancedSchedulingModalV05418X .splitRowV05418AE select,#advancedSchedulingModalV05418X .splitRowV05418AE input{width:100%!important;min-width:0!important;box-sizing:border-box!important;}',
      '#advancedSchedulingModalV05418X .removeSplitV05418AE{width:38px!important;height:38px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;}',
      '@media(max-width:640px){#advancedSchedulingModalV05418X{padding:54px 10px 10px!important}#advancedSchedulingModalV05418X .splitRowV05418AE{grid-template-columns:1fr!important}#advancedSchedulingModalV05418X .removeSplitV05418AE{width:100%!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function collectPeriodRows(){
    return qsa('#periodMetaRows .periodMetaRow').map(function(row){
      var display=clean((row.querySelector('.periodMetaDisplay')||{}).value);
      var key=clean((row.querySelector('.periodMetaKey')||{}).value || display);
      if(!key) return null;
      var typeEl=row.querySelector('.periodMetaBlockType');
      return { key:key, displayName:display || key, notes:clean((row.querySelector('.periodMetaNotes')||{}).value), blockType:clean(typeEl ? typeEl.value : 'instruction') || 'instruction' };
    }).filter(Boolean);
  }
  function patchPeriodSave(){
    var base = window.savePeriodMetaV5131;
    if (!base || base.__v05418af) return;
    var wrapped = function(){
      var currentRows=[];
      try { currentRows = by('scheduleRows') && typeof window.collectScheduleRows === 'function' ? window.collectScheduleRows() : []; } catch(e) { currentRows=[]; }
      var rows = collectPeriodRows();
      if (!rows.length) { return base.apply(this, arguments); }
      setMsgSafe('Saving period setup...', 'warn');
      var payload = Object.assign({}, selectedSchoolPayload(), { rows: rows, periodMeta: rows });
      fetch('/api/v05418af/period-meta', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) })
        .then(function(r){ return r.json().then(function(j){ if(!r.ok || j.ok === false) throw new Error(j.error || ('HTTP '+r.status)); return j; }); })
        .then(function(j){
          mergeSource(j);
          try { if (typeof window.renderScheduleRows === 'function') window.renderScheduleRows(currentRows); } catch(e) {}
          try { if (typeof window.loadStudentData === 'function') window.loadStudentData(); } catch(e2) {}
          setMsgSafe(j.message || 'Period setup saved.', 'ok');
        })
        .catch(function(err){
          setMsgSafe('Direct period setup save failed; trying legacy save. ' + (err && err.message ? err.message : err), 'warn');
          try { base.apply(window, arguments); } catch(e) { setMsgSafe('Period setup could not be saved: ' + (e && e.message ? e.message : e), 'err'); }
        });
      return false;
    };
    wrapped.__v05418af = true;
    window.savePeriodMetaV5131 = wrapped;
    try { window.eval('savePeriodMetaV5131 = window.savePeriodMetaV5131;'); } catch(e) {}
  }
  function patchAdvancedLoad(){
    var base = window.loadAdvancedSetupDataV5131;
    if (!base || base.__v05418af) return;
    var wrapped = function(cb){
      return base.call(this, function(){
        fetchPeriodSource(function(){ if (typeof cb === 'function') cb(); }, function(){ if (typeof cb === 'function') cb(); });
      });
    };
    wrapped.__v05418af = true;
    window.loadAdvancedSetupDataV5131 = wrapped;
    try { window.eval('loadAdvancedSetupDataV5131 = window.loadAdvancedSetupDataV5131;'); } catch(e) {}
  }
  function patchLabelMap(){
    var names=['periodDisplayNameV5140','studentItemLabelV5141','staffScheduleItemLabelV5154','displayPeriodLabelClientV5323'];
    names.forEach(function(name){
      var base=window[name]; if(!base || base.__v05418af) return;
      var fn=function(item){
        var source=window[SOURCE_KEY]||{}; var labels=source.itemLabels||{}; var raw=clean(item); var n=norm(raw);
        if(labels[raw]) return labels[raw];
        var keys=Object.keys(labels); for(var i=0;i<keys.length;i++){ if(norm(keys[i])===n) return labels[keys[i]]; }
        try { return base.apply(this, arguments); } catch(e) { return raw; }
      };
      fn.__v05418af=true; window[name]=fn; try{ window.eval(name+' = window["'+name+'"];'); }catch(e){}
    });
  }
  function boot(){ installCss(); patchPeriodSave(); patchAdvancedLoad(); patchLabelMap(); fetchPeriodSource(null, function(){}); setTimeout(function(){ installCss(); patchPeriodSave(); patchAdvancedLoad(); patchLabelMap(); fetchPeriodSource(null, function(){}); }, 700); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* ===== END ga-redis-v05418af-period-meta-modal-fix.js ===== */

/* ===== BEGIN ga-redis-v05418ag-period-sequence-persistence.js ===== */
(function(){
  'use strict';
  if (window.__GA_REDIS_V05418AG_PERIOD_SEQUENCE_PERSISTENCE__) return;
  window.__GA_REDIS_V05418AG_PERIOD_SEQUENCE_PERSISTENCE__ = true;
  var VERSION = '0.54.18ag';
  var SOURCE_KEYS = ['__bellDisplaySourceV05418AE','__supportSchedulesBellSourceV05418AD'];
  var DELETED_KEY = '__v05418agDeletedPeriodKeys';
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' '); }
  function by(id){ return document.getElementById(id); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function deletedMap(){ if (!window[DELETED_KEY] || typeof window[DELETED_KEY] !== 'object') window[DELETED_KEY] = {}; return window[DELETED_KEY]; }
  function isDeleted(key){ return !!deletedMap()[norm(key)]; }
  function markDeleted(key){ key = clean(key); if (key) deletedMap()[norm(key)] = true; }
  function clearDeleted(){ window[DELETED_KEY] = {}; }
  function setMsgSafe(msg,type){ try { if (typeof window.setMsg === 'function') window.setMsg(msg,type||'ok'); } catch(e) {} }
  function isBreakLunch(v){ var n=norm(v); return n==='break' || n==='lunch'; }
  function isCoreInstruction(v){ return /^period\s*[1-6]$/i.test(clean(v)); }
  function isCore(v){ return isCoreInstruction(v) || isBreakLunch(v); }
  function periodNumber(v){
    var s = clean(v).replace(/^campus_[a-z0-9_]+__/i,'').replace(/_/g,' ');
    var m = s.match(/^period\s*(\d+)$/i);
    return m ? Number(m[1]) : null;
  }
  function normalizeBlockType(v,key){
    var n = norm(key);
    if (n === 'break') return 'break';
    if (n === 'lunch') return 'lunch';
    var t = norm(v);
    if (t === 'break') return 'break';
    if (t === 'lunch') return 'lunch';
    return 'instruction';
  }
  function rowFromValue(value,label){
    var key = clean(value && typeof value === 'object' ? (value.key || value.item || value.period || value.name || value.label || value.title) : value);
    if (!key) return null;
    var display = clean(label || (value && typeof value === 'object' ? (value.displayName || value.display || value.label || value.title || value.name) : '') || key) || key;
    return { key:key, displayName:display, notes:clean(value && typeof value === 'object' ? (value.notes || value.note || '') : ''), blockType:normalizeBlockType(value && typeof value === 'object' ? (value.blockType || value.type || '') : '', key) };
  }
  function pushRow(list, seen, row){
    row = rowFromValue(row);
    if (!row || !row.key || isDeleted(row.key)) return;
    var n = norm(row.key);
    if (!n || seen[n]) return;
    seen[n] = true;
    list.push(row);
  }
  function knownRowsFromSource(source){
    var out=[], seen={};
    if (!source || typeof source !== 'object') return out;
    (source.periodMeta || []).forEach(function(r){ pushRow(out, seen, r); });
    (source.itemOrder || source.items || source.periods || source.scheduleTemplateItems || []).forEach(function(item){ pushRow(out, seen, item); });
    var labels = source.itemLabels || {};
    Object.keys(labels).forEach(function(k){ pushRow(out, seen, {key:k, displayName:labels[k]}); });
    return out;
  }
  function knownRowsFromState(){
    var out=[], seen={};
    ['advancedSetupDataV5131','scheduleData','studentData','staffData','scheduleViewsData'].forEach(function(name){
      var d = window[name];
      if (!d || typeof d !== 'object') return;
      (d.periodMeta || []).forEach(function(r){ pushRow(out, seen, r); });
      (d.itemOrder || d.items || d.periods || d.scheduleTemplateItems || []).forEach(function(item){ pushRow(out, seen, item); });
      var labels = d.itemLabels || {};
      Object.keys(labels).forEach(function(k){ pushRow(out, seen, {key:k, displayName:labels[k]}); });
    });
    SOURCE_KEYS.forEach(function(k){ knownRowsFromSource(window[k]).forEach(function(r){ pushRow(out, seen, r); }); });
    qsa('#scheduleRows tr[data-item], #studentPeriodRows tr[data-item], [data-item]').forEach(function(el){
      var key = clean(el.getAttribute('data-item'));
      if (key) pushRow(out, seen, {key:key, displayName:key});
    });
    return out;
  }
  function domPeriodRows(){
    return qsa('#periodMetaRows .periodMetaRow').map(function(row){
      var display = clean((row.querySelector('.periodMetaDisplay') || {}).value);
      var key = clean((row.querySelector('.periodMetaKey') || {}).value || display);
      if (!key) return null;
      var typeEl = row.querySelector('.periodMetaBlockType');
      return { key:key, displayName:display || key, notes:clean((row.querySelector('.periodMetaNotes') || {}).value), blockType:normalizeBlockType(typeEl ? typeEl.value : 'instruction', key) };
    }).filter(Boolean);
  }
  function mergedRows(preferDom){
    var out=[], seen={};
    var current=[];
    try { if (typeof window.periodMetaBaseRowsV5139 === 'function') current = window.periodMetaBaseRowsV5139.__v05418agBase ? [] : (window.periodMetaBaseRowsV5139() || []); } catch(e) { current=[]; }
    (preferDom ? domPeriodRows() : current).forEach(function(r){ pushRow(out, seen, r); });
    knownRowsFromState().forEach(function(r){ pushRow(out, seen, r); });
    ['Period 1','Period 2','Period 3','Period 4','Period 5','Period 6','Break','Lunch'].forEach(function(k){ if(!seen[norm(k)]) pushRow(out, seen, {key:k, displayName:k, blockType:normalizeBlockType('', k)}); });
    return out;
  }
  function nextPeriodKey(){
    var nums=[];
    mergedRows(false).concat(domPeriodRows()).forEach(function(r){ var n=periodNumber(r && r.key); if(n != null && n > 0) nums.push(n); });
    var max = nums.length ? Math.max.apply(Math, nums) : 6;
    var n = Math.max(7, max + 1);
    var existing = {};
    mergedRows(false).concat(domPeriodRows()).forEach(function(r){ if(r && r.key) existing[norm(r.key)] = true; });
    var key = 'Period ' + n;
    while(existing[norm(key)]){ n++; key = 'Period ' + n; }
    return key;
  }
  function patchPeriodBaseRows(){
    var base = window.periodMetaBaseRowsV5139;
    if (typeof base !== 'function' || base.__v05418ag) return;
    var wrapped = function(){
      var out=[], seen={};
      try { (base.apply(this, arguments) || []).forEach(function(r){ pushRow(out, seen, r); }); } catch(e) {}
      knownRowsFromState().forEach(function(r){ pushRow(out, seen, r); });
      return out;
    };
    wrapped.__v05418ag = true;
    wrapped.__v05418agBase = base;
    window.periodMetaBaseRowsV5139 = wrapped;
    try { window.eval('periodMetaBaseRowsV5139 = window.periodMetaBaseRowsV5139;'); } catch(e) {}
  }
  function patchAddPeriod(){
    var base = window.addPeriodMetaRowV5131;
    if (typeof base !== 'function' || base.__v05418ag) return;
    var wrapped = function(){
      var key = nextPeriodKey();
      var d = null;
      try { d = typeof window.ensureAdvancedSetupDataV5131 === 'function' ? window.ensureAdvancedSetupDataV5131() : (window.advancedSetupDataV5131 || {}); } catch(e) { d = window.advancedSetupDataV5131 || {}; }
      var rows = mergedRows(false);
      var seen = {};
      rows.forEach(function(r){ if(r && r.key) seen[norm(r.key)] = true; });
      if (!seen[norm(key)]) rows.push({key:key, displayName:key, notes:'', blockType:'instruction'});
      d.periodMeta = rows;
      window.advancedSetupDataV5131 = d;
      try { if (typeof window.renderPeriodMetaRowsV5131 === 'function') window.renderPeriodMetaRowsV5131(); } catch(e2) {}
      try { if (typeof window.renderScheduleRows === 'function' && typeof window.collectScheduleRows === 'function') window.renderScheduleRows(window.collectScheduleRows()); } catch(e3) {}
      setMsgSafe(key + ' added. Click Save Period Setup to store it for this school.', 'warn');
      return false;
    };
    wrapped.__v05418ag = true;
    window.addPeriodMetaRowV5131 = wrapped;
    try { window.eval('addPeriodMetaRowV5131 = window.addPeriodMetaRowV5131;'); } catch(e) {}
  }
  function syncSourcesFromRows(rows){
    rows = (rows || []).map(rowFromValue).filter(Boolean);
    var labels = {};
    var order = [];
    rows.forEach(function(r){ labels[r.key] = r.displayName || r.key; order.push(r.key); });
    SOURCE_KEYS.forEach(function(k){
      var src = window[k];
      if (src && typeof src === 'object') {
        src.periodMeta = rows.slice();
        src.itemLabels = Object.assign({}, src.itemLabels || {}, labels);
        src.itemOrder = order.slice();
        src.items = order.slice();
        src.periodDisplaySource = 'v05418ag-dom-sync';
      }
    });
    ['advancedSetupDataV5131','scheduleData','studentData','staffData','scheduleViewsData'].forEach(function(name){
      var d = window[name];
      if (!d || typeof d !== 'object') return;
      d.periodMeta = rows.slice();
      d.itemLabels = Object.assign({}, d.itemLabels || {}, labels);
      if (name === 'studentData' || name === 'staffData' || name === 'scheduleData') d.items = order.slice();
      d.itemOrder = order.slice();
    });
  }
  function patchSavePeriod(){
    var base = window.savePeriodMetaV5131;
    if (typeof base !== 'function' || base.__v05418ag) return;
    var wrapped = function(){
      // Save exactly what is currently visible, so deleting a custom period remains intentional.
      var rows = domPeriodRows();
      syncSourcesFromRows(rows);
      var result = base.apply(this, arguments);
      setTimeout(function(){ clearDeleted(); syncSourcesFromRows(domPeriodRows()); }, 1800);
      return result;
    };
    wrapped.__v05418ag = true;
    window.savePeriodMetaV5131 = wrapped;
    try { window.eval('savePeriodMetaV5131 = window.savePeriodMetaV5131;'); } catch(e) {}
  }
  function patchDeletePeriod(){
    var base = window.deletePeriodMetaRowV5140;
    if (typeof base !== 'function' || base.__v05418ag) return;
    var wrapped = function(key){
      markDeleted(key);
      return base.apply(this, arguments);
    };
    wrapped.__v05418ag = true;
    window.deletePeriodMetaRowV5140 = wrapped;
    try { window.eval('deletePeriodMetaRowV5140 = window.deletePeriodMetaRowV5140;'); } catch(e) {}
  }
  function patchRenderRefresh(){
    var base = window.renderPeriodMetaRowsV5131;
    if (typeof base !== 'function' || base.__v05418ag) return;
    var wrapped = function(){
      patchPeriodBaseRows();
      return base.apply(this, arguments);
    };
    wrapped.__v05418ag = true;
    window.renderPeriodMetaRowsV5131 = wrapped;
    try { window.eval('renderPeriodMetaRowsV5131 = window.renderPeriodMetaRowsV5131;'); } catch(e) {}
  }
  function boot(){
    patchPeriodBaseRows();
    patchAddPeriod();
    patchSavePeriod();
    patchDeletePeriod();
    patchRenderRefresh();
    setTimeout(function(){ patchPeriodBaseRows(); patchAddPeriod(); patchSavePeriod(); patchDeletePeriod(); patchRenderRefresh(); }, 650);
  }
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('[data-action="period-meta-add"],[data-action="period-meta-save"],[data-nav="schedule"]');
    if (!t) return;
    setTimeout(boot, 40);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.gaV05418AGPeriodDiag = function(){ return {version:VERSION, next:nextPeriodKey(), domRows:domPeriodRows().map(function(r){return r.key;}), knownRows:knownRowsFromState().map(function(r){return r.key;})}; };
})();

/* ===== END ga-redis-v05418ag-period-sequence-persistence.js ===== */

/* ===== BEGIN ga-redis-v05418ah-period-label-surfaces.js ===== */
(function(){
  'use strict';
  if (window.__GA_REDIS_V05418AH_PERIOD_LABEL_SURFACES__) return;
  window.__GA_REDIS_V05418AH_PERIOD_LABEL_SURFACES__ = true;
  var VERSION = '0.54.18ah';
  var SOURCE_KEY = '__bellDisplaySourceV05418AE';

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
  function esc(v){ return clean(v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function uniqPush(list, value){ value = clean(value); if (value && list.indexOf(value) < 0) list.push(value); }
  function source(){ return window[SOURCE_KEY] || {}; }
  function sources(){
    return [source(), window.advancedSetupDataV5131, window.scheduleData, window.studentData, window.staffData, window.scheduleViewsData].filter(function(x){ return x && typeof x === 'object'; });
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
    var s = stripScope(v);
    var m = s.match(/^period\s*(\d+)$/i);
    if (m) return Number(m[1]);
    m = clean(v).match(/(?:^|[_\s])period[_\s]*(\d+)(?:$|[_\s])/i);
    return m ? Number(m[1]) : null;
  }
  function isBreakLunch(v){ var n = norm(stripScope(v)); return n === 'break' || n === 'lunch'; }
  function defaultPeriodLabel(v){
    var n = periodNumber(v);
    if (n != null) return 'Period ' + n;
    var stripped = stripScope(v);
    if (stripped) return stripped.replace(/\b\w/g, function(m){ return m.toUpperCase(); });
    return clean(v);
  }
  function isDefaultPeriodName(v){ return /^period\s*\d+$/i.test(clean(v)); }
  function labelPriority(display, raw){
    display = clean(display); raw = clean(raw);
    if (!display) return 0;
    if (norm(display) === norm(raw)) return 1;
    if (isDefaultPeriodName(display)) return 2;
    return 5;
  }
  function addAlias(cat, raw, display, sourceName){
    raw = clean(raw); display = clean(display || raw);
    if (!raw || !display) return;
    var p = labelPriority(display, raw);
    var aliases = [raw, stripScope(raw), defaultPeriodLabel(raw)];
    var n = periodNumber(raw);
    if (n != null) aliases.push('Period ' + n, 'period_' + n, 'campus_top__period_' + n, 'campus_top_period_' + n);
    aliases.forEach(function(a){
      a = clean(a);
      var k = norm(a);
      if (!k) return;
      var old = cat.alias[k];
      if (!old || p >= old.priority) cat.alias[k] = { label: display, priority: p, raw: raw, source: sourceName || '' };
    });
    if (n != null) {
      var oldNum = cat.byNumber[n];
      if (!oldNum || p >= oldNum.priority) cat.byNumber[n] = { label: display, priority: p, raw: raw, source: sourceName || '' };
    }
  }
  function addRow(cat, row, sourceName){
    if (!row) return;
    var raw = clean(row.key || row.item || row.period || row.name || row.label || row.displayName);
    if (!raw) return;
    var display = clean(row.displayName || row.title || row.label || row.name || (source().itemLabels || {})[raw] || raw);
    addAlias(cat, raw, display, sourceName);
    cat.metaIdentity[identity(raw)] = true;
    cat.metaRows.push({ key: raw, displayName: display, blockType: clean(row.blockType || row.type || '') });
  }
  function identity(raw){
    var n = periodNumber(raw);
    if (n != null) return 'period:' + n;
    var b = norm(stripScope(raw));
    if (b === 'break' || b === 'lunch') return b;
    return 'label:' + b;
  }
  var cachedCatalog = null;
  var cachedStamp = '';
  function catalog(){
    var stampParts = [];
    sources().forEach(function(d){
      try { stampParts.push(JSON.stringify({ labels:d.itemLabels || {}, meta:d.periodMeta || [], order:d.itemOrder || d.items || d.periods || [] }).slice(0,4000)); } catch(e) { stampParts.push(String(Math.random())); }
    });
    var stamp = stampParts.join('|');
    if (cachedCatalog && stamp === cachedStamp) return cachedCatalog;
    var cat = { alias:{}, byNumber:{}, metaIdentity:{}, metaRows:[] };
    coreOrder().forEach(function(k){ addAlias(cat, k, k, 'core'); cat.metaIdentity[identity(k)] = true; });
    sources().forEach(function(d, idx){
      var name = 'source' + idx;
      var labels = d.itemLabels || d.labels || {};
      Object.keys(labels || {}).forEach(function(k){ addAlias(cat, k, labels[k], name + ':labels'); });
      (d.periodMeta || []).forEach(function(r){ addRow(cat, r, name + ':periodMeta'); });
    });
    cachedCatalog = cat;
    cachedStamp = stamp;
    return cat;
  }
  function visibleLabel(raw){
    raw = clean(raw);
    if (!raw) return '';
    var cat = catalog();
    var exact = cat.alias[norm(raw)];
    if (exact && exact.label) return exact.label;
    var stripped = stripScope(raw);
    var strippedHit = cat.alias[norm(stripped)];
    if (strippedHit && strippedHit.label) return strippedHit.label;
    var n = periodNumber(raw);
    if (n != null && cat.byNumber[n] && cat.byNumber[n].label) return cat.byNumber[n].label;
    if (/^(campus|school|site)_/i.test(raw)) return defaultPeriodLabel(raw);
    return raw;
  }
  function hasMetaFor(raw){ return !!catalog().metaIdentity[identity(raw)]; }
  function isOrphanScoped(raw){
    raw = clean(raw);
    if (!/^(campus|school|site)_/i.test(raw)) return false;
    var n = periodNumber(raw);
    return n != null && !hasMetaFor(raw);
  }
  function isEmptyAssignmentRow(row){
    if (!row) return true;
    var p = row.primary, s = row.secondary;
    if (Array.isArray(p) && p.length) return false;
    if (Array.isArray(s) && s.length) return false;
    if (clean(p) || clean(s)) return false;
    return true;
  }
  function addListItem(list, seen, raw, allowOrphan){
    raw = clean(raw);
    if (!raw) return;
    if (!allowOrphan && isOrphanScoped(raw)) return;
    var label = visibleLabel(raw);
    var key = norm(label) || identity(raw);
    if (seen[key]) return;
    seen[key] = true;
    list.push(raw);
  }
  function schoolPeriodItems(opts){
    opts = opts || {};
    var out = [], seen = {};
    var src = source();
    (src.periodMeta || []).forEach(function(r){ addListItem(out, seen, r && (r.key || r.item || r.name || r.displayName), opts.allowOrphans); });
    sources().forEach(function(d){ (d.periodMeta || []).forEach(function(r){ addListItem(out, seen, r && (r.key || r.item || r.name || r.displayName), opts.allowOrphans); }); });
    coreOrder().forEach(function(k){ addListItem(out, seen, k, true); });
    if (opts.includeDataItems) {
      sources().forEach(function(d){
        [].concat(d.itemOrder || [], d.items || [], d.periods || [], d.scheduleTemplateItems || []).forEach(function(it){ addListItem(out, seen, typeof it === 'string' ? it : (it && (it.key || it.item || it.label || it.name || it.displayName)), opts.allowOrphans); });
      });
      try { Object.keys((window.currentStudent && window.currentStudent.periods) || {}).forEach(function(k){ addListItem(out, seen, k, true); }); } catch(e) {}
    }
    return out;
  }
  function periodRecordFor(student, item){
    var periods = (student && student.periods) || {};
    if (periods[item]) return periods[item];
    var itemId = identity(item);
    var itemLabel = norm(visibleLabel(item));
    var keys = Object.keys(periods);
    for (var i=0; i<keys.length; i++) {
      var k = keys[i];
      if (identity(k) === itemId || norm(visibleLabel(k)) === itemLabel || norm(k) === norm(item)) return periods[k];
    }
    return {};
  }
  function setSelectValue(sel, value){
    if (!sel) return;
    value = clean(value);
    if (!value) { sel.value = ''; return; }
    sel.value = value;
    if (sel.value === value) return;
    var opts = Array.prototype.slice.call(sel.options || []);
    var hit = opts.find(function(o){ return norm(o.value) === norm(value) || norm(o.textContent) === norm(value) || norm(visibleLabel(o.value)) === norm(value); });
    if (hit) sel.value = hit.value;
  }
  function optionList(values, selected){
    values = Array.isArray(values) ? values : [];
    return values.map(function(v){ var sel = clean(v) === clean(selected) ? ' selected' : ''; return '<option value="' + esc(v) + '"' + sel + '>' + esc(visibleLabel(v)) + '</option>'; }).join('');
  }
  function nativeOptionList(values, selected){
    if (typeof window.optionList === 'function') return window.optionList(values, selected);
    values = Array.isArray(values) ? values : [];
    return values.map(function(v){ return '<option value="' + esc(v) + '"' + (clean(v)===clean(selected)?' selected':'') + '>' + esc(v) + '</option>'; }).join('');
  }
  function patchGlobals(){
    ['periodDisplayNameV5140','studentItemLabelV5141','staffScheduleItemLabelV5154','displayPeriodLabelClientV5323'].forEach(function(name){
      var base = window[name];
      if (base && base.__v05418ah) return;
      var fn = function(item){
        var label = visibleLabel(item);
        if (label && label !== clean(item)) return label;
        if (typeof base === 'function') {
          try {
            var b = clean(base.apply(this, arguments));
            if (b && !/^(campus|school|site)_/i.test(b)) return visibleLabel(b);
          } catch(e) {}
        }
        return label || clean(item);
      };
      fn.__v05418ah = true;
      window[name] = fn;
      try { window.eval(name + ' = window["' + name + '"];'); } catch(e2) {}
    });
  }
  function patchStudentSurfaces(){
    var basePopulate = window.populateStudentStatic;
    if (basePopulate && !basePopulate.__v05418ah) {
      var pop = function(){
        try { if (basePopulate && basePopulate !== pop) basePopulate.apply(this, arguments); } catch(e) {}
        var copy = by('copyFrom');
        if (copy) copy.innerHTML = optionList(schoolPeriodItems({ includeDataItems:true, allowOrphans:false }), copy.value);
      };
      pop.__v05418ah = true;
      window.populateStudentStatic = pop;
      try { window.eval('populateStudentStatic = window.populateStudentStatic;'); } catch(e) {}
    }
    var baseRender = window.renderStudentPeriodRows;
    if (baseRender && !baseRender.__v05418ah) {
      var render = function(){
        if (!window.studentData) { try { return baseRender.apply(this, arguments); } catch(e) { return; } }
        var box = by('studentPeriodRows');
        if (!box) return baseRender.apply(this, arguments);
        var items = schoolPeriodItems({ includeDataItems:true, allowOrphans:false });
        if (!items.length) items = (window.studentData.items || coreOrder()).slice();
        function locOptions(item){ try { if (typeof window.studentLocationOptionsV5150 === 'function') return window.studentLocationOptionsV5150(item); } catch(e) {} return (window.studentData && window.studentData.locations) || []; }
        function supportKinds(){ return (window.studentData && window.studentData.supportNeedTypes) || ['N/A','Behavior','Instruction']; }
        function degreeHtml(){ try { if (typeof window.studentDegreeOptionsHtmlV5278 === 'function') return window.studentDegreeOptionsHtmlV5278(''); } catch(e) {} return nativeOptionList((window.studentData && window.studentData.supportLevels) || ['N/A'], 'N/A'); }
        function staffHtml(){ try { if (typeof window.studentStaffOptionsV5271 === 'function') return window.studentStaffOptionsV5271('N/A',''); } catch(e) {} return '<option value=""></option>'; }
        box.innerHTML = items.map(function(item){
          var label = visibleLabel(item);
          return '<tr data-item="' + esc(item) + '"><td><b>' + esc(label) + '</b><div class="studentRowWarnings"></div></td>' +
            '<td><select class="studentLoc">' + nativeOptionList(locOptions(item), '') + '</select></td>' +
            '<td><select class="studentSupportKind">' + nativeOptionList(supportKinds(), 'N/A') + '</select></td>' +
            '<td><select class="studentSupport">' + degreeHtml() + '</select></td>' +
            '<td><select class="studentPrimary">' + staffHtml() + '</select></td>' +
            '<td><select class="studentSecondary">' + staffHtml() + '</select></td>' +
            '<td class="copyTargetCell"><label class="muted"><input type="checkbox" class="copyTargetBox" value="' + esc(item) + '"> Copy here</label></td></tr>';
        }).join('');
        try { if (typeof window.syncAllStudentDegreeRows === 'function') window.syncAllStudentDegreeRows(); } catch(e2) {}
        relabelDom();
      };
      render.__v05418ah = true;
      window.renderStudentPeriodRows = render;
      try { window.eval('renderStudentPeriodRows = window.renderStudentPeriodRows;'); } catch(e) {}
    }
    var baseSelect = window.selectStudent;
    if (baseSelect && !baseSelect.__v05418ah) {
      var sel = function(row, skipDirtyGuard){
        var ret = baseSelect.apply(this, arguments);
        setTimeout(function(){
          var s = window.currentStudent;
          if (!s) return;
          qsa('#studentPeriodRows tr').forEach(function(tr){
            var item = tr.getAttribute('data-item');
            var p = periodRecordFor(s, item);
            setSelectValue(tr.querySelector('.studentLoc'), p.location);
            setSelectValue(tr.querySelector('.studentSupport'), p.support || 'N/A');
            setSelectValue(tr.querySelector('.studentSupportKind'), p.supportType || 'N/A');
            setSelectValue(tr.querySelector('.studentPrimary'), p.primary);
            setSelectValue(tr.querySelector('.studentSecondary'), p.secondary);
          });
          try { if (typeof window.syncAllStudentDegreeRows === 'function') window.syncAllStudentDegreeRows(); } catch(e) {}
          relabelDom();
        }, 0);
        return ret;
      };
      sel.__v05418ah = true;
      window.selectStudent = sel;
      try { window.eval('selectStudent = window.selectStudent;'); } catch(e) {}
    }
  }
  function patchStaffSurfaces(){
    var basePopulate = window.populateStaffStatic;
    if (basePopulate && !basePopulate.__v05418ah) {
      var pop = function(){
        try { if (basePopulate && basePopulate !== pop) basePopulate.apply(this, arguments); } catch(e) {}
        var items = schoolPeriodItems({ includeDataItems:true, allowOrphans:false });
        var hold = by('holdPeriod');
        if (hold) hold.innerHTML = nativeOptionList(['Coach'].concat(items), hold.value || '');
        try { if (typeof window.refreshStaffPeriodPlaceholdersV5323 === 'function') window.refreshStaffPeriodPlaceholdersV5323(); } catch(e2) {}
        relabelDom();
      };
      pop.__v05418ah = true;
      window.populateStaffStatic = pop;
      try { window.eval('populateStaffStatic = window.populateStaffStatic;'); } catch(e) {}
    }
    var baseSchedule = window.renderStaffOnPaperSchedule;
    if (baseSchedule && !baseSchedule.__v05418ah) {
      var sched = function(rows){
        rows = rows || [];
        var box = by('staffOnPaperSchedule');
        if (!box) return baseSchedule.apply(this, arguments);
        var filtered = rows.filter(function(r){ return !(isOrphanScoped(r && r.item) && isEmptyAssignmentRow(r)); });
        var html = '<table class="onPaperTable"><thead><tr><th>Item</th><th>Primary</th><th>Secondary</th></tr></thead><tbody>';
        html += filtered.map(function(r){
          return '<tr data-item="' + esc(r.item || '') + '"><td><b>' + esc(visibleLabel(r.item || '')) + '</b></td><td>' + ((r.primary && r.primary.length) ? r.primary.map(esc).join('<br>') : '<span class="empty">None</span>') + '</td><td>' + ((r.secondary && r.secondary.length) ? r.secondary.map(esc).join('<br>') : '<span class="empty">None</span>') + '</td></tr>';
        }).join('');
        html += '</tbody></table>';
        box.innerHTML = html;
      };
      sched.__v05418ah = true;
      window.renderStaffOnPaperSchedule = sched;
      try { window.eval('renderStaffOnPaperSchedule = window.renderStaffOnPaperSchedule;'); } catch(e) {}
    }
    var baseEditor = window.renderStaffOnPaperEditor;
    if (baseEditor && !baseEditor.__v05418ah) {
      var editor = function(){
        var body = by('onPaperEditorBody');
        if (!body || !window.currentStaff) return baseEditor.apply(this, arguments);
        var items = schoolPeriodItems({ includeDataItems:true, allowOrphans:false });
        var staffName = clean(window.currentStaff && window.currentStaff.name);
        function optionsFor(item, role){
          var out = [];
          ((window.staffData && window.staffData.studentDetails) || []).forEach(function(stu){
            var p = periodRecordFor(stu, item);
            var loc = clean(p.location), sup = clean(p.support), kind = clean(p.supportType || p.studentSupportType);
            var locN = norm(loc), supN = norm(sup);
            var needs = loc && locN !== 'na' && locN !== 'n a' && sup && supN !== 'na' && supN !== 'n a';
            if (!needs) return;
            var selected = norm(p[role] || '') === norm(staffName);
            var meta = [];
            if (loc) meta.push(loc);
            if (kind && norm(kind) !== 'na' && norm(kind) !== 'n a') meta.push(kind);
            if (sup) meta.push(sup);
            out.push('<option value="' + esc(stu.name) + '"' + (selected ? ' selected' : '') + '>' + esc(stu.name + ' - ' + meta.join(' / ')) + '</option>');
          });
          return out.length ? out.join('') : '<option disabled>No support needs for this item.</option>';
        }
        var html = '<div class="onPaperEditGrid">' + items.map(function(item){
          return '<section class="onPaperPeriodCard" data-item="' + esc(item) + '"><div class="onPaperPeriodTitle">' + esc(visibleLabel(item)) + '</div><div class="onPaperPickers"><div class="onPaperPicker"><label>Primary</label><select multiple class="onPaperPrimary">' + optionsFor(item,'primary') + '</select></div><div class="onPaperPicker"><label>Secondary</label><select multiple class="onPaperSecondary">' + optionsFor(item,'secondary') + '</select></div></div></section>';
        }).join('') + '</div>';
        body.innerHTML = html;
        var help = by('onPaperEditorHelp');
        if (help) help.textContent = 'Editing ' + (window.currentStaff.name || 'staff') + '. Select student(s) by custom period name; location, degree of support, and support type come from each student schedule.';
      };
      editor.__v05418ah = true;
      window.renderStaffOnPaperEditor = editor;
      try { window.eval('renderStaffOnPaperEditor = window.renderStaffOnPaperEditor;'); } catch(e) {}
    }
  }
  function relabelSelect(sel, filterOrphans){
    if (!sel || !sel.options) return;
    var remove = [];
    Array.prototype.slice.call(sel.options).forEach(function(opt){
      var value = clean(opt.value || opt.textContent);
      if (filterOrphans && isOrphanScoped(value)) { remove.push(opt); return; }
      var label = visibleLabel(value);
      if (label && opt.textContent !== label) opt.textContent = label;
    });
    remove.forEach(function(opt){ if (opt.parentNode) opt.parentNode.removeChild(opt); });
  }
  function relabelDom(){
    qsa('#staffOnPaperSchedule tr[data-item] td:first-child b,#onPaperEditorBody [data-item] .onPaperPeriodTitle,#studentPeriodRows tr[data-item] td:first-child b,#scheduleRows tr[data-item] td:first-child b,.schedulePeriod').forEach(function(el){
      var row = el.closest('[data-item]');
      var value = row ? row.getAttribute('data-item') : clean(el.textContent);
      var label = visibleLabel(value);
      if (label && el.textContent !== label) el.textContent = label;
    });
    ['copyFrom','holdPeriod','staffLunchPreference','staffBreakPreference'].forEach(function(id){ relabelSelect(by(id), false); });
    qsa('#advancedSchedulingModalV05418X select,[data-split-item-v05418ae]').forEach(function(sel){ relabelSelect(sel, true); });
  }
  function decorateAdvancedModal(){
    var modal = by('advancedSchedulingModalV05418X');
    if (!modal || !modal.classList.contains('active')) return;
    relabelDom();
    var card = modal.querySelector('.modalBox,.modalCard');
    if (card) card.classList.add('advancedSchedulingCardV05418AH');
    var header = modal.querySelector('.modalHeader,.modalTitleRow');
    if (header) header.classList.add('advancedSchedulingHeaderV05418AH');
    var footer = modal.querySelector('.modalFooter,.toolbar');
    if (footer) footer.classList.add('advancedSchedulingFooterV05418AH');
    qsa('[data-save-adv-v05418ae],#saveAdvancedSchedulingV05418X', modal).forEach(function(btn){ btn.classList.add('btn','primary'); if (clean(btn.textContent).toLowerCase().indexOf('save') >= 0) btn.textContent = 'Save Advanced Scheduling'; });
    qsa('[data-close-adv-v05418ae],[data-close-adv-v05418x]', modal).forEach(function(btn){ if (!btn.classList.contains('modalCloseX')) btn.classList.add('btn'); });
    qsa('.secondaryBtn', modal).forEach(function(btn){ btn.classList.add('btn'); });
    qsa('.primaryBtn', modal).forEach(function(btn){ btn.classList.add('btn','primary'); });
  }
  function installCss(){
    if (by('v05418ah-period-label-style')) return;
    var st = document.createElement('style');
    st.id = 'v05418ah-period-label-style';
    st.textContent = [
      '#advancedSchedulingModalV05418X{background:rgba(15,23,42,.42)!important;padding:56px 18px 18px!important;align-items:flex-start!important;}',
      '#advancedSchedulingModalV05418X .advancedSchedulingCardV05418AH,#advancedSchedulingModalV05418X .modalBox,#advancedSchedulingModalV05418X .modalCard{width:min(900px,94vw)!important;max-width:min(900px,94vw)!important;background:#fff!important;border:1px solid #dbe3ef!important;border-radius:18px!important;box-shadow:0 24px 72px rgba(15,23,42,.30)!important;padding:0!important;overflow:hidden!important;color:#0f172a!important;}',
      '#advancedSchedulingModalV05418X .advancedSchedulingHeaderV05418AH,#advancedSchedulingModalV05418X .modalHeader,#advancedSchedulingModalV05418X .modalTitleRow{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;background:#fff!important;border-bottom:1px solid #e5e7eb!important;padding:16px 18px!important;margin:0!important;position:sticky!important;top:0!important;z-index:3!important;}',
      '#advancedSchedulingModalV05418X .modalBody{padding:16px 18px!important;}',
      '#advancedSchedulingModalV05418X .advancedSchedulingFooterV05418AH,#advancedSchedulingModalV05418X .modalFooter,#advancedSchedulingModalV05418X .toolbar{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;background:#fff!important;border-top:1px solid #e5e7eb!important;padding:12px 18px!important;margin:0!important;position:sticky!important;bottom:0!important;z-index:3!important;}',
      '#advancedSchedulingModalV05418X .modalCloseX{border:0!important;background:transparent!important;color:#64748b!important;font-size:28px!important;line-height:1!important;padding:2px 6px!important;border-radius:999px!important;cursor:pointer!important;}',
      '#advancedSchedulingModalV05418X .modalCloseX:hover{background:#f1f5f9!important;color:#0f172a!important;}',
      '#advancedSchedulingModalV05418X .splitSupportExplainV05418AE{background:#f8fafc!important;border:1px solid #dbeafe!important;border-radius:12px!important;padding:12px!important;color:#334155!important;line-height:1.35!important;}',
      '#advancedSchedulingModalV05418X .splitRowsV05418AE{display:flex!important;flex-direction:column!important;gap:10px!important;margin:12px 0 8px!important;}',
      '#advancedSchedulingModalV05418X .splitRowV05418AE{display:grid!important;grid-template-columns:minmax(220px,1.35fr) minmax(130px,.75fr) minmax(130px,.75fr) 42px!important;gap:10px!important;align-items:center!important;background:#fff!important;border:1px solid #dbe3ef!important;border-radius:14px!important;padding:10px!important;box-shadow:0 1px 2px rgba(15,23,42,.04)!important;}',
      '#advancedSchedulingModalV05418X .splitRowV05418AE select,#advancedSchedulingModalV05418X .splitRowV05418AE input{height:40px!important;width:100%!important;min-width:0!important;border:1px solid #cbd5e1!important;border-radius:10px!important;padding:0 12px!important;background:#fff!important;color:#0f172a!important;font-size:14px!important;box-sizing:border-box!important;}',
      '#advancedSchedulingModalV05418X .addSplitV05418AE{display:inline-flex!important;align-items:center!important;gap:6px!important;border:1px solid #2563eb!important;color:#1d4ed8!important;background:#fff!important;border-radius:999px!important;padding:8px 14px!important;font-weight:800!important;cursor:pointer!important;}',
      '#advancedSchedulingModalV05418X .removeSplitV05418AE{width:38px!important;height:38px!important;border:0!important;border-radius:10px!important;background:#fee2e2!important;color:#b91c1c!important;font-weight:900!important;font-size:18px!important;cursor:pointer!important;}',
      '#advancedSchedulingModalV05418X .btn{border:1px solid #cbd5e1!important;background:#fff!important;color:#0f172a!important;border-radius:10px!important;height:36px!important;padding:0 14px!important;font-weight:700!important;cursor:pointer!important;}',
      '#advancedSchedulingModalV05418X .btn.primary{border-color:#2563eb!important;background:#2563eb!important;color:#fff!important;}',
      '#advancedSchedulingModalV05418X .splitHintV05418AE{color:#64748b!important;font-size:12px!important;margin-top:6px!important;}',
      '@media(max-width:720px){#advancedSchedulingModalV05418X{padding:42px 10px 10px!important}#advancedSchedulingModalV05418X .splitRowV05418AE{grid-template-columns:1fr!important}#advancedSchedulingModalV05418X .removeSplitV05418AE{width:100%!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function patchRenderers(){
    ['renderStaffSchedules','renderStudentSchedules','renderScheduleViews','renderDashboardSummary'].forEach(function(name){
      var base = window[name];
      if (base && !base.__v05418ah) {
        var fn = function(){ var ret = base.apply(this, arguments); setTimeout(relabelDom, 0); return ret; };
        fn.__v05418ah = true;
        window[name] = fn;
        try { window.eval(name + ' = window["' + name + '"];'); } catch(e) {}
      }
    });
  }
  function syncDataItemsFromSource(){
    var items = schoolPeriodItems({ includeDataItems:true, allowOrphans:false });
    if (!items.length) return;
    ['studentData','staffData','scheduleData'].forEach(function(name){
      var d = window[name];
      if (!d || typeof d !== 'object') return;
      d.itemLabels = Object.assign({}, d.itemLabels || {});
      items.forEach(function(item){ d.itemLabels[item] = visibleLabel(item); });
      if (name === 'studentData') d.items = items.slice();
      if (name === 'staffData') d.periods = items.slice();
    });
  }
  function boot(){
    installCss();
    patchGlobals();
    syncDataItemsFromSource();
    patchStudentSurfaces();
    patchStaffSurfaces();
    patchRenderers();
    relabelDom();
    decorateAdvancedModal();
    setTimeout(function(){ cachedCatalog = null; syncDataItemsFromSource(); patchGlobals(); patchStudentSurfaces(); patchStaffSurfaces(); patchRenderers(); relabelDom(); decorateAdvancedModal(); }, 600);
  }
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('#studentAdvancedSchedulingLinkV05418X,[data-add-split-v05418ae],[data-remove-split-v05418ae],[data-close-adv-v05418ae],[data-close-adv-v05418x],[data-save-adv-v05418ae],#saveAdvancedSchedulingV05418X,[data-nav="students"],[data-nav="staff"],[data-action="staff-save"],[data-action="student-save"]');
    if (t) setTimeout(function(){ cachedCatalog = null; syncDataItemsFromSource(); relabelDom(); decorateAdvancedModal(); }, 80);
  }, true);
  document.addEventListener('change', function(e){
    var t = e.target;
    if (t && (t.matches && t.matches('#campusSelector,[data-split-item-v05418ae],#copyFrom,#holdPeriod'))) setTimeout(function(){ cachedCatalog = null; boot(); }, 120);
  }, true);
  if (window.MutationObserver) {
    var observer = new MutationObserver(function(mutations){
      var relevant = false;
      for (var i=0; i<mutations.length; i++) {
        var target = mutations[i].target;
        if (target && target.nodeType === 1 && (target.id === 'advancedSchedulingModalV05418X' || target.id === 'studentPeriodRows' || target.id === 'staffOnPaperSchedule' || (target.closest && target.closest('#advancedSchedulingModalV05418X,#students,#staff')))) { relevant = true; break; }
      }
      if (relevant) setTimeout(function(){ relabelDom(); decorateAdvancedModal(); }, 40);
    });
    var startObserver = function(){ observer.observe(document.body || document.documentElement, { childList:true, subtree:true }); };
    if (document.body) startObserver(); else document.addEventListener('DOMContentLoaded', startObserver);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.gaV05418ahPeriodLabels = function(){ return { version:VERSION, items:schoolPeriodItems({ includeDataItems:true, allowOrphans:false }), catalog:catalog(), source:source() }; };
})();

/* ===== END ga-redis-v05418ah-period-label-surfaces.js ===== */

/* ===== BEGIN ga-redis-v05418ai-period-source-modal-unifier.js ===== */
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

/* ===== END ga-redis-v05418ai-period-source-modal-unifier.js ===== */

/* ===== BEGIN ga-redis-v05418aq-advanced-layout-period-warm.js ===== */
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

/* ===== END ga-redis-v05418aq-advanced-layout-period-warm.js ===== */

/* ===== BEGIN ga-redis-v05418cw-two-to-one-student-manager-fix.js ===== */
(function(){
  if(window.__SUPPORT_SCHEDULES_V05418CW_TWO_TO_ONE_FIX__) return;
  window.__SUPPORT_SCHEDULES_V05418CW_TWO_TO_ONE_FIX__ = true;
  var VERSION = '0.54.18de';
  function disconnectLegacyObserver(){
    try{ if(window.__V05418Z_ADV_OBSERVER__ && window.__V05418Z_ADV_OBSERVER__.disconnect) window.__V05418Z_ADV_OBSERVER__.disconnect(); }catch(e){}
    try{ window.__V05418Z_ADV_OBSERVER__ = null; }catch(e){}
  }
  function markDirty(){ try{ if(typeof window.markProfileDirtyV51229 === 'function') window.markProfileDirtyV51229('student'); else if(typeof window.markDirty === 'function') window.markDirty(); }catch(e){} }
  function sync(){
    disconnectLegacyObserver();
    try{ document.querySelectorAll('#studentPeriodRows .twoToOneSecondStaffRowV05418X').forEach(function(el){ el.remove(); }); }catch(e){}
    try{ if(typeof window.syncTwoToOneRowsV05418AQ === 'function') window.syncTwoToOneRowsV05418AQ(); }catch(e){}
  }
  document.addEventListener('change', function(e){
    var t = e.target;
    if(!t || !t.classList) return;
    if(t.classList.contains('studentSupport')) setTimeout(sync, 10);
    if(t.classList.contains('studentPrimary2') || t.classList.contains('studentSecondary2')){
      try{ if(typeof window.syncTwoToOneRowsV05418AQ === 'function') window.syncTwoToOneRowsV05418AQ(); }catch(e){}
      markDirty();
    }
  }, true);
  document.addEventListener('DOMContentLoaded', function(){ disconnectLegacyObserver(); setTimeout(sync, 250); });
  if(document.readyState !== 'loading'){ disconnectLegacyObserver(); setTimeout(sync, 250); }
})();

/* ===== END ga-redis-v05418cw-two-to-one-student-manager-fix.js ===== */

/* ===== BEGIN ga-redis-v05422-security-manager.js ===== */
/* Support Schedules v05422/v05418dt Security Manager: QR label and tighter access action alignment. */
(function(){
  'use strict';
  if(window.__GA_V05422_SECURITY_MANAGER__) return;
  window.__GA_V05422_SECURITY_MANAGER__ = true;

  function by(id){return document.getElementById(id);}
  function clean(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function selectedSchoolId(){
    var sel=by('campusSelector');
    if(sel && clean(sel.value)) return clean(sel.value);
    try{var p=(typeof window.selectedSchoolPayloadV686m20==='function'?window.selectedSchoolPayloadV686m20():null)||{};var v=clean(p.school||p.schoolId||p.campusId||p.selectedCampusId||'');if(v)return v;}catch(e){}
    try{var p2=(typeof window.selectedSchoolPayloadV683==='function'?window.selectedSchoolPayloadV683():null)||{};var v2=clean(p2.school||p2.schoolId||p2.campusId||p2.selectedCampusId||'');if(v2)return v2;}catch(e2){}
    return '';
  }
  function api(path,params){params=params||{};if(!params.school)params.school=selectedSchoolId();params._t=Date.now();return path+'?'+new URLSearchParams(params).toString();}
  function fetchJson(url,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(url,opts).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||j.message||('HTTP '+r.status));return j;});});}
  function post(path,body){return fetchJson(path,{method:'POST',body:JSON.stringify(Object.assign({school:selectedSchoolId()},body||{}))});}
  function setMsg(msg,type){try{if(typeof window.setMsg==='function')return window.setMsg(msg,type||'warn');}catch(e){}}
  function activePage(){try{if(typeof window.activeSectionIdV51229==='function')return window.activeSectionIdV51229()||'';}catch(e){}var s=document.querySelector('.section.active');return s?s.id:'';}
  function fmtDate(iso){if(!iso)return '';var d=new Date(iso); if(isNaN(d.getTime()))return '';try{return new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'2-digit',day:'2-digit',year:'2-digit',hour:'numeric',minute:'2-digit',hour12:true}).format(d).replace(/\//g,'-');}catch(e){return iso;}}
  function fmtShort(iso){var x=fmtDate(iso);return x||'—';}

  function installStyles(){
    if(by('gaRedisV05422SecurityStyles'))return;
    var css=''+
      '.securityCardV05422{border:1px solid #dbe3ef;border-radius:14px;padding:16px;background:#fff}'+
      '.securityTopRowV05422{display:grid;grid-template-columns:max-content minmax(210px,360px) minmax(250px,430px) auto auto;gap:12px;align-items:end;border-top:1px solid #eef2f7;border-bottom:1px solid #eef2f7;padding:12px 0;margin:12px 0}'+
      '.securityAccessControlV05422{min-width:0;display:inline-flex;align-items:flex-end;gap:10px;justify-content:flex-start;width:max-content!important;max-width:100%}.securityAccessControlV05422 .securityTopControlV05422{flex:0 0 auto;min-width:0;width:auto}.securityAccessControlV05422 [data-v05422-action="revoke-all"]{flex:0 0 auto;margin-bottom:0!important;margin-left:0!important}'+
      '.securityTopControlV05422{min-width:0;display:flex;flex-direction:column;justify-content:flex-end}.securityTopControlV05422 label,.securityStatLabelV05422{display:flex!important;align-items:center!important;gap:4px!important;white-space:nowrap!important;font-size:12px!important;font-weight:800!important;color:#334155!important;margin:0 0 4px!important;height:17px;line-height:17px}'+
      '.securityStatValueV05422{height:36px;display:flex;align-items:center;font-size:12px;color:#64748b;line-height:1.25}.securityTopControlV05422 select{height:36px;width:100%;border:1px solid #dbe3ef;border-radius:10px;padding:0 8px;font-size:13px;background:#fff;font-family:inherit;font-weight:600}'+
      '.securityEndSessionsBtnV05422{border-color:#fecaca!important;background:#fef2f2!important;color:#991b1b!important;font-family:inherit!important;font-weight:800!important;white-space:nowrap}.securityEndSessionsBtnV05422:hover{background:#fee2e2!important}'+
      '.securitySavePolicyBtnV05422{white-space:nowrap}.securityButtonsV05422{display:flex;gap:8px;align-items:flex-end;justify-content:flex-start}#secPolicyMsgV05422{display:none!important}'+
      '.securityTableV05422{width:100%;border-collapse:collapse;margin-top:8px}.securityTableV05422 th,.securityTableV05422 td{border-bottom:1px solid #e5edf7;padding:8px;text-align:left;vertical-align:middle;font-size:13px}.securityTableV05422 th{font-size:11px;color:#64748b;background:#f8fafc;text-transform:uppercase;letter-spacing:.03em}'+
      '.securityIconBtnV05422{border:0;background:transparent;cursor:pointer;font-size:16px;padding:5px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;min-width:28px;min-height:28px}.securityIconBtnV05422:hover{background:#f1f5f9}.securityIconBtnV05422:disabled{opacity:.45;cursor:not-allowed}'+
      '.secIconGreenV05422{color:#16a34a}.secIconGreyV05422{color:#94a3b8}.secIconRedV05422{color:#dc2626}.secIconNavyV05422{color:#0A2540}.secIconAmberV05422{color:#d97706}.secIconBlueV05422{color:#2563eb}'+
      '.securityRowInactiveV05422{opacity:.62}.securityLastAccessBtnV05422{border:0;background:transparent;color:#2563eb;font-size:12px;font-weight:700;cursor:pointer;text-decoration:underline;padding:0}.securityLastAccessBtnV05422.neverV05422{color:#94a3b8;text-decoration:none;cursor:default}'+
      '.securityBadgeRevokedV05422{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:999px;padding:2px 8px;margin-left:6px}'+
      '.securityFlagCountV05422{font-size:10px;font-weight:900;margin-left:2px;color:inherit}.securitySectionTitleV05422{font-size:13px;font-weight:900;color:#0f172a;margin:16px 0 6px}.securityRevokedWrapV05422{border-top:1px solid #eef2f7;margin-top:14px;padding-top:10px}.securityMiniTableV05422{width:100%;border-collapse:collapse;font-size:12px}.securityMiniTableV05422 th,.securityMiniTableV05422 td{border-bottom:1px solid #eef2f7;padding:7px;text-align:left}.securityMiniTableV05422 th{background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase}'+
      '.v05422ModalBackdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:none;align-items:center;justify-content:center;z-index:210;padding:16px}.v05422ModalBackdrop.open{display:flex}.v05422ModalPanel{width:min(620px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 20px 50px rgba(15,23,42,.25)}.v05422ModalHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.v05422LogTable{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}.v05422LogTable th,.v05422LogTable td{border-bottom:1px solid #eef2f7;padding:6px;text-align:left;vertical-align:top}.v05422LookupBtn{border:0;background:transparent;color:#2563eb;font-size:11px;cursor:pointer;text-decoration:underline;padding:0}.v05422LinkOut{width:100%;border:1px solid #dbe3ef;border-radius:8px;padding:8px;font-size:11px;color:#475569;background:#f8fafc;margin-top:4px;word-break:break-all}'+
      '.securityFlagListV05422{display:grid;gap:8px;margin-top:8px}.securityFlagItemV05422{border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#f8fafc}.securityFlagItemV05422.red{border-color:#fecaca;background:#fef2f2}.securityFlagItemV05422.amber{border-color:#fed7aa;background:#fff7ed}.securityForceNoteV05422{font-size:12px;color:#64748b;line-height:1.4;margin:6px 0 0}'+
      '@media(max-width:1250px){.securityTopRowV05422{grid-template-columns:1fr 1fr}.securityTopRowV05422>.btn,.securityTopRowV05422>.securityButtonsV05422{width:100%;justify-content:flex-start}.securityButtonsV05422 button{flex:1}}'+
      'body.darkModeV034 .securityCardV05422,body.darkModeV034 .v05422ModalPanel{background:#172033!important;border-color:#334155!important;color:#f8fafc!important}body.darkModeV034 .securityTableV05422 th,body.darkModeV034 .securityMiniTableV05422 th{background:#0f172a!important;color:#94a3b8!important}body.darkModeV034 .v05422LinkOut{background:#0f172a!important;color:#cbd5e1!important;border-color:#475569!important}';
    var style=document.createElement('style'); style.id='gaRedisV05422SecurityStyles'; style.textContent=css; document.head.appendChild(style);
  }

  var stateV05422={rows:[],revokedInactive:[],portalAppGeneratedOn:'',passcodePolicy:{mode:'disabled',forgotOption:'email'}};

  function ensureSection(){
    var sec=by('securityManager');
    if(!sec){var main=document.querySelector('main')||document.body;sec=document.createElement('section');sec.id='securityManager';sec.className='section';main.appendChild(sec);}
    var nav=document.querySelector('.nav');
    if(nav && !document.querySelector('[data-nav="securityManager"]')){
      var ref=document.querySelector('[data-nav="calendar"]')||document.querySelector('[data-nav="communicationManager"]')||document.querySelector('[data-nav="staff"]');
      var btn=document.createElement('button'); btn.setAttribute('data-nav','securityManager'); btn.textContent='Security Manager';
      if(ref&&ref.parentNode)ref.parentNode.insertBefore(btn,ref.nextSibling); else nav.appendChild(btn);
    }
    var existingBody=by('securityManagerBodyV05422');
    var existingCard=sec.querySelector('.securityCardV05422');
    var existingTable=sec.querySelector('.securityTableV05422');
    var existingTop=sec.querySelector('.securityTopRowV05422');
    var existingRevoked=sec.querySelector('.securityRevokedWrapV05422');
    var shellVersion=existingCard&&existingCard.getAttribute&&existingCard.getAttribute('data-v05422-shell');
    var needsShell=!existingBody||!existingCard||!existingTable||!existingTop||!existingRevoked||existingTop.previousElementSibling!==existingTable||shellVersion!=='cs';
    if(needsShell){
      sec.innerHTML='<div class="securityCardV05422" data-v05422-shell="cs">'
        +'<table class="securityTableV05422"><thead><tr><th>Staff</th><th>Portal / App Access via QR</th><th>Passcode</th><th>History</th><th>Force Check</th><th>Flags</th><th>Last Access</th><th>Last App Activity</th></tr></thead><tbody id="securityManagerBodyV05422"></tbody></table>'
        +'<div class="securityTopRowV05422">'
          +'<div class="securityAccessControlV05422"><div class="securityTopControlV05422"><div class="securityStatLabelV05422">Portal / App Access via QR <span class="helpDot" data-tip="Shows when Staff QR letters were last batch generated for this school. Use Revoke All only when existing printed/saved access should be invalidated.">?</span></div><div class="securityStatValueV05422" id="secGeneratedOnV05422">Generated on: --</div></div><button class="btn danger" data-v05422-action="revoke-all">Revoke All</button></div>'
          +'<div class="securityTopControlV05422"><label>Portal / App Passcode <span class="helpDot" data-tip="Disabled: no passcode used. Optional: staff can turn on a 4-digit passcode from portal/app settings. Required: every active staff member must set a passcode on first access.">?</span></label><select id="secPasscodeModeV05422"><option value="disabled">Disabled</option><option value="optional">Optional</option><option value="required">Required</option></select></div>'
          +'<div class="securityTopControlV05422"><label>Forgot Passcode Options <span class="helpDot" data-tip="Admin reset is always available. Automated email additionally lets staff reset their own passcode via a link sent to their email on file.">?</span></label><select id="secForgotOptionV05422"><option value="email">Automated Email</option><option value="none">Admin Reset Only</option></select></div>'
          +'<div class="securityButtonsV05422"><button class="btn primary securitySavePolicyBtnV05422" data-v05422-action="save-policy">Save</button></div>'
          +'<button class="btn securityEndSessionsBtnV05422" data-v05422-action="end-sessions">End All Staff Portal Sessions</button>'
        +'</div>'
        +'<span id="secPolicyMsgV05422" class="muted" style="font-size:12px"></span>'
        +'<div class="securityRevokedWrapV05422"><div class="securitySectionTitleV05422">Revoked / Inactive Access</div><div id="securityRevokedListV05422"></div></div>'
        +'</div>';
    }
    ensureModalsV05422();try{if(typeof initHelpTooltipOverlayV5254==='function')initHelpTooltipOverlayV5254();}catch(e){}return sec;
  }

  function ensureModalsV05422(){
    function add(id,html){if(!by(id)){var m=document.createElement('div');m.id=id;m.className='v05422ModalBackdrop';m.innerHTML=html;document.body.appendChild(m);}}
    add('secLogModalV05422','<div class="v05422ModalPanel"><div class="v05422ModalHead"><h2 style="margin:0;font-size:16px" id="secLogModalTitleV05422">Security History</h2><button class="btn" data-v05422-action="close-log">Close</button></div><p class="muted" style="margin:0 0 6px">Most recent access and security events for this staff member.</p><div id="secLogBodyV05422"></div></div>');
    add('secLinkModalV05422','<div class="v05422ModalPanel"><div class="v05422ModalHead"><h2 style="margin:0;font-size:16px" id="secLinkModalTitleV05422">Portal Link</h2><button class="btn" data-v05422-action="close-link">Close</button></div><p class="muted" id="secLinkIntroV05422" style="margin:0 0 10px"></p><div id="secLinkBodyV05422"></div></div>');
    add('secPinModalV05422','<div class="v05422ModalPanel"><div class="v05422ModalHead"><h2 style="margin:0;font-size:16px">Reset Passcode</h2><button class="btn" data-v05422-action="close-pin">Close</button></div><p class="muted" id="secPinIntroV05422" style="margin:0 0 10px"></p><div id="secPinMsgV05422" class="muted" style="font-size:12px;margin-bottom:8px"></div><div class="toolbar"><button class="btn danger" data-v05422-action="confirm-pin-reset">Reset Passcode</button></div></div>');
    add('secFlagModalV05422','<div class="v05422ModalPanel"><div class="v05422ModalHead"><h2 style="margin:0;font-size:16px" id="secFlagTitleV05422">Security Flags</h2><button class="btn" data-v05422-action="close-flags">Close</button></div><div id="secFlagBodyV05422"></div></div>');
    add('secForceModalV05422','<div class="v05422ModalPanel"><div class="v05422ModalHead"><h2 style="margin:0;font-size:16px" id="secForceTitleV05422">Force Passcode Check</h2><button class="btn" data-v05422-action="close-force">Close</button></div><p class="muted" id="secForceIntroV05422"></p><div class="toolbar" id="secForceBodyV05422"></div></div>');
    add('secEndSessionsModalV05422','<div class="v05422ModalPanel"><div class="v05422ModalHead"><h2 style="margin:0;font-size:16px">End All Staff Portal Sessions</h2><button class="btn" data-v05422-action="close-end-sessions">Close</button></div><p class="muted">This requires staff to pass the passcode step on their next Staff Portal or paired app open. It does not revoke links or unpair devices.</p><div class="toolbar"><button class="btn" data-v05422-action="do-end-sessions" data-mode="with-passcodes">Staff with passcodes only</button><button class="btn danger" data-v05422-action="do-end-sessions" data-mode="all">All active staff</button></div></div>');
  }

  function linkIconHtml(status){if(status==='valid')return '<i class="fa-solid fa-link secIconGreenV05422" title="Valid link, has been accessed"></i>';if(status==='never-accessed')return '<i class="fa-solid fa-link secIconGreyV05422" title="Valid link, never accessed"></i>';return '<i class="fa-solid fa-link-slash secIconRedV05422" title="Revoked -- no active link"></i>';}
  function passcodeIconHtml(has){return has?'<i class="fa-solid fa-key secIconGreenV05422" title="Passcode set -- click to reset"></i>':'<span class="muted" style="font-size:12px">—</span>';}
  function historyIconHtml(row){var cls=(row.lastAccess||row.hasPasscode||row.appDeviceCount)?'secIconNavyV05422':'secIconGreyV05422';return '<i class="fa-solid fa-folder '+cls+'" title="Open security history"></i>';}
  function forceIconHtml(row){if(!row.active)return '<i class="fa-solid fa-user-lock secIconGreyV05422" title="Inactive staff"></i>';return '<i class="fa-solid fa-user-lock '+(row.forcePasscode?'secIconAmberV05422':'secIconGreyV05422')+'" title="'+(row.forcePasscode?'Force check pending':'Force passcode check on next open')+'"></i>';}
  function flagIconHtml(row){var flags=row.flags||[];if(!flags.length)return '<i class="fa-solid fa-flag secIconGreyV05422" title="No active flags"></i>';var red=flags.some(function(f){return f.severity==='red';});return '<i class="fa-solid fa-flag '+(red?'secIconRedV05422':'secIconAmberV05422')+'" title="Active security flags"></i><span class="securityFlagCountV05422">'+flags.length+'</span>';}

  function renderTable(){
    var body=by('securityManagerBodyV05422'); if(!body)return;
    if(!stateV05422.rows.length){body.innerHTML='<tr><td colspan="8" class="muted">No staff found for this school.</td></tr>';renderRevokedInactive();return;}
    body.innerHTML=stateV05422.rows.map(function(r){
      var lastAccessHtml=r.lastAccess?'<span>'+esc(fmtDate(r.lastAccess.timestamp))+'</span>':'<span class="securityLastAccessBtnV05422 neverV05422">Never accessed</span>';
      var linkCell=r.active?'<button class="securityIconBtnV05422" data-v05422-action="open-link" data-status="'+esc(r.linkStatus)+'" data-active="1" data-staff="'+esc(r.name)+'" title="'+(r.linkStatus==='revoked'?'Generate a new portal link':'Revoke this portal/app link')+'">'+linkIconHtml(r.linkStatus)+'</button>':'<span class="securityIconBtnV05422" title="Inactive staff cannot receive a new link">'+linkIconHtml('revoked')+'</span>';
      var pinCell=r.hasPasscode?'<button class="securityIconBtnV05422" data-v05422-action="open-pin" data-staff="'+esc(r.name)+'" title="Reset passcode">'+passcodeIconHtml(true)+'</button>':passcodeIconHtml(false);
      var hist='<button class="securityIconBtnV05422" data-v05422-action="open-log" data-staff="'+esc(r.name)+'">'+historyIconHtml(r)+'</button>';
      var force='<button class="securityIconBtnV05422" data-v05422-action="open-force" data-staff="'+esc(r.name)+'" '+(r.active?'':'disabled')+'>'+forceIconHtml(r)+'</button>';
      var flags='<button class="securityIconBtnV05422" data-v05422-action="open-flags" data-staff="'+esc(r.name)+'" '+((r.flags||[]).length?'':'disabled')+'>'+flagIconHtml(r)+'</button>';
      var revokedBadge=!r.active?'<span class="securityBadgeRevokedV05422">Inactive · revoked</span>':'';
      return '<tr class="'+(r.active?'':'securityRowInactiveV05422')+'"><td>'+esc(r.name)+revokedBadge+'</td><td>'+linkCell+'</td><td>'+pinCell+'</td><td>'+hist+'</td><td>'+force+'</td><td>'+flags+'</td><td>'+lastAccessHtml+'</td><td>'+esc(fmtShort(r.appLastSeen))+(r.appDeviceCount>1?' <span class="securityBadgeRevokedV05422" style="color:#92400e;background:#fffbeb;border-color:#fde68a">'+r.appDeviceCount+' devices</span>':'')+'</td></tr>';
    }).join('');
    renderRevokedInactive();
  }
  function renderRevokedInactive(){
    var el=by('securityRevokedListV05422'); if(!el)return;
    var rows=stateV05422.revokedInactive||[];
    if(!rows.length){el.innerHTML='<div class="muted" style="font-size:12px">No revoked or inactive access records yet.</div>';return;}
    el.innerHTML='<table class="securityMiniTableV05422"><thead><tr><th>Staff</th><th>Status</th><th>Event</th><th>Date</th><th>By</th><th>Action</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+esc(r.staffName)+'</td><td>'+esc(r.status)+'</td><td>'+esc(r.event)+'</td><td>'+esc(fmtDate(r.timestamp))+'</td><td>'+esc(r.by||'')+'</td><td><button class="securityIconBtnV05422" data-v05422-action="open-log" data-staff="'+esc(r.staffName)+'"><i class="fa-solid fa-folder secIconNavyV05422"></i></button></td></tr>';}).join('')+'</tbody></table>';
  }

  function loadSecurityManager(force){
    fetchJson(api('/api/v05422/security-overview')).then(function(j){
      stateV05422.rows=j.staff||[];stateV05422.revokedInactive=j.revokedInactive||[];stateV05422.portalAppGeneratedOn=j.portalAppGeneratedOn||'';stateV05422.passcodePolicy=j.passcodePolicy||{mode:'disabled',forgotOption:'email'};
      var gen=by('secGeneratedOnV05422'); if(gen)gen.textContent='Generated on: '+(stateV05422.portalAppGeneratedOn?fmtDate(stateV05422.portalAppGeneratedOn):'Not yet generated');
      var modeSel=by('secPasscodeModeV05422'); if(modeSel)modeSel.value=stateV05422.passcodePolicy.mode;
      var forgotSel=by('secForgotOptionV05422'); if(forgotSel)forgotSel.value=stateV05422.passcodePolicy.forgotOption;
      renderTable();
    }).catch(function(e){setMsg('Could not load Security Manager: '+e.message,'err');});
  }

  function findRow(staffName){var k=clean(staffName).toLowerCase();return (stateV05422.rows||[]).find(function(r){return clean(r.name).toLowerCase()===k;})||{};}

  function openLog(staffName){
    ensureModalsV05422();by('secLogModalTitleV05422').textContent='Security History — '+staffName;by('secLogBodyV05422').innerHTML='<div class="muted">Loading...</div>';by('secLogModalV05422').classList.add('open');
    fetchJson(api('/api/v05422/security-access-log',{staffName:staffName})).then(function(j){
      var access=j.rows||[], events=j.events||[];
      var html='';
      html+='<h3 style="font-size:13px;margin:8px 0 4px">Access</h3>';
      if(!access.length)html+='<div class="muted">No access history yet.</div>';else html+='<table class="v05422LogTable"><thead><tr><th>When</th><th>Via</th><th>Device</th><th>IP</th></tr></thead><tbody>'+access.map(function(r){var routeLabel=(r.route==='app'||r.route==='app-pair'||r.route==='app-auto-pair')?'App':'Portal';var device=esc(String(r.userAgent||'').slice(0,80))||'—';var ip=esc(r.ip||'')||'—';var lookupId='lookup_'+Math.random().toString(36).slice(2);return '<tr><td>'+esc(fmtDate(r.timestamp))+'</td><td>'+routeLabel+'</td><td>'+device+'</td><td>'+ip+(r.ip?' <button class="v05422LookupBtn" data-ip="'+esc(r.ip)+'" data-target="'+lookupId+'">look up</button><div id="'+lookupId+'" class="muted" style="font-size:11px"></div>':'')+'</td></tr>';}).join('')+'</tbody></table>';
      html+='<h3 style="font-size:13px;margin:14px 0 4px">Security Events</h3>';
      if(!events.length)html+='<div class="muted">No security events yet.</div>';else html+='<table class="v05422LogTable"><thead><tr><th>When</th><th>Event</th><th>Detail</th></tr></thead><tbody>'+events.map(function(r){return '<tr><td>'+esc(fmtDate(r.timestamp))+'</td><td>'+esc(r.event)+'</td><td>'+esc(r.detail||'')+'</td></tr>';}).join('')+'</tbody></table>';
      by('secLogBodyV05422').innerHTML=html;
    }).catch(function(e){by('secLogBodyV05422').innerHTML='<div class="muted">Could not load history: '+esc(e.message)+'</div>';});
  }
  function lookupIp(ip,targetId){var el=by(targetId); if(!el)return; el.textContent='Looking up...';fetch('https://ipapi.co/'+encodeURIComponent(ip)+'/json/').then(function(r){return r.json();}).then(function(j){el.textContent=(j&&!j.error)?([j.city,j.region,j.country_name].filter(Boolean).join(', ')||'Location not found.'):'Location not found.';}).catch(function(){el.textContent='Look-up failed (network or rate limit).';});}

  function openFlags(staffName){
    var row=findRow(staffName), flags=row.flags||[]; if(!flags.length)return;
    by('secFlagTitleV05422').textContent='Security Flags — '+staffName;
    by('secFlagBodyV05422').innerHTML='<div class="securityFlagListV05422">'+flags.map(function(f){return '<div class="securityFlagItemV05422 '+(f.severity==='red'?'red':'amber')+'"><div style="display:flex;justify-content:space-between;gap:8px"><b>'+esc(f.label)+'</b><span>'+esc(f.severity==='red'?'High':'Review')+'</span></div>'+(f.count?'<p class="securityForceNoteV05422">Related device count: '+esc(f.count)+'</p>':'')+(f.triggeredAt?'<p class="securityForceNoteV05422">First seen: '+esc(fmtDate(f.triggeredAt))+'</p>':'')+(f.reviewable?'<div class="toolbar" style="margin-top:8px"><button class="btn small" data-v05422-action="review-flag" data-staff="'+esc(staffName)+'" data-flag="'+esc(f.id)+'">Mark reviewed</button></div>':'<p class="securityForceNoteV05422">This flag clears automatically when the underlying issue is resolved.</p>')+'</div>';}).join('')+'</div>';
    by('secFlagModalV05422').classList.add('open');
  }
  function reviewFlag(staffName,flagId){post('/api/v05422/security-flag/review',{staffName:staffName,flagId:flagId}).then(function(){setMsg('Security flag marked reviewed.','ok');by('secFlagModalV05422').classList.remove('open');loadSecurityManager(true);}).catch(function(e){setMsg('Could not review flag: '+e.message,'err');});}

  function openForce(staffName){
    var row=findRow(staffName); if(!row.active)return;
    by('secForceTitleV05422').textContent='Force Passcode Check — '+staffName;
    by('secForceIntroV05422').innerHTML=row.forcePasscode?'A passcode check is already pending. The icon stays highlighted until this staff member opens the Staff Portal/app and completes the passcode step.':'Require this staff member to complete the passcode step the next time they open the Staff Portal or paired app.';
    by('secForceBodyV05422').innerHTML=row.forcePasscode?'<button class="btn" data-v05422-action="do-force-check" data-enabled="false" data-staff="'+esc(staffName)+'">Clear forced check</button>':'<button class="btn primary" data-v05422-action="do-force-check" data-enabled="true" data-staff="'+esc(staffName)+'">Force check on next open</button>';
    by('secForceModalV05422').classList.add('open');
  }
  function doForce(staffName,enabled){post('/api/v05422/passcode/force-check',{staffName:staffName,enabled:enabled}).then(function(){setMsg(enabled?'Passcode check will be required on next open.':'Forced passcode check cleared.','ok');by('secForceModalV05422').classList.remove('open');loadSecurityManager(true);}).catch(function(e){setMsg('Could not update forced check: '+e.message,'err');});}

  function openLinkModal(staffName,status,active){ensureModalsV05422();var row=findRow(staffName);status=status||row.linkStatus||'revoked';active=active!==false&&active!=='0'&&row.active!==false;if(!active)return;if(status==='revoked'){by('secLinkModalTitleV05422').textContent='Generate Portal Link';by('secLinkIntroV05422').textContent=staffName+'’s current portal link is revoked. Generate a new Staff Portal link below.';by('secLinkBodyV05422').innerHTML='<div class="toolbar"><button class="btn primary" data-v05422-action="do-generate-link" data-staff="'+esc(staffName)+'">Generate New Portal Link</button></div>';}else{by('secLinkModalTitleV05422').textContent='Revoke Portal / App Access?';by('secLinkIntroV05422').textContent='Revoke the current portal link and app-pairing QR for '+staffName+'? They will need a newly generated portal link to access again.';by('secLinkBodyV05422').innerHTML='<div class="toolbar"><button class="btn" data-v05422-action="close-link">Cancel</button><button class="btn danger" data-v05422-action="do-revoke-link" data-staff="'+esc(staffName)+'">Revoke Link</button></div>';}by('secLinkModalV05422').classList.add('open');}
  function doRevokeLink(staffName){post('/api/v05421/staff-token/revoke',{staffName:staffName}).then(function(){setMsg('Revoked portal/app access for '+staffName+'.','ok');by('secLinkModalV05422').classList.remove('open');loadSecurityManager(true);try{if(typeof window.gaV05423RenderAccessIcon==='function')window.gaV05423RenderAccessIcon(true);}catch(e0){}}).catch(function(e){setMsg('Could not revoke link: '+e.message,'err');});}
  function doGenerateLink(staffName){post('/api/v05422/staff-link/generate',{staffName:staffName}).then(function(j){by('secLinkBodyV05422').innerHTML='<label style="font-size:11px;font-weight:800;color:#334155">Staff Portal Link</label><div class="v05422LinkOut">'+esc(j.staffLink)+'</div><div class="toolbar" style="margin-top:8px"><button class="btn small" data-v05422-action="copy-link" data-link="'+esc(j.staffLink)+'">Copy</button><button class="btn primary small" data-v05422-action="single-letter" data-staff="'+esc(staffName)+'">Generate Updated PDF Letter</button></div><p class="muted" style="font-size:11px;margin-top:12px">Only the Staff Portal link is regenerated here. App auto-pair QR codes are generated from the Staff Letter PDF.</p>';setMsg('New portal link generated for '+staffName+'.','ok');loadSecurityManager(true);try{if(typeof window.gaV05423RenderAccessIcon==='function')window.gaV05423RenderAccessIcon(true);}catch(e0){}}).catch(function(e){setMsg('Could not generate link: '+e.message,'err');});}
  function generateSingleLetter(staffName){setMsg('Generating updated PDF letter for '+staffName+'...','ok');fetch('/api/v05419/staff-portal-letters/generate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({school:selectedSchoolId(),staffName:staffName})}).then(function(r){if(!r.ok)return r.json().catch(function(){return {};}).then(function(j){throw new Error(j.error||('HTTP '+r.status));});return r.blob().then(function(blob){var a=document.createElement('a');var url=URL.createObjectURL(blob);a.href=url;a.download='Staff QR Letter - '+staffName+'.pdf';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);setMsg('PDF letter generated for '+staffName+'.','ok');});}).catch(function(e){setMsg('Could not generate PDF letter: '+e.message,'err');});}

  var pendingPinStaff='';
  function openPinModal(staffName){ensureModalsV05422();pendingPinStaff=staffName;by('secPinIntroV05422').textContent='Resetting '+staffName+'’s passcode clears their current PIN. They will need to set a new one on their next access. Their portal/app link and QR codes are not affected.';by('secPinMsgV05422').textContent='';by('secPinModalV05422').classList.add('open');}
  function confirmPinReset(){if(!pendingPinStaff)return;var msgEl=by('secPinMsgV05422'); if(msgEl)msgEl.textContent='Resetting...';post('/api/v05422/passcode/admin-reset',{staffName:pendingPinStaff}).then(function(){setMsg('Passcode reset for '+pendingPinStaff+'.','ok');by('secPinModalV05422').classList.remove('open');loadSecurityManager(true);}).catch(function(e){if(msgEl)msgEl.textContent='Could not reset: '+e.message;});}

  function revokeAll(){var activeCount=stateV05422.rows.filter(function(r){return r.active;}).length;var doIt=function(){post('/api/v05422/revoke-all',{}).then(function(j){setMsg('Revoked portal/app access for '+(j.revokedCount||0)+' active staff member(s).','ok');loadSecurityManager(true);}).catch(function(e){setMsg('Could not revoke all: '+e.message,'err');});};if(typeof window.showPortalConfirmV51231==='function'){window.showPortalConfirmV51231({title:'Revoke all portal/app access?',message:'This immediately invalidates the current portal link and app pairing for all '+activeCount+' active staff member(s) at this school. New links/letters can be generated right after.',okText:'Revoke All',danger:true,onOk:doIt});}else if(window.confirm('Revoke portal/app access for all '+activeCount+' active staff member(s)?'))doIt();}
  function savePolicy(){var mode=(by('secPasscodeModeV05422')||{}).value||'disabled';var forgot=(by('secForgotOptionV05422')||{}).value||'email';var msgEl=by('secPolicyMsgV05422');if(msgEl)msgEl.textContent='';post('/api/v05422/passcode-policy/save',{mode:mode,forgotOption:forgot}).then(function(){if(msgEl)msgEl.textContent='';setMsg('Security policy saved.','ok');loadSecurityManager(true);}).catch(function(e){if(msgEl)msgEl.textContent='';setMsg('Could not save policy: '+e.message,'err');});}
  function doEndSessions(mode){post('/api/v05422/passcode/end-sessions',{mode:mode}).then(function(j){setMsg('Passcode check will be required for '+(j.forcedCount||0)+' staff member(s) on next open.','ok');by('secEndSessionsModalV05422').classList.remove('open');loadSecurityManager(true);}).catch(function(e){setMsg('Could not end sessions: '+e.message,'err');});}

  document.addEventListener('click',function(e){
    var lookupBtn=e.target&&e.target.closest&&e.target.closest('.v05422LookupBtn');if(lookupBtn){e.preventDefault();lookupIp(lookupBtn.getAttribute('data-ip'),lookupBtn.getAttribute('data-target'));return;}
    var b=e.target&&e.target.closest&&e.target.closest('[data-v05422-action],[data-nav]'); if(!b)return;var a=b.getAttribute('data-v05422-action')||'';
    if(a==='revoke-all'){e.preventDefault();e.stopImmediatePropagation();revokeAll();return false;}
    if(a==='save-policy'){e.preventDefault();e.stopImmediatePropagation();savePolicy();return false;}
    if(a==='end-sessions'){e.preventDefault();e.stopImmediatePropagation();by('secEndSessionsModalV05422').classList.add('open');return false;}
    if(a==='do-end-sessions'){e.preventDefault();e.stopImmediatePropagation();doEndSessions(b.getAttribute('data-mode')||'all');return false;}
    if(a==='close-end-sessions'){e.preventDefault();e.stopImmediatePropagation();by('secEndSessionsModalV05422').classList.remove('open');return false;}
    if(a==='open-log'){e.preventDefault();e.stopImmediatePropagation();openLog(b.getAttribute('data-staff'));return false;}
    if(a==='close-log'){e.preventDefault();e.stopImmediatePropagation();by('secLogModalV05422').classList.remove('open');return false;}
    if(a==='open-flags'){e.preventDefault();e.stopImmediatePropagation();openFlags(b.getAttribute('data-staff'));return false;}
    if(a==='close-flags'){e.preventDefault();e.stopImmediatePropagation();by('secFlagModalV05422').classList.remove('open');return false;}
    if(a==='review-flag'){e.preventDefault();e.stopImmediatePropagation();reviewFlag(b.getAttribute('data-staff'),b.getAttribute('data-flag'));return false;}
    if(a==='open-force'){e.preventDefault();e.stopImmediatePropagation();openForce(b.getAttribute('data-staff'));return false;}
    if(a==='do-force-check'){e.preventDefault();e.stopImmediatePropagation();doForce(b.getAttribute('data-staff'),b.getAttribute('data-enabled')!=='false');return false;}
    if(a==='close-force'){e.preventDefault();e.stopImmediatePropagation();by('secForceModalV05422').classList.remove('open');return false;}
    if(a==='open-link'){e.preventDefault();e.stopImmediatePropagation();openLinkModal(b.getAttribute('data-staff'),b.getAttribute('data-status'),b.getAttribute('data-active'));return false;}
    if(a==='confirm-revoke-link'){e.preventDefault();e.stopImmediatePropagation();openLinkModal(b.getAttribute('data-staff'),b.getAttribute('data-status'),b.getAttribute('data-active'));return false;}
    if(a==='do-generate-link'){e.preventDefault();e.stopImmediatePropagation();doGenerateLink(b.getAttribute('data-staff'));return false;}
    if(a==='do-revoke-link'){e.preventDefault();e.stopImmediatePropagation();doRevokeLink(b.getAttribute('data-staff'));return false;}
    if(a==='single-letter'){e.preventDefault();e.stopImmediatePropagation();generateSingleLetter(b.getAttribute('data-staff'));return false;}
    if(a==='close-link'){e.preventDefault();e.stopImmediatePropagation();by('secLinkModalV05422').classList.remove('open');return false;}
    if(a==='copy-link'){e.preventDefault();e.stopImmediatePropagation();var link=b.getAttribute('data-link')||'';if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(link).then(function(){setMsg('Link copied.','ok');});return false;}
    if(a==='open-pin'){e.preventDefault();e.stopImmediatePropagation();openPinModal(b.getAttribute('data-staff'));return false;}
    if(a==='close-pin'){e.preventDefault();e.stopImmediatePropagation();by('secPinModalV05422').classList.remove('open');return false;}
    if(a==='confirm-pin-reset'){e.preventDefault();e.stopImmediatePropagation();confirmPinReset();return false;}
    var nav=b.getAttribute('data-nav'); if(nav==='securityManager'){setTimeout(function(){fixSecurityTitle();loadSecurityManager(true);},360);}
  },true);

  document.addEventListener('change',function(e){if(e.target&&e.target.id==='campusSelector'){setTimeout(function(){if(activePage()==='securityManager'){fixSecurityTitle();loadSecurityManager(true);}},300);}},true);
  function fixSecurityTitle(){try{var pt=by('pageTitle');if(activePage()==='securityManager'||(pt&&clean(pt.textContent)==='securityManager')){if(pt)pt.textContent='Security Manager';document.title='Security Manager - Support Schedules';}}catch(e){}}
  function boot(){installStyles();ensureSection();fixSecurityTitle();if(activePage()==='securityManager')loadSecurityManager(true);}
  try{if(typeof window.registerNavigationAfterHookV5_==='function')window.registerNavigationAfterHookV5_(function(page){if(page==='securityManager')setTimeout(function(){fixSecurityTitle();loadSecurityManager(true);},240);},'v05422SecurityManager');}catch(e){}
  window.gaV05422OpenLinkModal=openLinkModal; window.gaV05422LoadSecurityManager=loadSecurityManager; window.gaV05422SecurityState=stateV05422;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
})();
setInterval(function(){try{var pt=document.getElementById('pageTitle');var active=document.querySelector('.section.active');if((active&&active.id==='securityManager')||(pt&&String(pt.textContent||'').trim()==='securityManager')){if(pt)pt.textContent='Security Manager';document.title='Security Manager - Support Schedules';}}catch(e){}},800);

/* ===== END ga-redis-v05422-security-manager.js ===== */

/* ===== BEGIN ga-redis-v05423-security-staff-patch.js ===== */
/* Support Schedules v05423/v05418di Staff Manager security access patch.
   Event-driven only: patches the active Staff Manager row variant without adding duplicate Last View fields. */
(function(){
  'use strict';
  if(window.__GA_REDIS_V05423_SECURITY_STAFF_PATCH_DI__) return;
  window.__GA_REDIS_V05423_SECURITY_STAFF_PATCH_DI__=true;
  function by(id){return document.getElementById(id);} 
  function clean(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function norm(v){return clean(v).toLowerCase().replace(/\s+/g,' ');} 
  function closest(el,sel){return el&&el.closest?el.closest(sel):null;}
  function selectedSchoolId(){
    var sel=by('campusSelector');if(sel&&clean(sel.value))return clean(sel.value);
    try{var p=(typeof window.selectedSchoolPayloadV686m20==='function'?window.selectedSchoolPayloadV686m20():null)||{};var v=clean(p.school||p.schoolId||p.campusId||p.selectedCampusId||'');if(v)return v;}catch(e){}
    try{var p2=(typeof window.selectedSchoolPayloadV683==='function'?window.selectedSchoolPayloadV683():null)||{};var v2=clean(p2.school||p2.schoolId||p2.campusId||p2.selectedCampusId||'');if(v2)return v2;}catch(e2){}
    return '';
  }
  function setMsg(msg,type){try{if(typeof window.setMsg==='function')return window.setMsg(msg,type||'warn');}catch(e){}}
  function currentStaffName(){var el=by('staffName');return clean((el&&el.value)||((window.currentStaff||{}).name)||'');}
  function installCss(){
    var css=''
      +'html body #staff>.split>.card:first-child #staffEmailFieldV686m41,html body #staff>.split>.card:first-child .staffEmailFieldV686m41{display:none!important}'
      +'html body #staff #staffLastViewFieldV05410{display:none!important}'
      +'html body #staff #staffLastViewV0545{display:block!important;visibility:visible!important;position:static!important;left:auto!important;width:100%!important;min-width:0!important;height:34px!important}'
      +'html body #staff #staffLastViewV0545.staleV0545{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important}'
      +'html body #staff #staffLastViewV0545.freshV05410{background:#ecfdf5!important;border-color:#bbf7d0!important;color:#166534!important}'
      +'html body #staff .staffPortalAccessFieldV05423{width:50px!important;min-width:50px!important;max-width:50px!important;display:flex!important;flex-direction:column!important;justify-content:flex-end!important;align-self:end!important;margin:0!important;padding:0!important}'
      +'html body #staff .staffPortalAccessFieldV05423 label{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:2px!important;height:17px!important;line-height:17px!important;margin:0 0 5px!important;font-size:12px!important;font-weight:700!important;color:#0f172a!important;white-space:nowrap!important}'
      +'html body #staff .staffPortalAccessFieldV05423 .staffAccessIconBoxV05423{height:34px!important;width:50px!important;min-width:50px!important;max-width:50px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:1px solid #d8e1ef!important;border-radius:12px!important;background:#f8fafc!important;box-sizing:border-box!important}'
      +'html body #staff .staffPortalAccessFieldV05423 .securityIconBtnV05422{font-size:14px!important;padding:0!important;min-width:28px!important;min-height:28px!important;width:28px!important;height:28px!important}'
      +'html body #staff #staffNotificationEmailV0545{min-width:0!important}html body #staff .staffMetricsContactRowV0545>.staffMetricFieldV0545:nth-child(3){padding-left:14px!important;box-sizing:border-box!important}html body #staff .staffEmailLineV0545{min-width:0!important;margin-left:0!important}html body #staff #staffAppPushStatusV0545{cursor:default!important}'
      +'@media(max-width:1500px){.staffPortalAccessFieldV05423{width:46px!important;min-width:46px!important;max-width:46px!important}.staffAccessIconBoxV05423{width:46px!important;min-width:46px!important;max-width:46px!important}}'
      +'@media(max-width:1180px){html body #staff .staffPortalAccessFieldV05423{width:auto!important;max-width:none!important}}'
      +'html body #staff>.split>.card:first-child .staffMetricFieldV0545:has(#staffNotificationEmailV0545){display:none!important}'
      +'html body #staff>.split>.card:first-child #staffNotificationEmailV0545{display:none!important}'
      +'html body #staff>.split>.card:first-child #staffNotificationEmailV686m41,html body #staff>.split>.card:first-child #staffNotificationEmailV024,html body #staff>.split>.card:first-child #staffNotificationEmailV686m26,html body #staff>.split>.card:first-child #staffEmailFieldV024{display:none!important}'
      +'html body #staff>.split>.card:first-child .staffSidebarOrphanEmailV05423{display:none!important}'
      +'.staffQrStatusV05423{font-size:12px;margin-top:6px;color:#64748b}.staffQrStatusV05423.ok{color:#166534}.staffQrStatusV05423.err{color:#b91c1c}';
    var st=by('gaRedisV05423SecurityStaffPatchStyles');
    if(!st){st=document.createElement('style');st.id='gaRedisV05423SecurityStaffPatchStyles';document.head.appendChild(st);} 
    if(st.textContent!==css)st.textContent=css;
  }
  function icon(status){
    if(status==='valid')return '<i class="fa-solid fa-link secIconGreenV05422" title="Valid link, has been accessed"></i>';
    if(status==='never-accessed')return '<i class="fa-solid fa-link secIconGreyV05422" title="Valid link, never accessed"></i>';
    return '<i class="fa-solid fa-link-slash secIconRedV05422" title="Revoked or inactive"></i>';
  }
  function rowEl(){return by('staffMetricsContactRowV0545')||by('staffMetricsContactRowV0546')||document.querySelector('#staff .staffUnifiedRowV0548,#staff .staffContactGridV0548');}
  function removeDuplicateModernLastView(){
    var extra=by('staffLastViewFieldV05410');
    if(extra&&extra.parentNode)extra.parentNode.removeChild(extra);
  }
  function hideOrphanEmailOnStaffList(){
    try{
      document.querySelectorAll('#staffEmailFieldV686m41,.staffEmailFieldV686m41').forEach(function(el){
        var good=el.parentNode&&el.parentNode.classList&&el.parentNode.classList.contains('staffDataStatsV5288');
        if(!good){el.style.display='none';el.classList.add('staffSidebarOrphanEmailV05423');}
      });
      var left=document.querySelector('#staff>.split>.card:first-child');
      var row=rowEl();
      var ids=['staffNotificationEmailV0545','staffNotificationEmailV686m41','staffNotificationEmailV024','staffNotificationEmailV686m26','staffEmailFieldV024','staffEmailFieldV686m41'];
      ids.forEach(function(id){
        var email=by(id);
        if(!email)return;
        var inLeft=left&&left.contains(email);
        var inActiveRow=row&&row.contains(email);
        if(inLeft&&!inActiveRow){
          var wrap=closest(email,'.staffMetricFieldV0545,.staffEmailLineV0545,.inline,.field,.formField')||email.parentNode;
          if(wrap&&left.contains(wrap)){
            wrap.style.display='none';
            wrap.classList.add('staffEmailOrphanHiddenV05423','staffSidebarOrphanEmailV05423');
          }
          email.style.display='none';
          email.classList.add('staffSidebarOrphanEmailV05423');
          var prev=email.previousElementSibling;
          if(prev&&String(prev.tagName||'').toLowerCase()==='label'&&/^\s*Email\s*$/i.test(prev.textContent||'')){
            prev.style.display='none';
            prev.classList.add('staffSidebarOrphanEmailV05423');
          }
        }
      });
      if(left){
        Array.prototype.slice.call(left.querySelectorAll('label')).forEach(function(label){
          if(!/^\s*Email\s*$/i.test(label.textContent||''))return;
          var next=label.nextElementSibling;
          var shouldHide=false;
          if(next&&String(next.tagName||'').toLowerCase()==='input')shouldHide=true;
          if(next&&next.querySelector&&next.querySelector('input[id^="staffNotificationEmail"],input[id^="staffEmailField"]'))shouldHide=true;
          if(shouldHide){
            label.style.display='none';
            label.classList.add('staffSidebarOrphanEmailV05423');
            if(next){next.style.display='none';next.classList.add('staffSidebarOrphanEmailV05423');}
          }
        });
      }
    }catch(e){}
  }
  function lastViewField(){
    removeDuplicateModernLastView();
    var lv=by('staffLastViewV0545');
    var wrap=lv&&closest(lv,'.staffMetricFieldV0545');
    return wrap||null;
  }
  function ensureAccessField(){
    var row=rowEl(); if(!row)return null;
    removeDuplicateModernLastView();
    var lv=lastViewField();
    var field=by('staffPortalAccessFieldV05423');
    if(!field){
      field=document.createElement('div');field.id='staffPortalAccessFieldV05423';field.className='staffMetricFieldV0545 staffPortalAccessFieldV05423';
      field.innerHTML='<label>Access <span class="helpDot" data-tip="Open access controls for this staff member. Green/gray link means current portal access is active; red slash means revoked or inactive.">?</span></label><div id="staffPortalAccessIconV05423" class="staffAccessIconBoxV05423 muted">--</div>';
    }
    if(lv&&lv.parentNode===row){
      if(lv.nextSibling!==field)row.insertBefore(field,lv.nextSibling);
    }else if(field.parentNode!==row){row.appendChild(field);}
    try{if(typeof initHelpTooltipOverlayV5254==='function')initHelpTooltipOverlayV5254();}catch(e){}
    return field;
  }
  function neutralizeAppPairedClick(){
    var f=by('staffAppPushStatusV0545')||by('staffAppPushStatusV05418Y')||document.querySelector('[data-staff-app-paired],.staffAppPushStatusV05418Y');
    if(!f)return;
    f.onclick=function(e){if(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}return false;};
    f.__v0548ClickWired=true;f.style.cursor='default';
    var help=f.closest&&f.closest('.staffMetricFieldV0545')&&f.closest('.staffMetricFieldV0545').querySelector('.helpDot');
    if(help)help.setAttribute('data-tip','Read-only mobile app pairing status. Use the Access link or Security Manager to revoke portal/app access, review devices, or manage security actions.');
    f.title=clean(f.value)==='Yes'?'Paired mobile app status. Use Access/Security Manager to manage access.':'Mobile app is not paired.'; try{f.setAttribute('readonly','readonly');}catch(e){}
  }
  var cache=null, cacheAt=0, cacheSchool='', inFlight=false, lastRenderedKey='';
  function fetchSecurityRows(force){
    var sc=selectedSchoolId(); var now=Date.now();
    if(!force&&cache&&cacheSchool===sc&&now-cacheAt<12000)return Promise.resolve(cache);
    if(inFlight)return Promise.resolve(null);
    inFlight=true;
    return fetch('/api/v05422/security-overview?'+new URLSearchParams({school:sc,_t:Date.now()}).toString(),{credentials:'same-origin',cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){cache=j||{};cacheAt=Date.now();cacheSchool=sc;return cache;})
      .catch(function(){return null;})
      .finally(function(){inFlight=false;});
  }
  function renderPlaceholder(){var box=by('staffPortalAccessIconV05423');if(box&&box.innerHTML!=='--')box.innerHTML='--';}
  function renderAccessIcon(force){
    installCss();neutralizeAppPairedClick();ensureAccessField();
    var staff=currentStaffName(); if(!staff){lastRenderedKey='';renderPlaceholder();return;}
    var key=selectedSchoolId()+'|'+norm(staff);
    if(!force&&key===lastRenderedKey)return;
    lastRenderedKey=key;
    fetchSecurityRows(force).then(function(j){
      if(!j)return;
      var box=by('staffPortalAccessIconV05423'); if(!box)return;
      var rows=(j&&j.staff)||[]; var row=null; var k=norm(staff);
      for(var i=0;i<rows.length;i++){if(norm(rows[i].name)===k){row=rows[i];break;}}
      if(!row){box.innerHTML='--';box.removeAttribute('data-status');return;}
      box.setAttribute('data-status',row.linkStatus||'');
      var html='';
      if(row.active){
        var action=row.linkStatus==='revoked'?'open-link':'confirm-revoke-link';
        html='<button class="securityIconBtnV05422" data-v05422-action="'+action+'" data-active="1" data-status="'+esc(row.linkStatus)+'" data-staff="'+esc(row.name)+'" title="'+(row.linkStatus==='revoked'?'Generate a new portal link':'Revoke this portal/app link')+'">'+icon(row.linkStatus)+'</button>';
      }
      else{html='<span class="securityIconBtnV05422" title="Inactive staff cannot receive a new link">'+icon('revoked')+'</span>';}
      if(box.innerHTML!==html)box.innerHTML=html;
    });
  }
  window.gaV05423RenderAccessIcon=renderAccessIcon;
  function generateLettersDirect(btn){
    var status=by('staffQrStatusV05423');if(!status){status=document.createElement('div');status.id='staffQrStatusV05423';status.className='staffQrStatusV05423';btn.parentNode&&btn.parentNode.appendChild(status);} 
    btn.disabled=true;var old=btn.textContent;btn.textContent='Generating...';status.textContent='Generating staff letters...';status.className='staffQrStatusV05423';
    fetch('/api/v05419/staff-portal-letters/generate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({school:selectedSchoolId()})})
      .then(function(r){if(!r.ok)return r.json().catch(function(){return {};}).then(function(j){throw new Error(j.error||('HTTP '+r.status));});return r.blob();})
      .then(function(blob){var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='Staff QR Letters.pdf';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);status.textContent='Staff letters generated.';status.className='staffQrStatusV05423 ok';setMsg('Staff letters generated.','ok');try{if(window.gaV05422LoadSecurityManager)window.gaV05422LoadSecurityManager(true);}catch(e){}})
      .catch(function(e){status.textContent='Could not generate staff letters: '+e.message;status.className='staffQrStatusV05423 err';setMsg(status.textContent,'err');})
      .finally(function(){btn.disabled=false;btn.textContent=old||'Generate Staff Letters';});
  }
  function relabel(){
    document.querySelectorAll('[data-action="staff-qr-letter-open"]').forEach(function(b){b.textContent='Generate Staff Letters';});
    document.querySelectorAll('#staffQrLetterToolsV5317 .helpDot').forEach(function(h){h.setAttribute('data-tip','Generate a highly styled, print-ready PDF for the currently selected school. Each active staff member gets one page with personal Staff Portal and app-pairing QR codes.');});
  }
  var scheduled=false;
  function schedule(force,delay){
    if(force){cache=null;cacheAt=0;lastRenderedKey='';}
    if(scheduled)return;scheduled=true;
    setTimeout(function(){scheduled=false;try{relabel();hideOrphanEmailOnStaffList();renderAccessIcon(force);hideOrphanEmailOnStaffList();}catch(e){try{console.warn('v05423 staff access patch failed',e);}catch(x){}}},delay==null?120:delay);
  }
  document.addEventListener('click',function(e){var f=e.target&&e.target.closest&&e.target.closest('#staffAppPushStatusV0545,#staffAppPushStatusV05418Y,[data-staff-app-paired],.staffAppPushStatusV05418Y');if(!f)return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();return false;},true);
  window.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('[data-action="staff-qr-letter-open"]');if(!t)return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();generateLettersDirect(t);return false;},true);
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest&&e.target.closest('[data-nav="staff"],#staffList button,.staffList button,[data-staff-index],[data-v05422-action]');
    if(t){var a=t.getAttribute&&t.getAttribute('data-v05422-action');schedule(!!a, a?650:220);}
  },true);
  document.addEventListener('change',function(e){if(e.target&&(e.target.id==='staffName'||e.target.id==='campusSelector'))schedule(true,100);},true);
  document.addEventListener('input',function(e){if(e.target&&e.target.id==='staffName')schedule(true,120);},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule(true,80);});else schedule(true,80);
})();

/* ===== END ga-redis-v05423-security-staff-patch.js ===== */

/* ===== BEGIN ga-redis-v05418free-staff-free-time.js ===== */
/* Support Schedules v05418free: Staff Free Time Assignment.
   Adds Assign/Confirm actions to the dashboard's Staff Free Time tile (mirroring the
   existing Why? pattern on Unassigned Assignments), a window-splitting Assign modal
   supporting Support/Overlap/Comp Time/Other, and a Planning Tools page for a whole-day,
   all-staff view. One-time assignments only (no recurring rules yet) -- see conversation
   notes for the fuller design and what's deferred. */
(function(){
  'use strict';
  if(window.__GA_V05418FREE__) return;
  window.__GA_V05418FREE__ = true;

  function callServer(name,args,ok,fail){
    args=args||[];
    try{if(typeof window.callServer==='function')return window.callServer(name,args,ok,fail);}catch(e0){}
    try{
      if(!window.google||!google.script||!google.script.run)throw new Error('google.script.run unavailable');
      var r=google.script.run.withSuccessHandler(function(v){if(ok)ok(v);}).withFailureHandler(function(e){if(fail)fail(e);});
      return r[name].apply(r,args);
    }catch(e){ if(fail)fail(e); }
  }

  function setMsg(msg,type){try{if(typeof window.setMsg==='function')return window.setMsg(msg,type||'warn');}catch(e){}}

  function invalidateAndRefreshScheduleDisplaysV05418Free(){
    freeTimeAssignedCacheV05418Free=null;
    try{if(typeof window.invalidateScheduleHtmlCacheV686f==='function')window.invalidateScheduleHtmlCacheV686f();}catch(e){}
    try{if(typeof window.renderScheduleViews==='function')window.renderScheduleViews();}catch(e2){}
    try{if(typeof window.renderStaffSchedules==='function')window.renderStaffSchedules();}catch(e4){}
  }

  function by(id){return document.getElementById(id);}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function clean(v){return String(v==null?'':v).trim();}

  function formatMinuteV05418Free(m){
    m=Number(m)||0; var h=Math.floor(m/60), mm=m%60, ap=h>=12?'PM':'AM', hh=h%12; if(hh===0)hh=12;
    return hh+':'+String(mm).padStart(2,'0')+' '+ap;
  }
  function formatMinuteRangeV05418Free(s,e){return formatMinuteV05418Free(s)+' - '+formatMinuteV05418Free(e);}

  var SOURCE_LABELS = {unassigned:'No support need scheduled', 'split-period':'Split-period support window', 'reduced-need':'Reduced/partial support need'};
  var TYPE_LABELS = {support:'Support', overlap:'Overlap', 'comp-time':'Comp Time', other:'Other', 'confirmed-default':'Support (confirmed)'};

  function currentUnassignedLocation(){
    try{ if(typeof window.unassignedSupportLocation==='function') return window.unassignedSupportLocation()||''; }catch(e){}
    try{ return (window.scheduleViewsData&&window.scheduleViewsData.unassignedSupportLocation)||(window.campusData&&window.campusData.unassignedSupportLocation)||''; }catch(e2){ return ''; }
  }

  // ---- Dashboard tile row ----
  // ---- Dashboard tile: one row per staff (aggregated), not one row per window. The
  // modal already shows every window separately once Assign is clicked -- this tile is
  // just "who has free time today and how much," matching the density of the other
  // dashboard tiles (Unassigned Assignments, etc).
  window.aggregateFreeTimeByStaffV05418Free = function(rows){
    var byStaff={}, order=[];
    (rows||[]).forEach(function(r){
      if(!r||!r.staff)return;
      if(!byStaff[r.staff]){byStaff[r.staff]={staff:r.staff,minutes:0,hasUnassigned:false}; order.push(r.staff);}
      byStaff[r.staff].minutes+=Number(r.minutes)||0;
      if(r.source==='unassigned')byStaff[r.staff].hasUnassigned=true;
    });
    return order.map(function(s){return byStaff[s];});
  }
  window.renderFreeTimeStaffRowV05418Free = function(r){
    r=r||{};
    var assignBtn='<button class="btn small" data-action="free-time-assign" data-staff="'+esc(r.staff)+'" style="flex:0 0 auto">Assign</button>';
    return '<div class="dashItem dashGood" style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
      +'<div style="min-width:0"><strong>'+esc(r.staff)+'</strong><span class="dashMeta"> &middot; '+esc(r.minutes)+' min free today</span></div>'
      +assignBtn
      +'</div>';
  };
  window.renderFreeTimeRowV05418Free = function(r){
    r=r||{};
    var timeLabel=formatMinuteRangeV05418Free(r.startMinutes,r.endMinutes);
    var sourceLabel=SOURCE_LABELS[r.source]||'';
    var confirmBtn = r.source==='unassigned'
      ? '<button class="btn small" data-action="free-time-confirm-default" data-staff="'+esc(r.staff)+'" data-period="'+esc(r.period)+'" data-start="'+esc(r.startMinutes)+'" data-end="'+esc(r.endMinutes)+'" style="flex:0 0 auto">Confirm</button>'
      : '';
    var assignBtn='<button class="btn small" data-action="free-time-assign" data-staff="'+esc(r.staff)+'" data-period="'+esc(r.period)+'" data-period-display="'+esc(r.periodDisplay||r.period)+'" data-start="'+esc(r.startMinutes)+'" data-end="'+esc(r.endMinutes)+'" style="flex:0 0 auto">Assign</button>';
    return '<div class="dashItem dashGood" style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
      +'<div style="min-width:0"><strong>'+esc(r.staff)+'</strong><div class="dashMeta">'+esc(r.periodDisplay||r.period)+' · '+esc(timeLabel)+' · '+esc(r.minutes)+' min'+(sourceLabel?' · '+esc(sourceLabel):'')+'</div></div>'
      +'<div style="display:flex;gap:6px;flex:0 0 auto">'+confirmBtn+assignBtn+'</div>'
      +'</div>';
  };

  // ---- Styles ----
  function installStyles(){
    if(by('gaV05418FreeStyles'))return;
    var css=''
      +'.v05418FreeModalBackdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:none;align-items:center;justify-content:center;z-index:220;padding:16px}'
      +'.v05418FreeModalBackdrop.open{display:flex}'
      +'.v05418FreeModalPanel{width:min(560px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 20px 50px rgba(15,23,42,.25)}'
      +'.v05418FreeModalHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}'
      +'.v05418FreeSubhead{color:#64748b;font-size:13px;margin:0 0 14px}'
      +'.v05418FreeGroup{border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:14px}'
      +'.v05418FreeGroupHead{font-weight:800;font-size:13px;color:#0f172a;margin-bottom:10px}'
      +'.v05418FreeSegment{border:1px solid #dbe3ef;border-radius:12px;padding:12px;margin-bottom:10px;background:#f8fafc}'
      +'.v05418FreeSegRow{display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap}'
      +'.v05418FreeSegRow select,.v05418FreeSegRow input{height:34px;border:1px solid #dbe3ef;border-radius:8px;padding:0 8px;font-size:13px}'
      +'.v05418FreeSegRow .v05418FreeDetail{flex:1;min-width:160px}'
      +'.v05418FreeTimeInput{width:74px}'
      +'.v05418FreeRemoveSeg{border:0;background:transparent;color:#dc2626;font-size:12px;font-weight:700;cursor:pointer;margin-left:auto}'
      +'.v05418FreeRemaining{font-size:12px;color:#64748b;margin:6px 0 12px}'
      +'.v05418FreeRemaining.over{color:#dc2626;font-weight:700}'
      +'.v05418FreePlanTable{width:100%;border-collapse:collapse;margin-top:12px}'
      +'.v05418FreePlanTable th,.v05418FreePlanTable td{border-bottom:1px solid #eef2f7;padding:8px;text-align:left;font-size:13px;vertical-align:middle}'
      +'.v05418FreePlanTable th{font-size:11px;color:#64748b;background:#f8fafc;text-transform:uppercase;letter-spacing:.03em}'
      +'.v05418FreeAssignedPill{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:#EAF7F1;color:#0F8A69}'
      +'.v05418FreeCompPill{background:#f1f5f9;color:#475569}';
    var style=document.createElement('style'); style.id='gaV05418FreeStyles'; style.textContent=css; document.head.appendChild(style);
  }

  // ---- Assign modal ----
  // pendingGroups: one entry per DISTINCT free window for the staff member the Assign
  // modal was opened for -- not just the single row that was clicked. A staff member with
  // free time in two different periods sees two independently-manageable sections, each
  // of which can still be sub-divided into its own segments.
  var pendingGroups=[]; // [{window:{staff,period,periodDisplay,start,end}, segments:[{start,end,type,detail}]}]
  var lastFreeRowsV05418Free=[]; // most recent full free-time row list, from whichever surface last rendered (dashboard tile or Planning Tools page)
  var locationsCache=[], staffCache=[];

  function refreshOptionCaches(){
    try{
      if(window.dashboardSummary){
        if(Array.isArray(window.dashboardSummary.freeTimeLocations)) locationsCache=window.dashboardSummary.freeTimeLocations;
        if(Array.isArray(window.dashboardSummary.freeTimeActiveStaff)) staffCache=window.dashboardSummary.freeTimeActiveStaff;
      }
    }catch(e){}
  }

  function ensureModal(){
    if(by('v05418FreeAssignModal'))return;
    installStyles();
    var m=document.createElement('div'); m.id='v05418FreeAssignModal'; m.className='v05418FreeModalBackdrop';
    m.innerHTML='<div class="v05418FreeModalPanel">'
      +'<div class="v05418FreeModalHead"><h2 style="margin:0;font-size:16px" id="v05418FreeModalTitle">Assign Free Time</h2><button class="btn" data-action="free-time-close">Close</button></div>'
      +'<p class="v05418FreeSubhead" id="v05418FreeModalSub"></p>'
      +'<div id="v05418FreeGroups"></div>'
      +'<div class="toolbar"><button class="btn primary" data-action="free-time-save">Save Assignment(s)</button></div>'
      +'<div id="v05418FreeModalMsg" class="muted" style="font-size:12px;margin-top:8px"></div>'
      +'</div>';
    document.body.appendChild(m);
  }

  function detailFieldHtml(seg,gIdx,idx,windowStaff,helpers){
    if(seg.type==='support'){
      var blockedSet={}; (helpers&&helpers.blockedRooms||[]).forEach(function(l){blockedSet[l]=true;});
      var normalLocs=locationsCache.filter(function(l){return !blockedSet[l];});
      var blockedLocs=locationsCache.filter(function(l){return blockedSet[l];});
      function locOption(l){return '<option value="'+esc(l)+'"'+(seg.detail===l?' selected':'')+'>'+esc(l)+'</option>';}
      var opts='<option value="">Choose a location...</option>'+normalLocs.map(locOption).join('');
      if(blockedLocs.length)opts+='<optgroup label="Blocked Room(s)">'+blockedLocs.map(locOption).join('')+'</optgroup>';
      return '<select class="v05418FreeDetail" data-group="'+gIdx+'" data-seg="'+idx+'" data-field="detail">'+opts+'</select>';
    }
    if(seg.type==='overlap'){
      var candidates=(helpers&&helpers.overlapCandidates&&helpers.overlapCandidates.length)?helpers.overlapCandidates.filter(function(c){return c.name!==windowStaff;}):staffCache.filter(function(s){return s!==windowStaff;}).map(function(s){return {name:s,supportingBlockedStudent:false};});
      var normalStaff=candidates.filter(function(c){return !c.supportingBlockedStudent;});
      var blockedStaff=candidates.filter(function(c){return c.supportingBlockedStudent;});
      function staffOption(c){return '<option value="'+esc(c.name)+'"'+(seg.detail===c.name?' selected':'')+'>'+esc(c.name)+'</option>';}
      var opts2='<option value="">Choose staff...</option>'+normalStaff.map(staffOption).join('');
      if(blockedStaff.length)opts2+='<optgroup label="Supporting Blocked Student(s)">'+blockedStaff.map(staffOption).join('')+'</optgroup>';
      return '<select class="v05418FreeDetail" data-group="'+gIdx+'" data-seg="'+idx+'" data-field="detail">'+opts2+'</select>';
    }
    if(seg.type==='other'){
      return '<input type="text" class="v05418FreeDetail" data-group="'+gIdx+'" data-seg="'+idx+'" data-field="detail" placeholder="Describe..." value="'+esc(seg.detail||'')+'">';
    }
    return ''; // comp-time needs no detail
  }

  function renderGroups(){
    var box=by('v05418FreeGroups'); if(!box)return;
    box.innerHTML=pendingGroups.map(function(g,gIdx){
      var segsHtml=g.segments.map(function(seg,idx){
        return '<div class="v05418FreeSegment">'
          +'<div class="v05418FreeSegRow">'
            +'<input type="text" class="v05418FreeTimeInput" data-group="'+gIdx+'" data-seg="'+idx+'" data-field="start" value="'+esc(formatMinuteV05418Free(seg.start))+'" title="Start time">'
            +'<span>&ndash;</span>'
            +'<input type="text" class="v05418FreeTimeInput" data-group="'+gIdx+'" data-seg="'+idx+'" data-field="end" value="'+esc(formatMinuteV05418Free(seg.end))+'" title="End time">'
            +'<select data-group="'+gIdx+'" data-seg="'+idx+'" data-field="type">'
              +['support','overlap','comp-time','other'].map(function(t){return '<option value="'+t+'"'+(seg.type===t?' selected':'')+'>'+TYPE_LABELS[t]+'</option>';}).join('')
            +'</select>'
            +detailFieldHtml(seg,gIdx,idx,g.window.staff,g.helpers)
            +(g.segments.length>1?'<button class="attendanceTinyAction trash" style="margin-left:auto" title="Remove segment" aria-label="Remove segment" data-action="free-time-remove-segment" data-group="'+gIdx+'" data-seg="'+idx+'"><i class="fa fa-trash" aria-hidden="true"></i></button>':'')
          +'</div>'
        +'</div>';
      }).join('');
      var confirmBtn=g.window.source==='unassigned'
        ?'<button class="btn small" data-action="free-time-confirm-default" data-group="'+gIdx+'">Confirm default Support</button>'
        :'';
      return '<div class="v05418FreeGroup">'
        +'<div class="v05418FreeGroupHead">'+esc(g.window.periodDisplay||g.window.period)+' &middot; '+esc(formatMinuteRangeV05418Free(g.window.start,g.window.end))+' free '+confirmBtn+'</div>'
        +segsHtml
        +'<div class="v05418FreeRemaining" data-group-remaining="'+gIdx+'"></div>'
        +'<button class="btn small" data-action="free-time-add-segment" data-group="'+gIdx+'">+ Add segment to this window</button>'
      +'</div>';
    }).join('');
    pendingGroups.forEach(function(g,gIdx){ renderRemaining(gIdx); });
  }

  function parseTimeToMinutes(text){
    text=clean(text);
    var m=text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
    if(!m)return null;
    var h=Number(m[1]), mm=Number(m[2]), ap=(m[3]||'').toUpperCase();
    if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0;
    return h*60+mm;
  }

  function renderRemaining(gIdx){
    var g=pendingGroups[gIdx]; if(!g)return;
    var el=document.querySelector('[data-group-remaining="'+gIdx+'"]'); if(!el)return;
    var covered=g.segments.reduce(function(sum,s){return sum+Math.max(0,(s.end-s.start));},0);
    var total=g.window.end-g.window.start;
    var remaining=total-covered;
    if(remaining<0){el.textContent='Segments exceed this window by '+Math.abs(remaining)+' minute(s). Adjust before saving.';el.className='v05418FreeRemaining over';}
    else if(remaining>0){el.textContent=remaining+' minute(s) of this window are not yet assigned to a segment.';el.className='v05418FreeRemaining';}
    else{el.textContent='Full window assigned.';el.className='v05418FreeRemaining';}
  }

  // Gathers every distinct free window for one staff member from whichever surface most
  // recently rendered them, so the modal can show all of that staff member's free time
  // today, not just the single row that was clicked.
  function allFreeWindowsForStaff(staffName){
    var source=lastFreeRowsV05418Free.length?lastFreeRowsV05418Free:((window.dashboardSummary&&window.dashboardSummary.freeTime)||[]);
    return (source||[]).filter(function(r){return r.staff===staffName;});
  }

  var assignHelpersCacheV05418Free={}; // period -> {blockedRooms:[...], overlapCandidates:[...]}
  function fetchAssignHelpersForGroup(gIdx){
    var g=pendingGroups[gIdx]; if(!g)return;
    var period=g.window.period;
    if(assignHelpersCacheV05418Free[period]){ g.helpers=assignHelpersCacheV05418Free[period]; renderGroups(); return; }
    callServer('getFreeTimeAssignHelpersV05418Free',[{staff:g.window.staff,period:period}],function(resp){
      var helpers=(resp&&resp.ok)?{blockedRooms:resp.blockedRooms||[],overlapCandidates:resp.overlapCandidates||[]}:{blockedRooms:[],overlapCandidates:[]};
      assignHelpersCacheV05418Free[period]=helpers;
      pendingGroups.forEach(function(gr){ if(gr.window.period===period) gr.helpers=helpers; });
      renderGroups();
    },function(e){ try{console.error('getFreeTimeAssignHelpersV05418Free failed:',e);}catch(e2){} });
  }

  function openAssignModal(staff){
    refreshOptionCaches();
    var windows=allFreeWindowsForStaff(staff);
    if(!windows.length){
      setMsg('Could not find current free time windows for '+staff+'. Try refreshing the page first.','err');
      return;
    }
    assignHelpersCacheV05418Free={};
    pendingGroups=windows.map(function(w){
      return {
        window:{staff:w.staff,period:w.period,periodDisplay:w.periodDisplay||w.period,start:Number(w.startMinutes),end:Number(w.endMinutes),source:w.source},
        segments:[{start:Number(w.startMinutes),end:Number(w.endMinutes),type:'support',detail:currentUnassignedLocation()}]
      };
    });
    ensureModal();
    by('v05418FreeModalTitle').textContent='Assign Free Time';
    by('v05418FreeModalSub').textContent=staff+' \u00b7 '+pendingGroups.length+' free window'+(pendingGroups.length===1?'':'s')+' today';
    by('v05418FreeModalMsg').textContent='';
    renderGroups();
    by('v05418FreeAssignModal').classList.add('open');
    pendingGroups.forEach(function(g,gIdx){ fetchAssignHelpersForGroup(gIdx); });
  }

  function addSegment(gIdx){
    var g=pendingGroups[gIdx]; if(!g||!g.segments.length)return;
    var last=g.segments[g.segments.length-1];
    if(last.end>=g.window.end){by('v05418FreeModalMsg').textContent='This window is fully covered. Shorten the last segment\u2019s end time first to leave room for another.';return;}
    g.segments.push({start:last.end,end:g.window.end,type:'support',detail:currentUnassignedLocation()});
    renderGroups();
  }
  function removeSegment(gIdx,idx){
    var g=pendingGroups[gIdx]; if(!g)return;
    g.segments.splice(idx,1);
    if(!g.segments.length)g.segments.push({start:g.window.start,end:g.window.end,type:'support',detail:''});
    renderGroups();
  }

  function saveSegments(){
    var msg=by('v05418FreeModalMsg');
    var flatCalls=[];
    for(var gi=0;gi<pendingGroups.length;gi++){
      var g=pendingGroups[gi];
      for(var i=0;i<g.segments.length;i++){
        var s=g.segments[i];
        if(s.end<=s.start){msg.textContent='Each segment needs an end time after its start time.';return;}
        if(s.start<g.window.start||s.end>g.window.end){msg.textContent='Segments must stay within their free window ('+formatMinuteRangeV05418Free(g.window.start,g.window.end)+').';return;}
        if((s.type==='support'||s.type==='overlap')&&!clean(s.detail)){msg.textContent='Choose a '+(s.type==='support'?'location':'staff member')+' for the '+TYPE_LABELS[s.type]+' segment.';return;}
        if(s.type==='other'&&!clean(s.detail)){msg.textContent='Describe the "Other" segment before saving.';return;}
      }
      for(var j=0;j<g.segments.length-1;j++){ if(g.segments[j].end>g.segments[j+1].start){ msg.textContent='Segments overlap in one of the windows -- adjust times before saving.'; return; } }
      g.segments.forEach(function(s){ flatCalls.push({staff:g.window.staff,period:g.window.period,startMinutes:s.start,endMinutes:s.end,type:s.type,detail:s.detail||''}); });
    }
    msg.textContent='Saving...';
    var staffLabel=pendingGroups.length?pendingGroups[0].window.staff:'';
    var calls=flatCalls.map(function(payload){
      return new Promise(function(resolve,reject){
        callServer('saveFreeTimeAssignmentV05418Free',[payload],function(r){resolve(r);},function(e){reject(e);});
      });
    });
    Promise.all(calls).then(function(){
      by('v05418FreeAssignModal').classList.remove('open');
      setMsg('Free time assignment saved for '+staffLabel+'.','ok');
      if(typeof loadDashboardSummary==='function')loadDashboardSummary({refresh:true});
      invalidateAndRefreshScheduleDisplaysV05418Free();
      refreshPlanningPageIfActive();
    }).catch(function(e){
      msg.textContent='Could not save: '+((e&&e.message)||e);
    });
  }
  function confirmDefault(staff,period,start,end){
    var loc=currentUnassignedLocation();
    callServer('confirmDefaultFreeTimeV05418Free',[{staff:staff,period:period,startMinutes:Number(start),endMinutes:Number(end),location:loc}],function(){
      setMsg('Confirmed Support'+(loc?' '+loc:'')+' for '+staff+'.','ok');
      if(typeof loadDashboardSummary==='function')loadDashboardSummary({refresh:true});
      invalidateAndRefreshScheduleDisplaysV05418Free();
      refreshPlanningPageIfActive();
    },function(e){setMsg('Could not confirm: '+((e&&e.message)||e),'err');});
  }
  function confirmDefaultFromGroup(gIdx){
    var g=pendingGroups[gIdx]; if(!g)return;
    var loc=currentUnassignedLocation();
    callServer('confirmDefaultFreeTimeV05418Free',[{staff:g.window.staff,period:g.window.period,startMinutes:g.window.start,endMinutes:g.window.end,location:loc}],function(){
      pendingGroups.splice(gIdx,1);
      if(!pendingGroups.length){
        by('v05418FreeAssignModal').classList.remove('open');
      } else {
        renderGroups();
      }
      setMsg('Confirmed Support'+(loc?' '+loc:'')+' for '+g.window.staff+'.','ok');
      if(typeof loadDashboardSummary==='function')loadDashboardSummary({refresh:true});
      invalidateAndRefreshScheduleDisplaysV05418Free();
      refreshPlanningPageIfActive();
    },function(e){by('v05418FreeModalMsg').textContent='Could not confirm: '+((e&&e.message)||e);});
  }

  function removeAssignment(id,staffLabel){
    var doRemove=function(){
      callServer('deleteFreeTimeAssignmentV05418Free',[id],function(){
        setMsg('Removed free time assignment'+(staffLabel?' for '+staffLabel:'')+'.','ok');
        if(typeof loadDashboardSummary==='function')loadDashboardSummary({refresh:true});
      invalidateAndRefreshScheduleDisplaysV05418Free();
        refreshPlanningPageIfActive();
      },function(e){setMsg('Could not remove: '+((e&&e.message)||e),'err');});
    };
    if(typeof showPortalConfirmV51231==='function')showPortalConfirmV51231({title:'Remove this assignment?',message:'This returns the time to the free-time pool.',okText:'Remove',danger:true,onOk:doRemove});
    else if(window.confirm('Remove this free time assignment?'))doRemove();
  }

  // ---- Planning Tools page ----
  function ensurePlanningSection(){
    var sec=by('freeTimePlanning');
    if(!sec){
      var main=document.querySelector('main')||document.body;
      sec=document.createElement('section'); sec.id='freeTimePlanning'; sec.className='section';
      sec.innerHTML='<div class="card">'
        +'<h3 style="margin:0 0 6px;font-size:14px">Still Free</h3>'
        +'<table class="v05418FreePlanTable"><thead><tr><th>Staff</th><th>Period</th><th>Time</th><th>Minutes</th><th>Source</th><th></th></tr></thead><tbody id="freeTimePlanningFreeBody"></tbody></table>'
        +'<h3 style="margin:20px 0 6px;font-size:14px">Assigned Today</h3>'
        +'<table class="v05418FreePlanTable"><thead><tr><th>Staff</th><th>Period</th><th>Time</th><th>Type</th><th>Detail</th><th></th></tr></thead><tbody id="freeTimePlanningAssignedBody"></tbody></table>'
        +'</div>';
      main.appendChild(sec);
    }
    var nav=document.querySelector('.nav');
    if(nav && !document.querySelector('[data-nav="freeTimePlanning"]')){
      var ref=document.querySelector('[data-nav="scheduleOptimizer"]');
      var btn=document.createElement('button'); btn.setAttribute('data-nav','freeTimePlanning'); btn.textContent='Free Time Assignment';
      if(ref&&ref.parentNode)ref.parentNode.insertBefore(btn,ref.nextSibling); else nav.appendChild(btn);
    }
  }

  function renderPlanningPage(data){
    refreshOptionCaches();
    if(Array.isArray(data.staffLocations))locationsCache=data.staffLocations;
    if(Array.isArray(data.activeStaff))staffCache=data.activeStaff;
    lastFreeRowsV05418Free=Array.isArray(data.free)?data.free:[];
    var freeBody=by('freeTimePlanningFreeBody');
    if(freeBody){
      var free=data.free||[];
      freeBody.innerHTML=free.length?free.map(function(r){
        return '<tr><td>'+esc(r.staff)+'</td><td>'+esc(r.periodDisplay||r.period)+'</td><td>'+esc(formatMinuteRangeV05418Free(r.startMinutes,r.endMinutes))+'</td><td>'+esc(r.minutes)+'</td><td>'+esc(SOURCE_LABELS[r.source]||r.source||'')+'</td><td><button class="btn small" data-action="free-time-assign" data-staff="'+esc(r.staff)+'" data-period="'+esc(r.period)+'" data-period-display="'+esc(r.periodDisplay||r.period)+'" data-start="'+esc(r.startMinutes)+'" data-end="'+esc(r.endMinutes)+'">Assign</button></td></tr>';
      }).join(''):'<tr><td colspan="6" class="muted">No free time remaining today.</td></tr>';
    }
    var assignedBody=by('freeTimePlanningAssignedBody');
    if(assignedBody){
      var assigned=data.assigned||[];
      assignedBody.innerHTML=assigned.length?assigned.map(function(a){
        var pillClass=a.type==='comp-time'?'v05418FreeAssignedPill v05418FreeCompPill':'v05418FreeAssignedPill';
        return '<tr><td>'+esc(a.staff)+'</td><td>'+esc(a.period)+'</td><td>'+esc(formatMinuteRangeV05418Free(a.startMinutes,a.endMinutes))+'</td><td><span class="'+pillClass+'">'+esc(TYPE_LABELS[a.type]||a.type)+'</span></td><td>'+esc(a.detail||'')+'</td><td><button class="attendanceTinyAction trash" title="Remove assignment" aria-label="Remove assignment" data-action="free-time-remove" data-id="'+esc(a.id)+'" data-staff="'+esc(a.staff)+'"><i class="fa fa-trash" aria-hidden="true"></i></button></td></tr>';
      }).join(''):'<tr><td colspan="6" class="muted">Nothing assigned yet today.</td></tr>';
    }
  }

  function loadPlanningPage(){
    ensurePlanningSection();
    callServer('getFreeTimeAssignmentPageDataV05418Free',[null],function(d){renderPlanningPage(d||{});},function(e){
      var fb=by('freeTimePlanningFreeBody'); if(fb)fb.innerHTML='<tr><td colspan="6" class="muted">Could not load: '+esc((e&&e.message)||e)+'</td></tr>';
    });
  }
  window.loadFreeTimeAssignmentPageV05418Free=loadPlanningPage;
  function refreshPlanningPageIfActive(){
    try{ var sec=by('freeTimePlanning'); if(sec&&sec.classList.contains('active'))loadPlanningPage(); }catch(e){}
  }

  // ---- Click dispatcher ----
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest?e.target.closest('[data-action],[data-nav]'):null; if(!t)return;
    var a=t.getAttribute('data-action')||'';
    if(a==='free-time-assign'){e.preventDefault();e.stopImmediatePropagation();openAssignModal(t.getAttribute('data-staff'));return false;}
    if(a==='free-time-confirm-default'){e.preventDefault();e.stopImmediatePropagation();if(t.hasAttribute('data-group'))confirmDefaultFromGroup(Number(t.getAttribute('data-group')));else confirmDefault(t.getAttribute('data-staff'),t.getAttribute('data-period'),t.getAttribute('data-start'),t.getAttribute('data-end'));return false;}
    if(a==='free-time-close'){e.preventDefault();e.stopImmediatePropagation();by('v05418FreeAssignModal').classList.remove('open');return false;}
    if(a==='free-time-add-segment'){e.preventDefault();e.stopImmediatePropagation();addSegment(Number(t.getAttribute('data-group')));return false;}
    if(a==='free-time-remove-segment'){e.preventDefault();e.stopImmediatePropagation();removeSegment(Number(t.getAttribute('data-group')),Number(t.getAttribute('data-seg')));return false;}
    if(a==='free-time-save'){e.preventDefault();e.stopImmediatePropagation();saveSegments();return false;}
    if(a==='free-time-remove'){e.preventDefault();e.stopImmediatePropagation();removeAssignment(t.getAttribute('data-id'),t.getAttribute('data-staff'));return false;}
    var nav=t.getAttribute('data-nav'); if(nav==='freeTimePlanning'){setTimeout(loadPlanningPage,80);}
  },true);

  document.addEventListener('change',function(e){
    var el=e.target; if(!el||!el.hasAttribute('data-seg')||!el.hasAttribute('data-group'))return;
    var gIdx=Number(el.getAttribute('data-group')), idx=Number(el.getAttribute('data-seg')), field=el.getAttribute('data-field');
    var g=pendingGroups[gIdx]; if(!g||!g.segments[idx])return;
    if(field==='type'){g.segments[idx].type=el.value; g.segments[idx].detail=el.value==='support'?currentUnassignedLocation():''; renderGroups(); return;}
    if(field==='detail'){g.segments[idx].detail=el.value; return;}
    if(field==='start'||field==='end'){
      var mins=parseTimeToMinutes(el.value);
      if(mins==null){el.value=formatMinuteV05418Free(g.segments[idx][field]); return;}
      g.segments[idx][field]=mins;
      renderRemaining(gIdx);
    }
  },true);

  // ---- Visibility threading: enhance the "free" cell display in schedule tables with any
  // persisted free-time assignment for that staff+period, instead of always showing the
  // generic "Support [default location]" fallback. Lazily loads today's assignments once
  // and caches them; a cell rendered before the fetch completes shows the generic text and
  // gets corrected on the next re-render once the fetch resolves.
  var freeTimeAssignedCacheV05418Free=null; // null = not yet loaded; array once loaded
  var freeTimeAssignedFetchInFlightV05418Free=false;
  function ensureFreeTimeAssignedCacheV05418Free(){
    if(freeTimeAssignedCacheV05418Free!==null||freeTimeAssignedFetchInFlightV05418Free)return;
    freeTimeAssignedFetchInFlightV05418Free=true;
    callServer('getFreeTimeAssignmentPageDataV05418Free',[null],function(d){
      freeTimeAssignedFetchInFlightV05418Free=false;
      freeTimeAssignedCacheV05418Free=(d&&Array.isArray(d.assigned))?d.assigned:[];
      try{if(typeof window.renderScheduleViews==='function')window.renderScheduleViews();}catch(e){}
      try{if(typeof window.renderStaffSchedules==='function')window.renderStaffSchedules();}catch(e2){}
    },function(){ freeTimeAssignedFetchInFlightV05418Free=false; freeTimeAssignedCacheV05418Free=[]; });
  }
  var FREE_TIME_TYPE_ICON = {overlap:'Overlap: ', 'comp-time':'Comp Time', other:'', support:'Support ', 'confirmed-default':'Support '};
  // Returns an HTML string for this staff+period cell if a persisted assignment exists,
  // or null if there's none (caller should fall back to its normal generic text). Admin
  // portal surfaces are all "admin view" per the visibility design, so every assignment
  // type (including Comp Time) displays normally here -- the admin-only/staff-only
  // Comp Time restriction applies to staff-facing surfaces (Staff Portal, mobile app),
  // not to any admin-portal table.
  window.freeTimeAssignmentCellHtmlV05418Free = function(staffName, periodKey){
    ensureFreeTimeAssignedCacheV05418Free();
    if(!freeTimeAssignedCacheV05418Free||!freeTimeAssignedCacheV05418Free.length)return null;
    var match=freeTimeAssignedCacheV05418Free.find(function(a){return a.staff===staffName&&a.period===periodKey;});
    if(!match)return null;
    var label=FREE_TIME_TYPE_ICON[match.type]!==undefined?FREE_TIME_TYPE_ICON[match.type]:'';
    var text=(label+(match.detail||'')).trim()||TYPE_LABELS[match.type]||match.type;
    return '<span class="empty">'+esc(text)+'</span>';
  };

  function boot(){ installStyles(); ensurePlanningSection(); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
})();

/* ===== END ga-redis-v05418free-staff-free-time.js ===== */

/* ===== BEGIN ga-redis-v05418dj-school-session-modal-guard.js ===== */
(function(){
  if(window.__GA_V05418DJ_SCHOOL_SESSION_MODAL_GUARD__)return;
  window.__GA_V05418DJ_SCHOOL_SESSION_MODAL_GUARD__=true;
  var VERSION='v05418dk';
  function clean(v){return String(v==null?'':v).trim();}
  function lower(v){return clean(v).toLowerCase();}
  function by(id){return document.getElementById(id);}
  function msg(text,type){try{if(typeof setMsg==='function')setMsg(text,type||'warn');}catch(e){}}
  function tabId(){try{if(typeof window.gaSchedulerTabIdV05418DJ==='function')return window.gaSchedulerTabIdV05418DJ();}catch(e){}var id='';try{id=sessionStorage.getItem('gaSchedulerTabIdV05418DJ')||'';}catch(e2){}if(!id){id='tab_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);try{sessionStorage.setItem('gaSchedulerTabIdV05418DJ',id);}catch(e3){}}return id;}
  function selectedSchool(){try{if(typeof window.selectedSchoolPayloadForRedisV05418DJ==='function')return window.selectedSchoolPayloadForRedisV05418DJ()||{};}catch(e){}try{var ss=window.__schoolSessionV5450||JSON.parse(sessionStorage.getItem('gaSchedulerSchoolSessionV5450')||'{}');if(ss&&(ss.campusId||ss.spreadsheetId))return {campusId:ss.campusId,schoolId:ss.campusId,school:ss.campusId,campusName:ss.campusName,schoolName:ss.campusName,spreadsheetId:ss.spreadsheetId};}catch(e2){}try{var sel=by('campusSelector');var opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;return {campusId:(sel&&sel.value)||'',schoolId:(sel&&sel.value)||'',school:(sel&&sel.value)||'',campusName:(opt&&opt.textContent)||'',schoolName:(opt&&opt.textContent)||'',spreadsheetId:(opt&&(opt.getAttribute('data-spreadsheet-id')||opt.getAttribute('data-ss-id')||''))||''};}catch(e3){return {};}}
  function schoolKey(p){p=p||selectedSchool();return lower(p.campusId||p.schoolId||p.school||p.selectedCampusId||'')+'|'+lower(p.spreadsheetId||p.selectedSpreadsheetId||'');}
  function stripSchoolCaches(){try{for(var i=sessionStorage.length-1;i>=0;i--){var k=sessionStorage.key(i)||'';if(/Dash|Dashboard|ScheduleNow|Todo|Student|Staff|Calendar|Attendance|ScheduleViews|v5195|v5380|v5391|v5392|v5443|v5444|v5447|v5448|v686/i.test(k))sessionStorage.removeItem(k);}}catch(e){}try{if(typeof v5268CacheClear==='function')v5268CacheClear();}catch(e2){}try{window.dashboardSummary=null;dashboardSummary=null;}catch(e3){}try{window.scheduleNowData=null;scheduleNowData=null;}catch(e4){}try{window.todoItemsData=[];todoItemsData=[];}catch(e5){} }
  function stampSession(){var p=selectedSchool();var key=schoolKey(p);var s={tabId:tabId(),schoolKey:key,campusId:clean(p.campusId||p.schoolId||p.school||p.selectedCampusId||''),campusName:clean(p.campusName||p.schoolName||p.name||''),spreadsheetId:clean(p.spreadsheetId||p.selectedSpreadsheetId||''),updatedAt:new Date().toISOString(),version:VERSION};window.__gaSchoolIsolationV05418DJ=s;try{sessionStorage.setItem('gaSchoolIsolationV05418DJ',JSON.stringify(s));}catch(e){}return s;}
  function currentIsolation(){try{return window.__gaSchoolIsolationV05418DJ||JSON.parse(sessionStorage.getItem('gaSchoolIsolationV05418DJ')||'{}')||{};}catch(e){return {};}}
  function schoolMatchesScope(scope){scope=scope||{};var p=selectedSchool();var sc=lower(scope.campusId||scope.schoolId||scope.school||scope.selectedCampusId||'');var ss=lower(scope.spreadsheetId||scope.selectedSpreadsheetId||'');var pc=lower(p.campusId||p.schoolId||p.school||p.selectedCampusId||'');var ps=lower(p.spreadsheetId||p.selectedSpreadsheetId||'');if(sc&&pc&&sc!==pc)return false;if(ss&&ps&&ss!==ps)return false;return true;}
  window.gaSchoolIsolationGuardV05418DJ={version:VERSION,tabId:tabId,selectedSchool:selectedSchool,schoolKey:schoolKey,stamp:stampSession,clearCaches:stripSchoolCaches,schoolMatchesScope:schoolMatchesScope};

  var lastSchoolKey=schoolKey();
  stampSession();
  document.addEventListener('change',function(e){var t=e&&e.target;if(t&&t.id==='campusSelector'){var next=schoolKey();if(next!==lastSchoolKey){lastSchoolKey=next;stripSchoolCaches();stampSession();try{if(typeof clearDashboardStateAndCachesV5452==='function')clearDashboardStateAndCachesV5452('Switching school...');}catch(x){}}}},true);
  document.addEventListener('click',function(e){var t=e&&e.target&&e.target.closest?e.target.closest('[data-school-id],#schoolExitV5450,[data-action="system-admin-return-dashboard-v5456"]'):null;if(t){setTimeout(function(){lastSchoolKey=schoolKey();stripSchoolCaches();stampSession();},0);}},true);

  // Trusted UI action tracker. A modal should open because this tab's user clicked/typed,
  // not because another browser/device changed a shared server-side value.
  var lastTrustedAt=0;
  function markTrusted(e){try{if(!e||e.isTrusted!==false)lastTrustedAt=Date.now();window.__gaLastTrustedUiActionV05418DJ=lastTrustedAt;}catch(x){}}
  document.addEventListener('click',markTrusted,true);
  document.addEventListener('keydown',markTrusted,true);
  document.addEventListener('pointerdown',markTrusted,true);
  function recentTrusted(ms){return Date.now()-Math.max(lastTrustedAt,Number(window.__gaLastTrustedUiActionV05418DJ||0))<(ms||30000);}
  window.gaRecentTrustedUiActionV05418DJ=recentTrusted;
  function modalAllowList(el){var id=clean(el&&el.id);return /schoolLanding|schoolBoot|globalSearchModal|emulationModalOverlay|portalConfirm|publicCommPrefsModal|ssPasscode|lock|formPickerModal|advancedSchedulingModalV05418AQ|advancedSchedulingModal/i.test(id);}
  function isModal(el){if(!el||!el.classList)return false;var id=clean(el.id);var cls=clean(el.className);if(/modal|overlay|dialog/i.test(id+' '+cls))return true;return false;}
  function closeSuspiciousModal(el){try{if(!el||modalAllowList(el))return;if(!isModal(el))return;if(recentTrusted(30000))return;el.classList.remove('active','open','show');if(el.style&&/block|flex|grid/i.test(el.style.display||''))el.style.display='none';console.warn('Support Schedules modal guard blocked a non-local modal open:',el.id||el.className);msg('A modal was blocked because it was not opened by this browser tab. Refresh if you intended to open it.','warn');}catch(e){} }
  function scanModals(){try{Array.prototype.slice.call(document.querySelectorAll('.modal.active,.modal.show,.modal.open,[id*="Modal"].active,[id*="modal"].active,[role="dialog"]')).forEach(closeSuspiciousModal);}catch(e){}}
  if(typeof MutationObserver!=='undefined'){
    var mo=new MutationObserver(function(muts){var should=false;muts.forEach(function(m){if(m.type==='attributes'&&(m.attributeName==='class'||m.attributeName==='style'))should=true;if(m.addedNodes&&m.addedNodes.length)should=true;});if(should)setTimeout(scanModals,0);});
    try{mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});}catch(e){}
  }
  setTimeout(scanModals,1200);

  // Harden Advanced Scheduling specifically: it should only open from a trusted click in
  // this tab. This prevents any stale/synthetic cross-session open behavior.
  function wrapAdvanced(name){try{var fn=window[name];if(typeof fn!=='function'||fn.__gaV05418DJWrapped)return;var wrapped=function(ev){if(ev&&ev.isTrusted!==false)markTrusted(ev);if(!recentTrusted(30000)){console.warn('Blocked non-local advanced scheduling open:',name);return false;}return fn.apply(this,arguments);};wrapped.__gaV05418DJWrapped=true;window[name]=wrapped;try{eval(name+'=window[name]');}catch(e){}}catch(e2){}}
  function wrapKnown(){['openAdvancedSchedulingV05418Z','openAdvancedSchedulingV05418AB','openAdvancedSchedulingV05418AA','openAdvancedSchedulingV05418AQ'].forEach(wrapAdvanced);}
  wrapKnown();setTimeout(wrapKnown,500);setTimeout(wrapKnown,1500);
})();

/* ===== END ga-redis-v05418dj-school-session-modal-guard.js ===== */

/* ===== BEGIN ga-redis-v05418dk-school-data-dashboard-period-guard.js ===== */
(function(){
  if(window.__GA_V05418DK_SCHOOL_DATA_DASHBOARD_PERIOD_GUARD__)return;
  window.__GA_V05418DK_SCHOOL_DATA_DASHBOARD_PERIOD_GUARD__=true;
  var VERSION='v05418dk';
  function clean(v){return String(v==null?'':v).trim();}
  function lower(v){return clean(v).toLowerCase();}
  function by(id){return document.getElementById(id);}
  function schoolPayload(){
    try{if(typeof window.selectedSchoolPayloadForRedisV05418DJ==='function'){var p=window.selectedSchoolPayloadForRedisV05418DJ()||{};if(p.campusId||p.schoolId||p.school||p.spreadsheetId)return p;}}catch(e){}
    try{var sel=by('campusSelector');var opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;if(sel&&clean(sel.value)){var ss=opt&&(opt.getAttribute('data-spreadsheet-id')||opt.getAttribute('data-ss-id')||'');var nm=opt&&(opt.getAttribute('data-campus-name')||opt.getAttribute('data-school-name')||opt.textContent||'');return {school:sel.value,schoolId:sel.value,campusId:sel.value,campusName:nm,schoolName:nm,spreadsheetId:ss,selectedSpreadsheetId:ss};}}catch(e2){}
    return {};
  }
  function scopeOf(obj){return (obj&&(obj.schoolScope||obj.guard||obj._schoolScope))||{};}
  function matches(obj){
    if(!obj||typeof obj!=='object')return true;
    var scope=scopeOf(obj); if(!scope||(!scope.campusId&&!scope.schoolId&&!scope.school&&!scope.spreadsheetId&&!scope.selectedSpreadsheetId))return true;
    var p=schoolPayload();
    var pc=lower(p.campusId||p.schoolId||p.school||p.selectedCampusId||'');
    var ps=lower(p.spreadsheetId||p.selectedSpreadsheetId||'');
    var sc=lower(scope.campusId||scope.schoolId||scope.school||scope.selectedCampusId||'');
    var ss=lower(scope.spreadsheetId||scope.selectedSpreadsheetId||'');
    if(pc&&sc&&pc!==sc)return false;
    if(ps&&ss&&ps!==ss)return false;
    return true;
  }
  function msg(text,type){try{if(typeof setMsg==='function')setMsg(text,type||'warn');}catch(e){}}
  function clearDashboardPaint(){
    try{window.dashboardSummary=null;dashboardSummary=null;}catch(e){}
    try{window.scheduleNowData=null;scheduleNowData=null;}catch(e2){}
    try{window.todoItemsData=[];todoItemsData=[];}catch(e3){}
    ['dashAbsences','dashUnassigned','dashFreeTime','dashDataUpdates','dashWarnings','scheduleNowBox','todoList'].forEach(function(id){var el=by(id);if(el)el.innerHTML='<div class="muted">No selected-school data loaded.</div>';});
  }
  function clearSchoolScopedSessionCaches(){
    try{for(var i=sessionStorage.length-1;i>=0;i--){var k=sessionStorage.key(i)||'';if(/Dash|Dashboard|ScheduleNow|Todo|Student|Staff|ScheduleViews|Period|period|v5444|v5443|v5380|v5195|v686m20/i.test(k))sessionStorage.removeItem(k);}}catch(e){}
    try{if(typeof v5268CacheClear==='function'){v5268CacheClear('dashboard');v5268CacheClear('students');v5268CacheClear('staff');v5268CacheClear('scheduleViews');}}catch(e2){}
  }
  var baseRenderDashboard=typeof window.renderDashboardSummary==='function'?window.renderDashboardSummary:null;
  if(baseRenderDashboard&&!baseRenderDashboard.__v05418dkGuarded){
    var wrapped=function(){
      try{var d=window.dashboardSummary||dashboardSummary;if(d&&!matches(d)){clearDashboardPaint();msg('Dashboard data from another school was blocked. Refreshing selected school data.','err');return false;}}catch(e){}
      return baseRenderDashboard.apply(this,arguments);
    };
    wrapped.__v05418dkGuarded=true;window.renderDashboardSummary=wrapped;try{renderDashboardSummary=wrapped;}catch(e){}
  }
  var baseRenderNow=typeof window.renderScheduleNow==='function'?window.renderScheduleNow:null;
  if(baseRenderNow&&!baseRenderNow.__v05418dkGuarded){
    var wrappedNow=function(){try{var d=window.scheduleNowData||scheduleNowData;if(d&&!matches(d)){var el=by('scheduleNowBox');if(el)el.innerHTML='<div class="muted">Current schedule data was blocked because it belonged to another school.</div>';return false;}}catch(e){}return baseRenderNow.apply(this,arguments);};
    wrappedNow.__v05418dkGuarded=true;window.renderScheduleNow=wrappedNow;try{renderScheduleNow=wrappedNow;}catch(e){}
  }
  document.addEventListener('change',function(e){var t=e&&e.target;if(t&&t.id==='campusSelector'){clearSchoolScopedSessionCaches();clearDashboardPaint();try{if(window.gaV05418aiPeriodDiag&&typeof window.gaV05418aiPeriodDiag==='function'){} }catch(x){}}},true);
  window.gaV05418DKSchoolGuardDiag=function(){return {version:VERSION,school:schoolPayload(),dashboardScope:scopeOf(window.dashboardSummary||{}),scheduleNowScope:scopeOf(window.scheduleNowData||{}),dashboardMatches:matches(window.dashboardSummary||{})};};
})();

/* ===== END ga-redis-v05418dk-school-data-dashboard-period-guard.js ===== */

/* ===== BEGIN ga-redis-v05418dt-admin-page-polish.js ===== */
/* Support Schedules v05418dt: Agency Manager title/header polish and Security label fallback. */
(function(){
  'use strict';
  if(window.__GA_V05418DT_ADMIN_POLISH__) return;
  window.__GA_V05418DT_ADMIN_POLISH__ = true;
  function by(id){return document.getElementById(id);}
  function activePage(){try{if(typeof window.activeSectionIdV51229==='function')return window.activeSectionIdV51229()||'';}catch(e){}var s=document.querySelector('.section.active');return s?s.id:'';}
  function setAgencyTitle(){
    var page=activePage();
    var sec=by('agencyManager');
    var visible=sec && sec.classList && sec.classList.contains('active');
    if(page==='agencyManager' || visible){
      var pt=by('pageTitle');
      if(pt && String(pt.textContent||'').trim()!=='Agency Manager') pt.textContent='Agency Manager';
      document.title='Agency Manager - Support Schedules';
      try{document.querySelectorAll('#agencyManager .managerTitleRow h2').forEach(function(h){h.remove();});}catch(e){}
    }
  }
  function fixSecurityLabels(){
    try{
      document.querySelectorAll('.securityTableV05422 th').forEach(function(th){
        if(String(th.textContent||'').trim()==='Portal / App Access') th.textContent='Portal / App Access via QR';
      });
      document.querySelectorAll('.securityStatLabelV05422').forEach(function(el){
        var txt=String(el.childNodes && el.childNodes[0] ? el.childNodes[0].nodeValue || '' : '').trim();
        if(txt==='Portal / App Access') el.childNodes[0].nodeValue='Portal / App Access via QR ';
      });
    }catch(e){}
  }
  document.addEventListener('click',function(e){
    var t=e.target && e.target.closest && e.target.closest('[data-nav="agencyManager"],[data-nav="securityManager"]');
    if(!t) return;
    setTimeout(function(){setAgencyTitle();fixSecurityLabels();},40);
    setTimeout(function(){setAgencyTitle();fixSecurityLabels();},240);
  },true);
  try{if(typeof window.registerNavigationAfterHookV5_==='function')window.registerNavigationAfterHookV5_(function(page){if(page==='agencyManager')setTimeout(setAgencyTitle,40); if(page==='securityManager')setTimeout(fixSecurityLabels,120);},'v05418dtAdminPolish');}catch(e){}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){setAgencyTitle();fixSecurityLabels();},80);});
  else setTimeout(function(){setAgencyTitle();fixSecurityLabels();},80);
  window.gaV05418DTAdminPolish=function(){setAgencyTitle();fixSecurityLabels();return {version:'v05418dt',activePage:activePage(),title:(by('pageTitle')||{}).textContent||'',agencyActive:!!(by('agencyManager')&&by('agencyManager').classList.contains('active'))};};
})();

/* ===== END ga-redis-v05418dt-admin-page-polish.js ===== */

/* ===== BEGIN ga-redis-v05418dv-schedule-display-formatting.js ===== */
(function(){
  if(window.__v05418DVScheduleDisplayFormattingInstalled)return;
  window.__v05418DVScheduleDisplayFormattingInstalled=true;
  var VERSION='v05418dw';
  function by(id){return document.getElementById(id);} 
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function clean(v){return String(v==null?'':v).trim();}
  function norm(v){return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
  function stripTwo(v){return clean(v).replace(/\s*\(\s*2\s*:\s*1\s+support\s*\)\s*$/i,'').trim();}
  function isTwo(row){row=row||{};var s=[row.support,row.supportType,row.supportRaw,row.name,row.student,row.displayName].map(clean).join(' ');return !!(row.isTwoToOne||row.twoToOneSupport||/2\s*:\s*1/i.test(s));}
  function fmtMinutes(m){m=Number(m);if(!isFinite(m))return'';var h=Math.floor(m/60),mi=m%60,ap=h>=12?'PM':'AM',hh=h%12;if(!hh)hh=12;return hh+':'+String(mi).padStart(2,'0')+' '+ap;}
  function splitLabel(row){row=row||{};var cap=clean(row.splitWindowCaption||row.splitCaption||'');var raw=clean(row.splitWindowLabel||row.splitLabel||row.splitTimeLabel||row.splitTime||row.splitWindow||row.supportWindow||row.timeWindow||'');if(cap&&raw)return cap+' · '+raw;if(cap)return cap;if(raw&&raw!=='-'&&raw!=='(-)')return raw;var s=row.splitStartMinutes!=null&&row.splitStartMinutes!==''?Number(row.splitStartMinutes):null;var e=row.splitEndMinutes!=null&&row.splitEndMinutes!==''?Number(row.splitEndMinutes):null;var a=Number.isFinite(s)?fmtMinutes(s):'',b=Number.isFinite(e)?fmtMinutes(e):'';if(a&&b)return a+' - '+b;if(b)return 'Until '+b;if(a)return 'After '+a;return '';}
  function supportLabel(row){row=row||{};var raw=clean(row.support||row.supportType||row.supportRaw||''); if(/2\s*:\s*1/i.test(raw))raw='2:1 Support'; raw=raw.replace(/\s*-\s*(first|second)\s+staff\s*$/i,'').replace(/\s*\(\s*split-period\s*\)\s*/ig,'').trim(); var sp=splitLabel(row); if(sp && !/\b(?:starting|until|\d{1,2}:?\d{0,2}\s*(?:am|pm))\b/i.test(raw)) raw+=(raw?' ':'')+'('+sp+')'; return raw;}
  function studentLabel(st){st=st||{};var base=clean(st.baseName||st.displayName||st.student||st.name||'');base=stripTwo(base);var out=base;var sp=splitLabel(st);if(sp)out+=' ('+sp+')';if(isTwo(st))out+=' (2:1 support)';return out;}
  function staffNames(row){row=row||{};var arr=[];function add(v){clean(v).split(/\s*\/\s*|\s*,\s*/).forEach(function(x){x=clean(x);if(x&&!arr.some(function(y){return norm(y)===norm(x);})){arr.push(x);}});} if(Array.isArray(row.twoToOneStaffNames))row.twoToOneStaffNames.forEach(add);add(row.staff);add(row.staff2);add(row.secondStaff);add(row.primary2);add(row.secondary2);return arr.filter(Boolean);}
  function rowKey(period, student){return norm(period)+'||'+norm(stripTwo(student));}
  function rowMap(rows){var m={};(rows||[]).forEach(function(r){m[clean(r.period||r.label||r.title||r.item)]=r;});return m;}
  function enhanceViews(data){data=data||{};var info={};function inf(p,s){var k=rowKey(p,s);if(!info[k])info[k]={staff:[],two:false,split:''};return info[k];}
    (data.staffSchedules||[]).forEach(function(sr){(sr.rows||[]).forEach(function(r){var p=clean(r.period||r.label||r.title);(r.students||[]).forEach(function(st){var name=stripTwo(st.baseName||st.name||st.student||'');if(!name)return;var x=inf(p,name);if(sr.staff&&!x.staff.some(function(y){return norm(y)===norm(sr.staff);})){x.staff.push(sr.staff);} if(isTwo(st)||isTwo(r))x.two=true;var sp=splitLabel(st)||splitLabel(r);if(sp)x.split=sp;});});});
    (data.studentSchedules||[]).forEach(function(row){var stu=clean(row.student||row.name);(row.rows||[]).forEach(function(r){var p=clean(r.period||r.label||r.title);var x=inf(p,stu);staffNames(r).forEach(function(s){if(s&&!x.staff.some(function(y){return norm(y)===norm(s);})){x.staff.push(s);}});if(isTwo(r))x.two=true;var sp=splitLabel(r);if(sp)x.split=sp;});});
    (data.studentSchedules||[]).forEach(function(row){var stu=clean(row.student||row.name);(row.rows||[]).forEach(function(r){var p=clean(r.period||r.label||r.title);var x=info[rowKey(p,stu)]||{};if(x.two||isTwo(r)){r.isTwoToOne=true;r.twoToOneStaffNames=(x.staff&&x.staff.length?x.staff:staffNames(r));if(r.twoToOneStaffNames.length>=2)r.staff=r.twoToOneStaffNames.join(' / ');r.support='2:1 Support';}if(x.split&&!splitLabel(r))r.splitWindowLabel=x.split;});});
    (data.staffSchedules||[]).forEach(function(sr){(sr.rows||[]).forEach(function(r){var p=clean(r.period||r.label||r.title);(r.students||[]).forEach(function(st){var base=stripTwo(st.baseName||st.name||st.student||'');var x=info[rowKey(p,base)]||{};if(x.two||isTwo(st)){st.isTwoToOne=true;st.twoToOneSupport=true;st.baseName=base;st.displayName=base;st.support='2:1 Support';}if(x.split&&!splitLabel(st))st.splitWindowLabel=x.split;});});});
    return data;
  }
  function groupedStudents(students,fallbackLocation){students=students||[];if(!students.length)return '';var groups=[];students.forEach(function(st){var loc=clean(st.location||fallbackLocation||'');var key=loc||'__no_room__';var g=groups.find(function(x){return x.key===key;});if(!g){g={key:key,location:loc,students:[]};groups.push(g);}g.students.push(st);});groups.sort(function(a,b){return String(a.location||'').localeCompare(String(b.location||''));});return groups.map(function(g){return '<div class="studentRoomGroup">'+g.students.map(function(st){return esc(studentLabel(st));}).join('<br>')+(g.location?'<div class="dashMeta">'+esc(g.location)+'</div>':'')+'</div>';}).join('');}
  function freeStaff(r,data){try{if(typeof freeStaffHtml==='function')return freeStaffHtml(r,data);}catch(e){}return '<span class="empty">Support '+esc((data&&data.unassignedSupportLocation)||'')+'</span>';}
  function itemsFor(data,rows){var items=(data&&data.items)||[];if(items.length)return items;if(rows&&rows.length&&rows[0].rows)return (rows[0].rows||[]).map(function(r){return {label:r.period||r.title,title:r.title||r.period};});return [];}
  function renderStaffSchedulesDV(){var el=by('staffSchedulesTable');if(!el)return;var data=enhanceViews(window.scheduleViewsData||{});var rows=data.staffSchedules||[];var items=itemsFor(data,rows);if(!rows.length){el.innerHTML='<p class="muted">No staff schedules.</p>';return;}var th=items.map(function(it){return '<th>'+esc(it.title||it.label)+'</th>';}).join('');var body=rows.map(function(s){var map=rowMap(s.rows||[]);return '<tr><td><b>'+esc(s.staff||s.name||'')+'</b></td>'+items.map(function(it){var r=map[clean(it.label||it.title)]||{};var rest=(r.restEvents||[]).map(function(ev){try{if(typeof renderRestEvent==='function')return renderRestEvent(ev);}catch(e){}return ev&&ev.time?'<div class="restEvent">'+esc(ev.time)+'</div>':'';}).join('');var students=r.hideAssignmentForDesignatedRest?'':groupedStudents(r.students||[],r.location);var hasCover=(r.restEvents||[]).some(function(ev){return ev&&ev.role==='cover';});var hasOwn=(r.restEvents||[]).some(function(ev){return ev&&ev.role==='break';});var cls=hasCover?' class="coverCell"':(hasOwn?' class="restCell"':'');return '<td'+cls+'>'+(students||(!rest?freeStaff(r,data):''))+rest+'</td>';}).join('')+'</tr>';}).join('');el.innerHTML='<table class="scheduleGridTable wide"><thead><tr><th>Staff</th>'+th+'</tr></thead><tbody>'+body+'</tbody></table>';}
  function studentCell(r){r=r||{};var names=staffNames(r);var support=supportLabel(r);var location=clean(r.location||'');var sNorm=clean(support).toUpperCase(), lNorm=location.toUpperCase();var noSupport=!support||sNorm==='N/A'||sNorm==='NA'||sNorm==='NONE'||/^NO SUPPORT/i.test(sNorm);var noLoc=!location||lNorm==='N/A'||lNorm==='NA';var hasNeed=!noSupport&&!noLoc;var top=names.length?esc(names.join(' / ')):(r.allowedUnstaffed?'<span class="scheduleNoNeed">Allowed unstaffed (Optimization)</span>':(hasNeed?'<span class="scheduleNeed">Needs support - unassigned</span>':'<span class="scheduleNoNeed">No support needed</span>'));var meta=[];if(!noLoc)meta.push(location);if(!noSupport)meta.push(support);return top+(meta.length?'<div class="dashMeta">'+esc(meta.join(' · '))+'</div>':'');}
  function renderStudentSchedulesDV(){var el=by('studentSchedulesTable');if(!el)return;var data=enhanceViews(window.scheduleViewsData||{});var rows=data.studentSchedules||[];var items=itemsFor(data,rows);if(!rows.length){el.innerHTML='<p class="muted">No student schedules.</p>';return;}var th=items.map(function(it){return '<th>'+esc(it.title||it.label)+'</th>';}).join('');var body=rows.map(function(st){var map=rowMap(st.rows||[]);return '<tr><td>'+esc(st.student||st.name||'')+'</td>'+items.map(function(it){var r=map[clean(it.label||it.title)]||{};return '<td>'+studentCell(r)+'</td>';}).join('')+'</tr>';}).join('');el.innerHTML='<table class="scheduleGridTable wide"><thead><tr><th>Student</th>'+th+'</tr></thead><tbody>'+body+'</tbody></table>';}
  var oldRenderViews=window.renderScheduleViews;
  window.renderStaffSchedules=renderStaffSchedulesDV; window.renderStudentSchedules=renderStudentSchedulesDV;
  window.renderScheduleViews=function(opts){var page=(opts&&opts.page)||'';try{var active=document.querySelector('.section.active');if(!page&&active)page=active.id;}catch(e){}if(page==='staffSchedules'){renderStaffSchedulesDV();return;}if(page==='studentSchedules'){renderStudentSchedulesDV();return;}if(oldRenderViews)return oldRenderViews.apply(this,arguments);};
  try{renderStaffSchedules=window.renderStaffSchedules;renderStudentSchedules=window.renderStudentSchedules;renderScheduleViews=window.renderScheduleViews;}catch(e){}
  var oldNow=window.renderScheduleNow||((typeof renderScheduleNow==='function')?renderScheduleNow:null);
  window.renderScheduleNow=function(){var el=by('scheduleNowBox');if(!el){if(oldNow)return oldNow.apply(this,arguments);return;}var d=window.scheduleNowData||((typeof scheduleNowData!=='undefined')?scheduleNowData:null)||{};var mode=(typeof scheduleNowMode!=='undefined'?scheduleNowMode:(sessionStorage.getItem('v5ScheduleNowMode')||'students'));var rows=(mode==='staff'?d.staffRows:d.studentRows)||[];var titleEl=by('scheduleNowTitle');if(titleEl)titleEl.innerHTML='<span class="nowLabel">Now:</span> <span class="nowItem">'+esc(d.itemTitle||d.item||'Schedule')+'</span>';if(by('scheduleNowClock'))by('scheduleNowClock').textContent=d.timeLabel||'';var tog=by('scheduleNowHeaderToggle');if(tog)tog.innerHTML='<div class="scheduleNowToggle"><button data-action="schedule-now-mode" data-mode="students" class="'+(mode==='students'?'active':'')+'">Students</button><button data-action="schedule-now-mode" data-mode="staff" class="'+(mode==='staff'?'active':'')+'">Staff</button></div>';var next=d.nextLabel?'<div class="nowSub">Next: '+esc(d.nextLabel)+'</div>':'';if(!rows.length){el.innerHTML=next+'<div class="muted">No current schedule data.</div>';return;}if(mode==='staff'){el.innerHTML=next+rows.map(function(r){var status=clean(r.status||'').split(' / ').join('<br>');var detail=esc(r.detail||'');return '<div class="nowRow"><strong>'+esc(r.staff||'')+'</strong><span>'+status+'</span><span class="nowLocation">'+detail+'</span></div>';}).join('');}else{el.innerHTML=next+rows.map(function(r){var sup=supportLabel(r);var loc=esc(r.location||'');var covered=esc(clean(r.coveredBy||'')||'No support needed');var covClass=String(r.coveredBy||'').toLowerCase().indexOf('needs support')>=0?' class="nowUnassigned"':'';return '<div class="nowRow studentsNow"><strong>'+((typeof studentAnchor==='function')?studentAnchor({name:r.student,url:r.url}):esc(r.student||''))+'</strong><span>'+loc+(sup?' · '+esc(sup):'')+'</span><span'+covClass+'>'+covered+'</span></div>';}).join('');}};
  try{renderScheduleNow=window.renderScheduleNow;}catch(e){}
})();

/* ===== END ga-redis-v05418dv-schedule-display-formatting.js ===== */

/* ===== BEGIN ga-redis-v05418dw-schedule-clarity-admin-app.js ===== */
(function(){
  if(window.__v05418DWScheduleClarityInstalled)return;
  window.__v05418DWScheduleClarityInstalled=true;
  var VERSION='v05418dw';
  function clean(v){return String(v==null?'':v).trim();}
  function norm(v){return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function fmtMinutes(m){m=Number(m);if(!isFinite(m))return'';var h=Math.floor(m/60),mi=m%60,ap=h>=12?'PM':'AM',hh=h%12;if(!hh)hh=12;return hh+':'+String(mi).padStart(2,'0')+' '+ap;}
  function splitLabel(row){
    row=row||{};
    var cap=clean(row.splitWindowCaption||row.splitCaption||'');
    var raw=clean(row.splitWindowLabel||row.splitLabel||row.splitTimeLabel||row.splitTime||row.splitWindow||row.supportWindow||row.timeWindow||'');
    if(cap&&raw)return cap+' · '+raw;
    if(cap)return cap;
    if(raw && raw!=='-' && raw!=='(-)')return raw;
    var s=row.splitStartMinutes!=null&&row.splitStartMinutes!==''?Number(row.splitStartMinutes):null;
    var e=row.splitEndMinutes!=null&&row.splitEndMinutes!==''?Number(row.splitEndMinutes):null;
    var a=Number.isFinite(s)?fmtMinutes(s):'', b=Number.isFinite(e)?fmtMinutes(e):'';
    if(a&&b)return a+' - '+b;
    if(b)return 'Until '+b;
    if(a)return 'After '+a;
    return '';
  }
  function supportLabel(row){row=row||{};var raw=clean(row.support||row.supportType||row.supportRaw||'');if(/2\s*:\s*1/i.test(raw))raw='2:1 Support';raw=raw.replace(/\s*-\s*(first|second)\s+staff\s*$/i,'').replace(/\s*\(\s*split-period\s*\)\s*/ig,'').trim();var sp=splitLabel(row);if(sp&&raw&&!/\([^)]*(?:until|after|\d{1,2}:\d{2})/i.test(raw))raw+=' ('+sp+')';return raw;}
  function baseStudent(v){return clean(v).replace(/\s*\(\s*2\s*:\s*1\s+support\s*\)\s*$/i,'').trim();}
  function studentLabel(st){st=st||{};var label=baseStudent(st.baseName||st.displayName||st.student||st.name||'');var sp=splitLabel(st);if(sp)label+=' ('+sp+')';if(st.isTwoToOne||st.twoToOneSupport||/2\s*:\s*1/i.test(clean(st.support||st.name||'')))label+=' (2:1 support)';return label;}
  function splitNames(v){return clean(v).split(/\s*\/\s*|\s*,\s*/).map(clean).filter(Boolean);}
  function unique(arr,v){v=clean(v);if(v&&!arr.some(function(x){return norm(x)===norm(v);})){arr.push(v);}}
  function staffNames(row){row=row||{};var arr=[];(Array.isArray(row.twoToOneStaffNames)?row.twoToOneStaffNames:[]).forEach(function(v){splitNames(v).forEach(function(x){unique(arr,x);});});['staff','staff2','secondStaff','primary2','secondary2'].forEach(function(k){splitNames(row[k]).forEach(function(x){unique(arr,x);});});return arr;}
  function patchRenderNow(){
    var old=window.renderScheduleNow;
    window.renderScheduleNow=function(){
      var d=window.scheduleNowData||((typeof scheduleNowData!=='undefined')?scheduleNowData:null)||{};
      var noCurrent=(!d.item&&!d.itemTitle)||((d.staffRows||[]).length===0&&(d.studentRows||[]).length===0)||/outside|no current|not in/i.test(clean(d.status||d.unavailableReason||''));
      if(noCurrent){var el=document.getElementById('scheduleNowBox');if(el){var t=document.getElementById('scheduleNowTitle');if(t)t.innerHTML='<span class="nowLabel">Now:</span> <span class="nowItem">No active schedule block</span>';el.innerHTML='<div class="muted">No published schedule is currently active.</div>';return;}}
      if(typeof old==='function')return old.apply(this,arguments);
    };
    try{renderScheduleNow=window.renderScheduleNow;}catch(e){}
  }
  function patchStudentCell(){
    try{
      if(typeof window.studentCellHtmlV686m13_==='function'){
        window.studentCellHtmlV686m13_=function(r){r=r||{};var names=staffNames(r), support=supportLabel(r), loc=clean(r.location||'');var noSupport=!support||/^(n\/?a|na|none|no support needed)$/i.test(support);var noLoc=!loc||/^(n\/?a|na)$/i.test(loc);var hasNeed=!noSupport&&!noLoc;var top=names.length?esc(names.join(' / ')):(r.allowedUnstaffed?'<span class="scheduleNoNeed">Allowed unstaffed</span>':(hasNeed?'<span class="scheduleNeed">Needs support - unassigned</span>':'<span class="scheduleNoNeed">No support needed</span>'));var meta=[];if(!noLoc)meta.push(loc);if(!noSupport)meta.push(support);return top+(meta.length?'<div class="dashMeta">'+esc(meta.join(' · '))+'</div>':'');};
        try{studentCellHtmlV686m13_=window.studentCellHtmlV686m13_;}catch(e){}
      }
    }catch(e){}
  }
  patchRenderNow();patchStudentCell();
  window.gaV05418DWScheduleDisplayDiag=function(){return{version:VERSION,now:window.scheduleNowData||null};};
})();

/* ===== END ga-redis-v05418dw-schedule-clarity-admin-app.js ===== */

/* ===== BEGIN ga-redis-v05418ed-split-period-admin-display.js ===== */
(function(){
  if(window.__V05418ED_SPLIT_PERIOD_ADMIN_DISPLAY__) return;
  window.__V05418ED_SPLIT_PERIOD_ADMIN_DISPLAY__ = true;
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
  function esc(v){ try{ if(typeof window.esc === 'function') return window.esc(v); }catch(e){} return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;}); }
  function num(v){ if(v === 0) return 0; if(v == null || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function fmt(m){ m = Number(m); if(!isFinite(m)) return ''; var h=Math.floor(m/60), mi=m%60, ap=h>=12?'PM':'AM', hh=h%12; if(!hh)hh=12; return hh+':'+String(mi).padStart(2,'0')+' '+ap; }
  function range(s,e){ return fmt(s)+' - '+fmt(e); }
  function splitLabel(o){ o=o||{}; var cap=clean(o.splitWindowCaption||o.splitCaption||''); var raw=clean(o.splitWindowLabel||o.splitLabel||o.splitTimeLabel||o.supportWindow||o.timeWindow||''); if(cap&&raw)return cap+' · '+raw; if(cap)return cap; if(raw) return raw; var s=num(o.splitStartMinutes), e=num(o.splitEndMinutes); return (s!=null&&e!=null&&e>s)?range(s,e):''; }
  function itemMap(data){ var map=Object.create(null); (data.items||[]).forEach(function(it){ [it.key,it.label,it.period,it.item,it.title,it.displayName].forEach(function(k){ k=clean(k); if(k) map[norm(k)] = it; }); }); return map; }
  function addRowTimes(data){ data=data||{}; var map=itemMap(data); function add(r){ r=r||{}; var it=map[norm(r.period||r.label||r.title||r.item)]; if(!it) return r; var s=num(it.startMinutes), e=num(it.endMinutes); if(s!=null&&e!=null&&e>s){ r.startMinutes=s; r.endMinutes=e; r.timeLabel=r.timeLabel||range(s,e); } return r; } (data.staffSchedules||[]).forEach(function(sr){ (sr.rows||[]).forEach(add); }); (data.studentSchedules||[]).forEach(function(st){ (st.rows||[]).forEach(add); }); return data; }
  function mergeIntervals(arr){ arr=(arr||[]).filter(function(x){return x&&x.start!=null&&x.end!=null&&x.end>x.start;}).sort(function(a,b){return a.start-b.start||a.end-b.end;}); var out=[]; arr.forEach(function(x){ if(!out.length||x.start>out[out.length-1].end) out.push({start:x.start,end:x.end}); else out[out.length-1].end=Math.max(out[out.length-1].end,x.end); }); return out; }
  function freeSegments(row,busy){ var ps=num(row&&row.startMinutes), pe=num(row&&row.endMinutes); if(ps==null||pe==null||pe<=ps) return []; var cur=ps,out=[]; mergeIntervals(busy).forEach(function(b){ if(b.start>cur) out.push({start:cur,end:b.start}); cur=Math.max(cur,b.end); }); if(cur<pe) out.push({start:cur,end:pe}); return out.filter(function(x){return x.end>x.start;}); }
  var baseStudentAnchor = window.studentAnchor;
  window.studentAnchor = function(o){
    o=o||{}; var sp=splitLabel(o); var name=clean(o.displayName||o.baseName||o.name||o.student||String(o||'')); if(sp && name.indexOf(sp)<0) name += ' ('+sp+')'; var copy={}; try{ Object.keys(o).forEach(function(k){copy[k]=o[k];}); }catch(e){} copy.name=name; copy.student=name; if(typeof baseStudentAnchor === 'function') return baseStudentAnchor(copy); return esc(name);
  };
  function roomSort(v){ try{ if(typeof window.roomSortKey === 'function') return window.roomSortKey(v); }catch(e){} return String(v||''); }
  function groupedStudents(students,fallbackLocation){ students=students||[]; if(!students.length) return ''; var groups=Object.create(null), order=[]; students.forEach(function(st){ var loc=clean((st&&st.location)||fallbackLocation||''); var key=loc||'__no_room__'; if(!groups[key]){ groups[key]={key:key,location:loc,students:[]}; order.push(groups[key]); } groups[key].students.push(st); }); order.sort(function(a,b){return roomSort(a.location).localeCompare(roomSort(b.location));}); return order.map(function(g){ var names=g.students.map(window.studentAnchor).join('<br>'); return '<div class="studentRoomGroup">'+names+(g.location?'<div class="dashMeta">'+esc(g.location)+'</div>':'')+'</div>'; }).join(''); }
  function renderRest(ev){ try{ if(typeof window.renderRestEvent === 'function') return window.renderRestEvent(ev); }catch(e){} ev=ev||{}; return '<div class="restEvent">'+esc([ev.time, ev.type].filter(Boolean).join(' · '))+'</div>'; }
  function freeText(r,data){ try{ if(typeof window.freeStaffHtml === 'function') return window.freeStaffHtml(r,data); }catch(e){} var loc=clean((data&&data.unassignedSupportLocation)||''); return '<span class="empty">'+esc(loc?('Support '+loc):'Free')+'</span>'; }
  function splitStaffCell(r,data){
    r=r||{}; var students=r.students||[], restEvents=r.restEvents||[], rest=restEvents.map(renderRest).join('');
    if(r.hideAssignmentForDesignatedRest) return rest;
    var splitStudents=students.filter(function(st){return !!splitLabel(st);});
    var allSplit=students.length && splitStudents.length===students.length && num(r.startMinutes)!=null && num(r.endMinutes)!=null;
    if(allSplit){
      var busy=[];
      var support=splitStudents.map(function(st){ var s=num(st.splitStartMinutes), e=num(st.splitEndMinutes); if(s==null||e==null||e<=s) return ''; busy.push({start:s,end:e}); var loc=clean(st.location||r.location||''); return '<div class="studentRoomGroup splitSupportBlock"><b>'+esc(range(s,e))+'</b><br>'+window.studentAnchor(st)+(loc?'<div class="dashMeta">'+esc(loc)+'</div>':'')+'</div>'; }).join('');
      var free = rest ? '' : freeSegments(r,busy).map(function(f){return '<div class="free splitFreeBlock"><b>'+esc(range(f.start,f.end))+'</b><br>Free</div>';}).join('');
      return support + free + rest;
    }
    var studentsHtml=students.length?groupedStudents(students,r.location):'';
    return (studentsHtml || (!rest ? freeText(r,data) : '')) + rest;
  }
  function rowMap(rows){ var map=Object.create(null); (rows||[]).forEach(function(r){ var keys=[r.period,r.label,r.title,r.item].map(clean).filter(Boolean); keys.forEach(function(k){map[norm(k)]=r;}); }); return map; }
  function activePage(){ var el=document.querySelector('.section.active'); return el?el.id:''; }
  function setHtml(id,html){ var el=document.getElementById(id); if(el) el.innerHTML=html; }
  function itemTitle(it){ return clean((it&&typeof it==='object')?(it.title||it.displayName||it.label||it.key):it); }
  function itemKey(it){ return clean((it&&typeof it==='object')?(it.label||it.key||it.period||it.item||it.title):it); }
  function itemsFrom(data,rows){ var items=(data&&data.items)||[]; if(items.length) return items; var first=rows&&rows[0]&&rows[0].rows||[]; return first.map(function(r){return {label:r.period,title:r.period};}); }
  function renderStaffSchedulesED(){ if(typeof window.loadStaffSchedulesAutoV05418Test==='function'){window.loadStaffSchedulesAutoV05418Test();return;} var data=addRowTimes(window.scheduleViewsData||{}); var rows=data.staffSchedules||[], items=itemsFrom(data,rows); if(!rows.length){ setHtml('staffSchedulesTable','<p class="muted">No staff schedules.</p>'); return; } var th=items.map(function(it){return '<th>'+esc(itemTitle(it))+'</th>';}).join(''); var body=rows.map(function(s){ var map=rowMap(s.rows||[]); return '<tr><td>'+esc(s.staff||s.name||'')+'</td>'+items.map(function(it){ var r=map[norm(itemKey(it))]||map[norm(itemTitle(it))]||{}; var restEvents=r.restEvents||[]; var hasCover=restEvents.some(function(ev){return ev.role==='cover';}); var hasOwnRest=restEvents.some(function(ev){return ev.role==='break';}); var cellClass=hasCover?' class="coverCell"':(hasOwnRest?' class="restCell"':''); return '<td'+cellClass+'>'+splitStaffCell(r,data)+'</td>'; }).join('')+'</tr>'; }).join(''); setHtml('staffSchedulesTable','<table class="scheduleGridTable wide"><thead><tr><th>Staff</th>'+th+'</tr></thead><tbody>'+body+'</tbody></table>'); }
  function renderStudentSchedulesED(){ var data=addRowTimes(window.scheduleViewsData||{}); var rows=data.studentSchedules||[], items=itemsFrom(data,rows); if(!rows.length){ setHtml('studentSchedulesTable','<p class="muted">No student schedules.</p>'); return; } var th=items.map(function(it){return '<th>'+esc(itemTitle(it))+'</th>';}).join(''); var body=rows.map(function(st){ var map=rowMap(st.rows||[]); return '<tr><td>'+window.studentAnchor({name:st.student||st.name,url:st.url})+'</td>'+items.map(function(it){ var r=map[norm(itemKey(it))]||map[norm(itemTitle(it))]||{}; var support=clean(r.support||r.supportType||''); var sp=splitLabel(r); if(sp&&support&&support.indexOf(sp)<0) support+=' ('+sp+')'; var location=clean(r.location||''); var noSupport=!support||/^(n\/?a|na|none|no support needed)$/i.test(support); var noLocation=!location||/^(n\/?a|na)$/i.test(location); var hasNeed=!noSupport&&!noLocation; var names=Array.isArray(r.twoToOneStaffNames)&&r.twoToOneStaffNames.length?r.twoToOneStaffNames.join(' / '):clean(r.staff||''); var top=names?esc(names):(r.allowedUnstaffed?'<span class="scheduleNoNeed">Allowed unstaffed (Optimization)</span>':(hasNeed?'<span class="scheduleNeed">Needs support - unassigned</span>':'<span class="scheduleNoNeed">No support needed</span>')); var meta=(location||support)?'<div class="dashMeta">'+esc([location,support].filter(Boolean).join(' · '))+'</div>':''; return '<td>'+top+meta+'</td>'; }).join('')+'</tr>'; }).join(''); setHtml('studentSchedulesTable','<table class="scheduleGridTable wide"><thead><tr><th>Student</th>'+th+'</tr></thead><tbody>'+body+'</tbody></table>'); }
  var baseRender = window.renderScheduleViews;
  window.renderStaffSchedules = renderStaffSchedulesED;
  window.renderStudentSchedules = renderStudentSchedulesED;
  window.renderScheduleViews = function(opts){ var page=(opts&&opts.page)||activePage(); if(page==='staffSchedules') return renderStaffSchedulesED(); if(page==='studentSchedules') return renderStudentSchedulesED(); if(typeof baseRender==='function') return baseRender.apply(this,arguments); };
  try{ renderStaffSchedules=window.renderStaffSchedules; renderStudentSchedules=window.renderStudentSchedules; renderScheduleViews=window.renderScheduleViews; }catch(e){}
})();

/* ===== END ga-redis-v05418ed-split-period-admin-display.js ===== */

/* ===== BEGIN ga-redis-v05418eo-student-manager-published-header.js ===== */
(function(){
  if(window.__SUPPORT_SCHEDULES_V05418EO_STUDENT_PERSISTENCE__) return;
  window.__SUPPORT_SCHEDULES_V05418EO_STUDENT_PERSISTENCE__ = true;
  var VERSION='0.54.18et';
  var cache={};
  var inflight={};
  var timer=null;
  function by(id){return document.getElementById(id);} 
  function qa(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel));}
  function clean(v){return String(v==null?'':v).trim();}
  function norm(v){return clean(v).toLowerCase().replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/[^a-z0-9:]+/g,' ').replace(/\s+/g,' ').trim();}
  function esc(v){return clean(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function school(){try{if(typeof selectedSchoolPayloadV683==='function'){var p=selectedSchoolPayloadV683()||{};return clean(p.school||p.schoolId||p.campusId||p.id||'');}}catch(e){}try{if(typeof selectedSchoolPayloadV686m20==='function'){var q=selectedSchoolPayloadV686m20()||{};return clean(q.school||q.schoolId||q.campusId||q.id||'');}}catch(e2){}var sel=by('campusSelector');return clean(sel&&sel.value||'');}
  function studentName(){return clean((by('studentName')||{}).value||((window.currentStudent||{}).name)||'');}
  function cacheKey(st){return school()+'||'+norm(st||studentName());}
  function activeStudentRecord(){var nm=studentName();try{var rows=(window.studentData&&window.studentData.students)||[];for(var i=0;i<rows.length;i++){if(norm(rows[i]&&rows[i].name)===norm(nm))return rows[i];}}catch(e){}try{if(window.currentStudent&&norm(currentStudent.name)===norm(nm))return currentStudent;}catch(e2){}return null;}
  function remember(rec){rec=rec||{};var st=clean(rec.student||studentName());if(!st)return rec;cache[cacheKey(st)]=rec;try{var row=activeStudentRecord();if(row)row.advancedScheduling=Object.assign({},row.advancedScheduling||{},rec);if(window.currentStudent)currentStudent.advancedScheduling=Object.assign({},currentStudent.advancedScheduling||{},rec);var rows=(window.studentData&&window.studentData.students)||[];rows.forEach(function(s){if(s&&norm(s.name)===norm(st))s.advancedScheduling=Object.assign({},s.advancedScheduling||{},rec);});}catch(e){}return rec;}
  function localRec(st){st=clean(st||studentName());if(!st)return null;var k=cacheKey(st);if(cache[k])return cache[k];var row=activeStudentRecord();if(row&&row.advancedScheduling)return row.advancedScheduling;try{if(window.currentStudent&&currentStudent.advancedScheduling)return currentStudent.advancedScheduling;}catch(e){}return null;}
  function fetchAdvanced(st,force){st=clean(st||studentName());if(!st)return Promise.resolve(null);var k=cacheKey(st);if(!force&&cache[k])return Promise.resolve(cache[k]);if(inflight[k])return inflight[k];var q=new URLSearchParams();q.set('student',st);var sc=school();if(sc)q.set('school',sc);q.set('_',String(Date.now()));inflight[k]=fetch('/api/v05418x/student-advanced?'+q.toString(),{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json().then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||('HTTP '+r.status));return remember(j.record||{student:st});});}).catch(function(){return localRec(st);}).then(function(rec){delete inflight[k];return rec;},function(err){delete inflight[k];throw err;});return inflight[k];}
  function rowItem(tr){return clean(tr&&tr.getAttribute('data-item')||'');}
  function labelForItem(item){item=clean(item);try{var map=(window.studentData&&studentData.itemLabels)||{};if(map[item])return clean(map[item]);var keys=Object.keys(map);for(var i=0;i<keys.length;i++){if(norm(keys[i])===norm(item)||norm(map[keys[i]])===norm(item))return clean(map[keys[i]]);}}catch(e){}return item;}
  function rowMatches(row,item){var candidates=[row&&row.item,row&&row.period,row&&row.periodValue,row&&row.label,row&&row.displayName,row&&row.title].map(clean).filter(Boolean);var a=norm(item),b=norm(labelForItem(item));return candidates.some(function(c){var n=norm(c);return n===a||n===b;});}
  function splitLabel(row){row=row||{};var cap=clean(row.splitWindowCaption||row.caption||row.splitWindowLabel||row.splitLabel||'');if(cap&&!/^split$/i.test(cap))return cap.replace(/\bminutes\b/ig,'min');var mode=clean(row.mode||row.windowMode||row.type||row.segment||row.position||row.splitWindowMode).toLowerCase();var min=clean(row.minutes||row.duration||row.minuteCount||row.lengthMinutes||row.splitWindowMinutes);if(mode==='first'&&min)return 'First '+min+' min';if(mode==='last'&&min)return 'Last '+min+' min';if(mode==='between'&&min)return 'Between '+min+' min';var s=clean(row.start||row.startTime||''),e=clean(row.end||row.endTime||'');if(s&&e)return s+' - '+e;return '';}
  function ensureOption(sel,value){value=clean(value);if(!sel||!value)return;var matched=false;Array.prototype.slice.call(sel.options||[]).forEach(function(o){if(norm(o.value)===norm(value)){matched=true;o.selected=true;}});if(!matched){var opt=document.createElement('option');opt.value=value;opt.textContent=value;opt.selected=true;sel.appendChild(opt);}try{sel.value=value;}catch(e){}}
  function ensureTwoOption(sel){if(!sel)return;var found=false;Array.prototype.slice.call(sel.options||[]).forEach(function(o){if(o.value==='2:1'||norm(o.textContent)==='2 1')found=true;});if(!found){var opt=document.createElement('option');opt.value='2:1';opt.textContent='2:1';sel.appendChild(opt);}}
  function twoToOneAliases(item){item=clean(item);var out=[],seen={};function add(v){v=clean(v);if(!v)return;var k=norm(v);if(seen[k])return;seen[k]=true;out.push(v);}add(item);add(labelForItem(item));try{var map=(window.studentData&&studentData.itemLabels)||{};Object.keys(map).forEach(function(k){if(norm(k)===norm(item)||norm(map[k])===norm(item)||norm(k)===norm(labelForItem(item))||norm(map[k])===norm(labelForItem(item))){add(k);add(map[k]);}});}catch(e){}return out;}
  function findTwoKey(map,item){map=(map&&typeof map==='object')?map:{};var aliases=twoToOneAliases(item).map(norm);var keys=Object.keys(map||{});for(var i=0;i<keys.length;i++){if(aliases.indexOf(norm(keys[i]))>=0)return keys[i];}return '';}
  function recHasTwo(rec,item){rec=rec||{};var p=findTwoKey(rec.twoToOnePeriods||{},item);var s=findTwoKey(rec.twoToOneStaff||{},item);return !!((p&&(rec.twoToOnePeriods||{})[p])||(s&&(rec.twoToOneStaff||{})[s]));}
  function pickForItem(rec,item){rec=rec||{};var key=findTwoKey(rec.twoToOneStaff||{},item);return key?((rec.twoToOneStaff||{})[key]||{}):{};}
  function applyTwoToOne(rec){rec=rec||{};qa('#studentPeriodRows tr').forEach(function(tr){var item=rowItem(tr);if(!item)return;var sel=tr.querySelector('.studentSupport');var userCleared=!!(tr.dataset&&tr.dataset.twoToOneUserOverride==='off');if(sel&&recHasTwo(rec,item)&&!userCleared){ensureTwoOption(sel);sel.value='2:1';}});try{if(typeof window.syncTwoToOneRowsV05418AQ==='function')window.syncTwoToOneRowsV05418AQ();}catch(e){}setTimeout(function(){qa('#studentPeriodRows tr').forEach(function(tr){var item=rowItem(tr);if(!item||!!(tr.dataset&&tr.dataset.twoToOneUserOverride==='off'))return;var pick=pickForItem(rec,item);var p2=tr.querySelector('.studentPrimary2'),s2=tr.querySelector('.studentSecondary2');if(p2&&pick.primary2)ensureOption(p2,pick.primary2);if(s2&&pick.secondary2)ensureOption(s2,pick.secondary2);});},0);}
  function removeOldChips(root){qa('.advancedRowChipsV05418AQ,.advancedRowChipsV05418X,.advancedRowChipsV05418EO,.splitChipV05418EE,.splitChipV05418EG,.splitChipV05418EH,.splitChipV05418EI,.splitChipV05418EJ',root||document).forEach(function(el){try{el.remove();}catch(e){}});}
  function renderChips(rec){rec=rec||{};removeOldChips(by('studentPeriodRows')||document);var rows=Array.isArray(rec.splitPeriodSupport)?rec.splitPeriodSupport:[];qa('#studentPeriodRows tr').forEach(function(tr){var item=rowItem(tr);var first=tr.querySelector('td:first-child');if(!item||!first)return;var chips=[];var support=tr.querySelector('.studentSupport');var userCleared=!!(tr.dataset&&tr.dataset.twoToOneUserOverride==='off');if(!userCleared&&((support&&support.value==='2:1')||recHasTwo(rec,item)))chips.push('2:1');var labels=[];rows.forEach(function(r){if(rowMatches(r,item)){var lbl=splitLabel(r);if(lbl&&!labels.some(function(x){return norm(x)===norm(lbl);})){labels.push(lbl);}}});if(labels.length)chips.push('Split: '+labels.join(' + '));if(!chips.length)return;var div=document.createElement('div');div.className='advancedRowChipsV05418EO';div.innerHTML=chips.map(function(c){return '<span>'+esc(c)+'</span>';}).join('');first.appendChild(div);});}
  function apply(rec){if(!rec)return;remember(rec);applyTwoToOne(rec);if(typeof window.syncTwoToOneRowsV05418AQ==='function'){try{window.syncTwoToOneRowsV05418AQ();}catch(e){}}else{renderChips(rec);}}
  function refresh(force){clearTimeout(timer);timer=setTimeout(function(){var st=studentName();if(!st)return;var snap=localRec(st);if(snap)apply(snap);fetchAdvanced(st,!!force).then(function(rec){if(norm(st)===norm(studentName()))apply(rec);});},80);}
  function wrap(name,afterDelay,force){var fn=window[name];if(typeof fn!=='function'||fn.__v05418ep)return;var w=function(){var out=fn.apply(this,arguments);setTimeout(function(){refresh(!!force);},afterDelay||120);if(name==='saveStudent'){setTimeout(function(){refresh(true);},650);setTimeout(function(){refresh(true);},1400);}return out;};w.__v05418ep=true;window[name]=w;try{eval(name+'=window[name]');}catch(e){}}
  function install(){if(by('v05418epStudentCss'))return;var s=document.createElement('style');s.id='v05418epStudentCss';s.textContent='.advancedRowChipsV05418EO{margin-top:4px}.advancedRowChipsV05418EO span{display:inline-block;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:800;margin-right:4px}.schedulePublishMetaV05418EO{font-size:13px}';document.head.appendChild(s);}
  function boot(){install();wrap('selectStudent',180,true);wrap('renderStudentPeriodRows',120,false);wrap('loadStudentData',260,true);wrap('saveStudent',260,true);document.addEventListener('change',function(e){var t=e.target;if(!t||!t.classList)return;if(t.classList.contains('studentSupport')){var tr=t.closest&&t.closest('tr');if(tr&&tr.dataset)tr.dataset.twoToOneUserOverride=(t.value==='2:1')?'':'off';}
    if(t.classList.contains('studentSupport')||t.classList.contains('studentPrimary2')||t.classList.contains('studentSecondary2'))setTimeout(function(){var rec=localRec(studentName())||{};apply(rec);},120);},true);document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('[data-action="student-save"],#studentList [data-student-row],[data-student-row]'))setTimeout(function(){refresh(true);},220);},true);refresh(true);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.gaV05418EOStudentAdvancedDiag=function(){return {version:VERSION,student:studentName(),school:school(),record:localRec(studentName()),rows:qa('#studentPeriodRows tr').length,chips:qa('.advancedRowChipsV05418EO').length};};
})();

/* ===== END ga-redis-v05418eo-student-manager-published-header.js ===== */

/* ===== BEGIN ga-redis-v05418et-state-and-2to1-final.js ===== */
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

/* ===== END ga-redis-v05418et-state-and-2to1-final.js ===== */

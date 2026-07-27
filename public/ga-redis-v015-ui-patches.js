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

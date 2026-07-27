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

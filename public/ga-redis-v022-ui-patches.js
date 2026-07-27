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

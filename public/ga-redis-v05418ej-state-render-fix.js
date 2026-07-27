(function(){
  'use strict';
  if(window.__V05418EJ_STATE_RENDER_FIX__) return;
  window.__V05418EJ_STATE_RENDER_FIX__ = true;
  var VERSION = 'v05418ej';
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
  function esc(v){ try{ if(typeof window.esc === 'function') return window.esc(v); }catch(e){} return clean(v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c; }); }
  function by(id){ return document.getElementById(id); }
  function qa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function selectedPayload(){
    try{ if(typeof window.selectedSchoolPayloadV683 === 'function'){ var p0 = window.selectedSchoolPayloadV683() || {}; if(p0.campusId || p0.schoolId || p0.school || p0.spreadsheetId) return p0; } }catch(e0){}
    try{ if(typeof window.schedulePayloadV686m14_ === 'function'){ var p1 = window.schedulePayloadV686m14_() || {}; if(p1.campusId || p1.schoolId || p1.school || p1.spreadsheetId) return p1; } }catch(e1){}
    try{ if(typeof window.calendarSelectedSchoolPayloadV5440 === 'function'){ var p2 = window.calendarSelectedSchoolPayloadV5440() || {}; if(p2.campusId || p2.schoolId || p2.school || p2.spreadsheetId) return p2; } }catch(e2){}
    try{
      var sel = by('campusSelector') || by('schoolSelector') || by('schoolSelect') || by('siteSelector');
      var opt = sel && sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      var ctx = window.campusContextV5253 || {};
      var cur = ctx.currentCampus || {};
      var cid = clean((sel && sel.value) || ctx.selectedCampusId || cur.campusId || ctx.campusId || '');
      var cname = clean(cur.campusName || (opt && opt.textContent) || ctx.selectedCampusName || ctx.schoolName || '');
      var sid = clean(cur.spreadsheetId || ctx.spreadsheetId || (opt && opt.getAttribute && (opt.getAttribute('data-spreadsheet-id') || opt.getAttribute('data-id'))) || '');
      return { campusId:cid, schoolId:cid, school:cid, selectedCampusId:cid, campusName:cname, schoolName:cname, selectedCampusName:cname, spreadsheetId:sid, selectedSpreadsheetId:sid };
    }catch(e3){ return {}; }
  }
  function schoolKey(p){ p = p || selectedPayload(); return norm(p.campusId || p.schoolId || p.school || p.selectedCampusId || '') + '|' + clean(p.spreadsheetId || p.selectedSpreadsheetId || ''); }
  function queryFromPayload(extra){
    var p = selectedPayload();
    var q = new URLSearchParams();
    ['school','schoolId','campusId','selectedCampusId','spreadsheetId','selectedSpreadsheetId'].forEach(function(k){ if(p[k]) q.set(k, p[k]); });
    if(extra){ Object.keys(extra).forEach(function(k){ if(extra[k] != null && extra[k] !== '') q.set(k, extra[k]); }); }
    q.set('_', String(Date.now()));
    return q.toString();
  }

  // Publish status: never let a stale/legacy empty response repaint the nav as "Never published"
  // when the server can prove a published snapshot exists.
  function formatStamp(stamp){
    var s = clean(stamp);
    if(!s) return '';
    try{ if(typeof window.formatPublishNavStampV51248 === 'function') return window.formatPublishNavStampV51248(s); }catch(e){}
    var d = new Date(s);
    if(!isNaN(d.getTime())){
      var h = d.getHours(); var ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
      var m = String(d.getMinutes()).padStart(2,'0');
      return (d.getMonth()+1)+'/'+d.getDate()+' '+h+':'+m+' '+ap;
    }
    return s;
  }
  var lastGoodPublish = null;
  function hasPublished(st){ return !!(st && (st.hasPublished || st.hasActivePublished || st.publishedAt || st.activePublishedAt || st.publishedHash || st.hash || /published/i.test(clean(st.navText || st.detailText || '')) && !/never/i.test(clean(st.navText || st.detailText || '')))); }
  function applyPublishNav(st){
    st = st || {};
    if(hasPublished(st)) lastGoodPublish = Object.assign({}, lastGoodPublish || {}, st);
    else if(lastGoodPublish && (!st || !st.publishedAt)) st = Object.assign({}, st, lastGoodPublish);
    var unpublished = !!(st.unpublished || st.unpublishedChanges || st.workingDirty || st.draft);
    var stamp = clean(st.publishedAt || st.activePublishedAt || st.lastPublishedAt || '');
    var navText = clean(st.navText || '');
    var text = '';
    if(navText && !/never published/i.test(navText)) text = navText.replace(/^Published\s+/i, 'Published - ');
    if(!text){
      if(unpublished) text = stamp ? ('Last published - ' + formatStamp(stamp)) : (hasPublished(st) ? 'Unpublished draft · Published schedule available' : 'Never published');
      else text = stamp ? ('Published - ' + formatStamp(stamp)) : (hasPublished(st) ? 'Published schedule available' : 'Never published');
    }
    var nav = by('publishNavStatus'); if(nav) nav.textContent = text;
    var pill = by('unpublishedSchedulePill'); if(pill) pill.style.display = unpublished ? 'inline-flex' : 'none';
    var btn = by('publishScheduleBtn'); if(btn) btn.style.display = unpublished ? 'inline-flex' : 'none';
    var group = by('navScheduleGroup'); if(group) group.classList.toggle('unpublished', unpublished);
  }
  function patchPublishStatusRenderer(){
    var old = window.renderPublishStatus || (typeof renderPublishStatus === 'function' ? renderPublishStatus : null);
    if(old && old.__v05418ej) return;
    var wrapped = function(st){
      st = st || {};
      if(hasPublished(st)) lastGoodPublish = Object.assign({}, lastGoodPublish || {}, st);
      if(!hasPublished(st) && lastGoodPublish && !st.publishedAt) st = Object.assign({}, st, lastGoodPublish);
      var out;
      try{ if(old) out = old.call(this, st); }catch(e){}
      try{ applyPublishNav(st); }catch(e2){}
      return out;
    };
    wrapped.__v05418ej = true;
    window.renderPublishStatus = wrapped;
    try{ renderPublishStatus = window.renderPublishStatus; }catch(e3){}
  }
  function refreshPublishStatusDirect(){
    var key = schoolKey();
    if(!key || key === '|') return;
    fetch('/api/v05418ej/publish-status?' + queryFromPayload(), { credentials:'same-origin', cache:'no-store' })
      .then(function(r){ return r.json(); })
      .then(function(j){ if(j && j.ok !== false){ applyPublishNav(j); } })
      .catch(function(){});
  }

  // Student Manager split chips: older layers can render a generic "Split" chip and duplicate
  // detailed chips. This owns the row chips and leaves one detailed chip per period.
  var splitBusy = false;
  function currentStudentName(){
    var el = by('studentName'); if(el && clean(el.value)) return clean(el.value);
    try{ if(window.currentStudent && (window.currentStudent.name || window.currentStudent.student)) return clean(window.currentStudent.name || window.currentStudent.student); }catch(e){}
    try{ if(window.selectedStudent && (window.selectedStudent.name || window.selectedStudent.student)) return clean(window.selectedStudent.name || window.selectedStudent.student); }catch(e2){}
    return '';
  }
  function stripSplitText(v){ return clean(v).replace(/\bSplit\s*:\s*.*$/i,'').replace(/\bSplit\b.*$/i,'').replace(/\b2\s*:\s*1\b.*$/i,'').trim(); }
  function rowItemText(tr){
    if(!tr) return '';
    var attr = clean(tr.getAttribute('data-item') || tr.getAttribute('data-student-period-item') || (tr.dataset && (tr.dataset.item || tr.dataset.studentPeriodItem)) || '');
    if(attr) return attr;
    var cell = tr.querySelector('td:first-child') || tr;
    var clone = cell.cloneNode(true);
    qa('.splitChipV05418EI,.splitChipV05418EH,.splitChipV05418EG,.splitChipV05418EE,.splitChipV05418EJ,.advancedRowChipsV05418X,.chipV05418AE', clone).forEach(function(el){ if(/^\s*Split\b/i.test(clean(el.textContent || '')) || /splitChipV05418/i.test(clean(el.className || ''))){ el.remove(); } });
    var b = clone.querySelector('b');
    return stripSplitText((b && b.textContent) || clone.textContent || '');
  }
  function labelForItem(item){
    item = clean(item);
    var maps = [];
    try{ maps.push((window.studentData || {}).itemLabels || {}); maps.push((window.scheduleData || {}).itemLabels || {}); }catch(e){}
    for(var m=0;m<maps.length;m++){
      var map = maps[m] || {};
      if(map[item]) return clean(map[item]);
      var keys = Object.keys(map);
      for(var i=0;i<keys.length;i++){ if(norm(keys[i]) === norm(item)) return clean(map[keys[i]]); }
    }
    return item;
  }
  function splitRows(rec){
    rec = rec || {};
    var rows = [];
    if(Array.isArray(rec.splitPeriodSupport)) rows = rows.concat(rec.splitPeriodSupport);
    if(Array.isArray(rec.splitPeriodSupportParsed)) rows = rows.concat(rec.splitPeriodSupportParsed);
    var seen = {};
    return rows.filter(function(r){
      if(!r || typeof r !== 'object') return false;
      var item = r.item || r.periodValue || r.period || r.key || r.label || r.displayName || r.title || '';
      var mode = r.mode || r.windowMode || r.type || r.segment || r.position || r.splitWindowMode || '';
      var min = r.minutes || r.duration || r.minuteCount || r.lengthMinutes || r.splitWindowMinutes || '';
      var start = r.start || r.startTime || r.startMinutes || r.splitStartMinutes || '';
      var end = r.end || r.endTime || r.endMinutes || r.splitEndMinutes || '';
      var k = norm(item + '|' + mode + '|' + min + '|' + start + '|' + end);
      if(seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }
  function splitLabel(row){
    row = row || {};
    var cap = clean(row.splitWindowCaption || row.caption || '');
    var mode = clean(row.mode || row.windowMode || row.type || row.segment || row.position || row.splitWindowMode).toLowerCase();
    var min = clean(row.minutes || row.duration || row.minuteCount || row.lengthMinutes || row.splitWindowMinutes);
    if(cap && !/^split$/i.test(cap)) return cap.replace(/minutes\b/i,'min');
    if(mode === 'first' && min) return 'First ' + min + ' min';
    if(mode === 'last' && min) return 'Last ' + min + ' min';
    if(mode === 'between' && min) return 'Between ' + min + ' min';
    var raw = clean(row.splitWindowLabel || row.splitLabel || '');
    if(raw && !/^split$/i.test(raw)) return raw.replace(/minutes\b/i,'min');
    if((row.start || row.startTime) && (row.end || row.endTime)) return clean(row.start || row.startTime) + ' - ' + clean(row.end || row.endTime);
    return '';
  }
  function rowMatchesSplit(row, item){
    var wanted = norm(row.item || row.periodValue || row.period || row.key || row.label || row.displayName || row.title || '');
    if(!wanted) return false;
    return [item, labelForItem(item)].some(function(v){ return norm(v) === wanted; });
  }
  function removeSplitChips(root){
    root = root || document;
    qa('.splitChipV05418EI,.splitChipV05418EH,.splitChipV05418EG,.splitChipV05418EE,.splitChipV05418EJ,.advancedRowChipsV05418X,.chipV05418AE', root).forEach(function(el){
      var txt = clean(el.textContent || '');
      var cls = clean(el.className || '');
      if(/^Split\b/i.test(txt) || /splitChipV05418/i.test(cls)){ try{ el.parentNode && el.parentNode.removeChild(el); }catch(e){} }
    });
  }
  function renderSplitChips(rec){
    if(splitBusy) return;
    var tb = by('studentPeriodRows'); if(!tb) return;
    splitBusy = true;
    try{
      var rows = splitRows(rec);
      removeSplitChips(tb);
      if(!rows.length) return;
      qa('tr', tb).forEach(function(tr){
        var item = rowItemText(tr);
        var matches = rows.filter(function(r){ return rowMatchesSplit(r, item); });
        if(!matches.length) return;
        var labels = [];
        matches.forEach(function(r){ var l = splitLabel(r); if(l && !labels.some(function(x){ return norm(x) === norm(l); })) labels.push(l); });
        if(!labels.length) return;
        var host = tr.querySelector('.rowChips,.periodChips,.chips') || tr.querySelector('td:first-child') || tr;
        removeSplitChips(host);
        var chip = document.createElement('span');
        chip.className = 'splitChipV05418EJ';
        chip.textContent = 'Split: ' + labels.join(' + ');
        host.appendChild(chip);
      });
    } finally { splitBusy = false; }
  }
  var lastSplitRecord = null;
  var lastSplitStudent = '';
  function fetchSplitRecord(){
    var student = currentStudentName();
    if(!student) return Promise.resolve(null);
    var q = queryFromPayload({ student: student, studentName: student });
    return fetch('/api/v05418x/student-advanced?' + q, { credentials:'same-origin', cache:'no-store' })
      .then(function(r){ return r.json(); })
      .then(function(j){ var rec = (j && (j.record || j.advancedScheduling)) || null; if(rec){ lastSplitRecord = rec; lastSplitStudent = student; } return rec || (norm(lastSplitStudent) === norm(student) ? lastSplitRecord : null); })
      .catch(function(){ return lastSplitRecord; });
  }
  var splitTimer = null;
  function refreshSplitChips(delay){
    clearTimeout(splitTimer);
    splitTimer = setTimeout(function(){
      if(lastSplitRecord) renderSplitChips(lastSplitRecord);
      fetchSplitRecord().then(function(rec){ if(rec) renderSplitChips(rec); else removeSplitChips(by('studentPeriodRows') || document); });
    }, delay == null ? 90 : delay);
  }
  function patchStudentFns(){
    ['selectStudent','renderStudentPeriodRows','loadStudentData','saveStudent','newStudent'].forEach(function(name){
      var fn = window[name]; if(typeof fn !== 'function' || fn.__v05418ej) return;
      var wrapped = function(){ var out = fn.apply(this, arguments); refreshSplitChips(name === 'saveStudent' ? 350 : 120); setTimeout(function(){ refreshSplitChips(0); }, name === 'saveStudent' ? 1400 : 600); return out; };
      wrapped.__v05418ej = true; window[name] = wrapped; try{ eval(name + '=window[name]'); }catch(e){}
    });
  }

  // Now tile: preserve a valid current schedule result from being overwritten by later stale/empty loaders.
  var lastGoodNow = null;
  var lastGoodNowKey = '';
  var nowRendering = false;
  function nowMode(){ try{ return (typeof scheduleNowMode !== 'undefined' ? scheduleNowMode : (sessionStorage.getItem('v5ScheduleNowMode') || 'students')); }catch(e){ return 'students'; } }
  function hasNowRows(d){ d = d || {}; return !!((Array.isArray(d.staffRows) && d.staffRows.length) || (Array.isArray(d.studentRows) && d.studentRows.length)); }
  function rememberNow(d){
    if(hasNowRows(d) && clean(d.itemTitle || d.item || '')){ lastGoodNow = Object.assign({}, d); lastGoodNowKey = schoolKey(); try{ sessionStorage.setItem('v05418ejLastGoodNow_' + lastGoodNowKey, JSON.stringify({ t:Date.now(), v:lastGoodNow })); }catch(e){} }
  }
  function getRememberedNow(){
    if(lastGoodNow && lastGoodNowKey === schoolKey()) return lastGoodNow;
    try{ var raw = sessionStorage.getItem('v05418ejLastGoodNow_' + schoolKey()); if(raw){ var o = JSON.parse(raw); if(o && o.v && Date.now() - Number(o.t || 0) < 10*60*1000) return o.v; } }catch(e){}
    return null;
  }
  function unavailableText(d){
    var msg = clean(d && (d.unavailableReason || d.reason || d.message || ''));
    if(/outside|no current|not active/i.test(msg)) return 'Current time is outside active schedule hours.';
    if(/not for today/i.test(msg)) return 'The published schedule is not for today.';
    if(/no schedule has been published/i.test(msg)) return 'No schedule has been published.';
    return msg || 'Current time is outside active schedule hours.';
  }
  function directNowToScheduleData(j){
    j = j || {};
    return { ok:true, available:j.available, unavailableReason:j.unavailableReason || '', status:j.status || '', itemTitle:j.itemTitle || j.item || '', item:j.item || j.itemTitle || '', timeLabel:j.timeLabel || '', nextLabel:j.nextLabel || '', staffRows:Array.isArray(j.staffRows)?j.staffRows:[], studentRows:Array.isArray(j.studentRows)?j.studentRows:[], source:j.source || 'direct-v05418ej' };
  }
  function paintUnavailable(d){
    var box = by('scheduleNowBox'); if(!box) return;
    var title = by('scheduleNowTitle'); if(title) title.innerHTML = '<span class="nowLabel">Now:</span> <span class="nowItem">No active schedule block</span>';
    var clock = by('scheduleNowClock'); if(clock) clock.textContent = clean(d && d.timeLabel || '');
    box.innerHTML = '<div class="muted">' + esc(unavailableText(d || {})) + '</div>';
  }
  function patchNowRenderer(){
    var old = window.renderScheduleNow || (typeof renderScheduleNow === 'function' ? renderScheduleNow : null);
    if(old && old.__v05418ej) return;
    var wrapped = function(){
      if(nowRendering){ return old ? old.apply(this, arguments) : undefined; }
      nowRendering = true;
      try{
        var d = window.scheduleNowData || (typeof scheduleNowData !== 'undefined' ? scheduleNowData : null) || {};
        if(hasNowRows(d)) rememberNow(d);
        else {
          var remembered = getRememberedNow();
          if(remembered){ d = remembered; window.scheduleNowData = d; try{ scheduleNowData = d; }catch(e){} }
        }
        var out;
        if(hasNowRows(d)){
          out = old ? old.apply(this, arguments) : undefined;
          rememberNow(d);
        } else if(clean(d.unavailableReason || d.reason || d.message || d.status || '')) {
          paintUnavailable(d);
        } else {
          out = old ? old.apply(this, arguments) : undefined;
          var box = by('scheduleNowBox');
          var txt = clean(box && box.textContent || '');
          var r = getRememberedNow();
          if(r && /No current schedule data|No published schedule is currently active/i.test(txt)){
            window.scheduleNowData = r; try{ scheduleNowData = r; }catch(e2){}
            out = old ? old.apply(this, arguments) : undefined;
          }
        }
        return out;
      } finally { nowRendering = false; }
    };
    wrapped.__v05418ej = true;
    window.renderScheduleNow = wrapped;
    try{ renderScheduleNow = window.renderScheduleNow; }catch(e3){}
  }
  var nowReq = 0;
  function refreshNowDirect(){
    var req = ++nowReq;
    var key = schoolKey(); if(!key || key === '|') return;
    fetch('/api/admin-app/now?' + queryFromPayload(), { credentials:'same-origin', cache:'no-store' })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(req !== nowReq || !j || j.ok === false) return;
        var d = directNowToScheduleData(j);
        if(hasNowRows(d)){
          window.scheduleNowData = d; try{ scheduleNowData = d; }catch(e){}
          rememberNow(d);
          if(typeof window.renderScheduleNow === 'function') window.renderScheduleNow();
        } else if(j.unavailableReason){
          var current = window.scheduleNowData || (typeof scheduleNowData !== 'undefined' ? scheduleNowData : null) || {};
          if(!hasNowRows(current)){ window.scheduleNowData = d; try{ scheduleNowData = d; }catch(e2){} paintUnavailable(d); }
        }
      })
      .catch(function(){});
  }
  function patchNowLoaders(){
    ['loadScheduleNow','loadDashboardSummary'].forEach(function(name){
      var fn = window[name]; if(typeof fn !== 'function' || fn.__v05418ej) return;
      var wrapped = function(){ var out = fn.apply(this, arguments); setTimeout(refreshNowDirect, name === 'loadDashboardSummary' ? 260 : 160); setTimeout(refreshNowDirect, 1300); return out; };
      wrapped.__v05418ej = true; window[name] = wrapped; try{ eval(name + '=window[name]'); }catch(e){}
    });
  }

  function installCss(){
    if(by('v05418ejCss')) return;
    var s = document.createElement('style'); s.id = 'v05418ejCss';
    s.textContent = '.splitChipV05418EJ{display:inline-flex!important;align-items:center!important;margin:3px 4px 0 0!important;border:1px solid #bfdbfe!important;background:#eff6ff!important;color:#1d4ed8!important;border-radius:999px!important;padding:2px 7px!important;font-size:10px!important;font-weight:850!important;line-height:1.25!important;vertical-align:middle!important}';
    document.head.appendChild(s);
  }
  function boot(){
    installCss();
    patchPublishStatusRenderer(); patchNowRenderer(); patchNowLoaders(); patchStudentFns();
    refreshPublishStatusDirect(); refreshNowDirect(); refreshSplitChips(250);
    [700, 1800, 3500].forEach(function(ms){ setTimeout(function(){ patchPublishStatusRenderer(); patchNowRenderer(); patchNowLoaders(); patchStudentFns(); refreshPublishStatusDirect(); refreshNowDirect(); refreshSplitChips(0); }, ms); });
    document.addEventListener('change', function(e){ var t = e.target; if(t && /^(campusSelector|schoolSelector|schoolSelect|siteSelector|studentName)$/.test(t.id || '')){ lastGoodNow = null; if(t.id === 'studentName'){ lastSplitRecord = null; lastSplitStudent = ''; removeSplitChips(by('studentPeriodRows') || document); } setTimeout(function(){ refreshPublishStatusDirect(); refreshNowDirect(); refreshSplitChips(0); }, 180); } }, true);
    document.addEventListener('click', function(e){
      var t = e.target;
      if(t && t.closest && t.closest('[data-student-row],#studentList button,[data-action="student-save"]')) setTimeout(function(){ refreshSplitChips(0); }, 220);
      if(t && t.closest && t.closest('[data-action="publish-schedule"]')) setTimeout(function(){ refreshPublishStatusDirect(); refreshNowDirect(); }, 1200);
    }, true);
    var sp = by('studentPeriodRows');
    if(sp && window.MutationObserver){ new MutationObserver(function(){ if(splitBusy) return; refreshSplitChips(80); }).observe(sp, { childList:true, subtree:true }); }
    var nowBox = by('scheduleNowBox');
    if(nowBox && window.MutationObserver){ new MutationObserver(function(){
      var txt = clean(nowBox.textContent || '');
      var r = getRememberedNow();
      if(r && /No current schedule data|No published schedule is currently active/i.test(txt)){ window.scheduleNowData = r; try{ scheduleNowData = r; }catch(e){} if(typeof window.renderScheduleNow === 'function') setTimeout(window.renderScheduleNow, 0); }
    }).observe(nowBox, { childList:true, subtree:true, characterData:true }); }
    setInterval(function(){ patchPublishStatusRenderer(); patchNowRenderer(); patchNowLoaders(); patchStudentFns(); removeSplitChips(by('studentPeriodRows') || document); if(lastSplitRecord && norm(lastSplitStudent) === norm(currentStudentName())) renderSplitChips(lastSplitRecord); }, 3000);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.gaV05418EJDiag = function(){ return { version:VERSION, school:schoolKey(), lastGoodNow:!!lastGoodNow, lastGoodPublish:lastGoodPublish, splitRows:splitRows(lastSplitRecord).length }; };
})();

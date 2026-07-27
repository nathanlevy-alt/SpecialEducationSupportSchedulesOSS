(function(){
  'use strict';
  if(window.__V05418EH_STUDENT_NOW_STATUS_FIX__) return;
  window.__V05418EH_STUDENT_NOW_STATUS_FIX__ = true;
  var VERSION = 'v05418eh';
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
  function esc(v){ try{ if(typeof window.esc === 'function') return window.esc(v); }catch(e){} return clean(v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c; }); }
  function by(id){ return document.getElementById(id); }
  function qa(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function currentStudentName(){
    var el = by('studentName'); if(el && clean(el.value)) return clean(el.value);
    try{ if(window.currentStudent && (currentStudent.name || currentStudent.student)) return clean(currentStudent.name || currentStudent.student); }catch(e){}
    return '';
  }
  function selectedSchoolPayload(){
    try{ if(typeof window.selectedSchoolPayloadV683 === 'function') return window.selectedSchoolPayloadV683() || {}; }catch(e){}
    try{ if(typeof window.schedulePayloadV686m14_ === 'function') return window.schedulePayloadV686m14_() || {}; }catch(e2){}
    try{
      var sel = by('campusSelector') || by('schoolSelector') || by('schoolSelect') || by('siteSelector');
      var opt = sel && sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      return {
        campusId: clean(sel && sel.value), schoolId: clean(sel && sel.value), school: clean(sel && sel.value), selectedCampusId: clean(sel && sel.value),
        campusName: clean(opt && opt.textContent), schoolName: clean(opt && opt.textContent), selectedCampusName: clean(opt && opt.textContent),
        spreadsheetId: clean(opt && opt.getAttribute && (opt.getAttribute('data-spreadsheet-id') || opt.getAttribute('data-id')))
      };
    }catch(e3){ return {}; }
  }
  function fetchAdvanced(student){
    student = clean(student || currentStudentName());
    if(!student) return Promise.resolve(null);
    var params = new URLSearchParams();
    params.set('student', student);
    var p = selectedSchoolPayload() || {};
    Object.keys(p).forEach(function(k){ if(p[k] != null && p[k] !== '') params.set(k, p[k]); });
    params.set('_', String(Date.now()));
    return fetch('/api/v05418x/student-advanced?' + params.toString(), { credentials:'same-origin', cache:'no-store' })
      .then(function(r){ return r.json(); })
      .then(function(j){ return (j && (j.record || j.advancedScheduling)) || null; })
      .catch(function(){ return null; });
  }
  function labelForItem(item){
    item = clean(item);
    try{
      var maps = [(window.studentData || {}).itemLabels || {}, (window.scheduleData || {}).itemLabels || {}];
      for(var m=0;m<maps.length;m++){
        var map = maps[m] || {};
        if(map[item]) return clean(map[item]);
        var keys = Object.keys(map);
        for(var i=0;i<keys.length;i++){ if(norm(keys[i]) === norm(item)) return clean(map[keys[i]]); }
      }
    }catch(e){}
    return item;
  }
  function recRows(rec){
    rec = rec || {};
    var out = [];
    if(Array.isArray(rec.splitPeriodSupport)) out = out.concat(rec.splitPeriodSupport);
    if(Array.isArray(rec.splitPeriodSupportParsed)) out = out.concat(rec.splitPeriodSupportParsed);
    var seen = {};
    return out.filter(function(r){
      if(!r || typeof r !== 'object') return false;
      var key = norm((r.item || r.period || r.periodValue || r.key || '') + '|' + (r.mode || r.windowMode || r.type || r.segment || r.position || '') + '|' + (r.minutes || r.duration || r.lengthMinutes || '') + '|' + (r.start || r.startTime || '') + '|' + (r.end || r.endTime || ''));
      if(seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function rowMatches(row,item){
    var wanted = norm(row.item || row.periodValue || row.period || row.key || row.label || row.displayName || row.title || '');
    if(!wanted) return false;
    return [item, labelForItem(item)].some(function(v){ return norm(v) === wanted; });
  }
  function rowLabel(row){
    var cap = clean(row.splitWindowCaption || row.caption || '');
    if(cap) return cap;
    var mode = clean(row.mode || row.windowMode || row.type || row.segment || row.position).toLowerCase();
    var min = clean(row.minutes || row.duration || row.minuteCount || row.lengthMinutes || row.splitWindowMinutes);
    if(mode === 'first' && min) return 'First ' + min + ' min';
    if(mode === 'last' && min) return 'Last ' + min + ' min';
    if(mode === 'between' && min) return 'Between ' + min + ' min';
    if(row.splitWindowLabel) return clean(row.splitWindowLabel);
    if(row.start && row.end) return clean(row.start) + ' - ' + clean(row.end);
    if(row.startTime && row.endTime) return clean(row.startTime) + ' - ' + clean(row.endTime);
    return 'Split';
  }
  function collapseDuplicateStudentRows(){
    var tb = by('studentPeriodRows');
    if(!tb) return;
    var seen = {};
    qa('tr', tb).forEach(function(tr){
      var item = tr.getAttribute('data-item') || tr.getAttribute('data-student-period-item') || '';
      var key = clean(item) || norm(clean((tr.querySelector('td:first-child')||{}).textContent || ''));
      if(!key) return;
      if(!seen[key]) { seen[key] = tr; return; }
      if(tr.parentNode) tr.parentNode.removeChild(tr);
    });
  }
  function renderSplitChips(rec){
    var rows = recRows(rec);
    qa('.splitChipV05418EH,.splitChipV05418EG,.splitChipV05418EE').forEach(function(el){ if(el && el.parentNode) el.parentNode.removeChild(el); });
    if(!rows.length) return;
    qa('#studentPeriodRows tr').forEach(function(tr){
      var item = tr.getAttribute('data-item') || tr.getAttribute('data-student-period-item') || clean((tr.querySelector('td:first-child b,td:first-child')||{}).textContent || '');
      var matches = rows.filter(function(r){ return rowMatches(r,item); });
      if(!matches.length) return;
      var host = tr.querySelector('td:first-child') || tr;
      var chip = document.createElement('div');
      chip.className = 'splitChipV05418EH';
      chip.innerHTML = '<span>' + esc('Split: ' + matches.map(rowLabel).join(' + ')) + '</span>';
      host.appendChild(chip);
    });
  }
  var chipTimer = null;
  function refreshSplitChips(){
    clearTimeout(chipTimer);
    chipTimer = setTimeout(function(){
      collapseDuplicateStudentRows();
      var student = currentStudentName();
      if(!student) return;
      fetchAdvanced(student).then(function(rec){ collapseDuplicateStudentRows(); if(rec) renderSplitChips(rec); });
    }, 80);
  }
  function patchStudentRows(){
    var fns = ['renderStudentPeriodRows','selectStudent','saveStudent'];
    fns.forEach(function(name){
      var fn = window[name];
      if(typeof fn !== 'function' || fn.__v05418eh) return;
      var wrapped = function(){
        var out = fn.apply(this, arguments);
        setTimeout(refreshSplitChips, name === 'saveStudent' ? 350 : 100);
        setTimeout(refreshSplitChips, name === 'saveStudent' ? 1400 : 450);
        return out;
      };
      wrapped.__v05418eh = true;
      window[name] = wrapped;
      try{ eval(name + '=window[name]'); }catch(e){}
    });
    var rr = window.renderRowChips;
    if(typeof rr === 'function' && !rr.__v05418eh){
      var base = rr;
      window.renderRowChips = function(){ var out = base.apply(this, arguments); setTimeout(refreshSplitChips, 60); return out; };
      window.renderRowChips.__v05418eh = true;
      try{ renderRowChips = window.renderRowChips; }catch(e2){}
    }
  }
  function patchNowMessage(){
    var old = window.renderScheduleNow;
    if(typeof old !== 'function' || old.__v05418eh) return;
    window.renderScheduleNow = function(){
      var d = window.scheduleNowData || (typeof scheduleNowData !== 'undefined' ? scheduleNowData : null) || {};
      var outside = /outside/i.test(clean(d.status || d.unavailableReason || '')) || clean(d.source)==='published';
      var noRows = ((d.staffRows || []).length === 0 && (d.studentRows || []).length === 0);
      if(noRows && /outside/i.test(clean(d.status || d.unavailableReason || ''))){
        var el = by('scheduleNowBox');
        var t = by('scheduleNowTitle');
        if(t) t.innerHTML = '<span class="nowLabel">Now:</span> <span class="nowItem">No active schedule block</span>';
        if(el) el.innerHTML = '<div class="muted">Current time is outside active schedule hours.</div>';
        var c = by('scheduleNowClock'); if(c) c.textContent = d.timeLabel || '';
        return;
      }
      return old.apply(this, arguments);
    };
    window.renderScheduleNow.__v05418eh = true;
    try{ renderScheduleNow = window.renderScheduleNow; }catch(e){}
  }
  function installCss(){
    if(by('v05418ehStudentNowCss')) return;
    var s = document.createElement('style'); s.id = 'v05418ehStudentNowCss';
    s.textContent = '.splitChipV05418EH{display:block!important;margin-top:4px!important}.splitChipV05418EH span{display:inline-block!important;border:1px solid #bfdbfe!important;background:#eff6ff!important;color:#1d4ed8!important;border-radius:999px!important;padding:2px 7px!important;font-size:10px!important;font-weight:850!important;line-height:1.25!important}';
    document.head.appendChild(s);
  }
  function boot(){ installCss(); patchStudentRows(); patchNowMessage(); refreshSplitChips(); document.addEventListener('click', function(e){ if(e.target && e.target.closest && e.target.closest('[data-student-row],#studentList button,[data-action="student-save"]')) setTimeout(refreshSplitChips, 250); }, true); document.addEventListener('change', function(e){ var id = e.target && e.target.id; if(/^(studentName|campusSelector|schoolSelector|schoolSelect|siteSelector)$/.test(id || '')) setTimeout(refreshSplitChips, 200); }, true); setInterval(patchStudentRows, 2500); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.gaV05418EHStudentDiag = function(){ return {version:VERSION, student:currentStudentName(), rows:qa('#studentPeriodRows tr').length}; };
})();

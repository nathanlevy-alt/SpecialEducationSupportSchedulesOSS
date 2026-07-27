(function(){
  'use strict';
  if(window.__V05418EI_STUDENT_NOW_PUBLISH_FIX__) return;
  window.__V05418EI_STUDENT_NOW_PUBLISH_FIX__ = true;
  var VERSION = 'v05418ei';
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
  function esc(v){ try{ if(typeof window.esc === 'function') return window.esc(v); }catch(e){} return clean(v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c; }); }
  function by(id){ return document.getElementById(id); }
  function qa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function firstText(tr){
    var b = tr && tr.querySelector && tr.querySelector('td:first-child b');
    var cell = tr && tr.querySelector && tr.querySelector('td:first-child');
    return clean((b && b.textContent) || (cell && cell.childNodes && cell.childNodes[0] && cell.childNodes[0].textContent) || (cell && cell.textContent) || '');
  }
  function rowKey(tr){
    if(!tr) return '';
    var item = clean(tr.getAttribute('data-item') || tr.getAttribute('data-student-period-item') || tr.dataset && (tr.dataset.item || tr.dataset.studentPeriodItem) || '');
    if(item) return norm(item);
    var t = firstText(tr).replace(/Split:.*$/i,'').replace(/\bSplit\b.*$/i,'').replace(/\b2:1\b.*$/i,'');
    return norm(t);
  }
  function selectValue(tr, cls){ var el = tr && tr.querySelector && tr.querySelector('.' + cls); return clean(el && el.value); }
  function scoreRow(tr){
    var score = 0;
    ['studentLoc','studentSupportKind','studentSupport','studentPrimary','studentSecondary'].forEach(function(cls){
      var v = selectValue(tr, cls);
      if(v && !/^n\/?a$/i.test(v)) score += 3;
    });
    if(tr && tr.querySelector && tr.querySelector('.splitChipV05418EI,.splitChipV05418EH,.splitChipV05418EG,.splitChipV05418EE,.advancedRowChipsV05418X')) score += 20;
    if(tr && tr.querySelector && tr.querySelector('.studentRowWarnings span')) score += 1;
    return score;
  }
  var dedupeBusy = false;
  function dedupeStudentPeriodRows(){
    if(dedupeBusy) return;
    var tb = by('studentPeriodRows');
    if(!tb) return;
    var rows = qa('tr', tb);
    if(rows.length < 2) return;
    dedupeBusy = true;
    try{
      var byKey = {};
      rows.forEach(function(tr, idx){
        var k = rowKey(tr);
        if(!k) return;
        if(!byKey[k]) byKey[k] = [];
        byKey[k].push({tr:tr, idx:idx, score:scoreRow(tr)});
      });
      Object.keys(byKey).forEach(function(k){
        var group = byKey[k];
        if(!group || group.length < 2) return;
        group.sort(function(a,b){ return (b.score - a.score) || (a.idx - b.idx); });
        var keep = group[0].tr;
        var keepCell = keep.querySelector('td:first-child') || keep;
        group.slice(1).forEach(function(x){
          var chips = qa('.splitChipV05418EI,.splitChipV05418EH,.splitChipV05418EG,.splitChipV05418EE,.advancedRowChipsV05418X', x.tr);
          if(chips.length && !qa('.splitChipV05418EI,.splitChipV05418EH,.splitChipV05418EG,.splitChipV05418EE,.advancedRowChipsV05418X', keepCell).length){
            chips.forEach(function(ch){ try{ keepCell.appendChild(ch.cloneNode(true)); }catch(e){} });
          }
          if(x.tr && x.tr.parentNode) x.tr.parentNode.removeChild(x.tr);
        });
      });
    } finally {
      dedupeBusy = false;
    }
  }
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
      return { campusId: clean(sel && sel.value), schoolId: clean(sel && sel.value), school: clean(sel && sel.value), selectedCampusId: clean(sel && sel.value), campusName: clean(opt && opt.textContent), schoolName: clean(opt && opt.textContent), selectedCampusName: clean(opt && opt.textContent), spreadsheetId: clean(opt && opt.getAttribute && (opt.getAttribute('data-spreadsheet-id') || opt.getAttribute('data-id'))) };
    }catch(e3){ return {}; }
  }
  function fetchAdvanced(student){
    student = clean(student || currentStudentName());
    if(!student) return Promise.resolve(null);
    var params = new URLSearchParams(); params.set('student', student);
    var p = selectedSchoolPayload() || {}; Object.keys(p).forEach(function(k){ if(p[k] != null && p[k] !== '') params.set(k, p[k]); });
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
      var item = r.item || r.period || r.periodValue || r.key || r.label || r.displayName || r.title || '';
      var key = norm(item + '|' + (r.mode || r.windowMode || r.type || r.segment || r.position || '') + '|' + (r.minutes || r.duration || r.lengthMinutes || '') + '|' + (r.start || r.startTime || r.startMinutes || '') + '|' + (r.end || r.endTime || r.endMinutes || ''));
      if(seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function rowMatches(row, item){
    var wanted = norm(row.item || row.periodValue || row.period || row.key || row.label || row.displayName || row.title || '');
    if(!wanted) return false;
    return [item, labelForItem(item), firstText(item)].some(function(v){ return norm(v) === wanted; });
  }
  function rowLabel(row){
    row = row || {};
    var cap = clean(row.splitWindowCaption || row.caption || '');
    var mode = clean(row.mode || row.windowMode || row.type || row.segment || row.position || row.splitWindowMode).toLowerCase();
    var min = clean(row.minutes || row.duration || row.minuteCount || row.lengthMinutes || row.splitWindowMinutes);
    if(!cap){
      if(mode === 'first' && min) cap = 'First ' + min + ' min';
      else if(mode === 'last' && min) cap = 'Last ' + min + ' min';
      else if(mode === 'between' && min) cap = 'Between ' + min + ' min';
    }
    if(cap) return cap;
    if(row.splitWindowLabel) return clean(row.splitWindowLabel);
    if(row.start && row.end) return clean(row.start) + ' - ' + clean(row.end);
    if(row.startTime && row.endTime) return clean(row.startTime) + ' - ' + clean(row.endTime);
    return 'Split';
  }
  var chipBusy = false;
  function renderSplitChips(rec){
    if(chipBusy) return;
    var tb = by('studentPeriodRows'); if(!tb) return;
    chipBusy = true;
    try{
      dedupeStudentPeriodRows();
      var rows = recRows(rec);
      qa('.splitChipV05418EI,.splitChipV05418EH,.splitChipV05418EG,.splitChipV05418EE', tb).forEach(function(el){ if(el && el.parentNode) el.parentNode.removeChild(el); });
      if(!rows.length) return;
      qa('tr', tb).forEach(function(tr){
        var item = tr.getAttribute('data-item') || tr.getAttribute('data-student-period-item') || clean((tr.querySelector('td:first-child b,td:first-child')||{}).textContent || '');
        var matches = rows.filter(function(r){ return rowMatches(r, item); });
        if(!matches.length) return;
        var host = tr.querySelector('td:first-child') || tr;
        var chip = document.createElement('div');
        chip.className = 'splitChipV05418EI';
        chip.innerHTML = '<span>' + esc('Split: ' + matches.map(rowLabel).join(' + ')) + '</span>';
        host.appendChild(chip);
      });
    } finally { chipBusy = false; }
  }
  var timer = null;
  function refreshSplitFlags(forceFetch){
    clearTimeout(timer);
    timer = setTimeout(function(){
      dedupeStudentPeriodRows();
      var student = currentStudentName();
      if(!student) return;
      fetchAdvanced(student).then(function(rec){ dedupeStudentPeriodRows(); if(rec) renderSplitChips(rec); dedupeStudentPeriodRows(); });
    }, forceFetch ? 100 : 180);
  }
  function wrapStudentFns(){
    ['renderStudentPeriodRows','selectStudent','loadStudentData','saveStudent','newStudent'].forEach(function(name){
      var fn = window[name];
      if(typeof fn !== 'function' || fn.__v05418ei) return;
      var wrapped = function(){
        var out = fn.apply(this, arguments);
        setTimeout(function(){ dedupeStudentPeriodRows(); refreshSplitFlags(true); }, name === 'saveStudent' ? 400 : 80);
        setTimeout(function(){ dedupeStudentPeriodRows(); refreshSplitFlags(true); }, name === 'saveStudent' ? 1600 : 450);
        return out;
      };
      wrapped.__v05418ei = true;
      window[name] = wrapped;
      try{ eval(name + '=window[name]'); }catch(e){}
    });
  }
  function patchNowEmptyText(){
    var old = window.renderScheduleNow;
    if(typeof old !== 'function' || old.__v05418ei) return;
    window.renderScheduleNow = function(){
      var out = old.apply(this, arguments);
      try{
        var d = window.scheduleNowData || (typeof scheduleNowData !== 'undefined' ? scheduleNowData : null) || {};
        var box = by('scheduleNowBox');
        if(box && /No published schedule is currently active/i.test(clean(box.textContent || '')) && /outside/i.test(clean(d.status || d.unavailableReason || d.reason || ''))){
          box.innerHTML = '<div class="muted">Current time is outside active schedule hours.</div>';
        }
      }catch(e){}
      return out;
    };
    window.renderScheduleNow.__v05418ei = true;
    try{ renderScheduleNow = window.renderScheduleNow; }catch(e){}
  }
  function installCss(){
    if(by('v05418eiCss')) return;
    var s = document.createElement('style'); s.id = 'v05418eiCss';
    s.textContent = '.splitChipV05418EI{display:block!important;margin-top:4px!important}.splitChipV05418EI span{display:inline-block!important;border:1px solid #bfdbfe!important;background:#eff6ff!important;color:#1d4ed8!important;border-radius:999px!important;padding:2px 7px!important;font-size:10px!important;font-weight:850!important;line-height:1.25!important}';
    document.head.appendChild(s);
  }
  function boot(){
    installCss(); wrapStudentFns(); patchNowEmptyText(); dedupeStudentPeriodRows(); refreshSplitFlags(true);
    var target = by('studentPeriodRows');
    if(target && window.MutationObserver){
      var pending = false;
      new MutationObserver(function(){
        if(pending) return; pending = true;
        setTimeout(function(){ pending = false; dedupeStudentPeriodRows(); refreshSplitFlags(false); }, 60);
      }).observe(target, { childList:true, subtree:true });
    }
    document.addEventListener('click', function(e){ if(e.target && e.target.closest && e.target.closest('[data-student-row],#studentList button,[data-action="student-save"]')) setTimeout(function(){ dedupeStudentPeriodRows(); refreshSplitFlags(true); }, 180); }, true);
    document.addEventListener('change', function(e){ var id = e.target && e.target.id; if(/^(studentName|campusSelector|schoolSelector|schoolSelect|siteSelector)$/.test(id || '')) setTimeout(function(){ dedupeStudentPeriodRows(); refreshSplitFlags(true); }, 160); }, true);
    setInterval(function(){ wrapStudentFns(); dedupeStudentPeriodRows(); }, 2500);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.gaV05418EIStudentDiag = function(){ return {version:VERSION, rows:qa('#studentPeriodRows tr').length, student:currentStudentName()}; };
})();

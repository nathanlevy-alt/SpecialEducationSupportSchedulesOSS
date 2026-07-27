(function(){
  'use strict';
  if(window.__V05418EG_SPLIT_BREAK_LUNCH_PERSISTENCE__) return;
  window.__V05418EG_SPLIT_BREAK_LUNCH_PERSISTENCE__ = true;
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
  function esc(v){ try{ if(typeof window.esc === 'function') return window.esc(v); }catch(e){} return clean(v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c; }); }
  function by(id){ return document.getElementById(id); }
  function qa(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function currentStudentName(){
    var el = by('studentName'); if(el && clean(el.value)) return clean(el.value);
    try{ if(window.currentStudent && (currentStudent.name || currentStudent.student)) return clean(currentStudent.name || currentStudent.student); }catch(e){}
    try{ if(window.selectedStudent && (selectedStudent.name || selectedStudent.student)) return clean(selectedStudent.name || selectedStudent.student); }catch(e2){}
    return '';
  }
  function selectedSchool(){
    var el = by('campusSelector') || by('schoolSelector') || by('schoolSelect') || by('siteSelector');
    if(el && clean(el.value)) return clean(el.value);
    try{ if(window.campusContextV5253 && campusContextV5253.selectedCampusId) return clean(campusContextV5253.selectedCampusId); }catch(e){}
    return '';
  }
  function labelForItem(item){
    item = clean(item); var maps=[];
    try{ maps.push((window.studentData||{}).itemLabels||{}); maps.push((window.scheduleData||{}).itemLabels||{}); }catch(e){}
    for(var m=0;m<maps.length;m++){
      var map=maps[m]||{}; if(map[item]) return clean(map[item]);
      var keys=Object.keys(map); for(var i=0;i<keys.length;i++){ if(norm(keys[i])===norm(item)) return clean(map[keys[i]]); }
    }
    return item;
  }
  function recRows(rec){
    rec = rec || {}; var rows = [];
    if(Array.isArray(rec.splitPeriodSupport)) rows = rec.splitPeriodSupport.slice();
    else if(Array.isArray(rec.splitPeriodSupportParsed)) rows = rec.splitPeriodSupportParsed.slice();
    return rows.filter(function(r){ return r && typeof r === 'object'; });
  }
  function rowMatches(row,item){
    var wanted = norm(row.item || row.period || row.key || row.label || row.displayName || row.title || '');
    if(!wanted) return false;
    return [item,labelForItem(item)].some(function(v){ return norm(v) === wanted; });
  }
  function rowLabel(row){
    var mode = clean(row.mode || row.windowMode || row.type || row.segment || row.position).toLowerCase();
    var min = clean(row.minutes || row.duration || row.minuteCount || row.lengthMinutes || row.splitWindowMinutes);
    var caption = clean(row.splitWindowCaption || '');
    if(caption) return caption;
    if(mode === 'first' && min) return 'First ' + min + ' min';
    if(mode === 'last' && min) return 'Last ' + min + ' min';
    if(mode === 'between' && min) return 'Between ' + min + ' min';
    if(row.splitWindowLabel) return clean(row.splitWindowLabel);
    if(row.start && row.end) return clean(row.start) + ' - ' + clean(row.end);
    return 'Split';
  }
  var localRecords = {};
  function keyFor(student){ return selectedSchool() + '||' + norm(student || currentStudentName()); }
  function remember(rec){
    rec = rec || {}; var student = clean(rec.student || currentStudentName()); if(!student) return rec;
    localRecords[keyFor(student)] = rec;
    try{ if(window.currentStudent) currentStudent.advancedScheduling = Object.assign({}, currentStudent.advancedScheduling || {}, rec); }catch(e){}
    try{ if(window.studentData && Array.isArray(studentData.students)){ studentData.students.forEach(function(st){ if(norm(st.name||st.student)===norm(student)) st.advancedScheduling = Object.assign({}, st.advancedScheduling || {}, rec); }); } }catch(e2){}
    return rec;
  }
  function cached(student){
    student = clean(student || currentStudentName()); if(!student) return null;
    var k = keyFor(student); if(localRecords[k]) return localRecords[k];
    try{ if(window.currentStudent && norm(currentStudent.name || currentStudent.student)===norm(student) && currentStudent.advancedScheduling) return currentStudent.advancedScheduling; }catch(e){}
    try{ if(window.studentData && Array.isArray(studentData.students)){ for(var i=0;i<studentData.students.length;i++){ var st=studentData.students[i]||{}; if(norm(st.name||st.student)===norm(student) && st.advancedScheduling) return st.advancedScheduling; } } }catch(e2){}
    return null;
  }
  function fetchAdvanced(student){
    student = clean(student || currentStudentName()); if(!student) return Promise.resolve(null);
    var params = new URLSearchParams(); params.set('student', student); var school = selectedSchool(); if(school) params.set('school', school); params.set('_', String(Date.now()));
    return fetch('/api/v05418x/student-advanced?' + params.toString(), {credentials:'same-origin', cache:'no-store'})
      .then(function(r){ return r.json(); })
      .then(function(j){ var rec = (j && (j.record || j.advancedScheduling)) || null; if(rec) remember(rec); return rec || cached(student); })
      .catch(function(){ return cached(student); });
  }
  function renderChipsFrom(rec){
    var rows = recRows(rec);
    qa('.splitChipV05418EG,.splitChipV05418EE').forEach(function(el){ if(el && el.parentNode) el.parentNode.removeChild(el); });
    if(!rows.length) return;
    qa('#studentPeriodRows tr').forEach(function(tr){
      var item = tr.getAttribute('data-item') || tr.getAttribute('data-student-period-item') || clean((tr.querySelector('td:first-child b,td:first-child')||{}).textContent || '').replace(/\bSplit\b.*$/i,'').trim();
      var matching = rows.filter(function(r){ return rowMatches(r,item); });
      if(!matching.length) return;
      var host = tr.querySelector('.rowChips,.periodChips,.chips') || tr.querySelector('td:first-child') || tr;
      var chip = document.createElement('span');
      chip.className = 'splitChipV05418EG advancedRowChipsV05418X chipV05418AE';
      chip.innerHTML = '<span>' + esc('Split: ' + matching.map(rowLabel).join(' + ')) + '</span>';
      host.appendChild(chip);
    });
  }
  var timer = null;
  function refresh(force){
    clearTimeout(timer);
    timer = setTimeout(function(){
      var student = currentStudentName(); if(!student) return;
      var snap = cached(student); if(snap) renderChipsFrom(snap);
      fetchAdvanced(student).then(function(rec){ if(rec) renderChipsFrom(rec); });
      setTimeout(function(){ var again = cached(student); if(again) renderChipsFrom(again); }, force ? 700 : 200);
    }, 60);
  }
  function wrapCollect(){
    var fn = window.collectStudent;
    if(typeof fn !== 'function' || fn.__v05418eg) return;
    var wrapped = function(){
      var p = fn.apply(this, arguments) || {};
      try{
        var rec = cached(p.name || currentStudentName());
        if(rec && recRows(rec).length){
          p.advancedScheduling = p.advancedScheduling || {};
          if(!Array.isArray(p.advancedScheduling.splitPeriodSupport) || !p.advancedScheduling.splitPeriodSupport.length) p.advancedScheduling.splitPeriodSupport = recRows(rec);
          if(rec.twoToOnePeriods && !p.advancedScheduling.twoToOnePeriods) p.advancedScheduling.twoToOnePeriods = rec.twoToOnePeriods;
          if(rec.twoToOneStaff && !p.advancedScheduling.twoToOneStaff) p.advancedScheduling.twoToOneStaff = rec.twoToOneStaff;
        }
      }catch(e){}
      return p;
    };
    wrapped.__v05418eg = true;
    window.collectStudent = wrapped;
    try{ collectStudent = window.collectStudent; }catch(e){}
  }
  function wrapSave(){
    var fn = window.saveStudent;
    if(typeof fn !== 'function' || fn.__v05418eg) return;
    var wrapped = function(){ var out = fn.apply(this, arguments); setTimeout(function(){ refresh(true); }, 250); setTimeout(function(){ refresh(true); }, 1200); return out; };
    wrapped.__v05418eg = true;
    window.saveStudent = wrapped;
    try{ saveStudent = window.saveStudent; }catch(e){}
  }
  function installCss(){
    if(by('v05418egSplitChipCss')) return;
    var s = document.createElement('style'); s.id = 'v05418egSplitChipCss';
    s.textContent = '.splitChipV05418EG{display:inline-flex!important;align-items:center!important;margin:3px 4px 0 0!important;vertical-align:middle!important}.splitChipV05418EG span{display:inline-block!important;border:1px solid #bfdbfe!important;background:#eff6ff!important;color:#1d4ed8!important;border-radius:999px!important;padding:2px 7px!important;font-size:10px!important;font-weight:850!important;line-height:1.25!important}';
    document.head.appendChild(s);
  }
  function boot(){
    installCss(); wrapCollect(); wrapSave(); refresh(true);
    ['selectStudent','renderStudentPeriodRows','loadStudentData','newStudent'].forEach(function(name){
      var fn = window[name]; if(typeof fn !== 'function' || fn.__v05418egChip) return;
      var w = function(){ var out = fn.apply(this, arguments); setTimeout(function(){ wrapCollect(); wrapSave(); refresh(true); }, 150); return out; };
      w.__v05418egChip = true; window[name] = w; try{ eval(name + '=window[name]'); }catch(e){}
    });
    document.addEventListener('click', function(e){ if(e.target && e.target.closest && e.target.closest('[data-student-row],#studentList button,[data-action="student-save"]')) setTimeout(function(){ wrapCollect(); wrapSave(); refresh(true); }, 160); }, true);
    document.addEventListener('change', function(e){ if(e.target && /^(studentName|campusSelector|schoolSelector|schoolSelect|siteSelector)$/.test(e.target.id || '')) setTimeout(function(){ refresh(true); }, 120); }, true);
    var target = by('studentPeriodRows'); if(target && window.MutationObserver){ new MutationObserver(function(){ refresh(false); }).observe(target,{childList:true,subtree:true}); }
    setInterval(function(){ wrapCollect(); wrapSave(); }, 2000);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

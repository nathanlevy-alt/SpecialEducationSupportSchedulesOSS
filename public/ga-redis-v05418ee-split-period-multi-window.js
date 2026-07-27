(function(){
  'use strict';
  if(window.__V05418EE_SPLIT_PERIOD_MULTI_WINDOW__) return;
  window.__V05418EE_SPLIT_PERIOD_MULTI_WINDOW__ = true;
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
  function esc(v){ try{ if(typeof window.esc === 'function') return window.esc(v); }catch(e){} return clean(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;}); }
  function by(id){ return document.getElementById(id); }
  function qa(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function currentStudentName(){
    var el=by('studentName'); if(el&&clean(el.value))return clean(el.value);
    try{ if(window.currentStudent&&(window.currentStudent.name||window.currentStudent.student))return clean(window.currentStudent.name||window.currentStudent.student); }catch(e){}
    try{ if(window.selectedStudent&&(window.selectedStudent.name||window.selectedStudent.student))return clean(window.selectedStudent.name||window.selectedStudent.student); }catch(e2){}
    var active=document.querySelector('#studentList button.active,[data-student-row].active'); if(active)return clean(active.textContent||'');
    return '';
  }
  function selectedSchool(){
    var el=by('campusSelector')||by('schoolSelector')||by('schoolSelect')||by('siteSelector');
    if(el&&clean(el.value))return clean(el.value);
    try{ if(window.campusContextV5253&&window.campusContextV5253.selectedCampusId)return clean(window.campusContextV5253.selectedCampusId); }catch(e){}
    return '';
  }
  function labelForItem(item){
    item=clean(item); var maps=[];
    try{ maps.push((window.studentData||{}).itemLabels||{}); maps.push((window.scheduleData||{}).itemLabels||{}); }catch(e){}
    for(var m=0;m<maps.length;m++){
      var map=maps[m]||{}; if(map[item])return clean(map[item]);
      var keys=Object.keys(map); for(var i=0;i<keys.length;i++){ if(norm(keys[i])===norm(item))return clean(map[keys[i]]); }
    }
    return item;
  }
  function splitRows(rec){
    rec=rec||{}; var rows=[];
    if(Array.isArray(rec.splitPeriodSupport))rows=rec.splitPeriodSupport.slice();
    else if(Array.isArray(rec.splitPeriodSupportParsed))rows=rec.splitPeriodSupportParsed.slice();
    return rows.filter(function(r){return r&&typeof r==='object';});
  }
  function rowMatches(row,item){
    var wanted=norm(row.item||row.period||row.key||row.label||row.displayName||row.title||''); if(!wanted)return false;
    var vals=[item,labelForItem(item)];
    return vals.some(function(v){return norm(v)===wanted;});
  }
  function rowLabel(row){
    var mode=clean(row.mode||row.windowMode||row.type||row.segment||row.position).toLowerCase();
    var min=clean(row.minutes||row.duration||row.minuteCount||row.lengthMinutes);
    if(mode==='first')return 'First '+min+' min';
    if(mode==='last')return 'Last '+min+' min';
    if(mode==='between')return 'Between '+min+' min';
    if(row.splitWindowLabel)return clean(row.splitWindowLabel);
    if(row.start&&row.end)return clean(row.start)+' - '+clean(row.end);
    return 'Split';
  }
  var cache={};
  function cacheKey(student){ return selectedSchool()+'||'+norm(student); }
  function fetchAdvanced(student){
    student=clean(student||currentStudentName()); if(!student)return Promise.resolve(null);
    var key=cacheKey(student); if(cache[key])return Promise.resolve(cache[key]);
    var url='/api/v05418x/student-advanced?student='+encodeURIComponent(student);
    var school=selectedSchool(); if(school)url+='&school='+encodeURIComponent(school);
    return fetch(url,{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){var rec=(j&&(j.record||j.advancedScheduling||j))||{}; cache[key]=rec; try{ if(window.currentStudent)window.currentStudent.advancedScheduling=rec; }catch(e){} return rec;}).catch(function(){return null;});
  }
  function renderChips(rec){
    rec=rec||{}; var rows=splitRows(rec);
    qa('.splitChipV05418EE').forEach(function(el){ if(el&&el.parentNode)el.parentNode.removeChild(el); });
    qa('#studentPeriodRows tr').forEach(function(tr){
      var item=tr.getAttribute('data-item')||tr.getAttribute('data-student-period-item')||clean((tr.querySelector('td:first-child b,td:first-child')||{}).textContent||'');
      var matching=rows.filter(function(r){return rowMatches(r,item);});
      if(!matching.length)return;
      var host=tr.querySelector('.rowChips,.periodChips,.chips')||tr.querySelector('td:first-child')||tr;
      var chip=document.createElement('span');
      chip.className='splitChipV05418EE advancedRowChipsV05418X chipV05418AE';
      chip.innerHTML='<span>'+esc(matching.length===1?('Split: '+rowLabel(matching[0])):('Split: '+matching.map(rowLabel).join(' + ')))+'</span>';
      host.appendChild(chip);
    });
  }
  var timer=null;
  function refreshChips(force){
    clearTimeout(timer);
    timer=setTimeout(function(){
      var student=currentStudentName(); if(!student)return;
      if(force){ delete cache[cacheKey(student)]; }
      fetchAdvanced(student).then(function(rec){ if(rec)renderChips(rec); });
    },80);
  }
  function wrap(name){
    var fn=window[name]; if(typeof fn!=='function'||fn.__v05418ee)return;
    var w=function(){ var res=fn.apply(this,arguments); setTimeout(function(){refreshChips(true);},150); return res; };
    w.__v05418ee=true; window[name]=w; try{ eval(name+'=window[name]'); }catch(e){}
  }
  function installCss(){
    if(by('v05418eeSplitChipCss'))return;
    var s=document.createElement('style'); s.id='v05418eeSplitChipCss';
    s.textContent='.splitChipV05418EE{display:inline-flex!important;align-items:center!important;margin:3px 4px 0 0!important;vertical-align:middle!important}.splitChipV05418EE span{display:inline-block!important;border:1px solid #bfdbfe!important;background:#eff6ff!important;color:#1d4ed8!important;border-radius:999px!important;padding:2px 7px!important;font-size:10px!important;font-weight:800!important;line-height:1.25!important}';
    document.head.appendChild(s);
  }
  function boot(){
    installCss();
    ['selectStudent','renderStudentPeriodRows','loadStudentData','saveStudent'].forEach(wrap);
    document.addEventListener('change',function(e){ if(e.target&&/^(studentName|campusSelector|schoolSelector|schoolSelect|siteSelector)$/.test(e.target.id||''))refreshChips(true); },true);
    document.addEventListener('input',function(e){ if(e.target&&e.target.id==='studentName')refreshChips(true); },true);
    document.addEventListener('click',function(e){ if(e.target&&e.target.closest&&e.target.closest('[data-student-row],#studentList button'))setTimeout(function(){refreshChips(true);},150); },true);
    var target=by('studentPeriodRows'); if(target&&window.MutationObserver){ new MutationObserver(function(){refreshChips(false);}).observe(target,{childList:true,subtree:true}); }
    setTimeout(function(){refreshChips(true);},400);
    setTimeout(function(){refreshChips(true);},1400);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

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

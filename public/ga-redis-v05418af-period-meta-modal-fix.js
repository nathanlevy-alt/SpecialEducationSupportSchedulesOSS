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

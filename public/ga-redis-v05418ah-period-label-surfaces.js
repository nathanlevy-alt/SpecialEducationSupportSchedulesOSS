(function(){
  'use strict';
  if (window.__GA_REDIS_V05418AH_PERIOD_LABEL_SURFACES__) return;
  window.__GA_REDIS_V05418AH_PERIOD_LABEL_SURFACES__ = true;
  var VERSION = '0.54.18ah';
  var SOURCE_KEY = '__bellDisplaySourceV05418AE';

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
  function esc(v){ return clean(v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function uniqPush(list, value){ value = clean(value); if (value && list.indexOf(value) < 0) list.push(value); }
  function source(){ return window[SOURCE_KEY] || {}; }
  function sources(){
    return [source(), window.advancedSetupDataV5131, window.scheduleData, window.studentData, window.staffData, window.scheduleViewsData].filter(function(x){ return x && typeof x === 'object'; });
  }
  function coreOrder(){ return ['Period 1','Period 2','Period 3','Period 4','Period 5','Period 6','Break','Lunch']; }
  function stripScope(v){
    var s = clean(v);
    s = s.replace(/^campus_[a-z0-9_]+__/i, '');
    s = s.replace(/^school_[a-z0-9_]+__/i, '');
    s = s.replace(/^site_[a-z0-9_]+__/i, '');
    return s.replace(/_/g, ' ').trim();
  }
  function periodNumber(v){
    var s = stripScope(v);
    var m = s.match(/^period\s*(\d+)$/i);
    if (m) return Number(m[1]);
    m = clean(v).match(/(?:^|[_\s])period[_\s]*(\d+)(?:$|[_\s])/i);
    return m ? Number(m[1]) : null;
  }
  function isBreakLunch(v){ var n = norm(stripScope(v)); return n === 'break' || n === 'lunch'; }
  function defaultPeriodLabel(v){
    var n = periodNumber(v);
    if (n != null) return 'Period ' + n;
    var stripped = stripScope(v);
    if (stripped) return stripped.replace(/\b\w/g, function(m){ return m.toUpperCase(); });
    return clean(v);
  }
  function isDefaultPeriodName(v){ return /^period\s*\d+$/i.test(clean(v)); }
  function labelPriority(display, raw){
    display = clean(display); raw = clean(raw);
    if (!display) return 0;
    if (norm(display) === norm(raw)) return 1;
    if (isDefaultPeriodName(display)) return 2;
    return 5;
  }
  function addAlias(cat, raw, display, sourceName){
    raw = clean(raw); display = clean(display || raw);
    if (!raw || !display) return;
    var p = labelPriority(display, raw);
    var aliases = [raw, stripScope(raw), defaultPeriodLabel(raw)];
    var n = periodNumber(raw);
    if (n != null) aliases.push('Period ' + n, 'period_' + n, 'campus_top__period_' + n, 'campus_top_period_' + n);
    aliases.forEach(function(a){
      a = clean(a);
      var k = norm(a);
      if (!k) return;
      var old = cat.alias[k];
      if (!old || p >= old.priority) cat.alias[k] = { label: display, priority: p, raw: raw, source: sourceName || '' };
    });
    if (n != null) {
      var oldNum = cat.byNumber[n];
      if (!oldNum || p >= oldNum.priority) cat.byNumber[n] = { label: display, priority: p, raw: raw, source: sourceName || '' };
    }
  }
  function addRow(cat, row, sourceName){
    if (!row) return;
    var raw = clean(row.key || row.item || row.period || row.name || row.label || row.displayName);
    if (!raw) return;
    var display = clean(row.displayName || row.title || row.label || row.name || (source().itemLabels || {})[raw] || raw);
    addAlias(cat, raw, display, sourceName);
    cat.metaIdentity[identity(raw)] = true;
    cat.metaRows.push({ key: raw, displayName: display, blockType: clean(row.blockType || row.type || '') });
  }
  function identity(raw){
    var n = periodNumber(raw);
    if (n != null) return 'period:' + n;
    var b = norm(stripScope(raw));
    if (b === 'break' || b === 'lunch') return b;
    return 'label:' + b;
  }
  var cachedCatalog = null;
  var cachedStamp = '';
  function catalog(){
    var stampParts = [];
    sources().forEach(function(d){
      try { stampParts.push(JSON.stringify({ labels:d.itemLabels || {}, meta:d.periodMeta || [], order:d.itemOrder || d.items || d.periods || [] }).slice(0,4000)); } catch(e) { stampParts.push(String(Math.random())); }
    });
    var stamp = stampParts.join('|');
    if (cachedCatalog && stamp === cachedStamp) return cachedCatalog;
    var cat = { alias:{}, byNumber:{}, metaIdentity:{}, metaRows:[] };
    coreOrder().forEach(function(k){ addAlias(cat, k, k, 'core'); cat.metaIdentity[identity(k)] = true; });
    sources().forEach(function(d, idx){
      var name = 'source' + idx;
      var labels = d.itemLabels || d.labels || {};
      Object.keys(labels || {}).forEach(function(k){ addAlias(cat, k, labels[k], name + ':labels'); });
      (d.periodMeta || []).forEach(function(r){ addRow(cat, r, name + ':periodMeta'); });
    });
    cachedCatalog = cat;
    cachedStamp = stamp;
    return cat;
  }
  function visibleLabel(raw){
    raw = clean(raw);
    if (!raw) return '';
    var cat = catalog();
    var exact = cat.alias[norm(raw)];
    if (exact && exact.label) return exact.label;
    var stripped = stripScope(raw);
    var strippedHit = cat.alias[norm(stripped)];
    if (strippedHit && strippedHit.label) return strippedHit.label;
    var n = periodNumber(raw);
    if (n != null && cat.byNumber[n] && cat.byNumber[n].label) return cat.byNumber[n].label;
    if (/^(campus|school|site)_/i.test(raw)) return defaultPeriodLabel(raw);
    return raw;
  }
  function hasMetaFor(raw){ return !!catalog().metaIdentity[identity(raw)]; }
  function isOrphanScoped(raw){
    raw = clean(raw);
    if (!/^(campus|school|site)_/i.test(raw)) return false;
    var n = periodNumber(raw);
    return n != null && !hasMetaFor(raw);
  }
  function isEmptyAssignmentRow(row){
    if (!row) return true;
    var p = row.primary, s = row.secondary;
    if (Array.isArray(p) && p.length) return false;
    if (Array.isArray(s) && s.length) return false;
    if (clean(p) || clean(s)) return false;
    return true;
  }
  function addListItem(list, seen, raw, allowOrphan){
    raw = clean(raw);
    if (!raw) return;
    if (!allowOrphan && isOrphanScoped(raw)) return;
    var label = visibleLabel(raw);
    var key = norm(label) || identity(raw);
    if (seen[key]) return;
    seen[key] = true;
    list.push(raw);
  }
  function schoolPeriodItems(opts){
    opts = opts || {};
    var out = [], seen = {};
    var src = source();
    (src.periodMeta || []).forEach(function(r){ addListItem(out, seen, r && (r.key || r.item || r.name || r.displayName), opts.allowOrphans); });
    sources().forEach(function(d){ (d.periodMeta || []).forEach(function(r){ addListItem(out, seen, r && (r.key || r.item || r.name || r.displayName), opts.allowOrphans); }); });
    coreOrder().forEach(function(k){ addListItem(out, seen, k, true); });
    if (opts.includeDataItems) {
      sources().forEach(function(d){
        [].concat(d.itemOrder || [], d.items || [], d.periods || [], d.scheduleTemplateItems || []).forEach(function(it){ addListItem(out, seen, typeof it === 'string' ? it : (it && (it.key || it.item || it.label || it.name || it.displayName)), opts.allowOrphans); });
      });
      try { Object.keys((window.currentStudent && window.currentStudent.periods) || {}).forEach(function(k){ addListItem(out, seen, k, true); }); } catch(e) {}
    }
    return out;
  }
  function periodRecordFor(student, item){
    var periods = (student && student.periods) || {};
    if (periods[item]) return periods[item];
    var itemId = identity(item);
    var itemLabel = norm(visibleLabel(item));
    var keys = Object.keys(periods);
    for (var i=0; i<keys.length; i++) {
      var k = keys[i];
      if (identity(k) === itemId || norm(visibleLabel(k)) === itemLabel || norm(k) === norm(item)) return periods[k];
    }
    return {};
  }
  function setSelectValue(sel, value){
    if (!sel) return;
    value = clean(value);
    if (!value) { sel.value = ''; return; }
    sel.value = value;
    if (sel.value === value) return;
    var opts = Array.prototype.slice.call(sel.options || []);
    var hit = opts.find(function(o){ return norm(o.value) === norm(value) || norm(o.textContent) === norm(value) || norm(visibleLabel(o.value)) === norm(value); });
    if (hit) sel.value = hit.value;
  }
  function optionList(values, selected){
    values = Array.isArray(values) ? values : [];
    return values.map(function(v){ var sel = clean(v) === clean(selected) ? ' selected' : ''; return '<option value="' + esc(v) + '"' + sel + '>' + esc(visibleLabel(v)) + '</option>'; }).join('');
  }
  function nativeOptionList(values, selected){
    if (typeof window.optionList === 'function') return window.optionList(values, selected);
    values = Array.isArray(values) ? values : [];
    return values.map(function(v){ return '<option value="' + esc(v) + '"' + (clean(v)===clean(selected)?' selected':'') + '>' + esc(v) + '</option>'; }).join('');
  }
  function patchGlobals(){
    ['periodDisplayNameV5140','studentItemLabelV5141','staffScheduleItemLabelV5154','displayPeriodLabelClientV5323'].forEach(function(name){
      var base = window[name];
      if (base && base.__v05418ah) return;
      var fn = function(item){
        var label = visibleLabel(item);
        if (label && label !== clean(item)) return label;
        if (typeof base === 'function') {
          try {
            var b = clean(base.apply(this, arguments));
            if (b && !/^(campus|school|site)_/i.test(b)) return visibleLabel(b);
          } catch(e) {}
        }
        return label || clean(item);
      };
      fn.__v05418ah = true;
      window[name] = fn;
      try { window.eval(name + ' = window["' + name + '"];'); } catch(e2) {}
    });
  }
  function patchStudentSurfaces(){
    var basePopulate = window.populateStudentStatic;
    if (basePopulate && !basePopulate.__v05418ah) {
      var pop = function(){
        try { if (basePopulate && basePopulate !== pop) basePopulate.apply(this, arguments); } catch(e) {}
        var copy = by('copyFrom');
        if (copy) copy.innerHTML = optionList(schoolPeriodItems({ includeDataItems:true, allowOrphans:false }), copy.value);
      };
      pop.__v05418ah = true;
      window.populateStudentStatic = pop;
      try { window.eval('populateStudentStatic = window.populateStudentStatic;'); } catch(e) {}
    }
    var baseRender = window.renderStudentPeriodRows;
    if (baseRender && !baseRender.__v05418ah) {
      var render = function(){
        if (!window.studentData) { try { return baseRender.apply(this, arguments); } catch(e) { return; } }
        var box = by('studentPeriodRows');
        if (!box) return baseRender.apply(this, arguments);
        var items = schoolPeriodItems({ includeDataItems:true, allowOrphans:false });
        if (!items.length) items = (window.studentData.items || coreOrder()).slice();
        function locOptions(item){ try { if (typeof window.studentLocationOptionsV5150 === 'function') return window.studentLocationOptionsV5150(item); } catch(e) {} return (window.studentData && window.studentData.locations) || []; }
        function supportKinds(){ return (window.studentData && window.studentData.supportNeedTypes) || ['N/A','Behavior','Instruction']; }
        function degreeHtml(){ try { if (typeof window.studentDegreeOptionsHtmlV5278 === 'function') return window.studentDegreeOptionsHtmlV5278(''); } catch(e) {} return nativeOptionList((window.studentData && window.studentData.supportLevels) || ['N/A'], 'N/A'); }
        function staffHtml(){ try { if (typeof window.studentStaffOptionsV5271 === 'function') return window.studentStaffOptionsV5271('N/A',''); } catch(e) {} return '<option value=""></option>'; }
        box.innerHTML = items.map(function(item){
          var label = visibleLabel(item);
          return '<tr data-item="' + esc(item) + '"><td><b>' + esc(label) + '</b><div class="studentRowWarnings"></div></td>' +
            '<td><select class="studentLoc">' + nativeOptionList(locOptions(item), '') + '</select></td>' +
            '<td><select class="studentSupportKind">' + nativeOptionList(supportKinds(), 'N/A') + '</select></td>' +
            '<td><select class="studentSupport">' + degreeHtml() + '</select></td>' +
            '<td><select class="studentPrimary">' + staffHtml() + '</select></td>' +
            '<td><select class="studentSecondary">' + staffHtml() + '</select></td>' +
            '<td class="copyTargetCell"><label class="muted"><input type="checkbox" class="copyTargetBox" value="' + esc(item) + '"> Copy here</label></td></tr>';
        }).join('');
        try { if (typeof window.syncAllStudentDegreeRows === 'function') window.syncAllStudentDegreeRows(); } catch(e2) {}
        relabelDom();
      };
      render.__v05418ah = true;
      window.renderStudentPeriodRows = render;
      try { window.eval('renderStudentPeriodRows = window.renderStudentPeriodRows;'); } catch(e) {}
    }
    var baseSelect = window.selectStudent;
    if (baseSelect && !baseSelect.__v05418ah) {
      var sel = function(row, skipDirtyGuard){
        var ret = baseSelect.apply(this, arguments);
        setTimeout(function(){
          var s = window.currentStudent;
          if (!s) return;
          qsa('#studentPeriodRows tr').forEach(function(tr){
            var item = tr.getAttribute('data-item');
            var p = periodRecordFor(s, item);
            setSelectValue(tr.querySelector('.studentLoc'), p.location);
            setSelectValue(tr.querySelector('.studentSupport'), p.support || 'N/A');
            setSelectValue(tr.querySelector('.studentSupportKind'), p.supportType || 'N/A');
            setSelectValue(tr.querySelector('.studentPrimary'), p.primary);
            setSelectValue(tr.querySelector('.studentSecondary'), p.secondary);
          });
          try { if (typeof window.syncAllStudentDegreeRows === 'function') window.syncAllStudentDegreeRows(); } catch(e) {}
          relabelDom();
        }, 0);
        return ret;
      };
      sel.__v05418ah = true;
      window.selectStudent = sel;
      try { window.eval('selectStudent = window.selectStudent;'); } catch(e) {}
    }
  }
  function patchStaffSurfaces(){
    var basePopulate = window.populateStaffStatic;
    if (basePopulate && !basePopulate.__v05418ah) {
      var pop = function(){
        try { if (basePopulate && basePopulate !== pop) basePopulate.apply(this, arguments); } catch(e) {}
        var items = schoolPeriodItems({ includeDataItems:true, allowOrphans:false });
        var hold = by('holdPeriod');
        if (hold) hold.innerHTML = nativeOptionList(['Coach'].concat(items), hold.value || '');
        try { if (typeof window.refreshStaffPeriodPlaceholdersV5323 === 'function') window.refreshStaffPeriodPlaceholdersV5323(); } catch(e2) {}
        relabelDom();
      };
      pop.__v05418ah = true;
      window.populateStaffStatic = pop;
      try { window.eval('populateStaffStatic = window.populateStaffStatic;'); } catch(e) {}
    }
    var baseSchedule = window.renderStaffOnPaperSchedule;
    if (baseSchedule && !baseSchedule.__v05418ah) {
      var sched = function(rows){
        rows = rows || [];
        var box = by('staffOnPaperSchedule');
        if (!box) return baseSchedule.apply(this, arguments);
        var filtered = rows.filter(function(r){ return !(isOrphanScoped(r && r.item) && isEmptyAssignmentRow(r)); });
        var html = '<table class="onPaperTable"><thead><tr><th>Item</th><th>Primary</th><th>Secondary</th></tr></thead><tbody>';
        html += filtered.map(function(r){
          return '<tr data-item="' + esc(r.item || '') + '"><td><b>' + esc(visibleLabel(r.item || '')) + '</b></td><td>' + ((r.primary && r.primary.length) ? r.primary.map(esc).join('<br>') : '<span class="empty">None</span>') + '</td><td>' + ((r.secondary && r.secondary.length) ? r.secondary.map(esc).join('<br>') : '<span class="empty">None</span>') + '</td></tr>';
        }).join('');
        html += '</tbody></table>';
        box.innerHTML = html;
      };
      sched.__v05418ah = true;
      window.renderStaffOnPaperSchedule = sched;
      try { window.eval('renderStaffOnPaperSchedule = window.renderStaffOnPaperSchedule;'); } catch(e) {}
    }
    var baseEditor = window.renderStaffOnPaperEditor;
    if (baseEditor && !baseEditor.__v05418ah) {
      var editor = function(){
        var body = by('onPaperEditorBody');
        if (!body || !window.currentStaff) return baseEditor.apply(this, arguments);
        var items = schoolPeriodItems({ includeDataItems:true, allowOrphans:false });
        var staffName = clean(window.currentStaff && window.currentStaff.name);
        function optionsFor(item, role){
          var out = [];
          ((window.staffData && window.staffData.studentDetails) || []).forEach(function(stu){
            var p = periodRecordFor(stu, item);
            var loc = clean(p.location), sup = clean(p.support), kind = clean(p.supportType || p.studentSupportType);
            var locN = norm(loc), supN = norm(sup);
            var needs = loc && locN !== 'na' && locN !== 'n a' && sup && supN !== 'na' && supN !== 'n a';
            if (!needs) return;
            var selected = norm(p[role] || '') === norm(staffName);
            var meta = [];
            if (loc) meta.push(loc);
            if (kind && norm(kind) !== 'na' && norm(kind) !== 'n a') meta.push(kind);
            if (sup) meta.push(sup);
            out.push('<option value="' + esc(stu.name) + '"' + (selected ? ' selected' : '') + '>' + esc(stu.name + ' - ' + meta.join(' / ')) + '</option>');
          });
          return out.length ? out.join('') : '<option disabled>No support needs for this item.</option>';
        }
        var html = '<div class="onPaperEditGrid">' + items.map(function(item){
          return '<section class="onPaperPeriodCard" data-item="' + esc(item) + '"><div class="onPaperPeriodTitle">' + esc(visibleLabel(item)) + '</div><div class="onPaperPickers"><div class="onPaperPicker"><label>Primary</label><select multiple class="onPaperPrimary">' + optionsFor(item,'primary') + '</select></div><div class="onPaperPicker"><label>Secondary</label><select multiple class="onPaperSecondary">' + optionsFor(item,'secondary') + '</select></div></div></section>';
        }).join('') + '</div>';
        body.innerHTML = html;
        var help = by('onPaperEditorHelp');
        if (help) help.textContent = 'Editing ' + (window.currentStaff.name || 'staff') + '. Select student(s) by custom period name; location, degree of support, and support type come from each student schedule.';
      };
      editor.__v05418ah = true;
      window.renderStaffOnPaperEditor = editor;
      try { window.eval('renderStaffOnPaperEditor = window.renderStaffOnPaperEditor;'); } catch(e) {}
    }
  }
  function relabelSelect(sel, filterOrphans){
    if (!sel || !sel.options) return;
    var remove = [];
    Array.prototype.slice.call(sel.options).forEach(function(opt){
      var value = clean(opt.value || opt.textContent);
      if (filterOrphans && isOrphanScoped(value)) { remove.push(opt); return; }
      var label = visibleLabel(value);
      if (label && opt.textContent !== label) opt.textContent = label;
    });
    remove.forEach(function(opt){ if (opt.parentNode) opt.parentNode.removeChild(opt); });
  }
  function relabelDom(){
    qsa('#staffOnPaperSchedule tr[data-item] td:first-child b,#onPaperEditorBody [data-item] .onPaperPeriodTitle,#studentPeriodRows tr[data-item] td:first-child b,#scheduleRows tr[data-item] td:first-child b,.schedulePeriod').forEach(function(el){
      var row = el.closest('[data-item]');
      var value = row ? row.getAttribute('data-item') : clean(el.textContent);
      var label = visibleLabel(value);
      if (label && el.textContent !== label) el.textContent = label;
    });
    ['copyFrom','holdPeriod','staffLunchPreference','staffBreakPreference'].forEach(function(id){ relabelSelect(by(id), false); });
    qsa('#advancedSchedulingModalV05418X select,[data-split-item-v05418ae]').forEach(function(sel){ relabelSelect(sel, true); });
  }
  function decorateAdvancedModal(){
    var modal = by('advancedSchedulingModalV05418X');
    if (!modal || !modal.classList.contains('active')) return;
    relabelDom();
    var card = modal.querySelector('.modalBox,.modalCard');
    if (card) card.classList.add('advancedSchedulingCardV05418AH');
    var header = modal.querySelector('.modalHeader,.modalTitleRow');
    if (header) header.classList.add('advancedSchedulingHeaderV05418AH');
    var footer = modal.querySelector('.modalFooter,.toolbar');
    if (footer) footer.classList.add('advancedSchedulingFooterV05418AH');
    qsa('[data-save-adv-v05418ae],#saveAdvancedSchedulingV05418X', modal).forEach(function(btn){ btn.classList.add('btn','primary'); if (clean(btn.textContent).toLowerCase().indexOf('save') >= 0) btn.textContent = 'Save Advanced Scheduling'; });
    qsa('[data-close-adv-v05418ae],[data-close-adv-v05418x]', modal).forEach(function(btn){ if (!btn.classList.contains('modalCloseX')) btn.classList.add('btn'); });
    qsa('.secondaryBtn', modal).forEach(function(btn){ btn.classList.add('btn'); });
    qsa('.primaryBtn', modal).forEach(function(btn){ btn.classList.add('btn','primary'); });
  }
  function installCss(){
    if (by('v05418ah-period-label-style')) return;
    var st = document.createElement('style');
    st.id = 'v05418ah-period-label-style';
    st.textContent = [
      '#advancedSchedulingModalV05418X{background:rgba(15,23,42,.42)!important;padding:56px 18px 18px!important;align-items:flex-start!important;}',
      '#advancedSchedulingModalV05418X .advancedSchedulingCardV05418AH,#advancedSchedulingModalV05418X .modalBox,#advancedSchedulingModalV05418X .modalCard{width:min(900px,94vw)!important;max-width:min(900px,94vw)!important;background:#fff!important;border:1px solid #dbe3ef!important;border-radius:18px!important;box-shadow:0 24px 72px rgba(15,23,42,.30)!important;padding:0!important;overflow:hidden!important;color:#0f172a!important;}',
      '#advancedSchedulingModalV05418X .advancedSchedulingHeaderV05418AH,#advancedSchedulingModalV05418X .modalHeader,#advancedSchedulingModalV05418X .modalTitleRow{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;background:#fff!important;border-bottom:1px solid #e5e7eb!important;padding:16px 18px!important;margin:0!important;position:sticky!important;top:0!important;z-index:3!important;}',
      '#advancedSchedulingModalV05418X .modalBody{padding:16px 18px!important;}',
      '#advancedSchedulingModalV05418X .advancedSchedulingFooterV05418AH,#advancedSchedulingModalV05418X .modalFooter,#advancedSchedulingModalV05418X .toolbar{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;background:#fff!important;border-top:1px solid #e5e7eb!important;padding:12px 18px!important;margin:0!important;position:sticky!important;bottom:0!important;z-index:3!important;}',
      '#advancedSchedulingModalV05418X .modalCloseX{border:0!important;background:transparent!important;color:#64748b!important;font-size:28px!important;line-height:1!important;padding:2px 6px!important;border-radius:999px!important;cursor:pointer!important;}',
      '#advancedSchedulingModalV05418X .modalCloseX:hover{background:#f1f5f9!important;color:#0f172a!important;}',
      '#advancedSchedulingModalV05418X .splitSupportExplainV05418AE{background:#f8fafc!important;border:1px solid #dbeafe!important;border-radius:12px!important;padding:12px!important;color:#334155!important;line-height:1.35!important;}',
      '#advancedSchedulingModalV05418X .splitRowsV05418AE{display:flex!important;flex-direction:column!important;gap:10px!important;margin:12px 0 8px!important;}',
      '#advancedSchedulingModalV05418X .splitRowV05418AE{display:grid!important;grid-template-columns:minmax(220px,1.35fr) minmax(130px,.75fr) minmax(130px,.75fr) 42px!important;gap:10px!important;align-items:center!important;background:#fff!important;border:1px solid #dbe3ef!important;border-radius:14px!important;padding:10px!important;box-shadow:0 1px 2px rgba(15,23,42,.04)!important;}',
      '#advancedSchedulingModalV05418X .splitRowV05418AE select,#advancedSchedulingModalV05418X .splitRowV05418AE input{height:40px!important;width:100%!important;min-width:0!important;border:1px solid #cbd5e1!important;border-radius:10px!important;padding:0 12px!important;background:#fff!important;color:#0f172a!important;font-size:14px!important;box-sizing:border-box!important;}',
      '#advancedSchedulingModalV05418X .addSplitV05418AE{display:inline-flex!important;align-items:center!important;gap:6px!important;border:1px solid #2563eb!important;color:#1d4ed8!important;background:#fff!important;border-radius:999px!important;padding:8px 14px!important;font-weight:800!important;cursor:pointer!important;}',
      '#advancedSchedulingModalV05418X .removeSplitV05418AE{width:38px!important;height:38px!important;border:0!important;border-radius:10px!important;background:#fee2e2!important;color:#b91c1c!important;font-weight:900!important;font-size:18px!important;cursor:pointer!important;}',
      '#advancedSchedulingModalV05418X .btn{border:1px solid #cbd5e1!important;background:#fff!important;color:#0f172a!important;border-radius:10px!important;height:36px!important;padding:0 14px!important;font-weight:700!important;cursor:pointer!important;}',
      '#advancedSchedulingModalV05418X .btn.primary{border-color:#2563eb!important;background:#2563eb!important;color:#fff!important;}',
      '#advancedSchedulingModalV05418X .splitHintV05418AE{color:#64748b!important;font-size:12px!important;margin-top:6px!important;}',
      '@media(max-width:720px){#advancedSchedulingModalV05418X{padding:42px 10px 10px!important}#advancedSchedulingModalV05418X .splitRowV05418AE{grid-template-columns:1fr!important}#advancedSchedulingModalV05418X .removeSplitV05418AE{width:100%!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function patchRenderers(){
    ['renderStaffSchedules','renderStudentSchedules','renderScheduleViews','renderDashboardSummary'].forEach(function(name){
      var base = window[name];
      if (base && !base.__v05418ah) {
        var fn = function(){ var ret = base.apply(this, arguments); setTimeout(relabelDom, 0); return ret; };
        fn.__v05418ah = true;
        window[name] = fn;
        try { window.eval(name + ' = window["' + name + '"];'); } catch(e) {}
      }
    });
  }
  function syncDataItemsFromSource(){
    var items = schoolPeriodItems({ includeDataItems:true, allowOrphans:false });
    if (!items.length) return;
    ['studentData','staffData','scheduleData'].forEach(function(name){
      var d = window[name];
      if (!d || typeof d !== 'object') return;
      d.itemLabels = Object.assign({}, d.itemLabels || {});
      items.forEach(function(item){ d.itemLabels[item] = visibleLabel(item); });
      if (name === 'studentData') d.items = items.slice();
      if (name === 'staffData') d.periods = items.slice();
    });
  }
  function boot(){
    installCss();
    patchGlobals();
    syncDataItemsFromSource();
    patchStudentSurfaces();
    patchStaffSurfaces();
    patchRenderers();
    relabelDom();
    decorateAdvancedModal();
    setTimeout(function(){ cachedCatalog = null; syncDataItemsFromSource(); patchGlobals(); patchStudentSurfaces(); patchStaffSurfaces(); patchRenderers(); relabelDom(); decorateAdvancedModal(); }, 600);
  }
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('#studentAdvancedSchedulingLinkV05418X,[data-add-split-v05418ae],[data-remove-split-v05418ae],[data-close-adv-v05418ae],[data-close-adv-v05418x],[data-save-adv-v05418ae],#saveAdvancedSchedulingV05418X,[data-nav="students"],[data-nav="staff"],[data-action="staff-save"],[data-action="student-save"]');
    if (t) setTimeout(function(){ cachedCatalog = null; syncDataItemsFromSource(); relabelDom(); decorateAdvancedModal(); }, 80);
  }, true);
  document.addEventListener('change', function(e){
    var t = e.target;
    if (t && (t.matches && t.matches('#campusSelector,[data-split-item-v05418ae],#copyFrom,#holdPeriod'))) setTimeout(function(){ cachedCatalog = null; boot(); }, 120);
  }, true);
  if (window.MutationObserver) {
    var observer = new MutationObserver(function(mutations){
      var relevant = false;
      for (var i=0; i<mutations.length; i++) {
        var target = mutations[i].target;
        if (target && target.nodeType === 1 && (target.id === 'advancedSchedulingModalV05418X' || target.id === 'studentPeriodRows' || target.id === 'staffOnPaperSchedule' || (target.closest && target.closest('#advancedSchedulingModalV05418X,#students,#staff')))) { relevant = true; break; }
      }
      if (relevant) setTimeout(function(){ relabelDom(); decorateAdvancedModal(); }, 40);
    });
    var startObserver = function(){ observer.observe(document.body || document.documentElement, { childList:true, subtree:true }); };
    if (document.body) startObserver(); else document.addEventListener('DOMContentLoaded', startObserver);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.gaV05418ahPeriodLabels = function(){ return { version:VERSION, items:schoolPeriodItems({ includeDataItems:true, allowOrphans:false }), catalog:catalog(), source:source() }; };
})();

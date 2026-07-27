(function(){
  'use strict';
  if(window.__gaRedisV052Loaded) return; window.__gaRedisV052Loaded=true;
  return; // Disabled -- normalizeLastViewField() treats any input with an id starting "staffLastView" as a candidate to prune, scored partly by whether it already has a value. A freshly-created field is always empty at the moment this runs and reliably loses, getting deleted. Confirmed root cause via stack trace of the actual removal. This file's original purpose (consolidating old, scattered Last View field variants) is fully superseded by the current row implementation.
  function by(id){ return document.getElementById(id); }
  function q(sel,root){ return (root||document).querySelector(sel); }
  function qa(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function activePage(){ try{ if(typeof window.activeSectionIdV51229==='function') return window.activeSectionIdV51229()||''; }catch(e){} var s=q('.section.active'); return s?s.id:''; }
  function addStyle(){
    if(by('gaRedisV052Styles')) return;
    var css = [
      '#staff .staffDataStatsV5288{display:grid!important;grid-template-columns:190px 300px minmax(230px,280px) minmax(420px,1fr) 145px!important;gap:10px!important;align-items:end!important;grid-column:1/-1!important;width:100%!important;max-width:none!important;margin:8px 0 0!important;overflow:visible!important}',
      '#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffPortalLinkFieldV5312,#staff #staffLastViewFieldV052{display:flex!important;flex-direction:column!important;justify-content:flex-end!important;align-self:end!important;min-width:0!important;width:100%!important;max-width:none!important;margin:0!important;box-sizing:border-box!important;grid-column:auto!important;grid-row:auto!important;position:static!important;float:none!important}',
      '#staff #staffDataSubmittedFieldV5288{max-width:190px!important}',
      '#staff #staffDataPointsFieldV5288{max-width:300px!important}',
      '#staff #staffEmailFieldV024,#staff .staffEmailFieldV024{max-width:280px!important}',
      '#staff #staffPortalLinkFieldV5312{max-width:none!important}',
      '#staff #staffLastViewFieldV052{max-width:145px!important}',
      '#staff #staffDataSubmittedFieldV5288 label,#staff #staffDataPointsFieldV5288 label,#staff #staffEmailFieldV024 label,#staff .staffEmailFieldV024 label,#staff #staffPortalLinkFieldV5312 label,#staff #staffLastViewFieldV052 label{display:inline-flex!important;align-items:center!important;gap:3px!important;white-space:nowrap!important;width:auto!important;max-width:100%!important;min-height:17px!important;margin:0 0 5px!important;padding:0!important;line-height:1.15!important;font-family:inherit!important;font-size:12px!important;font-weight:700!important;color:#0f172a!important;text-transform:none!important;letter-spacing:0!important}',
      '#staff #staffLastDataSubmittedV5288,#staff #staffDataPointsContributedV5288,#staff #staffNotificationEmailV686m41,#staff #staffPortalLinkV5312,#staff #staffLastViewV052{height:32px!important;min-height:32px!important;line-height:30px!important;border-radius:12px!important;box-sizing:border-box!important;font-family:inherit!important;font-size:12px!important;font-weight:400!important;width:100%!important;min-width:0!important;margin:0!important;padding:7px 10px!important;opacity:1!important}',
      '#staff #staffDataPointsFieldV5288 .staffDataContributionLineV5301{display:grid!important;grid-template-columns:minmax(80px,1fr) 64px!important;gap:6px!important;align-items:center!important;width:100%!important}',
      '#staff #staffEmailFieldV024 .staffEmailInputLockWrapV025,#staff .staffEmailFieldV024 .staffEmailInputLockWrapV025{display:grid!important;grid-template-columns:minmax(0,1fr) 30px!important;gap:6px!important;align-items:center!important;width:100%!important}',
      '#staff #staffPortalLinkFieldV5312 .staffPortalLinkLineV5312,#staff #staffPortalLinkFieldV5312 .inline{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;width:100%!important}',
      '#staff .staffDataViewBtnV5289,#staff .staffPortalCopyBtnV5312{height:32px!important;min-height:32px!important;padding:6px 10px!important;border-radius:12px!important;font-family:inherit!important;font-size:12px!important;font-weight:800!important;line-height:1.1!important;white-space:nowrap!important;margin:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}',
      '#staff #staffLastViewV052{background:#f8fafc!important;color:#475569!important;border:1px solid #d8e1ef!important;text-align:left!important;font-weight:400!important}',
      '#staff #staffLastViewV052.staleV052,#staff #staffLastViewV052.staleV051,#staff #staffLastViewV052.staleV034,#staff #staffLastViewV052.staleViewV027,#staff #staffLastViewV052.staleV029,#staff #staffLastViewV052.staleV030,#staff #staffLastViewV052.staleV031,#staff #staffLastViewV052.staleV032,#staff #staffLastViewV052.staleV033{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important;font-weight:400!important}',
      '#staffEmailLockBtnV025,.staffEmailLockBtnV025.historyRegularBtn,.staffEmailLockBtnV025.historyLockV018{height:32px!important;min-height:32px!important;width:30px!important;min-width:30px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;transition:none!important}',
      '@media(max-width:1500px){#staff .staffDataStatsV5288{grid-template-columns:170px 285px minmax(210px,260px) minmax(340px,1fr) 135px!important;gap:8px!important}#staff #staffDataSubmittedFieldV5288{max-width:170px!important}#staff #staffDataPointsFieldV5288{max-width:285px!important}#staff #staffEmailFieldV024,#staff .staffEmailFieldV024{max-width:260px!important}#staff #staffLastViewFieldV052{max-width:135px!important}}',
      '@media(max-width:1180px){#staff .staffDataStatsV5288{grid-template-columns:repeat(2,minmax(220px,1fr))!important}#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffLastViewFieldV052{max-width:none!important}}',
      '@media(max-width:760px){#staff .staffDataStatsV5288{grid-template-columns:1fr!important}}'
    ].join('\n');
    var st=document.createElement('style'); st.id='gaRedisV052Styles'; st.textContent=css; document.head.appendChild(st);
  }

  function ensureWrap(){
    var wrap=q('#staff .staffDataStatsV5288');
    if(!wrap && typeof window.ensureStaffDataStatsUiV5288==='function'){
      try{ window.ensureStaffDataStatsUiV5288(); }catch(e){}
      wrap=q('#staff .staffDataStatsV5288');
    }
    if(!wrap){
      var top=q('#staff .staffProfileTop');
      if(top){ wrap=document.createElement('div'); wrap.id='staffDataStatsV5288'; wrap.className='staffDataStatsV5288'; top.appendChild(wrap); }
    }
    if(wrap) wrap.classList.add('staffDataStatsV5288');
    return wrap;
  }
  function fieldForInput(input){
    if(!input) return null;
    return input.closest('.staffDataFieldV5289,.staffPortalLinkFieldV5312,.staffEmailFieldV024,[id^="staffLastViewField"]') || input.parentNode;
  }
  function findEmailField(){
    var input=by('staffNotificationEmailV686m41');
    var field=by('staffEmailFieldV024') || q('#staff .staffEmailFieldV024') || fieldForInput(input);
    if(field){ field.id='staffEmailFieldV024'; field.classList.add('staffEmailFieldV024'); }
    return field;
  }
  function normalizeLinkField(){
    var field=by('staffPortalLinkFieldV5312');
    var input=by('staffPortalLinkV5312');
    if(!field && input) field=fieldForInput(input);
    if(field){ field.id='staffPortalLinkFieldV5312'; field.classList.add('staffPortalLinkFieldV5312'); }
    return field;
  }
  function hasRealValue(input){
    var v=(input&&input.value||'').trim();
    return !!v && v !== '—' && v !== '-';
  }
  function normalizeLastViewField(wrap){
    var candidates=[];
    qa('#staff [id^="staffLastViewField"]').forEach(function(el){ if(candidates.indexOf(el)<0)candidates.push(el); });
    qa('#staff input[id^="staffLastView"]').forEach(function(inp){ var f=fieldForInput(inp); if(f&&candidates.indexOf(f)<0)candidates.push(f); });
    var keep=null, keepScore=-1;
    candidates.forEach(function(f,idx){
      var inp=f.querySelector('input');
      var score=0;
      if(inp){ if(hasRealValue(inp)) score+=20; if(/not viewed/i.test(inp.value||'')) score+=15; if((inp.className||'').match(/stale|red|warn/i)) score+=8; }
      if((f.id||'')==='staffLastViewFieldV051') score+=5;
      if((f.id||'')==='staffLastViewFieldV052') score+=6;
      score+=idx/100;
      if(score>keepScore){ keep=f; keepScore=score; }
    });
    if(!keep){
      keep=document.createElement('div');
      keep.innerHTML='<label>Last View</label><input readonly disabled value="">';
    }
    candidates.forEach(function(f){ if(f!==keep){ try{ f.remove(); }catch(e){ f.style.display='none'; } } });
    keep.id='staffLastViewFieldV052';
    keep.classList.add('staffDataFieldV5289');
    var label=keep.querySelector('label');
    if(!label){ label=document.createElement('label'); label.textContent='Last View'; keep.insertBefore(label,keep.firstChild); }
    label.childNodes.forEach(function(n){ if(n.nodeType===3) n.nodeValue='Last View '; });
    if(!keep.querySelector('input')){ var inpNew=document.createElement('input'); inpNew.readOnly=true; inpNew.disabled=true; keep.appendChild(inpNew); }
    var inp=keep.querySelector('input');
    inp.id='staffLastViewV052';
    inp.readOnly=true; inp.disabled=true; inp.style.fontWeight='400';
    ['staleV034','staleViewV027','staleV029','staleV030','staleV031','staleV032','staleV033','staleV051'].forEach(function(c){ if(inp.classList.contains(c)) inp.classList.add('staleV052'); });
    return keep;
  }
  function normalizeDataFields(){
    var last=by('staffLastDataSubmittedV5288');
    var lastField=fieldForInput(last); if(lastField){ lastField.id='staffDataSubmittedFieldV5288'; lastField.classList.add('staffDataFieldV5289'); }
    var points=by('staffDataPointsContributedV5288');
    var pointsField=fieldForInput(points); if(pointsField){ pointsField.id='staffDataPointsFieldV5288'; pointsField.classList.add('staffDataFieldV5289'); }
    return { lastField:lastField, pointsField:pointsField };
  }
  function rebuildStaffRow(){
    if(activePage()!=='staff') return;
    addStyle();
    var wrap=ensureWrap(); if(!wrap) return;
    var d=normalizeDataFields();
    var emailField=findEmailField();
    var linkField=normalizeLinkField();
    var lastViewField=normalizeLastViewField(wrap);
    [d.lastField,d.pointsField,emailField,linkField,lastViewField].filter(Boolean).forEach(function(el){
      if(el.parentNode!==wrap) wrap.appendChild(el); else wrap.appendChild(el);
    });
    // Remove any last-view fields that were recreated after normalization.
    qa('#staff [id^="staffLastViewField"]').forEach(function(el){ if(el!==lastViewField){ try{ el.remove(); }catch(e){ el.style.display='none'; } } });
    var copy=q('#staff .staffPortalCopyBtnV5312'); if(copy){ copy.classList.add('btn','small'); }
    var view=by('staffDataViewBtnV5289'); if(view){ view.classList.add('btn','small','staffDataViewBtnV5289'); }
    var lock=by('staffEmailLockBtnV025'); if(lock){ lock.style.transition='none'; }
  }
  function schedule(){
    if(activePage()!=='staff') return;
    [0,80,240,600].forEach(function(ms){ setTimeout(rebuildStaffRow,ms); });
  }
  var baseShowPage=window.showPage;
  if(typeof baseShowPage==='function' && !baseShowPage.__v052StaffWrap){
    var sp=function(page,btn){ var r=baseShowPage.apply(this,arguments); if(page==='staff') schedule(); return r; };
    sp.__v052StaffWrap=true; window.showPage=sp;
  }
  var baseSelectStaff=window.selectStaff;
  if(typeof baseSelectStaff==='function' && !baseSelectStaff.__v052StaffWrap){
    var ss=function(){ var r=baseSelectStaff.apply(this,arguments); schedule(); return r; };
    ss.__v052StaffWrap=true; window.selectStaff=ss;
  }
  var baseNewStaff=window.newStaff;
  if(typeof baseNewStaff==='function' && !baseNewStaff.__v052StaffWrap){
    var ns=function(){ var r=baseNewStaff.apply(this,arguments); schedule(); return r; };
    ns.__v052StaffWrap=true; window.newStaff=ns;
  }
  document.addEventListener('click',function(e){
    if(e.target && e.target.closest && (e.target.closest('[data-nav="staff"]') || e.target.closest('#staffList button') || e.target.closest('[data-action="staff-new"]'))){ schedule(); }
  },true);
  setTimeout(schedule,0);
})();

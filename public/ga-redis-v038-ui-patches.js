(function(){
  'use strict';
  if(window.__gaRedisV038Loaded) return; window.__gaRedisV038Loaded = true;

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>\"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c] || c; }); }
  function selectedSchoolId(){
    try { if (typeof window.selectedSchoolPayloadV686m20 === 'function') { var p = window.selectedSchoolPayloadV686m20() || {}; return clean(p.school || p.schoolId || p.campusId || p.selectedCampusId || ''); } } catch(e) {}
    try { var ctx = window.campusContextV5253 || {}; return clean(ctx.selectedCampusId || (ctx.currentCampus && ctx.currentCampus.campusId) || ctx.schoolId || ctx.campusId || ''); } catch(e2) {}
    var sel = by('campusSelector'); return sel ? clean(sel.value) : '';
  }
  function api(path, params){ params=params||{}; if(!params.school) params.school=selectedSchoolId(); params._t=Date.now(); return path+'?'+new URLSearchParams(params).toString(); }
  function fetchJson(url, opts){
    opts=opts||{}; opts.credentials='same-origin'; opts.headers=Object.assign({'Content-Type':'application/json'}, opts.headers||{});
    return fetch(url, opts).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if(!r.ok || j.ok===false) throw new Error(j.error || j.message || ('HTTP '+r.status)); return j; }); });
  }
  function setMsg(msg,type){ try{ if(typeof window.setMsg==='function') return window.setMsg(msg,type||'warn'); }catch(e){} var el=by('globalMsg'); if(el){ el.textContent=msg||''; el.className='msg '+(type||''); el.style.display=msg?'block':'none'; } }

  function installStyles(){
    if(by('gaRedisV038Styles')) return;
    var css = [
      /* Uniform button shape without forcing hidden/dynamic pills to display. */
      '.btn,button.btn,.toolbar button,.topActions button,.topActions .btn,.portalTopActions button,.portalTopActions .btn,button[data-action],button[data-nav],button[data-v034safe-action],button[data-v038-action]{border-radius:10px!important;box-sizing:border-box!important}',
      '.topActions{align-items:center!important;gap:6px!important}.topActions button,.topActions .btn{height:34px!important;min-height:34px!important;max-height:34px!important;padding:0 12px!important;line-height:1.1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;vertical-align:middle!important}.topActions .activeOptPill{height:34px!important;min-height:34px!important;max-height:34px!important;padding:0 12px!important;line-height:1.1!important;align-items:center!important;justify-content:center!important;border-radius:10px!important;vertical-align:middle!important}.topActions .activeOptPill .x,.topActions .shareSchedulesPillV686m26 .shareX{height:18px!important;min-height:18px!important;width:18px!important;padding:0!important;line-height:16px!important;margin-left:5px!important;border-radius:8px!important}.topActions #publishScheduleBtn{display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:1.1!important}',
      '.topActions .activeOptPill:not([style*="inline-flex"]):not(.active){display:none!important}.topActions .customizationPill:not([style*="inline-flex"]):not(.active),.topActions .unpublishedSchedulePill:not([style*="inline-flex"]):not(.active){display:none!important}',
      '.shareSchedulesPillV686m26{border-radius:10px!important}.topActions .shareSchedulesPillV686m26{height:34px!important;min-height:34px!important;max-height:34px!important;padding:0 12px!important;line-height:1.1!important;align-items:center!important;justify-content:center!important}',
      /* Staff Manager: one clean data/contact row, no forced horizontal page scroll. */
      '#staff .staffDataStatsV5288{display:grid!important;grid-template-columns:180px 190px minmax(250px,1fr) minmax(260px,.95fr) 190px!important;gap:8px!important;align-items:end!important;width:100%!important;max-width:100%!important;overflow:visible!important;margin-top:8px!important;grid-column:1/-1!important}',
      '#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffPortalLinkFieldV5312,#staff #staffLastViewFieldV034,#staff #staffLastViewFieldV033,#staff #staffLastViewFieldV028{display:flex!important;flex-direction:column!important;justify-content:flex-end!important;align-self:end!important;min-width:0!important;width:100%!important;max-width:none!important;margin:0!important;box-sizing:border-box!important;grid-column:auto!important}',
      '#staff .staffDataStatsV5288 label{display:block!important;font-size:12px!important;line-height:16px!important;min-height:16px!important;margin:0 0 5px!important;white-space:nowrap!important;font-weight:800!important}',
      '#staff #staffDataSubmittedFieldV5288 input,#staff #staffDataPointsFieldV5288 input,#staff #staffEmailFieldV024 input,#staff .staffEmailFieldV024 input,#staff #staffPortalLinkFieldV5312 input,#staff #staffLastViewFieldV034 input,#staff #staffLastViewFieldV033 input,#staff #staffLastViewFieldV028 input{height:32px!important;min-height:32px!important;line-height:30px!important;font-size:12px!important;font-weight:400!important;box-sizing:border-box!important;width:100%!important;min-width:0!important;margin:0!important}',
      '#staff #staffDataPointsFieldV5288 .staffDataContributionLineV5301{display:grid!important;grid-template-columns:minmax(0,1fr) 62px!important;gap:6px!important;align-items:end!important}',
      '#staff #staffEmailFieldV024 .staffEmailInputLockWrapV025,#staff .staffEmailFieldV024 .staffEmailInputLockWrapV025{display:grid!important;grid-template-columns:minmax(0,1fr) 28px!important;gap:6px!important;align-items:end!important}',
      '#staff #staffPortalLinkFieldV5312 .staffPortalLinkLineV5312,#staff #staffPortalLinkFieldV5312 .inline{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:6px!important;align-items:end!important}',
      '#staff #staffPortalLinkFieldV5312 button,#staff #staffPortalLinkFieldV5312 .btn{height:32px!important;min-height:32px!important;max-height:32px!important;padding:0 12px!important;line-height:1.1!important;font-size:12px!important;font-weight:800!important;border-radius:10px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important}',
      '#staff #staffPortalLinkV5312{font-size:11.5px!important}',
      '#staff #staffLastViewV034,#staff #staffLastViewV033,#staff #staffLastViewV028{font-weight:400!important;color:#475569!important;text-align:left!important;background:#f8fafc!important}',
      '#staff #staffLastViewV034.staleV034,#staff #staffLastViewV033.staleV034,#staff #staffLastViewV028.staleV034{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important;font-weight:400!important}',
      '#staffEmailLockBtnV025{transition:none!important}',
      '#formPickerResults.gaStableFormsV038{min-height:96px!important;max-height:380px!important;overflow:auto!important;border:1px solid #dbe3ef!important;border-radius:12px!important;padding:6px!important;background:#fff!important;display:block!important;visibility:visible!important;opacity:1!important}.gaStableFormsV038 .searchResultBtn{display:block!important;width:100%!important;text-align:left!important;margin:4px 0!important;white-space:normal!important;border-radius:10px!important}',
      '@media(max-width:1350px){#staff .staffDataStatsV5288{grid-template-columns:155px 165px minmax(220px,1fr) minmax(230px,.85fr) 175px!important;gap:7px!important}}'
    ].join('\n');
    var st=document.createElement('style'); st.id='gaRedisV038Styles'; st.textContent=css; document.head.appendChild(st);
  }

  function responderUrlFromAny(input){
    var raw=clean(input); if(!raw) return '';
    var m=raw.match(/\/forms\/d\/(?:e\/)?([^\/\?#]+)/i) || raw.match(/[?&]id=([^&]+)/i);
    var id=m && m[1] ? decodeURIComponent(m[1]) : '';
    if(!id && /^[A-Za-z0-9_-]{20,}$/.test(raw)) id=raw;
    return id ? 'https://docs.google.com/forms/d/'+encodeURIComponent(id)+'/viewform' : raw.replace('/edit','/viewform').replace('/edit?usp=drivesdk','/viewform');
  }

  var formSeq=0;
  function patchFormPicker(){
    var search=by('formPickerSearch'); if(search) search.placeholder='Search forms by name or leave blank';
    var manual=by('formPickerManual'); if(manual) manual.placeholder='Paste a Google Form URL or file ID';
    var help=by('formPickerHelpV5215')||by('formPickerHelpV5218'); if(help){ help.id='formPickerHelpV5215'; help.textContent='Select a Google Form accessible to your signed-in Google account. No DATA_FILE name or special sharing rule is required.'; }
    var msg=by('formPickerManualMsg'); if(msg && /DATA_FILE|file name must/i.test(msg.textContent||'')) msg.textContent='';
    var box=by('formPickerResults'); if(box){ box.classList.remove('gaStableFormsV034','gaStableFormsV036','gaStableFormsV037'); box.classList.add('gaStableFormsV038'); }
  }
  function renderForms(rows){
    var box=by('formPickerResults'); if(!box) return;
    rows=rows||[]; box.classList.remove('gaStableFormsV034','gaStableFormsV036','gaStableFormsV037'); box.classList.add('gaStableFormsV038');
    if(!rows.length){ box.innerHTML='<div class="muted"><b>No accessible Google Forms found.</b><br>Try Show All, search a different form name, or paste the Form URL/file ID above.</div>'; return; }
    box.innerHTML = rows.map(function(r){
      var meta=[]; if(r.source)meta.push(r.source); if(r.updated)meta.push('Modified '+r.updated); if(r.driveName&&r.driveName!==r.name)meta.push('Drive file name '+r.driveName);
      var url=responderUrlFromAny(r.responderUrl||r.publishedUrl||r.url||r.editUrl||'');
      return '<button type="button" class="searchResultBtn" data-form-url="'+esc(url)+'"><strong>'+esc(r.name||r.driveName||r.formTitle||'Untitled Google Form')+'</strong><div class="dashMeta">'+esc(meta.join(' · '))+'</div></button>';
    }).join('');
  }
  function searchForms(showAll){
    patchFormPicker(); var modal=by('formPickerModal'); if(modal)modal.classList.add('active');
    var q=by('formPickerSearch'); if(showAll&&q)q.value=''; var query=q?clean(q.value):'';
    var box=by('formPickerResults'); if(box) box.innerHTML='<div class="muted">Searching accessible Google Forms...</div>';
    var seq=++formSeq;
    return fetchJson('/api/google/forms/search-v026?'+new URLSearchParams({query:query,limit:'100',_t:String(Date.now())}).toString()).then(function(j){ if(seq!==formSeq)return; renderForms(j.rows||j.forms||[]); }).catch(function(e){ if(seq!==formSeq)return; if(box)box.innerHTML='<div class="muted"><b>Could not search Google Forms.</b><br>'+esc(e.message||e)+'</div>'; });
  }
  function saveStudentDataUrl(row,url){
    row=clean(row); url=responderUrlFromAny(url); if(!row){ return Promise.resolve({ok:true,url:url}); }
    return fetchJson('/api/v037/student-data-url/save',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),rowIndex:Number(row),url:url})});
  }
  function chooseFormUrl(url){
    url=responderUrlFromAny(url); var modal=by('formPickerModal'); if(modal) modal.classList.remove('active');
    var row=null; try{ row=window.formPickerTargetRow || formPickerTargetRow || null; }catch(e){ row=window.formPickerTargetRow || null; }
    if(row){
      var input=document.querySelector('[data-data-url-row="'+row+'"]'); if(input) input.value=url;
      setMsg('Saving selected Google Form link...','warn');
      saveStudentDataUrl(row,url).then(function(r){ setMsg((r&&r.message)||'Google Form link saved.','ok'); try{ if(typeof loadStudentData==='function')loadStudentData(null,{preferCache:false,skipNew:true}); }catch(x){}; }).catch(function(e){ setMsg('Could not save Google Form link: '+(e.message||e),'err'); });
      return;
    }
    var stu=by('studentDataFiles'); if(stu) stu.value=url;
    setMsg('Selected fillable Google Form link. Save the student to keep this link.','ok');
  }
  function useManualForm(){
    patchFormPicker(); var input=by('formPickerManual'), msg=by('formPickerManualMsg'), raw=input?clean(input.value):'';
    if(!raw){ if(msg) msg.textContent='Paste a Google Form URL or file ID first.'; return; }
    if(msg) msg.textContent='Validating Google Form...';
    fetchJson('/api/google/forms/validate-v026',{method:'POST',body:JSON.stringify({input:raw})}).then(function(j){ var r=j.row||j||{}; var url=responderUrlFromAny(r.responderUrl||r.publishedUrl||r.url||r.editUrl||raw); if(input)input.value=''; if(msg)msg.textContent='Validated '+(r.name||r.driveName||r.formTitle||'Google Form')+'.'; chooseFormUrl(url); }).catch(function(e){ if(msg)msg.textContent='That Google Form could not be validated: '+(e.message||e); });
  }
  function openDriveFormsSearch(){ var q='type:forms'; var s=by('formPickerSearch'); if(s&&clean(s.value))q+=' '+clean(s.value); window.open('https://drive.google.com/drive/search?q='+encodeURIComponent(q),'_blank'); var msg=by('formPickerManualMsg'); if(msg)msg.textContent='Drive search opened in a new tab.'; }
  function installFormOverrides(){
    window.searchForms=function(showAll){ return searchForms(!!showAll); };
    window.searchGoogleFormsFromPortal=function(){ return searchForms(false); };
    window.chooseGoogleForm=chooseFormUrl;
    window.useManualGoogleFormFromPortal=useManualForm;
    window.openDriveDataFileSearchFromPortal=openDriveFormsSearch;
    try{ searchForms=window.searchForms; }catch(e){} try{ searchGoogleFormsFromPortal=window.searchGoogleFormsFromPortal; }catch(e2){} try{ chooseGoogleForm=chooseFormUrl; }catch(e3){} try{ useManualGoogleFormFromPortal=useManualForm; }catch(e4){}
  }

  function forceStaffRow(){
    var wrap=document.querySelector('#staff .staffDataStatsV5288'); if(!wrap) return;
    var last=by('staffLastDataSubmittedV5288'), pts=by('staffDataPointsContributedV5288');
    var lastField=last && (last.closest('.staffDataFieldV5289') || last.parentNode); if(lastField) lastField.id='staffDataSubmittedFieldV5288';
    var ptsField=pts && (pts.closest('.staffDataFieldV5289') || pts.parentNode); if(ptsField) ptsField.id='staffDataPointsFieldV5288';
    var email=by('staffEmailFieldV024') || document.querySelector('#staff .staffEmailFieldV024');
    var link=by('staffPortalLinkFieldV5312');
    var lv=by('staffLastViewFieldV034') || by('staffLastViewFieldV033') || by('staffLastViewFieldV028'); if(lv){ lv.id='staffLastViewFieldV034'; var inp=lv.querySelector('input'); if(inp){ inp.id='staffLastViewV034'; inp.style.fontWeight='400'; } }
    [lastField, ptsField, email, link, lv].filter(Boolean).forEach(function(el){ wrap.appendChild(el); });
    var lock=by('staffEmailLockBtnV025'); if(lock){ lock.style.transition='none'; if(!lock.dataset.v038Stable){ lock.dataset.v038Stable='1'; lock.innerHTML='<i class="fa-solid fa-lock" aria-hidden="true"></i>'; } }
  }

  function boot(){ installStyles(); installFormOverrides(); patchFormPicker(); if(document.querySelector('#staff.active')) forceStaffRow(); }
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest&&e.target.closest('[data-action],.searchResultBtn[data-form-url],[data-nav]'); if(!t) return;
    var a=t.getAttribute('data-action')||'';
    if(a==='form-picker-search'){ e.preventDefault(); e.stopImmediatePropagation(); searchForms(false); return false; }
    if(a==='form-picker-browse'){ e.preventDefault(); e.stopImmediatePropagation(); var q=by('formPickerSearch'); if(q)q.value=''; searchForms(true); return false; }
    if(a==='form-picker-use-manual'){ e.preventDefault(); e.stopImmediatePropagation(); useManualForm(); return false; }
    if(a==='form-picker-drive-search'){ e.preventDefault(); e.stopImmediatePropagation(); openDriveFormsSearch(); return false; }
    if(a==='data-select-form'){ e.preventDefault(); e.stopImmediatePropagation(); try{ window.formPickerTargetRow=t.getAttribute('data-data-row')||null; formPickerTargetRow=window.formPickerTargetRow; }catch(x){} var m=by('formPickerModal'); if(m)m.classList.add('active'); var q2=by('formPickerSearch'), tr=t.closest('tr'); if(q2)q2.value=(tr&&tr.getAttribute('data-student-name'))||''; searchForms(false); return false; }
    if(a==='data-save-url'){ e.preventDefault(); e.stopImmediatePropagation(); var row=t.getAttribute('data-data-row'); if(typeof window.saveDataManagerUrl==='function'){ window.saveDataManagerUrl(row); return false; } var input=document.querySelector('[data-data-url-row="'+row+'"]'); if(input){ saveStudentDataUrl(row,input.value).then(function(r){ setMsg((r&&r.message)||'Google Form link saved.','ok'); }).catch(function(err){ setMsg('Could not save Google Form link: '+(err.message||err),'err'); }); } return false; }
    if(t.classList&&t.classList.contains('searchResultBtn')&&t.getAttribute('data-form-url')){ e.preventDefault(); e.stopImmediatePropagation(); chooseFormUrl(t.getAttribute('data-form-url')); return false; }
    if(t.getAttribute('data-nav')==='staff'){ setTimeout(forceStaffRow,200); setTimeout(forceStaffRow,700); }
  },true);
  document.addEventListener('input',function(e){ if(e.target&&e.target.id==='staffName') setTimeout(forceStaffRow,80); },true);
  document.addEventListener('click',function(e){ if(e.target&&e.target.closest&&e.target.closest('#staffList button,#staffList [data-staff-row],#staffList .active')){ setTimeout(forceStaffRow,160); setTimeout(forceStaffRow,600); } },true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,50); }); else setTimeout(boot,50);
  [200,800,1800].forEach(function(ms){ setTimeout(boot,ms); });
})();

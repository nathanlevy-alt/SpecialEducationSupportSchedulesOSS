(function(){
  'use strict';
  if(window.__gaRedisV034Loaded) return; window.__gaRedisV034Loaded=true;
  function by(id){return document.getElementById(id);} 
  function clean(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c;});}
  function activePage(){try{if(typeof window.activeSectionIdV51229==='function')return window.activeSectionIdV51229()||'';}catch(e){}var s=document.querySelector('.section.active');return s?s.id:'';}
  function selectedSchoolId(){try{if(typeof window.selectedSchoolPayloadV686m20==='function'){var p=window.selectedSchoolPayloadV686m20()||{};return clean(p.school||p.schoolId||p.campusId||p.selectedCampusId||'');}}catch(e){}try{var ctx=window.campusContextV5253||{};return clean(ctx.selectedCampusId||(ctx.currentCampus&&ctx.currentCampus.campusId)||ctx.schoolId||ctx.campusId||'');}catch(e2){}var sel=by('campusSelector');return sel?clean(sel.value):'';}
  function api(path,params){params=params||{};if(!params.school)params.school=selectedSchoolId();params._t=Date.now();return path+'?'+new URLSearchParams(params).toString();}
  function fetchJson(url,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(url,opts).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||j.message||('HTTP '+r.status));return j;});});}
  function setMsg(msg,type){try{if(typeof window.setMsg==='function')return window.setMsg(msg,type||'warn');}catch(e){}var el=by('globalMsg');if(el){el.className='msg '+(type||'');el.style.display=msg?'block':'none';el.textContent=msg||'';}}
  function normName(v){return clean(v).toLowerCase().replace(/\s+/g,' ');}  
  function fmtDateTime(v){
    if(!v) return '';
    if(/\d{2}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+[AP]M/i.test(String(v))) return String(v);
    var d=new Date(v); if(isNaN(d.getTime())) return String(v);
    var mm=String(d.getMonth()+1).padStart(2,'0'); var dd=String(d.getDate()).padStart(2,'0'); var yy=String(d.getFullYear()).slice(-2);
    var h=d.getHours(); var ap=h>=12?'PM':'AM'; h=h%12||12; var mi=String(d.getMinutes()).padStart(2,'0');
    return mm+'-'+dd+'-'+yy+' '+h+':'+mi+' '+ap;
  }
  function installStyles(){
    if(by('gaRedisV034Styles'))return;
    var css=[
      '.reauthErrorV034{position:relative!important;display:none;width:100%!important;max-width:none!important;box-sizing:border-box!important;margin:8px 0 10px!important;padding:10px 42px 10px 12px!important;border-radius:12px!important;border:1px solid #fecaca!important;background:#fef2f2!important;color:#991b1b!important;font-weight:400!important;line-height:1.35!important}.reauthErrorV034.active{display:block!important}.reauthErrorV034 a{font-weight:800!important;color:inherit!important;text-decoration:underline!important}.reauthErrorV034 .x{position:absolute!important;right:10px!important;top:7px!important;border:0!important;background:transparent!important;color:inherit!important;font-size:18px!important;font-weight:900!important;cursor:pointer!important}',
      '#dataManager #dataFormsActiveNoteV034{display:block!important;margin:10px 0 0!important;padding:8px 10px!important;border:1px solid #bbf7d0!important;background:#ecfdf5!important;color:#166534!important;border-radius:12px!important;font-weight:700!important;line-height:1.35!important}#dataManager .dataFormsActiveNoteV026,#dataManager .dataFormsActiveNoteV028,#dataManager .dataFormsActiveNoteV029,#dataManager .dataFormsActiveNoteV031,#dataManager #dataFormsActiveNoteV026,#dataManager #dataFormsActiveNoteV028,#dataManager #dataFormsActiveNoteV029,#dataManager #dataFormsActiveNoteV031{display:none!important}',
      '#formPickerResults.gaStableFormsV034{min-height:96px!important;max-height:380px!important;overflow:auto!important;border:1px solid #dbe3ef!important;border-radius:12px!important;padding:6px!important;background:#fff!important}.theme-dark #formPickerResults.gaStableFormsV034,body.theme-dark #formPickerResults.gaStableFormsV034,body[data-theme="dark"] #formPickerResults.gaStableFormsV034{background:#111827!important;border-color:#334155!important}.gaStableFormsV034 .searchResultBtn{display:block!important;width:100%!important;text-align:left!important;margin:4px 0!important;white-space:normal!important}',
      '#staff .staffDataStatsV5288{display:grid!important;grid-template-columns:170px 150px 310px 360px 165px!important;gap:8px!important;align-items:end!important;grid-column:1/-1!important;width:100%!important;max-width:none!important;margin-top:8px!important;overflow:visible!important}',
      '#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffPortalLinkFieldV5312,#staff #staffLastViewFieldV034{grid-column:auto!important;width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;align-self:end!important;box-sizing:border-box!important}',
      '#staff #staffDataSubmittedFieldV5288 input,#staff #staffDataPointsFieldV5288 input,#staff #staffEmailFieldV024 input,#staff .staffEmailFieldV024 input,#staff #staffPortalLinkFieldV5312 input,#staff #staffLastViewFieldV034 input{width:100%!important;min-width:0!important;box-sizing:border-box!important;height:32px!important;min-height:0!important;font-size:12px!important;font-weight:400!important}',
      '#staff #staffDataPointsFieldV5288 .staffDataContributionLineV5301{display:grid!important;grid-template-columns:minmax(0,1fr) 58px!important;gap:6px!important;align-items:center!important}',
      '#staff #staffEmailFieldV024 .staffEmailInputLockWrapV025,#staff .staffEmailFieldV024 .staffEmailInputLockWrapV025{display:grid!important;grid-template-columns:minmax(0,1fr) 26px!important;gap:4px!important;align-items:center!important}',
      '#staff #staffPortalLinkFieldV5312 .staffPortalLinkLineV5312,#staff #staffPortalLinkFieldV5312 .inline{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:6px!important;align-items:center!important}',
      '#staff #staffPortalLinkFieldV5312 input{font-size:12px!important}',
      '#staff #staffLastViewV034.staleV034{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important;font-weight:400!important}',
      '#staff #staffLastViewV034{font-weight:400!important;color:#475569!important}',
      '#staffEmailLockBtnV025,.staffEmailLockBtnV025.historyRegularBtn,.staffEmailLockBtnV025.historyLockV018{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#94a3b8!important;width:26px!important;min-width:26px!important;height:32px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;transition:none!important}',
      '#staffEmailLockBtnV025.active,#staffEmailLockBtnV025[aria-pressed="true"]{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#d4a017!important}',
      '#studentMaxGroupSize.maxGroupZeroV034{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important}',
      '.communicationManagerGridV034{display:grid;grid-template-columns:1fr;gap:12px}.communicationManagerCardV034{border:1px solid #dbe3ef;border-radius:14px;padding:12px;background:#fff}.v034Table{width:100%;border-collapse:collapse}.v034Table th,.v034Table td{border-bottom:1px solid #e5edf7;padding:7px;text-align:left;vertical-align:top}.v034Table th{font-size:12px;color:#64748b;background:#f8fafc}.commEmailRowV034{display:grid;grid-template-columns:minmax(220px,1fr) 64px;gap:6px;align-items:center}.commShareBtnV034{background:#dcfce7!important;border-color:#86efac!important;color:#166534!important;font-weight:900!important;border-radius:12px!important}.staleV034{background:#fef2f2!important;color:#991b1b!important}.okV034{font-weight:800;color:#166534}.errV034{font-weight:800;color:#991b1b}.commLogActionsV034{display:flex;gap:8px;align-items:center;margin-bottom:8px}.logNoteV034{font-size:12px;color:#64748b}',
      '#appearanceCardV034 select{max-width:240px}.settingsUtilityCardV034{margin-top:12px}',
      'body.darkModeV034{--bg:#0f172a;--card:#172033;--text:#f8fafc;--muted:#cbd5e1;--line:#334155;background:#0f172a!important;color:#f8fafc!important}body.darkModeV034 .card,body.darkModeV034 .communicationManagerCardV034{background:#172033!important;border-color:#334155!important;color:#f8fafc!important}body.darkModeV034 input,body.darkModeV034 select,body.darkModeV034 textarea{background:#0f172a!important;color:#f8fafc!important;border-color:#475569!important}body.darkModeV034 .btn:not(.primary):not(.danger):not(.commShareBtnV034){background:#fff!important;color:#111827!important}body.darkModeV034 .muted{color:#cbd5e1!important}',
      '@media(max-width:1400px){#staff .staffDataStatsV5288{grid-template-columns:155px 135px 280px 315px 155px!important;gap:7px!important}}@media(max-width:1120px){#staff .staffDataStatsV5288{grid-template-columns:repeat(2,minmax(220px,1fr))!important}}@media(max-width:760px){#staff .staffDataStatsV5288{grid-template-columns:1fr!important}}'
    ].join('\n');
    var st=document.createElement('style');st.id='gaRedisV034Styles';st.textContent=css;document.head.appendChild(st);
  }
  function normalizeTitle(){
    var pt=by('pageTitle');
    document.querySelectorAll('[data-nav="scheduleChanges"]').forEach(function(b){b.textContent='Schedule Analysis';});
    document.querySelectorAll('[data-nav="communicationManager"],#communicationManagerNavV034,#communicationManagerNavV028').forEach(function(b){b.textContent='Communication Manager';});
    if(pt){if(clean(pt.textContent)==='communicationManager')pt.textContent='Communication Manager'; if(/Schedule Changes|Schedule Compare/i.test(pt.textContent))pt.textContent='Schedule Analysis'; var txt=clean(pt.textContent); if(txt)document.title=txt+' - Support Schedules';}
    else if(/^GA Schedule|GA Scheduler|Admin Portal|Support Schedules/i.test(document.title||'')){document.title='Support Schedules';}
  }
  function cleanSharePill(){
    document.querySelectorAll('#shareSchedulesPillV686m26,.shareSchedulesPillV686m26').forEach(function(pill){
      pill.querySelectorAll('i,.fa,.fa-solid,.fa-regular,svg').forEach(function(icon){try{icon.remove();}catch(e){}});
      var main=pill.querySelector('.shareMainV018,[data-redis-v018-action="share-open"]')||pill; if(/share/i.test(clean(main.textContent))||main!==pill)main.textContent='Share Schedules';
    });
  }
  function installReauthError(){
    var msg=by('globalMsg'); if(!msg || by('reauthErrorV034')) return;
    var box=document.createElement('div'); box.id='reauthErrorV034'; box.className='reauthErrorV034';
    box.innerHTML='<span>Google Drive/Forms access needs attention. <a href="/auth/logout">Sign out</a> and sign back in again.</span><button class="x" type="button" data-v034-action="close-reauth" aria-label="Close">×</button>';
    msg.parentNode.insertBefore(box,msg.nextSibling);
  }
  function refreshReauthError(){
    var box=by('reauthErrorV034'); if(!box || box.dataset.dismissed==='1')return;
    fetchJson(api('/api/v027/diagnostics')).then(function(j){
      if(!j.googleAccessTokenPresent || !j.googleFormsSearchOk) box.classList.add('active'); else box.classList.remove('active');
      updateDataFormsNote(j && j.googleFormsSearchOk);
    }).catch(function(){box.classList.add('active'); updateDataFormsNote(false);});
  }
  function updateDataFormsNote(ok){
    var dm=by('dataManager'); if(!dm)return;
    dm.querySelectorAll('#dataFormsActiveNoteV026,#dataFormsActiveNoteV028,#dataFormsActiveNoteV029,#dataFormsActiveNoteV031,.dataFormsActiveNoteV026,.dataFormsActiveNoteV028,.dataFormsActiveNoteV029,.dataFormsActiveNoteV031').forEach(function(n){try{n.remove();}catch(e){}});
    var note=by('dataFormsActiveNoteV034'); if(!note){note=document.createElement('div');note.id='dataFormsActiveNoteV034';}
    note.textContent= ok===false ? 'Google Forms access needs attention.' : 'Google Forms link is active.';
    var card=dm.querySelector('.card')||dm; card.appendChild(note);
  }

  var formSeq=0;
  function renderForms(rows){
    var box=by('formPickerResults'); if(!box)return;
    rows=rows||[]; box.classList.add('gaStableFormsV034');
    if(!rows.length){box.innerHTML='<div class="muted"><b>No accessible Google Forms found.</b><br>Try Show All, search a different form name, or paste the Form URL/file ID above.</div>';return;}
    box.innerHTML=rows.map(function(r){
      var meta=[]; if(r.source)meta.push(r.source); if(r.updated)meta.push('Modified '+r.updated); if(r.driveName&&r.driveName!==r.name)meta.push('Drive file name '+r.driveName); if(r.formTitle&&r.formTitle!==r.name)meta.push('Form title '+r.formTitle);
      var url=r.url||r.editUrl||r.responderUri||'';
      return '<button type="button" class="searchResultBtn" data-form-url="'+esc(url)+'"><strong>'+esc(r.name||r.driveName||r.formTitle||'Untitled Google Form')+'</strong><div class="dashMeta">'+esc(meta.join(' · '))+'</div></button>';
    }).join('');
  }
  function patchFormPickerText(){
    var modal=by('formPickerModal'); if(!modal)return;
    var search=by('formPickerSearch'); if(search) search.placeholder='Search forms by name or leave blank';
    var manual=by('formPickerManual'); if(manual) manual.placeholder='Paste a Google Form URL or file ID';
    var help=by('formPickerHelpV5215')||by('formPickerHelpV5218'); if(help){help.id='formPickerHelpV5215'; help.textContent='Select a Google Form accessible to your signed-in Google account. No DATA_FILE name or special sharing rule is required.';}
    var box=by('formPickerResults'); if(box) box.classList.add('gaStableFormsV034');
  }
  function stableSearchForms(showAll){
    patchFormPickerText(); var modal=by('formPickerModal'); if(modal)modal.classList.add('active');
    var q=by('formPickerSearch'); if(showAll&&q)q.value=''; var query=q?clean(q.value):'';
    var box=by('formPickerResults'); if(box){box.classList.add('gaStableFormsV034'); box.innerHTML='<div class="muted">Searching accessible Google Forms...</div>';}
    var seq=++formSeq;
    return fetchJson('/api/google/forms/search-v026?'+new URLSearchParams({query:query,limit:'100',_t:String(Date.now())}).toString()).then(function(j){if(seq!==formSeq)return;renderForms(j.rows||j.forms||[]);}).catch(function(err){
      if(seq!==formSeq)return;
      if(box)box.innerHTML='<div class="muted"><b>Could not search Google Forms.</b><br>'+esc(err.message||err)+'</div>';
    });
  }
  function openFormPickerStable(target,row,name){
    try{window.formPickerTargetRow=row||null; formPickerTargetRow=row||null;}catch(e){}
    var m=by('formPickerModal'); if(m)m.classList.add('active');
    var q=by('formPickerSearch'); if(q)q.value=name||((by('studentName')&&by('studentName').value)||'');
    stableSearchForms(!name);
  }
  function useManualForm(){
    patchFormPickerText(); var input=by('formPickerManual'), msg=by('formPickerManualMsg'), raw=input?clean(input.value):'';
    if(!raw){if(msg)msg.textContent='Paste a Google Form URL or file ID first.';return;}
    if(msg)msg.textContent='Validating Google Form...';
    fetchJson('/api/google/forms/validate-v026',{method:'POST',body:JSON.stringify({input:raw})}).then(function(j){var r=j.row||j;if(input)input.value='';if(msg)msg.textContent='Validated '+(r.name||r.driveName||r.formTitle||'Google Form')+'.';chooseFormUrl(r.url||r.editUrl||raw);}).catch(function(e){if(msg)msg.textContent='That Google Form could not be validated: '+(e.message||e);});
  }
  function openDriveFormsSearch(){var q='type:forms'; var s=by('formPickerSearch'); if(s&&clean(s.value))q+=' '+clean(s.value); window.open('https://drive.google.com/drive/search?q='+encodeURIComponent(q),'_blank'); var msg=by('formPickerManualMsg'); if(msg)msg.textContent='Drive search opened in a new tab.';}
  function chooseFormUrl(url){try{if(typeof window.chooseGoogleForm==='function')return window.chooseGoogleForm(url);}catch(e){}var m=by('formPickerModal');if(m)m.classList.remove('active');var row=null;try{row=window.formPickerTargetRow||formPickerTargetRow||null;}catch(e2){row=window.formPickerTargetRow||null;}if(row){var input=document.querySelector('[data-data-url-row="'+row+'"]'); if(input)input.value=url;}else if(by('studentDataFiles'))by('studentDataFiles').value=url;}
  function installFormPickerOverrides(){
    window.searchForms=function(showAll){return stableSearchForms(!!showAll);};
    window.searchGoogleFormsFromPortal=function(){return stableSearchForms(false);};
    window.useManualGoogleFormFromPortal=useManualForm;
    window.openDriveDataFileSearchFromPortal=openDriveFormsSearch;
    try{searchForms=window.searchForms;}catch(e){} try{searchGoogleFormsFromPortal=window.searchGoogleFormsFromPortal;}catch(e2){} try{useManualGoogleFormFromPortal=useManualForm;}catch(e3){} try{openDriveDataFileSearchFromPortal=openDriveFormsSearch;}catch(e4){}
  }

  var accessCache=null, accessAt=0;
  function getStaffName(){var n=by('staffName'); return n?clean(n.value):'';}
  function loadAccess(cb){if(accessCache&&Date.now()-accessAt<10000){cb(accessCache);return;}fetchJson(api('/api/v027/staff-portal/access-summary')).then(function(j){accessCache=j;accessAt=Date.now();cb(j);}).catch(function(){cb(null);});}
  function ensureStaffRow(){
    var wrap=document.querySelector('#staff .staffDataStatsV5288'); if(!wrap) return;
    var lastData=by('staffLastDataSubmittedV5288'), points=by('staffDataPointsContributedV5288');
    var lastField=lastData&&(lastData.closest('.staffDataFieldV5289')||lastData.parentNode); if(lastField)lastField.id='staffDataSubmittedFieldV5288';
    var pointsField=points&&(points.closest('.staffDataFieldV5289')||points.parentNode); if(pointsField)pointsField.id='staffDataPointsFieldV5288';
    var email=by('staffEmailFieldV024');
    if(!email){
      var input=by('staffNotificationEmailV686m41');
      email=document.createElement('div'); email.id='staffEmailFieldV024'; email.className='staffEmailFieldV024 staffDataFieldV5289';
      email.innerHTML='<label>Email <span class="helpDot" tabindex="0" data-tip="Email address used for schedule communication.">?</span></label><input id="staffNotificationEmailV686m41" class="staffEmailInputV024" type="email" autocomplete="email"><div id="staffEmailMsgV024" class="staffEmailMsgV024"></div>';
      if(input){try{input.remove();}catch(e){}}
    }
    var link=by('staffPortalLinkFieldV5312');
    var lastView=by('staffLastViewFieldV034')||by('staffLastViewFieldV028');
    if(!lastView){lastView=document.createElement('div'); lastView.id='staffLastViewFieldV034'; lastView.className='staffDataFieldV5289'; lastView.innerHTML='<label>Last View</label><input id="staffLastViewV034" class="staffDataReadonlyV5289" readonly disabled value="">';}
    else{lastView.id='staffLastViewFieldV034'; var inp=lastView.querySelector('input'); if(inp)inp.id='staffLastViewV034';}
    var cur=by('staffCurrentScheduleFieldV028'); if(cur)cur.remove();
    [lastField,pointsField,email,link,lastView].filter(Boolean).forEach(function(el){wrap.appendChild(el);});
    var lock=by('staffEmailLockBtnV025'); if(lock){lock.classList.add('historyRegularBtn','historyLockV018'); lock.innerHTML='<i class="fa-solid fa-lock" aria-hidden="true"></i>'; lock.setAttribute('aria-pressed',lock.classList.contains('active')||lock.dataset.locked==='1'?'true':'false');}
    updateLastView();
  }
  function updateLastView(){
    var lv=by('staffLastViewV034'); if(!lv)return;
    var name=getStaffName(); if(!name){lv.value=''; lv.classList.remove('staleV034'); return;}
    loadAccess(function(j){var rows=(j&&j.staff)||[]; var r=rows.find(function(x){return normName(x.staff)===normName(name);}); if(!r){lv.value='Not viewed'; lv.classList.add('staleV034'); return;} lv.value=r.lastViewed||'Not viewed'; var stale=!!(r.lastViewedRaw||r.lastViewed) && r.viewedAfterPublish===false; if(!r.lastViewed && j && j.publishedAt) stale=true; lv.classList.toggle('staleV034',stale);});
  }
  function patchStudentMaxGroup(){var el=by('studentMaxGroupSize'); if(!el)return; var upd=function(){el.classList.toggle('maxGroupZeroV034',clean(el.value)==='0');}; if(!el.__v034Max){el.__v034Max=true;el.addEventListener('input',upd,true);el.addEventListener('change',upd,true);} upd();}

  function ensureCommunicationManager(){
    var nav=document.querySelector('.nav'); if(nav && !document.querySelector('[data-nav="communicationManager"]')){var ref=document.querySelector('[data-nav="dataManager"]')||document.querySelector('[data-nav="staff"]'); var btn=document.createElement('button'); btn.id='communicationManagerNavV034'; btn.setAttribute('data-nav','communicationManager'); btn.textContent='Communication Manager'; if(ref&&ref.parentNode)ref.parentNode.insertBefore(btn,ref.nextSibling); else nav.appendChild(btn);}
    var main=document.querySelector('main'); if(main && !by('communicationManager')){var sec=document.createElement('section'); sec.id='communicationManager'; sec.className='section'; sec.innerHTML='<div class="card"><div class="toolbar" style="justify-content:flex-end;align-items:center"><button class="btn commShareBtnV034" data-v034-action="open-share-schedules">Relaunch Share Schedules</button></div><div id="communicationManagerBodyV034" class="communicationManagerGridV034" style="margin-top:12px"></div></div>'; var settings=by('settings'); if(settings)main.insertBefore(sec,settings); else main.appendChild(sec);}
  }
  function loadCommunicationManager(){
    ensureCommunicationManager(); var box=by('communicationManagerBodyV034'); if(!box)return; box.innerHTML='<div class="communicationManagerCardV034 muted">Loading communication details...</div>';
    Promise.all([fetchJson(api('/api/v027/staff-portal/access-summary')).catch(function(e){return {error:e.message,staff:[]};}),fetchJson(api('/api/v027/communication/log',{limit:'75'})).catch(function(e){return {error:e.message,rows:[]};})]).then(function(arr){
      var access=arr[0]||{}, log=arr[1]||{}, staff=access.staff||[], rows=log.rows||[];
      box.innerHTML='<div class="communicationManagerCardV034"><h3>Staff Portal Access</h3><div class="muted">Times before the latest published schedule are shown in red. Edit emails here, then click Save.</div><table class="v034Table"><thead><tr><th>Staff</th><th>Email</th><th>Last Viewed</th><th>Current Schedule</th></tr></thead><tbody>'+staff.map(function(r){return '<tr><td>'+esc(r.staff)+'</td><td><div class="commEmailRowV034"><input class="commEmailInputV034" data-staff="'+esc(r.staff)+'" data-row="'+esc(r.rowIndex||'')+'" value="'+esc(r.email||'')+'"><button class="btn small" data-v034-action="save-comm-email">Save</button></div></td><td class="'+(r.stale?'staleV034':'')+'">'+esc(r.lastViewed||'Not viewed')+'</td><td>'+(r.viewedAfterPublish?'<span class="okV034">Yes</span>':'<span class="errV034">No</span>')+'</td></tr>';}).join('')+'</tbody></table></div><div class="communicationManagerCardV034"><h3>Communication Log</h3><div class="commLogActionsV034"><button class="btn danger" data-v034-action="clear-comm-log">Clear Communication Log</button><span class="logNoteV034">Showing latest 75 records. Stored log is capped at 250 records.</span></div>'+(rows.length?'<table class="v034Table"><thead><tr><th>When</th><th>Mode/Action</th><th>Staff</th><th>Status</th><th>Details</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+esc(r.timestamp||'')+'</td><td>'+esc(r.mode||r.action||'')+'</td><td>'+esc(r.staff||r.target||'')+'</td><td>'+esc(r.status||'')+'</td><td>'+esc(r.message||r.detail||r.recipient||'')+'</td></tr>';}).join('')+'</tbody></table>':'<p class="muted">No communication entries yet.</p>')+'</div>';
    });
  }
  function saveCommEmail(btn){var row=btn.closest('tr'), input=row&&row.querySelector('.commEmailInputV034'); if(!input)return; var staff=input.getAttribute('data-staff')||'', email=input.value||'', rowIndex=input.getAttribute('data-row')||''; btn.disabled=true; btn.textContent='Saving...'; fetchJson('/api/staff/email-v022',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),staff:staff,rowIndex:rowIndex,email:email})}).then(function(){setMsg('Saved email for '+staff+'.','ok'); accessCache=null; btn.textContent='Saved'; setTimeout(function(){btn.disabled=false;btn.textContent='Save';},700); setTimeout(function(){var gm=by('globalMsg'); if(gm && /Saved email for/.test(gm.textContent||'')){gm.textContent=''; gm.style.display='none';}},1800);}).catch(function(e){btn.disabled=false;btn.textContent='Save';setMsg('Could not save email for '+staff+': '+e.message,'err');});}
  function clearCommunicationLog(){if(!confirm('Clear the Communication Log for this school?'))return; fetchJson('/api/v029/communication/log/clear',{method:'POST',body:JSON.stringify({school:selectedSchoolId()})}).then(function(){setMsg('Communication Log cleared.','ok');loadCommunicationManager();}).catch(function(e){setMsg('Could not clear Communication Log: '+e.message,'err');});}
  function openShareSchedules(){var p=by('shareSchedulesPillV686m26')||document.querySelector('.shareSchedulesPillV686m26'); if(p){var m=p.querySelector('[data-redis-v018-action="share-open"],.shareMainV018')||p;m.click();} else setMsg('Share Schedules is not ready yet. Publish a schedule first.','warn');}

  function ensureSettingsCards(){
    var settings=by('settings'); if(!settings)return;
    if(!by('appearanceCardV034')){var card=document.createElement('div'); card.id='appearanceCardV034'; card.className='card settingsUtilityCardV034'; card.innerHTML='<h2>Appearance</h2><label>Mode</label><select id="themeSelectV034"><option value="light">Light</option><option value="dark">Dark (BETA)</option></select>'; settings.appendChild(card); var saved='light'; try{saved=localStorage.getItem('gaThemeV034')||localStorage.getItem('gaThemeV027')||'light';}catch(e){} by('themeSelectV034').value=saved==='dark'?'dark':'light'; applyTheme();}
    if(!by('diagnosticsCardV034')){var d=document.createElement('div'); d.id='diagnosticsCardV034'; d.className='card settingsUtilityCardV034'; d.innerHTML='<h2>Diagnostics Mode</h2><div class="muted">Optional troubleshooting details for the current deployment. Leave off during normal use.</div><label class="miniCheck"><input id="diagnosticsToggleV034" type="checkbox" style="width:auto;margin-right:6px"> Show diagnostics</label><div id="diagnosticsBoxV034" class="muted" style="display:none;margin-top:8px"></div>'; settings.appendChild(d);}
    if(!by('settingsAuditCardV034')){var a=document.createElement('div'); a.id='settingsAuditCardV034'; a.className='card settingsUtilityCardV034'; a.innerHTML='<h2>Saved Settings Review</h2><div class="muted">Read-only review of selected saved settings.</div><div class="toolbar" style="margin-top:8px"><button class="btn" data-v034-action="load-settings-audit">Load Saved Settings</button></div><div id="settingsAuditBodyV034" style="margin-top:8px"></div>'; settings.appendChild(a);}
  }
  function applyTheme(){var sel=by('themeSelectV034'); var v=sel?sel.value:'light'; document.body.classList.toggle('darkModeV034',v==='dark'); try{localStorage.setItem('gaThemeV034',v);}catch(e){}}
  function loadDiagnostics(){var box=by('diagnosticsBoxV034'); if(!box)return; box.style.display=(by('diagnosticsToggleV034')&&by('diagnosticsToggleV034').checked)?'block':'none'; if(box.style.display==='none')return; box.textContent='Loading diagnostics...'; fetchJson(api('/api/v027/diagnostics')).then(function(j){box.innerHTML='<pre style="white-space:pre-wrap;margin:0">'+esc(JSON.stringify(j,null,2))+'</pre>';}).catch(function(e){box.textContent='Could not load diagnostics: '+e.message;});}
  function loadSettingsAudit(){var box=by('settingsAuditBodyV034'); if(!box)return; box.innerHTML='<div class="muted">Loading saved settings...</div>'; fetchJson(api('/api/v027/settings-audit')).then(function(j){var rows=j.settings||[]; box.innerHTML='<table class="v034Table"><thead><tr><th>Setting</th><th>Saved Value</th><th>Key</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+esc(r.label)+'</td><td>'+esc(r.value)+'</td><td>'+esc(r.key)+'</td></tr>';}).join('')+'</tbody></table>';}).catch(function(e){box.innerHTML='<div class="errV034">Could not load saved settings: '+esc(e.message)+'</div>';});}
  function ensureScheduleAnalysis(){
    document.querySelectorAll('[data-nav="scheduleChanges"]').forEach(function(b){b.textContent='Schedule Analysis';}); var sec=by('scheduleChanges'); if(!sec)return; if(!by('scheduleExplainCardV034')){var card=document.createElement('div'); card.id='scheduleExplainCardV034'; card.className='card'; card.style.marginTop='12px'; card.innerHTML='<h2>Explain Assignment Logic</h2><div class="muted">Review assignment explanations from the current published schedule.</div><div class="toolbar" style="margin-top:8px"><button class="btn" data-v034-action="load-schedule-explain">Load Explanations</button></div><div id="scheduleExplainBodyV034" style="margin-top:8px"></div>'; sec.appendChild(card);} }
  function loadScheduleExplain(){var box=by('scheduleExplainBodyV034'); if(!box)return; box.innerHTML='<div class="muted">Loading assignment explanations...</div>'; fetchJson(api('/api/v027/schedule/explain')).then(function(j){var rows=j.rows||[]; box.innerHTML=rows.length?'<div class="compactList">'+rows.map(function(r){return '<details class="dashItem"><summary><b>'+esc(r.staff||'Staff')+'</b> · '+esc(r.period||'')+' · '+esc(r.assignment||'')+'</summary><ul>'+((r.why||[]).map(function(w){return '<li>'+esc(w)+'</li>';}).join('')||'<li>No explanation details found.</li>')+'</ul></details>';}).join('')+'</div>':'<div class="muted">No published assignment explanations found.</div>';}).catch(function(e){box.innerHTML='<div class="errV034">Could not load assignment explanations: '+esc(e.message)+'</div>';});}

  function boot(){installStyles(); installFormPickerOverrides(); installReauthError(); normalizeTitle(); cleanSharePill(); patchFormPickerText(); ensureCommunicationManager(); ensureSettingsCards(); ensureScheduleAnalysis(); var p=activePage(); if(p==='staff')ensureStaffRow(); if(p==='students')patchStudentMaxGroup(); if(p==='dataManager'){updateDataFormsNote(); refreshReauthError();} if(p==='communicationManager')loadCommunicationManager();}
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest&&e.target.closest('[data-action],[data-v034-action],[data-nav],.searchResultBtn[data-form-url]'); if(!t)return;
    var a=t.getAttribute('data-v034-action')||t.getAttribute('data-action')||'';
    if(a==='close-reauth'){e.preventDefault();var box=by('reauthErrorV034');if(box){box.dataset.dismissed='1';box.classList.remove('active');}return;}
    if(a==='form-picker-search'){e.preventDefault();e.stopImmediatePropagation();stableSearchForms(false);return false;}
    if(a==='form-picker-browse'){e.preventDefault();e.stopImmediatePropagation();var q=by('formPickerSearch');if(q)q.value='';stableSearchForms(true);return false;}
    if(a==='form-picker-use-manual'){e.preventDefault();e.stopImmediatePropagation();useManualForm();return false;}
    if(a==='form-picker-drive-search'){e.preventDefault();e.stopImmediatePropagation();openDriveFormsSearch();return false;}
    if(a==='data-select-form'){e.preventDefault();e.stopImmediatePropagation();var tr=t.closest('tr');openFormPickerStable('data',t.getAttribute('data-data-row')||'',tr?tr.getAttribute('data-student-name')||'':'');return false;}
    if(a==='student-select-form'){e.preventDefault();e.stopImmediatePropagation();openFormPickerStable('student',null,(by('studentName')&&by('studentName').value)||'');return false;}
    if(t.classList&&t.classList.contains('searchResultBtn')&&t.getAttribute('data-form-url')){e.preventDefault();e.stopImmediatePropagation();chooseFormUrl(t.getAttribute('data-form-url'));return false;}
    if(a==='open-share-schedules'){e.preventDefault();openShareSchedules();return;}
    if(a==='save-comm-email'){e.preventDefault();saveCommEmail(t);return;}
    if(a==='clear-comm-log'){e.preventDefault();clearCommunicationLog();return;}
    if(a==='load-settings-audit'){e.preventDefault();loadSettingsAudit();return;}
    if(a==='load-schedule-explain'){e.preventDefault();loadScheduleExplain();return;}
    var nav=t.getAttribute('data-nav'); if(nav){setTimeout(function(){normalizeTitle(); if(nav==='staff')ensureStaffRow(); if(nav==='students')patchStudentMaxGroup(); if(nav==='dataManager'){updateDataFormsNote(); refreshReauthError();} if(nav==='communicationManager')loadCommunicationManager(); if(nav==='scheduleChanges')ensureScheduleAnalysis();},220);}
  },true);
  document.addEventListener('change',function(e){if(e.target&&e.target.id==='themeSelectV034')applyTheme(); if(e.target&&e.target.id==='diagnosticsToggleV034')loadDiagnostics(); if(e.target&&e.target.id==='studentMaxGroupSize')patchStudentMaxGroup();},true);
  document.addEventListener('input',function(e){if(e.target&&e.target.id==='studentMaxGroupSize')patchStudentMaxGroup(); if(e.target&&e.target.id==='staffName')setTimeout(updateLastView,80);},true);
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#staffList .active,#staffList [data-staff-row],#staffList button')){accessCache=null;setTimeout(function(){ensureStaffRow();updateLastView();},260);}},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,80);}); else setTimeout(boot,80);
  [350,1000,2200,4200].forEach(function(ms){setTimeout(boot,ms);});
})();

// V0.34 hard safety layer: bypass legacy Calendar/Attendance render paths and force Staff Manager inline row.
(function(){
  'use strict';
  if(true){ window.__gaRedisV034SafePagesLoaded=true; return; } window.__gaRedisV034SafePagesLoaded=true;
  function by(id){return document.getElementById(id);} 
  function clean(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c;});}
  function schoolPayload(){
    try{ if(typeof window.selectedSchoolPayloadV686m20==='function'){var p=window.selectedSchoolPayloadV686m20()||{}; if(p.campusId||p.schoolId||p.school||p.spreadsheetId)return p;} }catch(e){}
    try{ if(typeof window.selectedSchoolPayloadV683==='function'){var q=window.selectedSchoolPayloadV683()||{}; if(q.campusId||q.schoolId||q.school||q.spreadsheetId)return q;} }catch(e2){}
    try{var sel=by('campusSelector');var opt=sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;var ctx=window.campusContextV5253||{};var cur=ctx.currentCampus||{};var id=clean((sel&&sel.value)||ctx.selectedCampusId||cur.campusId||'');return {school:id,schoolId:id,campusId:id,schoolName:clean(cur.campusName||(opt&&opt.textContent)||id),campusName:clean(cur.campusName||(opt&&opt.textContent)||id),spreadsheetId:clean(cur.spreadsheetId||(opt&&opt.getAttribute('data-spreadsheet-id'))||'')};}catch(e3){return {};}
  }
  function schoolId(){var p=schoolPayload();return clean(p.school||p.schoolId||p.campusId||'');}
  function api(path,params){params=params||{};if(!params.school)params.school=schoolId();params._t=Date.now();return path+'?'+new URLSearchParams(params).toString();}
  function fetchJson(url,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(url,opts).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||j.message||('HTTP '+r.status));return j;});});}
  function setMsg(msg,type){try{if(typeof window.setMsg==='function')return window.setMsg(msg,type||'warn');}catch(e){}var el=by('globalMsg');if(el){el.textContent=msg||'';el.className='msg '+(type||'');el.style.display=msg?'block':'none';}}
  function installStyles(){
    if(by('gaRedisV034HardFixStyles'))return;
    var st=document.createElement('style');st.id='gaRedisV034HardFixStyles';
    st.textContent=[
      '#staff .staffDataStatsV5288{display:flex!important;flex-wrap:nowrap!important;gap:8px!important;align-items:flex-end!important;width:100%!important;max-width:none!important;overflow-x:auto!important;grid-template-columns:none!important;margin-top:8px!important}',
      '#staff #staffDataSubmittedFieldV5288{flex:0 0 180px!important;min-width:180px!important;max-width:180px!important}',
      '#staff #staffDataPointsFieldV5288{flex:0 0 194px!important;min-width:194px!important;max-width:194px!important}',
      '#staff #staffEmailFieldV024,#staff .staffEmailFieldV024{flex:0 1 350px!important;min-width:280px!important;max-width:350px!important}',
      '#staff #staffPortalLinkFieldV5312{flex:0 1 285px!important;min-width:235px!important;max-width:285px!important}',
      '#staff #staffLastViewFieldV034,#staff #staffLastViewFieldV033,#staff #staffLastViewFieldV028{flex:0 0 205px!important;min-width:205px!important;max-width:205px!important}',
      '#staff #staffDataSubmittedFieldV5288,#staff #staffDataPointsFieldV5288,#staff #staffEmailFieldV024,#staff .staffEmailFieldV024,#staff #staffPortalLinkFieldV5312,#staff #staffLastViewFieldV034,#staff #staffLastViewFieldV033,#staff #staffLastViewFieldV028{width:auto!important;grid-column:auto!important;margin:0!important;align-self:flex-end!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important}',
      '#staff .staffDataStatsV5288 label{font-size:12px!important;line-height:16px!important;min-height:16px!important;margin:0 0 5px!important;white-space:nowrap!important}',
      '#staff #staffPortalLinkFieldV5312 .staffPortalLinkLineV5312,#staff #staffPortalLinkFieldV5312 .inline{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:6px!important;align-items:center!important}',
      '#staff #staffEmailFieldV024 .staffEmailInputLockWrapV025,#staff .staffEmailFieldV024 .staffEmailInputLockWrapV025{display:grid!important;grid-template-columns:minmax(0,1fr) 26px!important;gap:4px!important;align-items:center!important}',
      '#staff #staffPortalLinkV5312,#staff #staffNotificationEmailV686m41,#staff #staffLastViewV034,#staff #staffLastViewV033,#staff #staffLastViewV028,#staff #staffLastDataSubmittedV5288,#staff #staffDataPointsContributedV5288{height:32px!important;min-height:32px!important;font-size:12px!important;font-weight:400!important;box-sizing:border-box!important;width:100%!important;min-width:0!important}',
      '#staff #staffLastViewV034,#staff #staffLastViewV033,#staff #staffLastViewV028{font-weight:400!important;color:#475569!important;background:#f8fafc!important}',
      '#staff #staffLastViewV034.staleV034,#staff #staffLastViewV033.staleV034,#staff #staffLastViewV028.staleV034{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important;font-weight:400!important}',
      '#staffEmailLockBtnV025{transition:none!important}',
      '.v034SafePageNotice{border:1px solid #dbe3ef;background:#f8fafc;border-radius:12px;padding:8px 10px;margin:0 0 10px;color:#475569;font-size:12px}.v034SafeTable{width:100%;border-collapse:collapse}.v034SafeTable th,.v034SafeTable td{border:1px solid #e5edf7;padding:6px 7px;font-size:12px;text-align:left;vertical-align:top}.v034SafeTable th{background:#f8fafc;color:#475569}.v034CalGrid{display:grid;grid-template-columns:repeat(5,minmax(160px,1fr));gap:8px}.v034CalDay{border:1px solid #dbe3ef;border-radius:12px;padding:8px;background:#fff}.v034CalDay.out{opacity:.62}.v034CalHead{display:flex;justify-content:space-between;gap:6px;font-weight:800;margin-bottom:6px}.v034CalDay select,.v034CalDay input.note{width:100%;margin-top:6px}.v034AttendanceScroll{overflow:auto;max-height:68vh}.v034DiagLinks{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.v034DiagLinks a{font-size:12px;color:#2563eb;font-weight:800}',
      'body.darkModeV034 .v034CalDay,body.darkModeV034 .v034SafeTable th{background:#172033!important;border-color:#334155!important;color:#f8fafc!important}body.darkModeV034 .v034SafePageNotice{background:#172033!important;border-color:#334155!important;color:#cbd5e1!important}',
      '@media(max-width:1500px){#staff #staffDataSubmittedFieldV5288{flex-basis:165px!important;min-width:165px!important;max-width:165px!important}#staff #staffDataPointsFieldV5288{flex-basis:180px!important;min-width:180px!important;max-width:180px!important}#staff #staffEmailFieldV024,#staff .staffEmailFieldV024{flex-basis:320px!important;max-width:320px!important}#staff #staffPortalLinkFieldV5312{flex-basis:255px!important;max-width:255px!important}#staff #staffLastViewFieldV034,#staff #staffLastViewFieldV033,#staff #staffLastViewFieldV028{flex-basis:190px!important;min-width:190px!important;max-width:190px!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function activate(page,btn,label){
    document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active');});
    var sec=by(page); if(sec)sec.classList.add('active');
    document.querySelectorAll('.nav button').forEach(function(b){b.classList.remove('active');});
    if(btn)btn.classList.add('active'); else {var nb=document.querySelector('[data-nav="'+page+'"]'); if(nb)nb.classList.add('active');}
    var pt=by('pageTitle'); if(pt)pt.textContent=label||page; document.title=(label||page)+' - Support Schedules';
  }
  var calDate=new Date(); calDate.setDate(1);
  function optionHtml(names,val){var out='<option value=""></option>'; (names||[]).forEach(function(n){out+='<option value="'+esc(n)+'" '+(String(n)===String(val)?'selected':'')+'>'+esc(n)+'</option>';}); return out;}
  function renderCalendarShell(){
    var sec=by('calendar'); if(!sec)return null;
    sec.innerHTML='<div class="card"><div class="v034SafePageNotice"><b>Calendar Manager safe renderer v034.</b> This bypasses the legacy Calendar load path that was crashing the browser. <span class="v034DiagLinks"><a href="#" data-v034safe-action="calendar-reload">Reload safe calendar</a></span></div><div class="portalCalendarTools"><div><div id="portalCalTitle" class="calendarMonthTitle">Loading...</div></div><div><label>Bulk schedule</label><select id="portalBulkSchedule"></select></div><button class="btn" data-v034safe-action="cal-apply-selected">Apply to Selected Days</button><button class="btn" data-v034safe-action="cal-apply-all">Apply to All Days</button><button class="btn danger" data-v034safe-action="cal-clear-month">Clear Month</button></div><div class="toolbar"><button class="btn" data-v034safe-action="cal-prev">‹ Previous</button><button class="btn" data-v034safe-action="cal-today">Today</button><button class="btn" data-v034safe-action="cal-next">Next ›</button><button class="btn primary" data-v034safe-action="cal-save">Save Month</button></div><div class="portalDow"><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div></div><div id="portalCalendarGrid" class="v034CalGrid"></div><div id="calendarSafeStatusV034" class="muted" style="margin-top:8px"></div></div>';
    return sec;
  }
  function renderCalendarData(data){
    data=data||{}; var title=by('portalCalTitle'), bulk=by('portalBulkSchedule'), grid=by('portalCalendarGrid');
    if(title)title.textContent=data.monthName||''; if(bulk)bulk.innerHTML=optionHtml(data.scheduleNames||[],bulk.value||''); if(!grid)return;
    var days=(data.days||[]).filter(function(day){var d=new Date(day.dateIso+'T00:00:00');var dow=d.getDay();return dow!==0&&dow!==6;});
    grid.innerHTML=days.map(function(day){return '<div class="portalDay v034CalDay '+(day.inMonth?'':'out')+(day.isToday?' today':'')+'" data-iso="'+esc(day.dateIso)+'"><div class="v034CalHead"><label><input type="checkbox" class="portalDayPick"> '+esc(day.day)+'</label><span>'+esc(day.dateIso)+'</span></div><select class="portalSched">'+optionHtml(data.scheduleNames||[],day.scheduleType||'')+'</select><input class="portalNote note" placeholder="Notes" value="'+esc(day.notes||'')+'">'+(day.attendanceAbsenceCount?'<div class="dashMeta">Absences: '+esc(day.attendanceAbsenceCount)+'</div>':'')+'</div>';}).join('');
  }
  function openCalendarSafe(btn){activate('calendar',btn,'Calendar Manager');renderCalendarShell();loadCalendarSafe();}
  function loadCalendarSafe(){
    var status=by('calendarSafeStatusV034'); if(status)status.textContent='Loading safe calendar...';
    fetchJson(api('/api/v034/calendar-safe',{year:calDate.getFullYear(),month:calDate.getMonth()+1})).then(function(j){window.calendarData=j.result||{}; renderCalendarData(window.calendarData); if(status)status.textContent='Loaded by safe renderer v034.';}).catch(function(e){if(status)status.textContent='Calendar Manager could not load: '+e.message; setMsg('Calendar Manager could not load: '+e.message,'err');});
  }
  function collectCalendarDays(){return Array.prototype.slice.call(document.querySelectorAll('#calendar .portalDay')).map(function(d){return {dateIso:d.getAttribute('data-iso'),scheduleType:(d.querySelector('.portalSched')||{}).value||'',notes:(d.querySelector('.portalNote')||{}).value||''};});}
  function saveCalendarSafe(){var status=by('calendarSafeStatusV034'); if(status)status.textContent='Saving calendar...'; fetchJson('/api/v034/calendar-safe/save',{method:'POST',body:JSON.stringify(Object.assign({school:schoolId(),year:calDate.getFullYear(),month:calDate.getMonth()+1,days:collectCalendarDays()},schoolPayload()))}).then(function(j){window.calendarData=j.result||{}; renderCalendarData(window.calendarData); if(status)status.textContent='Calendar saved.'; setMsg('Calendar saved.','ok');}).catch(function(e){if(status)status.textContent='Calendar save failed: '+e.message;setMsg('Calendar save failed: '+e.message,'err');});}
  function applyCalendarSelected(all){var bulk=by('portalBulkSchedule'), val=bulk?bulk.value:''; if(!val){setMsg('Choose a bulk schedule first.','err');return;} document.querySelectorAll('#calendar .portalDay').forEach(function(d){if(all || (d.querySelector('.portalDayPick')&&d.querySelector('.portalDayPick').checked)){var s=d.querySelector('.portalSched'); if(s)s.value=val;}}); setMsg('Applied '+val+'.','ok');}
  function clearCalendarMonth(){document.querySelectorAll('#calendar .portalDay').forEach(function(d){if(!d.classList.contains('out')){var s=d.querySelector('.portalSched'), n=d.querySelector('.portalNote'); if(s)s.value=''; if(n)n.value='';}}); setMsg('Visible month cleared. Click Save Month to persist.','warn');}
  function monthOptions(current){var now=new Date(); now.setDate(1); var html=''; for(var off=-6;off<=12;off++){var d=new Date(now.getFullYear(),now.getMonth()+off,1); var key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); var label=d.toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'long',year:'numeric'}); html+='<option value="'+key+'" '+(key===current?'selected':'')+'>'+esc(label)+'</option>'; } return html;}
  function renderAttendanceShell(){
    var sec=by('attendanceManager'); if(!sec)return null; var now=new Date(), key=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    sec.innerHTML='<div class="card"><div class="v034SafePageNotice"><b>Attendance Manager safe renderer v034.</b> This bypasses the legacy Attendance load path that was crashing the browser. <span class="v034DiagLinks"><a href="#" data-v034safe-action="attendance-reload">Reload safe attendance</a></span></div><div class="attendanceTools"><div><div id="attendanceMonthHeading" class="attendanceMonthTitle">Attendance</div></div><div class="attendanceToolsRight noPrint"><label class="tinyCheck" style="display:flex;align-items:center;gap:6px;margin-top:20px"><input id="attendanceShowNonActiveV5340" type="checkbox" style="width:auto"> Show non-active current staff</label><div><label>Month</label><select id="attendanceMonthSelect">'+monthOptions(key)+'</select></div><button class="btn" data-v034safe-action="attendance-load">Load</button><button class="btn" data-v034safe-action="attendance-print">Print</button></div></div><div id="attendanceSafeStatusV034" class="muted" style="margin:8px 0"></div><div id="attendanceGrid" class="v034AttendanceScroll"></div></div>';
    return sec;
  }
  function openAttendanceSafe(btn,staff){activate('attendanceManager',btn||document.querySelector('[data-nav="attendanceManager"]'),'Attendance Manager');renderAttendanceShell();loadAttendanceSafe(staff||'');}
  function loadAttendanceSafe(staff){var sel=by('attendanceMonthSelect'), show=by('attendanceShowNonActiveV5340'), status=by('attendanceSafeStatusV034'); var month=sel?sel.value:''; if(status)status.textContent='Loading safe attendance...'; fetchJson(api('/api/v034/attendance-safe',{month:month,staff:staff||'',showNonActive:(show&&show.checked)?'true':'false'})).then(function(j){window.attendanceManagerData=j.result||{}; renderAttendanceData(window.attendanceManagerData); if(status)status.textContent='Loaded by safe renderer v034.';}).catch(function(e){if(status)status.textContent='Attendance Manager could not load: '+e.message; setMsg('Attendance Manager could not load: '+e.message,'err');});}
  function renderAttendanceData(data){data=data||{}; var heading=by('attendanceMonthHeading'); if(heading)heading.textContent='Attendance - '+(data.monthLabel||data.month||''); var grid=by('attendanceGrid'); if(!grid)return; var days=data.days||[], rows=data.rows||[]; if(!rows.length){grid.innerHTML='<div class="muted" style="padding:12px">No attendance rows found.</div>';return;} grid.innerHTML='<table class="v034SafeTable"><thead><tr><th>Staff</th>'+days.map(function(d){return '<th title="'+esc(d.label||d.key||'')+'">'+esc(d.day||String(d.key||'').slice(-2))+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(r){var cells=r.cells||{}; return '<tr><td><b>'+esc(r.staff||'')+'</b></td>'+days.map(function(d){var k=d.key||d.dateIso||''; return '<td>'+esc(cells[k]||'')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';}
  function forceStaffRow(){
    var wrap=document.querySelector('#staff .staffDataStatsV5288'); if(!wrap)return;
    var fields=[];
    var last=by('staffLastDataSubmittedV5288'); if(last){var f=last.closest('.staffDataFieldV5289')||last.parentNode; if(f){f.id='staffDataSubmittedFieldV5288'; fields.push(f);}}
    var pts=by('staffDataPointsContributedV5288'); if(pts){var pf=pts.closest('.staffDataFieldV5289')||pts.parentNode; if(pf){pf.id='staffDataPointsFieldV5288'; fields.push(pf);}}
    var email=by('staffEmailFieldV024')||document.querySelector('#staff .staffEmailFieldV024'); if(email)fields.push(email);
    var link=by('staffPortalLinkFieldV5312'); if(link)fields.push(link);
    var lv=by('staffLastViewFieldV034')||by('staffLastViewFieldV033')||by('staffLastViewFieldV028'); if(lv){lv.id='staffLastViewFieldV034'; var input=lv.querySelector('input'); if(input)input.id='staffLastViewV034'; fields.push(lv);}
    fields.filter(Boolean).forEach(function(f){wrap.appendChild(f);});
    var lock=by('staffEmailLockBtnV025'); if(lock){lock.style.transition='none'; if(!lock.dataset.v034Stable){lock.dataset.v034Stable='1'; lock.innerHTML='<i class="fa-solid fa-lock" aria-hidden="true"></i>';}}
  }
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest&&e.target.closest('[data-nav],[data-action],[data-v034safe-action]'); if(!t)return;
    var nav=t.getAttribute('data-nav')||'', a=t.getAttribute('data-v034safe-action')||t.getAttribute('data-action')||'';
    // v041: do not intercept Calendar/Attendance main-menu navigation here.
    // The base portal redirects these to standalone pages (/calendar-manager and /attendance-manager),
    // which are the confirmed stable path. Keeping the old in-portal safe renderer active here
    // caused the main-menu clicks to bypass the standalone pages and crash.
    if(false && nav==='calendar'){e.preventDefault();e.stopImmediatePropagation();openCalendarSafe(t);return false;}
    if(false && nav==='attendanceManager'){e.preventDefault();e.stopImmediatePropagation();openAttendanceSafe(t);return false;}
    if(false && a==='refresh-all' && (document.querySelector('#calendar.active')||document.querySelector('#attendanceManager.active'))){e.preventDefault();e.stopImmediatePropagation(); if(document.querySelector('#calendar.active'))loadCalendarSafe(); else loadAttendanceSafe(''); return false;}
    if(false && (a==='cal-prev'||a==='cal-next'||a==='cal-today'||a==='cal-save'||a==='cal-apply-selected'||a==='cal-apply-all'||a==='cal-clear-month'||a==='calendar-reload')){
      if(document.querySelector('#calendar.active')){e.preventDefault();e.stopImmediatePropagation(); if(a==='cal-prev')calDate.setMonth(calDate.getMonth()-1); else if(a==='cal-next')calDate.setMonth(calDate.getMonth()+1); else if(a==='cal-today'){calDate=new Date();calDate.setDate(1);} else if(a==='cal-save')return saveCalendarSafe(); else if(a==='cal-apply-selected')return applyCalendarSelected(false); else if(a==='cal-apply-all')return applyCalendarSelected(true); else if(a==='cal-clear-month')return clearCalendarMonth(); loadCalendarSafe(); return false;}
    }
    if(false && (a==='attendance-load'||a==='attendance-print'||a==='attendance-reload'||a==='staff-attendance-history')){
      if(a==='staff-attendance-history'){var nm=(by('staffName')&&by('staffName').value)||''; e.preventDefault();e.stopImmediatePropagation(); try{window.location.href=(typeof standaloneManagerUrlV039==='function'?standaloneManagerUrlV039('attendanceManager',nm):('/attendance-manager'+(nm?'?staff='+encodeURIComponent(nm):'')));}catch(x){window.location.href='/attendance-manager'+(nm?'?staff='+encodeURIComponent(nm):'');} return false;}
      if(document.querySelector('#attendanceManager.active')){e.preventDefault();e.stopImmediatePropagation(); if(a==='attendance-print')window.print(); else loadAttendanceSafe(''); return false;}
    }
  },true);
  document.addEventListener('change',function(e){if(false && e.target&&(e.target.id==='attendanceMonthSelect'||e.target.id==='attendanceShowNonActiveV5340')&&document.querySelector('#attendanceManager.active')){loadAttendanceSafe('');}},true);
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#staffList button,#staffList [data-staff-row]')){setTimeout(forceStaffRow,120);setTimeout(forceStaffRow,450);}},true);
  document.addEventListener('input',function(e){if(e.target&&e.target.id==='staffName'){setTimeout(forceStaffRow,80);}},true);
  function boot(){installStyles(); if(document.querySelector('#staff.active'))forceStaffRow();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,50);}); else setTimeout(boot,50);
  [250,800,1800,3600].forEach(function(ms){setTimeout(boot,ms);});
})();

/* Support Schedules v05422/v05418dt Security Manager: QR label and tighter access action alignment. */
(function(){
  'use strict';
  if(window.__GA_V05422_SECURITY_MANAGER__) return;
  window.__GA_V05422_SECURITY_MANAGER__ = true;

  function by(id){return document.getElementById(id);}
  function clean(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function selectedSchoolId(){
    var sel=by('campusSelector');
    if(sel && clean(sel.value)) return clean(sel.value);
    try{var p=(typeof window.selectedSchoolPayloadV686m20==='function'?window.selectedSchoolPayloadV686m20():null)||{};var v=clean(p.school||p.schoolId||p.campusId||p.selectedCampusId||'');if(v)return v;}catch(e){}
    try{var p2=(typeof window.selectedSchoolPayloadV683==='function'?window.selectedSchoolPayloadV683():null)||{};var v2=clean(p2.school||p2.schoolId||p2.campusId||p2.selectedCampusId||'');if(v2)return v2;}catch(e2){}
    return '';
  }
  function api(path,params){params=params||{};if(!params.school)params.school=selectedSchoolId();params._t=Date.now();return path+'?'+new URLSearchParams(params).toString();}
  function fetchJson(url,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(url,opts).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||j.message||('HTTP '+r.status));return j;});});}
  function post(path,body){return fetchJson(path,{method:'POST',body:JSON.stringify(Object.assign({school:selectedSchoolId()},body||{}))});}
  function setMsg(msg,type){try{if(typeof window.setMsg==='function')return window.setMsg(msg,type||'warn');}catch(e){}}
  function activePage(){try{if(typeof window.activeSectionIdV51229==='function')return window.activeSectionIdV51229()||'';}catch(e){}var s=document.querySelector('.section.active');return s?s.id:'';}
  function fmtDate(iso){if(!iso)return '';var d=new Date(iso); if(isNaN(d.getTime()))return '';try{return new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'2-digit',day:'2-digit',year:'2-digit',hour:'numeric',minute:'2-digit',hour12:true}).format(d).replace(/\//g,'-');}catch(e){return iso;}}
  function fmtShort(iso){var x=fmtDate(iso);return x||'—';}

  function installStyles(){
    if(by('gaRedisV05422SecurityStyles'))return;
    var css=''+
      '.securityCardV05422{border:1px solid #dbe3ef;border-radius:14px;padding:16px;background:#fff}'+
      '.securityTopRowV05422{display:grid;grid-template-columns:max-content minmax(210px,360px) minmax(250px,430px) auto auto;gap:12px;align-items:end;border-top:1px solid #eef2f7;border-bottom:1px solid #eef2f7;padding:12px 0;margin:12px 0}'+
      '.securityAccessControlV05422{min-width:0;display:inline-flex;align-items:flex-end;gap:10px;justify-content:flex-start;width:max-content!important;max-width:100%}.securityAccessControlV05422 .securityTopControlV05422{flex:0 0 auto;min-width:0;width:auto}.securityAccessControlV05422 [data-v05422-action="revoke-all"]{flex:0 0 auto;margin-bottom:0!important;margin-left:0!important}'+
      '.securityTopControlV05422{min-width:0;display:flex;flex-direction:column;justify-content:flex-end}.securityTopControlV05422 label,.securityStatLabelV05422{display:flex!important;align-items:center!important;gap:4px!important;white-space:nowrap!important;font-size:12px!important;font-weight:800!important;color:#334155!important;margin:0 0 4px!important;height:17px;line-height:17px}'+
      '.securityStatValueV05422{height:36px;display:flex;align-items:center;font-size:12px;color:#64748b;line-height:1.25}.securityTopControlV05422 select{height:36px;width:100%;border:1px solid #dbe3ef;border-radius:10px;padding:0 8px;font-size:13px;background:#fff;font-family:inherit;font-weight:600}'+
      '.securityEndSessionsBtnV05422{border-color:#fecaca!important;background:#fef2f2!important;color:#991b1b!important;font-family:inherit!important;font-weight:800!important;white-space:nowrap}.securityEndSessionsBtnV05422:hover{background:#fee2e2!important}'+
      '.securitySavePolicyBtnV05422{white-space:nowrap}.securityButtonsV05422{display:flex;gap:8px;align-items:flex-end;justify-content:flex-start}#secPolicyMsgV05422{display:none!important}'+
      '.securityTableV05422{width:100%;border-collapse:collapse;margin-top:8px}.securityTableV05422 th,.securityTableV05422 td{border-bottom:1px solid #e5edf7;padding:8px;text-align:left;vertical-align:middle;font-size:13px}.securityTableV05422 th{font-size:11px;color:#64748b;background:#f8fafc;text-transform:uppercase;letter-spacing:.03em}'+
      '.securityIconBtnV05422{border:0;background:transparent;cursor:pointer;font-size:16px;padding:5px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;min-width:28px;min-height:28px}.securityIconBtnV05422:hover{background:#f1f5f9}.securityIconBtnV05422:disabled{opacity:.45;cursor:not-allowed}'+
      '.secIconGreenV05422{color:#16a34a}.secIconGreyV05422{color:#94a3b8}.secIconRedV05422{color:#dc2626}.secIconNavyV05422{color:#0A2540}.secIconAmberV05422{color:#d97706}.secIconBlueV05422{color:#2563eb}'+
      '.securityRowInactiveV05422{opacity:.62}.securityLastAccessBtnV05422{border:0;background:transparent;color:#2563eb;font-size:12px;font-weight:700;cursor:pointer;text-decoration:underline;padding:0}.securityLastAccessBtnV05422.neverV05422{color:#94a3b8;text-decoration:none;cursor:default}'+
      '.securityBadgeRevokedV05422{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:999px;padding:2px 8px;margin-left:6px}'+
      '.securityFlagCountV05422{font-size:10px;font-weight:900;margin-left:2px;color:inherit}.securitySectionTitleV05422{font-size:13px;font-weight:900;color:#0f172a;margin:16px 0 6px}.securityRevokedWrapV05422{border-top:1px solid #eef2f7;margin-top:14px;padding-top:10px}.securityMiniTableV05422{width:100%;border-collapse:collapse;font-size:12px}.securityMiniTableV05422 th,.securityMiniTableV05422 td{border-bottom:1px solid #eef2f7;padding:7px;text-align:left}.securityMiniTableV05422 th{background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase}'+
      '.v05422ModalBackdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:none;align-items:center;justify-content:center;z-index:210;padding:16px}.v05422ModalBackdrop.open{display:flex}.v05422ModalPanel{width:min(620px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 20px 50px rgba(15,23,42,.25)}.v05422ModalHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.v05422LogTable{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}.v05422LogTable th,.v05422LogTable td{border-bottom:1px solid #eef2f7;padding:6px;text-align:left;vertical-align:top}.v05422LookupBtn{border:0;background:transparent;color:#2563eb;font-size:11px;cursor:pointer;text-decoration:underline;padding:0}.v05422LinkOut{width:100%;border:1px solid #dbe3ef;border-radius:8px;padding:8px;font-size:11px;color:#475569;background:#f8fafc;margin-top:4px;word-break:break-all}'+
      '.securityFlagListV05422{display:grid;gap:8px;margin-top:8px}.securityFlagItemV05422{border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#f8fafc}.securityFlagItemV05422.red{border-color:#fecaca;background:#fef2f2}.securityFlagItemV05422.amber{border-color:#fed7aa;background:#fff7ed}.securityForceNoteV05422{font-size:12px;color:#64748b;line-height:1.4;margin:6px 0 0}'+
      '@media(max-width:1250px){.securityTopRowV05422{grid-template-columns:1fr 1fr}.securityTopRowV05422>.btn,.securityTopRowV05422>.securityButtonsV05422{width:100%;justify-content:flex-start}.securityButtonsV05422 button{flex:1}}'+
      'body.darkModeV034 .securityCardV05422,body.darkModeV034 .v05422ModalPanel{background:#172033!important;border-color:#334155!important;color:#f8fafc!important}body.darkModeV034 .securityTableV05422 th,body.darkModeV034 .securityMiniTableV05422 th{background:#0f172a!important;color:#94a3b8!important}body.darkModeV034 .v05422LinkOut{background:#0f172a!important;color:#cbd5e1!important;border-color:#475569!important}';
    var style=document.createElement('style'); style.id='gaRedisV05422SecurityStyles'; style.textContent=css; document.head.appendChild(style);
  }

  var stateV05422={rows:[],revokedInactive:[],portalAppGeneratedOn:'',passcodePolicy:{mode:'disabled',forgotOption:'email'}};

  function ensureSection(){
    var sec=by('securityManager');
    if(!sec){var main=document.querySelector('main')||document.body;sec=document.createElement('section');sec.id='securityManager';sec.className='section';main.appendChild(sec);}
    var nav=document.querySelector('.nav');
    if(nav && !document.querySelector('[data-nav="securityManager"]')){
      var ref=document.querySelector('[data-nav="calendar"]')||document.querySelector('[data-nav="communicationManager"]')||document.querySelector('[data-nav="staff"]');
      var btn=document.createElement('button'); btn.setAttribute('data-nav','securityManager'); btn.textContent='Security Manager';
      if(ref&&ref.parentNode)ref.parentNode.insertBefore(btn,ref.nextSibling); else nav.appendChild(btn);
    }
    var existingBody=by('securityManagerBodyV05422');
    var existingCard=sec.querySelector('.securityCardV05422');
    var existingTable=sec.querySelector('.securityTableV05422');
    var existingTop=sec.querySelector('.securityTopRowV05422');
    var existingRevoked=sec.querySelector('.securityRevokedWrapV05422');
    var shellVersion=existingCard&&existingCard.getAttribute&&existingCard.getAttribute('data-v05422-shell');
    var needsShell=!existingBody||!existingCard||!existingTable||!existingTop||!existingRevoked||existingTop.previousElementSibling!==existingTable||shellVersion!=='cs';
    if(needsShell){
      sec.innerHTML='<div class="securityCardV05422" data-v05422-shell="cs">'
        +'<table class="securityTableV05422"><thead><tr><th>Staff</th><th>Portal / App Access via QR</th><th>Passcode</th><th>History</th><th>Force Check</th><th>Flags</th><th>Last Access</th><th>Last App Activity</th></tr></thead><tbody id="securityManagerBodyV05422"></tbody></table>'
        +'<div class="securityTopRowV05422">'
          +'<div class="securityAccessControlV05422"><div class="securityTopControlV05422"><div class="securityStatLabelV05422">Portal / App Access via QR <span class="helpDot" data-tip="Shows when Staff QR letters were last batch generated for this school. Use Revoke All only when existing printed/saved access should be invalidated.">?</span></div><div class="securityStatValueV05422" id="secGeneratedOnV05422">Generated on: --</div></div><button class="btn danger" data-v05422-action="revoke-all">Revoke All</button></div>'
          +'<div class="securityTopControlV05422"><label>Portal / App Passcode <span class="helpDot" data-tip="Disabled: no passcode used. Optional: staff can turn on a 4-digit passcode from portal/app settings. Required: every active staff member must set a passcode on first access.">?</span></label><select id="secPasscodeModeV05422"><option value="disabled">Disabled</option><option value="optional">Optional</option><option value="required">Required</option></select></div>'
          +'<div class="securityTopControlV05422"><label>Forgot Passcode Options <span class="helpDot" data-tip="Admin reset is always available. Automated email additionally lets staff reset their own passcode via a link sent to their email on file.">?</span></label><select id="secForgotOptionV05422"><option value="email">Automated Email</option><option value="none">Admin Reset Only</option></select></div>'
          +'<div class="securityButtonsV05422"><button class="btn primary securitySavePolicyBtnV05422" data-v05422-action="save-policy">Save</button></div>'
          +'<button class="btn securityEndSessionsBtnV05422" data-v05422-action="end-sessions">End All Staff Portal Sessions</button>'
        +'</div>'
        +'<span id="secPolicyMsgV05422" class="muted" style="font-size:12px"></span>'
        +'<div class="securityRevokedWrapV05422"><div class="securitySectionTitleV05422">Revoked / Inactive Access</div><div id="securityRevokedListV05422"></div></div>'
        +'</div>';
    }
    ensureModalsV05422();try{if(typeof initHelpTooltipOverlayV5254==='function')initHelpTooltipOverlayV5254();}catch(e){}return sec;
  }

  function ensureModalsV05422(){
    function add(id,html){if(!by(id)){var m=document.createElement('div');m.id=id;m.className='v05422ModalBackdrop';m.innerHTML=html;document.body.appendChild(m);}}
    add('secLogModalV05422','<div class="v05422ModalPanel"><div class="v05422ModalHead"><h2 style="margin:0;font-size:16px" id="secLogModalTitleV05422">Security History</h2><button class="btn" data-v05422-action="close-log">Close</button></div><p class="muted" style="margin:0 0 6px">Most recent access and security events for this staff member.</p><div id="secLogBodyV05422"></div></div>');
    add('secLinkModalV05422','<div class="v05422ModalPanel"><div class="v05422ModalHead"><h2 style="margin:0;font-size:16px" id="secLinkModalTitleV05422">Portal Link</h2><button class="btn" data-v05422-action="close-link">Close</button></div><p class="muted" id="secLinkIntroV05422" style="margin:0 0 10px"></p><div id="secLinkBodyV05422"></div></div>');
    add('secPinModalV05422','<div class="v05422ModalPanel"><div class="v05422ModalHead"><h2 style="margin:0;font-size:16px">Reset Passcode</h2><button class="btn" data-v05422-action="close-pin">Close</button></div><p class="muted" id="secPinIntroV05422" style="margin:0 0 10px"></p><div id="secPinMsgV05422" class="muted" style="font-size:12px;margin-bottom:8px"></div><div class="toolbar"><button class="btn danger" data-v05422-action="confirm-pin-reset">Reset Passcode</button></div></div>');
    add('secFlagModalV05422','<div class="v05422ModalPanel"><div class="v05422ModalHead"><h2 style="margin:0;font-size:16px" id="secFlagTitleV05422">Security Flags</h2><button class="btn" data-v05422-action="close-flags">Close</button></div><div id="secFlagBodyV05422"></div></div>');
    add('secForceModalV05422','<div class="v05422ModalPanel"><div class="v05422ModalHead"><h2 style="margin:0;font-size:16px" id="secForceTitleV05422">Force Passcode Check</h2><button class="btn" data-v05422-action="close-force">Close</button></div><p class="muted" id="secForceIntroV05422"></p><div class="toolbar" id="secForceBodyV05422"></div></div>');
    add('secEndSessionsModalV05422','<div class="v05422ModalPanel"><div class="v05422ModalHead"><h2 style="margin:0;font-size:16px">End All Staff Portal Sessions</h2><button class="btn" data-v05422-action="close-end-sessions">Close</button></div><p class="muted">This requires staff to pass the passcode step on their next Staff Portal or paired app open. It does not revoke links or unpair devices.</p><div class="toolbar"><button class="btn" data-v05422-action="do-end-sessions" data-mode="with-passcodes">Staff with passcodes only</button><button class="btn danger" data-v05422-action="do-end-sessions" data-mode="all">All active staff</button></div></div>');
  }

  function linkIconHtml(status){if(status==='valid')return '<i class="fa-solid fa-link secIconGreenV05422" title="Valid link, has been accessed"></i>';if(status==='never-accessed')return '<i class="fa-solid fa-link secIconGreyV05422" title="Valid link, never accessed"></i>';return '<i class="fa-solid fa-link-slash secIconRedV05422" title="Revoked -- no active link"></i>';}
  function passcodeIconHtml(has){return has?'<i class="fa-solid fa-key secIconGreenV05422" title="Passcode set -- click to reset"></i>':'<span class="muted" style="font-size:12px">—</span>';}
  function historyIconHtml(row){var cls=(row.lastAccess||row.hasPasscode||row.appDeviceCount)?'secIconNavyV05422':'secIconGreyV05422';return '<i class="fa-solid fa-folder '+cls+'" title="Open security history"></i>';}
  function forceIconHtml(row){if(!row.active)return '<i class="fa-solid fa-user-lock secIconGreyV05422" title="Inactive staff"></i>';return '<i class="fa-solid fa-user-lock '+(row.forcePasscode?'secIconAmberV05422':'secIconGreyV05422')+'" title="'+(row.forcePasscode?'Force check pending':'Force passcode check on next open')+'"></i>';}
  function flagIconHtml(row){var flags=row.flags||[];if(!flags.length)return '<i class="fa-solid fa-flag secIconGreyV05422" title="No active flags"></i>';var red=flags.some(function(f){return f.severity==='red';});return '<i class="fa-solid fa-flag '+(red?'secIconRedV05422':'secIconAmberV05422')+'" title="Active security flags"></i><span class="securityFlagCountV05422">'+flags.length+'</span>';}

  function renderTable(){
    var body=by('securityManagerBodyV05422'); if(!body)return;
    if(!stateV05422.rows.length){body.innerHTML='<tr><td colspan="8" class="muted">No staff found for this school.</td></tr>';renderRevokedInactive();return;}
    body.innerHTML=stateV05422.rows.map(function(r){
      var lastAccessHtml=r.lastAccess?'<span>'+esc(fmtDate(r.lastAccess.timestamp))+'</span>':'<span class="securityLastAccessBtnV05422 neverV05422">Never accessed</span>';
      var linkCell=r.active?'<button class="securityIconBtnV05422" data-v05422-action="open-link" data-status="'+esc(r.linkStatus)+'" data-active="1" data-staff="'+esc(r.name)+'" title="'+(r.linkStatus==='revoked'?'Generate a new portal link':'Revoke this portal/app link')+'">'+linkIconHtml(r.linkStatus)+'</button>':'<span class="securityIconBtnV05422" title="Inactive staff cannot receive a new link">'+linkIconHtml('revoked')+'</span>';
      var pinCell=r.hasPasscode?'<button class="securityIconBtnV05422" data-v05422-action="open-pin" data-staff="'+esc(r.name)+'" title="Reset passcode">'+passcodeIconHtml(true)+'</button>':passcodeIconHtml(false);
      var hist='<button class="securityIconBtnV05422" data-v05422-action="open-log" data-staff="'+esc(r.name)+'">'+historyIconHtml(r)+'</button>';
      var force='<button class="securityIconBtnV05422" data-v05422-action="open-force" data-staff="'+esc(r.name)+'" '+(r.active?'':'disabled')+'>'+forceIconHtml(r)+'</button>';
      var flags='<button class="securityIconBtnV05422" data-v05422-action="open-flags" data-staff="'+esc(r.name)+'" '+((r.flags||[]).length?'':'disabled')+'>'+flagIconHtml(r)+'</button>';
      var revokedBadge=!r.active?'<span class="securityBadgeRevokedV05422">Inactive · revoked</span>':'';
      return '<tr class="'+(r.active?'':'securityRowInactiveV05422')+'"><td>'+esc(r.name)+revokedBadge+'</td><td>'+linkCell+'</td><td>'+pinCell+'</td><td>'+hist+'</td><td>'+force+'</td><td>'+flags+'</td><td>'+lastAccessHtml+'</td><td>'+esc(fmtShort(r.appLastSeen))+(r.appDeviceCount>1?' <span class="securityBadgeRevokedV05422" style="color:#92400e;background:#fffbeb;border-color:#fde68a">'+r.appDeviceCount+' devices</span>':'')+'</td></tr>';
    }).join('');
    renderRevokedInactive();
  }
  function renderRevokedInactive(){
    var el=by('securityRevokedListV05422'); if(!el)return;
    var rows=stateV05422.revokedInactive||[];
    if(!rows.length){el.innerHTML='<div class="muted" style="font-size:12px">No revoked or inactive access records yet.</div>';return;}
    el.innerHTML='<table class="securityMiniTableV05422"><thead><tr><th>Staff</th><th>Status</th><th>Event</th><th>Date</th><th>By</th><th>Action</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+esc(r.staffName)+'</td><td>'+esc(r.status)+'</td><td>'+esc(r.event)+'</td><td>'+esc(fmtDate(r.timestamp))+'</td><td>'+esc(r.by||'')+'</td><td><button class="securityIconBtnV05422" data-v05422-action="open-log" data-staff="'+esc(r.staffName)+'"><i class="fa-solid fa-folder secIconNavyV05422"></i></button></td></tr>';}).join('')+'</tbody></table>';
  }

  function loadSecurityManager(force){
    fetchJson(api('/api/v05422/security-overview')).then(function(j){
      stateV05422.rows=j.staff||[];stateV05422.revokedInactive=j.revokedInactive||[];stateV05422.portalAppGeneratedOn=j.portalAppGeneratedOn||'';stateV05422.passcodePolicy=j.passcodePolicy||{mode:'disabled',forgotOption:'email'};
      var gen=by('secGeneratedOnV05422'); if(gen)gen.textContent='Generated on: '+(stateV05422.portalAppGeneratedOn?fmtDate(stateV05422.portalAppGeneratedOn):'Not yet generated');
      var modeSel=by('secPasscodeModeV05422'); if(modeSel)modeSel.value=stateV05422.passcodePolicy.mode;
      var forgotSel=by('secForgotOptionV05422'); if(forgotSel)forgotSel.value=stateV05422.passcodePolicy.forgotOption;
      renderTable();
    }).catch(function(e){setMsg('Could not load Security Manager: '+e.message,'err');});
  }

  function findRow(staffName){var k=clean(staffName).toLowerCase();return (stateV05422.rows||[]).find(function(r){return clean(r.name).toLowerCase()===k;})||{};}

  function openLog(staffName){
    ensureModalsV05422();by('secLogModalTitleV05422').textContent='Security History — '+staffName;by('secLogBodyV05422').innerHTML='<div class="muted">Loading...</div>';by('secLogModalV05422').classList.add('open');
    fetchJson(api('/api/v05422/security-access-log',{staffName:staffName})).then(function(j){
      var access=j.rows||[], events=j.events||[];
      var html='';
      html+='<h3 style="font-size:13px;margin:8px 0 4px">Access</h3>';
      if(!access.length)html+='<div class="muted">No access history yet.</div>';else html+='<table class="v05422LogTable"><thead><tr><th>When</th><th>Via</th><th>Device</th><th>IP</th></tr></thead><tbody>'+access.map(function(r){var routeLabel=(r.route==='app'||r.route==='app-pair'||r.route==='app-auto-pair')?'App':'Portal';var device=esc(String(r.userAgent||'').slice(0,80))||'—';var ip=esc(r.ip||'')||'—';var lookupId='lookup_'+Math.random().toString(36).slice(2);return '<tr><td>'+esc(fmtDate(r.timestamp))+'</td><td>'+routeLabel+'</td><td>'+device+'</td><td>'+ip+(r.ip?' <button class="v05422LookupBtn" data-ip="'+esc(r.ip)+'" data-target="'+lookupId+'">look up</button><div id="'+lookupId+'" class="muted" style="font-size:11px"></div>':'')+'</td></tr>';}).join('')+'</tbody></table>';
      html+='<h3 style="font-size:13px;margin:14px 0 4px">Security Events</h3>';
      if(!events.length)html+='<div class="muted">No security events yet.</div>';else html+='<table class="v05422LogTable"><thead><tr><th>When</th><th>Event</th><th>Detail</th></tr></thead><tbody>'+events.map(function(r){return '<tr><td>'+esc(fmtDate(r.timestamp))+'</td><td>'+esc(r.event)+'</td><td>'+esc(r.detail||'')+'</td></tr>';}).join('')+'</tbody></table>';
      by('secLogBodyV05422').innerHTML=html;
    }).catch(function(e){by('secLogBodyV05422').innerHTML='<div class="muted">Could not load history: '+esc(e.message)+'</div>';});
  }
  function lookupIp(ip,targetId){var el=by(targetId); if(!el)return; el.textContent='Looking up...';fetch('https://ipapi.co/'+encodeURIComponent(ip)+'/json/').then(function(r){return r.json();}).then(function(j){el.textContent=(j&&!j.error)?([j.city,j.region,j.country_name].filter(Boolean).join(', ')||'Location not found.'):'Location not found.';}).catch(function(){el.textContent='Look-up failed (network or rate limit).';});}

  function openFlags(staffName){
    var row=findRow(staffName), flags=row.flags||[]; if(!flags.length)return;
    by('secFlagTitleV05422').textContent='Security Flags — '+staffName;
    by('secFlagBodyV05422').innerHTML='<div class="securityFlagListV05422">'+flags.map(function(f){return '<div class="securityFlagItemV05422 '+(f.severity==='red'?'red':'amber')+'"><div style="display:flex;justify-content:space-between;gap:8px"><b>'+esc(f.label)+'</b><span>'+esc(f.severity==='red'?'High':'Review')+'</span></div>'+(f.count?'<p class="securityForceNoteV05422">Related device count: '+esc(f.count)+'</p>':'')+(f.triggeredAt?'<p class="securityForceNoteV05422">First seen: '+esc(fmtDate(f.triggeredAt))+'</p>':'')+(f.reviewable?'<div class="toolbar" style="margin-top:8px"><button class="btn small" data-v05422-action="review-flag" data-staff="'+esc(staffName)+'" data-flag="'+esc(f.id)+'">Mark reviewed</button></div>':'<p class="securityForceNoteV05422">This flag clears automatically when the underlying issue is resolved.</p>')+'</div>';}).join('')+'</div>';
    by('secFlagModalV05422').classList.add('open');
  }
  function reviewFlag(staffName,flagId){post('/api/v05422/security-flag/review',{staffName:staffName,flagId:flagId}).then(function(){setMsg('Security flag marked reviewed.','ok');by('secFlagModalV05422').classList.remove('open');loadSecurityManager(true);}).catch(function(e){setMsg('Could not review flag: '+e.message,'err');});}

  function openForce(staffName){
    var row=findRow(staffName); if(!row.active)return;
    by('secForceTitleV05422').textContent='Force Passcode Check — '+staffName;
    by('secForceIntroV05422').innerHTML=row.forcePasscode?'A passcode check is already pending. The icon stays highlighted until this staff member opens the Staff Portal/app and completes the passcode step.':'Require this staff member to complete the passcode step the next time they open the Staff Portal or paired app.';
    by('secForceBodyV05422').innerHTML=row.forcePasscode?'<button class="btn" data-v05422-action="do-force-check" data-enabled="false" data-staff="'+esc(staffName)+'">Clear forced check</button>':'<button class="btn primary" data-v05422-action="do-force-check" data-enabled="true" data-staff="'+esc(staffName)+'">Force check on next open</button>';
    by('secForceModalV05422').classList.add('open');
  }
  function doForce(staffName,enabled){post('/api/v05422/passcode/force-check',{staffName:staffName,enabled:enabled}).then(function(){setMsg(enabled?'Passcode check will be required on next open.':'Forced passcode check cleared.','ok');by('secForceModalV05422').classList.remove('open');loadSecurityManager(true);}).catch(function(e){setMsg('Could not update forced check: '+e.message,'err');});}

  function openLinkModal(staffName,status,active){ensureModalsV05422();var row=findRow(staffName);status=status||row.linkStatus||'revoked';active=active!==false&&active!=='0'&&row.active!==false;if(!active)return;if(status==='revoked'){by('secLinkModalTitleV05422').textContent='Generate Portal Link';by('secLinkIntroV05422').textContent=staffName+'’s current portal link is revoked. Generate a new Staff Portal link below.';by('secLinkBodyV05422').innerHTML='<div class="toolbar"><button class="btn primary" data-v05422-action="do-generate-link" data-staff="'+esc(staffName)+'">Generate New Portal Link</button></div>';}else{by('secLinkModalTitleV05422').textContent='Revoke Portal / App Access?';by('secLinkIntroV05422').textContent='Revoke the current portal link and app-pairing QR for '+staffName+'? They will need a newly generated portal link to access again.';by('secLinkBodyV05422').innerHTML='<div class="toolbar"><button class="btn" data-v05422-action="close-link">Cancel</button><button class="btn danger" data-v05422-action="do-revoke-link" data-staff="'+esc(staffName)+'">Revoke Link</button></div>';}by('secLinkModalV05422').classList.add('open');}
  function doRevokeLink(staffName){post('/api/v05421/staff-token/revoke',{staffName:staffName}).then(function(){setMsg('Revoked portal/app access for '+staffName+'.','ok');by('secLinkModalV05422').classList.remove('open');loadSecurityManager(true);try{if(typeof window.gaV05423RenderAccessIcon==='function')window.gaV05423RenderAccessIcon(true);}catch(e0){}}).catch(function(e){setMsg('Could not revoke link: '+e.message,'err');});}
  function doGenerateLink(staffName){post('/api/v05422/staff-link/generate',{staffName:staffName}).then(function(j){by('secLinkBodyV05422').innerHTML='<label style="font-size:11px;font-weight:800;color:#334155">Staff Portal Link</label><div class="v05422LinkOut">'+esc(j.staffLink)+'</div><div class="toolbar" style="margin-top:8px"><button class="btn small" data-v05422-action="copy-link" data-link="'+esc(j.staffLink)+'">Copy</button><button class="btn primary small" data-v05422-action="single-letter" data-staff="'+esc(staffName)+'">Generate Updated PDF Letter</button></div><p class="muted" style="font-size:11px;margin-top:12px">Only the Staff Portal link is regenerated here. App auto-pair QR codes are generated from the Staff Letter PDF.</p>';setMsg('New portal link generated for '+staffName+'.','ok');loadSecurityManager(true);try{if(typeof window.gaV05423RenderAccessIcon==='function')window.gaV05423RenderAccessIcon(true);}catch(e0){}}).catch(function(e){setMsg('Could not generate link: '+e.message,'err');});}
  function generateSingleLetter(staffName){setMsg('Generating updated PDF letter for '+staffName+'...','ok');fetch('/api/v05419/staff-portal-letters/generate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({school:selectedSchoolId(),staffName:staffName})}).then(function(r){if(!r.ok)return r.json().catch(function(){return {};}).then(function(j){throw new Error(j.error||('HTTP '+r.status));});return r.blob().then(function(blob){var a=document.createElement('a');var url=URL.createObjectURL(blob);a.href=url;a.download='Staff QR Letter - '+staffName+'.pdf';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);setMsg('PDF letter generated for '+staffName+'.','ok');});}).catch(function(e){setMsg('Could not generate PDF letter: '+e.message,'err');});}

  var pendingPinStaff='';
  function openPinModal(staffName){ensureModalsV05422();pendingPinStaff=staffName;by('secPinIntroV05422').textContent='Resetting '+staffName+'’s passcode clears their current PIN. They will need to set a new one on their next access. Their portal/app link and QR codes are not affected.';by('secPinMsgV05422').textContent='';by('secPinModalV05422').classList.add('open');}
  function confirmPinReset(){if(!pendingPinStaff)return;var msgEl=by('secPinMsgV05422'); if(msgEl)msgEl.textContent='Resetting...';post('/api/v05422/passcode/admin-reset',{staffName:pendingPinStaff}).then(function(){setMsg('Passcode reset for '+pendingPinStaff+'.','ok');by('secPinModalV05422').classList.remove('open');loadSecurityManager(true);}).catch(function(e){if(msgEl)msgEl.textContent='Could not reset: '+e.message;});}

  function revokeAll(){var activeCount=stateV05422.rows.filter(function(r){return r.active;}).length;var doIt=function(){post('/api/v05422/revoke-all',{}).then(function(j){setMsg('Revoked portal/app access for '+(j.revokedCount||0)+' active staff member(s).','ok');loadSecurityManager(true);}).catch(function(e){setMsg('Could not revoke all: '+e.message,'err');});};if(typeof window.showPortalConfirmV51231==='function'){window.showPortalConfirmV51231({title:'Revoke all portal/app access?',message:'This immediately invalidates the current portal link and app pairing for all '+activeCount+' active staff member(s) at this school. New links/letters can be generated right after.',okText:'Revoke All',danger:true,onOk:doIt});}else if(window.confirm('Revoke portal/app access for all '+activeCount+' active staff member(s)?'))doIt();}
  function savePolicy(){var mode=(by('secPasscodeModeV05422')||{}).value||'disabled';var forgot=(by('secForgotOptionV05422')||{}).value||'email';var msgEl=by('secPolicyMsgV05422');if(msgEl)msgEl.textContent='';post('/api/v05422/passcode-policy/save',{mode:mode,forgotOption:forgot}).then(function(){if(msgEl)msgEl.textContent='';setMsg('Security policy saved.','ok');loadSecurityManager(true);}).catch(function(e){if(msgEl)msgEl.textContent='';setMsg('Could not save policy: '+e.message,'err');});}
  function doEndSessions(mode){post('/api/v05422/passcode/end-sessions',{mode:mode}).then(function(j){setMsg('Passcode check will be required for '+(j.forcedCount||0)+' staff member(s) on next open.','ok');by('secEndSessionsModalV05422').classList.remove('open');loadSecurityManager(true);}).catch(function(e){setMsg('Could not end sessions: '+e.message,'err');});}

  document.addEventListener('click',function(e){
    var lookupBtn=e.target&&e.target.closest&&e.target.closest('.v05422LookupBtn');if(lookupBtn){e.preventDefault();lookupIp(lookupBtn.getAttribute('data-ip'),lookupBtn.getAttribute('data-target'));return;}
    var b=e.target&&e.target.closest&&e.target.closest('[data-v05422-action],[data-nav]'); if(!b)return;var a=b.getAttribute('data-v05422-action')||'';
    if(a==='revoke-all'){e.preventDefault();e.stopImmediatePropagation();revokeAll();return false;}
    if(a==='save-policy'){e.preventDefault();e.stopImmediatePropagation();savePolicy();return false;}
    if(a==='end-sessions'){e.preventDefault();e.stopImmediatePropagation();by('secEndSessionsModalV05422').classList.add('open');return false;}
    if(a==='do-end-sessions'){e.preventDefault();e.stopImmediatePropagation();doEndSessions(b.getAttribute('data-mode')||'all');return false;}
    if(a==='close-end-sessions'){e.preventDefault();e.stopImmediatePropagation();by('secEndSessionsModalV05422').classList.remove('open');return false;}
    if(a==='open-log'){e.preventDefault();e.stopImmediatePropagation();openLog(b.getAttribute('data-staff'));return false;}
    if(a==='close-log'){e.preventDefault();e.stopImmediatePropagation();by('secLogModalV05422').classList.remove('open');return false;}
    if(a==='open-flags'){e.preventDefault();e.stopImmediatePropagation();openFlags(b.getAttribute('data-staff'));return false;}
    if(a==='close-flags'){e.preventDefault();e.stopImmediatePropagation();by('secFlagModalV05422').classList.remove('open');return false;}
    if(a==='review-flag'){e.preventDefault();e.stopImmediatePropagation();reviewFlag(b.getAttribute('data-staff'),b.getAttribute('data-flag'));return false;}
    if(a==='open-force'){e.preventDefault();e.stopImmediatePropagation();openForce(b.getAttribute('data-staff'));return false;}
    if(a==='do-force-check'){e.preventDefault();e.stopImmediatePropagation();doForce(b.getAttribute('data-staff'),b.getAttribute('data-enabled')!=='false');return false;}
    if(a==='close-force'){e.preventDefault();e.stopImmediatePropagation();by('secForceModalV05422').classList.remove('open');return false;}
    if(a==='open-link'){e.preventDefault();e.stopImmediatePropagation();openLinkModal(b.getAttribute('data-staff'),b.getAttribute('data-status'),b.getAttribute('data-active'));return false;}
    if(a==='confirm-revoke-link'){e.preventDefault();e.stopImmediatePropagation();openLinkModal(b.getAttribute('data-staff'),b.getAttribute('data-status'),b.getAttribute('data-active'));return false;}
    if(a==='do-generate-link'){e.preventDefault();e.stopImmediatePropagation();doGenerateLink(b.getAttribute('data-staff'));return false;}
    if(a==='do-revoke-link'){e.preventDefault();e.stopImmediatePropagation();doRevokeLink(b.getAttribute('data-staff'));return false;}
    if(a==='single-letter'){e.preventDefault();e.stopImmediatePropagation();generateSingleLetter(b.getAttribute('data-staff'));return false;}
    if(a==='close-link'){e.preventDefault();e.stopImmediatePropagation();by('secLinkModalV05422').classList.remove('open');return false;}
    if(a==='copy-link'){e.preventDefault();e.stopImmediatePropagation();var link=b.getAttribute('data-link')||'';if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(link).then(function(){setMsg('Link copied.','ok');});return false;}
    if(a==='open-pin'){e.preventDefault();e.stopImmediatePropagation();openPinModal(b.getAttribute('data-staff'));return false;}
    if(a==='close-pin'){e.preventDefault();e.stopImmediatePropagation();by('secPinModalV05422').classList.remove('open');return false;}
    if(a==='confirm-pin-reset'){e.preventDefault();e.stopImmediatePropagation();confirmPinReset();return false;}
    var nav=b.getAttribute('data-nav'); if(nav==='securityManager'){setTimeout(function(){fixSecurityTitle();loadSecurityManager(true);},360);}
  },true);

  document.addEventListener('change',function(e){if(e.target&&e.target.id==='campusSelector'){setTimeout(function(){if(activePage()==='securityManager'){fixSecurityTitle();loadSecurityManager(true);}},300);}},true);
  function fixSecurityTitle(){try{var pt=by('pageTitle');if(activePage()==='securityManager'||(pt&&clean(pt.textContent)==='securityManager')){if(pt)pt.textContent='Security Manager';document.title='Security Manager - Support Schedules';}}catch(e){}}
  function boot(){installStyles();ensureSection();fixSecurityTitle();if(activePage()==='securityManager')loadSecurityManager(true);}
  try{if(typeof window.registerNavigationAfterHookV5_==='function')window.registerNavigationAfterHookV5_(function(page){if(page==='securityManager')setTimeout(function(){fixSecurityTitle();loadSecurityManager(true);},240);},'v05422SecurityManager');}catch(e){}
  window.gaV05422OpenLinkModal=openLinkModal; window.gaV05422LoadSecurityManager=loadSecurityManager; window.gaV05422SecurityState=stateV05422;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
})();
setInterval(function(){try{var pt=document.getElementById('pageTitle');var active=document.querySelector('.section.active');if((active&&active.id==='securityManager')||(pt&&String(pt.textContent||'').trim()==='securityManager')){if(pt)pt.textContent='Security Manager';document.title='Security Manager - Support Schedules';}}catch(e){}},800);

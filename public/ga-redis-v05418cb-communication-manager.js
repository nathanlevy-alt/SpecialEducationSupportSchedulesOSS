/* Support Schedules 0.54.18ba Communication Manager: school-scoped, edit-safe loader. Adds App Push Notification column. */
(function(){
  'use strict';
  if(window.__GA_V05418BU_COMMUNICATION_MANAGER__) return;
  window.__GA_V05418BU_COMMUNICATION_MANAGER__ = true;
  function by(id){return document.getElementById(id);} 
  function clean(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function norm(v){return clean(v).toLowerCase().replace(/\s+/g,' ');} 
  function selectedSchoolId(){
    var sel=by('campusSelector');
    if(sel && clean(sel.value)) return clean(sel.value);
    try{var p=(typeof window.selectedSchoolPayloadV686m20==='function'?window.selectedSchoolPayloadV686m20():null)||{};var v=clean(p.school||p.schoolId||p.campusId||p.selectedCampusId||'');if(v)return v;}catch(e){}
    try{var p2=(typeof window.selectedSchoolPayloadV683==='function'?window.selectedSchoolPayloadV683():null)||{};var v2=clean(p2.school||p2.schoolId||p2.campusId||p2.selectedCampusId||'');if(v2)return v2;}catch(e2){}
    try{var ctx=window.campusContextV5253||{};return clean(ctx.selectedCampusId||(ctx.currentCampus&&ctx.currentCampus.campusId)||ctx.schoolId||ctx.campusId||'');}catch(e3){}
    return '';
  }
  function api(path,params){params=params||{};if(!params.school)params.school=selectedSchoolId();params._t=Date.now();return path+'?'+new URLSearchParams(params).toString();}
  function fetchJson(url,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(url,opts).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||j.message||('HTTP '+r.status));return j;});});}
  function setMsg(msg,type){try{if(typeof window.setMsg==='function')return window.setMsg(msg,type||'warn');}catch(e){}var el=by('globalMsg');if(el){el.className='msg '+(type||'');el.style.display=msg?'block':'none';el.textContent=msg||'';}}
  function transientMsg(msg,type,ms){setMsg(msg,type||'ok');var text=String(msg||'');setTimeout(function(){try{var el=by('globalMsg');if(el&&String(el.textContent||'')===text){el.textContent='';el.style.display='none';}}catch(e){}},ms||3200);}
  function activePage(){try{if(typeof window.activeSectionIdV51229==='function')return window.activeSectionIdV51229()||'';}catch(e){}var s=document.querySelector('.section.active');return s?s.id:'';}
  var commLoadSeq=0, commLastSchool='', commDirtySince=0, commLastRenderAt=0, lastLoadedStaffV05418R=[];
  function hasDirtyEmailEdit(){return !!document.querySelector('.emailInputV05418T[data-dirty="1"], .phoneInputV05418PH[data-dirty="1"]');}
  function emailEditActive(){var el=document.activeElement;return !!(el&&el.classList&&(el.classList.contains('emailInputV05418T')||el.classList.contains('phoneInputV05418PH')));}
  function canRefresh(force){if(force)return true;if(emailEditActive()||hasDirtyEmailEdit())return false;if(Date.now()-commDirtySince<10000)return false;return true;}
  function installStyles(){
    if(by('gaRedisV05418RCommStyles'))return;
    var css=''+
      '.communicationManagerGridV05418R{display:grid;grid-template-columns:1fr;gap:12px}.communicationManagerCardV05418R{border:1px solid #dbe3ef;border-radius:14px;padding:12px;background:#fff}.v05418RTable{width:100%;border-collapse:collapse}.v05418RTable th,.v05418RTable td{border-bottom:1px solid #e5edf7;padding:7px;text-align:left;vertical-align:middle}.v05418RTable th{font-size:12px;color:#64748b;background:#f8fafc}.v05418RStatus{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:900;white-space:nowrap}.v05418RStatus.ok{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0}.v05418RStatus.bad{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}.v05418RStatus.neutral{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}.linkBtnV05418R{border:0;background:transparent;color:#b91c1c;font-size:11px;font-weight:700;text-decoration:underline;cursor:pointer;padding:2px 0;margin-left:4px}.linkBtnV05418R:disabled{opacity:.5;cursor:wait}.portalLinkRowV05418R,.emailEditRowV05418T{display:grid;grid-template-columns:minmax(180px,1fr) 58px;gap:6px;align-items:center}.portalLinkInputV05418R,.emailInputV05418T{width:100%;min-width:0;height:32px;border:1px solid #dbe3ef;border-radius:10px;padding:0 8px;font-size:12px;color:#475569;background:#f8fafc}.emailInputV05418T[data-dirty="1"]{background:#fff7ed!important;border-color:#fdba74!important}.copyPortalBtnV05418R,.saveEmailBtnV05418T{height:32px!important;min-height:32px!important;width:58px!important;min-width:58px!important;padding:0 8px!important;text-align:center}.saveEmailBtnV05418T[data-saving="1"]{opacity:.68;cursor:wait!important}.communicationManagerCardV05418R[data-refreshing="1"]{position:relative}.communicationManagerCardV05418R[data-refreshing="1"]:after{content:"Updating...";position:absolute;right:12px;top:12px;font-size:11px;color:#64748b}.commShareBtnV05418R{background:#dcfce7!important;border-color:#86efac!important;color:#166534!important;font-weight:900!important;border-radius:12px!important}.commAnnounceBtnV05418R{background:#dbeafe!important;border-color:#93c5fd!important;color:#1d4ed8!important;font-weight:900!important;border-radius:12px!important}.commLogActionsV05418R{display:flex;gap:8px;align-items:center;margin-bottom:8px}.logNoteV05418R{font-size:12px;color:#64748b}.commManagerMetaV05418R{font-size:12px;color:#64748b;margin:4px 0 10px}body.darkModeV034 .communicationManagerCardV05418R{background:#172033!important;border-color:#334155!important;color:#f8fafc!important}body.darkModeV034 .portalLinkInputV05418R{background:#0f172a!important;color:#cbd5e1!important;border-color:#475569!important}.v05418RModalBackdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:none;align-items:center;justify-content:center;z-index:200;padding:16px}.v05418RModalBackdrop.open{display:flex}.v05418RModalPanel{width:min(560px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 20px 50px rgba(15,23,42,.25)}.v05418RModalHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.announceSectionV05418R{margin-bottom:16px}.announceTemplateRowV05418R{display:flex;gap:8px}.announceTemplateRowV05418R select{flex:1}.announceSectionV05418R:last-of-type{margin-bottom:0}.announceChannelsV05418R{display:flex;gap:10px;flex-wrap:wrap}.announceChannelChipV05418R{display:flex;align-items:center;gap:7px;border:1px solid #dbe3ef;background:#f8fafc;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:700;color:#334155;cursor:pointer;user-select:none}.announceChannelChipV05418R input{width:auto;margin:0;accent-color:#2563eb}.announceLabelV05418R{display:block;font-size:12px;font-weight:800;color:#334155;margin:0 0 6px}.announceInputV05418R{width:100%;height:38px;border:1px solid #dbe3ef;border-radius:10px;padding:0 10px;font-size:13px;box-sizing:border-box}.announceTextareaV05418R{width:100%;min-height:100px;border:1px solid #dbe3ef;border-radius:10px;padding:8px 10px;font-size:13px;box-sizing:border-box;font-family:inherit;resize:vertical}.announceStaffHeadV05418R{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.announceStaffListV05418R{max-height:220px;overflow:auto;border:1px solid #e5edf7;border-radius:10px}.announceStaffRowV05418R{display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:10px;padding:9px 12px;font-size:13px;border-bottom:1px solid #f1f5f9;cursor:pointer}.announceStaffRowV05418R:last-child{border-bottom:0}.announceStaffRowV05418R:hover{background:#f8fafc}.announceStaffRowV05418R input{width:auto;margin:0;accent-color:#2563eb}.announceStaffNameV05418R{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.announceStaffBadgesV05418R{display:flex;gap:6px;justify-self:end}.announceStaffBadgesV05418R:empty{display:none}.modalActions{display:flex;justify-content:flex-end;gap:8px}body.darkModeV034 .v05418RModalPanel{background:#172033!important;color:#f8fafc!important}body.darkModeV034 .announceInputV05418R,body.darkModeV034 .announceTextareaV05418R,body.darkModeV034 .announceStaffListV05418R{background:#0f172a!important;color:#cbd5e1!important;border-color:#475569!important}body.darkModeV034 .announceChannelChipV05418R{background:#0f172a!important;color:#cbd5e1!important;border-color:#475569!important}body.darkModeV034 .announceStaffRowV05418R:hover{background:#1e293b!important}.commManagerMetaV05418R.err{color:#b91c1c;font-weight:700}.announceSuccessV05418R{text-align:center;padding:20px 10px 6px}.announceSuccessIconV05418R{width:52px;height:52px;border-radius:50%;background:#ecfdf5;color:#166534;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;margin:0 auto}body.darkModeV034 .announceSuccessIconV05418R{background:#064e3b!important;color:#86efac!important}';
    var st=document.createElement('style');st.id='gaRedisV05418RCommStyles';st.textContent=css;document.head.appendChild(st);
  }
  function ensureSection(){
    var sec=by('communicationManager');
    if(!sec){var main=document.querySelector('main')||document.body;sec=document.createElement('section');sec.id='communicationManager';sec.className='section';main.appendChild(sec);} 
    var nav=document.querySelector('.nav'); if(nav && !document.querySelector('[data-nav="communicationManager"]')){var ref=document.querySelector('[data-nav="dataManager"]')||document.querySelector('[data-nav="staff"]'); var btn=document.createElement('button');btn.setAttribute('data-nav','communicationManager');btn.textContent='Communication Manager'; if(ref&&ref.parentNode)ref.parentNode.insertBefore(btn,ref.nextSibling); else nav.appendChild(btn);} 
    if(!by('communicationManagerBodyV05418R')){
      sec.innerHTML='<div class="card"><div class="toolbar" style="justify-content:space-between;align-items:center"><div></div><div style="display:flex;gap:8px"><button class="btn commAnnounceBtnV05418R" data-v05418r-action="open-announce">Send Announcement</button><button class="btn commShareBtnV05418R" data-v05418r-action="open-share-schedules">Relaunch Share Schedules</button></div></div><div id="communicationManagerBodyV05418R" class="communicationManagerGridV05418R" style="margin-top:12px"></div></div>';
    }
    ensureAnnounceModalShell();
    return sec;
  }
  // FEATURE: standalone broadcast, separate from Share Schedules -- for reminders, updates,
  // and anything else that isn't tied to publishing a schedule. Reuses the same staff list
  // already loaded for the main table (state.rows) rather than fetching it again.
  function ensureAnnounceModalShell(){
    if(by('announceModalV05418R'))return;
    var m=document.createElement('div');
    m.id='announceModalV05418R';
    m.className='v05418RModalBackdrop';
    (document.querySelector('main')||document.body).appendChild(m);
  }
  // Always rebuilds the compose form fresh -- important because a successful send replaces
  // this panel's content with a success screen (see showAnnounceSuccess), and without
  // rebuilding here, reopening the modal would show that stale success screen instead of a
  // usable form for the next announcement.
  function renderAnnounceForm(){
    var m=by('announceModalV05418R');
    if(!m)return;
    m.innerHTML='<div class="v05418RModalPanel">'
      + '<div class="v05418RModalHead"><h2 style="margin:0;font-size:16px">Send Announcement</h2><button class="btn" data-v05418r-action="close-announce">Close</button></div>'
      + '<p class="muted" style="margin:6px 0 16px">Send a one-off message to selected staff -- independent of any schedule. Choose how to send below; each recipient\'s email and app status is shown so you can see who\'s actually reachable by which method.</p>'
      + '<div class="announceSectionV05418R"><label class="announceLabelV05418R">Template</label><div class="announceTemplateRowV05418R"><select id="announceTemplateSelectV05418R" class="announceInputV05418R"><option value="">Start from scratch</option></select><button type="button" class="btn small" data-v05418r-action="announce-save-template">Save as template</button></div></div>'
      + '<div class="announceSectionV05418R"><label class="announceLabelV05418R">Subject</label><input type="text" id="announceSubjectV05418R" class="announceInputV05418R" placeholder="e.g. Reminder: early dismissal Friday"></div>'
      + '<div class="announceSectionV05418R"><label class="announceLabelV05418R">Message</label><textarea id="announceMessageV05418R" class="announceTextareaV05418R" placeholder="Write your message..."></textarea></div>'
      + '<div class="announceSectionV05418R">'
      + '<div class="announceStaffHeadV05418R"><label class="announceLabelV05418R" style="margin:0">Recipients</label><div><button type="button" class="linkBtnV05418R" data-v05418r-action="announce-select-all">Select all</button><button type="button" class="linkBtnV05418R" data-v05418r-action="announce-select-none">Select none</button></div></div>'
      + '<div id="announceStaffListV05418R" class="announceStaffListV05418R"></div>'
      + '</div>'
      + '<div id="announceMsgV05418R" class="commManagerMetaV05418R" style="margin-top:4px"></div>'
      + '<div class="modalActions" style="margin-top:6px"><button class="btn" data-v05418r-action="close-announce">Cancel</button><button class="btn primary" data-v05418r-action="send-announce-push">Send Push Notification</button><button class="btn primary" data-v05418r-action="send-announce-email">Send Email</button><button class="btn shareSendPreferredV018" data-v05418r-action="send-announce-preferred">Send via Preferred Communication</button></div>'
      + '</div>';
    loadAnnounceTemplates();
  }
  var announceTemplatesCache=[];
  function loadAnnounceTemplates(){
    var sel=by('announceTemplateSelectV05418R');
    if(!sel)return;
    fetchJson('/api/v05418y/templates'+(selectedSchoolId()?('?school='+encodeURIComponent(selectedSchoolId())):'')).then(function(j){
      announceTemplatesCache=j.templates||[];
      sel.innerHTML='<option value="">Start from scratch</option>'+announceTemplatesCache.map(function(t){return '<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>';}).join('');
    }).catch(function(){});
  }
  function applyAnnounceTemplate(id){
    var t=announceTemplatesCache.filter(function(x){return x.id===id;})[0];
    if(!t)return;
    var subjEl=by('announceSubjectV05418R'), msgEl=by('announceMessageV05418R');
    if(subjEl)subjEl.value=t.subject||'';
    if(msgEl)msgEl.value=t.message||'';
  }
  function saveAnnounceTemplate(){
    var subject=(by('announceSubjectV05418R')||{}).value||'';
    var message=(by('announceMessageV05418R')||{}).value||'';
    if(!message){window.alert('Write a message before saving it as a template.');return;}
    var name=window.prompt('Name this template (e.g. "Early dismissal"):','');
    if(!name)return;
    fetchJson('/api/v05418y/templates/save',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),name:name,subject:subject,message:message})}).then(function(){
      loadAnnounceTemplates();
    }).catch(function(e){window.alert('Could not save template: '+e.message);});
  }
  function openAnnounceModal(){
    ensureAnnounceModalShell();
    renderAnnounceForm();
    var list=by('announceStaffListV05418R');
    var rows=lastLoadedStaffV05418R;
    if(!rows.length){ list.innerHTML='<p class="muted" style="padding:8px">Load Communication Manager first to see staff.</p>'; }
    else {
      list.innerHTML=rows.map(function(r){
        var emailBadge=r.email?'<span class="v05418RStatus ok">Email</span>':'<span class="v05418RStatus neutral">No email</span>';
        var appBadge=r.appPaired?'<span class="v05418RStatus ok">App</span>':'<span class="v05418RStatus neutral">Not paired</span>';
        return '<label class="announceStaffRowV05418R"><input type="checkbox" class="announceStaffCheckV05418R" value="'+esc(r.staffName)+'" checked><span class="announceStaffNameV05418R">'+esc(r.staffName)+'</span><span class="announceStaffBadgesV05418R">'+emailBadge+appBadge+'</span></label>';
      }).join('');
    }
    by('announceMsgV05418R').textContent='';
    by('announceModalV05418R').classList.add('open');
  }
  function closeAnnounceModal(){ var m=by('announceModalV05418R'); if(m)m.classList.remove('open'); }
  function sendAnnouncement(mode){
    var subject=clean((by('announceSubjectV05418R')||{}).value);
    var message=clean((by('announceMessageV05418R')||{}).value);
    var staffNames=Array.prototype.slice.call(document.querySelectorAll('.announceStaffCheckV05418R:checked')).map(function(cb){return cb.value;});
    var msgEl=by('announceMsgV05418R');
    msgEl.className='commManagerMetaV05418R';
    if(!staffNames.length){msgEl.textContent='Select at least one recipient.';return;}
    if(!message){msgEl.textContent='Enter a message.';return;}
    var body={school:selectedSchoolId(),staffNames:staffNames,subject:subject,message:message};
    if(mode==='preferred'){body.mode='preferred';}
    else if(mode==='push'){body.sendEmail=false;body.sendPush=true;}
    else{body.sendEmail=true;body.sendPush=false;}
    var sendBtns=document.querySelectorAll('#announceModalV05418R [data-v05418r-action^="send-announce"]');
    sendBtns.forEach(function(b){b.disabled=true;});
    var clickedBtn=document.querySelector('#announceModalV05418R [data-v05418r-action="send-announce-'+mode+'"]');
    var clickedBtnOrigText=clickedBtn?clickedBtn.textContent:'';
    if(clickedBtn)clickedBtn.textContent='Sending...';
    msgEl.textContent='Sending...';
    fetchJson('/api/v05418y/broadcast',{method:'POST',body:JSON.stringify(body)}).then(function(j){
      var parts=[];
      if(j.results && j.results.email)parts.push('Email: '+j.results.email.sent+' sent'+(j.results.email.skipped?', '+j.results.email.skipped+' no email on file':'')+(j.results.email.failed?', '+j.results.email.failed+' failed':''));
      if(j.results && j.results.push){ if(!j.results.push.configured){parts.push('Push not configured yet.');} else {parts.push('Push: '+j.results.push.sent+' sent'+(j.results.push.notPaired?', '+j.results.push.notPaired+' not paired':'')+(j.results.push.failed?', '+j.results.push.failed+' failed':''));} }
      showAnnounceSuccess(parts.join(' · ')||'Sent.');
    }).catch(function(e){
      sendBtns.forEach(function(b){b.disabled=false;});
      if(clickedBtn)clickedBtn.textContent=clickedBtnOrigText;
      msgEl.className='commManagerMetaV05418R err';
      msgEl.textContent='Could not send: '+e.message;
    });
  }
  // Makes it unmistakable the send finished and the modal is done, rather than leaving the
  // compose form sitting there looking untouched with just a small status line -- easy to
  // read as "did that actually go through?" and leave the modal open by mistake.
  function showAnnounceSuccess(summary){
    var panel=document.querySelector('#announceModalV05418R .v05418RModalPanel');
    if(!panel)return;
    panel.innerHTML='<div class="announceSuccessV05418R">'
      + '<div class="announceSuccessIconV05418R">\u2713</div>'
      + '<h2 style="margin:10px 0 4px;font-size:17px">Announcement sent</h2>'
      + '<p class="muted" style="margin:0 0 18px">'+esc(summary)+'</p>'
      + '<button type="button" class="btn primary" data-v05418r-action="close-announce" style="min-width:140px">Close</button>'
      + '</div>';
  }
  function fmt(v){
    var raw=clean(v); if(!raw)return '';
    if(/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\s+\d{1,2}:\d{2}\s*(AM|PM)$/i.test(raw))return raw;
    if(/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\s+\d{1,2}:\d{2}:\d{2}\s*(AM|PM)$/i.test(raw))return raw.replace(/:(\d{2})\s*(AM|PM)$/i,' $2');
    var n=Number(raw), d=null;
    if(isFinite(n)&&n>0)d=new Date(n<100000000000?n*1000:n); else {var p=new Date(raw); if(!isNaN(p.getTime()))d=p;}
    if(!d)return raw;
    try{return new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'2-digit',day:'2-digit',year:'2-digit',hour:'numeric',minute:'2-digit',hour12:true}).format(d).replace(/\//g,'-');}catch(e){return raw;}
  }
  function statusDisplay(row,keys){row=row||{};for(var i=0;i<keys.length;i++){var k=keys[i];if(row[k+'Display'])return row[k+'Display'];}for(var j=0;j<keys.length;j++){if(row[keys[j]])return fmt(row[keys[j]]);}return '';}
  function buildStatusMaps(statusRows, currentHash, currentPublishedAt, currentPublishInstance){
    var byStaff={}, byEmail={}, oldOpenedByStaff={}, oldOpenedByEmail={};
    (statusRows||[]).forEach(function(s){
      var staff=norm(s.staff||''), email=clean(s.email||'').toLowerCase();
      var isCurrent=!!(currentHash && clean(s.scheduleHash)===clean(currentHash));
      if(!isCurrent && currentPublishedAt && clean(s.publishedAt)===clean(currentPublishedAt)) isCurrent=true;
      if(!isCurrent && currentPublishInstance && clean(s.publishInstance)===clean(currentPublishInstance)) isCurrent=true;
      if(isCurrent){
        if(staff && (!byStaff[staff] || clean(s.updatedAt||s.sentAt).localeCompare(clean(byStaff[staff].updatedAt||byStaff[staff].sentAt))>0)) byStaff[staff]=s;
        if(email && (!byEmail[email] || clean(s.updatedAt||s.sentAt).localeCompare(clean(byEmail[email].updatedAt||byEmail[email].sentAt))>0)) byEmail[email]=s;
      }
      if(s.lastOpenedAt||s.firstOpenedAt){
        if(staff && (!oldOpenedByStaff[staff] || clean(s.lastOpenedAt||s.firstOpenedAt).localeCompare(clean(oldOpenedByStaff[staff].lastOpenedAt||oldOpenedByStaff[staff].firstOpenedAt))>0)) oldOpenedByStaff[staff]=s;
        if(email && (!oldOpenedByEmail[email] || clean(s.lastOpenedAt||s.firstOpenedAt).localeCompare(clean(oldOpenedByEmail[email].lastOpenedAt||oldOpenedByEmail[email].firstOpenedAt))>0)) oldOpenedByEmail[email]=s;
      }
    });
    return {byStaff:byStaff,byEmail:byEmail,oldOpenedByStaff:oldOpenedByStaff,oldOpenedByEmail:oldOpenedByEmail};
  }
  function emailStatusHtml(staffName,email,maps){
    var staffKey=norm(staffName), emails=clean(email).toLowerCase().split(/[;,\s]+/).filter(Boolean);
    var cur=maps.byStaff[staffKey]||null; if(!cur){for(var i=0;i<emails.length;i++){if(maps.byEmail[emails[i]]){cur=maps.byEmail[emails[i]];break;}}}
    if(cur){
      var opened=statusDisplay(cur,['lastOpenedAt','firstOpenedAt']);
      if(opened) return '<span class="v05418RStatus ok">Opened '+esc(opened)+'</span>';
      var failed=statusDisplay(cur,['failedAt']);
      if(failed) return '<span class="v05418RStatus bad">Failed '+esc(failed)+'</span>';
      if(cur.deliveredAt) return '<span class="v05418RStatus bad">Delivered, not opened</span>';
      return '<span class="v05418RStatus bad">Sent, not opened</span>';
    }
    var old=maps.oldOpenedByStaff[staffKey]||null; if(!old){for(var j=0;j<emails.length;j++){if(maps.oldOpenedByEmail[emails[j]]){old=maps.oldOpenedByEmail[emails[j]];break;}}}
    if(old) return '<span class="v05418RStatus neutral">Last opened '+esc(statusDisplay(old,['lastOpenedAt','firstOpenedAt']))+'</span>';
    return '<span class="v05418RStatus neutral">No current email sent</span>';
  }
  function portalStatusHtml(r){
    if(r && r.viewedAfterPublish) return '<span class="v05418RStatus ok">Viewed current schedule'+(r.lastViewed?' · '+esc(r.lastViewed):'')+'</span>';
    return '<span class="v05418RStatus bad">Not viewed current schedule'+(r&&r.lastViewed?' · '+esc(r.lastViewed):'')+'</span>';
  }
  // FEATURE: App Push Notification column, added right after Portal Status per direction.
  // Reuses the same v05418RStatus ok/bad pill styling already used for Email Status and
  // Portal Status so it's visually consistent with the rest of this table, not a new style.
  function appStatusHtml(device,staffNameForRevoke){
    if(device) return '<span class="v05418RStatus ok">Paired'+(device.platform?' · '+esc(device.platform):'')+(device.lastSeenAt?' · seen '+esc(fmt(device.lastSeenAt)):'')+'</span> <button type="button" class="linkBtnV05418R" data-v05418r-action="revoke-device" data-staff="'+esc(staffNameForRevoke||'')+'">Unpair</button>';
    return '<span class="v05418RStatus neutral">Not paired</span>';
  }
  function renderLog(rows){
    rows=rows||[];
    return '<div class="communicationManagerCardV05418R"><h3>Communication Log</h3><div class="commLogActionsV05418R"><button class="btn danger" data-v05418r-action="clear-comm-log">Clear Communication Log</button><span class="logNoteV05418R">Showing latest 75 records. Stored log is capped at 250 records.</span></div>'+(rows.length?'<table class="v05418RTable"><thead><tr><th>When</th><th>Mode/Action</th><th>Staff</th><th>Status</th><th>Details</th></tr></thead><tbody>'+rows.map(function(r){
      var statusText=esc(r.status||'');
      if(r.tracked && String(r.status||'').toLowerCase()==='sent'){
        statusText = r.opened ? '<span class="v05418RStatus ok">Opened'+(r.openedAt?' \u00b7 '+esc(r.openedAt):'')+'</span>' : '<span class="v05418RStatus neutral">Sent \u00b7 not opened yet</span>';
      }
      return '<tr><td>'+esc(r.timestamp||'')+'</td><td>'+esc(r.mode||r.action||'')+'</td><td>'+esc(r.staff||r.target||'')+'</td><td>'+statusText+'</td><td>'+esc(r.message||r.detail||r.recipient||'')+'</td></tr>';
    }).join('')+'</tbody></table>':'<p class="muted">No communication entries yet.</p>')+'</div>';
  }
  function loadCommunicationManagerV05418R(force){
    installStyles(); ensureSection();
    var box=by('communicationManagerBodyV05418R'); if(!box)return;
    if(!canRefresh(!!force))return;
    var reqSchool=selectedSchoolId(); if(!reqSchool){box.innerHTML='<div class="communicationManagerCardV05418R muted">Choose a school first.</div>';return;}
    var seq=++commLoadSeq;
    if(commLastSchool!==reqSchool){commLastSchool=reqSchool;box.innerHTML='<div class="communicationManagerCardV05418R muted">Loading communication details...</div>';}
    if(!box.querySelector('.communicationManagerCardV05418R')) box.innerHTML='<div class="communicationManagerCardV05418R muted">Loading communication details...</div>'; else { var first=box.querySelector('.communicationManagerCardV05418R'); if(first) first.setAttribute('data-refreshing','1'); }
    Promise.all([
      fetchJson(api('/api/v027/staff-portal/access-summary',{school:reqSchool})).catch(function(e){return {error:e.message,staff:[]};}),
      fetchJson(api('/api/communication/candidates-v018',{school:reqSchool})).catch(function(e){return {error:e.message,all:[],hash:'',publishedAt:''};}),
      fetchJson(api('/api/communication/brevo-staff-email-status-v05418v',{school:reqSchool,limit:'500'})).catch(function(e){return {error:e.message,rows:[]};}),
      fetchJson(api('/api/v027/communication/log',{school:reqSchool,limit:'75'})).catch(function(e){return {error:e.message,rows:[]};}),
      fetchJson(api('/api/v05418y/app-devices',{school:reqSchool})).catch(function(e){return {error:e.message,rows:[]};})
    ]).then(function(arr){
      if(seq!==commLoadSeq || reqSchool!==selectedSchoolId())return;
      if(!canRefresh(!!force))return;
      var access=arr[0]||{}, cand=arr[1]||{}, emailStatus=arr[2]||{}, log=arr[3]||{}, devices=arr[4]||{};
      var staff=(access.staff||[]).slice().sort(function(a,b){return clean(a.staff||a.name).localeCompare(clean(b.staff||b.name));});
      var candidates=cand.all||[], statusRows=emailStatus.rows||[], rows=log.rows||[];
      var candidateByStaff={}; candidates.forEach(function(c){candidateByStaff[norm(c.staff||c.name)]=c;});
      var deviceByStaff={}; (devices.rows||[]).forEach(function(d){deviceByStaff[norm(d.staffName)]=d;});
      var maps=buildStatusMaps(statusRows, cand.hash||emailStatus.currentScheduleHash||'', cand.publishedAt||emailStatus.currentPublishedAt||'', cand.publishInstance||emailStatus.currentPublishInstance||'');
      var tableRows=staff.map(function(r){
        var staffName=clean(r.staff||r.name||''); if(!staffName)return '';
        var c=candidateByStaff[norm(staffName)]||{};
        var email=r.email||c.notificationEmail||c.email||'';
        var link=c.staffPortalLink||r.staffPortalLink||'';
        var device=deviceByStaff[norm(staffName)]||null;
        return '<tr><td><b>'+esc(staffName)+'</b></td><td><div class="emailEditRowV05418T"><input class="emailInputV05418T" data-staff="'+esc(staffName)+'" data-row="'+esc(r.rowIndex||'')+'" value="'+esc(email||'')+'"><button class="btn small saveEmailBtnV05418T" data-v05418r-action="save-email" data-staff="'+esc(staffName)+'" data-row="'+esc(r.rowIndex||'')+'">Save</button></div></td><td>'+emailStatusHtml(staffName,email,maps)+'</td><td><button class="btn small copyPortalBtnV05418R" data-v05418r-action="copy-portal-link" data-link="'+esc(link)+'">Copy Link</button></td><td>'+portalStatusHtml(r)+'</td><td>'+appStatusHtml(device,staffName)+'</td><td><div class="emailEditRowV05418T"><input class="phoneInputV05418PH" data-staff="'+esc(staffName)+'" data-row="'+esc(r.rowIndex||'')+'" value="'+esc(r.phone||'')+'" placeholder="(555) 555-5555"><button class="btn small savePhoneBtnV05418PH" data-v05418r-action="save-phone" data-staff="'+esc(staffName)+'" data-row="'+esc(r.rowIndex||'')+'">Save</button></div></td></tr>';
      }).join('');
      var schoolLabel=clean((by('campusSelector')&&by('campusSelector').options[by('campusSelector').selectedIndex]&&by('campusSelector').options[by('campusSelector').selectedIndex].text)||reqSchool);
      box.innerHTML='<div class="communicationManagerCardV05418R"><h3>Staff Schedule Communication</h3><div class="commManagerMetaV05418R">School: <b>'+esc(schoolLabel)+'</b>. Email status is green only when a staff notification for the current published schedule has been opened. Portal status is green when the staff member has viewed the current published schedule. App Push Notification is green once a staff member has paired a device from their Staff Portal settings. Unsaved email and phone edits are protected from background refresh.</div><table class="v05418RTable"><thead><tr><th>Staff</th><th>Email</th><th>Email Status</th><th>Portal Link</th><th>Portal Status</th><th>App Push Notification</th><th>Phone</th></tr></thead><tbody>'+(tableRows||'<tr><td colspan="7" class="muted">No active staff records found for this school.</td></tr>')+'</tbody></table></div>'+renderLog(rows);
      commLastRenderAt=Date.now();
      lastLoadedStaffV05418R=staff.map(function(r){
        var staffName=clean(r.staff||r.name||''); if(!staffName)return null;
        var c=candidateByStaff[norm(staffName)]||{};
        var email=r.email||c.notificationEmail||c.email||'';
        var device=deviceByStaff[norm(staffName)]||null;
        return {staffName:staffName, email:email, appPaired:!!device};
      }).filter(Boolean);
    }).catch(function(e){if(seq===commLoadSeq)box.innerHTML='<div class="communicationManagerCardV05418R"><div class="err">Could not load Communication Manager: '+esc(e.message||e)+'</div></div>';});
  }
  function openShareSchedules(){var p=by('shareSchedulesPillV686m26')||document.querySelector('.shareSchedulesPillV686m26'); if(p){var m=p.querySelector('[data-redis-v018-action="share-open"],.shareMainV018')||p;m.click();} else setMsg('Share Schedules is not ready yet. Publish a schedule first.','warn');}
  function clearCommunicationLog(){
    function doClear(){fetchJson('/api/v029/communication/log/clear',{method:'POST',body:JSON.stringify({school:selectedSchoolId()})}).then(function(){setMsg('Communication Log cleared.','ok');loadCommunicationManagerV05418R(true);}).catch(function(e){setMsg('Could not clear Communication Log: '+e.message,'err');});}
    if(typeof window.showPortalConfirmV51231==='function'){
      window.showPortalConfirmV51231({title:'Clear Communication Log',message:'Clear the Communication Log for this school?',okText:'Clear',danger:true,onOk:doClear});
    } else if(confirm('Clear the Communication Log for this school?')){
      doClear();
    }
  }
  function revokeDevice(btn){
    var staff=btn.getAttribute('data-staff')||'';
    if(!staff)return;
    function doRevoke(){
      btn.disabled=true;
      fetchJson('/api/v05418y/app-devices/revoke',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),staffName:staff})}).then(function(){
        setMsg('Unpaired '+staff+'\u2019s device(s).','ok');
        loadCommunicationManagerV05418R(true);
      }).catch(function(e){
        btn.disabled=false;
        setMsg('Could not revoke device: '+e.message,'err');
      });
    }
    var msg=staff+' will lose access to the mobile app immediately and need a new pairing code to use it again. Unpair their device(s)?';
    if(typeof window.showPortalConfirmV51231==='function'){
      window.showPortalConfirmV51231({title:'Unpair device',message:msg,okText:'Unpair',danger:true,onOk:doRevoke});
    } else if(confirm(msg)){
      doRevoke();
    }
  }
  function copyText(text,btn){
    text=clean(text); if(!text){setMsg('No portal link available for this staff member.','warn');return;}
    var done=function(){if(btn){var old=btn.textContent;btn.textContent='Copied';setTimeout(function(){btn.textContent=old||'Copy';},900);}else setMsg('Portal link copied.','ok');};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done).catch(function(){fallback();});}else fallback();
    function fallback(){var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){setMsg('Could not copy portal link.','err');}ta.remove();}
  }
  function saveEmail(btn){
    var staff=clean(btn&&btn.getAttribute('data-staff')); var row=clean(btn&&btn.getAttribute('data-row'));
    var input=Array.prototype.slice.call(document.querySelectorAll('.emailInputV05418T')).filter(function(x){return clean(x.getAttribute('data-staff'))===staff;})[0];
    var email=input?clean(input.value):'';
    if(!staff){transientMsg('Could not identify staff member for email save.','err');return;}
    btn.disabled=true; btn.setAttribute('data-saving','1'); btn.setAttribute('aria-busy','true');
    fetchJson('/api/staff/email-v022',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),staffName:staff,rowIndex:row,email:email})}).then(function(j){if(input)input.removeAttribute('data-dirty');transientMsg(j.message||'Email saved.','ok');setTimeout(function(){btn.disabled=false;btn.removeAttribute('data-saving');btn.removeAttribute('aria-busy');loadCommunicationManagerV05418R(true);},350);}).catch(function(e){btn.disabled=false;btn.removeAttribute('data-saving');btn.removeAttribute('aria-busy');transientMsg('Could not save email: '+(e.message||e),'err',4200);});
  }
  function savePhone(btn){
    var staff=clean(btn&&btn.getAttribute('data-staff')); var row=clean(btn&&btn.getAttribute('data-row'));
    var input=Array.prototype.slice.call(document.querySelectorAll('.phoneInputV05418PH')).filter(function(x){return clean(x.getAttribute('data-staff'))===staff;})[0];
    var phone=input?clean(input.value):'';
    if(!staff){transientMsg('Could not identify staff member for phone save.','err');return;}
    btn.disabled=true; btn.setAttribute('data-saving','1'); btn.setAttribute('aria-busy','true');
    fetchJson('/api/staff/phone-v05418ph',{method:'POST',body:JSON.stringify({school:selectedSchoolId(),staffName:staff,rowIndex:row,phone:phone})}).then(function(j){if(input){input.removeAttribute('data-dirty');input.value=j.phone||phone;}transientMsg(j.message||'Phone saved.','ok');setTimeout(function(){btn.disabled=false;btn.removeAttribute('data-saving');btn.removeAttribute('aria-busy');},350);}).catch(function(e){btn.disabled=false;btn.removeAttribute('data-saving');btn.removeAttribute('aria-busy');transientMsg('Could not save phone: '+(e.message||e),'err',4200);});
  }
  try{window.loadCommunicationManagerV05418R=loadCommunicationManagerV05418R;}catch(e){}
  window.addEventListener('supportSchedulesShareCommunicationSentV05418U',function(){setTimeout(function(){loadCommunicationManagerV05418R(true);},180);setTimeout(function(){loadCommunicationManagerV05418R(true);},1400);});
  window.addEventListener('focus',function(){if(activePage()==='communicationManager'&&!hasDirtyEmailEdit())setTimeout(function(){loadCommunicationManagerV05418R(false);},250);});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&activePage()==='communicationManager'&&!hasDirtyEmailEdit())setTimeout(function(){loadCommunicationManagerV05418R(false);},250);});
  setInterval(function(){if(activePage()==='communicationManager'&&!document.hidden&&!hasDirtyEmailEdit()&&Date.now()-commLastRenderAt>55000)loadCommunicationManagerV05418R(false);},30000);
  document.addEventListener('input',function(e){
    var el=e.target;
    if(el&&el.classList&&el.classList.contains('emailInputV05418T')){el.setAttribute('data-dirty','1');commDirtySince=Date.now();}
    if(el&&el.classList&&el.classList.contains('phoneInputV05418PH')){
      if(window.formatPhoneInputV05418PH)window.formatPhoneInputV05418PH(el);
      el.setAttribute('data-dirty','1');commDirtySince=Date.now();
    }
  },true);
  document.addEventListener('change',function(e){
    if(e.target && e.target.id==='announceTemplateSelectV05418R'){applyAnnounceTemplate(e.target.value);}
  });
  document.addEventListener('click',function(e){
    var b=e.target&&e.target.closest&&e.target.closest('[data-v05418r-action],[data-nav]'); if(!b)return;
    var a=b.getAttribute('data-v05418r-action')||'';
    if(a==='open-share-schedules'){e.preventDefault();e.stopImmediatePropagation();openShareSchedules();return false;}
    if(a==='clear-comm-log'){e.preventDefault();e.stopImmediatePropagation();clearCommunicationLog();return false;}
    if(a==='copy-portal-link'){e.preventDefault();e.stopImmediatePropagation();copyText(b.getAttribute('data-link')||'',b);return false;}
    if(a==='save-email'){e.preventDefault();e.stopImmediatePropagation();saveEmail(b);return false;}
    if(a==='save-phone'){e.preventDefault();e.stopImmediatePropagation();savePhone(b);return false;}
    if(a==='revoke-device'){e.preventDefault();e.stopImmediatePropagation();revokeDevice(b);return false;}
    if(a==='open-announce'){e.preventDefault();e.stopImmediatePropagation();openAnnounceModal();return false;}
    if(a==='close-announce'){e.preventDefault();e.stopImmediatePropagation();closeAnnounceModal();return false;}
    if(a==='announce-select-all'){e.preventDefault();e.stopImmediatePropagation();document.querySelectorAll('.announceStaffCheckV05418R').forEach(function(cb){cb.checked=true;});return false;}
    if(a==='announce-select-none'){e.preventDefault();e.stopImmediatePropagation();document.querySelectorAll('.announceStaffCheckV05418R').forEach(function(cb){cb.checked=false;});return false;}
    if(a==='send-announce-push'){e.preventDefault();e.stopImmediatePropagation();sendAnnouncement('push');return false;}
    if(a==='send-announce-email'){e.preventDefault();e.stopImmediatePropagation();sendAnnouncement('email');return false;}
    if(a==='send-announce-preferred'){e.preventDefault();e.stopImmediatePropagation();sendAnnouncement('preferred');return false;}
    if(a==='announce-save-template'){e.preventDefault();e.stopImmediatePropagation();saveAnnounceTemplate();return false;}
    var nav=b.getAttribute('data-nav'); if(nav==='communicationManager'){setTimeout(function(){loadCommunicationManagerV05418R(true);},360);} 
  },true);
  document.addEventListener('change',function(e){if(e.target&&e.target.id==='campusSelector'){commLoadSeq++;commLastSchool='';commDirtySince=0;setTimeout(function(){if(activePage()==='communicationManager')loadCommunicationManagerV05418R(true);},300);}},true);
  function boot(){installStyles();ensureSection();if(activePage()==='communicationManager')loadCommunicationManagerV05418R(true);}
  try{if(typeof window.registerNavigationAfterHookV5_==='function')window.registerNavigationAfterHookV5_(function(page){if(page==='communicationManager')setTimeout(function(){loadCommunicationManagerV05418R(true);},240);},'v05418adCommunicationManager');}catch(e){}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,120);}); else setTimeout(boot,120);
})();

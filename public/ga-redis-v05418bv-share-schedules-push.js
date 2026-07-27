(function(){
  if (window.__gaRedisV05418BQUiPatches) return;
  window.__gaRedisV05418BQUiPatches = true;

  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c; }); }
  function msg(t, kind){ try { if (typeof setMsg === 'function') setMsg(t || '', kind || 'ok'); } catch(e) {} }
  function selectedSchoolId(){
    try { if (typeof selectedSchoolIdV5312 === 'function') { var s = clean(selectedSchoolIdV5312()); if (s) return s; } } catch(e) {}
    try { var ctx = window.campusContextV5253 || campusContextV5253 || {}; var s2 = clean(ctx.selectedCampusId || (ctx.currentCampus && (ctx.currentCampus.campusId || ctx.currentCampus.id)) || ''); if (s2) return s2; } catch(e2) {}
    try { var sel = by('campusSelector'); var s3 = clean(sel && sel.value); if (s3) return s3; } catch(e3) {}
    return '';
  }
  function fetchJson(url, opts){
    opts = opts || {};
    opts.credentials = opts.credentials || 'same-origin';
    if (opts.body && !opts.headers) opts.headers = { 'Content-Type':'application/json' };
    return fetch(url, opts).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) { var err = new Error((j && (j.error || j.message)) || ('HTTP '+r.status)); err.payload = j; throw err; } return j; }); });
  }
  function currentMode(){ var checked = document.querySelector('input[name="redisShareModeV018"]:checked'); return (checked && checked.value === 'changed') ? 'changed' : 'all'; }
  var shareData = null;
  var promptState = null;
  var promptTimer = null;
  var shareEmailStatusRows = [];
  var shareAccessRows = [];
  var shareCurrentHash = '';
  var shareCurrentPublishedAt = '';
  function snoozeKey(hash){ return 'gaSharePillSnoozedV05418S:' + selectedSchoolId() + ':' + clean(hash || ''); }
  function isLocallySnoozed(hash){ try { return !!hash && localStorage.getItem(snoozeKey(hash)) === '1'; } catch(e) { return false; } }
  function rememberLocalSnooze(hash){ try { if (hash) localStorage.setItem(snoozeKey(hash), '1'); } catch(e) {} }

  function installStyles(){
    if (by('gaRedisV018Styles')) return;
    var st = document.createElement('style'); st.id = 'gaRedisV018Styles';
    st.textContent = ''
      + '.topActions .shareSchedulesPillV686m26{display:none;align-items:center;gap:6px;border:1px solid #86efac!important;background:#dcfce7!important;color:#166534!important;border-radius:9px!important;padding:7px 10px!important;min-height:auto!important;font-size:12px!important;font-weight:700!important;line-height:normal!important;box-shadow:0 3px 10px rgba(22,101,52,.14)!important;white-space:nowrap;cursor:pointer;position:relative;z-index:12}'
      + '.topActions .shareSchedulesPillV686m26.active{display:inline-flex!important}'
      + '.topActions .shareSchedulesPillV686m26 .shareMainV018{cursor:pointer!important;display:inline-flex;align-items:center;gap:5px}'
      + '.topActions .shareSchedulesPillV686m26 .shareX{border:0!important;background:transparent!important;color:#166534!important;font-size:13px!important;font-weight:900!important;cursor:pointer;border-radius:999px!important;width:18px!important;height:18px!important;padding:0!important;box-shadow:none!important;line-height:1}'
      + '#redisShareSchedulesModalV018{display:none;position:fixed;inset:0;background:rgba(15,23,42,.42);z-index:99999;align-items:center;justify-content:center;padding:18px}'
      + '#redisShareSchedulesModalV018.active{display:flex!important}'
      + '#redisShareSchedulesModalV018 .sharePanelV018{width:min(980px,96vw);max-height:92vh;overflow:auto;background:white;border-radius:20px;box-shadow:0 24px 60px rgba(15,23,42,.26);border:1px solid #e5e7eb;padding:16px}'
      + '.shareHeadV018{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #e5e7eb;padding-bottom:10px;margin-bottom:12px}'
      + '.shareHeadV018 h2{margin:0;font-size:18px}.shareHeadV018 .xBtnV018{border:0;background:#f8fafc;border-radius:999px;width:30px;height:30px;cursor:pointer;font-weight:900}'
      + '.shareModeGridV018{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.shareModeCardV018{border:1px solid #e5e7eb;border-radius:14px;padding:10px;background:#f8fafc;cursor:pointer}.shareModeCardV018.active{border-color:#2563eb;background:#eff6ff}'
      + '.shareStaffListV018{border:1px solid #e5e7eb;border-radius:14px;max-height:42vh;overflow:auto;margin-top:8px}.shareStaffRowV018{display:grid;grid-template-columns:28px 1.05fr 1.25fr;gap:10px;align-items:start;padding:10px 12px;border-bottom:1px solid #f1f5f9}.shareStaffRowV018:last-child{border-bottom:0}.shareStaffRowV018.disabled{opacity:.62;background:#f8fafc}.shareBadgeV018{display:inline-flex;align-items:center;border-radius:999px;font-size:11px;padding:2px 7px;font-weight:800;margin-left:6px}.shareBadgeChangedV018{background:#fef3c7;color:#92400e}.shareBadgeAllV018{background:#dcfce7;color:#166534}.shareSmallV018{font-size:12px;color:#64748b}.shareSummaryV018{font-size:12px;color:#334155;white-space:pre-wrap}.shareModeNoteV018{font-size:12px;color:#475569;line-height:1.4}.shareStatusV018{font-size:12px;color:#475569;margin-top:8px;white-space:pre-wrap}.shareToolbarV018{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px}.shareActionsV018{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:12px;flex-wrap:wrap}.shareSendPreferredV018{background:#dcfce7!important;border-color:#86efac!important;color:#166534!important;font-weight:800!important}.sharePrefTagV018{display:inline-block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:#64748b;margin-left:6px}'
      + '#redisShareProgressModalV05418U{display:none;position:fixed;inset:0;background:rgba(15,23,42,.42);z-index:100000;align-items:center;justify-content:center;padding:18px}#redisShareProgressModalV05418U.active{display:flex!important}.shareProgressPanelV05418U{width:min(520px,94vw);background:#fff;border:1px solid #e5e7eb;border-radius:20px;box-shadow:0 24px 60px rgba(15,23,42,.26);padding:22px;text-align:center}.shareProgressSpinnerV05418U{width:38px;height:38px;border-radius:999px;border:4px solid #dbeafe;border-top-color:#2563eb;margin:4px auto 14px;animation:shareSpinV05418U .9s linear infinite}@keyframes shareSpinV05418U{to{transform:rotate(360deg)}}.shareProgressTitleV05418U{font-size:20px;font-weight:900;margin:0 0 8px;color:#0f172a}.shareProgressTextV05418U{font-size:14px;color:#475569;line-height:1.45;white-space:pre-wrap}.shareProgressActionsV05418U{margin-top:16px;display:flex;justify-content:center;gap:8px}'
      + '#redisShareSchedulesModalV017{display:none!important}';
    document.head.appendChild(st);
  }

  function ensureSharePill(){
    var toolbar = document.querySelector('.topActions') || document.querySelector('.portalTopActions') || document.querySelector('header .toolbar');
    if (!toolbar) return null;
    var pill = by('shareSchedulesPillV686m26') || by('shareSchedulesPillRedisV017') || by('shareSchedulesPillRedisV018');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'shareSchedulesPillV686m26';
      pill.className = 'shareSchedulesPillV686m26';
      var pub = by('publishScheduleBtn') || document.querySelector('[data-action="publish"]') || document.querySelector('[data-action="publish-schedule"]');
      if (pub && pub.parentNode) pub.parentNode.insertBefore(pill, pub.nextSibling); else toolbar.appendChild(pill);
    }
    pill.id = 'shareSchedulesPillV686m26';
    try { pill.classList.remove('btn'); pill.style.display = ''; } catch(e) {}
    pill.innerHTML = '<span class="shareMainV018" data-redis-v018-action="share-open">Share Schedules</span><button type="button" class="shareX" title="Hide until schedule is republished" data-redis-v018-action="share-dismiss">×</button>';
    return pill;
  }

  function refreshSharePill(){
    installStyles();
    var pill = ensureSharePill();
    if (!pill) return;
    var school = selectedSchoolId();
    if (!school) { pill.classList.remove('active'); return; }
    fetchJson('/api/communication/prompt-state-v018?' + new URLSearchParams({ school: school }).toString())
      .then(function(j){
        promptState = j || {};
        var hash = clean(j && (j.publishInstance || j.publishedInstance || j.hash || j.publishedHash || j.scheduleHash));
        var localSnoozed = isLocallySnoozed(hash);
        pill.classList.toggle('active', !!j.show && !localSnoozed);
        if (hash) { pill.setAttribute('data-published-hash', hash); pill.setAttribute('data-publish-instance', hash); }
        var c = j.counts || {};
        pill.title = (!!j.show && !localSnoozed) ? ('Share published schedules. All eligible: ' + (c.allEligible || 0) + '; changed eligible: ' + (c.changedEligible || 0) + '.') : (localSnoozed ? 'Snoozed for this published schedule.' : (j.reason || 'No schedule communication prompt.'));
      })
      .catch(function(){ pill.classList.remove('active'); });
  }

  function ensureModal(){
    var m = by('redisShareSchedulesModalV018');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'redisShareSchedulesModalV018';
    m.innerHTML = '<div class="sharePanelV018">'
      + '<div class="shareHeadV018"><div><h2>Share Schedules</h2><div id="shareIntroV018" class="shareSmallV018">Loading schedule communication options...</div></div><button type="button" class="xBtnV018" data-redis-v018-action="share-close" aria-label="Close">×</button></div>'
      + '<div id="shareModeWrapV018" class="shareModeGridV018">'
      + '<label class="shareModeCardV018" data-share-mode-card-v018="all"><input type="radio" name="redisShareModeV018" value="all" style="width:auto"> <strong>All staff</strong><div class="shareModeNoteV018">Notify each selected active staff member with their current published schedule and Staff Portal link, by email and/or push notification.</div></label>'
      + '<label class="shareModeCardV018" data-share-mode-card-v018="changed"><input type="radio" name="redisShareModeV018" value="changed" style="width:auto"> <strong>Changed staff only</strong><div class="shareModeNoteV018">Notify only selected staff whose schedule changed since the last completed communication, by email and/or push notification.</div></label>'
      + '</div>'
      + '<div class="shareToolbarV018"><div><button type="button" class="btn small" data-redis-v018-action="share-select-all">Select All</button> <button type="button" class="btn small" data-redis-v018-action="share-select-none">Select None</button> <button type="button" class="btn small" data-redis-v018-action="share-select-unopened">Select Not Opened</button> <button type="button" class="btn small" data-redis-v018-action="share-select-unviewed">Select Not Viewed Portal</button></div><div id="shareCountsV018" class="shareSmallV018"></div></div>'
      + '<div id="shareStaffListV018" class="shareStaffListV018"><div class="shareSmallV018" style="padding:12px">Loading staff...</div></div>'
      + '<div class="shareActionsV018"><button type="button" class="btn" data-redis-v018-action="share-close">Cancel</button><button type="button" class="btn primary" data-redis-v018-action="share-send-push">Send Push Notification</button><button type="button" class="btn primary" data-redis-v018-action="share-send">Send Emails</button><button type="button" class="btn shareSendPreferredV018" data-redis-v018-action="share-send-preferred">Send via Preferred Communication</button></div>'
      + '<div id="shareStatusV018" class="shareStatusV018"></div>'
      + '</div>';
    document.body.appendChild(m);
    return m;
  }

  function normNameV018(v){ return clean(v).toLowerCase().replace(/\s+/g,' '); }
  function splitEmailsV018(v){ return clean(v).toLowerCase().split(/[;,\s]+/).filter(function(x){ return /@/.test(x); }); }
  function latestStatusForCandidateV018(c){
    c = c || {}; var staffKey = normNameV018(c.staff || c.name || c.key || ''); var emails = splitEmailsV018(c.notificationEmail || c.email || ''); var best = null;
    (shareEmailStatusRows || []).forEach(function(r){
      var isCurrent = !!(shareCurrentHash && clean(r.scheduleHash || r.hash || '') === shareCurrentHash) || !!(shareCurrentPublishedAt && clean(r.publishedAt || '') === shareCurrentPublishedAt) || !!(shareData && shareData.publishInstance && clean(r.publishInstance || '') === clean(shareData.publishInstance));
      if (!isCurrent) return;
      var staffMatch = staffKey && normNameV018(r.staff || '') === staffKey;
      var emailMatch = emails.indexOf(clean(r.email || '').toLowerCase()) >= 0;
      if (!staffMatch && !emailMatch) return;
      if (!best || clean(r.updatedAt || r.sentAt).localeCompare(clean(best.updatedAt || best.sentAt)) > 0) best = r;
    });
    return best;
  }
  function accessForCandidateV018(c){
    c = c || {}; var staffKey = normNameV018(c.staff || c.name || c.key || ''); var rows = shareAccessRows || [];
    for (var i=0;i<rows.length;i++){ if (normNameV018(rows[i].staff || rows[i].name || '') === staffKey) return rows[i]; }
    return null;
  }
  function hydrateShareStatusFlagsV018(){
    var lists = [((shareData && shareData.all) || []), ((shareData && shareData.changed) || [])];
    lists.forEach(function(list){ list.forEach(function(c){ var st = latestStatusForCandidateV018(c); var ac = accessForCandidateV018(c); c.emailCurrentSent = !!st; c.emailCurrentOpened = !!(st && (st.lastOpenedAt || st.firstOpenedAt)); c.emailCurrentFailed = !!(st && st.failedAt); c.portalViewedCurrent = !!(ac && ac.viewedAfterPublish); }); });
  }
  function selectedPool(){ if (!shareData) return []; return currentMode() === 'changed' ? (shareData.changed || []) : (shareData.all || []); }
  function renderModeCards(){ var mode = currentMode(); document.querySelectorAll('[data-share-mode-card-v018]').forEach(function(card){ card.classList.toggle('active', card.getAttribute('data-share-mode-card-v018') === mode); }); }
  function renderShareList(){
    renderModeCards();
    var list = by('shareStaffListV018'); var counts = by('shareCountsV018'); var intro = by('shareIntroV018'); if (!list) return;
    var pool = selectedPool(); var eligible = pool.filter(function(c){ return !c.skipReason; });
    if (counts && shareData) { var c = shareData.counts || {}; counts.textContent = 'All eligible: ' + (c.allEligible || 0) + ' · Changed eligible: ' + (c.changedEligible || 0) + ' · Showing: ' + eligible.length; }
    if (intro && shareData) intro.textContent = currentMode() === 'changed' ? 'Changed-staff mode compares this published schedule to the last successfully communicated schedule.' : 'All-staff mode notifies each selected staff member with their current published schedule and Staff Portal link, by email and/or push notification.';
    if (!pool.length) { list.innerHTML = '<div class="shareSmallV018" style="padding:12px">No staff are available for this mode.</div>'; return; }
    list.innerHTML = pool.map(function(c){
      c = c || {}; var k = esc(c.key || c.staff || ''); var disabled = c.skipReason ? ' disabled' : ''; var checked = (!c.skipReason && ((currentMode()==='changed') ? c.selectedChanged !== false : c.selectedAll !== false)) ? ' checked' : ''; var summary = currentMode()==='changed' && c.changeSummary && c.changeSummary.length ? c.changeSummary.slice(0,4).join('\n') : (c.schedulePreview || 'Current published schedule will be included.');
      var showBadges = Number((shareData && shareData.scheduleVersion) || 0) >= 2;
      var changeBadge = showBadges ? (c.changed?'<span class="shareBadgeV018 shareBadgeChangedV018">Changed</span>':'<span class="shareBadgeV018 shareBadgeAllV018">No change</span>') : '';
      var followBadges = (showBadges && !c.skipReason ? ((c.emailCurrentSent ? (c.emailCurrentOpened ? '<span class="shareBadgeV018 shareBadgeAllV018">Email opened</span>' : '<span class="shareBadgeV018 shareBadgeChangedV018">Not opened</span>') : '') + (c.portalViewedCurrent ? '<span class="shareBadgeV018 shareBadgeAllV018">Portal viewed</span>' : '<span class="shareBadgeV018 shareBadgeChangedV018">Portal not viewed</span>')) : '');
      // Subtle communication-preference tag -- plain, quiet text rather than a colored badge,
      // since this is informational context rather than a status worth calling attention to.
      var prefLabel = c.preference === 'both' ? 'Email + Push' : c.preference === 'push' ? 'Push' : 'Email';
      var prefTag = '<span class="sharePrefTagV018">' + prefLabel + '</span>';
      // App paired now shown as plain text alongside email, matching how the email address
      // itself is displayed -- not a colored pill, per direction.
      var contactLine = [c.notificationEmail || c.email || '', c.hasPushDevice ? 'Paired' : ''].filter(Boolean).join(' · ') || c.skipReason || '';
      return '<label class="shareStaffRowV018'+disabled+'"><input type="checkbox" class="shareCheckV018" value="'+k+'" '+checked+(c.skipReason?' disabled':'')+' style="width:auto"><div><strong>'+esc(c.staff || '')+'</strong>'+prefTag+changeBadge+followBadges+'<div class="shareSmallV018">'+esc(contactLine)+'</div></div><div class="shareSummaryV018">'+esc(c.skipReason || summary)+'</div></label>';
    }).join('');
  }

  function openShareModal(){
    var school = selectedSchoolId(); var m = ensureModal(); m.classList.add('active'); var status = by('shareStatusV018'); if (status) status.textContent = ''; var intro = by('shareIntroV018'); if (intro) intro.textContent = 'Loading schedule communication options...';
    Promise.all([
      fetchJson('/api/communication/candidates-v018?' + new URLSearchParams({ school: school }).toString()),
      fetchJson('/api/communication/brevo-staff-email-status-v05418u?' + new URLSearchParams({ school: school, limit: '500' }).toString()).catch(function(){ return { rows: [] }; }),
      fetchJson('/api/v027/staff-portal/access-summary?' + new URLSearchParams({ school: school }).toString()).catch(function(){ return { staff: [] }; })
    ])
      .then(function(arr){ var j = arr[0] || {}; shareData = j; shareEmailStatusRows = (arr[1] && arr[1].rows) || []; shareAccessRows = (arr[2] && arr[2].staff) || []; shareCurrentHash = clean(j.hash || (arr[1] && arr[1].currentScheduleHash) || ''); shareCurrentPublishedAt = clean(j.publishedAt || (arr[1] && arr[1].currentPublishedAt) || ''); hydrateShareStatusFlagsV018(); var version = Number(j.scheduleVersion || (arr[1] && arr[1].currentDailyVersion) || 0) || 0; var changedEligible = Number(j.counts && j.counts.changedEligible || 0) || 0; var mode = (version >= 2 && changedEligible > 0 && j.recommendedMode === 'changed') ? 'changed' : 'all'; var radio = document.querySelector('input[name="redisShareModeV018"][value="'+mode+'"]') || document.querySelector('input[name="redisShareModeV018"][value="all"]'); if (radio) radio.checked = true; renderShareList(); })
      .catch(function(e){ shareData = null; if (intro) intro.textContent = 'Could not load communication options: ' + clean(e.message || e); if (by('shareStaffListV018')) by('shareStaffListV018').innerHTML = ''; });
  }
  function closeShareModal(){ var m = by('redisShareSchedulesModalV018'); if (m) m.classList.remove('active'); }
  function selectedStaffKeys(){ return Array.prototype.slice.call(document.querySelectorAll('.shareCheckV018:checked')).map(function(cb){ return cb.value; }).filter(Boolean); }
  // FEATURE: dedicated push-notification send, separate from "Send Selected Emails". Reads
  // each checked row's own visible staff name (the <strong> text) rather than assuming the
  // checkbox's `value` (c.key || c.staff) is guaranteed to match the display name exactly.
  function selectedStaffNamesForPush(){
    return Array.prototype.slice.call(document.querySelectorAll('.shareCheckV018:checked')).map(function(cb){
      var row=cb.closest('.shareStaffRowV018'); var nameEl=row&&row.querySelector('strong');
      return nameEl?nameEl.textContent.trim():'';
    }).filter(Boolean);
  }
  function sendSharePush(){
    var status=by('shareStatusV018'); var names=selectedStaffNamesForPush();
    if(!names.length){ if(status)status.textContent='Select at least one staff member.'; return; }
    if(status)status.textContent='Sending push notifications...';
    fetchJson('/api/v05418y/push/send', { method:'POST', body: JSON.stringify({ school: selectedSchoolId(), staffNames: names, title: 'Schedule update', body: 'Your Support Schedules schedule has been updated. Open the app to view it.' }) })
      .then(function(j){
        if(!j.configured){ if(status)status.textContent=j.message||'Push is not configured yet.'; return; }
        var results=j.results||[];
        var sent=results.filter(function(r){return r.status==='sent';}).length;
        var noDevice=results.filter(function(r){return r.status==='no-device';}).length;
        var failed=results.filter(function(r){return r.status==='failed';}).length;
        var parts=[sent+' sent']; if(noDevice)parts.push(noDevice+' not paired'); if(failed)parts.push(failed+' failed');
        if(status)status.textContent='Push notifications: '+parts.join(', ')+'.';
      })
      .catch(function(e){ if(status)status.textContent='Could not send push: '+clean(e.message||e); });
  }
  function ensureShareProgressModalV05418U(){
    var m=by('redisShareProgressModalV05418U');
    if(!m){m=document.createElement('div');m.id='redisShareProgressModalV05418U';document.body.appendChild(m);}
    return m;
  }
  function showShareProgressV05418U(title,text,done){
    var m=ensureShareProgressModalV05418U();
    m.innerHTML='<div class="shareProgressPanelV05418U">'+(done?'':'<div class="shareProgressSpinnerV05418U" aria-hidden="true"></div>')+'<h2 class="shareProgressTitleV05418U">'+esc(title||'Sending')+'</h2><div class="shareProgressTextV05418U">'+esc(text||'')+'</div>'+(done?'<div class="shareProgressActionsV05418U"><button type="button" class="btn primary" data-redis-v018-action="share-progress-close">Close</button></div>':'')+'</div>';
    m.classList.add('active');
  }
  function closeShareProgressV05418U(){var m=by('redisShareProgressModalV05418U'); if(m)m.classList.remove('active');}
  function selectByPredicateV018(pred){
    var pool = selectedPool(); var allowed = {};
    pool.forEach(function(c){ if (!c.skipReason && pred(c || {})) allowed[clean(c.key || c.staff || '')] = true; });
    document.querySelectorAll('.shareCheckV018').forEach(function(cb){ cb.checked = !!allowed[clean(cb.value)]; });
  }
  function sendShare(){
    var status = by('shareStatusV018'); var keys = selectedStaffKeys(); if (!keys.length) { if (status) status.textContent = 'Select at least one staff member.'; return; }
    var mode = currentMode();
    closeShareModal();
    showShareProgressV05418U('Sending schedule emails','Sending '+keys.length+' selected staff notification'+(keys.length===1?'':'s')+'...',false);
    fetchJson('/api/communication/send-v018', { method:'POST', body: JSON.stringify({ school: selectedSchoolId(), mode: mode, staffKeys: keys }) })
      .then(function(j){
        var text=(j.message || 'Schedule communication complete.') + (j.recordedAsCommunicated ? '\nThis published schedule has been marked communicated.' : '');
        showShareProgressV05418U('Schedule emails sent', text, true);
        if (j.recordedAsCommunicated) { var pill = by('shareSchedulesPillV686m26') || document.querySelector('.shareSchedulesPillV686m26'); if (pill) pill.classList.remove('active'); }
        try { window.dispatchEvent(new CustomEvent('supportSchedulesShareCommunicationSentV05418U',{detail:j||{}})); } catch(e) {}
        try { if (typeof window.loadCommunicationManagerV05418R === 'function') setTimeout(window.loadCommunicationManagerV05418R,250); } catch(e2) {}
        [100,600,1400,3000].forEach(function(ms){ setTimeout(refreshSharePill,ms); });
      })
      .catch(function(e){ showShareProgressV05418U('Schedule emails were not sent','Could not send schedule communication: '+clean(e.message || e),true); });
  }
  // Routes each selected staff member to email, push, or both based on THEIR OWN
  // preference (set via their Staff Portal gear settings) rather than sending everyone the
  // same channel -- see /api/communication/send-preferred-v018 on the server for the actual
  // per-person routing logic.
  function sendSharePreferred(){
    var status = by('shareStatusV018'); var keys = selectedStaffKeys(); if (!keys.length) { if (status) status.textContent = 'Select at least one staff member.'; return; }
    var mode = currentMode();
    closeShareModal();
    showShareProgressV05418U('Sending via preferred communication','Sending '+keys.length+' selected staff notification'+(keys.length===1?'':'s')+' by their preferred method...',false);
    fetchJson('/api/communication/send-preferred-v018', { method:'POST', body: JSON.stringify({ school: selectedSchoolId(), mode: mode, staffKeys: keys }) })
      .then(function(j){
        var parts=[];
        if (j.email) parts.push('Email: '+j.email.sent+' sent'+(j.email.skipped?', '+j.email.skipped+' skipped':'')+(j.email.failed?', '+j.email.failed+' failed':''));
        if (j.push) parts.push('Push: '+j.push.sent+' sent'+(j.push.notPaired?', '+j.push.notPaired+' not paired':'')+(j.push.failed?', '+j.push.failed+' failed':''));
        var text = parts.join('\n') + (j.recordedAsCommunicated ? '\nThis published schedule has been marked communicated.' : '');
        showShareProgressV05418U('Sent via preferred communication', text, true);
        if (j.recordedAsCommunicated) { var pill = by('shareSchedulesPillV686m26') || document.querySelector('.shareSchedulesPillV686m26'); if (pill) pill.classList.remove('active'); }
        try { window.dispatchEvent(new CustomEvent('supportSchedulesShareCommunicationSentV05418U',{detail:j||{}})); } catch(e) {}
        try { if (typeof window.loadCommunicationManagerV05418R === 'function') setTimeout(window.loadCommunicationManagerV05418R,250); } catch(e2) {}
        [100,600,1400,3000].forEach(function(ms){ setTimeout(refreshSharePill,ms); });
      })
      .catch(function(e){ showShareProgressV05418U('Could not send','Could not send via preferred communication: '+clean(e.message || e),true); });
  }
  function hideSharePillNow(hash){ var pill = by('shareSchedulesPillV686m26') || document.querySelector('.shareSchedulesPillV686m26'); if (pill) { pill.classList.remove('active'); pill.setAttribute('data-snoozed','1'); } if (hash) rememberLocalSnooze(hash); }
  function dismissPrompt(){
    var pill = by('shareSchedulesPillV686m26') || document.querySelector('.shareSchedulesPillV686m26');
    var hash = clean((promptState && (promptState.publishInstance || promptState.publishedInstance || promptState.hash || promptState.publishedHash || promptState.scheduleHash)) || (pill && (pill.getAttribute('data-publish-instance') || pill.getAttribute('data-published-hash'))) || '');
    hideSharePillNow(hash);
    fetchJson('/api/communication/dismiss-v018', { method:'POST', body: JSON.stringify({ school: selectedSchoolId(), hash: hash }) })
      .then(function(j){ var h = clean((j && (j.dismissedHash || j.hash || j.publishedHash)) || hash); hideSharePillNow(h); })
      .catch(function(e){ msg('Could not persist Share Schedules snooze: ' + clean(e.message || e), 'err'); hideSharePillNow(hash); });
  }

  window.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('[data-redis-v018-action]');
    if (t) {
      var act = t.getAttribute('data-redis-v018-action'); e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (act === 'share-open') openShareModal(); else if (act === 'share-close') closeShareModal(); else if (act === 'share-progress-close') closeShareProgressV05418U(); else if (act === 'share-dismiss') dismissPrompt(); else if (act === 'share-send') sendShare(); else if (act === 'share-send-push') sendSharePush(); else if (act === 'share-send-preferred') sendSharePreferred(); else if (act === 'share-select-all') document.querySelectorAll('.shareCheckV018:not(:disabled)').forEach(function(cb){ cb.checked = true; }); else if (act === 'share-select-none') document.querySelectorAll('.shareCheckV018:not(:disabled)').forEach(function(cb){ cb.checked = false; }); else if (act === 'share-select-unopened') selectByPredicateV018(function(c){ return c.emailCurrentSent && !c.emailCurrentOpened; }); else if (act === 'share-select-unviewed') selectByPredicateV018(function(c){ return !c.portalViewedCurrent; });
      return false;
    }
  }, true);
  window.addEventListener('change', function(e){ if (e.target && e.target.name === 'redisShareModeV018') renderShareList(); }, true);
  function periodic(){ installStyles(); ensureSharePill(); if (promptTimer) clearTimeout(promptTimer); promptTimer = setTimeout(refreshSharePill, 60); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', periodic); else periodic();
  [250, 750, 1400, 2600, 5000, 9000].forEach(function(ms){ setTimeout(periodic, ms); });
  try { if (typeof window.registerNavigationAfterHookV5_ === 'function') window.registerNavigationAfterHookV5_(function(){ setTimeout(periodic, 150); }, 'redisV018CommunicationWorkflow'); } catch(e) {}
  try { var basePublish = window.publishSchedule || (typeof publishSchedule === 'function' ? publishSchedule : null); if (basePublish && !basePublish.__redisV018Wrapped) { var wrapped = function(){ var ret = basePublish.apply(this, arguments); [150, 350, 700, 1200, 2200, 4200, 8000].forEach(function(ms){ setTimeout(refreshSharePill, ms); }); try{ if(ret && typeof ret.then==='function') ret.then(function(){[80,250,700,1500].forEach(function(ms){setTimeout(refreshSharePill,ms);});}); }catch(e){} return ret; }; wrapped.__redisV018Wrapped = true; window.publishSchedule = wrapped; try { publishSchedule = wrapped; } catch(e2) {} } } catch(e3) {}
})();

;(function(){
  if (window.__gaRedisV05418BQHistoryPatch) return;
  window.__gaRedisV05418BQHistoryPatch = true;
  function by(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c; }); }
  function msg(t, kind){ try { if (typeof setMsg === 'function') setMsg(t || '', kind || 'ok'); } catch(e) {} }
  function selectedSchoolId(){
    try { if (typeof selectedSchoolIdV5312 === 'function') { var s = clean(selectedSchoolIdV5312()); if (s) return s; } } catch(e) {}
    try { var ctx = window.campusContextV5253 || campusContextV5253 || {}; var s2 = clean(ctx.selectedCampusId || (ctx.currentCampus && (ctx.currentCampus.campusId || ctx.currentCampus.id)) || ''); if (s2) return s2; } catch(e2) {}
    try { var sel = by('campusSelector'); var s3 = clean(sel && sel.value); if (s3) return s3; } catch(e3) {}
    return '';
  }
  function fetchJson(url, opts){ opts = opts || {}; opts.credentials = opts.credentials || 'same-origin'; if (opts.body && !opts.headers) opts.headers = { 'Content-Type':'application/json' }; return fetch(url, opts).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) { var err = new Error((j && (j.error || j.message)) || ('HTTP '+r.status)); err.payload = j; throw err; } return j; }); }); }
  function fmt(v){ try { if (typeof formatHistoryStamp === 'function') return formatHistoryStamp(v || ''); } catch(e) {} return clean(v); }
  var rows = [];
  var favoritesOnly = false;
  var loading = false;
  function normalize(list){ return (Array.isArray(list) ? list : []).map(function(r){ r = r || {}; return Object.assign({}, r, { row: Number(r.row || r.rowNumber || 0) || 0, id: clean(r.id || r.historyId || r.key || r.hash || ''), starred: !!r.starred, regularLocked: !!(r.regularLocked || r.locked) }); }).filter(function(r){ return r.id; }); }
  function setRows(list){ rows = normalize(list); try { window.historyData = rows; historyData = rows; window.historyFavoritesOnly = favoritesOnly; historyFavoritesOnly = favoritesOnly; historySnapshotCache = {}; historyPage = 1; } catch(e) {} }
  function visibleRows(){ return favoritesOnly ? rows.filter(function(r){ return r.starred; }) : rows; }
  function render(){
    var box = by('historyTable'); if (!box) return;
    var favBtn = by('historyFavoritesToggle'); if (favBtn) favBtn.textContent = 'Favorites only: ' + (favoritesOnly ? 'On' : 'Off');
    var list = visibleRows();
    if (!list.length) { box.innerHTML = '<p class="muted">' + (favoritesOnly ? 'No favorite schedules loaded yet.' : 'No published schedules saved yet.') + '</p><div id="historyViewBox" class="card" style="margin-top:10px;display:none"></div>'; return; }
    var body = list.map(function(r){
      var id = esc(r.id), row = Number(r.row || 0) || 0;
      return '<tr data-v018-history-row="'+row+'" data-v018-history-id="'+id+'"><td class="historyDate">'+esc(fmt(r.publishedAt || ''))+'</td><td><strong>'+esc(r.summary || 'Published schedule')+'</strong><div class="muted">'+esc(r.id || '')+'</div></td><td class="notesCell"><textarea data-history-note="'+id+'">'+esc(r.notes || '')+'</textarea></td><td class="historyActionsCell"><div class="historyActions"><button type="button" class="starBtn historyStarV018 '+(r.starred?'active':'')+'" title="Favorite" aria-pressed="'+(r.starred?'true':'false')+'" data-v018-history-star-row="'+row+'" data-v018-history-id="'+id+'">★</button><button type="button" class="btn small" data-action="history-view" data-history-id="'+id+'">View</button><button type="button" class="btn small" title="Edit in Customize Schedule" data-action="history-edit-custom" data-history-id="'+id+'"><i class="fa-solid fa-pencil" aria-hidden="true"></i></button><button type="button" class="btn small publishBtn historyPublishBtn" style="display:inline-flex" data-action="history-restore" data-history-id="'+id+'">Publish</button><button type="button" class="historyRegularBtn historyLockV018 '+(r.regularLocked?'active':'')+'" title="'+(r.regularLocked?'Unlock regular schedule':'Lock as regular schedule')+'" aria-pressed="'+(r.regularLocked?'true':'false')+'" data-v018-history-lock-row="'+row+'" data-v018-history-id="'+id+'"><i class="fa-solid fa-lock" aria-hidden="true"></i></button><button type="button" class="btn small" data-action="history-save-note" data-history-id="'+id+'">Save Notes</button><button type="button" class="iconBtn danger historyDeleteBtn historyDeleteIconBtnV5329" title="Delete historical schedule" aria-label="Delete historical schedule" data-action="history-delete" data-history-id="'+id+'">🗑</button></div></td></tr>';
    }).join('');
    box.innerHTML = '<table class="historyTable"><thead><tr><th>Published / Saved</th><th>Summary</th><th>Notes</th><th class="historyActionsCell">Actions</th></tr></thead><tbody>'+body+'</tbody></table><div class="muted" style="margin-top:8px">Showing '+esc(list.length)+' historical schedule'+(list.length===1?'':'s')+'.</div><div id="historyViewBox" class="card" style="margin-top:10px;display:none"></div>';
  }
  function load(){
    if (loading) return;
    var school = selectedSchoolId(); if (!school) { msg('Choose a school before loading schedule history.','warn'); return; }
    loading = true; msg('Loading schedule history...','warn');
    fetchJson('/api/history/list-v017?' + new URLSearchParams({ school: school }).toString()).then(function(j){ setRows(j.rows || []); render(); msg('Schedule history loaded.','ok'); }).catch(function(e){ msg('Could not load schedule history: ' + clean(e.message || e), 'err'); }).finally(function(){ loading = false; });
  }
  function findRow(row, id){ row = Number(row || 0) || 0; id = clean(id); return rows.filter(function(r){ return (row && Number(r.row) === row) || (id && r.id === id); })[0] || null; }
  function setStar(row, id, starred){ var school = selectedSchoolId(); if (!school) return; msg(starred ? 'Marking favorite...' : 'Removing favorite...', 'warn'); fetchJson('/api/history/star-row-v017', { method:'POST', body: JSON.stringify({ school: school, row: Number(row), id: id || '', starred: !!starred }) }).then(function(j){ setRows(j.rows || []); render(); msg(starred ? 'Favorite saved.' : 'Favorite removed.','ok'); }).catch(function(e){ msg('Could not update favorite: ' + clean(e.message || e), 'err'); load(); }); }
  function setLock(row, id, locked){ var school = selectedSchoolId(); if (!school) return; msg(locked ? 'Locking regular schedule...' : 'Unlocking regular schedule...', 'warn'); fetchJson('/api/history/regular-lock-row-v017', { method:'POST', body: JSON.stringify({ school: school, row: Number(row), id: id || '', locked: !!locked }) }).then(function(j){ setRows(j.rows || []); render(); msg(locked ? 'Regular schedule lock saved.' : 'Regular schedule unlocked.','ok'); try { if (typeof loadRegularSchedulePage === 'function') setTimeout(loadRegularSchedulePage, 250); } catch(e) {} }).catch(function(e){ msg('Could not update regular schedule lock: ' + clean(e.message || e), 'err'); load(); }); }
  window.addEventListener('click', function(e){
    var star = e.target && e.target.closest && e.target.closest('[data-v018-history-star-row]');
    if (star) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); var sr = star.getAttribute('data-v018-history-star-row'), sid = star.getAttribute('data-v018-history-id'); var srow = findRow(sr, sid); setStar(sr, sid, !(srow && srow.starred)); return false; }
    var lock = e.target && e.target.closest && e.target.closest('[data-v018-history-lock-row]');
    if (lock) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); var lr = lock.getAttribute('data-v018-history-lock-row'), lid = lock.getAttribute('data-v018-history-id'); var lrow = findRow(lr, lid); setLock(lr, lid, !(lrow && lrow.regularLocked)); return false; }
    var da = e.target && e.target.closest && e.target.closest('[data-action]'); if (!da) return;
    var a = da.getAttribute('data-action') || '';
    if (a === 'history-load' || a === 'history-load-more') { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); load(); return false; }
    if (a === 'history-toggle-favorites') { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); favoritesOnly = !favoritesOnly; try { window.historyFavoritesOnly = favoritesOnly; historyFavoritesOnly = favoritesOnly; } catch(x) {} render(); return false; }
  }, true);
  function styles(){ if (by('gaRedisV018HistoryStyles')) return; var st = document.createElement('style'); st.id = 'gaRedisV018HistoryStyles'; st.textContent = '.historyActions .historyStarV018{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#94a3b8!important;width:30px!important;min-width:30px!important;height:32px!important;padding:0!important;font-size:18px!important}.historyActions .historyStarV018.active{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#d4a017!important}.historyActions .historyLockV018{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#94a3b8!important;width:30px!important;min-width:30px!important;height:32px!important;padding:0!important}.historyActions .historyLockV018.active{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#d4a017!important}'; document.head.appendChild(st); }
  function boot(){ styles(); if ((by('history') && by('history').classList.contains('active')) || /#history/.test(location.hash || '')) setTimeout(load, 250); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  try { if (typeof window.registerNavigationAfterHookV5_ === 'function') window.registerNavigationAfterHookV5_(function(page){ if (page === 'history') setTimeout(load, 350); }, 'redisV018HistoryStableRows'); } catch(e) {}
})();

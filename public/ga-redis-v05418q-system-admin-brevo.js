/* Support Schedules 0.54.18t Brevo System Admin provider settings + staff notification tracking diagnostics. */
(function(){
  if(window.__GA_V05418Q_BREVO_SYSTEM_ADMIN__) return;
  window.__GA_V05418Q_BREVO_SYSTEM_ADMIN__ = true;
  function by(id){ return document.getElementById(id); }
  function parseJsonResponse(res){ return res.text().then(function(txt){ var j={}; try{ j=txt?JSON.parse(txt):{}; }catch(e){ throw new Error('Expected JSON, got: '+String(txt||'').slice(0,120)); } if(!res.ok||j.ok===false) throw new Error(j.error||j.message||('HTTP '+res.status)); return j; }); }
  function getJson(url){ return fetch(url,{credentials:'same-origin',cache:'no-store'}).then(parseJsonResponse); }
  function postJson(url, body){ return fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})}).then(parseJsonResponse); }
  function host(){ return document.querySelector('#multiCampus .mcSystemLeftV5302') || document.querySelector('#multiCampus .mcSystemColV5302') || document.querySelector('#multiCampus .multiCampusGrid') || by('multiCampus'); }
  function removeOldSettingsCard(){ var old=by('brevoSettingsCardV05418N'); if(old && !old.closest('#multiCampus')) old.remove(); }
  function ensureCard(){
    removeOldSettingsCard();
    var h=host(); if(!h) return null;
    var existing=by('brevoSystemAdminCardV05418O'); if(existing) return existing;
    var card=document.createElement('div');
    card.id='brevoSystemAdminCardV05418O';
    card.className='card brevoSystemAdminCardV05418O';
    card.innerHTML=''+
      '<h2>Email (via Brevo)</h2>'+ 
      '<div class="muted">Global transactional email provider for Share Schedules, Staff Portal absence notifications, and public contact form leads.</div>'+ 
      '<div class="brevoGridV05418O" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px">'+
        '<label style="display:flex;align-items:center;gap:8px;font-weight:800"><input id="brevoEnabledV05418N" type="checkbox" style="width:auto"> Enable Brevo email</label>'+ 
        '<label style="display:flex;align-items:center;gap:8px;font-weight:800"><input id="brevoScheduleEnabledV05418N" type="checkbox" style="width:auto"> Share Schedules emails</label>'+ 
        '<label style="display:flex;align-items:center;gap:8px;font-weight:800"><input id="brevoAbsenceEnabledV05418N" type="checkbox" style="width:auto"> Absence notification emails</label>'+ 
        '<label style="display:flex;align-items:center;gap:8px;font-weight:800"><input id="brevoContactEnabledV05418O" type="checkbox" style="width:auto"> Contact form lead emails</label>'+ 
        '<div><label>From name</label><input id="brevoFromNameV05418N" placeholder="Support Schedules"></div>'+ 
        '<div><label>From email</label><input id="brevoFromEmailV05418N" placeholder="schedules@supportschedules.com"></div>'+ 
        '<div><label>Reply-to email</label><input id="brevoReplyToEmailV05418N" placeholder="optional"></div>'+ 
        '<div><label>Brevo API key</label><input id="brevoApiKeyV05418N" type="password" placeholder="Paste only when adding/replacing key"><div id="brevoApiKeyStatusV05418N" class="muted"></div></div>'+ 
        '<div><label>Test recipient</label><input id="brevoTestRecipientV05418N" placeholder="you@example.edu"></div>'+ 
        '<div><label>Contact form recipients</label><textarea id="brevoContactRecipientsV05418O" placeholder="sales@example.com" style="min-height:72px"></textarea></div>'+ 
        '<label style="display:flex;align-items:center;gap:8px;font-weight:800"><input id="brevoTrackingEnabledV05418Q" type="checkbox" style="width:auto"> Track staff email delivery/open/click events</label>'+ 
        '<div><label>Webhook token</label><input id="brevoWebhookTokenV05418Q" type="password" placeholder="Paste only when adding/replacing token"><div id="brevoWebhookTokenStatusV05418Q" class="muted"></div></div>'+ 
        '<div><label>Brevo webhook URL</label><input id="brevoWebhookUrlV05418Q" readonly value="/api/communication/brevo-webhook-v05418q?token=YOUR_TOKEN"><div class="muted">Use this path in Brevo transactional webhooks. This tracks Share Schedules emails only, not absence notifications.</div></div>'+ 
      '</div>'+ 
      '<div class="toolbar" style="margin-top:10px"><button class="btn primary" type="button" data-v05418o-brevo="save">Save Brevo Settings</button><button class="btn" type="button" data-v05418o-brevo="test">Send Test Email</button><button class="btn" type="button" data-v05418o-brevo="reload">Reload</button><button class="btn" type="button" data-v05418o-brevo="diag">Reload Webhook Diagnostics</button><span id="brevoMsgV05418N" class="muted"></span></div>'+
      '<div class="brevoDiagV05418T" style="margin-top:10px;border:1px solid #dbe3ef;border-radius:12px;padding:10px;background:#f8fafc"><strong>Webhook diagnostics</strong><div id="brevoWebhookDiagV05418T" class="muted" style="margin-top:4px">No webhook diagnostics loaded yet.</div></div>';
    h.appendChild(card);
    loadSettings();
    return card;
  }
  function setMsg(text, cls){ var m=by('brevoMsgV05418N'); if(m){ m.textContent=text||''; m.className='muted '+(cls||''); } }
  function loadWebhookDiagnosticsV05418T(){
    var el=by('brevoWebhookDiagV05418T'); if(!el) return;
    getJson('/api/communication/brevo-webhook-diagnostics-v05418t?_t='+Date.now()).then(function(j){
      var d=j.diagnostics||{};
      var recent=j.recent||[];
      var last=recent.length?recent[recent.length-1]:{};
      el.innerHTML='Last received: <b>'+(d.updatedAt||'none yet')+'</b> · matched: <b>'+(d.matched||'0')+'</b> · ignored: <b>'+(d.ignored||'0')+'</b> · duplicates: <b>'+(d.duplicates||'0')+'</b>'+(last.lastDetails?'<br><span>Latest detail: '+String(last.lastDetails).slice(0,220)+'</span>':'');
    }).catch(function(e){ el.textContent='Could not load webhook diagnostics: '+(e.message||e); });
  }
  function loadSettings(){
    if(!by('brevoSystemAdminCardV05418O')) return;
    setMsg('Loading Brevo email settings...');
    getJson('/api/communication/brevo-settings-v05418n?_t='+Date.now()).then(function(j){
      if(by('brevoEnabledV05418N')) by('brevoEnabledV05418N').checked=!!j.enabled;
      if(by('brevoScheduleEnabledV05418N')) by('brevoScheduleEnabledV05418N').checked=!!j.scheduleEnabled;
      if(by('brevoAbsenceEnabledV05418N')) by('brevoAbsenceEnabledV05418N').checked=!!j.absenceEnabled;
      if(by('brevoContactEnabledV05418O')) by('brevoContactEnabledV05418O').checked=!!j.contactEnabled;
      if(by('brevoTrackingEnabledV05418Q')) by('brevoTrackingEnabledV05418Q').checked=!!j.trackingEnabled;
      if(by('brevoFromNameV05418N')) by('brevoFromNameV05418N').value=j.fromName||'Support Schedules';
      if(by('brevoFromEmailV05418N')) by('brevoFromEmailV05418N').value=j.fromEmail||'schedules@supportschedules.com';
      if(by('brevoReplyToEmailV05418N')) by('brevoReplyToEmailV05418N').value=j.replyToEmail||'';
      if(by('brevoTestRecipientV05418N')) by('brevoTestRecipientV05418N').value=j.testRecipient||'';
      if(by('brevoContactRecipientsV05418O')) by('brevoContactRecipientsV05418O').value=j.contactRecipients||'';
      if(by('brevoApiKeyStatusV05418N')) by('brevoApiKeyStatusV05418N').textContent=j.apiKeySaved?('API key saved ('+(j.apiKeyMasked||'saved')+'). Leave blank to keep it.'):('No API key saved yet.');
      if(by('brevoWebhookTokenStatusV05418Q')) by('brevoWebhookTokenStatusV05418Q').textContent=j.webhookTokenSaved?('Webhook token saved ('+(j.webhookTokenMasked||'saved')+'). Leave blank to keep it.'):('No webhook token saved yet.');
      if(by('brevoWebhookUrlV05418Q')) by('brevoWebhookUrlV05418Q').value=(location.origin||'')+(j.webhookPath||'/api/communication/brevo-webhook-v05418q?token=YOUR_TOKEN');
      setMsg('Brevo email settings loaded.'); loadWebhookDiagnosticsV05418T();
    }).catch(function(e){ setMsg('Could not load Brevo settings: '+(e.message||e),'err'); });
  }
  function collect(){ return {
    enabled: !!(by('brevoEnabledV05418N')&&by('brevoEnabledV05418N').checked),
    scheduleEnabled: !!(by('brevoScheduleEnabledV05418N')&&by('brevoScheduleEnabledV05418N').checked),
    absenceEnabled: !!(by('brevoAbsenceEnabledV05418N')&&by('brevoAbsenceEnabledV05418N').checked),
    contactEnabled: !!(by('brevoContactEnabledV05418O')&&by('brevoContactEnabledV05418O').checked),
    trackingEnabled: !!(by('brevoTrackingEnabledV05418Q')&&by('brevoTrackingEnabledV05418Q').checked),
    fromName: (by('brevoFromNameV05418N')||{}).value||'',
    fromEmail: (by('brevoFromEmailV05418N')||{}).value||'',
    replyToEmail: (by('brevoReplyToEmailV05418N')||{}).value||'',
    apiKey: (by('brevoApiKeyV05418N')||{}).value||'',
    testRecipient: (by('brevoTestRecipientV05418N')||{}).value||'',
    contactRecipients: (by('brevoContactRecipientsV05418O')||{}).value||'',
    webhookToken: (by('brevoWebhookTokenV05418Q')||{}).value||''
  }; }
  function saveSettings(){
    var p=collect();
    setMsg('Saving Brevo email settings...');
    postJson('/api/communication/brevo-settings-v05418n', p).then(function(j){ if(by('brevoApiKeyV05418N')) by('brevoApiKeyV05418N').value=''; if(by('brevoWebhookTokenV05418Q')) by('brevoWebhookTokenV05418Q').value=''; setMsg(j.message||'Brevo settings saved.','ok'); loadSettings(); }).catch(function(e){ setMsg('Could not save Brevo settings: '+(e.message||e),'err'); });
  }
  function sendTest(){
    var p=collect();
    setMsg('Sending Brevo test email...');
    postJson('/api/communication/brevo-test-v05418n', {to:p.testRecipient,testRecipient:p.testRecipient}).then(function(j){ setMsg(j.message||'Brevo test email sent.','ok'); }).catch(function(e){ setMsg('Brevo test failed: '+(e.message||e),'err'); });
  }
  document.addEventListener('click',function(e){
    var b=e.target&&e.target.closest&&e.target.closest('[data-v05418o-brevo]'); if(!b) return;
    var a=b.getAttribute('data-v05418o-brevo'); e.preventDefault();
    if(a==='save') saveSettings(); else if(a==='test') sendTest(); else if(a==='reload') loadSettings(); else if(a==='diag') loadWebhookDiagnosticsV05418T();
  },true);
  function boot(){ ensureCard(); }
  try{ if(typeof window.registerNavigationAfterHookV5_==='function') window.registerNavigationAfterHookV5_(function(page){ if(page==='multiCampus') setTimeout(boot,120); },'v05418qBrevoSystemAdmin'); }catch(e){}
  var mo=new MutationObserver(function(){ if(by('multiCampus')&&!by('brevoSystemAdminCardV05418O')) setTimeout(boot,120); removeOldSettingsCard(); });
  try{ mo.observe(document.body,{childList:true,subtree:true}); }catch(e){}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else setTimeout(boot,250);
})();

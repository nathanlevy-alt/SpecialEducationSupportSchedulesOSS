/* Support Schedules v05423/v05418di Staff Manager security access patch.
   Event-driven only: patches the active Staff Manager row variant without adding duplicate Last View fields. */
(function(){
  'use strict';
  if(window.__GA_REDIS_V05423_SECURITY_STAFF_PATCH_DI__) return;
  window.__GA_REDIS_V05423_SECURITY_STAFF_PATCH_DI__=true;
  function by(id){return document.getElementById(id);} 
  function clean(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function norm(v){return clean(v).toLowerCase().replace(/\s+/g,' ');} 
  function closest(el,sel){return el&&el.closest?el.closest(sel):null;}
  function selectedSchoolId(){
    var sel=by('campusSelector');if(sel&&clean(sel.value))return clean(sel.value);
    try{var p=(typeof window.selectedSchoolPayloadV686m20==='function'?window.selectedSchoolPayloadV686m20():null)||{};var v=clean(p.school||p.schoolId||p.campusId||p.selectedCampusId||'');if(v)return v;}catch(e){}
    try{var p2=(typeof window.selectedSchoolPayloadV683==='function'?window.selectedSchoolPayloadV683():null)||{};var v2=clean(p2.school||p2.schoolId||p2.campusId||p2.selectedCampusId||'');if(v2)return v2;}catch(e2){}
    return '';
  }
  function setMsg(msg,type){try{if(typeof window.setMsg==='function')return window.setMsg(msg,type||'warn');}catch(e){}}
  function currentStaffName(){var el=by('staffName');return clean((el&&el.value)||((window.currentStaff||{}).name)||'');}
  function installCss(){
    var css=''
      +'html body #staff>.split>.card:first-child #staffEmailFieldV686m41,html body #staff>.split>.card:first-child .staffEmailFieldV686m41{display:none!important}'
      +'html body #staff #staffLastViewFieldV05410{display:none!important}'
      +'html body #staff #staffLastViewV0545{display:block!important;visibility:visible!important;position:static!important;left:auto!important;width:100%!important;min-width:0!important;height:34px!important}'
      +'html body #staff #staffLastViewV0545.staleV0545{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important}'
      +'html body #staff #staffLastViewV0545.freshV05410{background:#ecfdf5!important;border-color:#bbf7d0!important;color:#166534!important}'
      +'html body #staff .staffPortalAccessFieldV05423{width:50px!important;min-width:50px!important;max-width:50px!important;display:flex!important;flex-direction:column!important;justify-content:flex-end!important;align-self:end!important;margin:0!important;padding:0!important}'
      +'html body #staff .staffPortalAccessFieldV05423 label{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:2px!important;height:17px!important;line-height:17px!important;margin:0 0 5px!important;font-size:12px!important;font-weight:700!important;color:#0f172a!important;white-space:nowrap!important}'
      +'html body #staff .staffPortalAccessFieldV05423 .staffAccessIconBoxV05423{height:34px!important;width:50px!important;min-width:50px!important;max-width:50px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:1px solid #d8e1ef!important;border-radius:12px!important;background:#f8fafc!important;box-sizing:border-box!important}'
      +'html body #staff .staffPortalAccessFieldV05423 .securityIconBtnV05422{font-size:14px!important;padding:0!important;min-width:28px!important;min-height:28px!important;width:28px!important;height:28px!important}'
      +'html body #staff #staffNotificationEmailV0545{min-width:0!important}html body #staff .staffMetricsContactRowV0545>.staffMetricFieldV0545:nth-child(3){padding-left:14px!important;box-sizing:border-box!important}html body #staff .staffEmailLineV0545{min-width:0!important;margin-left:0!important}html body #staff #staffAppPushStatusV0545{cursor:default!important}'
      +'@media(max-width:1500px){.staffPortalAccessFieldV05423{width:46px!important;min-width:46px!important;max-width:46px!important}.staffAccessIconBoxV05423{width:46px!important;min-width:46px!important;max-width:46px!important}}'
      +'@media(max-width:1180px){html body #staff .staffPortalAccessFieldV05423{width:auto!important;max-width:none!important}}'
      +'html body #staff>.split>.card:first-child .staffMetricFieldV0545:has(#staffNotificationEmailV0545){display:none!important}'
      +'html body #staff>.split>.card:first-child #staffNotificationEmailV0545{display:none!important}'
      +'html body #staff>.split>.card:first-child #staffNotificationEmailV686m41,html body #staff>.split>.card:first-child #staffNotificationEmailV024,html body #staff>.split>.card:first-child #staffNotificationEmailV686m26,html body #staff>.split>.card:first-child #staffEmailFieldV024{display:none!important}'
      +'html body #staff>.split>.card:first-child .staffSidebarOrphanEmailV05423{display:none!important}'
      +'.staffQrStatusV05423{font-size:12px;margin-top:6px;color:#64748b}.staffQrStatusV05423.ok{color:#166534}.staffQrStatusV05423.err{color:#b91c1c}';
    var st=by('gaRedisV05423SecurityStaffPatchStyles');
    if(!st){st=document.createElement('style');st.id='gaRedisV05423SecurityStaffPatchStyles';document.head.appendChild(st);} 
    if(st.textContent!==css)st.textContent=css;
  }
  function icon(status){
    if(status==='valid')return '<i class="fa-solid fa-link secIconGreenV05422" title="Valid link, has been accessed"></i>';
    if(status==='never-accessed')return '<i class="fa-solid fa-link secIconGreyV05422" title="Valid link, never accessed"></i>';
    return '<i class="fa-solid fa-link-slash secIconRedV05422" title="Revoked or inactive"></i>';
  }
  function rowEl(){return by('staffMetricsContactRowV0545')||by('staffMetricsContactRowV0546')||document.querySelector('#staff .staffUnifiedRowV0548,#staff .staffContactGridV0548');}
  function removeDuplicateModernLastView(){
    var extra=by('staffLastViewFieldV05410');
    if(extra&&extra.parentNode)extra.parentNode.removeChild(extra);
  }
  function hideOrphanEmailOnStaffList(){
    try{
      document.querySelectorAll('#staffEmailFieldV686m41,.staffEmailFieldV686m41').forEach(function(el){
        var good=el.parentNode&&el.parentNode.classList&&el.parentNode.classList.contains('staffDataStatsV5288');
        if(!good){el.style.display='none';el.classList.add('staffSidebarOrphanEmailV05423');}
      });
      var left=document.querySelector('#staff>.split>.card:first-child');
      var row=rowEl();
      var ids=['staffNotificationEmailV0545','staffNotificationEmailV686m41','staffNotificationEmailV024','staffNotificationEmailV686m26','staffEmailFieldV024','staffEmailFieldV686m41'];
      ids.forEach(function(id){
        var email=by(id);
        if(!email)return;
        var inLeft=left&&left.contains(email);
        var inActiveRow=row&&row.contains(email);
        if(inLeft&&!inActiveRow){
          var wrap=closest(email,'.staffMetricFieldV0545,.staffEmailLineV0545,.inline,.field,.formField')||email.parentNode;
          if(wrap&&left.contains(wrap)){
            wrap.style.display='none';
            wrap.classList.add('staffEmailOrphanHiddenV05423','staffSidebarOrphanEmailV05423');
          }
          email.style.display='none';
          email.classList.add('staffSidebarOrphanEmailV05423');
          var prev=email.previousElementSibling;
          if(prev&&String(prev.tagName||'').toLowerCase()==='label'&&/^\s*Email\s*$/i.test(prev.textContent||'')){
            prev.style.display='none';
            prev.classList.add('staffSidebarOrphanEmailV05423');
          }
        }
      });
      if(left){
        Array.prototype.slice.call(left.querySelectorAll('label')).forEach(function(label){
          if(!/^\s*Email\s*$/i.test(label.textContent||''))return;
          var next=label.nextElementSibling;
          var shouldHide=false;
          if(next&&String(next.tagName||'').toLowerCase()==='input')shouldHide=true;
          if(next&&next.querySelector&&next.querySelector('input[id^="staffNotificationEmail"],input[id^="staffEmailField"]'))shouldHide=true;
          if(shouldHide){
            label.style.display='none';
            label.classList.add('staffSidebarOrphanEmailV05423');
            if(next){next.style.display='none';next.classList.add('staffSidebarOrphanEmailV05423');}
          }
        });
      }
    }catch(e){}
  }
  function lastViewField(){
    removeDuplicateModernLastView();
    var lv=by('staffLastViewV0545');
    var wrap=lv&&closest(lv,'.staffMetricFieldV0545');
    return wrap||null;
  }
  function ensureAccessField(){
    var row=rowEl(); if(!row)return null;
    removeDuplicateModernLastView();
    var lv=lastViewField();
    var field=by('staffPortalAccessFieldV05423');
    if(!field){
      field=document.createElement('div');field.id='staffPortalAccessFieldV05423';field.className='staffMetricFieldV0545 staffPortalAccessFieldV05423';
      field.innerHTML='<label>Access <span class="helpDot" data-tip="Open access controls for this staff member. Green/gray link means current portal access is active; red slash means revoked or inactive.">?</span></label><div id="staffPortalAccessIconV05423" class="staffAccessIconBoxV05423 muted">--</div>';
    }
    if(lv&&lv.parentNode===row){
      if(lv.nextSibling!==field)row.insertBefore(field,lv.nextSibling);
    }else if(field.parentNode!==row){row.appendChild(field);}
    try{if(typeof initHelpTooltipOverlayV5254==='function')initHelpTooltipOverlayV5254();}catch(e){}
    return field;
  }
  function neutralizeAppPairedClick(){
    var f=by('staffAppPushStatusV0545')||by('staffAppPushStatusV05418Y')||document.querySelector('[data-staff-app-paired],.staffAppPushStatusV05418Y');
    if(!f)return;
    f.onclick=function(e){if(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}return false;};
    f.__v0548ClickWired=true;f.style.cursor='default';
    var help=f.closest&&f.closest('.staffMetricFieldV0545')&&f.closest('.staffMetricFieldV0545').querySelector('.helpDot');
    if(help)help.setAttribute('data-tip','Read-only mobile app pairing status. Use the Access link or Security Manager to revoke portal/app access, review devices, or manage security actions.');
    f.title=clean(f.value)==='Yes'?'Paired mobile app status. Use Access/Security Manager to manage access.':'Mobile app is not paired.'; try{f.setAttribute('readonly','readonly');}catch(e){}
  }
  var cache=null, cacheAt=0, cacheSchool='', inFlight=false, lastRenderedKey='';
  function fetchSecurityRows(force){
    var sc=selectedSchoolId(); var now=Date.now();
    if(!force&&cache&&cacheSchool===sc&&now-cacheAt<12000)return Promise.resolve(cache);
    if(inFlight)return Promise.resolve(null);
    inFlight=true;
    return fetch('/api/v05422/security-overview?'+new URLSearchParams({school:sc,_t:Date.now()}).toString(),{credentials:'same-origin',cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){cache=j||{};cacheAt=Date.now();cacheSchool=sc;return cache;})
      .catch(function(){return null;})
      .finally(function(){inFlight=false;});
  }
  function renderPlaceholder(){var box=by('staffPortalAccessIconV05423');if(box&&box.innerHTML!=='--')box.innerHTML='--';}
  function renderAccessIcon(force){
    installCss();neutralizeAppPairedClick();ensureAccessField();
    var staff=currentStaffName(); if(!staff){lastRenderedKey='';renderPlaceholder();return;}
    var key=selectedSchoolId()+'|'+norm(staff);
    if(!force&&key===lastRenderedKey)return;
    lastRenderedKey=key;
    fetchSecurityRows(force).then(function(j){
      if(!j)return;
      var box=by('staffPortalAccessIconV05423'); if(!box)return;
      var rows=(j&&j.staff)||[]; var row=null; var k=norm(staff);
      for(var i=0;i<rows.length;i++){if(norm(rows[i].name)===k){row=rows[i];break;}}
      if(!row){box.innerHTML='--';box.removeAttribute('data-status');return;}
      box.setAttribute('data-status',row.linkStatus||'');
      var html='';
      if(row.active){
        var action=row.linkStatus==='revoked'?'open-link':'confirm-revoke-link';
        html='<button class="securityIconBtnV05422" data-v05422-action="'+action+'" data-active="1" data-status="'+esc(row.linkStatus)+'" data-staff="'+esc(row.name)+'" title="'+(row.linkStatus==='revoked'?'Generate a new portal link':'Revoke this portal/app link')+'">'+icon(row.linkStatus)+'</button>';
      }
      else{html='<span class="securityIconBtnV05422" title="Inactive staff cannot receive a new link">'+icon('revoked')+'</span>';}
      if(box.innerHTML!==html)box.innerHTML=html;
    });
  }
  window.gaV05423RenderAccessIcon=renderAccessIcon;
  function generateLettersDirect(btn){
    var status=by('staffQrStatusV05423');if(!status){status=document.createElement('div');status.id='staffQrStatusV05423';status.className='staffQrStatusV05423';btn.parentNode&&btn.parentNode.appendChild(status);} 
    btn.disabled=true;var old=btn.textContent;btn.textContent='Generating...';status.textContent='Generating staff letters...';status.className='staffQrStatusV05423';
    fetch('/api/v05419/staff-portal-letters/generate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({school:selectedSchoolId()})})
      .then(function(r){if(!r.ok)return r.json().catch(function(){return {};}).then(function(j){throw new Error(j.error||('HTTP '+r.status));});return r.blob();})
      .then(function(blob){var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='Staff QR Letters.pdf';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);status.textContent='Staff letters generated.';status.className='staffQrStatusV05423 ok';setMsg('Staff letters generated.','ok');try{if(window.gaV05422LoadSecurityManager)window.gaV05422LoadSecurityManager(true);}catch(e){}})
      .catch(function(e){status.textContent='Could not generate staff letters: '+e.message;status.className='staffQrStatusV05423 err';setMsg(status.textContent,'err');})
      .finally(function(){btn.disabled=false;btn.textContent=old||'Generate Staff Letters';});
  }
  function relabel(){
    document.querySelectorAll('[data-action="staff-qr-letter-open"]').forEach(function(b){b.textContent='Generate Staff Letters';});
    document.querySelectorAll('#staffQrLetterToolsV5317 .helpDot').forEach(function(h){h.setAttribute('data-tip','Generate a highly styled, print-ready PDF for the currently selected school. Each active staff member gets one page with personal Staff Portal and app-pairing QR codes.');});
  }
  var scheduled=false;
  function schedule(force,delay){
    if(force){cache=null;cacheAt=0;lastRenderedKey='';}
    if(scheduled)return;scheduled=true;
    setTimeout(function(){scheduled=false;try{relabel();hideOrphanEmailOnStaffList();renderAccessIcon(force);hideOrphanEmailOnStaffList();}catch(e){try{console.warn('v05423 staff access patch failed',e);}catch(x){}}},delay==null?120:delay);
  }
  document.addEventListener('click',function(e){var f=e.target&&e.target.closest&&e.target.closest('#staffAppPushStatusV0545,#staffAppPushStatusV05418Y,[data-staff-app-paired],.staffAppPushStatusV05418Y');if(!f)return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();return false;},true);
  window.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('[data-action="staff-qr-letter-open"]');if(!t)return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();generateLettersDirect(t);return false;},true);
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest&&e.target.closest('[data-nav="staff"],#staffList button,.staffList button,[data-staff-index],[data-v05422-action]');
    if(t){var a=t.getAttribute&&t.getAttribute('data-v05422-action');schedule(!!a, a?650:220);}
  },true);
  document.addEventListener('change',function(e){if(e.target&&(e.target.id==='staffName'||e.target.id==='campusSelector'))schedule(true,100);},true);
  document.addEventListener('input',function(e){if(e.target&&e.target.id==='staffName')schedule(true,120);},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule(true,80);});else schedule(true,80);
})();

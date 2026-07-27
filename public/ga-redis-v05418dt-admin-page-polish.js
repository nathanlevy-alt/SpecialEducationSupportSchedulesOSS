/* Support Schedules v05418dt: Agency Manager title/header polish and Security label fallback. */
(function(){
  'use strict';
  if(window.__GA_V05418DT_ADMIN_POLISH__) return;
  window.__GA_V05418DT_ADMIN_POLISH__ = true;
  function by(id){return document.getElementById(id);}
  function activePage(){try{if(typeof window.activeSectionIdV51229==='function')return window.activeSectionIdV51229()||'';}catch(e){}var s=document.querySelector('.section.active');return s?s.id:'';}
  function setAgencyTitle(){
    var page=activePage();
    var sec=by('agencyManager');
    var visible=sec && sec.classList && sec.classList.contains('active');
    if(page==='agencyManager' || visible){
      var pt=by('pageTitle');
      if(pt && String(pt.textContent||'').trim()!=='Agency Manager') pt.textContent='Agency Manager';
      document.title='Agency Manager - Support Schedules';
      try{document.querySelectorAll('#agencyManager .managerTitleRow h2').forEach(function(h){h.remove();});}catch(e){}
    }
  }
  function fixSecurityLabels(){
    try{
      document.querySelectorAll('.securityTableV05422 th').forEach(function(th){
        if(String(th.textContent||'').trim()==='Portal / App Access') th.textContent='Portal / App Access via QR';
      });
      document.querySelectorAll('.securityStatLabelV05422').forEach(function(el){
        var txt=String(el.childNodes && el.childNodes[0] ? el.childNodes[0].nodeValue || '' : '').trim();
        if(txt==='Portal / App Access') el.childNodes[0].nodeValue='Portal / App Access via QR ';
      });
    }catch(e){}
  }
  document.addEventListener('click',function(e){
    var t=e.target && e.target.closest && e.target.closest('[data-nav="agencyManager"],[data-nav="securityManager"]');
    if(!t) return;
    setTimeout(function(){setAgencyTitle();fixSecurityLabels();},40);
    setTimeout(function(){setAgencyTitle();fixSecurityLabels();},240);
  },true);
  try{if(typeof window.registerNavigationAfterHookV5_==='function')window.registerNavigationAfterHookV5_(function(page){if(page==='agencyManager')setTimeout(setAgencyTitle,40); if(page==='securityManager')setTimeout(fixSecurityLabels,120);},'v05418dtAdminPolish');}catch(e){}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){setAgencyTitle();fixSecurityLabels();},80);});
  else setTimeout(function(){setAgencyTitle();fixSecurityLabels();},80);
  window.gaV05418DTAdminPolish=function(){setAgencyTitle();fixSecurityLabels();return {version:'v05418dt',activePage:activePage(),title:(by('pageTitle')||{}).textContent||'',agencyActive:!!(by('agencyManager')&&by('agencyManager').classList.contains('active'))};};
})();

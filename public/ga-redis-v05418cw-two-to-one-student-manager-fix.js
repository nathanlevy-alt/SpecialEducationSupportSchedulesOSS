(function(){
  if(window.__SUPPORT_SCHEDULES_V05418CW_TWO_TO_ONE_FIX__) return;
  window.__SUPPORT_SCHEDULES_V05418CW_TWO_TO_ONE_FIX__ = true;
  var VERSION = '0.54.18de';
  function disconnectLegacyObserver(){
    try{ if(window.__V05418Z_ADV_OBSERVER__ && window.__V05418Z_ADV_OBSERVER__.disconnect) window.__V05418Z_ADV_OBSERVER__.disconnect(); }catch(e){}
    try{ window.__V05418Z_ADV_OBSERVER__ = null; }catch(e){}
  }
  function markDirty(){ try{ if(typeof window.markProfileDirtyV51229 === 'function') window.markProfileDirtyV51229('student'); else if(typeof window.markDirty === 'function') window.markDirty(); }catch(e){} }
  function sync(){
    disconnectLegacyObserver();
    try{ document.querySelectorAll('#studentPeriodRows .twoToOneSecondStaffRowV05418X').forEach(function(el){ el.remove(); }); }catch(e){}
    try{ if(typeof window.syncTwoToOneRowsV05418AQ === 'function') window.syncTwoToOneRowsV05418AQ(); }catch(e){}
  }
  document.addEventListener('change', function(e){
    var t = e.target;
    if(!t || !t.classList) return;
    if(t.classList.contains('studentSupport')) setTimeout(sync, 10);
    if(t.classList.contains('studentPrimary2') || t.classList.contains('studentSecondary2')){
      try{ if(typeof window.syncTwoToOneRowsV05418AQ === 'function') window.syncTwoToOneRowsV05418AQ(); }catch(e){}
      markDirty();
    }
  }, true);
  document.addEventListener('DOMContentLoaded', function(){ disconnectLegacyObserver(); setTimeout(sync, 250); });
  if(document.readyState !== 'loading'){ disconnectLegacyObserver(); setTimeout(sync, 250); }
})();

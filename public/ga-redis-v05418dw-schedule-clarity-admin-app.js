(function(){
  if(window.__v05418DWScheduleClarityInstalled)return;
  window.__v05418DWScheduleClarityInstalled=true;
  var VERSION='v05418dw';
  function clean(v){return String(v==null?'':v).trim();}
  function norm(v){return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function fmtMinutes(m){m=Number(m);if(!isFinite(m))return'';var h=Math.floor(m/60),mi=m%60,ap=h>=12?'PM':'AM',hh=h%12;if(!hh)hh=12;return hh+':'+String(mi).padStart(2,'0')+' '+ap;}
  function splitLabel(row){
    row=row||{};
    var cap=clean(row.splitWindowCaption||row.splitCaption||'');
    var raw=clean(row.splitWindowLabel||row.splitLabel||row.splitTimeLabel||row.splitTime||row.splitWindow||row.supportWindow||row.timeWindow||'');
    if(cap&&raw)return cap+' · '+raw;
    if(cap)return cap;
    if(raw && raw!=='-' && raw!=='(-)')return raw;
    var s=row.splitStartMinutes!=null&&row.splitStartMinutes!==''?Number(row.splitStartMinutes):null;
    var e=row.splitEndMinutes!=null&&row.splitEndMinutes!==''?Number(row.splitEndMinutes):null;
    var a=Number.isFinite(s)?fmtMinutes(s):'', b=Number.isFinite(e)?fmtMinutes(e):'';
    if(a&&b)return a+' - '+b;
    if(b)return 'Until '+b;
    if(a)return 'After '+a;
    return '';
  }
  function supportLabel(row){row=row||{};var raw=clean(row.support||row.supportType||row.supportRaw||'');if(/2\s*:\s*1/i.test(raw))raw='2:1 Support';raw=raw.replace(/\s*-\s*(first|second)\s+staff\s*$/i,'').replace(/\s*\(\s*split-period\s*\)\s*/ig,'').trim();var sp=splitLabel(row);if(sp&&raw&&!/\([^)]*(?:until|after|\d{1,2}:\d{2})/i.test(raw))raw+=' ('+sp+')';return raw;}
  function baseStudent(v){return clean(v).replace(/\s*\(\s*2\s*:\s*1\s+support\s*\)\s*$/i,'').trim();}
  function studentLabel(st){st=st||{};var label=baseStudent(st.baseName||st.displayName||st.student||st.name||'');var sp=splitLabel(st);if(sp)label+=' ('+sp+')';if(st.isTwoToOne||st.twoToOneSupport||/2\s*:\s*1/i.test(clean(st.support||st.name||'')))label+=' (2:1 support)';return label;}
  function splitNames(v){return clean(v).split(/\s*\/\s*|\s*,\s*/).map(clean).filter(Boolean);}
  function unique(arr,v){v=clean(v);if(v&&!arr.some(function(x){return norm(x)===norm(v);})){arr.push(v);}}
  function staffNames(row){row=row||{};var arr=[];(Array.isArray(row.twoToOneStaffNames)?row.twoToOneStaffNames:[]).forEach(function(v){splitNames(v).forEach(function(x){unique(arr,x);});});['staff','staff2','secondStaff','primary2','secondary2'].forEach(function(k){splitNames(row[k]).forEach(function(x){unique(arr,x);});});return arr;}
  function patchRenderNow(){
    var old=window.renderScheduleNow;
    window.renderScheduleNow=function(){
      var d=window.scheduleNowData||((typeof scheduleNowData!=='undefined')?scheduleNowData:null)||{};
      var noCurrent=(!d.item&&!d.itemTitle)||((d.staffRows||[]).length===0&&(d.studentRows||[]).length===0)||/outside|no current|not in/i.test(clean(d.status||d.unavailableReason||''));
      if(noCurrent){var el=document.getElementById('scheduleNowBox');if(el){var t=document.getElementById('scheduleNowTitle');if(t)t.innerHTML='<span class="nowLabel">Now:</span> <span class="nowItem">No active schedule block</span>';el.innerHTML='<div class="muted">No published schedule is currently active.</div>';return;}}
      if(typeof old==='function')return old.apply(this,arguments);
    };
    try{renderScheduleNow=window.renderScheduleNow;}catch(e){}
  }
  function patchStudentCell(){
    try{
      if(typeof window.studentCellHtmlV686m13_==='function'){
        window.studentCellHtmlV686m13_=function(r){r=r||{};var names=staffNames(r), support=supportLabel(r), loc=clean(r.location||'');var noSupport=!support||/^(n\/?a|na|none|no support needed)$/i.test(support);var noLoc=!loc||/^(n\/?a|na)$/i.test(loc);var hasNeed=!noSupport&&!noLoc;var top=names.length?esc(names.join(' / ')):(r.allowedUnstaffed?'<span class="scheduleNoNeed">Allowed unstaffed</span>':(hasNeed?'<span class="scheduleNeed">Needs support - unassigned</span>':'<span class="scheduleNoNeed">No support needed</span>'));var meta=[];if(!noLoc)meta.push(loc);if(!noSupport)meta.push(support);return top+(meta.length?'<div class="dashMeta">'+esc(meta.join(' · '))+'</div>':'');};
        try{studentCellHtmlV686m13_=window.studentCellHtmlV686m13_;}catch(e){}
      }
    }catch(e){}
  }
  patchRenderNow();patchStudentCell();
  window.gaV05418DWScheduleDisplayDiag=function(){return{version:VERSION,now:window.scheduleNowData||null};};
})();

/* Support Schedules v05418free: Staff Free Time Assignment.
   Adds Assign/Confirm actions to the dashboard's Staff Free Time tile (mirroring the
   existing Why? pattern on Unassigned Assignments), a window-splitting Assign modal
   supporting Support/Overlap/Comp Time/Other, and a Planning Tools page for a whole-day,
   all-staff view. One-time assignments only (no recurring rules yet) -- see conversation
   notes for the fuller design and what's deferred. */
(function(){
  'use strict';
  if(window.__GA_V05418FREE__) return;
  window.__GA_V05418FREE__ = true;

  function callServer(name,args,ok,fail){
    args=args||[];
    try{if(typeof window.callServer==='function')return window.callServer(name,args,ok,fail);}catch(e0){}
    try{
      if(!window.google||!google.script||!google.script.run)throw new Error('google.script.run unavailable');
      var r=google.script.run.withSuccessHandler(function(v){if(ok)ok(v);}).withFailureHandler(function(e){if(fail)fail(e);});
      return r[name].apply(r,args);
    }catch(e){ if(fail)fail(e); }
  }

  function setMsg(msg,type){try{if(typeof window.setMsg==='function')return window.setMsg(msg,type||'warn');}catch(e){}}

  function invalidateAndRefreshScheduleDisplaysV05418Free(){
    freeTimeAssignedCacheV05418Free=null;
    try{if(typeof window.invalidateScheduleHtmlCacheV686f==='function')window.invalidateScheduleHtmlCacheV686f();}catch(e){}
    try{if(typeof window.renderScheduleViews==='function')window.renderScheduleViews();}catch(e2){}
    try{if(typeof window.renderStaffSchedules==='function')window.renderStaffSchedules();}catch(e4){}
  }

  function by(id){return document.getElementById(id);}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c;});}
  function clean(v){return String(v==null?'':v).trim();}

  function formatMinuteV05418Free(m){
    m=Number(m)||0; var h=Math.floor(m/60), mm=m%60, ap=h>=12?'PM':'AM', hh=h%12; if(hh===0)hh=12;
    return hh+':'+String(mm).padStart(2,'0')+' '+ap;
  }
  function formatMinuteRangeV05418Free(s,e){return formatMinuteV05418Free(s)+' - '+formatMinuteV05418Free(e);}

  var SOURCE_LABELS = {unassigned:'No support need scheduled', 'split-period':'Split-period support window', 'reduced-need':'Reduced/partial support need'};
  var TYPE_LABELS = {support:'Support', overlap:'Overlap', 'comp-time':'Comp Time', other:'Other', 'confirmed-default':'Support (confirmed)'};

  function currentUnassignedLocation(){
    try{ if(typeof window.unassignedSupportLocation==='function') return window.unassignedSupportLocation()||''; }catch(e){}
    try{ return (window.scheduleViewsData&&window.scheduleViewsData.unassignedSupportLocation)||(window.campusData&&window.campusData.unassignedSupportLocation)||''; }catch(e2){ return ''; }
  }

  // ---- Dashboard tile row ----
  // ---- Dashboard tile: one row per staff (aggregated), not one row per window. The
  // modal already shows every window separately once Assign is clicked -- this tile is
  // just "who has free time today and how much," matching the density of the other
  // dashboard tiles (Unassigned Assignments, etc).
  window.aggregateFreeTimeByStaffV05418Free = function(rows){
    var byStaff={}, order=[];
    (rows||[]).forEach(function(r){
      if(!r||!r.staff)return;
      if(!byStaff[r.staff]){byStaff[r.staff]={staff:r.staff,minutes:0,hasUnassigned:false}; order.push(r.staff);}
      byStaff[r.staff].minutes+=Number(r.minutes)||0;
      if(r.source==='unassigned')byStaff[r.staff].hasUnassigned=true;
    });
    return order.map(function(s){return byStaff[s];});
  }
  window.renderFreeTimeStaffRowV05418Free = function(r){
    r=r||{};
    var assignBtn='<button class="btn small" data-action="free-time-assign" data-staff="'+esc(r.staff)+'" style="flex:0 0 auto">Assign</button>';
    return '<div class="dashItem dashGood" style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
      +'<div style="min-width:0"><strong>'+esc(r.staff)+'</strong><span class="dashMeta"> &middot; '+esc(r.minutes)+' min free today</span></div>'
      +assignBtn
      +'</div>';
  };
  window.renderFreeTimeRowV05418Free = function(r){
    r=r||{};
    var timeLabel=formatMinuteRangeV05418Free(r.startMinutes,r.endMinutes);
    var sourceLabel=SOURCE_LABELS[r.source]||'';
    var confirmBtn = r.source==='unassigned'
      ? '<button class="btn small" data-action="free-time-confirm-default" data-staff="'+esc(r.staff)+'" data-period="'+esc(r.period)+'" data-start="'+esc(r.startMinutes)+'" data-end="'+esc(r.endMinutes)+'" style="flex:0 0 auto">Confirm</button>'
      : '';
    var assignBtn='<button class="btn small" data-action="free-time-assign" data-staff="'+esc(r.staff)+'" data-period="'+esc(r.period)+'" data-period-display="'+esc(r.periodDisplay||r.period)+'" data-start="'+esc(r.startMinutes)+'" data-end="'+esc(r.endMinutes)+'" style="flex:0 0 auto">Assign</button>';
    return '<div class="dashItem dashGood" style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
      +'<div style="min-width:0"><strong>'+esc(r.staff)+'</strong><div class="dashMeta">'+esc(r.periodDisplay||r.period)+' · '+esc(timeLabel)+' · '+esc(r.minutes)+' min'+(sourceLabel?' · '+esc(sourceLabel):'')+'</div></div>'
      +'<div style="display:flex;gap:6px;flex:0 0 auto">'+confirmBtn+assignBtn+'</div>'
      +'</div>';
  };

  // ---- Styles ----
  function installStyles(){
    if(by('gaV05418FreeStyles'))return;
    var css=''
      +'.v05418FreeModalBackdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:none;align-items:center;justify-content:center;z-index:220;padding:16px}'
      +'.v05418FreeModalBackdrop.open{display:flex}'
      +'.v05418FreeModalPanel{width:min(560px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 20px 50px rgba(15,23,42,.25)}'
      +'.v05418FreeModalHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}'
      +'.v05418FreeSubhead{color:#64748b;font-size:13px;margin:0 0 14px}'
      +'.v05418FreeGroup{border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:14px}'
      +'.v05418FreeGroupHead{font-weight:800;font-size:13px;color:#0f172a;margin-bottom:10px}'
      +'.v05418FreeSegment{border:1px solid #dbe3ef;border-radius:12px;padding:12px;margin-bottom:10px;background:#f8fafc}'
      +'.v05418FreeSegRow{display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap}'
      +'.v05418FreeSegRow select,.v05418FreeSegRow input{height:34px;border:1px solid #dbe3ef;border-radius:8px;padding:0 8px;font-size:13px}'
      +'.v05418FreeSegRow .v05418FreeDetail{flex:1;min-width:160px}'
      +'.v05418FreeTimeInput{width:74px}'
      +'.v05418FreeRemoveSeg{border:0;background:transparent;color:#dc2626;font-size:12px;font-weight:700;cursor:pointer;margin-left:auto}'
      +'.v05418FreeRemaining{font-size:12px;color:#64748b;margin:6px 0 12px}'
      +'.v05418FreeRemaining.over{color:#dc2626;font-weight:700}'
      +'.v05418FreePlanTable{width:100%;border-collapse:collapse;margin-top:12px}'
      +'.v05418FreePlanTable th,.v05418FreePlanTable td{border-bottom:1px solid #eef2f7;padding:8px;text-align:left;font-size:13px;vertical-align:middle}'
      +'.v05418FreePlanTable th{font-size:11px;color:#64748b;background:#f8fafc;text-transform:uppercase;letter-spacing:.03em}'
      +'.v05418FreeAssignedPill{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:#EAF7F1;color:#0F8A69}'
      +'.v05418FreeCompPill{background:#f1f5f9;color:#475569}';
    var style=document.createElement('style'); style.id='gaV05418FreeStyles'; style.textContent=css; document.head.appendChild(style);
  }

  // ---- Assign modal ----
  // pendingGroups: one entry per DISTINCT free window for the staff member the Assign
  // modal was opened for -- not just the single row that was clicked. A staff member with
  // free time in two different periods sees two independently-manageable sections, each
  // of which can still be sub-divided into its own segments.
  var pendingGroups=[]; // [{window:{staff,period,periodDisplay,start,end}, segments:[{start,end,type,detail}]}]
  var lastFreeRowsV05418Free=[]; // most recent full free-time row list, from whichever surface last rendered (dashboard tile or Planning Tools page)
  var locationsCache=[], staffCache=[];

  function refreshOptionCaches(){
    try{
      if(window.dashboardSummary){
        if(Array.isArray(window.dashboardSummary.freeTimeLocations)) locationsCache=window.dashboardSummary.freeTimeLocations;
        if(Array.isArray(window.dashboardSummary.freeTimeActiveStaff)) staffCache=window.dashboardSummary.freeTimeActiveStaff;
      }
    }catch(e){}
  }

  function ensureModal(){
    if(by('v05418FreeAssignModal'))return;
    installStyles();
    var m=document.createElement('div'); m.id='v05418FreeAssignModal'; m.className='v05418FreeModalBackdrop';
    m.innerHTML='<div class="v05418FreeModalPanel">'
      +'<div class="v05418FreeModalHead"><h2 style="margin:0;font-size:16px" id="v05418FreeModalTitle">Assign Free Time</h2><button class="btn" data-action="free-time-close">Close</button></div>'
      +'<p class="v05418FreeSubhead" id="v05418FreeModalSub"></p>'
      +'<div id="v05418FreeGroups"></div>'
      +'<div class="toolbar"><button class="btn primary" data-action="free-time-save">Save Assignment(s)</button></div>'
      +'<div id="v05418FreeModalMsg" class="muted" style="font-size:12px;margin-top:8px"></div>'
      +'</div>';
    document.body.appendChild(m);
  }

  function detailFieldHtml(seg,gIdx,idx,windowStaff,helpers){
    if(seg.type==='support'){
      var blockedSet={}; (helpers&&helpers.blockedRooms||[]).forEach(function(l){blockedSet[l]=true;});
      var normalLocs=locationsCache.filter(function(l){return !blockedSet[l];});
      var blockedLocs=locationsCache.filter(function(l){return blockedSet[l];});
      function locOption(l){return '<option value="'+esc(l)+'"'+(seg.detail===l?' selected':'')+'>'+esc(l)+'</option>';}
      var opts='<option value="">Choose a location...</option>'+normalLocs.map(locOption).join('');
      if(blockedLocs.length)opts+='<optgroup label="Blocked Room(s)">'+blockedLocs.map(locOption).join('')+'</optgroup>';
      return '<select class="v05418FreeDetail" data-group="'+gIdx+'" data-seg="'+idx+'" data-field="detail">'+opts+'</select>';
    }
    if(seg.type==='overlap'){
      var candidates=(helpers&&helpers.overlapCandidates&&helpers.overlapCandidates.length)?helpers.overlapCandidates.filter(function(c){return c.name!==windowStaff;}):staffCache.filter(function(s){return s!==windowStaff;}).map(function(s){return {name:s,supportingBlockedStudent:false};});
      var normalStaff=candidates.filter(function(c){return !c.supportingBlockedStudent;});
      var blockedStaff=candidates.filter(function(c){return c.supportingBlockedStudent;});
      function staffOption(c){return '<option value="'+esc(c.name)+'"'+(seg.detail===c.name?' selected':'')+'>'+esc(c.name)+'</option>';}
      var opts2='<option value="">Choose staff...</option>'+normalStaff.map(staffOption).join('');
      if(blockedStaff.length)opts2+='<optgroup label="Supporting Blocked Student(s)">'+blockedStaff.map(staffOption).join('')+'</optgroup>';
      return '<select class="v05418FreeDetail" data-group="'+gIdx+'" data-seg="'+idx+'" data-field="detail">'+opts2+'</select>';
    }
    if(seg.type==='other'){
      return '<input type="text" class="v05418FreeDetail" data-group="'+gIdx+'" data-seg="'+idx+'" data-field="detail" placeholder="Describe..." value="'+esc(seg.detail||'')+'">';
    }
    return ''; // comp-time needs no detail
  }

  function renderGroups(){
    var box=by('v05418FreeGroups'); if(!box)return;
    box.innerHTML=pendingGroups.map(function(g,gIdx){
      var segsHtml=g.segments.map(function(seg,idx){
        return '<div class="v05418FreeSegment">'
          +'<div class="v05418FreeSegRow">'
            +'<input type="text" class="v05418FreeTimeInput" data-group="'+gIdx+'" data-seg="'+idx+'" data-field="start" value="'+esc(formatMinuteV05418Free(seg.start))+'" title="Start time">'
            +'<span>&ndash;</span>'
            +'<input type="text" class="v05418FreeTimeInput" data-group="'+gIdx+'" data-seg="'+idx+'" data-field="end" value="'+esc(formatMinuteV05418Free(seg.end))+'" title="End time">'
            +'<select data-group="'+gIdx+'" data-seg="'+idx+'" data-field="type">'
              +['support','overlap','comp-time','other'].map(function(t){return '<option value="'+t+'"'+(seg.type===t?' selected':'')+'>'+TYPE_LABELS[t]+'</option>';}).join('')
            +'</select>'
            +detailFieldHtml(seg,gIdx,idx,g.window.staff,g.helpers)
            +(g.segments.length>1?'<button class="attendanceTinyAction trash" style="margin-left:auto" title="Remove segment" aria-label="Remove segment" data-action="free-time-remove-segment" data-group="'+gIdx+'" data-seg="'+idx+'"><i class="fa fa-trash" aria-hidden="true"></i></button>':'')
          +'</div>'
        +'</div>';
      }).join('');
      var confirmBtn=g.window.source==='unassigned'
        ?'<button class="btn small" data-action="free-time-confirm-default" data-group="'+gIdx+'">Confirm default Support</button>'
        :'';
      return '<div class="v05418FreeGroup">'
        +'<div class="v05418FreeGroupHead">'+esc(g.window.periodDisplay||g.window.period)+' &middot; '+esc(formatMinuteRangeV05418Free(g.window.start,g.window.end))+' free '+confirmBtn+'</div>'
        +segsHtml
        +'<div class="v05418FreeRemaining" data-group-remaining="'+gIdx+'"></div>'
        +'<button class="btn small" data-action="free-time-add-segment" data-group="'+gIdx+'">+ Add segment to this window</button>'
      +'</div>';
    }).join('');
    pendingGroups.forEach(function(g,gIdx){ renderRemaining(gIdx); });
  }

  function parseTimeToMinutes(text){
    text=clean(text);
    var m=text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
    if(!m)return null;
    var h=Number(m[1]), mm=Number(m[2]), ap=(m[3]||'').toUpperCase();
    if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0;
    return h*60+mm;
  }

  function renderRemaining(gIdx){
    var g=pendingGroups[gIdx]; if(!g)return;
    var el=document.querySelector('[data-group-remaining="'+gIdx+'"]'); if(!el)return;
    var covered=g.segments.reduce(function(sum,s){return sum+Math.max(0,(s.end-s.start));},0);
    var total=g.window.end-g.window.start;
    var remaining=total-covered;
    if(remaining<0){el.textContent='Segments exceed this window by '+Math.abs(remaining)+' minute(s). Adjust before saving.';el.className='v05418FreeRemaining over';}
    else if(remaining>0){el.textContent=remaining+' minute(s) of this window are not yet assigned to a segment.';el.className='v05418FreeRemaining';}
    else{el.textContent='Full window assigned.';el.className='v05418FreeRemaining';}
  }

  // Gathers every distinct free window for one staff member from whichever surface most
  // recently rendered them, so the modal can show all of that staff member's free time
  // today, not just the single row that was clicked.
  function allFreeWindowsForStaff(staffName){
    var source=lastFreeRowsV05418Free.length?lastFreeRowsV05418Free:((window.dashboardSummary&&window.dashboardSummary.freeTime)||[]);
    return (source||[]).filter(function(r){return r.staff===staffName;});
  }

  var assignHelpersCacheV05418Free={}; // period -> {blockedRooms:[...], overlapCandidates:[...]}
  function fetchAssignHelpersForGroup(gIdx){
    var g=pendingGroups[gIdx]; if(!g)return;
    var period=g.window.period;
    if(assignHelpersCacheV05418Free[period]){ g.helpers=assignHelpersCacheV05418Free[period]; renderGroups(); return; }
    callServer('getFreeTimeAssignHelpersV05418Free',[{staff:g.window.staff,period:period}],function(resp){
      var helpers=(resp&&resp.ok)?{blockedRooms:resp.blockedRooms||[],overlapCandidates:resp.overlapCandidates||[]}:{blockedRooms:[],overlapCandidates:[]};
      assignHelpersCacheV05418Free[period]=helpers;
      pendingGroups.forEach(function(gr){ if(gr.window.period===period) gr.helpers=helpers; });
      renderGroups();
    },function(e){ try{console.error('getFreeTimeAssignHelpersV05418Free failed:',e);}catch(e2){} });
  }

  function openAssignModal(staff){
    refreshOptionCaches();
    var windows=allFreeWindowsForStaff(staff);
    if(!windows.length){
      setMsg('Could not find current free time windows for '+staff+'. Try refreshing the page first.','err');
      return;
    }
    assignHelpersCacheV05418Free={};
    pendingGroups=windows.map(function(w){
      return {
        window:{staff:w.staff,period:w.period,periodDisplay:w.periodDisplay||w.period,start:Number(w.startMinutes),end:Number(w.endMinutes),source:w.source},
        segments:[{start:Number(w.startMinutes),end:Number(w.endMinutes),type:'support',detail:currentUnassignedLocation()}]
      };
    });
    ensureModal();
    by('v05418FreeModalTitle').textContent='Assign Free Time';
    by('v05418FreeModalSub').textContent=staff+' \u00b7 '+pendingGroups.length+' free window'+(pendingGroups.length===1?'':'s')+' today';
    by('v05418FreeModalMsg').textContent='';
    renderGroups();
    by('v05418FreeAssignModal').classList.add('open');
    pendingGroups.forEach(function(g,gIdx){ fetchAssignHelpersForGroup(gIdx); });
  }

  function addSegment(gIdx){
    var g=pendingGroups[gIdx]; if(!g||!g.segments.length)return;
    var last=g.segments[g.segments.length-1];
    if(last.end>=g.window.end){by('v05418FreeModalMsg').textContent='This window is fully covered. Shorten the last segment\u2019s end time first to leave room for another.';return;}
    g.segments.push({start:last.end,end:g.window.end,type:'support',detail:currentUnassignedLocation()});
    renderGroups();
  }
  function removeSegment(gIdx,idx){
    var g=pendingGroups[gIdx]; if(!g)return;
    g.segments.splice(idx,1);
    if(!g.segments.length)g.segments.push({start:g.window.start,end:g.window.end,type:'support',detail:''});
    renderGroups();
  }

  function saveSegments(){
    var msg=by('v05418FreeModalMsg');
    var flatCalls=[];
    for(var gi=0;gi<pendingGroups.length;gi++){
      var g=pendingGroups[gi];
      for(var i=0;i<g.segments.length;i++){
        var s=g.segments[i];
        if(s.end<=s.start){msg.textContent='Each segment needs an end time after its start time.';return;}
        if(s.start<g.window.start||s.end>g.window.end){msg.textContent='Segments must stay within their free window ('+formatMinuteRangeV05418Free(g.window.start,g.window.end)+').';return;}
        if((s.type==='support'||s.type==='overlap')&&!clean(s.detail)){msg.textContent='Choose a '+(s.type==='support'?'location':'staff member')+' for the '+TYPE_LABELS[s.type]+' segment.';return;}
        if(s.type==='other'&&!clean(s.detail)){msg.textContent='Describe the "Other" segment before saving.';return;}
      }
      for(var j=0;j<g.segments.length-1;j++){ if(g.segments[j].end>g.segments[j+1].start){ msg.textContent='Segments overlap in one of the windows -- adjust times before saving.'; return; } }
      g.segments.forEach(function(s){ flatCalls.push({staff:g.window.staff,period:g.window.period,startMinutes:s.start,endMinutes:s.end,type:s.type,detail:s.detail||''}); });
    }
    msg.textContent='Saving...';
    var staffLabel=pendingGroups.length?pendingGroups[0].window.staff:'';
    var calls=flatCalls.map(function(payload){
      return new Promise(function(resolve,reject){
        callServer('saveFreeTimeAssignmentV05418Free',[payload],function(r){resolve(r);},function(e){reject(e);});
      });
    });
    Promise.all(calls).then(function(){
      by('v05418FreeAssignModal').classList.remove('open');
      setMsg('Free time assignment saved for '+staffLabel+'.','ok');
      if(typeof loadDashboardSummary==='function')loadDashboardSummary({refresh:true});
      invalidateAndRefreshScheduleDisplaysV05418Free();
      refreshPlanningPageIfActive();
    }).catch(function(e){
      msg.textContent='Could not save: '+((e&&e.message)||e);
    });
  }
  function confirmDefault(staff,period,start,end){
    var loc=currentUnassignedLocation();
    callServer('confirmDefaultFreeTimeV05418Free',[{staff:staff,period:period,startMinutes:Number(start),endMinutes:Number(end),location:loc}],function(){
      setMsg('Confirmed Support'+(loc?' '+loc:'')+' for '+staff+'.','ok');
      if(typeof loadDashboardSummary==='function')loadDashboardSummary({refresh:true});
      invalidateAndRefreshScheduleDisplaysV05418Free();
      refreshPlanningPageIfActive();
    },function(e){setMsg('Could not confirm: '+((e&&e.message)||e),'err');});
  }
  function confirmDefaultFromGroup(gIdx){
    var g=pendingGroups[gIdx]; if(!g)return;
    var loc=currentUnassignedLocation();
    callServer('confirmDefaultFreeTimeV05418Free',[{staff:g.window.staff,period:g.window.period,startMinutes:g.window.start,endMinutes:g.window.end,location:loc}],function(){
      pendingGroups.splice(gIdx,1);
      if(!pendingGroups.length){
        by('v05418FreeAssignModal').classList.remove('open');
      } else {
        renderGroups();
      }
      setMsg('Confirmed Support'+(loc?' '+loc:'')+' for '+g.window.staff+'.','ok');
      if(typeof loadDashboardSummary==='function')loadDashboardSummary({refresh:true});
      invalidateAndRefreshScheduleDisplaysV05418Free();
      refreshPlanningPageIfActive();
    },function(e){by('v05418FreeModalMsg').textContent='Could not confirm: '+((e&&e.message)||e);});
  }

  function removeAssignment(id,staffLabel){
    var doRemove=function(){
      callServer('deleteFreeTimeAssignmentV05418Free',[id],function(){
        setMsg('Removed free time assignment'+(staffLabel?' for '+staffLabel:'')+'.','ok');
        if(typeof loadDashboardSummary==='function')loadDashboardSummary({refresh:true});
      invalidateAndRefreshScheduleDisplaysV05418Free();
        refreshPlanningPageIfActive();
      },function(e){setMsg('Could not remove: '+((e&&e.message)||e),'err');});
    };
    if(typeof showPortalConfirmV51231==='function')showPortalConfirmV51231({title:'Remove this assignment?',message:'This returns the time to the free-time pool.',okText:'Remove',danger:true,onOk:doRemove});
    else if(window.confirm('Remove this free time assignment?'))doRemove();
  }

  // ---- Planning Tools page ----
  function ensurePlanningSection(){
    var sec=by('freeTimePlanning');
    if(!sec){
      var main=document.querySelector('main')||document.body;
      sec=document.createElement('section'); sec.id='freeTimePlanning'; sec.className='section';
      sec.innerHTML='<div class="card">'
        +'<h3 style="margin:0 0 6px;font-size:14px">Still Free</h3>'
        +'<table class="v05418FreePlanTable"><thead><tr><th>Staff</th><th>Period</th><th>Time</th><th>Minutes</th><th>Source</th><th></th></tr></thead><tbody id="freeTimePlanningFreeBody"></tbody></table>'
        +'<h3 style="margin:20px 0 6px;font-size:14px">Assigned Today</h3>'
        +'<table class="v05418FreePlanTable"><thead><tr><th>Staff</th><th>Period</th><th>Time</th><th>Type</th><th>Detail</th><th></th></tr></thead><tbody id="freeTimePlanningAssignedBody"></tbody></table>'
        +'</div>';
      main.appendChild(sec);
    }
    var nav=document.querySelector('.nav');
    if(nav && !document.querySelector('[data-nav="freeTimePlanning"]')){
      var ref=document.querySelector('[data-nav="scheduleOptimizer"]');
      var btn=document.createElement('button'); btn.setAttribute('data-nav','freeTimePlanning'); btn.textContent='Free Time Assignment';
      if(ref&&ref.parentNode)ref.parentNode.insertBefore(btn,ref.nextSibling); else nav.appendChild(btn);
    }
  }

  function renderPlanningPage(data){
    refreshOptionCaches();
    if(Array.isArray(data.staffLocations))locationsCache=data.staffLocations;
    if(Array.isArray(data.activeStaff))staffCache=data.activeStaff;
    lastFreeRowsV05418Free=Array.isArray(data.free)?data.free:[];
    var freeBody=by('freeTimePlanningFreeBody');
    if(freeBody){
      var free=data.free||[];
      freeBody.innerHTML=free.length?free.map(function(r){
        return '<tr><td>'+esc(r.staff)+'</td><td>'+esc(r.periodDisplay||r.period)+'</td><td>'+esc(formatMinuteRangeV05418Free(r.startMinutes,r.endMinutes))+'</td><td>'+esc(r.minutes)+'</td><td>'+esc(SOURCE_LABELS[r.source]||r.source||'')+'</td><td><button class="btn small" data-action="free-time-assign" data-staff="'+esc(r.staff)+'" data-period="'+esc(r.period)+'" data-period-display="'+esc(r.periodDisplay||r.period)+'" data-start="'+esc(r.startMinutes)+'" data-end="'+esc(r.endMinutes)+'">Assign</button></td></tr>';
      }).join(''):'<tr><td colspan="6" class="muted">No free time remaining today.</td></tr>';
    }
    var assignedBody=by('freeTimePlanningAssignedBody');
    if(assignedBody){
      var assigned=data.assigned||[];
      assignedBody.innerHTML=assigned.length?assigned.map(function(a){
        var pillClass=a.type==='comp-time'?'v05418FreeAssignedPill v05418FreeCompPill':'v05418FreeAssignedPill';
        return '<tr><td>'+esc(a.staff)+'</td><td>'+esc(a.period)+'</td><td>'+esc(formatMinuteRangeV05418Free(a.startMinutes,a.endMinutes))+'</td><td><span class="'+pillClass+'">'+esc(TYPE_LABELS[a.type]||a.type)+'</span></td><td>'+esc(a.detail||'')+'</td><td><button class="attendanceTinyAction trash" title="Remove assignment" aria-label="Remove assignment" data-action="free-time-remove" data-id="'+esc(a.id)+'" data-staff="'+esc(a.staff)+'"><i class="fa fa-trash" aria-hidden="true"></i></button></td></tr>';
      }).join(''):'<tr><td colspan="6" class="muted">Nothing assigned yet today.</td></tr>';
    }
  }

  function loadPlanningPage(){
    ensurePlanningSection();
    callServer('getFreeTimeAssignmentPageDataV05418Free',[null],function(d){renderPlanningPage(d||{});},function(e){
      var fb=by('freeTimePlanningFreeBody'); if(fb)fb.innerHTML='<tr><td colspan="6" class="muted">Could not load: '+esc((e&&e.message)||e)+'</td></tr>';
    });
  }
  window.loadFreeTimeAssignmentPageV05418Free=loadPlanningPage;
  function refreshPlanningPageIfActive(){
    try{ var sec=by('freeTimePlanning'); if(sec&&sec.classList.contains('active'))loadPlanningPage(); }catch(e){}
  }

  // ---- Click dispatcher ----
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest?e.target.closest('[data-action],[data-nav]'):null; if(!t)return;
    var a=t.getAttribute('data-action')||'';
    if(a==='free-time-assign'){e.preventDefault();e.stopImmediatePropagation();openAssignModal(t.getAttribute('data-staff'));return false;}
    if(a==='free-time-confirm-default'){e.preventDefault();e.stopImmediatePropagation();if(t.hasAttribute('data-group'))confirmDefaultFromGroup(Number(t.getAttribute('data-group')));else confirmDefault(t.getAttribute('data-staff'),t.getAttribute('data-period'),t.getAttribute('data-start'),t.getAttribute('data-end'));return false;}
    if(a==='free-time-close'){e.preventDefault();e.stopImmediatePropagation();by('v05418FreeAssignModal').classList.remove('open');return false;}
    if(a==='free-time-add-segment'){e.preventDefault();e.stopImmediatePropagation();addSegment(Number(t.getAttribute('data-group')));return false;}
    if(a==='free-time-remove-segment'){e.preventDefault();e.stopImmediatePropagation();removeSegment(Number(t.getAttribute('data-group')),Number(t.getAttribute('data-seg')));return false;}
    if(a==='free-time-save'){e.preventDefault();e.stopImmediatePropagation();saveSegments();return false;}
    if(a==='free-time-remove'){e.preventDefault();e.stopImmediatePropagation();removeAssignment(t.getAttribute('data-id'),t.getAttribute('data-staff'));return false;}
    var nav=t.getAttribute('data-nav'); if(nav==='freeTimePlanning'){setTimeout(loadPlanningPage,80);}
  },true);

  document.addEventListener('change',function(e){
    var el=e.target; if(!el||!el.hasAttribute('data-seg')||!el.hasAttribute('data-group'))return;
    var gIdx=Number(el.getAttribute('data-group')), idx=Number(el.getAttribute('data-seg')), field=el.getAttribute('data-field');
    var g=pendingGroups[gIdx]; if(!g||!g.segments[idx])return;
    if(field==='type'){g.segments[idx].type=el.value; g.segments[idx].detail=el.value==='support'?currentUnassignedLocation():''; renderGroups(); return;}
    if(field==='detail'){g.segments[idx].detail=el.value; return;}
    if(field==='start'||field==='end'){
      var mins=parseTimeToMinutes(el.value);
      if(mins==null){el.value=formatMinuteV05418Free(g.segments[idx][field]); return;}
      g.segments[idx][field]=mins;
      renderRemaining(gIdx);
    }
  },true);

  // ---- Visibility threading: enhance the "free" cell display in schedule tables with any
  // persisted free-time assignment for that staff+period, instead of always showing the
  // generic "Support [default location]" fallback. Lazily loads today's assignments once
  // and caches them; a cell rendered before the fetch completes shows the generic text and
  // gets corrected on the next re-render once the fetch resolves.
  var freeTimeAssignedCacheV05418Free=null; // null = not yet loaded; array once loaded
  var freeTimeAssignedFetchInFlightV05418Free=false;
  function ensureFreeTimeAssignedCacheV05418Free(){
    if(freeTimeAssignedCacheV05418Free!==null||freeTimeAssignedFetchInFlightV05418Free)return;
    freeTimeAssignedFetchInFlightV05418Free=true;
    callServer('getFreeTimeAssignmentPageDataV05418Free',[null],function(d){
      freeTimeAssignedFetchInFlightV05418Free=false;
      freeTimeAssignedCacheV05418Free=(d&&Array.isArray(d.assigned))?d.assigned:[];
      try{if(typeof window.renderScheduleViews==='function')window.renderScheduleViews();}catch(e){}
      try{if(typeof window.renderStaffSchedules==='function')window.renderStaffSchedules();}catch(e2){}
    },function(){ freeTimeAssignedFetchInFlightV05418Free=false; freeTimeAssignedCacheV05418Free=[]; });
  }
  var FREE_TIME_TYPE_ICON = {overlap:'Overlap: ', 'comp-time':'Comp Time', other:'', support:'Support ', 'confirmed-default':'Support '};
  // Returns an HTML string for this staff+period cell if a persisted assignment exists,
  // or null if there's none (caller should fall back to its normal generic text). Admin
  // portal surfaces are all "admin view" per the visibility design, so every assignment
  // type (including Comp Time) displays normally here -- the admin-only/staff-only
  // Comp Time restriction applies to staff-facing surfaces (Staff Portal, mobile app),
  // not to any admin-portal table.
  window.freeTimeAssignmentCellHtmlV05418Free = function(staffName, periodKey){
    ensureFreeTimeAssignedCacheV05418Free();
    if(!freeTimeAssignedCacheV05418Free||!freeTimeAssignedCacheV05418Free.length)return null;
    var match=freeTimeAssignedCacheV05418Free.find(function(a){return a.staff===staffName&&a.period===periodKey;});
    if(!match)return null;
    var label=FREE_TIME_TYPE_ICON[match.type]!==undefined?FREE_TIME_TYPE_ICON[match.type]:'';
    var text=(label+(match.detail||'')).trim()||TYPE_LABELS[match.type]||match.type;
    return '<span class="empty">'+esc(text)+'</span>';
  };

  function boot(){ installStyles(); ensurePlanningSection(); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
})();

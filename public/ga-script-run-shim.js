(function(){
  function Runner(success, failure, scriptName, userObject){
    this._success = typeof success === 'function' ? success : function(){};
    this._failure = typeof failure === 'function' ? failure : function(err){ console.error(err); };
    this._scriptName = scriptName || 'admin';
    this._userObject = userObject;
  }

  function wrap(runner){
    return new Proxy(runner, {
      get: function(target, prop){
        if (prop in target) {
          var value = target[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        }
        return function(){
          call(target._scriptName, prop, Array.prototype.slice.call(arguments), target._success, target._failure, target._userObject);
        };
      }
    });
  }

  Runner.prototype.withSuccessHandler = function(fn){
    return wrap(new Runner(fn, this._failure, this._scriptName, this._userObject));
  };

  Runner.prototype.withFailureHandler = function(fn){
    return wrap(new Runner(this._success, fn, this._scriptName, this._userObject));
  };

  Runner.prototype.withUserObject = function(obj){
    return wrap(new Runner(this._success, this._failure, this._scriptName, obj));
  };

  Runner.prototype.script = function(name){
    return wrap(new Runner(this._success, this._failure, name || 'admin', this._userObject));
  };

  function clean_(v){ return String(v == null ? '' : v).trim(); }
  function lower_(v){ return clean_(v).toLowerCase(); }
  function ensureTabIdV05418DJ_(){
    var id = '';
    try { id = sessionStorage.getItem('gaSchedulerTabIdV05418DJ') || ''; } catch(e) {}
    if (!id) {
      id = 'tab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      try { sessionStorage.setItem('gaSchedulerTabIdV05418DJ', id); } catch(e2) {}
    }
    window.__gaSchedulerTabIdV05418DJ = id;
    return id;
  }
  function addSchoolFields_(out, school, name, spreadsheetId){
    school = clean_(school); name = clean_(name); spreadsheetId = clean_(spreadsheetId);
    if (school) out.school = out.schoolId = out.selectedCampusId = out.campusId = school;
    if (name) out.name = out.schoolName = out.selectedCampusName = out.campusName = name;
    if (spreadsheetId) out.spreadsheetId = out.selectedSpreadsheetId = spreadsheetId;
    return out;
  }
  function sessionSchool_(){
    var s = null;
    try { s = window.__schoolSessionV5450 || null; } catch(e) {}
    if (!s) {
      try { s = JSON.parse(sessionStorage.getItem('gaSchedulerSchoolSessionV5450') || 'null'); } catch(e2) { s = null; }
    }
    if (s && (s.campusId || s.schoolId || s.spreadsheetId)) {
      return addSchoolFields_({}, s.campusId || s.schoolId || s.school || '', s.campusName || s.schoolName || s.name || '', s.spreadsheetId || s.selectedSpreadsheetId || '');
    }
    return null;
  }
  function selectorSchool_(){
    try {
      var sel = document.getElementById('campusSelector') || document.querySelector('[data-campus-selector]') || document.querySelector('select[name="campus"]');
      if (!sel || !clean_(sel.value)) return null;
      var opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      var ss = opt ? (opt.getAttribute('data-spreadsheet-id') || opt.getAttribute('data-ss-id') || opt.getAttribute('data-sheet-id') || '') : '';
      var nm = opt ? (opt.getAttribute('data-campus-name') || opt.getAttribute('data-school-name') || opt.textContent || '') : '';
      return addSchoolFields_({}, sel.value, nm, ss);
    } catch(e) { return null; }
  }
  function contextSchool_(preferredId){
    try {
      var ctx = window.campusContextV5253 || window.campusContext || window.selectedCampusContext || null;
      if (!ctx || typeof ctx !== 'object') return null;
      var list = Array.isArray(ctx.campuses) ? ctx.campuses : [];
      var wanted = clean_(preferredId || ctx.selectedCampusId || ctx.campusId || ctx.schoolId || ctx.id || '');
      var cur = null;
      if (wanted && list.length) {
        cur = list.filter(function(c){ return lower_(c && (c.campusId || c.schoolId || c.id)) === lower_(wanted); })[0] || null;
      }
      cur = cur || ctx.currentCampus || ctx.selectedCampus || ctx;
      var school = clean_(wanted || cur.selectedCampusId || cur.campusId || cur.schoolId || cur.id || '');
      var name = clean_(cur.selectedCampusName || cur.campusName || cur.schoolName || cur.name || '');
      var ss = clean_(cur.selectedSpreadsheetId || cur.spreadsheetId || cur.ssId || cur.sheetId || '');
      return school || ss ? addSchoolFields_({}, school, name, ss) : null;
    } catch(e) { return null; }
  }

  function selectedSchoolPayloadForRedis_(){
    var out = {};
    // v0.54.18dj: choose the tab-locked school first. Do not let an older shared
    // campusContext/currentCampus overwrite the current tab's school selection.
    var locked = sessionSchool_();
    if (locked) Object.assign(out, locked);
    var selected = selectorSchool_();
    if (selected) Object.assign(out, selected);
    var ctx = contextSchool_(out.school || out.schoolId || out.selectedCampusId || out.campusId || '');
    if (ctx) Object.keys(ctx).forEach(function(k){ if (ctx[k] && !out[k]) out[k] = ctx[k]; });
    try {
      if (typeof window.selectedSchoolPayloadV686m20 === 'function') {
        var p = window.selectedSchoolPayloadV686m20() || {};
        Object.keys(p).forEach(function(k){ if (p[k] && !out[k]) out[k] = p[k]; });
      }
    } catch(e3) {}
    return (out.school || out.schoolId || out.spreadsheetId) ? out : null;
  }

  function schoolMatches_(guard, payload){
    if (!guard || !payload) return true;
    var guardSchool = lower_(guard.campusId || guard.schoolId || guard.selectedCampusId || guard.school || '');
    var payloadSchool = lower_(payload.campusId || payload.schoolId || payload.selectedCampusId || payload.school || '');
    var guardSheet = lower_(guard.spreadsheetId || guard.selectedSpreadsheetId || '');
    var payloadSheet = lower_(payload.spreadsheetId || payload.selectedSpreadsheetId || '');
    if (guardSchool && payloadSchool && guardSchool !== payloadSchool) return false;
    if (guardSheet && payloadSheet && guardSheet !== payloadSheet) return false;
    return true;
  }
  function makeIgnored_(msg){ var e = new Error(msg || 'Ignored stale school response.'); e.__gaIgnoredSchoolResponse = true; return e; }
  function validateSchoolGuard_(json, requestedSchool){
    var guard = json && json.schoolGuard;
    if (!guard && json && json.result && json.result.schoolScope) guard = json.result.schoolScope;
    if (!guard) return;
    var currentSchool = selectedSchoolPayloadForRedis_();
    if (!schoolMatches_(guard, requestedSchool)) throw makeIgnored_('Ignored a response for a different requested school.');
    if (!schoolMatches_(guard, currentSchool)) throw makeIgnored_('Ignored a stale response because this tab has switched schools.');
  }

  function call(scriptName, functionName, args, ok, fail, userObject){
    var selectedSchool = selectedSchoolPayloadForRedis_();
    var tabId = ensureTabIdV05418DJ_();
    var schoolSessionId = '';
    try { schoolSessionId = (window.__schoolSessionV5450 && window.__schoolSessionV5450.sessionId) || (JSON.parse(sessionStorage.getItem('gaSchedulerSchoolSessionV5450') || '{}').sessionId) || ''; } catch(e) {}
    fetch('/api/google-script-run', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-GA-Tab-Session': tabId, 'X-GA-School-Session': schoolSessionId },
      body: JSON.stringify({ script: scriptName || 'admin', functionName: String(functionName), args: args || [], selectedSchool: selectedSchool, clientTabId: tabId, clientSchoolSessionId: schoolSessionId, clientRequestedAt: new Date().toISOString() })
    })
      .then(function(res){
        return res.json().catch(function(){ return {}; }).then(function(json){
          if(!res.ok || !json.ok) throw json;
          validateSchoolGuard_(json, selectedSchool);
          return json.result;
        });
      })
      .then(function(result){
        ok(result, userObject);
      })
      .catch(function(err){
        if (err && err.__gaIgnoredSchoolResponse) { try { console.warn(err.message); } catch(e) {} return; }
        if (err && err.loginUrl) { window.location.href = err.loginUrl; return; }
        var message = err && (err.error || err.message) ? (err.error || err.message) : err;
        fail(message, userObject);
      });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = wrap(new Runner());
  window.selectedSchoolPayloadForRedisV05418DJ = selectedSchoolPayloadForRedis_;
  window.gaSchedulerTabIdV05418DJ = ensureTabIdV05418DJ_;
})();

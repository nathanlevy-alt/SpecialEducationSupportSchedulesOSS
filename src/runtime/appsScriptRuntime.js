const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createGoogleServices } = require('./googleServices');

class AppsScriptRuntime {
  constructor(redis, options = {}) {
    this.redis = redis;
    this.options = options;
    this.scripts = new Map();
    this._queues = new Map();
  }

  async loadScript(name, filePath, extra = {}) {
    const source = fs.readFileSync(filePath, 'utf8');
    const services = await createGoogleServices(this.redis, Object.assign({}, this.options, extra));
    const context = Object.assign({}, services, {
      global: null,
      globalThis: null,
      Buffer,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Date,
      Math,
      JSON,
      String,
      Number,
      Boolean,
      Array,
      Object,
      RegExp,
      Error,
      TypeError,
      parseInt,
      parseFloat,
      isNaN,
      encodeURIComponent,
      decodeURIComponent,
      encodeURI,
      decodeURI
    });
    context.global = context;
    context.globalThis = context;
    vm.createContext(context);
    try {
      new vm.Script(source, { filename: path.basename(filePath) }).runInContext(context, { timeout: Number(process.env.LEGACY_LOAD_TIMEOUT_MS || 15000) });
    } catch (err) {
      err.message = `Failed to load legacy script ${name}: ${err.message}`;
      throw err;
    }
    const fnNames = Object.keys(context).filter(k => typeof context[k] === 'function').sort();
    this.scripts.set(name, { source, context, services, fnNames, filePath });
    return this.scripts.get(name);
  }

  getScript(name) {
    const script = this.scripts.get(name);
    if (!script) throw new Error(`Legacy script is not loaded: ${name}`);
    return script;
  }

  listFunctions(name) {
    return this.getScript(name).fnNames.slice();
  }

  async call(name, functionName, args = [], options = {}) {
    // Serialized per script name: SpreadsheetApp.activeId (and the rest of this script's
    // services object) is a single shared mutable value reused across every request to this
    // script, unlike real Apps Script where each execution is isolated per-user. Without
    // this queue, two concurrent requests for different schools could interleave between
    // setting the active spreadsheet and the function actually finishing, causing one
    // request to silently read or write the other's school data.
    const previous = this._queues.get(name) || Promise.resolve();
    const run = previous.then(
      () => this._callUnqueued(name, functionName, args, options),
      () => this._callUnqueued(name, functionName, args, options)
    );
    // Store a settled-tracking tail so the queue always advances even if this call throws --
    // a failed call must not permanently block every subsequent call to the same script.
    this._queues.set(name, run.then(() => {}, () => {}));
    return run;
  }

  async _callUnqueued(name, functionName, args = [], options = {}) {
    const script = this.getScript(name);
    const fn = script.context[functionName];
    if (typeof fn !== 'function') throw new Error(`Function not found in ${name}: ${functionName}`);
    try {
      if (script.services && typeof script.services.__setActiveUserEmail === 'function') {
        await script.services.__setActiveUserEmail(options.userEmail || process.env.GA_ACTIVE_USER_EMAIL || '');
      }
      const selected = options.selectedSchool || options.schoolContext || null;
      const requestSpreadsheetId = selected && (selected.spreadsheetId || selected.selectedSpreadsheetId || selected.ssId || selected.id);
      if (script.services && typeof script.services.__setActiveSpreadsheetId === 'function') {
        await script.services.__setActiveSpreadsheetId(requestSpreadsheetId || script.services.__defaultActiveSpreadsheetId || process.env.GA_ACTIVE_SPREADSHEET_ID || 'default-school');
      }
      if (script.services && typeof script.services.__resetExecutionTrace === 'function') {
        script.services.__resetExecutionTrace({ script: name, functionName, selectedSchool: selected || null, activeSpreadsheetId: script.services && script.services.SpreadsheetApp ? script.services.SpreadsheetApp.activeId : '', startedAt: new Date().toISOString() });
      }
      resetLegacyExecutionCaches(script.context);
      const hadRequestSpreadsheetId = Object.prototype.hasOwnProperty.call(script.context, 'V5262_REQUEST_SPREADSHEET_ID');
      const previousRequestSpreadsheetId = script.context.V5262_REQUEST_SPREADSHEET_ID;
      if (requestSpreadsheetId && hadRequestSpreadsheetId) script.context.V5262_REQUEST_SPREADSHEET_ID = requestSpreadsheetId;
      let result;
      let resolved;
      try {
        result = fn.apply(script.context, Array.isArray(args) ? args : [args]);
        resolved = result && typeof result.then === 'function' ? await result : result;
      } finally {
        if (requestSpreadsheetId && hadRequestSpreadsheetId) script.context.V5262_REQUEST_SPREADSHEET_ID = previousRequestSpreadsheetId || '';
      }
      if (script.services && typeof script.services.__flushServices === 'function') {
        await script.services.__flushServices();
      }
      resolved = unwrapHtmlOutput(resolved);
      try {
        if (/Dashboard|ScheduleNow|Todo/i.test(String(functionName || '')) && resolved && typeof resolved === 'object' && !Array.isArray(resolved) && script.services && typeof script.services.__getExecutionTrace === 'function') {
          resolved.__legacySourceTraceV05418DO = script.services.__getExecutionTrace();
        }
      } catch (_) {}
      return resolved;
    } catch (err) {
      const e = new Error(err && err.message ? err.message : String(err));
      e.stack = err && err.stack ? err.stack : e.stack;
      throw e;
    }
  }
}


function resetLegacyExecutionCaches(context) {
  if (!context || typeof context !== 'object') return;
  const names = [
    'V5131_PERIOD_META_CACHE',
    'V5141_PERIOD_DISPLAY_MAP_CACHE',
    'V686M45_PERIOD_CANONICAL_LOOKUP_CACHE',
    'V686M45_PERIOD_BLOCK_TYPE_MAP_CACHE',
    'V5131_SECONDARY_PRIMARY_MAP_CACHE',
    'V654_PROPERTY_STORE_CACHE_ID',
    'V654_PROPERTY_STORE_CACHE',
    // v0.54.18dn: these legacy caches are process-global in the Node compatibility
    // runtime, but Apps Script would recreate them for every execution. Leaving them
    // alive across schools can let Dashboard/period snapshot code reuse stale
    // workbook/property state and then stamp it as the newly selected school.
    'V5256_ACTIVE_SPREADSHEET_CACHE_ID',
    'V5256_ACTIVE_SPREADSHEET_CACHE',
    'V5263_CAMPUS_PROPERTY_CACHE'
  ];
  for (const name of names) {
    try {
      if (Object.prototype.hasOwnProperty.call(context, name)) {
        if (name === 'V5263_CAMPUS_PROPERTY_CACHE') context[name] = {};
        else if (name.endsWith('_ID')) context[name] = '';
        else context[name] = null;
      }
    } catch (_) {}
  }
  for (const fnName of ['clearManagerExecutionCachesV686m45_', 'clearPeriodExecutionCachesV686m45_']) {
    try {
      if (typeof context[fnName] === 'function') context[fnName]();
    } catch (_) {}
  }
}

function unwrapHtmlOutput(value) {
  if (value && typeof value.getContent === 'function') return value.getContent();
  return value;
}

async function createRuntime(redis) {
  const runtime = new AppsScriptRuntime(redis, { activeSpreadsheetId: process.env.GA_ACTIVE_SPREADSHEET_ID || 'default-school' });
  const root = path.resolve(__dirname, '..', '..');
  await runtime.loadScript('admin', path.join(root, 'legacy', 'admin_portal_current_m46.gs'), { scriptNamespace: 'admin:script' });
  await runtime.loadScript('staff', path.join(root, 'legacy', 'staff_portal_current_1_3_8.gs'), { scriptNamespace: 'staff:script' });
  await runtime.loadScript('connector', path.join(root, 'legacy', 'email_connector_current_1_4_3.gs'), { scriptNamespace: 'connector:script' });
  return runtime;
}

module.exports = { AppsScriptRuntime, createRuntime };

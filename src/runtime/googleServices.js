const crypto = require('crypto');
const { RedisSpreadsheetApp } = require('./redisSpreadsheet');
const { RedisPropertiesService } = require('./redisProperties');

function bytesFromBuffer(buf) { return Array.from(buf.values()).map(b => b > 127 ? b - 256 : b); }
function bufferFromBytes(bytes) { return Buffer.from((bytes || []).map(b => (Number(b) + 256) % 256)); }

function makeUtilities() {
  const alg = (algorithm) => String(algorithm || 'sha256').toLowerCase().replace('sha_','sha').replace('sha-','sha');
  return {
    DigestAlgorithm: { SHA_256: 'sha256', MD5: 'md5' },
    Charset: { UTF_8: 'utf-8', US_ASCII: 'ascii' },
    MacAlgorithm: { HMAC_SHA_256: 'sha256', HMAC_SHA_1: 'sha1', HMAC_MD5: 'md5' },
    newBlob(content, contentType, name) { return { getDataAsString: () => String(content || ''), getBytes: () => [...Buffer.from(String(content || ''))], getContentType: () => contentType || 'text/plain', getName: () => name || 'blob', setName(n){ name=n; return this; }, copyBlob(){ return this; }, setContentType(t){ contentType=t; return this; } }; },
    gzip(blob) { const zlib = require('zlib'); const bytes = blob && blob.getBytes ? blob.getBytes() : Buffer.from(String(blob || '')); return this.newBlob(zlib.gzipSync(Buffer.from(bytes)), 'application/gzip', (blob && blob.getName ? blob.getName() : 'blob') + '.gz'); },
    ungzip(blob) { const zlib = require('zlib'); const bytes = blob && blob.getBytes ? blob.getBytes() : Buffer.from(String(blob || '')); return this.newBlob(zlib.gunzipSync(Buffer.from(bytes)), 'application/octet-stream', String(blob && blob.getName ? blob.getName() : 'blob').replace(/\.gz$/,'')); },
    base64Encode(value) { return Buffer.from(Array.isArray(value) ? value : String(value || '')).toString('base64'); },
    base64Decode(value) { return [...Buffer.from(String(value || ''), 'base64')]; },
    base64EncodeWebSafe(value) { return Buffer.from(Array.isArray(value) ? value : String(value || '')).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); },
    base64DecodeWebSafe(value) { let s=String(value||'').replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; return [...Buffer.from(s,'base64')]; },
    computeDigest(algorithm, value) { return bytesFromBuffer(crypto.createHash(alg(algorithm)).update(Array.isArray(value) ? bufferFromBytes(value) : String(value || '')).digest()); },
    computeHmacSha256Signature(value, key) { return bytesFromBuffer(crypto.createHmac('sha256', Array.isArray(key) ? bufferFromBytes(key) : String(key || '')).update(Array.isArray(value) ? bufferFromBytes(value) : String(value || '')).digest()); },
    computeHmacSignature(algorithm, value, key) { return bytesFromBuffer(crypto.createHmac(alg(algorithm), Array.isArray(key) ? bufferFromBytes(key) : String(key || '')).update(Array.isArray(value) ? bufferFromBytes(value) : String(value || '')).digest()); },
    getUuid() { return crypto.randomUUID(); },
    sleep(ms) { const end = Date.now() + Math.min(Number(ms) || 0, 250); while (Date.now() < end) {} },
    formatDate(date, tz, fmt) {
      const d = date instanceof Date ? date : new Date(date || Date.now());
      const f = String(fmt || '');
      if (Number.isNaN(d.getTime())) return '';
      const timeZone = String(tz || 'America/Los_Angeles');
      const monthsLong = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const pad = (n, w = 2) => String(n).padStart(w, '0');
      if (!f) return d.toLocaleString('en-US', { timeZone });
      let Y, M, D, H24, Min, Sec;
      const hasTimeTokens = /HH|H|hh|h|mm|m|ss|s|a/.test(f);
      if (hasTimeTokens) {
        try {
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
          }).formatToParts(d);
          const get = (type) => (parts.find(p => p.type === type) || {}).value || '';
          Y = Number(get('year'));
          M = Number(get('month'));
          D = Number(get('day'));
          H24 = Number(get('hour'));
          if (H24 === 24) H24 = 0;
          Min = Number(get('minute'));
          Sec = Number(get('second'));
        } catch (err) {
          Y = d.getFullYear(); M = d.getMonth() + 1; D = d.getDate(); H24 = d.getHours(); Min = d.getMinutes(); Sec = d.getSeconds();
        }
      } else {
        // Preserve the prior Redis runtime date-only behavior: date-only values are stored
        // with UTC calendar components, so month/date labels must not drift by timezone.
        Y = d.getUTCFullYear(); M = d.getUTCMonth() + 1; D = d.getUTCDate(); H24 = d.getUTCHours(); Min = d.getUTCMinutes(); Sec = d.getUTCSeconds();
      }
      const H12 = H24 % 12 || 12;
      const tokenValues = {
        yyyy: String(Y), YYYY: String(Y), yy: String(Y).slice(-2),
        MMMM: monthsLong[M - 1], MMM: monthsShort[M - 1],
        MM: pad(M), M: String(M),
        dd: pad(D), d: String(D),
        HH: pad(H24), H: String(H24),
        hh: pad(H12), h: String(H12),
        mm: pad(Min), m: String(Min),
        ss: pad(Sec), s: String(Sec),
        a: H24 < 12 ? 'AM' : 'PM'
      };
      const literals = [];
      const pattern = f.replace(/'([^']*)'/g, (_, literal) => { literals.push(literal); return '\u0000' + (literals.length - 1) + '\u0000'; });
      const rendered = pattern.replace(/yyyy|YYYY|MMMM|MMM|yy|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s|a/g, (token) => tokenValues[token] != null ? tokenValues[token] : token);
      return rendered.replace(/\u0000(\d+)\u0000/g, (_, index) => literals[Number(index)] || '');
    }
  };
}

function makeHtmlService() {
  const wrap = (content) => ({
    content: String(content || ''),
    setTitle() { return this; },
    setXFrameOptionsMode() { return this; },
    addMetaTag() { return this; },
    getContent() { return this.content; }
  });
  return {
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
    createHtmlOutput: wrap,
    createHtmlOutputFromFile: (name) => wrap(`<div>Missing template file: ${name}</div>`),
    createTemplate: (content) => ({ evaluate: () => wrap(content), getRawContent: () => String(content || '') }),
    createTemplateFromFile: (name) => ({ evaluate: () => wrap(`<div>Missing template file: ${name}</div>`) })
  };
}

function makeContentService() {
  return {
    MimeType: { JSON: 'application/json', TEXT: 'text/plain' },
    createTextOutput(text) { return { text: String(text || ''), setMimeType(){ return this; }, getContent(){ return this.text; } }; }
  };
}

function makeCacheService(trace) {
  const caches = new Map();
  const getCache = (name) => {
    if (!caches.has(name)) caches.set(name, new Map());
    const map = caches.get(name);
    return {
      get(k) { const row = map.get(k); const hit = !!(row && !(row.exp && row.exp < Date.now())); if (trace && trace.add) trace.add({ kind: 'cache.get', cache: name, key: String(k || ''), hit }); if (!row) return null; if (row.exp && row.exp < Date.now()) { map.delete(k); return null; } return row.v; },
      put(k, v, seconds) { if (trace && trace.add) trace.add({ kind: 'cache.put', cache: name, key: String(k || ''), seconds: Number(seconds || 0), valuePreview: String(v == null ? '' : v).slice(0, 120) }); map.set(k, { v: String(v), exp: seconds ? Date.now() + seconds * 1000 : 0 }); },
      remove(k) { if (trace && trace.add) trace.add({ kind: 'cache.remove', cache: name, key: String(k || '') }); map.delete(k); },
      removeAll(keys) { if (trace && trace.add) trace.add({ kind: 'cache.removeAll', cache: name, keys: (keys || []).slice(0, 20).map(String) }); (keys || []).forEach(k => map.delete(k)); }
    };
  };
  return { getScriptCache: () => getCache('script'), getDocumentCache: () => getCache('document'), getUserCache: () => getCache('user') };
}

function makeLockService() {
  const lock = { tryLock(){ return true; }, waitLock(){ return true; }, releaseLock(){ return true; }, hasLock(){ return true; } };
  return { getScriptLock: () => lock, getDocumentLock: () => lock, getUserLock: () => lock };
}

function makeMailApp() {
  let transporter = null;
  function getTransporter() {
    if (transporter) return transporter;
    if (process.env.EMAIL_TRANSPORT === 'smtp') {
      const nodemailer = require('nodemailer');
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_PORT) === '465',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      });
    } else {
      const nodemailer = require('nodemailer');
      try {
        const nodemailer = require('nodemailer');
        transporter = nodemailer.createTransport({ jsonTransport: true });
      } catch (err) {
        transporter = { sendMail: async (msg) => ({ messageId: 'console', message: JSON.stringify(msg) }) };
      }
    }
    return transporter;
  }
  function normalizeArgs(toOrObj, subject, body, options) {
    if (typeof toOrObj === 'object' && toOrObj) return toOrObj;
    return Object.assign({}, options || {}, { to: toOrObj, subject, body, text: body });
  }
  return {
    sendEmail(toOrObj, subject, body, options) {
      const msg = normalizeArgs(toOrObj, subject, body, options);
      msg.from = msg.from || process.env.SMTP_FROM || process.env.GA_ACTIVE_USER_EMAIL || 'ga-scheduler@example.org';
      msg.text = msg.text || msg.body || '';
      msg.html = msg.htmlBody || msg.html;
      getTransporter().sendMail(msg).then(info => console.log('[email]', info.messageId || info.message || msg.to)).catch(err => console.error('[email error]', err.message));
    },
    getRemainingDailyQuota() { return 1500; }
  };
}

function makeUrlFetchApp() {
  return {
    fetch(url, options = {}) {
      const method = options.method || 'get';
      const headers = options.headers || {};
      const body = options.payload;
      // This compatibility call is intentionally sync-looking but internally async hostile.
      // For theoretical parity, return a structured error unless fetch is available and caller tolerates it.
      throw new Error('UrlFetchApp.fetch is not synchronously available in this Node compatibility runtime. Port this connector/API call to an async repository endpoint. URL: ' + url + ' method: ' + method + ' headers:' + JSON.stringify(headers) + ' payload:' + String(body || '').slice(0, 200));
    }
  };
}

function makeDriveApp() {
  const emptyIterator = { hasNext: () => false, next: () => { throw new Error('No files'); } };
  const makeFile = (id, name) => ({
    getId: () => id,
    getName: () => name || id,
    getUrl: () => `redis://drive/${id}`,
    getMimeType: () => 'application/octet-stream',
    getBlob: () => makeUtilities().newBlob('', 'application/octet-stream', name || id),
    makeCopy: () => makeFile(`${id}-copy`, name || `${id}-copy`),
    setName(n){ name=n; return this; },
    moveTo(){ return this; }
  });
  const root = { getId: () => 'root', getName: () => 'root', getFiles: () => emptyIterator, createFile: (blobOrName, content, mimeType) => makeFile(`file-${Date.now()}`, typeof blobOrName === 'string' ? blobOrName : (blobOrName && blobOrName.getName ? blobOrName.getName() : 'file')) };
  return {
    MimeType: { GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet', GOOGLE_FORMS: 'application/vnd.google-apps.form' },
    createFile(blobOrName, content, mimeType) { return root.createFile(blobOrName, content, mimeType); },
    getFileById(id) { return makeFile(id, id); },
    getFolderById(id) { return { getId: () => id, getName: () => id, getFiles: () => emptyIterator, createFile: root.createFile }; },
    getRootFolder() { return root; },
    getFiles() { return emptyIterator; },
    getFilesByType() { return emptyIterator; },
    searchFiles() { return emptyIterator; }
  };
}

function makeFormApp() {
  const makeForm = (id) => ({ getId: () => id, getTitle: () => id, getPublishedUrl: () => `redis://form/${id}`, getEditUrl: () => `redis://form/${id}/edit` });
  return { openById(id) { return makeForm(id); }, openByUrl(url) { return makeForm(String(url || '').split('/').filter(Boolean).pop() || url); } };
}

function makeSession(holder) {
  return {
    getActiveUser() { return { getEmail: () => holder.activeUserEmail || process.env.GA_ACTIVE_USER_EMAIL || '' }; },
    getEffectiveUser() { return { getEmail: () => holder.activeUserEmail || process.env.GA_ACTIVE_USER_EMAIL || '' }; },
    getScriptTimeZone() { return process.env.TZ || 'America/Los_Angeles'; }
  };
}


function makeExecutionTraceV05418DO() {
  const state = { meta: {}, events: [], maxEvents: 260 };
  function slim(v, max) { v = String(v == null ? '' : v); return v.length > (max || 160) ? v.slice(0, max || 160) + '...[truncated]' : v; }
  return {
    reset(meta) { state.meta = Object.assign({ startedAt: new Date().toISOString() }, meta || {}); state.events = []; },
    add(evt) {
      try {
        if (!evt || typeof evt !== 'object') return;
        if (state.events.length >= state.maxEvents) return;
        const clean = Object.assign({ at: new Date().toISOString() }, evt);
        Object.keys(clean).forEach(k => { if (typeof clean[k] === 'string') clean[k] = slim(clean[k], 220); });
        state.events.push(clean);
      } catch (_) {}
    },
    summary() {
      const events = state.events.slice();
      const spreadsheetIds = [...new Set(events.map(e => e.spreadsheetId || e.activeSpreadsheetId || e.id || '').filter(Boolean).map(String))];
      const sheets = [...new Set(events.map(e => e.sheetName || e.sheet || '').filter(Boolean).map(String))];
      const cacheKeys = [...new Set(events.filter(e => /^cache\./.test(e.kind || '')).map(e => `${e.cache || ''}:${e.key || ''}`).filter(Boolean))].slice(0, 80);
      const propertyReads = events.filter(e => /^properties\./.test(e.kind || '')).slice(0, 80);
      return { version: 'v05418do', meta: state.meta, spreadsheetIds, sheets, cacheKeys, propertyReads, events: events.slice(-state.maxEvents), eventCount: events.length };
    }
  };
}

function installSpreadsheetTraceV05418DO(SpreadsheetApp, trace) {
  if (!SpreadsheetApp || !trace || SpreadsheetApp.__traceInstalledV05418DO) return;
  SpreadsheetApp.__traceInstalledV05418DO = true;
  function sampleSheet(sheet) {
    const out = {};
    try {
      out.rows = sheet && sheet.values ? sheet.values.length : 0;
      out.cols = sheet && sheet.getLastColumn ? sheet.getLastColumn() : 0;
      const name = sheet && sheet.getName ? String(sheet.getName() || '') : '';
      if (/^(Students|Staff)$/i.test(name) && sheet && Array.isArray(sheet.values) && sheet.values.length) {
        const headers = Array.isArray(sheet.values[0]) ? sheet.values[0].map(String) : [];
        const idx = Math.max(0, headers.findIndex(h => /^(name|student|student name|staff|staff name|staff member|employee name)$/i.test(String(h || '').trim())));
        out.sampleNames = sheet.values.slice(1, 8).map(r => Array.isArray(r) ? String(r[idx] || '').trim() : '').filter(Boolean);
      }
    } catch (_) {}
    return out;
  }
  function wrapSpreadsheet(ss) {
    if (!ss || ss.__traceWrappedV05418DO) return ss;
    ss.__traceWrappedV05418DO = true;
    const id = ss.getId ? ss.getId() : ss.id;
    const oldGetSheetByName = ss.getSheetByName;
    if (typeof oldGetSheetByName === 'function') {
      ss.getSheetByName = function(name) {
        const sheet = oldGetSheetByName.apply(this, arguments);
        trace.add(Object.assign({ kind: 'spreadsheet.getSheetByName', spreadsheetId: String(id || this.id || ''), sheetName: String(name || ''), hit: !!sheet }, sheet ? sampleSheet(sheet) : {}));
        return sheet;
      };
    }
    const oldGetSheets = ss.getSheets;
    if (typeof oldGetSheets === 'function') {
      ss.getSheets = function() {
        const sheets = oldGetSheets.apply(this, arguments) || [];
        trace.add({ kind: 'spreadsheet.getSheets', spreadsheetId: String(id || this.id || ''), sheetNames: sheets.map(s => s && s.getName ? s.getName() : '').filter(Boolean).slice(0, 80), count: sheets.length });
        return sheets;
      };
    }
    const oldGetActiveSheet = ss.getActiveSheet;
    if (typeof oldGetActiveSheet === 'function') {
      ss.getActiveSheet = function() {
        const sheet = oldGetActiveSheet.apply(this, arguments);
        trace.add(Object.assign({ kind: 'spreadsheet.getActiveSheet', spreadsheetId: String(id || this.id || ''), sheetName: sheet && sheet.getName ? sheet.getName() : '' }, sheet ? sampleSheet(sheet) : {}));
        return sheet;
      };
    }
    return ss;
  }
  const oldHydrate = SpreadsheetApp.hydrateSpreadsheet;
  if (typeof oldHydrate === 'function') {
    SpreadsheetApp.hydrateSpreadsheet = async function(id) {
      trace.add({ kind: 'spreadsheetApp.hydrateSpreadsheet', spreadsheetId: String(id || this.activeId || '') });
      const ss = await oldHydrate.apply(this, arguments);
      return wrapSpreadsheet(ss);
    };
  }
  const oldOpenById = SpreadsheetApp.openById;
  if (typeof oldOpenById === 'function') {
    SpreadsheetApp.openById = function(id) {
      trace.add({ kind: 'spreadsheetApp.openById', spreadsheetId: String(id || ''), activeSpreadsheetId: String(this.activeId || '') });
      return wrapSpreadsheet(oldOpenById.apply(this, arguments));
    };
  }
  const oldGetActive = SpreadsheetApp.getActive;
  if (typeof oldGetActive === 'function') {
    SpreadsheetApp.getActive = function() {
      trace.add({ kind: 'spreadsheetApp.getActive', activeSpreadsheetId: String(this.activeId || '') });
      return wrapSpreadsheet(oldGetActive.apply(this, arguments));
    };
  }
  const oldGetActiveSpreadsheet = SpreadsheetApp.getActiveSpreadsheet;
  if (typeof oldGetActiveSpreadsheet === 'function') {
    SpreadsheetApp.getActiveSpreadsheet = function() {
      trace.add({ kind: 'spreadsheetApp.getActiveSpreadsheet', activeSpreadsheetId: String(this.activeId || '') });
      return wrapSpreadsheet(oldGetActiveSpreadsheet.apply(this, arguments));
    };
  }
}

function installPropertiesTraceV05418DO(PropertiesService, trace) {
  if (!PropertiesService || !trace || PropertiesService.__traceInstalledV05418DO) return;
  PropertiesService.__traceInstalledV05418DO = true;
  function wrapStore(store, type) {
    if (!store || store.__traceWrappedV05418DO) return store;
    store.__traceWrappedV05418DO = true;
    const oldGet = store.getProperty;
    if (typeof oldGet === 'function') store.getProperty = function(name) { const v = oldGet.apply(this, arguments); trace.add({ kind: 'properties.getProperty', store: type, namespace: String(this.namespace || ''), key: String(name || ''), hit: v != null, valuePreview: String(v == null ? '' : v).slice(0, 160) }); return v; };
    const oldAll = store.getProperties;
    if (typeof oldAll === 'function') store.getProperties = function() { const v = oldAll.apply(this, arguments) || {}; trace.add({ kind: 'properties.getProperties', store: type, namespace: String(this.namespace || ''), keyCount: Object.keys(v).length, keys: Object.keys(v).slice(0, 80) }); return v; };
    return store;
  }
  ['getScriptProperties','getDocumentProperties','getUserProperties'].forEach(fn => {
    const old = PropertiesService[fn];
    if (typeof old === 'function') {
      PropertiesService[fn] = function() { return wrapStore(old.apply(this, arguments), fn.replace(/^get|Properties$/g, '').toLowerCase()); };
    }
  });
}

async function createGoogleServices(redis, options = {}) {
  const traceV05418DO = makeExecutionTraceV05418DO();
  const SpreadsheetApp = new RedisSpreadsheetApp(redis, { activeSpreadsheetId: options.activeSpreadsheetId || process.env.GA_ACTIVE_SPREADSHEET_ID || 'default-school' });
  installSpreadsheetTraceV05418DO(SpreadsheetApp, traceV05418DO);
  Object.assign(SpreadsheetApp, {
    BorderStyle: { SOLID: 'SOLID', DOTTED: 'DOTTED', DASHED: 'DASHED', SOLID_MEDIUM: 'SOLID_MEDIUM', SOLID_THICK: 'SOLID_THICK', DOUBLE: 'DOUBLE' },
    DataValidationCriteria: { VALUE_IN_LIST: 'VALUE_IN_LIST', VALUE_IN_RANGE: 'VALUE_IN_RANGE', CHECKBOX: 'CHECKBOX', NUMBER_BETWEEN: 'NUMBER_BETWEEN', TEXT_CONTAINS: 'TEXT_CONTAINS', DATE_IS_VALID_DATE: 'DATE_IS_VALID_DATE' },
    Direction: { UP: 'UP', DOWN: 'DOWN', NEXT: 'NEXT', PREVIOUS: 'PREVIOUS' },
    CopyPasteType: { PASTE_NORMAL: 'PASTE_NORMAL', PASTE_NO_BORDERS: 'PASTE_NO_BORDERS', PASTE_FORMAT: 'PASTE_FORMAT', PASTE_VALUES: 'PASTE_VALUES', PASTE_FORMULA: 'PASTE_FORMULA', PASTE_DATA_VALIDATION: 'PASTE_DATA_VALIDATION', PASTE_CONDITIONAL_FORMATTING: 'PASTE_CONDITIONAL_FORMATTING' },
    WrapStrategy: { WRAP: 'WRAP', OVERFLOW: 'OVERFLOW', CLIP: 'CLIP' },
    TextDirection: { LEFT_TO_RIGHT: 'LEFT_TO_RIGHT', RIGHT_TO_LEFT: 'RIGHT_TO_LEFT' },
    AutoFillSeries: { DEFAULT_SERIES: 'DEFAULT_SERIES', ALTERNATE_SERIES: 'ALTERNATE_SERIES' }
  });
  await SpreadsheetApp.hydrateAll();
  const PropertiesService = new RedisPropertiesService(redis, {
    scriptNamespace: options.scriptNamespace || 'script',
    documentNamespace: options.documentNamespace || `document:${SpreadsheetApp.activeId}`,
    userNamespace: options.userNamespace || `user:${process.env.GA_ACTIVE_USER_EMAIL || 'anonymous'}`
  });
  await PropertiesService.hydrate();
  installPropertiesTraceV05418DO(PropertiesService, traceV05418DO);
  const userHolder = { activeUserEmail: process.env.GA_ACTIVE_USER_EMAIL || '' };

  const defaultActiveSpreadsheetId = options.activeSpreadsheetId || process.env.GA_ACTIVE_SPREADSHEET_ID || 'default-school';
  const services = {
    SpreadsheetApp,
    PropertiesService,
    CacheService: makeCacheService(traceV05418DO),
    LockService: makeLockService(),
    HtmlService: makeHtmlService(),
    ContentService: makeContentService(),
    Utilities: makeUtilities(),
    MailApp: makeMailApp(),
    GmailApp: makeMailApp(),
    UrlFetchApp: makeUrlFetchApp(),
    DriveApp: makeDriveApp(),
    FormApp: makeFormApp(),
    Session: makeSession(userHolder),
    Logger: { log: (...args) => console.log('[Logger]', ...args) },
    Browser: { msgBox(){ return 'OK'; }, inputBox(){ return ''; }, Buttons: { OK: 'OK', YES_NO: 'YES_NO' } },
    console,
    ScriptApp: { newTrigger(){ return { timeBased(){ return this; }, after(){ return this; }, everyDays(){ return this; }, atHour(){ return this; }, create(){ return {}; } }; }, getProjectTriggers(){ return []; }, deleteTrigger(){}, getOAuthToken(){ return process.env.GOOGLE_OAUTH_TOKEN || ''; } },
    __defaultActiveSpreadsheetId: defaultActiveSpreadsheetId,
    async __setActiveUserEmail(email) {
      const normalized = String(email || process.env.GA_ACTIVE_USER_EMAIL || '').trim().toLowerCase();
      userHolder.activeUserEmail = normalized;
      // This is the fix for the underlying bug behind V5_SELECTED_CAMPUS_ID and
      // V5_EMULATED_USER_EMAIL leaking between admins: PropertiesService.getUserProperties()
      // was never actually re-scoped per request, so every admin -- regardless of who they
      // were -- shared one Redis key for "user" properties. __setActiveSpreadsheetId already
      // did the equivalent re-scoping for document properties (see setDocumentNamespace
      // below); this was the same pattern, just missing for user properties specifically.
      // Calls are already serialized per script name (see appsScriptRuntime.js's per-name
      // promise queue), so this re-scope-then-run-then-restore is race-free the same way
      // the spreadsheet one already is.
      if (PropertiesService && typeof PropertiesService.setUserNamespace === 'function') {
        await PropertiesService.setUserNamespace('user:' + (normalized || 'anonymous'));
      }
    },
    async __setActiveSpreadsheetId(spreadsheetId) {
      const nextId = String(spreadsheetId || defaultActiveSpreadsheetId || 'default-school').trim() || 'default-school';
      if (traceV05418DO && traceV05418DO.add) traceV05418DO.add({ kind: 'services.setActiveSpreadsheetId', requestedSpreadsheetId: String(spreadsheetId || ''), nextSpreadsheetId: nextId, previousActiveSpreadsheetId: String(SpreadsheetApp.activeId || '') });
      await SpreadsheetApp.flush();
      SpreadsheetApp.activeId = nextId;
      // V0.54.16: the Node compatibility runtime persists SpreadsheetApp objects across
      // requests, unlike Apps Script. Refresh the Redis-backed spreadsheet on every
      // legacy call so staff/admin pages cannot read stale _V5Properties values. This
      // is critical for explicit false values such as V5_DISPLAY_REGULAR_ON_STAFF_PORTAL.
      if (SpreadsheetApp.cache && typeof SpreadsheetApp.cache.delete === 'function') {
        SpreadsheetApp.cache.delete(nextId);
      }
      await SpreadsheetApp.hydrateSpreadsheet(nextId);
      if (PropertiesService && typeof PropertiesService.setDocumentNamespace === 'function') {
        await PropertiesService.setDocumentNamespace(`document:${nextId}`);
      }
    },
    __resetExecutionTrace(meta) { traceV05418DO.reset(meta || {}); },
    __getExecutionTrace() { return traceV05418DO.summary(); },
    __recordExecutionTrace(evt) { traceV05418DO.add(evt || {}); },
    async __flushServices() { await Promise.allSettled([SpreadsheetApp.flush(), PropertiesService.flush()]); }
  };
  return services;
}

module.exports = { createGoogleServices };

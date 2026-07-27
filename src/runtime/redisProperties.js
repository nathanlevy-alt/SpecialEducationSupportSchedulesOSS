
const BLOCKED_USER_SCHOOL_SELECTION_KEYS = new Set([
  'V5_SELECTED_CAMPUS_ID',
  'V5_SELECTED_CAMPUS_SPREADSHEET_ID',
  'V5_SELECTED_CAMPUS_NAME',
  'V5_SELECTED_CAMPUS_SWITCHED_AT',
  'V5_SELECTED_SCHOOL_ID',
  'V5_SELECTED_SCHOOL_NAME',
  'CURRENT_SCHOOL_ID',
  'CURRENT_SCHOOL_NAME',
  'selectedSchool',
  'schoolId',
  'campusId',
  'currentSchool',
  'currentCampus'
]);

function isBlockedUserSchoolSelectionKey(namespace, name) {
  const ns = String(namespace || '').toLowerCase();
  if (!(ns === 'user' || ns.startsWith('user:'))) return false;
  return BLOCKED_USER_SCHOOL_SELECTION_KEYS.has(String(name || ''));
}

class RedisPropertyStore {
  constructor(redis, namespace, owner) {
    this.redis = redis;
    this.namespace = namespace;
    this.owner = owner;
    this._cache = {};
  }
  key_() { return `gas:properties:${this.namespace}`; }
  track_(promise) { if (this.owner && this.owner.trackWrite) this.owner.trackWrite(promise); }
  getProperty(name) { if (isBlockedUserSchoolSelectionKey(this.namespace, name)) return null; return this.__syncGet(name); }
  setProperty(name, value) { if (isBlockedUserSchoolSelectionKey(this.namespace, name)) { this.__syncDelete(name); return this; } this.__syncSet(name, value); return this; }
  deleteProperty(name) { this.__syncDelete(name); return this; }
  getProperties() { return this.__syncAll(); }
  setProperties(obj, deleteOthers) {
    if (deleteOthers) this.__syncReplace(obj || {});
    else Object.entries(obj || {}).forEach(([k, v]) => this.__syncSet(k, v));
    return this;
  }
  deleteAllProperties() { this.__syncReplace({}); return this; }
  __syncAll() { return Object.assign({}, this._cache || {}); }
  __syncGet(name) { if (isBlockedUserSchoolSelectionKey(this.namespace, name)) return null; return Object.prototype.hasOwnProperty.call(this._cache || {}, name) ? this._cache[name] : null; }
  __syncSet(name, value) {
    if (isBlockedUserSchoolSelectionKey(this.namespace, name)) { this.__syncDelete(name); return; }
    this._cache = this._cache || {};
    this._cache[name] = String(value);
    if (this.redis && this.redis.hSet) this.track_(this.redis.hSet(this.key_(), name, String(value)).catch((err) => console.error('[redis property set]', err.message)));
  }
  __syncDelete(name) {
    this._cache = this._cache || {};
    delete this._cache[name];
    if (this.redis && this.redis.del && this.redis.hSet) {
      const snapshot = Object.assign({}, this._cache);
      this.track_(this.redis.del(this.key_()).then(() => Object.keys(snapshot).length ? this.redis.hSet(this.key_(), snapshot) : true).catch((err) => console.error('[redis property delete]', err.message)));
    }
  }
  __syncReplace(obj) {
    this._cache = {};
    Object.entries(obj || {}).forEach(([k, v]) => { this._cache[k] = String(v); });
    if (this.redis && this.redis.del && this.redis.hSet) {
      const snapshot = Object.assign({}, this._cache);
      this.track_(this.redis.del(this.key_()).then(() => Object.keys(snapshot).length ? this.redis.hSet(this.key_(), snapshot) : true).catch((err) => console.error('[redis property replace]', err.message)));
    }
  }
  async hydrate() {
    if (this.redis && this.redis.hGetAll) this._cache = await this.redis.hGetAll(this.key_());
    else this._cache = this._cache || {};
    if (String(this.namespace || '').toLowerCase() === 'user' || String(this.namespace || '').toLowerCase().startsWith('user:')) {
      let changed = false;
      for (const k of BLOCKED_USER_SCHOOL_SELECTION_KEYS) {
        if (Object.prototype.hasOwnProperty.call(this._cache || {}, k)) { delete this._cache[k]; changed = true; }
      }
      if (changed && this.redis && this.redis.del && this.redis.hSet) {
        const snapshot = Object.assign({}, this._cache || {});
        await this.redis.del(this.key_()).catch(() => {});
        if (Object.keys(snapshot).length) await this.redis.hSet(this.key_(), snapshot).catch(() => {});
      }
    }
  }
}

class RedisPropertiesService {
  constructor(redis, options = {}) {
    this.redis = redis;
    this.pendingWrites = [];
    this.script = new RedisPropertyStore(redis, options.scriptNamespace || 'script', this);
    this.document = new RedisPropertyStore(redis, options.documentNamespace || 'document', this);
    this.user = new RedisPropertyStore(redis, options.userNamespace || 'user', this);
  }
  trackWrite(promise) { if (promise && typeof promise.then === 'function') this.pendingWrites.push(promise); }
  async flush() {
    const pending = this.pendingWrites.splice(0);
    if (pending.length) await Promise.allSettled(pending);
  }
  async hydrate() { await Promise.all([this.script.hydrate(), this.document.hydrate(), this.user.hydrate()]); }
  async setDocumentNamespace(namespace) {
    const next = String(namespace || 'document');
    if (this.document && this.document.namespace === next) return;
    await this.flush();
    this.document = new RedisPropertyStore(this.redis, next, this);
    await this.document.hydrate();
  }
  async setUserNamespace(namespace) {
    const next = String(namespace || 'user');
    if (this.user && this.user.namespace === next) return;
    await this.flush();
    this.user = new RedisPropertyStore(this.redis, next, this);
    await this.user.hydrate();
  }
  getScriptProperties() { return this.script; }
  getDocumentProperties() { return this.document; }
  getUserProperties() { return this.user; }
}

module.exports = { RedisPropertiesService };

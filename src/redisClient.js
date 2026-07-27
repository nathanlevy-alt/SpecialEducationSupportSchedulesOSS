let createClient = null;
try { ({ createClient } = require('redis')); } catch (err) { createClient = null; }

let singleton = null;
let memoryStore = null;

// HARDENING: this store is intentionally NOT persistent and NOT shared across processes.
// It exists for local development and the test suite (tools/smoke-test.js), where
// REDIS_URL is deliberately set to 'memory'. It must never be used as a silent fallback in
// a real deployment — see getRedis() below.
function createMemoryRedis() {
  const map = new Map();
  const hash = new Map();
  return {
    isMemory: true,
    async connect() {},
    async quit() {},
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async mGet(keys) { return (keys || []).map(k => (map.has(k) ? map.get(k) : null)); },
    async set(key, value) { map.set(key, String(value)); return 'OK'; },
    async del(key) { map.delete(key); hash.delete(key); return 1; },
    async exists(key) { return map.has(key) || hash.has(key) ? 1 : 0; },
    async hGet(key, field) { const h = hash.get(key); return h && h.has(field) ? h.get(field) : null; },
    async hSet(key, field, value) {
      if (typeof field === 'object' && field !== null) {
        let h = hash.get(key); if (!h) { h = new Map(); hash.set(key, h); }
        Object.entries(field).forEach(([k, v]) => h.set(k, String(v)));
        return Object.keys(field).length;
      }
      let h = hash.get(key); if (!h) { h = new Map(); hash.set(key, h); }
      h.set(field, String(value)); return 1;
    },
    async hGetAll(key) { const h = hash.get(key); return h ? Object.fromEntries(h.entries()) : {}; },
    async expire() { return 1; },
    async keys(pattern) {
      const all = [...map.keys(), ...hash.keys()];
      if (!pattern || pattern === '*') return all;
      const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      return all.filter(k => re.test(k));
    }
  };
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function getRedis() {
  if (singleton) return singleton;
  const url = process.env.REDIS_URL;

  // Explicit opt-in to the in-memory store, for local dev and tools/smoke-test.js. This is
  // the ONLY case where falling back to memory is acceptable, because it was asked for.
  if (url === 'memory') {
    console.warn('[redis] REDIS_URL=memory — using non-persistent in-memory store. This must never be set in production.');
    memoryStore = createMemoryRedis();
    singleton = memoryStore;
    return singleton;
  }

  // HARDENING: previously, a missing REDIS_URL or a failed connection silently fell back to
  // the in-memory store. The app would boot and appear to work normally, and admins could
  // save real schedule data, right up until the process restarted and everything vanished —
  // with only a console.warn as a trace. That is a silent data-loss bug, not a graceful
  // degradation. Fail loudly instead: refuse to start so the misconfiguration is caught
  // immediately (in a deploy log or a crash-looping process), not discovered later as
  // "the schedule I saved yesterday is gone."
  if (!url) {
    throw new Error(
      'REDIS_URL is not set. Set it to a real redis:// URL for persistent storage, or explicitly ' +
      'set REDIS_URL=memory if you intend to run with a non-persistent in-memory store (local ' +
      'development / tests only — never production).'
    );
  }
  if (!createClient) {
    throw new Error('REDIS_URL is set but the "redis" package is not installed. Run `npm install` before starting.');
  }

  const client = createClient({
    url,
    socket: {
      // Auto-reconnect on a dropped connection during a running session, instead of leaving
      // requests to fail indefinitely until the process is manually restarted.
      reconnectStrategy: (retries) => {
        if (retries > 20) {
          console.error('[redis] giving up reconnecting after 20 attempts.');
          return new Error('Too many Redis reconnect attempts.');
        }
        return Math.min(retries * 200, 5000); // capped exponential backoff
      }
    }
  });
  client.on('error', (err) => console.error('[redis]', err && err.message ? err.message : err));
  client.on('reconnecting', () => console.warn('[redis] connection lost, reconnecting...'));
  client.on('connect', () => console.log('[redis] connected.'));

  // Bounded retry on the *initial* connect only (a transient blip right at boot, e.g. Redis
  // still starting up alongside this app). If it still can't connect after this, fail loud
  // rather than silently downgrading — see comment above.
  const maxAttempts = 5;
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await client.connect();
      singleton = client;
      return singleton;
    } catch (err) {
      lastErr = err;
      console.warn(`[redis] connect attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (attempt < maxAttempts) await sleep(Math.min(attempt * 500, 3000));
    }
  }
  throw new Error(`[redis] Could not connect to REDIS_URL after ${maxAttempts} attempts: ${lastErr && lastErr.message}`);
}

module.exports = { getRedis };

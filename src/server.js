const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const { getRedis } = require('./redisClient');
const { createRuntime } = require('./runtime/appsScriptRuntime');
const webauthn = require('./webauthn');

const VERSION = '0.54.18et';

// HARDENING: without these, an error thrown outside a route's own try/catch (e.g. in a
// timer callback, an event listener, or an awaited call in a route handler that forgot to
// catch) previously either crashed the process with no useful log, or in the case of an
// unhandled promise rejection, could leave the process running in a half-broken state
// indefinitely. Log clearly and exit; let the process manager (Render, systemd, Docker,
// etc.) restart it, rather than limping on in an unknown state.
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err && err.stack ? err.stack : err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection:', reason && reason.stack ? reason.stack : reason);
  process.exit(1);
});

async function main() {
  const redis = await getRedis();
  await seedRuntimeBootstrapProperties(redis);
  const runtime = await createRuntime(redis);
  const app = express();
  app.set('trust proxy', true);
  // PERFORMANCE: index.html alone is 1.2MB+ of uncompressed text (HTML/CSS/JS), served on
  // every admin page load, plus another ~500KB across the patch scripts. None of this was
  // being compressed. gzip typically cuts text payloads like this by 70-85%, which matters
  // both for load time and for staff checking schedules on the go over school WiFi or
  // mobile data — directly relevant to day-of use. Requires `npm install` to pull in the
  // compression package before this takes effect; not runtime-tested in this environment
  // (no network access here to install/run it) — verify it's actually reducing response
  // size (e.g. `curl -H "Accept-Encoding: gzip" -I` and check for a Content-Encoding header)
  // after deploying.
  app.use(compression());
  app.use(cookieParser(process.env.SESSION_SECRET || 'dev-session-secret-change-me'));
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  app.get('/healthz', async (req, res) => {
    const redisMode = redis && redis.isMemory ? 'memory' : 'redis';
    let persistence = false;
    try {
      const key = 'gas:health:persistence';
      const value = String(Date.now());
      await redis.set(key, value);
      persistence = (await redis.get(key)) === value;
    } catch (e) {}
    res.json({ ok: true, version: VERSION, buildMarkerV05418ZZ: 'v1.0.0-oss', redis: redisMode === 'redis', redisMode, redisUrlConfigured: !!process.env.REDIS_URL, persistence, runtimeScripts: ['admin','staff','connector'], authEnabled: isAuthEnabled(), authAccessMode: 'env-or-internal-campus-users', staffPortalSchoolAliases: 'campus-registry-and-spreadsheet-keys', staffPortalRuntime: 'tokenized-single-app-v015' });
  });

  app.get('/auth/me', (req, res) => {
    const user = getRequestUser(req);
    res.json({ ok: true, authEnabled: isAuthEnabled(), user: user ? { email: user.email, name: user.name || '' } : null });
  });
  app.get('/auth/logout', (req, res) => { clearAuthCookie(res); res.redirect('/'); });
  // Admin app compatibility: earlier admin-app builds linked to /auth/google?next=/admin-app,
  // but the actual Google login entrypoint in this app is /auth/login. Keep this small
  // alias so already-installed/cached admin app shells do not land on a 404 after update.
  app.get('/auth/google', (req, res) => {
    const rawReturnTo = String(req.query.returnTo || req.query.next || '/admin-app');
    const returnTo = /^\/(?!\/)/.test(rawReturnTo) ? rawReturnTo : '/admin-app';
    res.redirect('/auth/login?returnTo=' + encodeURIComponent(returnTo) + '&scope=lite');
  });
  app.get('/auth/login', (req, res) => {
    if (!isAuthEnabled()) return res.redirect('/admin/');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(500).send(renderError('Google authentication is not configured', new Error('Missing GOOGLE_CLIENT_ID.')));
    const state = crypto.randomBytes(18).toString('hex');
    res.cookie('ga_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: isSecure(req), maxAge: 10 * 60 * 1000 });
    // Only allow a same-origin relative path (must start with a single '/', not '//') --
    // this is the standard guard against using this as an open redirect.
    const returnTo = /^\/(?!\/)/.test(String(req.query.returnTo || '')) ? String(req.query.returnTo) : '/admin/';
    res.cookie('ga_oauth_return_to', returnTo, { httpOnly: true, sameSite: 'lax', secure: isSecure(req), maxAge: 10 * 60 * 1000 });
    // admin-app never calls Google Forms/Drive APIs directly (confirmed: none of its
    // endpoints touch getRequestGoogleAccessToken or any Forms function) -- all its data
    // operations go through the .gs runtime, which runs under a separate identity model.
    // It only ever needs basic identity to know who's signed in, so it uses a narrower
    // scope and skips the forced re-consent prompt, avoiding the sensitive-scope warning
    // screens the desktop portal's own direct Forms/Drive access legitimately needs.
    const isLite = String(req.query.scope || '') === 'lite';
    const scope = isLite
      ? 'openid email profile'
      : 'openid email profile https://www.googleapis.com/auth/forms.responses.readonly https://www.googleapis.com/auth/forms.body.readonly https://www.googleapis.com/auth/drive.metadata.readonly';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getBaseUrl(req) + '/auth/google/callback',
      response_type: 'code',
      scope,
      state,
      access_type: 'offline',
      prompt: isLite ? 'select_account' : 'consent select_account',
      include_granted_scopes: 'true'
    });
    res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
  });
  app.get(['/auth/callback', '/auth/google/callback'], async (req, res) => {
    try {
      const state = req.query.state || '';
      if (!state || state !== req.cookies.ga_oauth_state) throw new Error('Google sign-in state did not match. Try signing in again.');
      const returnTo = /^\/(?!\/)/.test(String(req.cookies.ga_oauth_return_to || '')) ? String(req.cookies.ga_oauth_return_to) : '/admin/';
      const code = req.query.code;
      if (!code) throw new Error('Google did not return an authorization code.');
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: getBaseUrl(req) + '/auth/google/callback',
          grant_type: 'authorization_code'
        })
      });
      const token = await tokenRes.json();
      if (!tokenRes.ok) throw new Error('Google token exchange failed: ' + JSON.stringify(token));
      const infoRes = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token.id_token || ''));
      const info = await infoRes.json();
      if (!infoRes.ok) throw new Error('Google token verification failed: ' + JSON.stringify(info));
      if (info.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('Google token audience did not match this app.');
      const email = String(info.email || '').toLowerCase();
      if (!(await isEmailAllowed(email, redis))) throw new Error('This Google account is not allowed to access Support Schedules: ' + email);
      setAuthCookie(res, { email, name: info.name || '', picture: info.picture || '', accessToken: token.access_token || '', refreshToken: token.refresh_token || '', tokenExpiresAt: Date.now() + Math.max(0, Number(token.expires_in || 0) - 60) * 1000 }, req);
      res.clearCookie('ga_oauth_state');
      res.clearCookie('ga_oauth_return_to');
      res.redirect(returnTo);
    } catch (err) {
      res.status(401).send(renderError('Google sign-in failed', err));
    }
  });

  app.use((req, res, next) => {
    if (!isAuthEnabled()) return next();
    // BUGFIX: /app (the mobile app PWA) and its two OTP-gated endpoints were missing from
    // this allowlist, so they inherited the same Google-auth requirement as /admin even
    // though neither is meant to use Google auth at all. /app itself is public like /staff
    // (protected only by the OTP pairing flow once a device pairs — see
    // docs/PUSH_NOTIFICATIONS.md). The two /api/v05418y/app-pairing/* routes specifically
    // are the ones that must stay public: /generate is called from the already-public
    // Staff Portal, and /verify is called by the app itself, which has no Google auth
    // context at all — the single-use, short-lived code IS its credential, by design.
    // The other /api/v05418y/* routes (push/send, app-devices, communication-manager) are
    // deliberately NOT added here — those are admin-only and should stay behind auth.
    if (req.path === '/' || req.path === '/features' || req.path === '/pricing' || req.path === '/security' || req.path === '/privacy' || req.path === '/terms' || req.path === '/about' || req.path === '/mission' || req.path === '/api/contact-lead-v05418o' || req.path === '/api/communication/brevo-webhook-v05418q' || req.path === '/brand' || req.path.startsWith('/brand/') || req.path.startsWith('/healthz') || req.path.startsWith('/auth/') || req.path === '/staff' || req.path.startsWith('/staff/') || req.path.startsWith('/s/') || req.path === '/app' || req.path.startsWith('/app/') || req.path === '/admin-app' || req.path.startsWith('/admin-app/') || req.path === '/api/v05418y/app-pairing/generate' || req.path === '/api/v05418y/app-pairing/verify' || req.path === '/api/v05418y/app-pairing/auto-pair' || req.path === '/api/v05418y/app-pairing/setup-validate' || req.path === '/api/v05418y/vapid-public-key' || req.path === '/api/v05422/passcode-policy' || req.path === '/api/v05422/passcode-status' || req.path === '/api/v05422/passcode/set' || req.path === '/api/v05422/passcode/verify' || req.path === '/api/v05422/passcode/disable' || req.path === '/api/v05422/passcode/forgot' || req.path === '/api/v05422/passcode/reset-with-token' || req.path === '/api/v05422/passcode/force-complete' || req.path === '/api/v05418y/portal-data' || req.path === '/api/v05418y/portal-view' || req.path === '/api/v05418y/report-absence' || req.path === '/api/v05418y/app-devices/heartbeat' || req.path === '/api/v05418y/comm-preference' || req.path === '/api/v05418y/comm-preference/set' || req.path === '/api/v05418y/comm-email/set' || req.path === '/api/v05418y/comm-phone/set' || req.path === '/api/v05418y/inbox' || req.path === '/api/v05418y/inbox/dismiss') return next();
    const user = getRequestUser(req);
    if (user) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ ok: false, error: 'Authentication required.', loginUrl: '/auth/login' });
    return res.redirect('/auth/login');
  });

  app.get('/', (req, res) => {
    res.redirect(302, '/admin');
  });


  // v0.54.18cl: dynamic manifest for personalized App QR setup links. Some mobile
  // browsers install PWAs using the manifest's start_url instead of the exact scanned URL.
  // The previous static /app/manifest.json always started at /app/index.html, which meant
  // an installed home-screen app could lose pairSetup/setupSchool/setupStaff/setupToken and
  // fall back to the standard manual Pair Your Device screen. When the current app page was
  // opened from a staff-specific setup QR, point the manifest at a matching setup start_url
  // so the installed app can recover the pending auto-pair context on first launch.
  app.get('/app/setup-manifest.json', (req, res) => {
    const school = String(req.query.setupSchool || req.query.school || '').trim();
    const staff = String(req.query.setupStaff || req.query.staff || req.query.staffName || '').trim();
    const token = String(req.query.setupToken || req.query.staffToken || req.query.token || '').trim();
    let startUrl = '/app/index.html';
    if (school && staff && token) {
      startUrl = '/app/index.html?' + new URLSearchParams({ pairSetup: '1', setupSchool: school, setupStaff: staff, setupToken: token }).toString();
    }
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      name: 'Support Schedules',
      short_name: 'Schedules',
      description: 'Staff schedule, day-of coverage alerts, and emergency notifications.',
      start_url: startUrl,
      scope: '/app/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#f2f2f7',
      theme_color: '#0A2540',
      icons: [
        { src: '/app/icons/icon-180.png', sizes: '180x180', type: 'image/png' },
        { src: '/app/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/app/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    });
  });

  // PERFORMANCE: this app's own convention is to ship new features as new, uniquely
  // versioned filenames rather than editing an existing file in place, which would make a
  // long, aggressive cache safe. In practice that convention gets violated during normal
  // iterative development — including twice by this very session, editing
  // ga-redis-v05418aq-....js and ga-redis-v05418ar-....js in place across turns before
  // catching it — and a 1-year immutable cache turns that mistake into a bug a user can't
  // self-diagnose or fix short of a hard refresh, for up to a year. A short cache still
  // avoids re-fetching these files on every navigation within one browsing session (the
  // actual goal), while capping the blast radius of a same-filename mistake to an hour
  // instead of a year. Do NOT re-widen this back to a long "immutable" duration without also
  // reliably enforcing the new-filename-per-revision convention (e.g. a build step that
  // rejects overwriting an existing patch filename with different content).
  app.use(express.static(path.resolve(__dirname, '..', 'public'), {
    index: false,
    setHeaders(res, filePath) {
      if (/\/ga-redis-v[0-9a-z]+-.*\.js$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      } else if (/\.(png|jpg|jpeg|svg|ico|gif|webp)$/i.test(filePath)) {
        // True static brand/icon assets -- no version-numbered filename convention like the
        // ga-redis-v*.js files above, so 30 days (not a full year/immutable) caps how long a
        // future logo change could stay stale in a visitor's cache, while still avoiding
        // re-fetching these on every single page load in the meantime.
        res.setHeader('Cache-Control', 'public, max-age=2592000, must-revalidate');
      }
    }
  }));

  app.get(['/admin', '/admin/'], (req, res) => {
    // no-cache (not no-store): still forces the browser to revalidate with the server on
    // every request, so a new deploy is picked up immediately -- but unlike no-store, it
    // lets a matching ETag get a cheap, bodyless 304 instead of re-transferring the full
    // ~1.2MB file on every single page load/refresh. Confirmed via bandwidth investigation
    // (July 2026) that no-store was the largest single contributor to bandwidth usage.
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
  });

  // Mobile app (PWA prototype, see docs/PUSH_NOTIFICATIONS.md). Served from this same
  // Express app / same domain as the real API routes deliberately — a PWA calling its own
  // origin avoids CORS entirely, and it means "deploy the app" is just "deploy this app,"
  // no separate hosting/HTTPS setup needed. express.static has index:false above (needed
  // for /admin's own explicit routing), so /app and /app/ need the same explicit handling.
  app.get(['/app', '/app/'], (req, res) => {
    // no-cache: without an explicit policy this fell back to browser heuristics, risking
    // exactly the stale-PWA-after-deploy problem the /admin no-store fix (see above) was
    // originally written to solve. no-cache still forces revalidation on every request,
    // but the 304 fast path (see /admin) keeps that cheap when nothing's actually changed.
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.resolve(__dirname, '..', 'public', 'app', 'index.html'));
  });

  // Admin mobile app (PWA) -- separate from the staff app above. Authenticates via the
  // same Google OAuth session as the desktop admin (not a staffToken/pairing-code scheme),
  // since this is for the people who run the desktop admin, not staff.
  const SHORT_LINK_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // no 0/O/I/l/1
  function generateShortLinkCode(len) {
    const bytes = crypto.randomBytes(len || 9);
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += SHORT_LINK_ALPHABET[bytes[i] % SHORT_LINK_ALPHABET.length];
    return out;
  }

  app.post('/api/admin-app/sms-short-link', async (req, res) => {
    try {
      const school = await resolveAdminAppSchoolV05418BZ(req, req.body && req.body.school);
      const staffKey = String((req.body && (req.body.staff || req.body.staffKey)) || '').trim();
      if (!staffKey) throw new Error('Missing staff member.');
      const liveModel = await getLivePublishedScheduleModelV05418AM_(runtime, school);
      const status = await buildAdminAppCommunicationStatusV05418DX(req, school, liveModel);
      const candidate = ((status && status.rows) || []).find((r) => normalizeStaffNameV018(r.key || r.staff) === normalizeStaffNameV018(staffKey));
      if (!candidate || !candidate.staffPortalLink) throw new Error('Could not find a portal link for this staff member.');
      let code = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidateCode = generateShortLinkCode(9);
        const exists = await redis.get(`smslink:${candidateCode}`);
        if (!exists) { code = candidateCode; break; }
      }
      if (!code) throw new Error('Could not generate a unique link. Try again.');
      await redis.set(`smslink:${code}`, candidate.staffPortalLink);
      await redis.expire(`smslink:${code}`, 24 * 60 * 60);
      res.json({ ok: true, version: VERSION, shortUrl: `${getBaseUrl(req)}/s/${code}`, expiresInHours: 24 });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/s/:code', async (req, res) => {
    try {
      const code = String(req.params.code || '').trim();
      const target = code ? await redis.get(`smslink:${code}`) : null;
      if (!target) {
        res.status(404).type('html').send('<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Link expired</title><style>body{font-family:-apple-system,system-ui,sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}</style></head><body><div><h1 style="font-size:20px">This link has expired</h1><p style="color:rgba(255,255,255,.7);font-size:14px;line-height:1.5">The link provided to you via text message has expired. Please visit your Staff Portal or the Staff App to view your schedule.</p></div></body></html>');
        return;
      }
      res.redirect(302, target);
    } catch (err) { res.status(500).send('Something went wrong. Please try again or ask your administrator for a new link.'); }
  });

  app.get(['/admin-app', '/admin-app/'], (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.resolve(__dirname, '..', 'public', 'admin-app', 'index.html'));
  });

  // Resolves and validates a requested school against the authenticated admin's actual
  // access (via the existing getAllowedCampusesFastV5379 access-control function) --
  // deliberately stateless and explicit per call, rather than relying on the desktop's
  // session-based "selected campus" property, since every call here should be self-
  // contained and safe to reason about independently.
  async function resolveAdminAppSchoolV05418BZ(req, requestedCampusId) {
    const userEmail = getRequestUser(req)?.email || '';
    const ctx = await runtime.call('admin', 'getAllowedCampusesFastV5379', [], { userEmail });
    const campuses = (ctx && ctx.campuses) || [];
    let campus = null;
    if (requestedCampusId) campus = campuses.find((c) => String(c.campusId || '').toLowerCase() === String(requestedCampusId).toLowerCase()) || null;
    if (!campus) campus = ctx && ctx.currentCampus;
    if (!campus && campuses.length === 1) campus = campuses[0];
    if (!campus || !campus.spreadsheetId) throw new Error('No authorized school found. Ask an administrator to grant access.');
    return { campusId: campus.campusId, campusName: campus.campusName || campus.campusId, spreadsheetId: campus.spreadsheetId, allCampuses: campuses, userEmail };
  }

  app.get(['/api/v05418ej/publish-status', '/api/v05418el/publish-status', '/api/v05418em/publish-status'], async (req, res) => {
    try {
      const school = await resolveAdminAppSchoolV05418BZ(req, req.query.school || req.query.schoolId || req.query.campusId || req.query.selectedCampusId || '');
      let base = {};
      try {
        base = await runtime.call('admin', 'getSchedulePublishStatusFastV686m14', [{ campusId: school.campusId, schoolId: school.campusId, school: school.campusId, spreadsheetId: school.spreadsheetId }], { userEmail: school.userEmail, selectedSchool: { campusId: school.campusId, spreadsheetId: school.spreadsheetId } }) || {};
      } catch (_) {}
      const status = await buildPublishStatusFallbackV05418EI(redis, school.spreadsheetId, base || {}).catch(() => (base || {}));
      res.json(Object.assign({ ok: true, version: VERSION, school: { campusId: school.campusId, campusName: school.campusName }, spreadsheetId: school.spreadsheetId }, status || {}));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  async function buildAdminAppCommunicationStatusV05418DX(req, school, liveModelOverride) {
    const data = await buildCommunicationCandidatesV018(redis, req, school.campusId, school.spreadsheetId, liveModelOverride);
    const portalLatest = await readRedisSheetValues(redis, school.spreadsheetId, '_StaffPortalAccessLatest').catch(() => []);
    const portalByKey = new Map();
    for (let i = 1; i < (portalLatest || []).length; i++) {
      const r = portalLatest[i] || [];
      const key = normalizeStaffNameV018(String(r[0] || r[1] || '').trim());
      if (key) portalByKey.set(key, { lastViewed: String(r[2] || '').trim(), publishedAt: String(r[3] || '').trim() });
    }
    const devices = await readAppDevicesV05418Y(redis, school.spreadsheetId).catch(() => []);
    const deviceByKey = new Map();
    devices.forEach((d) => {
      const key = normalizeKeyV05418X(d.staffName || '');
      const prev = deviceByKey.get(key);
      if (!prev || String(d.lastSeenAt || d.pairedAt || '').localeCompare(String(prev.lastSeenAt || prev.pairedAt || '')) > 0) deviceByKey.set(key, d);
    });
    const publishedMs = parseDateLooseV027(data.publishedAt || '')?.getTime() || 0;
    const rows = (data.all || []).map((r) => {
      const key = normalizeStaffNameV018(r.staff || r.key || '');
      const portal = portalByKey.get(key) || null;
      const portalViewedMs = parseDateLooseV027(portal && portal.lastViewed || '')?.getTime() || 0;
      const portalPublished = portal && portal.publishedAt || '';
      const device = deviceByKey.get(normalizeKeyV05418X(r.staff || '')) || null;
      const appViewedMs = parseDateLooseV027(device && (device.lastSeenAt || device.pairedAt) || '')?.getTime() || 0;
      const viewedMs = Math.max(portalViewedMs, appViewedMs);
      let viewStatus = 'Not viewed';
      if (viewedMs && publishedMs && viewedMs >= publishedMs) viewStatus = 'Viewed current';
      else if (portalPublished && data.publishedAt && String(portalPublished).trim() === String(data.publishedAt).trim()) viewStatus = 'Viewed current';
      else if (viewedMs) viewStatus = 'Viewed older';
      return Object.assign({}, r, {
        key: r.key || key,
        portalLastViewed: portal ? portal.lastViewed : '',
        portalViewedPublishedAt: portal ? portal.publishedAt : '',
        viewStatus,
        appLastSeen: device ? (device.lastSeenAt || device.pairedAt || '') : '',
        appPlatform: device ? (device.platform || '') : ''
      });
    });
    const counts = Object.assign({}, data.counts || {});
    counts.viewedCurrent = rows.filter((r) => r.viewStatus === 'Viewed current').length;
    counts.viewedOlder = rows.filter((r) => r.viewStatus === 'Viewed older').length;
    counts.notViewedCurrent = rows.filter((r) => r.viewStatus !== 'Viewed current').length;
    counts.appPaired = rows.filter((r) => r.hasPushDevice).length;
    counts.changedEligible = rows.filter((r) => r.changed && !r.skipReason).length;
    return Object.assign({}, data, { rows, counts, school: { campusId: school.campusId, campusName: school.campusName }, version: VERSION });
  }

  function scheduleItemLabelV05418DW(it) { return cleanTextV018((it && (it.title || it.displayName || it.label || it.key || it.period || it.item)) || it || ''); }
  function scheduleRowLabelV05418DW(r) { return cleanTextV018((r && (r.title || r.period || r.item || r.label || r.block)) || ''); }
  function summarizeStaffCellV05418DW(row, views) {
    row = row || {};
    const students = Array.isArray(row.students) ? row.students.map(studentLabelV018).filter(Boolean).join('; ') : '';
    const loc = cleanTextV018(row.location || row.room || row.site || '');
    const rest = Array.isArray(row.restEvents) ? row.restEvents.map(ev => cleanTextV018((ev && (ev.time || ev.type || ev.role)) || '')).filter(Boolean).join('; ') : '';
    let raw = students || rest || cleanTextV018(row.detail || row.assignment || row.freeText || row.status || row.source || '');
    raw = replaceFreeLabelV028(raw, views);
    return [raw, loc ? '@ ' + loc : ''].filter(Boolean).join('\n');
  }
  function summarizeStudentCellV05418DW(row) {
    row = row || {};
    const staff = cleanTextV018(row.staff || '');
    const support = cleanTextV018(row.support || row.supportType || '');
    const loc = cleanTextV018(row.location || row.room || '');
    const bits = [];
    if (staff) bits.push(staff);
    if (loc || support) bits.push([loc, support].filter(Boolean).join(' · '));
    return bits.join('\n') || (/^(n\/?a|na|none|no support needed)$/i.test(support) ? 'No support needed' : '');
  }
  function buildAdminAppScheduleTableV05418DW(views, viewType) {
    views = views || {};
    if (viewType === 'breaks') return { columns: ['Time','Staff on break','Type','Coverage','Students / Location'], rows: (views.breakItems || []).map(b => ({ name: cleanScheduleDisplayValueV05418EG(b.time || ''), cells: [cleanScheduleDisplayValueV05418EG(b.time || ''), cleanScheduleDisplayValueV05418EG(b.staffOnBreak || b.staff || b.name || ''), restKindLabelV05418EG(b.type || 'Break'), cleanScheduleDisplayValueV05418EG(b.coveringStaff || ''), [cleanScheduleDisplayValueV05418EG(Array.isArray(b.students) ? b.students.join(', ') : (b.students || '')), cleanScheduleDisplayValueV05418EG(b.location || '')].filter(Boolean).join(' · ')] })) };
    const items = Array.isArray(views.items) ? views.items.map(scheduleItemLabelV05418DW).filter(Boolean) : [];
    const isStaff = viewType !== 'students';
    const records = isStaff ? (views.staffSchedules || []) : (views.studentSchedules || []);
    const columns = ['Name'].concat(items);
    const rows = records.map(rec => {
      const name = cleanTextV018((rec && (isStaff ? (rec.staff || rec.name) : (rec.student || rec.name))) || '');
      const byPeriod = new Map();
      (rec.rows || []).forEach(row => { byPeriod.set(scheduleRowLabelV05418DW(row), isStaff ? summarizeStaffCellV05418DW(row, views) : summarizeStudentCellV05418DW(row)); });
      return { name, cells: [name].concat(items.map(label => byPeriod.get(label) || '')) };
    }).filter(r => r.name);
    return { columns, rows };
  }
  function buildAdminAppScheduleViewV05418CB(views, viewType) {
    views = views || {};
    if (viewType === 'breaks') {
      const items = Array.isArray(views.breakItems) ? views.breakItems : [];
      return items.map((b) => {
        b = b || {};
        const who = cleanScheduleDisplayValueV05418EG(b.staffOnBreak || b.staff || b.name || '');
        const kind = restKindLabelV05418EG(b.type || b.breakType || b.notes || 'Break');
        const parts = [kind];
        const cover = cleanScheduleDisplayValueV05418EG(b.coveringStaff || '');
        const loc = cleanScheduleDisplayValueV05418EG(b.location || '');
        const students = cleanScheduleDisplayValueV05418EG(Array.isArray(b.students) ? b.students.join(', ') : b.students);
        if (cover) parts.push('covered by ' + cover);
        if (loc) parts.push('@ ' + loc);
        if (students) parts.push('with ' + students);
        const time = cleanScheduleDisplayValueV05418EG(b.time || '');
        return { name: who || kind, lines: [time + (time ? ': ' : '') + parts.filter(Boolean).join(' · ')] };
      }).filter((r) => r.name);
    }
    const isStaff = viewType !== 'students';
    const records = isStaff ? (Array.isArray(views.staffSchedules) ? views.staffSchedules : []) : (Array.isArray(views.studentSchedules) ? views.studentSchedules : []);
    return records.map((r) => {
      const name = cleanTextV018((r && (isStaff ? (r.staff || r.name) : (r.student || r.name))) || '');
      if (!name) return null;
      const lines = isStaff ? staffScheduleLinesV018(views, name) : studentScheduleLinesV018(views, name);
      return { name, lines };
    }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  }

  app.get('/api/admin-app/biometric/status', async (req, res) => {
    try {
      const email = getRequestUserEmail(req);
      if (!email) return res.json({ ok: true, enabled: false });
      const raw = await redis.get(`webauthn:cred:${email}`);
      res.json({ ok: true, enabled: !!raw });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/admin-app/biometric/register-options', async (req, res) => {
    try {
      const email = getRequestUserEmail(req);
      if (!email) throw new Error('Not signed in.');
      const rpId = String(req.get('host') || '').split(':')[0];
      const challenge = crypto.randomBytes(32).toString('base64url');
      await redis.set(`webauthn:challenge:${email}`, challenge);
      await redis.expire(`webauthn:challenge:${email}`, 300);
      res.json({
        ok: true,
        options: {
          rp: { name: 'Support Schedules Admin', id: rpId },
          user: { id: Buffer.from(email, 'utf8').toString('base64url'), name: email, displayName: email },
          challenge,
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000,
          attestation: 'none'
        }
      });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/admin-app/biometric/register-verify', async (req, res) => {
    try {
      const email = getRequestUserEmail(req);
      if (!email) throw new Error('Not signed in.');
      const body = req.body || {};
      const expectedChallenge = await redis.get(`webauthn:challenge:${email}`);
      if (!expectedChallenge) throw new Error('Registration challenge expired. Try again.');
      const origin = `${isSecure(req) ? 'https' : 'http'}://${req.get('host')}`;
      const rpId = String(req.get('host') || '').split(':')[0];
      const result = webauthn.verifyRegistration({
        attestationObjectBuf: Buffer.from(body.attestationObject || '', 'base64'),
        clientDataJSONBuf: Buffer.from(body.clientDataJSON || '', 'base64'),
        expectedChallenge, expectedOrigin: origin, expectedRpId: rpId
      });
      await redis.del(`webauthn:challenge:${email}`);
      await redis.set(`webauthn:cred:${email}`, JSON.stringify({ credId: result.credId, publicKeyJwk: result.publicKeyJwk, counter: result.counter, createdAt: new Date().toISOString() }));
      res.json({ ok: true });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/admin-app/biometric/auth-options', async (req, res) => {
    try {
      const email = getRequestUserEmail(req);
      if (!email) throw new Error('Not signed in.');
      const raw = await redis.get(`webauthn:cred:${email}`);
      if (!raw) throw new Error('Face ID / Touch ID is not set up for this account.');
      const cred = JSON.parse(raw);
      const challenge = crypto.randomBytes(32).toString('base64url');
      await redis.set(`webauthn:challenge:${email}`, challenge);
      await redis.expire(`webauthn:challenge:${email}`, 300);
      res.json({
        ok: true,
        options: {
          challenge,
          allowCredentials: [{ type: 'public-key', id: cred.credId }],
          userVerification: 'required',
          timeout: 60000
        }
      });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/admin-app/biometric/auth-verify', async (req, res) => {
    try {
      const email = getRequestUserEmail(req);
      if (!email) throw new Error('Not signed in.');
      const body = req.body || {};
      const expectedChallenge = await redis.get(`webauthn:challenge:${email}`);
      if (!expectedChallenge) throw new Error('Authentication challenge expired. Try again.');
      const raw = await redis.get(`webauthn:cred:${email}`);
      if (!raw) throw new Error('Face ID / Touch ID is not set up for this account.');
      const cred = JSON.parse(raw);
      const origin = `${isSecure(req) ? 'https' : 'http'}://${req.get('host')}`;
      const rpId = String(req.get('host') || '').split(':')[0];
      const result = webauthn.verifyAssertion({
        clientDataJSONBuf: Buffer.from(body.clientDataJSON || '', 'base64'),
        authenticatorDataBuf: Buffer.from(body.authenticatorData || '', 'base64'),
        signatureBuf: Buffer.from(body.signature || '', 'base64'),
        expectedChallenge, expectedOrigin: origin, expectedRpId: rpId,
        storedPublicKeyJwk: cred.publicKeyJwk, storedCounter: cred.counter || 0
      });
      await redis.del(`webauthn:challenge:${email}`);
      cred.counter = result.counter;
      await redis.set(`webauthn:cred:${email}`, JSON.stringify(cred));
      res.json({ ok: true });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/admin-app/biometric/disable', async (req, res) => {
    try {
      const email = getRequestUserEmail(req);
      if (!email) throw new Error('Not signed in.');
      await redis.del(`webauthn:cred:${email}`);
      await redis.del(`webauthn:challenge:${email}`);
      res.json({ ok: true });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/admin-app/bootstrap', async (req, res) => {
    try {
      const user = getRequestUser(req);
      const ctx = await runtime.call('admin', 'getAllowedCampusesFastV5379', [], { userEmail: user?.email || '' });
      const campuses = ((ctx && ctx.campuses) || []).map((c) => ({ campusId: c.campusId, campusName: c.campusName || c.campusId, spreadsheetId: c.spreadsheetId }));
      res.json({ ok: true, version: VERSION, user: { email: user?.email || '', name: user?.name || '' }, schools: campuses, defaultCampusId: (ctx && ctx.currentCampus && ctx.currentCampus.campusId) || (campuses[0] && campuses[0].campusId) || '' });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/admin-app/now', async (req, res) => {
    try {
      const school = await resolveAdminAppSchoolV05418BZ(req, req.query.school);
      const now = await runtime.call('admin', 'getNowTileV05418RB', [{ campusId: school.campusId, spreadsheetId: school.spreadsheetId }], { userEmail: school.userEmail, selectedSchool: { spreadsheetId: school.spreadsheetId } });

      const available = !!(now && now.isActivePeriod);
      const unavailableReason = !now || !now.hasPublishedSchedule
        ? 'No schedule has been published.'
        : (available ? '' : 'Current time is outside active schedule hours.');

      res.json({
        ok: true,
        version: VERSION,
        school: { campusId: school.campusId, campusName: school.campusName },
        available,
        unavailableReason,
        publishedAt: (now && now.publishedAt) || '',
        scheduleLabel: (now && now.scheduleLabel) || '',
        periodLabel: (now && now.periodLabel) || '',
        timeLabel: (now && now.timeLabel) || '',
        nextPeriodLabel: (now && now.nextPeriodLabel) || '',
        staffRows: (now && now.staffRows) || [],
        studentRows: (now && now.studentRows) || []
      });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/admin-app/absences', async (req, res) => {
    try {
      const school = await resolveAdminAppSchoolV05418BZ(req, req.query.school);
      const page = await runtime.call('admin', 'getDashboardPageFastV5443', [14, { campusId: school.campusId, spreadsheetId: school.spreadsheetId }], { userEmail: school.userEmail, selectedSchool: { spreadsheetId: school.spreadsheetId } });
      const summary = page.summary || {};
      res.json({ ok: true, version: VERSION, school: { campusId: school.campusId, campusName: school.campusName }, staffAbsences: summary.staffAbsences || [], studentAbsences: summary.studentAbsences || [], date: summary.date || '' });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/admin-app/communication-status', async (req, res) => {
    try {
      const school = await resolveAdminAppSchoolV05418BZ(req, req.query.school);
      const liveModel = await getLivePublishedScheduleModelV05418AM_(runtime, school);
      const status = await buildAdminAppCommunicationStatusV05418DX(req, school, liveModel);
      res.json(Object.assign({ ok: true }, status));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/admin-app/coverage-lapses', async (req, res) => {
    try {
      const school = await resolveAdminAppSchoolV05418BZ(req, req.query.school);
      const lapses = await runtime.call('admin', 'getCoverageLapsesV05418RB', [{ campusId: school.campusId, spreadsheetId: school.spreadsheetId }], { userEmail: school.userEmail, selectedSchool: { spreadsheetId: school.spreadsheetId } });
      const liveModel = await getLivePublishedScheduleModelV05418AM_(runtime, school);
      const status = await buildAdminAppCommunicationStatusV05418DX(req, school, liveModel).catch(() => null);
      const staffRows = ((status && status.rows) || []).map((r) => ({
        staff: r.staff,
        changed: !!r.changed,
        viewStatus: r.viewStatus || 'Not viewed',
        portalLastViewed: r.portalLastViewed || '',
        phone: r.phone || '',
        hasEmail: !!r.hasEmail,
        hasPushDevice: !!r.hasPushDevice,
        scheduleLines: Array.isArray(r.scheduleLines) ? r.scheduleLines.slice(0, 8) : []
      })).filter((r) => r.staff);
      res.json({
        ok: true,
        version: VERSION,
        school: { campusId: school.campusId, campusName: school.campusName },
        publishedAt: (lapses && lapses.publishedAt) || '',
        scheduleLabel: (lapses && lapses.scheduleLabel) || '',
        uncoveredStudents: (lapses && lapses.uncoveredStudents) || [],
        staffMissingBreak: (lapses && lapses.staffMissingBreak) || [],
        staffMissingLunch: (lapses && lapses.staffMissingLunch) || [],
        staffRows
      });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/admin-app/issues', async (req, res) => {
    try {
      const school = await resolveAdminAppSchoolV05418BZ(req, req.query.school);
      const page = await runtime.call('admin', 'getDashboardPageFastV5443', [14, { campusId: school.campusId, spreadsheetId: school.spreadsheetId }], { userEmail: school.userEmail, selectedSchool: { spreadsheetId: school.spreadsheetId } });
      const liveModel = await getLivePublishedScheduleModelV05418AM_(runtime, school);
      const status = await buildAdminAppCommunicationStatusV05418DX(req, school, liveModel).catch(() => null);
      const issues = [];
      const summary = page.summary || {};
      const hasPublished = !!liveModel.publishedAt;
      const unpublishedChanges = !!((page.publishStatus || {}).unpublishedChanges);
      if (!hasPublished) issues.push({ severity: 'High', title: 'No published schedule', detail: 'Staff cannot view a current published schedule yet.', action: 'Generate and publish a schedule.' });
      if (unpublishedChanges) issues.push({ severity: 'Medium', title: 'Unpublished schedule changes', detail: 'A draft schedule is newer than the published schedule.', action: 'Publish when ready for staff.' });
      const staffAbs = Array.isArray(summary.staffAbsences) ? summary.staffAbsences : [];
      if (staffAbs.length) issues.push({ severity: 'Medium', title: `${staffAbs.length} staff absence${staffAbs.length === 1 ? '' : 's'} today`, detail: staffAbs.slice(0, 3).map((r) => r.staff || r.name).filter(Boolean).join(', '), action: 'Confirm schedule coverage.' });
      const studentAbs = Array.isArray(summary.studentAbsences) ? summary.studentAbsences : [];
      if (studentAbs.length) issues.push({ severity: 'Medium', title: `${studentAbs.length} student absence${studentAbs.length === 1 ? '' : 's'} today`, detail: studentAbs.slice(0, 3).map((r) => r.student || r.name).filter(Boolean).join(', '), action: 'Confirm schedule coverage.' });
      if (status && status.counts) {
        if ((status.counts.notViewedCurrent || 0) > 0) issues.push({ severity: 'Medium', title: `${status.counts.notViewedCurrent} staff have not viewed current schedule`, detail: 'Schedule read status is incomplete.', action: 'Open Communication and send reminders.' });
        if ((status.counts.changedEligible || 0) > 0 && status.recommendedMode === 'changed') issues.push({ severity: 'Medium', title: `${status.counts.changedEligible} staff have schedule changes`, detail: 'Change-only communication is recommended.', action: 'Send changes only.' });
      }
      const lapses = await runtime.call('admin', 'getCoverageLapsesV05418RB', [{ campusId: school.campusId, spreadsheetId: school.spreadsheetId }], { userEmail: school.userEmail, selectedSchool: { spreadsheetId: school.spreadsheetId } }).catch(() => null);
      if (lapses) {
        const uc = lapses.uncoveredStudents || [];
        if (uc.length) issues.push({ severity: 'High', title: `${uc.length} uncovered student period${uc.length === 1 ? '' : 's'}`, detail: uc.slice(0, 3).map((r) => `${r.student} (${r.period})`).filter(Boolean).join(', '), action: 'Review the Coverage tab.' });
        const nb = lapses.staffMissingBreak || [];
        if (nb.length) issues.push({ severity: 'Medium', title: `${nb.length} staff missing a break`, detail: nb.slice(0, 3).join(', '), action: 'Review the Coverage tab.' });
        const nl = lapses.staffMissingLunch || [];
        if (nl.length) issues.push({ severity: 'Medium', title: `${nl.length} staff missing lunch`, detail: nl.slice(0, 3).join(', '), action: 'Review the Coverage tab.' });
      }
      if (!issues.length) issues.push({ severity: 'Done', title: 'No urgent issues found', detail: 'Today looks clear based on current dashboard, communication, and absence signals.', action: '' });
      res.json({ ok: true, version: VERSION, school: { campusId: school.campusId, campusName: school.campusName }, issues });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/admin-app/schedule', async (req, res) => {
    try {
      const school = await resolveAdminAppSchoolV05418BZ(req, req.query.school);
      const viewType = ['staff', 'students', 'breaks'].includes(String(req.query.view || '')) ? String(req.query.view) : 'staff';
      const mode = String(req.query.mode || 'published') === 'draft' ? 'draft' : 'published';

      const page = await runtime.call('admin', 'getDashboardPageFastV5443', [14, { campusId: school.campusId, spreadsheetId: school.spreadsheetId }], { userEmail: school.userEmail, selectedSchool: { spreadsheetId: school.spreadsheetId } });
      const hasDraft = !!((page.publishStatus || {}).unpublishedChanges);

      let views, publishedAt, scheduleLabel, dailyVersion;
      if (mode === 'draft' && hasDraft) {
        const draftViews = await runtime.call('admin', 'readWorkingScheduleViewsV686i_', [], { userEmail: school.userEmail, selectedSchool: { spreadsheetId: school.spreadsheetId } });
        views = draftViews || {};
        publishedAt = '';
        scheduleLabel = 'Unpublished draft';
        dailyVersion = 0;
      } else {
        const liveModel = await getLivePublishedScheduleModelV05418AM_(runtime, school);
        views = liveModel.views || {};
        publishedAt = liveModel.publishedAt || '';
        scheduleLabel = liveModel.scheduleLabel || '';
        dailyVersion = liveModel.dailyVersion || 0;
      }

      res.json({
        ok: true,
        version: VERSION,
        school: { campusId: school.campusId, campusName: school.campusName },
        mode,
        hasDraft,
        publishedAt,
        scheduleLabel,
        dailyVersion,
        view: viewType,
        rows: buildAdminAppScheduleViewV05418CB(views, viewType),
        table: buildAdminAppScheduleTableV05418DW(views, viewType)
      });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/admin-app/schedule/generate', async (req, res) => {
    try {
      const school = await resolveAdminAppSchoolV05418BZ(req, req.body && req.body.school);
      const result = await runtime.call('admin', 'runAllV5', [], { userEmail: school.userEmail, selectedSchool: { spreadsheetId: school.spreadsheetId } });
      res.json({ ok: true, version: VERSION, result: result || {} });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/admin-app/schedule/publish', async (req, res) => {
    try {
      const school = await resolveAdminAppSchoolV05418BZ(req, req.body && req.body.school);
      const result = await runtime.call('admin', 'publishCurrentSchedulesV5', [], { userEmail: school.userEmail, selectedSchool: { spreadsheetId: school.spreadsheetId } });
      res.json({ ok: true, version: VERSION, result: result || {} });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/calendar-manager', (req, res) => {
    res.type('html').send(renderStandaloneCalendarManagerV039());
  });

  app.get('/attendance-manager', (req, res) => {
    res.type('html').send(renderStandaloneAttendanceManagerV039());
  });

  app.get('/diag/calendar-attendance', (req, res) => {
    res.type('html').send(renderCalendarAttendanceDiagnosticsV039());
  });

  app.get('/api/functions', (req, res) => {
    res.json({ ok: true, admin: runtime.listFunctions('admin'), staff: runtime.listFunctions('staff'), connector: runtime.listFunctions('connector') });
  });

  app.get('/api/debug/persistence', async (req, res) => {
    try {
      const key = 'gas:debug:persistence';
      const before = await redis.get(key);
      const value = new Date().toISOString();
      await redis.set(key, value);
      const after = await redis.get(key);
      const keys = redis.keys ? await redis.keys('gas:*') : [];
      res.json({ ok: true, version: VERSION, redisMode: redis && redis.isMemory ? 'memory' : 'redis', before, wrote: value, after, keyCount: keys.length, sampleKeys: keys.slice(0, 25) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });


  app.get('/api/staff-portal/config', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      res.json({ ok: true, version: VERSION, publicRoute: '/staff', schools: cfg.schools, schoolKeys: Object.keys(cfg.schools || {}), tokenSecretConfigured: !!cfg.tokenSecret, tokenSecretSource: cfg.tokenSecretSource || '', staffPortalPublicWhenAdminAuthEnabled: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/staff-portal/link', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const staff = String(req.query.staff || req.query.staffName || '').trim();
      if (!school) throw new Error('Missing school. Add ?school=<school key>.');
      if (!staff) throw new Error('Missing staff. Add ?staff=<staff name>.');
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown staff portal school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      if (!cfg.tokenSecret) throw new Error('Staff portal token secret is not configured. Set STAFF_PORTAL_TOKEN_SECRET or allow the app to persist a generated secret.');
      let staffInfo = await findStaffPortalStaffRecord(redis, schoolRec.spreadsheetId, staff);
      let finalSchool = school;
      let finalSchoolRec = schoolRec;
      let resolvedFromDifferentSchool = false;
      if (!staffInfo) {
        const matches = await findStaffRecordAcrossSchools(redis, cfg, staff);
        const active = matches.filter(m => m.record && m.record.active);
        const pick = active[0] || matches[0];
        if (pick) {
          staffInfo = pick.record;
          finalSchool = pick.schoolKey;
          finalSchoolRec = pick.school;
          resolvedFromDifferentSchool = finalSchool !== school;
        }
      }
      const canonicalStaff = staffInfo && staffInfo.name ? staffInfo.name : staff;
      const tokenVersion = await getStaffTokenVersionV05421(redis, finalSchoolRec.spreadsheetId, canonicalStaff);
      const token = makeStaffPortalToken(finalSchool, canonicalStaff, cfg.tokenSecret, tokenVersion);
      const url = getBaseUrl(req) + '/staff?' + new URLSearchParams({ school: finalSchool, staff: canonicalStaff, staffToken: token, view: 'my' }).toString();
      const warningParts = [];
      if (resolvedFromDifferentSchool) warningParts.push('Staff was not found under school ' + school + '; link was generated for ' + finalSchool + '.');
      if (staffInfo && !staffInfo.active) warningParts.push('Staff record was found but is not active; the portal will show the name only after the Staff status is Active.');
      if (!staffInfo) warningParts.push('Staff was not found in any configured Redis Staff sheet.');
      res.json({ ok: true, school: finalSchool, requestedSchool: school, spreadsheetId: finalSchoolRec.spreadsheetId, staff: canonicalStaff, requestedStaff: staff, staffFound: !!staffInfo, staffActive: staffInfo ? !!staffInfo.active : null, staffStatus: staffInfo ? staffInfo.status : '', staffRowIndex: staffInfo ? staffInfo.rowIndex : null, token, url, warning: warningParts.join(' ') });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/staff-portal/active-staff', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown staff portal school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      let staff = await listStaffPortalStaff(redis, schoolRec.spreadsheetId);
      let fallbackUsed = false;
      if (!staff.filter(s => s.active).length) {
        const all = [];
        for (const key of Object.keys(cfg.schools || {})) {
          if (key === school) continue;
          const rec = cfg.schools[key];
          const rows = await listStaffPortalStaff(redis, rec.spreadsheetId);
          rows.forEach(r => all.push(Object.assign({ schoolKey: key }, r)));
        }
        if (all.filter(s => s.active).length) { staff = all; fallbackUsed = true; }
      }
      res.json({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, fallbackUsed, staff, activeStaff: staff.filter(s => s.active).map(s => s.name) });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });




  app.get('/api/history/list', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const resolved = resolveRegularDisplaySchoolV05413(cfg, req.query.school || req.query.schoolId || cfg.defaultSchoolId || '');
      const school = resolved.school;
      const schoolRec = resolved.schoolRec;
      const result = await runtime.call('admin', 'getScheduleHistoryForSpreadsheetRedisV015', [schoolRec.spreadsheetId], { userEmail: getRequestUserEmail(req) });
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId }, result || {}));
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/history/star', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const id = String((req.body && (req.body.id || req.body.historyId)) || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      if (!id) throw new Error('Missing historical schedule id.');
      const starredRaw = Object.prototype.hasOwnProperty.call(req.body || {}, 'starred') ? req.body.starred : req.body && req.body.favorite;
      const starred = starredRaw === true || /^true|1|yes|starred|favorite$/i.test(String(starredRaw || ''));
      const result = await runtime.call('admin', 'setScheduleHistoryStarRedisV015', [schoolRec.spreadsheetId, id, starred], { userEmail: getRequestUserEmail(req) });
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, id, starred }, result || {}));
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/history/regular-lock', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || (req.query && (req.query.school || req.query.schoolId)) || cfg.defaultSchoolId || '').trim();
      const id = String((req.body && (req.body.id || req.body.historyId)) || (req.query && (req.query.id || req.query.historyId)) || '').trim();
      const lockedRaw = (req.body && Object.prototype.hasOwnProperty.call(req.body, 'locked')) ? req.body.locked : (req.query && req.query.locked);
      const locked = lockedRaw === true || /^true|1|yes|locked$/i.test(String(lockedRaw || ''));
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      if (!id) throw new Error('Missing historical schedule id.');
      const result = await runtime.call('admin', 'setRegularScheduleHistoryStateRedisV015', [schoolRec.spreadsheetId, id, locked], { userEmail: getRequestUserEmail(req) });
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, id, locked }, result || {}));
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });


  app.get('/api/history/list-v016', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const result = await runtime.call('admin', 'getScheduleHistoryForSpreadsheetRedisV016', [schoolRec.spreadsheetId], { userEmail: getRequestUserEmail(req) });
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId }, result || {}));
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/history/star-row', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const rowNumber = Number((req.body && (req.body.row || req.body.rowNumber)) || 0);
      const id = String((req.body && (req.body.id || req.body.historyId)) || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      if (!rowNumber && !id) throw new Error('Missing historical schedule row/id.');
      const starredRaw = Object.prototype.hasOwnProperty.call(req.body || {}, 'starred') ? req.body.starred : req.body && req.body.favorite;
      const starred = starredRaw === true || /^true|1|yes|starred|favorite$/i.test(String(starredRaw || ''));
      const result = await runtime.call('admin', 'setScheduleHistoryStarByRowRedisV016', [schoolRec.spreadsheetId, rowNumber, id, starred], { userEmail: getRequestUserEmail(req) });
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, rowNumber, id, starred }, result || {}));
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/history/regular-lock-row', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const rowNumber = Number((req.body && (req.body.row || req.body.rowNumber)) || 0);
      const id = String((req.body && (req.body.id || req.body.historyId)) || '').trim();
      const lockedRaw = (req.body && Object.prototype.hasOwnProperty.call(req.body, 'locked')) ? req.body.locked : undefined;
      const locked = lockedRaw === true || /^true|1|yes|locked$/i.test(String(lockedRaw || ''));
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      if (!rowNumber && !id) throw new Error('Missing historical schedule row/id.');
      const result = await runtime.call('admin', 'setRegularScheduleHistoryStateByRowRedisV016', [schoolRec.spreadsheetId, rowNumber, id, locked], { userEmail: getRequestUserEmail(req) });
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, rowNumber, id, locked }, result || {}));
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });


  app.get('/api/history/list-v017', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const result = await runtime.call('admin', 'getScheduleHistoryForSpreadsheetRedisV017', [schoolRec.spreadsheetId], { userEmail: getRequestUserEmail(req) });
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId }, result || {}));
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/history/star-row-v017', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const rowNumber = Number((req.body && (req.body.row || req.body.rowNumber)) || 0);
      const id = String((req.body && (req.body.id || req.body.historyId)) || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      if (!rowNumber && !id) throw new Error('Missing historical schedule row/id.');
      const starredRaw = Object.prototype.hasOwnProperty.call(req.body || {}, 'starred') ? req.body.starred : req.body && req.body.favorite;
      const starred = starredRaw === true || /^true|1|yes|starred|favorite$/i.test(String(starredRaw || ''));
      const result = await runtime.call('admin', 'setScheduleHistoryStarByRowRedisV017', [schoolRec.spreadsheetId, rowNumber, id, starred], { userEmail: getRequestUserEmail(req) });
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, rowNumber, id, starred }, result || {}));
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/history/regular-lock-row-v017', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const rowNumber = Number((req.body && (req.body.row || req.body.rowNumber)) || 0);
      const id = String((req.body && (req.body.id || req.body.historyId)) || '').trim();
      const lockedRaw = (req.body && Object.prototype.hasOwnProperty.call(req.body, 'locked')) ? req.body.locked : undefined;
      const locked = lockedRaw === true || /^true|1|yes|locked$/i.test(String(lockedRaw || ''));
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      if (!rowNumber && !id) throw new Error('Missing historical schedule row/id.');
      const result = await runtime.call('admin', 'setRegularScheduleHistoryStateByRowRedisV017', [schoolRec.spreadsheetId, rowNumber, id, locked], { userEmail: getRequestUserEmail(req) });
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, rowNumber, id, locked }, result || {}));
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/history/debug-lock-v017', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const result = await runtime.call('admin', 'debugHistoryLockRedisV017', [schoolRec.spreadsheetId], { userEmail: getRequestUserEmail(req) });
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId }, result || {}));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/history/regular-v019', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const result = await buildRegularScheduleV019(redis, schoolRec.spreadsheetId);
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId }, result));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });


  app.get('/api/history/regular-v020', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const result = await buildRegularScheduleV019(redis, schoolRec.spreadsheetId);
      res.json(Object.assign({ ok: true, version: '0.22.0', school, spreadsheetId: schoolRec.spreadsheetId }, await buildRegularScheduleV022(redis, schoolRec.spreadsheetId)));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });


  app.get('/api/history/regular-v022', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const result = await buildRegularScheduleV022(redis, schoolRec.spreadsheetId);
      res.json(Object.assign({ ok: true, version: VERSION, school, spreadsheetId: schoolRec.spreadsheetId }, result));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/history/regular-display-v022', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const result = await buildRegularScheduleV022(redis, schoolRec.spreadsheetId);
      res.json(Object.assign({ ok: true, version: VERSION, school, spreadsheetId: schoolRec.spreadsheetId, displayOnStaffPortal: !!result.displayOnStaffPortal }, result));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/history/regular-display-v022', async (req, res) => {
    try {
      // v0.54.15: legacy Redis UI patch scripts still post here from hidden checkbox
      // change handlers. Those automatic posts can overwrite an explicit saved No with
      // Yes during page navigation. This legacy route is now read-through/no-op; the
      // visible Regular Schedule slider writes only through /api/v05415/regular-display.
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const requested = String((req.body && (req.body.school || req.body.schoolId || req.body.schoolName || req.body.spreadsheetId)) || cfg.defaultSchoolId || '').trim();
      const resolved = (typeof resolveRegularDisplaySchoolV05413 === 'function') ? resolveRegularDisplaySchoolV05413(cfg, requested) : { school: requested, schoolRec: cfg.schools[requested] };
      const school = resolved.school;
      const schoolRec = resolved.schoolRec;
      if (!schoolRec) throw new Error('Unknown school key: ' + requested + '. Known keys: ' + Object.keys(cfg.schools || {}).join(', '));
      const props = await readCampusScopedPropertiesFromRedis(redis, schoolRec.spreadsheetId);
      const raw = Object.prototype.hasOwnProperty.call(props, 'V5_DISPLAY_REGULAR_ON_STAFF_PORTAL') ? String(props.V5_DISPLAY_REGULAR_ON_STAFF_PORTAL) : '';
      const result = await buildRegularScheduleV022(redis, schoolRec.spreadsheetId);
      res.json(Object.assign({}, result, {
        ok: true, version: VERSION, school, spreadsheetId: schoolRec.spreadsheetId,
        displayOnStaffPortal: raw.toLowerCase() === 'true', savedRaw: raw,
        ignoredLegacyWrite: true, source: 'v05415-legacy-v022-post-noop'
      }));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });


  // V0.54.13 school resolver for Regular Schedule display persistence.
  // Accepts short code, school id/name, selected-school labels, and spreadsheet/data-store ids.
  function resolveRegularDisplaySchoolV05413(cfg, requested) {
    const raw = String(requested || cfg.defaultSchoolId || '').trim();
    const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (raw && cfg.schools && cfg.schools[raw]) return { school: raw, schoolRec: cfg.schools[raw], requested: raw, matchedBy: 'key' };
    const want = norm(raw);
    const entries = Object.entries(cfg.schools || {});
    for (const [key, rec] of entries) {
      const aliases = [
        key,
        rec && rec.schoolId,
        rec && rec.shortCode,
        rec && rec.id,
        rec && rec.school,
        rec && rec.schoolName,
        rec && rec.name,
        rec && rec.spreadsheetId,
        rec && rec.dataStoreName
      ].filter(Boolean);
      if (aliases.some(a => norm(a) === want)) return { school: key, schoolRec: rec, requested: raw, matchedBy: 'alias' };
    }
    throw new Error('Unknown school key: ' + raw + '. Known keys: ' + Object.keys(cfg.schools || {}).join(', '));
  }

  // V0.54.12 explicit Regular Schedule Staff Portal display persistence.
  // This is server-side only and preserves intentional false/No values.
  app.get(['/api/v05412/regular-display','/api/v05413/regular-display','/api/v05414/regular-display','/api/v05415/regular-display','/api/v05416/regular-display','/api/v05417/regular-display','/api/v05418/regular-display'], async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const resolved = resolveRegularDisplaySchoolV05413(cfg, req.query.school || req.query.schoolId || cfg.defaultSchoolId || '');
      const school = resolved.school;
      const schoolRec = resolved.schoolRec;
      const props = await readCampusScopedPropertiesFromRedis(redis, schoolRec.spreadsheetId);
      const hasSaved = Object.prototype.hasOwnProperty.call(props, 'V5_DISPLAY_REGULAR_ON_STAFF_PORTAL');
      const raw = hasSaved ? String(props.V5_DISPLAY_REGULAR_ON_STAFF_PORTAL) : '';
      const result = await buildRegularScheduleV022(redis, schoolRec.spreadsheetId);
      res.json(Object.assign({}, result, {
        ok: true,
        version: VERSION,
        school,
        spreadsheetId: schoolRec.spreadsheetId,
        hasSavedValue: hasSaved,
        displayOnStaffPortal: raw.toLowerCase() === 'true',
        savedRaw: raw,
        source: 'v05418-campus-property-no-default-yes', matchedBy: (typeof resolved !== 'undefined' ? resolved.matchedBy : '')
      }));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.post(['/api/v05412/regular-display','/api/v05413/regular-display','/api/v05414/regular-display','/api/v05415/regular-display','/api/v05416/regular-display','/api/v05417/regular-display','/api/v05418/regular-display'], async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const resolved = resolveRegularDisplaySchoolV05413(cfg, (req.body && (req.body.school || req.body.schoolId || req.body.schoolName || req.body.spreadsheetId)) || cfg.defaultSchoolId || '');
      const school = resolved.school;
      const schoolRec = resolved.schoolRec;
      const raw = req.body && Object.prototype.hasOwnProperty.call(req.body, 'display') ? req.body.display : (req.body && req.body.displayOnStaffPortal);
      const display = raw === true || /^(true|1|yes|on|enabled)$/i.test(String(raw || '').trim());
      const props = await readCampusScopedPropertiesFromRedis(redis, schoolRec.spreadsheetId);
      props.V5_DISPLAY_REGULAR_ON_STAFF_PORTAL = display ? 'true' : 'false';
      await writeCampusScopedPropertiesToRedis(redis, schoolRec.spreadsheetId, props);
      const savedProps = await readCampusScopedPropertiesFromRedis(redis, schoolRec.spreadsheetId);
      const savedRaw = String(savedProps.V5_DISPLAY_REGULAR_ON_STAFF_PORTAL || '');
      const result = await buildRegularScheduleV022(redis, schoolRec.spreadsheetId);
      res.json(Object.assign({}, result, {
        ok: true,
        version: VERSION,
        school,
        spreadsheetId: schoolRec.spreadsheetId,
        requestedDisplay: display,
        displayOnStaffPortal: savedRaw.toLowerCase() === 'true',
        savedRaw,
        source: 'v05418-campus-property-no-default-yes', matchedBy: (typeof resolved !== 'undefined' ? resolved.matchedBy : '')
      }));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  const emailLockThrottleCache = new Map();
  app.get('/api/staff/email-v022', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const staff = String(req.query.staff || req.query.staffName || '').trim();
      const rowIndex = Number(req.query.rowIndex || req.query.row || 0) || 0;
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const throttleKey = school + '|' + staff + '|' + rowIndex;
      const cached = emailLockThrottleCache.get(throttleKey);
      if (cached && Date.now() - cached.at < 2000) return res.json(cached.body);
      const rec = await findStaffEmailRecordV022(redis, schoolRec.spreadsheetId, staff, rowIndex);
      const body = !rec
        ? { ok: true, school, spreadsheetId: schoolRec.spreadsheetId, staff, rowIndex, found: false, email: '', locked: false }
        : { ok: true, version: VERSION, school, spreadsheetId: schoolRec.spreadsheetId, staff: rec.name, rowIndex: rec.rowIndex, found: true, email: rec.email, status: rec.status, locked: !!rec.locked };
      emailLockThrottleCache.set(throttleKey, { at: Date.now(), body });
      res.json(body);
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/staff/phone-v05418ph', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const staff = String((req.body && (req.body.staff || req.body.staffName || req.body.name)) || '').trim();
      const rowIndex = Number((req.body && (req.body.rowIndex || req.body.row)) || 0) || 0;
      const phone = String((req.body && req.body.phone) || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const result = await saveStaffPhoneV05418PHDirect(redis, schoolRec.spreadsheetId, staff, rowIndex, phone);
      res.json(Object.assign({ ok: true, version: VERSION, school, spreadsheetId: schoolRec.spreadsheetId }, result));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/staff/email-v022', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const staff = String((req.body && (req.body.staff || req.body.staffName || req.body.name)) || '').trim();
      const rowIndex = Number((req.body && (req.body.rowIndex || req.body.row)) || 0) || 0;
      const email = String((req.body && (req.body.email || req.body.notificationEmail)) || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const result = await saveStaffEmailV022(redis, schoolRec.spreadsheetId, staff, rowIndex, email);
      res.json(Object.assign({ ok: true, version: VERSION, school, spreadsheetId: schoolRec.spreadsheetId }, result));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/staff/email-lock-v025', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const staff = String((req.body && (req.body.staff || req.body.staffName || req.body.name)) || '').trim();
      const rowIndex = Number((req.body && (req.body.rowIndex || req.body.row)) || 0) || 0;
      const lockedRaw = req.body && Object.prototype.hasOwnProperty.call(req.body, 'locked') ? req.body.locked : req.body && req.body.lock;
      const locked = lockedRaw === true || /^true|1|yes|on|locked$/i.test(String(lockedRaw || ''));
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const rec = await findStaffEmailRecordV022(redis, schoolRec.spreadsheetId, staff, rowIndex);
      const finalStaff = rec && rec.name ? rec.name : staff;
      const finalRow = rec && rec.rowIndex ? rec.rowIndex : rowIndex;
      if (!finalStaff) throw new Error('Choose a staff member before changing the email lock.');
      await writeStaffEmailLockV025(redis, schoolRec.spreadsheetId, finalStaff, finalRow, locked);
      res.json({ ok: true, version: VERSION, school, spreadsheetId: schoolRec.spreadsheetId, staff: finalStaff, rowIndex: finalRow, locked });
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });


  app.get('/api/staff-portal/debug'
, async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const staffName = String(req.query.staff || req.query.staffName || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown staff portal school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const values = await readRedisSheetValues(redis, schoolRec.spreadsheetId, 'Staff');
      const headers = Array.isArray(values[0]) ? values[0] : [];
      const staff = await listStaffPortalStaff(redis, schoolRec.spreadsheetId);
      const rec = staffName ? await findStaffPortalStaffRecord(redis, schoolRec.spreadsheetId, staffName) : null;
      res.json({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, headers, rowCount: values.length, sampleRows: values.slice(0, 6), staff, activeStaff: staff.filter(s => s.active).map(s => s.name), requestedStaff: staffName, requestedRecord: rec });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });


  app.get('/api/db-editor/sheets', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const sheets = await listRedisSheets(redis, schoolRec.spreadsheetId);
      const allowed = ['Staff','Students','Attendance','Calendar','Campus Settings'];
      const ordered = allowed.filter(x => sheets.includes(x));
      res.json({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, sheets: ordered, note: 'Redis Data Editor is intentionally limited to core editable tables.' });
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });


  app.get('/api/v05418x/student-advanced', async (req, res) => {
    try {
      // BUGFIX: this used to do a raw, exact-match-only cfg.schools[school] lookup, which
      // has no fallback to the default school, no matching by spreadsheetId, and no alias/
      // fuzzy matching — unlike resolveSchoolContextV027 (used correctly by, e.g.,
      // /api/v05418af/period-meta below), which tries all of those before giving up. The
      // admin portal's own campus selector can return an identifier (a campus id) that
      // doesn't exactly match a Staff-Portal-style school key, which made this endpoint
      // fail with "Unknown school key" even when the school was perfectly resolvable —
      // likely why 2:1 second-staff saves and Agency Manager could silently not work.
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const student = String(req.query.student || req.query.studentName || '').trim();
      const rows = await readStudentAdvancedRowsV05418X(redis, ctx.spreadsheetId);
      const rec = student ? (rows.find(r => normalizeKeyV05418X(r.student) === normalizeKeyV05418X(student)) || null) : null;
      res.json(Object.assign({ ok: true, version: VERSION, student, rows, record: rec }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05418x/student-advanced', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const result = await saveStudentAdvancedRecordV05418X(redis, ctx.spreadsheetId, body);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), result));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/v05418af/period-meta', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const source = await buildPeriodDisplaySourceRedisV05418AF(redis, ctx.spreadsheetId);
      res.json(Object.assign({ ok: true, version: VERSION, periodDisplaySource: 'v05418af-redis-direct' }, ctxPublicV027(ctx), source));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05418af/period-meta', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const incomingRows = Array.isArray(body.rows) ? body.rows : (Array.isArray(body.periodMeta) ? body.periodMeta : []);
      const cleanedRows = normalizePeriodMetaRowsV05418AF(incomingRows);
      const props = await readCampusScopedPropertiesFromRedis(redis, ctx.spreadsheetId);
      props.V5_PERIOD_META_JSON = JSON.stringify(cleanedRows);
      props.V5_PERIOD_META_UPDATED_AT_V05418AF = new Date().toISOString();
      props.V5_PERIOD_META_UPDATED_BY_V05418AF = getRequestUserEmail(req) || '';
      await writeCampusScopedPropertiesToRedis(redis, ctx.spreadsheetId, props);
      await appendAdminActivityLogV027(redis, ctx.spreadsheetId, 'Period setup saved', 'Bell Schedule Manager', getRequestUserEmail(req), 'Saved ' + cleanedRows.length + ' period display/block row(s).');
      const source = await buildPeriodDisplaySourceRedisV05418AF(redis, ctx.spreadsheetId);
      res.json(Object.assign({ ok: true, version: VERSION, message: 'Period setup saved.', saved: cleanedRows.length, periodDisplaySource: 'v05418af-redis-direct-save' }, ctxPublicV027(ctx), source));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/v05418x/agencies', async (req, res) => {
    try {
      // BUGFIX: same fix as /api/v05418x/student-advanced above — resolveSchoolContextV027
      // instead of a brittle exact-match-only lookup. This is very likely why the Agency
      // Manager page appeared functionally empty (no rows, no icon, nothing) even after the
      // duplicate-nav-entry issue was fixed: the request was failing school resolution
      // entirely, and the client only surfaced that in small muted text easy to miss.
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const rows = await readAgencyRowsV05418X(redis, ctx.spreadsheetId);
      const students = await readStudentNamesV05418X(redis, ctx.spreadsheetId);
      res.json(Object.assign({ ok: true, version: VERSION, rows, students }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05418x/agencies', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const rows = Array.isArray(body.rows) ? body.rows : [];
      await writeAgencyRowsV05418X(redis, ctx.spreadsheetId, rows);
      res.json(Object.assign({ ok: true, version: VERSION, rows: rows.length, message: 'Agency Manager saved.' }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // V05418Y — mobile app pairing (OTP) and push. See docs/PUSH_NOTIFICATIONS.md for the
  // full design and what still needs configuring (VAPID keys, npm install) before real
  // push delivery works — these routes are fully functional today for everything except
  // the last mile of actually reaching a device.

  // Called from the Staff Portal's own settings popup (staff-authenticated via their
  // existing portal token — the same makeStaffPortalToken() check already used by the
  // rest of the Staff Portal, not a new auth mechanism). Generates a short-lived, single-
  // use pairing code for that one staff member.
  // Public by design (the public key is meant to be public — same reason it's called
  // "public key"). Lets the app fetch the current key at runtime instead of hardcoding it,
  // so rotating VAPID_PUBLIC_KEY on the server doesn't require an app update.
  app.get('/api/v05418y/vapid-public-key', (req, res) => {
    res.json({ ok: true, version: VERSION, publicKey: String(process.env.VAPID_PUBLIC_KEY || '').trim() });
  });

  app.post('/api/v05418y/app-pairing/generate', async (req, res) => {
    try {
      const body = req.body || {};
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(body.school || body.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school);
      const staffName = String(body.staffName || body.staff || '').trim();
      const staffToken = String(body.staffToken || body.token || '').trim();
      if (!staffName || !staffToken) throw new Error('Missing staff name or token.');
      const tokenVersion = await getStaffTokenVersionV05421(redis, schoolRec.spreadsheetId, staffName);
      const expected = makeStaffPortalToken(school, staffName, cfg.tokenSecret, tokenVersion);
      if (staffToken !== expected) throw new Error('This staff link is not valid. Open your current Staff Portal link and try again.');
      const result = await createAppPairingCodeV05418Y(redis, school, schoolRec.spreadsheetId, staffName);
      res.json({ ok: true, version: VERSION, code: result.code, expiresInSeconds: result.expiresInSeconds, expiresAt: result.expiresAt });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Called by the app itself once the staff member enters the code shown above. No staff-
  // portal auth context exists yet at this point — the single-use, short-lived code IS the
  // credential, same as any OTP pairing flow. Exchanges it for a persistent device
  // registration (keyed off the push subscription's own endpoint, not a client-chosen ID).
  //
  // BUGFIX (no more "type your school"): the code alone (looked up globally, see
  // consumeAppPairingCodeV05418Y) now identifies both the school and the staff member, so
  // this no longer needs — or accepts — a school field from the request at all. It also now
  // returns a real staffToken (the exact same one the Staff Portal itself uses, via
  // makeStaffPortalToken), so the app can reuse it for every subsequent authenticated call
  // (fetching schedule data, reporting an absence) without inventing a second auth scheme.
  app.post('/api/v05418y/app-pairing/verify', async (req, res) => {
    try {
      const body = req.body || {};
      const code = String(body.code || '').trim();
      if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code shown in your Staff Portal.');
      const match = await consumeAppPairingCodeV05418Y(redis, code);
      if (!match) throw new Error('That code is invalid or has expired. Generate a new one from your Staff Portal.');
      const device = await registerAppDeviceV05418Y(redis, match.spreadsheetId, { staffName: match.staffName, subscription: body.subscription, platform: body.platform, clientDeviceId: body.clientDeviceId });
      await setAppRevocationV05418Y(redis, match.spreadsheetId, match.staffName, false);
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const tokenVersion = await getStaffTokenVersionV05421(redis, match.spreadsheetId, device.staffName);
      const staffToken = makeStaffPortalToken(match.school, device.staffName, cfg.tokenSecret, tokenVersion);
      const schoolRec = cfg.schools[match.school];
      const schoolName = (schoolRec && schoolRec.name) || match.school;
      await recordSecurityAccessV05422(redis, match.spreadsheetId, device.staffName, 'app-pair', getClientIpV05422(req), req.get('user-agent'));
      await appendSecurityEventV05422(redis, match.spreadsheetId, device.staffName, 'App paired', device.platform || 'Device paired');
      res.json({ ok: true, version: VERSION, staffName: device.staffName, school: match.school, schoolName, staffToken, deviceId: device.deviceId });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Scanning a QR code with the same phone the app will run on has no "second screen" to
  // relay a code across -- the phone doing the scanning IS the device being paired. So
  // rather than making that phone display a 6-digit code it then has to type into itself,
  // this validates the same long-lived staffToken the personal portal QR already carries
  // (proof this request legitimately belongs to this staff member) and registers the
  // device directly. Revoking a staff member's token (see /api/v05421/staff-token/revoke)
  // invalidates this exactly the same way it invalidates their portal link.
  // Validates a QR setup token without registering a device. The app uses this before
  // showing the Add-to-Home-Screen / Auto-pairing screen so revoked or stale QR codes fall
  // straight through to normal manual pairing instead of looking usable until Pair & Setup.
  app.post('/api/v05418y/app-pairing/setup-validate', async (req, res) => {
    try {
      const body = req.body || {};
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(body.school || body.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school);
      const staffName = String(body.staffName || body.staff || '').trim();
      const staffToken = String(body.staffToken || body.token || '').trim();
      if (!staffName || !staffToken) throw new Error('Missing staff name or token.');
      const tokenVersion = await getStaffTokenVersionV05421(redis, schoolRec.spreadsheetId, staffName);
      const expected = makeStaffPortalToken(school, staffName, cfg.tokenSecret, tokenVersion);
      if (staffToken !== expected) {
        res.status(400).json({ ok: false, version: VERSION, revoked: true, error: 'This app setup QR is no longer valid. Pair this device with a code from your Staff Portal.' });
        return;
      }
      res.json({ ok: true, version: VERSION, staffName, school, schoolName: schoolRec.name || school });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05418y/app-pairing/auto-pair', async (req, res) => {
    try {
      const body = req.body || {};
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(body.school || body.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school);
      const staffName = String(body.staffName || body.staff || '').trim();
      const staffToken = String(body.staffToken || body.token || '').trim();
      if (!staffName || !staffToken) throw new Error('Missing staff name or token.');
      const autoPairTokenVersion = await getStaffTokenVersionV05421(redis, schoolRec.spreadsheetId, staffName);
      const expected = makeStaffPortalToken(school, staffName, cfg.tokenSecret, autoPairTokenVersion);
      if (staffToken !== expected) throw new Error('This pairing link is no longer valid. Ask your scheduler or site lead for a current one.');
      const device = await registerAppDeviceV05418Y(redis, schoolRec.spreadsheetId, { staffName, subscription: body.subscription, platform: body.platform, clientDeviceId: body.clientDeviceId });
      await setAppRevocationV05418Y(redis, schoolRec.spreadsheetId, staffName, false);
      const schoolName = schoolRec.name || school;
      await recordSecurityAccessV05422(redis, schoolRec.spreadsheetId, staffName, 'app-auto-pair', getClientIpV05422(req), req.get('user-agent'));
      await appendSecurityEventV05422(redis, schoolRec.spreadsheetId, staffName, 'App auto-paired', device.platform || 'Device paired from QR');
      res.json({ ok: true, version: VERSION, staffName: device.staffName, school, schoolName, staffToken, deviceId: device.deviceId });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // FEATURE: real schedule data for the app (My Schedule, Staff Schedules, Student
  // Schedules, Break Schedule, Regular Schedule) — all of it, in one call, because
  // getStaffPortalDataPublic already computes all of it in one call for the Staff Portal's
  // own HTML rendering. This calls that exact same function via the same .gs runtime path
  // the Staff Portal routes already use (see renderStaffPortalRouteV05418O above) and
  // returns the raw JSON instead of rendering it to HTML — no schedule logic duplicated.
  // Authenticated with the same staffToken the app received from /app-pairing/verify.
  app.get('/api/v05418y/portal-data', async (req, res) => {
    try {
      const query = await normalizeStaffPortalQuery(redis, req.query || {});
      const staffSchool = await selectedSchoolContextForStaffPortalV026(redis, query);
      if (!staffSchool) throw new Error('Unknown school.');
      const data = await runtime.call('staff', 'getStaffPortalDataPublic', [query], { userEmail: getRequestUserEmail(req), selectedSchool: staffSchool });
      const hasStaffIdentity = !!(data && data.staffIdentity && data.staffIdentity.valid && data.staffIdentity.staffName);
      const regular = (data && data.regularSchedule) || {};
      const hasRegular = !!(regular.displayOnStaffPortal && regular.schedules && regular.schedules.length);
      res.json(Object.assign({ ok: true, version: VERSION, hasStaffIdentity, hasRegular }, data));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/v05418ef/staff-schedule-lines', async (req, res) => {
    try {
      const query = await normalizeStaffPortalQuery(redis, req.query || {});
      const staffSchool = await selectedSchoolContextForStaffPortalV026(redis, query);
      if (!staffSchool) throw new Error('Unknown school.');
      const model = await getPublishedScheduleModelV018(redis, staffSchool.spreadsheetId);
      const lines = staffScheduleLinesV018(model.views || {}, query.staff || query.staffName);
      const splitLines = splitAwareStaffLinesV05418EF(model.views || {}, query.staff || query.staffName);
      res.json({ ok: true, version: VERSION, lines, splitLines, html: splitAwareScheduleCardHtmlV05418EF(splitLines) });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // FEATURE: renders one specific tab's real HTML (My Schedule / Staff Schedules / Student
  // Schedules / Break Schedule / Regular Schedule) using renderPublicPortalView_ — the exact
  // same dispatcher function the Staff Portal itself uses for these tabs. Deliberately reuses
  // the real rendering rather than re-deriving the underlying room-grouping, break/coverage-
  // matching, and title-parsing logic natively in the app: this data represents real student
  // coverage assignments, and a simplified reimplementation risks silently dropping or
  // misrepresenting something a subtler original renderer accounts for. "absence" is
  // deliberately NOT included here — the real absence view is an HTML <form> that posts back
  // to the .gs Web App's own URL, which won't work embedded in the app; the app has its own
  // native absence form instead, posting to /api/v05418y/report-absence.
  app.get('/api/v05418y/portal-view', async (req, res) => {
    try {
      const view = String(req.query.view || 'my').trim();
      if (!['my', 'staff', 'students', 'breaks', 'regular'].includes(view)) throw new Error('Unknown view: ' + view);
      const query = await normalizeStaffPortalQuery(redis, req.query || {});
      const staffSchool = await selectedSchoolContextForStaffPortalV026(redis, query);
      if (!staffSchool) throw new Error('Unknown school.');
      const rpcOpts = { userEmail: getRequestUserEmail(req), selectedSchool: staffSchool };
      const data = await runtime.call('staff', 'getStaffPortalDataPublic', [query], rpcOpts);
      const regularIndex = Math.max(0, Number(req.query.regularIndex || 0) || 0);
      let html = await runtime.call('staff', 'renderPublicPortalView_', [view, data, query.school, query.staff || query.staffName, query.staffToken, regularIndex], rpcOpts);
      if (view === 'my') html = (await splitAwareStaffScheduleCardForRequestV05418EF(redis, staffSchool, query)) + html;
      res.json({ ok: true, version: VERSION, view, html });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // FEATURE: Report Absence from the app, calling the exact same submitStaffAbsencePublic
  // the Staff Portal's own absence form uses — same validation, same _AttendanceLog write,
  // nothing new to keep in sync between the two entry points.
  app.post('/api/v05418y/report-absence', async (req, res) => {
    try {
      const body = req.body || {};
      const query = await normalizeStaffPortalQuery(redis, { school: body.school, staffName: body.staffName, staffToken: body.staffToken });
      const staffSchool = await selectedSchoolContextForStaffPortalV026(redis, query);
      if (!staffSchool) throw new Error('Unknown school.');
      const payload = Object.assign({}, body, { school: query.school, staffName: query.staffName, staffToken: query.staffToken });
      const result = await runtime.call('staff', 'submitStaffAbsencePublic', [payload], { userEmail: getRequestUserEmail(req), selectedSchool: staffSchool });
      res.json(Object.assign({ ok: true, version: VERSION }, result));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // App-facing: lets the app's own Profile screen save the staff member's notification
  // email, reusing the exact same save/validation logic (active staff only, respects an
  // admin-set lock, valid-email check) the Staff Portal's own email form already uses --
  // not a second, parallel way of writing this value.
  app.post('/api/v05418y/comm-email/set', async (req, res) => {
    try {
      const body = req.body || {};
      const query = await normalizeStaffPortalQuery(redis, { school: body.school, staffName: body.staffName, staffToken: body.staffToken });
      const staffSchool = await selectedSchoolContextForStaffPortalV026(redis, query);
      if (!staffSchool) throw new Error('Unknown school.');
      const staffName = String(query.staffName || query.staff || '').trim();
      if (!staffName) throw new Error('This staff link is not valid. Open your current Staff Portal link and try again.');
      const rec = await findStaffEmailRecordV022(redis, staffSchool.spreadsheetId, staffName, 0);
      if (rec && rec.locked) throw new Error('This email address is locked by an administrator. Ask an administrator to change it.');
      const result = await saveStaffEmailV022(redis, staffSchool.spreadsheetId, staffName, 0, body.notificationEmail || body.email || '');
      res.json(Object.assign({ ok: true, version: VERSION }, result));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05418y/comm-phone/set', async (req, res) => {
    try {
      const body = req.body || {};
      const query = await normalizeStaffPortalQuery(redis, { school: body.school, staffName: body.staffName, staffToken: body.staffToken });
      const staffSchool = await selectedSchoolContextForStaffPortalV026(redis, query);
      if (!staffSchool) throw new Error('Unknown school.');
      const staffName = String(query.staffName || query.staff || '').trim();
      if (!staffName) throw new Error('This staff link is not valid. Open your current Staff Portal link and try again.');
      const result = await saveStaffPhoneV05418PHDirect(redis, staffSchool.spreadsheetId, staffName, 0, body.phone || '');
      res.json(Object.assign({ ok: true, version: VERSION }, result));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Read-only device linkage status, for the Communication Manager column and (later)
  // Staff Manager. Deliberately does not return the raw push subscription (endpoint URLs
  // are effectively bearer credentials for sending that device push) — just enough for an
  // admin to see who's paired.
  const appDevicesThrottleCache = new Map();
  app.get('/api/v05418y/app-devices', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const throttleKey = String(ctx.spreadsheetId || '');
      const cached = appDevicesThrottleCache.get(throttleKey);
      if (cached && Date.now() - cached.at < 2000) return res.json(cached.body);
      const devices = await readAppDevicesV05418Y(redis, ctx.spreadsheetId);
      const rows = devices.map((d) => ({ staffName: d.staffName, platform: d.platform, pairedAt: d.pairedAt, lastSeenAt: d.lastSeenAt }));
      const body = Object.assign({ ok: true, version: VERSION, rows }, ctxPublicV027(ctx));
      appDevicesThrottleCache.set(throttleKey, { at: Date.now(), body });
      res.json(body);
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Admin-facing: revoke every device paired to a staff member. This is the fix for a real
  // gap -- a staff member's paired device holds a non-expiring staffToken with real student/
  // schedule access, and until this existed there was no way for an admin to cut that off
  // remotely (the app's own "Unpair" only clears the device's local storage, doing nothing
  // server-side). Admin-authenticated like the rest of Staff Manager/Communication Manager.
  app.post('/api/v05418y/app-devices/revoke', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const staffName = String(body.staffName || '').trim();
      if (!staffName) throw new Error('Missing staff name.');
      const revokedCount = await revokeAppDevicesV05418Y(redis, ctx.spreadsheetId, staffName);
      res.json(Object.assign({ ok: true, version: VERSION, revokedCount }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Invalidates every QR code/link issued so far for this staff member -- portal QR, the
  // app-pairing QR, and any copy-pasted link -- by bumping their token version (see
  // bumpStaffTokenVersionV05421 and makeStaffPortalToken above). A fresh link/QR generated
  // right after this call works immediately; anything printed or saved before it stops
  // validating. This does NOT separately unpair an already-registered device (that's the
  // /app-devices/revoke endpoint above) -- but since a paired device re-validates its
  // staffToken on every heartbeat, it will be forced to re-pair the next time it checks in.
  app.post('/api/v05421/staff-token/revoke', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const staffName = String(body.staffName || '').trim();
      if (!staffName) throw new Error('Missing staff name.');
      const newVersion = await bumpStaffTokenVersionV05421(redis, ctx.spreadsheetId, staffName);
      await appendRevokedInactiveRecordV05422(redis, ctx.spreadsheetId, { staffName, status: 'Revoked', event: 'Portal/app link revoked', by: 'Admin' });
      await appendSecurityEventV05422(redis, ctx.spreadsheetId, staffName, 'Portal/app access revoked', 'Manual revoke');
      res.json(Object.assign({ ok: true, version: VERSION, newTokenVersion: newVersion }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // ===================================================================================
  // Security Manager (v05422)
  // ===================================================================================
  app.get('/api/v05422/security-overview', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const staffDir = await readStaffDirectoryV027(redis, ctx.spreadsheetId);
      const linkGenerated = await getAllLinkGeneratedV05422(redis, ctx.spreadsheetId).catch(() => new Map());
      const lastAccess = await getAllLastSecurityAccessV05422(redis, ctx.spreadsheetId).catch(() => new Map());
      const passcodePolicy = await getPasscodePolicyV05422(redis, ctx.spreadsheetId);
      const genValues = await readRedisSheetValues(redis, ctx.spreadsheetId, '_SecurityLastGeneratedAt').catch(() => []);
      const portalAppGeneratedOn = (genValues[1] && genValues[1][0]) || '';
      const devices = await readAppDevicesV05418Y(redis, ctx.spreadsheetId).catch(() => []);
      const deviceByKey = new Map();
      devices.forEach((d) => {
        const key = normalizeStaffPortalName(d.staffName);
        if (!key) return;
        const arr = deviceByKey.get(key) || [];
        arr.push(d);
        deviceByKey.set(key, arr);
      });
      const forceMap = await getForcedPasscodeMapV05422(redis, ctx.spreadsheetId).catch(() => new Map());
      const reviewedMap = await getReviewedSecurityFlagsMapV05422(redis, ctx.spreadsheetId).catch(() => new Map());
      const passcodeValues = await readRedisSheetValues(redis, ctx.spreadsheetId, '_StaffPasscodes').catch(() => []);
      const passcodeKeys = new Set();
      for (let i = 1; i < passcodeValues.length; i++) { const k = String((passcodeValues[i] || [])[0] || ''); if (k) passcodeKeys.add(k); }

      const staff = Array.from(staffDir.values())
        .filter((s) => String(s.name || '').trim() && String(s.status || '').trim().toLowerCase() !== 'lead')
        .map((s) => {
          const key = normalizeStaffPortalName(s.name);
          const active = !!s.active;
          const generatedAt = linkGenerated.get(key) || '';
          const access = lastAccess.get(key) || null;
          const appDevices = (deviceByKey.get(key) || []).slice().sort((a,b) => String(b.lastSeenAt || b.pairedAt || '').localeCompare(String(a.lastSeenAt || a.pairedAt || '')));
          let linkStatus;
          if (!active || !generatedAt) linkStatus = 'revoked';
          else linkStatus = access ? 'valid' : 'never-accessed';
          const forceRow = forceMap.get(key) || null;
          const hasPasscode = passcodeKeys.has(key);
          const latestAppSeen = appDevices.map((d) => d.lastSeenAt || d.pairedAt || '').filter(Boolean).sort().pop() || '';
          const latestPair = appDevices.map((d) => d.pairedAt || d.lastSeenAt || '').filter(Boolean).sort().pop() || '';
          const flags = computeSecurityFlagsV05422({
            key,
            active,
            linkStatus,
            hasPasscode,
            passcodePolicy,
            access,
            appDevices,
            reviewedMap,
            latestPair
          });
          return {
            name: s.name,
            active,
            status: s.status || '',
            linkStatus,
            lastAccess: access ? { timestamp: access.timestamp, route: access.route } : null,
            hasPasscode,
            appDeviceCount: appDevices.length,
            appLastSeen: latestAppSeen,
            appDevices: appDevices.map((d) => ({ platform: d.platform || '', pairedAt: d.pairedAt || '', lastSeenAt: d.lastSeenAt || '', deviceId: d.deviceId || '' })),
            forcePasscode: !!(forceRow && !forceRow.completedAt),
            forcePasscodeRequestedAt: forceRow ? forceRow.requestedAt || '' : '',
            flags
          };
        })
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

      const revokedInactive = await getRevokedInactiveRecordsV05422(redis, ctx.spreadsheetId, staff, 100).catch(() => []);
      res.json(Object.assign({ ok: true, version: VERSION, portalAppGeneratedOn, passcodePolicy, staff, revokedInactive }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // "Revoke All" -- bumps every active staff member's token version at once. Deliberately
  // scoped to active staff only (inactive ones are already revoked via auto-revoke).
  app.post('/api/v05422/revoke-all', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const staffDir = await readStaffDirectoryV027(redis, ctx.spreadsheetId);
      const activeStaff = Array.from(staffDir.values()).filter((s) => s.active && String(s.name || '').trim());
      let count = 0;
      for (const s of activeStaff) {
        await bumpStaffTokenVersionV05421(redis, ctx.spreadsheetId, s.name);
        await appendRevokedInactiveRecordV05422(redis, ctx.spreadsheetId, { staffName: s.name, status: 'Revoked', event: 'Revoke all', by: 'Admin' });
        await appendSecurityEventV05422(redis, ctx.spreadsheetId, s.name, 'Portal/app access revoked', 'Revoke all');
        count++;
      }
      res.json(Object.assign({ ok: true, version: VERSION, revokedCount: count }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Powers the "click a red (revoked) link icon" popup -- issues a fresh, current link/QR
  // for one staff member without touching anyone else's access.
  app.post('/api/v05422/staff-link/generate', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const cfg = await getStaffPortalBootstrapConfig(redis);
      if (!cfg.tokenSecret) throw new Error('Staff portal token secret is not configured.');
      const staffName = String(body.staffName || '').trim();
      if (!staffName) throw new Error('Missing staff name.');
      const tokenVersion = await getStaffTokenVersionV05421(redis, ctx.spreadsheetId, staffName);
      const token = makeStaffPortalToken(ctx.school, staffName, cfg.tokenSecret, tokenVersion);
      const baseUrl = getBaseUrl(req);
      const staffLink = baseUrl + '/staff?' + new URLSearchParams({ school: ctx.school, staff: staffName, staffToken: token, view: 'my' }).toString();
      await markLinkGeneratedV05422(redis, ctx.spreadsheetId, staffName);
      await appendSecurityEventV05422(redis, ctx.spreadsheetId, staffName, 'Portal link regenerated', 'Admin generated a new portal link');
      res.json(Object.assign({ ok: true, version: VERSION, staffLink }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/v05422/security-access-log', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const staffName = String(req.query.staffName || '').trim();
      if (!staffName) throw new Error('Missing staff name.');
      const rows = await getSecurityAccessLogV05422(redis, ctx.spreadsheetId, staffName);
      const events = await getSecurityEventLogV05422(redis, ctx.spreadsheetId, staffName).catch(() => []);
      res.json(Object.assign({ ok: true, version: VERSION, staffName, rows, events }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });


  app.post('/api/v05422/security-flag/review', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const staffName = String(body.staffName || '').trim();
      const flagId = String(body.flagId || 'all').trim();
      if (!staffName) throw new Error('Missing staff name.');
      await markSecurityFlagReviewedV05422(redis, ctx.spreadsheetId, staffName, flagId);
      await appendSecurityEventV05422(redis, ctx.spreadsheetId, staffName, 'Security flag reviewed', flagId);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05422/passcode/force-check', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const staffName = String(body.staffName || '').trim();
      const enabled = body.enabled !== false && String(body.enabled || 'true') !== 'false';
      if (!staffName) throw new Error('Missing staff name.');
      if (enabled) {
        await setForcedPasscodeCheckV05422(redis, ctx.spreadsheetId, staffName, true);
        await appendSecurityEventV05422(redis, ctx.spreadsheetId, staffName, 'Forced passcode check enabled', 'Admin');
      } else {
        await setForcedPasscodeCheckV05422(redis, ctx.spreadsheetId, staffName, false);
        await appendSecurityEventV05422(redis, ctx.spreadsheetId, staffName, 'Forced passcode check cleared', 'Admin');
      }
      res.json(Object.assign({ ok: true, version: VERSION, enabled }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05422/passcode/end-sessions', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const policy = await getPasscodePolicyV05422(redis, ctx.spreadsheetId);
      if (policy.mode === 'disabled') throw new Error('Portal / App Passcode is disabled. Set it to Optional or Required before ending sessions.');
      const staffDir = await readStaffDirectoryV027(redis, ctx.spreadsheetId);
      const passcodeValues = await readRedisSheetValues(redis, ctx.spreadsheetId, '_StaffPasscodes').catch(() => []);
      const passcodeKeys = new Set();
      for (let i = 1; i < passcodeValues.length; i++) { const k = String((passcodeValues[i] || [])[0] || ''); if (k) passcodeKeys.add(k); }
      const mode = String(body.mode || 'all').trim();
      let count = 0;
      for (const s of Array.from(staffDir.values())) {
        if (!s.active || !String(s.name || '').trim()) continue;
        const key = normalizeStaffPortalName(s.name);
        if (mode === 'with-passcodes' && !passcodeKeys.has(key)) continue;
        await setForcedPasscodeCheckV05422(redis, ctx.spreadsheetId, s.name, true);
        await appendSecurityEventV05422(redis, ctx.spreadsheetId, s.name, 'Staff portal/app session ended', 'Admin required passcode on next open');
        count++;
      }
      res.json(Object.assign({ ok: true, version: VERSION, forcedCount: count }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05422/passcode/force-complete', async (req, res) => {
    try {
      const body = req.body || {};
      const school = String(body.school || '').trim();
      const staffName = String(body.staffName || '').trim();
      const schoolRec = await resolveStaffTokenContextV05418BV(school, staffName, String(body.staffToken || '').trim());
      await completeForcedPasscodeCheckV05422(redis, schoolRec.spreadsheetId, staffName);
      res.json({ ok: true, version: VERSION });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // App-facing: lets the app silently confirm/refresh its own registration using the
  // staffToken it already holds from pairing -- no OTP needed again. Two things this fixes:
  // (1) iOS can drop a push subscription after a period of inactivity with no visible
  // symptom (flagged early in this project); calling this on every app launch keeps
  // lastSeenAt current and re-registers a fresh subscription if iOS silently issued a new
  // one. (2) if the admin revokes a device (above) or a failed push auto-removed a dead one,
  // this is what lets a still-genuinely-active device re-establish itself without asking the
  // staff member to find their code and re-pair from scratch.
  app.post('/api/v05418y/app-devices/heartbeat', async (req, res) => {
    try {
      const body = req.body || {};
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(body.school || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school);
      const staffName = String(body.staffName || '').trim();
      const staffToken = String(body.staffToken || '').trim();
      if (!staffName || !staffToken) throw new Error('Missing staff name or token.');
      const heartbeatTokenVersion = await getStaffTokenVersionV05421(redis, schoolRec.spreadsheetId, staffName);
      const expected = makeStaffPortalToken(school, staffName, cfg.tokenSecret, heartbeatTokenVersion);
      if (staffToken !== expected) { res.status(400).json({ ok: false, version: VERSION, revoked: true, error: 'This device is no longer authorized. Please re-pair from your Staff Portal.' }); return; }
      const revoked = await readAppRevocationsV05418Y(redis, schoolRec.spreadsheetId);
      if (revoked.has(normalizeKeyV05418X(staffName))) { res.status(400).json({ ok: false, version: VERSION, revoked: true, error: 'This device was revoked by an administrator. Please re-pair using a new code from your Staff Portal.' }); return; }
      await recordSecurityAccessV05422(redis, schoolRec.spreadsheetId, staffName, 'app', getClientIpV05422(req), req.get('user-agent'));
      const device = await registerAppDeviceV05418Y(redis, schoolRec.spreadsheetId, { staffName, subscription: body.subscription, platform: body.platform, clientDeviceId: body.clientDeviceId });
      res.json({ ok: true, version: VERSION, registered: true, deviceId: device.deviceId });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // ===================================================================================
  // Passcode / PIN endpoints (v05422)
  // ===================================================================================
  app.get('/api/v05422/passcode-status', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school.');
      const staffName = String(req.query.staffName || req.query.staff || '').trim();
      const staffToken = String(req.query.staffToken || req.query.token || '').trim();
      if (!staffName) throw new Error('Missing staff name.');
      const rec = await findStaffPortalStaffRecord(redis, schoolRec.spreadsheetId, staffName).catch(() => null);
      const finalName = (rec && rec.name) || staffName;
      if (!rec || rec.active === false) throw new Error('Staff member is not active.');
      if (!cfg.tokenSecret) throw new Error('Staff portal token secret is not configured.');
      const tokenVersion = await getStaffTokenVersionV05421(redis, schoolRec.spreadsheetId, finalName);
      const expectedToken = makeStaffPortalToken(school, finalName, cfg.tokenSecret, tokenVersion);
      if (!staffToken || staffToken !== expectedToken) throw new Error('Invalid or expired staff portal link.');
      const policy = await getPasscodePolicyV05422(redis, schoolRec.spreadsheetId);
      const row = await getStaffPasscodeRowV05422(redis, schoolRec.spreadsheetId, finalName);
      const forceRow = await getForcedPasscodeRowV05422(redis, schoolRec.spreadsheetId, finalName).catch(() => null);
      const forcePasscode = !!(forceRow && !forceRow.completedAt);
      const effectiveMode = forcePasscode ? 'required' : (policy.mode || 'disabled');
      res.json({ ok: true, version: VERSION, school, staffName: finalName, mode: effectiveMode, policyMode: policy.mode || 'disabled', forgotOption: policy.forgotOption || 'email', hasPasscode: !!row, forcePasscode });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/v05422/passcode-policy', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school);
      const policy = await getPasscodePolicyV05422(redis, schoolRec.spreadsheetId);
      res.json({ ok: true, version: VERSION, school, ...policy });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05422/passcode-policy/save', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const policy = await savePasscodePolicyV05422(redis, ctx.spreadsheetId, { mode: body.mode, forgotOption: body.forgotOption });
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), policy));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Staff-facing: sets or changes a PIN. Gated on staffToken (the same long-lived proof of
  // identity behind the portal/app links) rather than a session -- setting a PIN is how a
  // session gets established in the first place, so it can't itself require one.
  app.post('/api/v05422/passcode/set', async (req, res) => {
    try {
      const body = req.body || {};
      const school = String(body.school || '').trim();
      const staffName = String(body.staffName || '').trim();
      const pin = String(body.pin || '').trim();
      if (!/^\d{4}$/.test(pin)) throw new Error('Passcode must be exactly 4 digits.');
      const schoolRec = await resolveStaffTokenContextV05418BV(school, staffName, String(body.staffToken || '').trim());
      await setStaffPasscodeV05422(redis, schoolRec.spreadsheetId, staffName, pin);
      await completeForcedPasscodeCheckV05422(redis, schoolRec.spreadsheetId, staffName);
      await appendSecurityEventV05422(redis, schoolRec.spreadsheetId, staffName, 'Passcode set', 'Staff created or changed passcode');
      const sessionToken = makeSecuritySessionTokenV05422(school, staffName, (await getStaffPortalBootstrapConfig(redis)).tokenSecret);
      res.json({ ok: true, version: VERSION, sessionToken });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05422/passcode/verify', async (req, res) => {
    try {
      const body = req.body || {};
      const school = String(body.school || '').trim();
      const staffName = String(body.staffName || '').trim();
      const pin = String(body.pin || '').trim();
      const schoolRec = await resolveStaffTokenContextV05418BV(school, staffName, String(body.staffToken || '').trim());
      const result = await verifyStaffPasscodeV05422(redis, schoolRec.spreadsheetId, staffName, pin);
      if (!result.ok) { res.status(400).json(Object.assign({ ok: false, version: VERSION }, result)); return; }
      await completeForcedPasscodeCheckV05422(redis, schoolRec.spreadsheetId, staffName);
      await appendSecurityEventV05422(redis, schoolRec.spreadsheetId, staffName, 'Passcode verified', 'Staff completed passcode check');
      const sessionToken = makeSecuritySessionTokenV05422(school, staffName, (await getStaffPortalBootstrapConfig(redis)).tokenSecret);
      res.json({ ok: true, version: VERSION, sessionToken });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Optional-mode only: removes the PIN after confirming the current passcode.
  app.post('/api/v05422/passcode/disable', async (req, res) => {
    try {
      const body = req.body || {};
      const school = String(body.school || '').trim();
      const staffName = String(body.staffName || '').trim();
      const pin = String(body.pin || '').trim();
      const schoolRec = await resolveStaffTokenContextV05418BV(school, staffName, String(body.staffToken || '').trim());
      const policy = await getPasscodePolicyV05422(redis, schoolRec.spreadsheetId);
      if (policy.mode === 'required') throw new Error('Passcodes are required for this school and cannot be disabled here. Contact your administrator.');
      const result = await verifyStaffPasscodeV05422(redis, schoolRec.spreadsheetId, staffName, pin);
      if (!result.ok) { res.status(400).json(Object.assign({ ok: false, version: VERSION }, result)); return; }
      await clearStaffPasscodeV05422(redis, schoolRec.spreadsheetId, staffName);
      await appendSecurityEventV05422(redis, schoolRec.spreadsheetId, staffName, 'Passcode disabled', 'Staff confirmed current passcode and disabled optional passcode');
      res.json({ ok: true, version: VERSION });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Admin-facing: always available regardless of the forgot-passcode policy, as a backstop.
  app.post('/api/v05422/passcode/admin-reset', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const staffName = String(body.staffName || '').trim();
      if (!staffName) throw new Error('Missing staff name.');
      await clearStaffPasscodeV05422(redis, ctx.spreadsheetId, staffName);
      await setForcedPasscodeCheckV05422(redis, ctx.spreadsheetId, staffName, true);
      await appendSecurityEventV05422(redis, ctx.spreadsheetId, staffName, 'Passcode reset by admin', 'Staff must set a new passcode on next access');
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Self-service "Forgot Passcode?" -- only offered when the school's policy allows it
  // (admin-reset above is always available as a backstop regardless of this setting).
  app.post('/api/v05422/passcode/forgot', async (req, res) => {
    try {
      const body = req.body || {};
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(body.school || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school);
      const policy = await getPasscodePolicyV05422(redis, schoolRec.spreadsheetId);
      if (policy.forgotOption !== 'email') throw new Error('Self-service passcode reset is not available for this school. Contact your administrator.');
      const email = String(body.email || '').trim().toLowerCase();
      // Always respond success-shaped regardless of match, so this can't be used to test
      // which emails are on file for this school.
      if (email) {
        const staffDir = await readStaffDirectoryV027(redis, schoolRec.spreadsheetId).catch(() => new Map());
        const match = Array.from(staffDir.values()).find((s) => s.active && String(s.email || '').trim().toLowerCase() === email);
        if (match) {
          const token = await createPasscodeResetV05422(redis, schoolRec.spreadsheetId, match.name);
          const baseUrl = getBaseUrl(req);
          const resetLink = baseUrl + '/staff?' + new URLSearchParams({ school, staff: match.name, resetToken: token, view: 'resetPasscode' }).toString();
          try {
            const props = await readBrevoSystemAdminPropertiesV05418O(redis);
            const settings = brevoPrivateSettingsV05418N(props);
            await sendBrevoTransactionalEmailV05418N(settings, {
              to: [match.email],
              subject: 'Reset your Support Schedules passcode',
              textContent: 'A passcode reset was requested for your Staff Portal account. If this was you, open this link within 30 minutes to set a new passcode: ' + resetLink + '\n\nIf you did not request this, you can ignore this email.',
              htmlContent: '<p>A passcode reset was requested for your Staff Portal account.</p><p>If this was you, <a href="' + resetLink + '">click here to set a new passcode</a> (link expires in 30 minutes).</p><p>If you did not request this, you can ignore this email.</p>'
            });
          } catch (mailErr) { console.warn('[passcode forgot email]', mailErr && mailErr.message ? mailErr.message : mailErr); }
        }
      }
      res.json({ ok: true, version: VERSION, message: 'If that email is on file, a reset link has been sent.' });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05422/passcode/reset-with-token', async (req, res) => {
    try {
      const body = req.body || {};
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(body.school || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school);
      const resetToken = String(body.resetToken || '').trim();
      const pin = String(body.pin || '').trim();
      if (!resetToken) throw new Error('Missing reset token.');
      if (!/^\d{4}$/.test(pin)) throw new Error('Passcode must be exactly 4 digits.');
      const staffKey = await consumePasscodeResetV05422(redis, schoolRec.spreadsheetId, resetToken);
      if (!staffKey) throw new Error('This reset link is invalid or has expired. Request a new one from the Staff Portal.');
      const staffDir = await readStaffDirectoryV027(redis, schoolRec.spreadsheetId).catch(() => new Map());
      const match = Array.from(staffDir.values()).find((s) => normalizeStaffPortalName(s.name) === staffKey);
      const staffName = match ? match.name : staffKey;
      await setStaffPasscodeV05422(redis, schoolRec.spreadsheetId, staffName, pin);
      await completeForcedPasscodeCheckV05422(redis, schoolRec.spreadsheetId, staffName);
      await appendSecurityEventV05422(redis, schoolRec.spreadsheetId, staffName, 'Passcode set', 'Staff created or changed passcode');
      const sessionToken = makeSecuritySessionTokenV05422(school, staffName, cfg.tokenSecret);
      res.json({ ok: true, version: VERSION, staffName, sessionToken });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Shared helper for the staffToken-gated endpoints below -- same validation the app's
  // other endpoints (heartbeat, portal-data) already use, just factored out since 4 new
  // endpoints need it rather than repeating it inline each time.
  async function resolveStaffTokenContextV05418BV(school, staffName, staffToken) {
    const cfg = await getStaffPortalBootstrapConfig(redis);
    const schoolRec = cfg.schools[school];
    if (!schoolRec) throw new Error('Unknown school key: ' + school);
    if (!staffName || !staffToken) throw new Error('Missing staff name or token.');
    const resolveTokenVersion = await getStaffTokenVersionV05421(redis, schoolRec.spreadsheetId, staffName);
    const expected = makeStaffPortalToken(school, staffName, cfg.tokenSecret, resolveTokenVersion);
    if (staffToken !== expected) throw new Error('This link is no longer valid. Please open your current Staff Portal link.');
    return schoolRec;
  }

  // Notification preference: read (staff portal gear settings + the app's own Profile screen
  // both need this) and set (staff portal gear settings only -- the app itself doesn't let
  // you change it, since the whole point is it's set once from the portal and then applies
  // to how the admin's Share Schedules / Announcement sends route to you).
  app.get('/api/v05418y/comm-preference', async (req, res) => {
    try {
      const q = req.query || {};
      const school = String(q.school || '').trim();
      const staffName = String(q.staffName || '').trim();
      const staffToken = String(q.staffToken || '').trim();
      const schoolRec = await resolveStaffTokenContextV05418BV(school, staffName, staffToken);
      const preference = await getCommPreferenceV05418BV(redis, schoolRec.spreadsheetId, staffName);
      const devices = await readAppDevicesV05418Y(redis, schoolRec.spreadsheetId);
      const hasPairedDevice = devices.some((d) => normalizeKeyV05418X(d.staffName) === normalizeKeyV05418X(staffName));
      res.json({ ok: true, version: VERSION, preference, hasPairedDevice });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });
  app.post('/api/v05418y/comm-preference/set', async (req, res) => {
    try {
      const body = req.body || {};
      const school = String(body.school || '').trim();
      const staffName = String(body.staffName || '').trim();
      const staffToken = String(body.staffToken || '').trim();
      const schoolRec = await resolveStaffTokenContextV05418BV(school, staffName, staffToken);
      const preference = String(body.preference || '').trim().toLowerCase();
      if (preference !== 'email') {
        const devices = await readAppDevicesV05418Y(redis, schoolRec.spreadsheetId);
        const paired = devices.some((d) => normalizeKeyV05418X(d.staffName) === normalizeKeyV05418X(staffName));
        if (!paired) throw new Error('Pair the mobile app before choosing push or both.');
      }
      await setCommPreferenceV05418BV(redis, schoolRec.spreadsheetId, staffName, preference);
      res.json({ ok: true, version: VERSION, preference });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // In-app inbox: lets the app show undismissed announcements even after the OS notification
  // itself is gone, and lets the person clear ("swipe away") each one once read.
  app.get('/api/v05418y/inbox', async (req, res) => {
    try {
      const q = req.query || {};
      const school = String(q.school || '').trim();
      const staffName = String(q.staffName || '').trim();
      const staffToken = String(q.staffToken || '').trim();
      const schoolRec = await resolveStaffTokenContextV05418BV(school, staffName, staffToken);
      const all = await readInboxMessagesV05418BV(redis, schoolRec.spreadsheetId);
      const mine = all.filter((m) => !m.dismissed && normalizeKeyV05418X(m.staffName) === normalizeKeyV05418X(staffName)).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
      res.json({ ok: true, version: VERSION, messages: mine });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });
  app.post('/api/v05418y/inbox/dismiss', async (req, res) => {
    try {
      const body = req.body || {};
      const school = String(body.school || '').trim();
      const staffName = String(body.staffName || '').trim();
      const staffToken = String(body.staffToken || '').trim();
      const schoolRec = await resolveStaffTokenContextV05418BV(school, staffName, staffToken);
      const messageId = String(body.messageId || '').trim();
      const all = await readInboxMessagesV05418BV(redis, schoolRec.spreadsheetId);
      let changed = false;
      all.forEach((m) => {
        const isMine = normalizeKeyV05418X(m.staffName) === normalizeKeyV05418X(staffName);
        if (!isMine) return;
        if (messageId && m.id !== messageId) return;
        m.dismissed = true; changed = true;
      });
      if (changed) await writeInboxMessagesV05418BV(redis, schoolRec.spreadsheetId, all);
      res.json({ ok: true, version: VERSION });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Communication Manager page data: combines the active staff list with Staff Portal
  // access history (_StaffPortalAccessLatest, already recorded by recordStaffPortalAccessV027
  // on every real portal visit) and app pairing status (_AppDevices, above) into one table.
  app.get('/api/v05418y/communication-manager', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const staffValues = await readRedisSheetValues(redis, ctx.spreadsheetId, 'Staff');
      const staffNames = (staffValues || []).slice(1).map((r) => Array.isArray(r) ? String(r[0] || '').trim() : '').filter(Boolean);
      const portalLatest = await readRedisSheetValues(redis, ctx.spreadsheetId, '_StaffPortalAccessLatest');
      const portalByKey = {};
      for (let i = 1; i < (portalLatest || []).length; i++) {
        const r = portalLatest[i] || [];
        const key = String(r[0] || '').trim();
        if (key) portalByKey[key] = { lastViewed: String(r[2] || '').trim(), publishedAt: String(r[3] || '').trim() };
      }
      const devices = await readAppDevicesV05418Y(redis, ctx.spreadsheetId);
      const deviceByKey = {};
      devices.forEach((d) => { deviceByKey[normalizeKeyV05418X(d.staffName)] = d; });
      const rows = staffNames.map((staffName) => {
        const key = normalizeStaffNameV018(staffName);
        const portal = portalByKey[key] || null;
        const device = deviceByKey[normalizeKeyV05418X(staffName)] || null;
        return {
          staffName,
          portalLastViewed: portal ? portal.lastViewed : '',
          appPaired: !!device,
          appPlatform: device ? device.platform : '',
          appLastSeen: device ? device.lastSeenAt : ''
        };
      });
      res.json(Object.assign({ ok: true, version: VERSION, rows }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Admin-facing send, called from the Share Schedules popup's new "Send Push
  // Notification" button (see the Communication Manager / Share Schedules changes).
  app.post('/api/v05418y/push/send', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const staffNames = Array.isArray(body.staffNames) ? body.staffNames.map((s) => String(s || '').trim()).filter(Boolean) : [];
      if (!staffNames.length) throw new Error('Select at least one staff member.');
      const result = await sendPushToStaffV05418Y(redis, ctx.spreadsheetId, staffNames, { title: body.title, body: body.body });
      const pushedTo = (result.results || []).filter((r) => r.status === 'sent').map((r) => r.staffName);
      if (pushedTo.length) await addInboxMessagesV05418BV(redis, ctx.spreadsheetId, pushedTo, body.title || 'Schedule update', body.body || 'Your schedule has been shared.');
      res.json(Object.assign({ ok: result.ok, version: VERSION, configured: result.configured, message: result.message, results: result.results }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // Standalone broadcast: an arbitrary email and/or push message to selected staff,
  // independent of the Share Schedules flow -- for reminders, updates, anything that isn't
  // tied to a schedule publish. Reuses the exact same Brevo/nodemailer email path and push
  // path already proven elsewhere, rather than building a third way to send either.
  app.get('/api/v05418y/templates', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const templates = await readAnnouncementTemplatesV05418CB(redis, ctx.spreadsheetId);
      res.json({ ok: true, version: VERSION, templates });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });
  app.post('/api/v05418y/templates/save', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const saved = await saveAnnouncementTemplateV05418CB(redis, ctx.spreadsheetId, { id: body.id, name: body.name, subject: body.subject, message: body.message });
      res.json({ ok: true, version: VERSION, template: saved });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });
  app.post('/api/v05418y/templates/delete', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      await deleteAnnouncementTemplateV05418CB(redis, ctx.spreadsheetId, body.id);
      res.json({ ok: true, version: VERSION });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05418y/broadcast', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const staffNames = Array.isArray(body.staffNames) ? body.staffNames.map((s) => String(s || '').trim()).filter(Boolean) : [];
      if (!staffNames.length) throw new Error('Select at least one staff member.');
      const subject = String(body.subject || '').trim() || 'Support Schedules notification';
      const message = String(body.message || '').trim();
      if (!message) throw new Error('Enter a message.');
      const mode = String(body.mode || '').trim().toLowerCase();
      let wantEmail, wantPush, emailTargets, pushTargets;
      if (mode === 'preferred') {
        // Mirrors Share Schedules' "Send via Preferred Communication": each recipient gets
        // whichever channel(s) they've set in their notification preference, rather than
        // every recipient getting every channel the sender happened to leave checked.
        const prefMapV05418BX = await getCommPreferencesV05418BV(redis, ctx.spreadsheetId).catch(() => new Map());
        emailTargets = []; pushTargets = [];
        for (const name of staffNames) {
          const prefRecV05418BX = prefMapV05418BX.get(normalizeKeyV05418X(name));
          const prefV05418BX = (prefRecV05418BX && prefRecV05418BX.preference) || 'email';
          if (prefV05418BX === 'email' || prefV05418BX === 'both') emailTargets.push(name);
          if (prefV05418BX === 'push' || prefV05418BX === 'both') pushTargets.push(name);
        }
        wantEmail = emailTargets.length > 0;
        wantPush = pushTargets.length > 0;
        if (!wantEmail && !wantPush) throw new Error('No recipients have a communication preference on file.');
      } else {
        wantEmail = body.sendEmail !== false;
        wantPush = body.sendPush !== false;
        if (!wantEmail && !wantPush) throw new Error('Choose at least one delivery method.');
        emailTargets = wantEmail ? staffNames : [];
        pushTargets = wantPush ? staffNames : [];
      }
      const sentBy = getRequestUserEmail(req) || 'communication-manager';
      const logRows = [];
      const stamp = formatDateTimeV027(new Date());

      const results = {};

      if (wantEmail) {
        const brevoProps = await readBrevoSystemAdminPropertiesV05418O(redis);
        const brevo = brevoPrivateSettingsV05418N(brevoProps);
        const staffValues = await readRedisSheetValues(redis, ctx.spreadsheetId, 'Staff');
        const headers = Array.isArray(staffValues[0]) ? staffValues[0] : [];
        const colName = findHeaderIndex_(headers, ['name', 'staff', 'staff name', 'staff member', 'employee name'], 0);
        const colEmail = findHeaderIndex_(headers, ['email', 'notification email'], 10);
        const emailByKey = new Map();
        for (let r = 1; r < staffValues.length; r++) {
          const row = Array.isArray(staffValues[r]) ? staffValues[r] : [];
          const name = String(row[colName] || '').trim();
          if (!name) continue;
          emailByKey.set(normalizeKeyV05418X(name), String(row[colEmail] || '').trim());
        }
        const htmlMessage = '<p>' + String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') + '</p>';
        let sent = 0, failed = 0, skipped = 0;
        for (const name of emailTargets) {
          const email = emailByKey.get(normalizeKeyV05418X(name)) || '';
          if (!emailListV018(email).length) { skipped++; logRows.push([stamp, '', '', 'announcement', name, 'Email', '', 'Skipped', 'No email on file. Subject: ' + subject, sentBy, VERSION]); continue; }
          try {
            let messageId = '';
            if (brevo.enabled && brevo.apiKey) {
              const info = await sendBrevoTransactionalEmailV05418N(brevo, { to: email, subject, textContent: message, htmlContent: htmlMessage });
              messageId = info.messageId || '';
              // Same tracking pipeline schedule-share emails use -- this is what closes the
              // "announcements aren't tracked" gap. Only meaningful for Brevo sends, since
              // the webhook that reports opens/clicks is Brevo-specific.
              try { await recordBrevoScheduleSendV05418Q(redis, { messageId, email, staff: name, school: ctx.school || '', spreadsheetId: ctx.spreadsheetId || '', type: 'announcement', subject, sentAt: stamp, sentBy, trackingEnabled: !!brevo.trackingEnabled }); } catch (_) {}
            } else {
              const nodemailer = require('nodemailer');
              const transport = process.env.EMAIL_TRANSPORT === 'smtp'
                ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: String(process.env.SMTP_PORT) === '465', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined })
                : nodemailer.createTransport({ jsonTransport: true });
              await transport.sendMail({ from: process.env.EMAIL_FROM || 'schedules@supportschedules.com', to: email, subject, text: message, html: htmlMessage });
            }
            sent++;
            logRows.push([stamp, '', '', 'announcement', name, 'Email', email, 'Sent', subject + ': ' + message, sentBy, VERSION]);
          } catch (e) { failed++; logRows.push([stamp, '', '', 'announcement', name, 'Email', email, 'Failed', (e.message || String(e)) + '. Subject: ' + subject, sentBy, VERSION]); }
        }
        results.email = { sent, failed, skipped };
      }

      if (wantPush) {
        const pushResult = await sendPushToStaffV05418Y(redis, ctx.spreadsheetId, pushTargets, { title: subject, body: message });
        const byStaff = new Map((pushResult.results || []).map((r) => [normalizeKeyV05418X(r.staffName || ''), r]));
        pushTargets.forEach((name) => {
          const r = byStaff.get(normalizeKeyV05418X(name));
          const status = !r ? 'Skipped' : r.status === 'sent' ? 'Sent' : r.status === 'no-device' ? 'Not paired' : 'Failed';
          logRows.push([stamp, '', '', 'announcement', name, 'App Push', '', status, subject + ': ' + message, sentBy, VERSION]);
        });
        results.push = {
          configured: pushResult.configured,
          sent: (pushResult.results || []).filter((r) => r.status === 'sent').length,
          notPaired: (pushResult.results || []).filter((r) => r.status === 'no-device').length,
          failed: (pushResult.results || []).filter((r) => r.status === 'failed').length,
          message: pushResult.message
        };
        // Retain in the app's in-app inbox for anyone who was actually sent a push -- an OS
        // notification that gets dismissed or swiped away without being read is otherwise
        // gone for good; this is what lets the app show it again until the person clears it.
        const pushedTo = pushTargets.filter((name) => { const r = byStaff.get(normalizeKeyV05418X(name)); return r && r.status === 'sent'; });
        if (pushedTo.length) await addInboxMessagesV05418BV(redis, ctx.spreadsheetId, pushedTo, subject, message);
      }

      await appendCommunicationLogV018(redis, ctx.spreadsheetId, logRows);
      res.json(Object.assign({ ok: true, version: VERSION, results }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  // ===================================================================================
  // Staff Portal QR Letters (v05419) -- Node-native replacement for the legacy Apps
  // Script version, which called UrlFetchApp.fetch() (not available synchronously in
  // this Node runtime) and relied on HtmlService/DriveApp for PDF creation and storage,
  // neither of which are real/functional in the Node compatibility shims. This version
  // fetches the QR code with a plain async fetch and builds the PDF natively with pdfkit,
  // streaming it straight back as a download instead of trying to save to Google Drive.
  // ===================================================================================
  app.get('/api/v05419/staff-portal-letter-template', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const saved = await getStaffPortalLetterTemplateV05419(redis, ctx.spreadsheetId);
      res.json({ ok: true, template: saved || defaultStaffPortalLetterTemplateV05419(), defaultTemplate: defaultStaffPortalLetterTemplateV05419(), schoolId: ctx.school, schoolName: ctx.schoolName });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05419/staff-portal-letter-template/save', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const template = String(body.template || '').trim() || defaultStaffPortalLetterTemplateV05419();
      await saveStaffPortalLetterTemplateV05419(redis, ctx.spreadsheetId, template);
      res.json({ ok: true, template, schoolId: ctx.school, schoolName: ctx.schoolName });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05419/staff-portal-letter-template/reset', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const template = defaultStaffPortalLetterTemplateV05419();
      await saveStaffPortalLetterTemplateV05419(redis, ctx.spreadsheetId, template);
      res.json({ ok: true, template, schoolId: ctx.school, schoolName: ctx.schoolName });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.post('/api/v05419/staff-portal-letters/generate', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const cfg = await getStaffPortalBootstrapConfig(redis);
      if (!cfg.tokenSecret) throw new Error('Staff portal token secret is not configured. Set STAFF_PORTAL_TOKEN_SECRET or allow the app to persist a generated secret.');
      const schoolName = ctx.schoolName || ctx.school;
      const template = defaultStaffPortalLetterTemplateV05419();
      const requestedStaffName = String(body.staffName || body.staff || body.name || '').trim();

      const staffDir = await readStaffDirectoryV027(redis, ctx.spreadsheetId);
      let staffList = Array.from(staffDir.values())
        .filter((s) => s.active && String(s.name || '').trim())
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      if (requestedStaffName) {
        const requestedKey = normalizeStaffPortalName(requestedStaffName);
        staffList = staffList.filter((s) => normalizeStaffPortalName(s.name) === requestedKey);
        if (!staffList.length) throw new Error('No active staff member matched "' + requestedStaffName + '" for this school.');
      }
      if (!staffList.length) throw new Error('No active staff were found for this school.');

      const baseUrl = getBaseUrl(req);
      const todayFormatted = formatMonthDayYearShortV05419(new Date());
      const logoBuffer = readStaffPortalLetterLogoV05419();
      const tokenVersions = await getAllStaffTokenVersionsV05421(redis, ctx.spreadsheetId).catch(() => new Map());

      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      const donePromise = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });

      let isFirstPage = true;
      for (const s of staffList) {
        const staffName = String(s.name || '').trim();
        if (!staffName) continue;
        const tokenVersion = tokenVersions.get(normalizeStaffPortalName(staffName)) || 0;
        const token = makeStaffPortalToken(ctx.school, staffName, cfg.tokenSecret, tokenVersion);
        const staffLink = baseUrl + '/staff?' + new URLSearchParams({ school: ctx.school, staff: staffName, staffToken: token, view: 'my' }).toString();
        // Same token as the portal link -- it's the same underlying proof of identity, just a
        // different destination/behavior. Revoking the staff member's token (Staff Manager)
        // invalidates this exactly the same way it invalidates the portal link above.
        const appPairLink = baseUrl + '/app?' + new URLSearchParams({ pairSetup: '1', setupSchool: ctx.school, setupStaff: staffName, setupToken: token }).toString();
        const qrBuffer = await fetchStaffPortalQrPngV05419(staffLink).catch(() => null);
        const appQrBuffer = await fetchStaffPortalQrPngV05419(appPairLink).catch(() => null);
        await markLinkGeneratedV05422(redis, ctx.spreadsheetId, staffName).catch(() => {});
        const vars = { firstName: firstNameFromFullNameV05419(staffName), staffName, schoolName, staffPortalLink: staffLink, date: todayFormatted };
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;
        try { renderStaffPortalLetterPageV05419(doc, { template, vars, qrBuffer, logoBuffer, appQrBuffer, schoolName, staffName, staffLink, appPairLink }); }
        catch (pageErr) { doc.font('Helvetica').fontSize(11).fillColor('#b91c1c').text('Could not render this page for ' + staffName + ': ' + (pageErr.message || pageErr), 50, 50, { width: doc.page.width - 100 }); }
      }

      doc.end();
      await donePromise;
      await writeRedisSheetValues(redis, ctx.spreadsheetId, '_SecurityLastGeneratedAt', [['Timestamp'], [new Date().toISOString()]]).catch(() => {});
      const pdfBuffer = Buffer.concat(chunks);
      const safeSchool = String(schoolName || 'School').replace(/[^\w\- ]+/g, '').trim() || 'School';
      const safeStaff = requestedStaffName ? String(requestedStaffName).replace(/[^\w\- ]+/g, '').trim() : '';
      const filename = (safeStaff ? ('Staff QR Letter - ' + safeStaff + ' - ' + safeSchool + ' - ') : ('Staff Portal QR Letters - ' + safeSchool + ' - ')) + formatFileStampV05419(new Date()) + '.pdf';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename.replace(/"/g, '') + '"; filename*=UTF-8\'\'' + encodeURIComponent(filename));
      res.setHeader('X-Staff-Letter-Count', String(staffList.length));
      res.send(pdfBuffer);
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  async function getStaffPortalLetterTemplateV05419(redisArg, spreadsheetId) {
    const values = await readRedisSheetValues(redisArg, spreadsheetId, '_StaffPortalLetterTemplate');
    const row = values[1];
    return Array.isArray(row) ? String(row[0] || '') : '';
  }
  async function saveStaffPortalLetterTemplateV05419(redisArg, spreadsheetId, template) {
    await writeRedisSheetValues(redisArg, spreadsheetId, '_StaffPortalLetterTemplate', [['Template'], [template]]);
  }
  function defaultStaffPortalLetterTemplateV05419() {
    return [
      'Hi {{firstName}}!',
      '',
      'This year, {{schoolName}} is using Support Schedules to coordinate and communicate student support coverage -- so schedules are clearer and easier to keep track of for everyone involved.',
      '',
      'Your personal Staff Portal lets you:',
      '- View your current daily schedule, always up to date',
      '- Report an absence in a few taps, no phone calls needed',
      '- See announcements and updates as they are posted',
      '',
      'Scan your personal QR code on the card below to open your Staff Portal for the first time.',
      '',
      'Prefer your phone? Scan the App QR code below to install the Support Schedules app -- it is already set up to pair with your account automatically, so there is no code to enter. Once it is installed, your schedule and updates are always one tap away.'
    ].join('\n');
  }
  function firstNameFromFullNameV05419(fullName) {
    fullName = String(fullName || '').trim();
    if (!fullName) return '';
    const comma = fullName.indexOf(',');
    if (comma >= 0) { const after = String(fullName.slice(comma + 1)).trim(); return (after.split(/\s+/)[0] || fullName); }
    return (fullName.split(/\s+/)[0] || fullName);
  }
  function formatMonthDayYearShortV05419(date) {
    try { return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: '2-digit', day: '2-digit', year: '2-digit' }).format(date); } catch (e) { return ''; }
  }
  function formatFileStampV05419(date) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
      const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
      return get('year') + get('month') + get('day') + '-' + get('hour') + get('minute');
    } catch (e) { return String(Date.now()); }
  }
  async function fetchStaffPortalQrPngV05419(targetUrl) {
    const endpoint = 'https://quickchart.io/qr?' + new URLSearchParams({ text: targetUrl, size: '300', margin: '2', format: 'png' }).toString();
    const qrRes = await fetch(endpoint);
    if (!qrRes.ok) throw new Error('QR code API returned HTTP ' + qrRes.status + '.');
    return Buffer.from(await qrRes.arrayBuffer());
  }
  let staffPortalLetterLogoCacheV05419 = undefined;
  function readStaffPortalLetterLogoV05419() {
    if (staffPortalLetterLogoCacheV05419 !== undefined) return staffPortalLetterLogoCacheV05419;
    try { staffPortalLetterLogoCacheV05419 = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'brand', 'logo-color-text-wide.png')); }
    catch (e) { staffPortalLetterLogoCacheV05419 = null; }
    return staffPortalLetterLogoCacheV05419;
  }
  // Actual pixel dimensions of logo-color-text-wide.png -- needed to place the header rule
  // correctly below the logo regardless of what width we scale it to (the previous version
  // used a hardcoded vertical offset that didn't account for the logo's real aspect ratio,
  // so the rule cut through the bottom of the wordmark).
  const STAFF_LETTER_LOGO_ASPECT_V05419 = 334 / 1141;
  // Renders the plain-text template as a single bounded block: blank line = paragraph break,
  // a block where every line starts with "-" becomes a bullet line ("- " -> "\u2022 "). Using
  // ONE text() call with an explicit height + ellipsis (rather than one call per
  // paragraph/bullet) is what guarantees this never spills onto a second page -- pdfkit
  // auto-inserts a new page when flowing text overflows the bottom margin, which is exactly
  // what was happening before and pushed every letter onto an unwanted, near-empty page 2.
  // Splits the template into a "headline" (its first line, typically the "Hi {{firstName}}!"
  // greeting) rendered as a larger serif display line -- echoing the big serif headline /
  // smaller sans-serif body pairing used on the marketing site -- and the remaining body
  // copy, rendered as before with a bounded height + ellipsis so it can never trigger
  // pdfkit's automatic page-break-on-overflow (that auto-page-break, not anything in this
  // function's own math, was the actual cause of the letter spilling onto a second page).
  function splitLetterHeadlineV05419(text) {
    const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const firstBreak = raw.indexOf('\n\n');
    if (firstBreak === -1 || firstBreak > 80) return { headline: '', rest: raw.trim() };
    const first = raw.slice(0, firstBreak).trim();
    if (!first || first.split('\n').length > 1) return { headline: '', rest: raw.trim() };
    return { headline: first, rest: raw.slice(firstBreak).trim() };
  }
  function renderStaffPortalLetterBodyV05419(doc, text, opts) {
    opts = opts || {};
    const blocks = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n\s*\n/);
    const combined = blocks.map((block) => {
      const lines = block.split('\n').map((l) => l.trim());
      const isBulletBlock = lines.length && lines.every((l) => /^[-\u2022]\s+/.test(l) || !l);
      if (isBulletBlock) return lines.filter((l) => l).map((l) => '\u2022  ' + l.replace(/^[-\u2022]\s+/, '')).join('\n');
      return block.trim();
    }).join('\n\n');
    doc.font('Helvetica').fontSize(11).fillColor('#334155')
      .text(combined, opts.x, opts.y, { width: opts.width, height: opts.height, ellipsis: true, lineGap: 3, paragraphGap: 8 });
  }
  // One page per staff member: branded header, a serif display greeting, the editable
  // letter body, a small footer, a dashed "cut here" line, then a bordered card holding
  // that staff member's two personal QR codes (Staff Portal and pre-paired mobile app)
  // side by side -- meant to be cut off and kept after the rest of the letter is filed.
  function renderStaffPortalLetterPageV05419(doc, ctxV05419) {
    const vars = ctxV05419.vars || {}, qrBuffer = ctxV05419.qrBuffer, logoBuffer = ctxV05419.logoBuffer, appQrBuffer = ctxV05419.appQrBuffer;
    const staffName = ctxV05419.staffName || vars.staffName || 'Staff Member';
    const firstName = firstNameFromFullNameV05419(staffName) || 'there';
    const schoolName = ctxV05419.schoolName || vars.schoolName || 'your school';
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const left = 42;
    const right = 42;
    const contentW = pageW - left - right;
    const navy = '#0b1f3a';
    const blue = '#2563eb';
    const green = '#16a34a';
    const soft = '#f6f8fb';
    const text = '#0f172a';
    const muted = '#64748b';

    function fitText(t, x, y, w, opts) {
      opts = opts || {};
      doc.font(opts.font || 'Helvetica').fontSize(opts.size || 10).fillColor(opts.color || text).text(String(t || ''), x, y, { width: w, height: opts.height || undefined, align: opts.align || 'left', lineGap: opts.lineGap == null ? 2 : opts.lineGap, ellipsis: !!opts.height });
    }
    function checkMark(x, y) {
      doc.save();
      doc.circle(x, y, 7).fill(green);
      doc.moveTo(x - 3.5, y).lineTo(x - 1, y + 3).lineTo(x + 4.5, y - 4).lineWidth(1.8).strokeColor('#ffffff').stroke();
      doc.restore();
    }
    function feature(y, copy) {
      checkMark(left + 24, y + 8);
      fitText(copy, left + 42, y, contentW - 84, { font: 'Helvetica-Bold', size: 10.4, color: '#eaf7ef', lineGap: 2, height: 26 });
      return y + 31;
    }
    function drawQrCard(x, y, w, h, title, qrBuf) {
      doc.roundedRect(x, y, w, h, 18).fillAndStroke('#ffffff', '#dbe3ef');
      doc.font('Helvetica-Bold').fontSize(13).fillColor(navy).text(title, x + 16, y + 15, { width: w - 32, align: 'center' });
      const qrSize = 142;
      const qrX = x + (w - qrSize) / 2;
      const qrY = y + 45;
      doc.roundedRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 14).fillAndStroke('#f8fafc', '#e2e8f0');
      if (qrBuf) {
        try { doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize }); } catch (e) {}
      }
    }

    doc.rect(0, 0, pageW, pageH).fill('#ffffff');
    doc.roundedRect(left - 10, 114, contentW + 20, 628, 24).fill(soft);

    if (logoBuffer) {
      try { doc.image(logoBuffer, left, 36, { width: 190 }); } catch (e) {}
    } else {
      doc.font('Helvetica-Bold').fontSize(18).fillColor(navy).text('Support Schedules', left, 43, { width: 220 });
    }
    doc.font('Helvetica-Bold').fontSize(9).fillColor(muted).text(schoolName, left + 300, 44, { width: contentW - 300, align: 'right' });
    doc.moveTo(left, 92).lineTo(left + contentW, 92).lineWidth(2).strokeColor(blue).stroke();
    doc.moveTo(left, 96).lineTo(left + contentW, 96).lineWidth(2).strokeColor('#22c55e').stroke();

    fitText('Hi ' + firstName + '!', left, 130, contentW, { font: 'Times-Bold', size: 34, color: navy });
    fitText('Your personal Support Schedules access is ready.', left, 174, contentW, { font: 'Helvetica-Bold', size: 15.5, color: text });
    fitText('You are set up for faster, clearer daily schedule access at ' + schoolName + '. Keep these personal QR codes handy -- one opens your Staff Portal and one installs the app with your account ready to pair.', left, 198, contentW, { size: 10.8, color: '#334155', lineGap: 3, height: 50 });
    fitText('Use Support Schedules to view daily schedule updates, submit absences, and receive notifications when schedule updates are shared.', left, 244, contentW, { size: 10.8, color: '#334155', lineGap: 3, height: 34 });

    const navyY = 292;
    doc.roundedRect(left, navyY, contentW, 142, 20).fill(navy);
    doc.font('Helvetica-Bold').fontSize(17).fillColor('#ffffff').text('Daily access, one tap away.', left + 24, navyY + 22, { width: contentW - 48, align: 'center' });
    let fy = navyY + 60;
    fy = feature(fy, 'See today\'s schedule and published changes.');
    fy = feature(fy, 'Submit absences from your Staff Portal.');
    feature(fy, 'Receive notifications when updates are shared.');

    doc.font('Helvetica-Bold').fontSize(11).fillColor(navy).text(staffName, left, 453, { width: contentW, align: 'center' });
    doc.font('Helvetica').fontSize(9.3).fillColor(muted).text('These QR codes are personal to you. Please do not post or share them publicly.', left, 471, { width: contentW, align: 'center' });

    const gap = 22;
    const cardW = (contentW - gap) / 2;
    drawQrCard(left, 498, cardW, 202, 'Staff Portal', qrBuffer);
    drawQrCard(left + cardW + gap, 498, cardW, 202, 'Mobile App', appQrBuffer);

    doc.roundedRect(left + 42, 714, contentW - 84, 30, 15).fillAndStroke('#ecfdf5', '#bbf7d0');
    doc.font('Helvetica-Bold').fontSize(10.4).fillColor('#166534').text('You are set up for faster, clearer daily schedule access.', left + 54, 723, { width: contentW - 108, align: 'center' });
  }


  app.get('/api/db-editor/sheet', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const sheet = String(req.query.sheet || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      if (!sheet) throw new Error('Missing sheet name.');
      const rawValues = await readRedisSheetValues(redis, schoolRec.spreadsheetId, sheet);
      const limited = filterDbEditorValuesV019(sheet, rawValues);
      res.json({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, sheet, values: limited.values, editorColumns: limited.columns, hiddenColumns: limited.hiddenColumns });
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/db-editor/sheet', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const sheet = String((req.body && req.body.sheet) || '').trim();
      const values = req.body && req.body.values;
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      if (!sheet) throw new Error('Missing sheet name.');
      if (!Array.isArray(values)) throw new Error('Values must be a 2D array.');
      if (values.length > 5000) throw new Error('Refusing to save more than 5000 rows from the inline database editor.');
      const normalized = values.map(row => Array.isArray(row) ? row.map(v => v == null ? '' : String(v)) : [String(row == null ? '' : row)]);
      const existing = await readRedisSheetValues(redis, schoolRec.spreadsheetId, sheet);
      const merged = mergeDbEditorValuesV019(sheet, existing, normalized);
      await runtime.call('admin', 'redisReplaceSheetValuesV015', [schoolRec.spreadsheetId, sheet, merged], { userEmail: getRequestUserEmail(req) });
      res.json({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, sheet, rows: merged.length, columns: merged.reduce((m, r) => Math.max(m, r.length), 0), visibleColumnsSaved: normalized.reduce((m, r) => Math.max(m, r.length), 0) });
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/communication/published-candidates', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const candidates = await buildPublishedEmailCandidates(redis, schoolRec.spreadsheetId);
      res.json({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, candidates, count: candidates.length });
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/communication/send-published', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const requested = Array.isArray(req.body && req.body.staff) ? req.body.staff.map(x => String(x || '').trim()).filter(Boolean) : [];
      const all = await buildPublishedEmailCandidates(redis, schoolRec.spreadsheetId);
      const chosen = requested.length ? all.filter(c => requested.includes(c.staff) || requested.includes(c.key)) : all;
      const fromName = String((req.body && req.body.fromName) || 'Support Schedules Schedule Update').trim();
      const out = await sendPublishedScheduleEmails(chosen, fromName);
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId }, out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });



  app.get('/api/communication/prompt-state-v018', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const state = await getCommunicationPromptStateV018(redis, req, school, schoolRec.spreadsheetId);
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId }, state));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/communication/candidates-v018', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String(req.query.school || req.query.schoolId || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const data = await buildCommunicationCandidatesV018(redis, req, school, schoolRec.spreadsheetId);
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId }, data));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/communication/dismiss-v018', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const model = await getPublishedScheduleModelV018(redis, schoolRec.spreadsheetId);
      const state = await readCommunicationStateV018(redis, schoolRec.spreadsheetId);
      const requestedHash = String((req.body && (req.body.hash || req.body.publishedHash || req.body.scheduleHash)) || '').trim();
      const hash = String(model.hash || requestedHash || sha256ShortV018(String(model.raw || '') + '|' + String(model.publishedAt || ''))).trim();
      const instance = communicationPublishInstanceV05418S(model) || hash;
      if (hash || instance) {
        state.SNOOZED_HASH = hash;
        state.SNOOZED_PUBLISHED_HASH = hash;
        state.SNOOZED_INSTANCE = instance;
        state.SNOOZED_AT = formatDateTimeV027(new Date());
      }
      await writeCommunicationStateV018(redis, schoolRec.spreadsheetId, state);
      const prompt = await getCommunicationPromptStateV018(redis, req, school, schoolRec.spreadsheetId);
      res.json(Object.assign({ ok: true, school, spreadsheetId: schoolRec.spreadsheetId, dismissedHash: hash }, prompt));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/communication/send-v018', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school + '. Known keys: ' + Object.keys(cfg.schools).join(', '));
      const mode = String((req.body && req.body.mode) || 'all').trim().toLowerCase() === 'changed' ? 'changed' : 'all';
      const requested = Array.isArray(req.body && req.body.staffKeys) ? req.body.staffKeys : (Array.isArray(req.body && req.body.staff) ? req.body.staff : []);
      const selected = requested.map(x => normalizeStaffNameV018(x)).filter(Boolean);
      const data = await buildCommunicationCandidatesV018(redis, req, school, schoolRec.spreadsheetId);
      const pool = mode === 'changed' ? data.changed : data.all;
      const chosen = pool.filter(c => selected.includes(normalizeStaffNameV018(c.key || c.staff)) && !c.skipReason);
      if (!chosen.length) throw new Error('No selected staff with email addresses were available for the selected communication mode.');
      const settings = data.settings || {};
      if (!settings.enabled) throw new Error('Schedule communication workflow is disabled in Settings.');
      if (!settings.emailEnabled) throw new Error('Email communication is disabled in Settings.');
      const propsForSendV05418N = await readBrevoSystemAdminPropertiesV05418O(redis);
      const settingsForSendV05418N = Object.assign({}, settings, { brevoPrivate: brevoPrivateSettingsV05418N(propsForSendV05418N) });
      const out = await sendScheduleCommunicationEmailsV018(chosen, mode, settingsForSendV05418N, data, getRequestUserEmail(req), { redis, school, spreadsheetId: schoolRec.spreadsheetId });
      await appendCommunicationLogV018(redis, schoolRec.spreadsheetId, out.logRows || []);
      if (out.sent > 0 && out.failed === 0) {
        const state = await readCommunicationStateV018(redis, schoolRec.spreadsheetId);
        state.LAST_COMMUNICATED_HASH = data.hash || '';
        state.LAST_COMMUNICATED_INSTANCE = data.publishInstance || data.hash || '';
        state.LAST_COMMUNICATED_AT = formatDateTimeV027(new Date());
        state.LAST_COMMUNICATED_BY = getRequestUserEmail(req) || '';
        state.LAST_COMMUNICATED_MODE = mode;
        state.LAST_COMMUNICATED_SCHEDULE_JSON = JSON.stringify(data.views || {});
        delete state.SNOOZED_HASH;
        delete state.SNOOZED_PUBLISHED_HASH;
        delete state.SNOOZED_INSTANCE;
        await writeCommunicationStateV018(redis, schoolRec.spreadsheetId, state);
      }
      const latestStatusRowsV05418U = await listBrevoStaffEmailStatusesV05418Q(redis, { school, limit: 500 }).catch(() => []);
      res.json(Object.assign({ ok: out.failed === 0, version: VERSION, school, spreadsheetId: schoolRec.spreadsheetId, mode, selectedStaff: chosen.length, recordedAsCommunicated: out.sent > 0 && out.failed === 0, currentScheduleHash: data.hash || '', currentPublishedAt: data.publishedAt || '', currentPublishInstance: data.publishInstance || data.hash || '', scheduleVersion: data.scheduleVersion || 0, emailStatusRows: latestStatusRowsV05418U }, out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  // "Send via Preferred Communication" -- unlike send-v018 (email to everyone selected) or
  // the plain push endpoint (push to everyone selected), this routes each selected staff
  // member individually based on THEIR OWN preference (set via the Staff Portal gear
  // settings, defaulting to email if never set). Reuses the exact same email-sending
  // (sendScheduleCommunicationEmailsV018) and push-sending (sendPushToStaffV05418Y)
  // mechanisms as the other two send paths -- this endpoint only does the splitting and
  // recombining, not a third way of actually delivering anything.
  app.post('/api/communication/send-preferred-v018', async (req, res) => {
    try {
      const cfg = await getStaffPortalBootstrapConfig(redis);
      const school = String((req.body && (req.body.school || req.body.schoolId)) || cfg.defaultSchoolId || '').trim();
      const schoolRec = cfg.schools[school];
      if (!schoolRec) throw new Error('Unknown school key: ' + school);
      const bodyV05418DY = req.body || {};
      const mode = String(bodyV05418DY.mode || 'all').trim().toLowerCase() === 'changed' ? 'changed' : 'all';
      const requested = Array.isArray(bodyV05418DY.staffKeys) ? bodyV05418DY.staffKeys : [];
      const selected = requested.map((x) => normalizeStaffNameV018(x)).filter(Boolean);
      const forceDeliveryV05418DY = ['email', 'push'].includes(String(bodyV05418DY.forceDelivery || '').trim().toLowerCase()) ? String(bodyV05418DY.forceDelivery).trim().toLowerCase() : '';
      const rawOverridesV05418DY = bodyV05418DY.deliveryOverrides && typeof bodyV05418DY.deliveryOverrides === 'object' ? bodyV05418DY.deliveryOverrides : {};
      const deliveryOverridesV05418DY = new Map(Object.keys(rawOverridesV05418DY).map((k) => {
        const v = String(rawOverridesV05418DY[k] || '').trim().toLowerCase();
        return [normalizeStaffNameV018(k), v === 'app' ? 'push' : (v === 'push' || v === 'both' || v === 'email' ? v : '')];
      }).filter((pair) => pair[0] && pair[1]));
      const data = await buildCommunicationCandidatesV018(redis, req, school, schoolRec.spreadsheetId);
      const pool = mode === 'changed' ? data.changed : data.all;
      const chosen = pool.filter((c) => selected.includes(normalizeStaffNameV018(c.key || c.staff)) && !c.skipReason);
      if (!chosen.length) throw new Error('No selected staff were available for the selected communication mode.');
      const settings = data.settings || {};
      if (!settings.enabled) throw new Error('Schedule communication workflow is disabled in Settings.');

      const deliveryForCandidateV05418DY = (c) => {
        if (forceDeliveryV05418DY) return forceDeliveryV05418DY;
        const override = deliveryOverridesV05418DY.get(normalizeStaffNameV018(c.key || c.staff || '')) || deliveryOverridesV05418DY.get(normalizeStaffNameV018(c.staff || '')) || '';
        if (override) return override;
        return (c.preference || 'email') === 'push' ? 'push' : ((c.preference || 'email') === 'both' ? 'both' : 'email');
      };
      const emailGroup = chosen.filter((c) => { const d = deliveryForCandidateV05418DY(c); return d === 'email' || d === 'both'; });
      const pushGroup = chosen.filter((c) => { const d = deliveryForCandidateV05418DY(c); return d === 'push' || d === 'both'; });

      let emailOut = { sent: 0, failed: 0, skipped: 0, logRows: [] };
      if (emailGroup.length && settings.emailEnabled) {
        const propsForSendV05418N = await readBrevoSystemAdminPropertiesV05418O(redis);
        const settingsForSendV05418N = Object.assign({}, settings, { brevoPrivate: brevoPrivateSettingsV05418N(propsForSendV05418N) });
        emailOut = await sendScheduleCommunicationEmailsV018(emailGroup, mode, settingsForSendV05418N, data, getRequestUserEmail(req), { redis, school, spreadsheetId: schoolRec.spreadsheetId });
      }

      let pushSent = 0, pushFailed = 0, pushNotPaired = 0;
      const pushLogRows = [];
      const stamp = formatDateTimeV027(new Date());
      if (pushGroup.length) {
        const pushResult = await sendPushToStaffV05418Y(redis, schoolRec.spreadsheetId, pushGroup.map((c) => c.staff), { title: data.scheduleLabel || 'Schedule update', body: 'Your schedule has been published. Open the app or your Staff Portal link to view it.' });
        const byStaff = new Map((pushResult.results || []).map((r) => [normalizeKeyV05418X(r.staffName || ''), r]));
        pushGroup.forEach((c) => {
          const r = byStaff.get(normalizeKeyV05418X(c.staff));
          const status = !r ? 'Skipped' : r.status === 'sent' ? 'Sent' : r.status === 'no-device' ? 'Not paired' : 'Failed';
          if (status === 'Sent') pushSent++; else if (status === 'Not paired') pushNotPaired++; else if (status === 'Failed') pushFailed++;
          pushLogRows.push([stamp, data.publishedAt || '', data.hash || '', mode, c.staff, 'App Push', '', status, 'Preferred-communication schedule share', getRequestUserEmail(req) || 'communication-manager', VERSION]);
        });
        const pushedTo = pushGroup.filter((c) => { const r = byStaff.get(normalizeKeyV05418X(c.staff)); return r && r.status === 'sent'; }).map((c) => c.staff);
        if (pushedTo.length) await addInboxMessagesV05418BV(redis, schoolRec.spreadsheetId, pushedTo, data.scheduleLabel || 'Schedule update', 'Your schedule has been published. Open the app to view it.');
      }

      await appendCommunicationLogV018(redis, schoolRec.spreadsheetId, (emailOut.logRows || []).concat(pushLogRows));

      const totalSent = (emailOut.sent || 0) + pushSent;
      const totalFailed = (emailOut.failed || 0) + pushFailed;
      if (totalSent > 0 && totalFailed === 0) {
        const state = await readCommunicationStateV018(redis, schoolRec.spreadsheetId);
        state.LAST_COMMUNICATED_HASH = data.hash || '';
        state.LAST_COMMUNICATED_INSTANCE = data.publishInstance || data.hash || '';
        state.LAST_COMMUNICATED_AT = formatDateTimeV027(new Date());
        state.LAST_COMMUNICATED_BY = getRequestUserEmail(req) || '';
        state.LAST_COMMUNICATED_MODE = mode;
        state.LAST_COMMUNICATED_SCHEDULE_JSON = JSON.stringify(data.views || {});
        delete state.SNOOZED_HASH;
        delete state.SNOOZED_PUBLISHED_HASH;
        delete state.SNOOZED_INSTANCE;
        await writeCommunicationStateV018(redis, schoolRec.spreadsheetId, state);
      }

      res.json({
        ok: totalFailed === 0,
        version: VERSION,
        school,
        mode,
        selectedStaff: chosen.length,
        recordedAsCommunicated: totalSent > 0 && totalFailed === 0,
        email: { sent: emailOut.sent || 0, failed: emailOut.failed || 0, skipped: emailOut.skipped || 0 },
        push: { sent: pushSent, failed: pushFailed, notPaired: pushNotPaired },
        message: 'Sent via each staff member\u2019s preferred communication method.'
      });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });


  // V0.54.18P Brevo transactional email settings and test/send endpoints.
  // Provider-level configuration now lives in System Admin / admin script properties, not per-school Settings.
  app.get('/api/communication/brevo-settings-v05418n', async (req, res) => {
    try {
      await requireSystemAdminV05418O(redis, req);
      const props = await readBrevoSystemAdminPropertiesV05418O(redis);
      res.json(Object.assign({ ok: true, version: VERSION, scope: 'system-admin' }, brevoPublicSettingsV05418N(props)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.post('/api/communication/brevo-settings-v05418n', async (req, res) => {
    try {
      await requireSystemAdminV05418O(redis, req);
      const body = req.body || {};
      const props = await readBrevoSystemAdminPropertiesV05418O(redis);
      const boolText = (v) => boolFromSettingV018(v, false) ? 'Yes' : 'No';
      props.V05418N_BREVO_ENABLED = boolText(body.enabled);
      props.V05418N_BREVO_SCHEDULE_ENABLED = boolText(body.scheduleEnabled);
      props.V05418N_BREVO_ABSENCE_ENABLED = boolText(body.absenceEnabled);
      props.V05418N_BREVO_CONTACT_ENABLED = boolText(body.contactEnabled);
      props.V05418Q_BREVO_TRACKING_ENABLED = boolText(body.trackingEnabled);
      props.V05418N_BREVO_FROM_NAME = cleanBrevoTextV05418N(body.fromName || 'Support Schedules');
      props.V05418N_BREVO_FROM_EMAIL = cleanBrevoTextV05418N(body.fromEmail || 'schedules@supportschedules.com');
      props.V05418N_BREVO_REPLY_TO_EMAIL = cleanBrevoTextV05418N(body.replyToEmail || '');
      props.V05418N_BREVO_TEST_RECIPIENT = cleanBrevoTextV05418N(body.testRecipient || '');
      props.V05418N_BREVO_CONTACT_RECIPIENTS = emailListV018(body.contactRecipients || '').join(', ');
      const apiKey = cleanBrevoTextV05418N(body.apiKey || '');
      if (apiKey) props.V05418N_BREVO_API_KEY = apiKey;
      if (body.clearApiKey === true || /^true|1|yes$/i.test(String(body.clearApiKey || ''))) props.V05418N_BREVO_API_KEY = '';
      const webhookToken = cleanBrevoTextV05418N(body.webhookToken || '');
      if (webhookToken) props.V05418Q_BREVO_WEBHOOK_TOKEN = webhookToken;
      if (body.clearWebhookToken === true || /^true|1|yes$/i.test(String(body.clearWebhookToken || ''))) props.V05418Q_BREVO_WEBHOOK_TOKEN = '';
      await writeBrevoSystemAdminPropertiesV05418O(redis, props);
      const saved = await readBrevoSystemAdminPropertiesV05418O(redis);
      res.json(Object.assign({ ok: true, version: VERSION, scope: 'system-admin', message: 'Brevo System Admin settings saved.' }, brevoPublicSettingsV05418N(saved)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.post('/api/communication/brevo-test-v05418n', async (req, res) => {
    try {
      await requireSystemAdminV05418O(redis, req);
      const body = req.body || {};
      const props = await readBrevoSystemAdminPropertiesV05418O(redis);
      const settings = brevoPrivateSettingsV05418N(props);
      const to = emailListV018(body.to || body.testRecipient || settings.testRecipient || '').slice(0, 5);
      if (!to.length) throw new Error('Enter a test recipient email address.');
      const info = await sendBrevoTransactionalEmailV05418N(settings, {
        to,
        subject: 'Support Schedules Brevo test',
        textContent: 'This is a Support Schedules Brevo transactional email test.\n\nIf you received this, Brevo is connected.',
        htmlContent: '<p>This is a <b>Support Schedules Brevo transactional email test</b>.</p><p>If you received this, Brevo is connected.</p>'
      });
      res.json({ ok: true, version: VERSION, scope: 'system-admin', to, message: 'Brevo test email sent.', brevo: info });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });


  app.post('/api/communication/brevo-webhook-v05418q', async (req, res) => {
    try {
      const result = await handleBrevoWebhookV05418Q(redis, req);
      res.json(Object.assign({ ok: true, version: VERSION }, result));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/communication/brevo-webhook-v05418q', async (req, res) => {
    try {
      const props = await readBrevoSystemAdminPropertiesV05418O(redis);
      const configured = !!cleanBrevoTextV05418N(props.V05418Q_BREVO_WEBHOOK_TOKEN || process.env.BREVO_WEBHOOK_TOKEN || '');
      const diag = await readBrevoWebhookDiagnosticsV05418T(redis);
      res.json({ ok: true, version: VERSION, endpoint: 'brevo-webhook', method: 'GET health check only; Brevo sends POST events.', tokenConfigured: configured, diagnostics: diag.summary || {}, recent: (diag.recent || []).slice(-5) });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/communication/brevo-webhook-diagnostics-v05418t', async (req, res) => {
    try {
      await requireSystemAdminV05418O(redis, req);
      const diag = await readBrevoWebhookDiagnosticsV05418T(redis);
      res.json({ ok: true, version: VERSION, diagnostics: diag.summary || {}, recent: diag.recent || [] });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/communication/brevo-staff-email-status-v05418q', async (req, res) => {
    try {
      await requireSystemAdminV05418O(redis, req);
      const school = cleanBrevoTextV05418N(req.query.school || req.query.schoolId || '');
      const rows = await listBrevoStaffEmailStatusesV05418Q(redis, { school, limit: Number(req.query.limit || 200) || 200 });
      res.json({ ok: true, version: VERSION, count: rows.length, rows });
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });


  app.get('/api/communication/brevo-staff-email-status-v05418r', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const rows = await listBrevoStaffEmailStatusesV05418Q(redis, { school: ctx.school, limit: Number(req.query.limit || 500) || 500 });
      const publish = await getScheduleVersionV027(redis, ctx.spreadsheetId).catch(() => ({}));
      res.json(Object.assign({ ok: true, version: VERSION, count: rows.length, rows, currentScheduleHash: publish.hash || '', currentPublishedAt: publish.publishedAt || '', currentScheduleLabel: publish.label || '' }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/communication/brevo-staff-email-status-v05418t', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const rows = await listBrevoStaffEmailStatusesV05418Q(redis, { school: ctx.school, limit: Number(req.query.limit || 500) || 500 });
      const publish = await getScheduleVersionV027(redis, ctx.spreadsheetId).catch(() => ({}));
      res.json(Object.assign({ ok: true, version: VERSION, count: rows.length, rows, currentScheduleHash: publish.hash || '', currentPublishedAt: publish.publishedAt || '', currentScheduleLabel: publish.label || '' }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/communication/brevo-staff-email-status-v05418u', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const rows = await listBrevoStaffEmailStatusesV05418Q(redis, { school: ctx.school, limit: Number(req.query.limit || 500) || 500 });
      const publish = await getScheduleVersionV027(redis, ctx.spreadsheetId).catch(() => ({}));
      const lastUpdatedAt = rows.reduce((best, r) => String(r.updatedAt || r.sentAt || '').localeCompare(String(best || '')) > 0 ? (r.updatedAt || r.sentAt || '') : best, '');
      const token = sha256ShortV018([publish.hash || '', publish.publishedAt || '', lastUpdatedAt, rows.length].join('|'));
      res.json(Object.assign({ ok: true, version: VERSION, count: rows.length, rows, currentScheduleHash: publish.hash || '', currentPublishedAt: publish.publishedAt || '', currentScheduleLabel: publish.label || '', currentPublishInstance: communicationPublishInstanceV05418S({ hash: publish.hash || '', publishedAt: publish.publishedAt || '' }), currentDailyVersion: publish.dailyVersion || 0, lastUpdatedAt, statusToken: token }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });


  app.get('/api/communication/brevo-staff-email-status-v05418v', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const rowsRaw = await listBrevoStaffEmailStatusesV05418Q(redis, { school: ctx.school, limit: Number(req.query.limit || 500) || 500 });
      const rows = decorateBrevoStatusRowsForDisplayV05418V(rowsRaw);
      const publish = await getScheduleVersionV027(redis, ctx.spreadsheetId).catch(() => ({}));
      const lastUpdatedAt = rowsRaw.reduce((best, r) => String(r.updatedAt || r.sentAt || '').localeCompare(String(best || '')) > 0 ? (r.updatedAt || r.sentAt || '') : best, '');
      const token = sha256ShortV018([publish.hash || '', publish.publishedAt || '', lastUpdatedAt, rowsRaw.length].join('|'));
      res.json(Object.assign({ ok: true, version: VERSION, count: rows.length, rows, currentScheduleHash: publish.hash || '', currentPublishedAt: publish.publishedAt || '', currentScheduleLabel: publish.label || '', currentPublishInstance: communicationPublishInstanceV05418S({ hash: publish.hash || '', publishedAt: publish.publishedAt || '' }), currentDailyVersion: publish.dailyVersion || 0, lastUpdatedAt, lastUpdatedAtDisplay: formatBrevoStatusDisplayTimeV05418V(lastUpdatedAt), statusToken: token, timeZone: 'America/Los_Angeles' }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message || String(err) }); }
  });

  app.get('/api/google/forms/search-v026', async (req, res) => {
    try {
      const accessToken = await getRequestGoogleAccessToken(req, res);
      if (!accessToken) throw new Error('Google sign-in is required to search your accessible Forms. Use Reconnect Google Forms Access if access was recently added.');
      const query = String(req.query.query || req.query.q || '').trim();
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50) || 50));
      const rows = await searchAccessibleGoogleFormsV026(accessToken, query, limit);
      res.json({ ok: true, version: VERSION, query, count: rows.length, rows, auth: 'google-user-token' });
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/google/forms/validate-v026', async (req, res) => {
    try {
      const accessToken = await getRequestGoogleAccessToken(req, res);
      if (!accessToken) throw new Error('Google sign-in is required to validate a Google Form. Use Reconnect Google Forms Access if access was recently added.');
      const input = String((req.body && (req.body.input || req.body.url || req.body.formId)) || '').trim();
      const id = extractGoogleFormIdV026(input);
      if (!id) throw new Error('Paste a Google Form URL or file ID.');
      const row = await validateAccessibleGoogleFormV026(accessToken, id);
      res.json({ ok: true, version: VERSION, row, url: row.url, id: row.id, name: row.name, driveName: row.driveName, formTitle: row.formTitle, auth: 'google-user-token' });
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });


  app.post('/api/v037/student-data-url/save', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const out = await updateStudentDataFileUrlRedisV037(redis, ctx.spreadsheetId, body.rowIndex, body.url);
      await appendAdminActivityLogV027(redis, ctx.spreadsheetId, 'Student data file link saved', 'Data Manager', getRequestUserEmail(req), 'Saved fillable Google Form link for student row ' + out.rowIndex + '.');
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/diag/calendar-safe', async (req, res) => {
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Calendar Safe Diagnostic - Support Schedules</title><style>body{font-family:Arial,sans-serif;margin:20px;background:#f8fafc;color:#0f172a}.card{background:#fff;border:1px solid #dbe3ef;border-radius:14px;padding:14px}button{border-radius:12px;border:1px solid #dbe3ef;background:#fff;padding:8px 12px;font-weight:800}.err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:12px;padding:10px}.ok{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;border-radius:12px;padding:10px}pre{white-space:pre-wrap;background:#0f172a;color:#f8fafc;padding:12px;border-radius:12px;max-height:70vh;overflow:auto}</style></head><body><h1>Calendar Safe Diagnostic</h1><div class="card"><button id="load">Load Calendar API</button><div id="status" style="margin-top:12px">Ready.</div><pre id="out"></pre></div><script>function qs(){var p=new URLSearchParams(location.search);if(!p.get('school')){try{var s=localStorage.getItem('selectedSchool')||sessionStorage.getItem('selectedSchool')||'';if(s)p.set('school',s);}catch(e){}}return p.toString()?('?'+p.toString()):'';}document.getElementById('load').onclick=function(){var st=document.getElementById('status'),out=document.getElementById('out');st.textContent='Loading...';fetch('/api/v034/calendar-safe'+qs(),{credentials:'same-origin'}).then(r=>r.json()).then(j=>{st.className=j.ok?'ok':'err';st.textContent=j.ok?'Calendar API loaded.':'Calendar API failed.';out.textContent=JSON.stringify(j,null,2);}).catch(e=>{st.className='err';st.textContent=e.message;});};document.getElementById('load').click();</script></body></html>`);
  });

  app.get('/diag/attendance-safe', async (req, res) => {
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Attendance Safe Diagnostic - Support Schedules</title><style>body{font-family:Arial,sans-serif;margin:20px;background:#f8fafc;color:#0f172a}.card{background:#fff;border:1px solid #dbe3ef;border-radius:14px;padding:14px}button{border-radius:12px;border:1px solid #dbe3ef;background:#fff;padding:8px 12px;font-weight:800}.err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:12px;padding:10px}.ok{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;border-radius:12px;padding:10px}pre{white-space:pre-wrap;background:#0f172a;color:#f8fafc;padding:12px;border-radius:12px;max-height:70vh;overflow:auto}</style></head><body><h1>Attendance Safe Diagnostic</h1><div class="card"><button id="load">Load Attendance API</button><div id="status" style="margin-top:12px">Ready.</div><pre id="out"></pre></div><script>function qs(){var p=new URLSearchParams(location.search);if(!p.get('school')){try{var s=localStorage.getItem('selectedSchool')||sessionStorage.getItem('selectedSchool')||'';if(s)p.set('school',s);}catch(e){}}return p.toString()?('?'+p.toString()):'';}document.getElementById('load').onclick=function(){var st=document.getElementById('status'),out=document.getElementById('out');st.textContent='Loading...';fetch('/api/v034/attendance-safe'+qs(),{credentials:'same-origin'}).then(r=>r.json()).then(j=>{st.className=j.ok?'ok':'err';st.textContent=j.ok?'Attendance API loaded.':'Attendance API failed.';out.textContent=JSON.stringify(j,null,2);}).catch(e=>{st.className='err';st.textContent=e.message;});};document.getElementById('load').click();</script></body></html>`);
  });

  app.get('/api/v027/today-setup', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const out = await buildTodaySetupV027(redis, req, ctx);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/v027/settings-audit', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const out = await buildSettingsAuditV027(redis, req, ctx);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/v027/diagnostics', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {}, { allowNoSchool: true });
      const out = await buildDiagnosticsV027(redis, req, ctx);
      res.json(Object.assign({ ok: true, version: VERSION }, ctx ? ctxPublicV027(ctx) : {}, out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/v027/data-files/status', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const out = await getDataFileStatusV027(redis, ctx.spreadsheetId);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });


  app.get('/api/v054/data-metrics', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const props = await readCampusScopedPropertiesFromRedis(redis, ctx.spreadsheetId);
      let staffStats = {};
      try { staffStats = JSON.parse(props.V5_STAFF_DATA_STATS_V5288 || '{}') || {}; } catch { staffStats = {}; }
      const dataFiles = await getDataFileStatusV027(redis, ctx.spreadsheetId).catch(() => ({ rows: [], summary: {} }));
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), {
        lastRefresh: props.V5_FOLDER_DATES_LAST_REFRESH || '',
        refreshedBy: props.V5_GOOGLE_FORMS_REFRESHED_BY_V025 || '',
        staffStats,
        dataFiles
      }));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/v054/data-metrics/refresh', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.body || {});
      const accessToken = await getRequestGoogleAccessToken(req, res);
      if (!accessToken) throw new Error('Google Forms response access is not available for this session. Use Reconnect Google Forms Access, then try again.');
      const result = await refreshStudentDataMetricsV025(redis, ctx.spreadsheetId, accessToken, getRequestUserEmail(req));
      const props = await readCampusScopedPropertiesFromRedis(redis, ctx.spreadsheetId);
      let staffStats = {};
      try { staffStats = JSON.parse(props.V5_STAFF_DATA_STATS_V5288 || '{}') || {}; } catch { staffStats = {}; }
      const dataFiles = await getDataFileStatusV027(redis, ctx.spreadsheetId).catch(() => ({ rows: [], summary: {} }));
      await appendAdminActivityLogV027(redis, ctx.spreadsheetId, 'Data files refreshed', 'Data Manager', getRequestUserEmail(req), result && result.message ? result.message : 'Student data metrics refreshed.');
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), result || {}, { staffStats, dataFiles }));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });


  app.post('/api/v0544/student-data-url/save', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const out = await updateStudentDataFileUrlRedisV037(redis, ctx.spreadsheetId, body.rowIndex, body.url);
      await appendAdminActivityLogV027(redis, ctx.spreadsheetId, 'Student data file link saved', 'Data Manager', getRequestUserEmail(req), 'Saved Google Form link for student row ' + out.rowIndex + '.');
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });


  app.post('/api/v05418f/student-data-urls/save-bulk', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const out = await updateStudentDataFileUrlsBulkRedisV05418F(redis, ctx.spreadsheetId, rows);
      await appendAdminActivityLogV027(redis, ctx.spreadsheetId, 'Student data file links saved', 'Data Manager', getRequestUserEmail(req), 'Saved ' + out.saved + ' data link(s); cleared ' + out.cleared + '.');
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.post('/api/v05418f/data-form-diagnostics', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const accessToken = await getRequestGoogleAccessToken(req, res);
      const out = await diagnoseGoogleFormAccessV05418F(redis, ctx.spreadsheetId, accessToken, body || {}, getRequestUserEmail(req));
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.post('/api/v0544/student-data-url/save-all', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const rows = Array.isArray(body.rows) ? body.rows : (Array.isArray(body.payload) ? body.payload : []);
      let saved = 0, cleared = 0, skipped = 0;
      let last = null;
      for (const row of rows) {
        const rowIndex = Number(row && row.rowIndex || 0);
        if (!rowIndex || rowIndex < 2) { skipped++; continue; }
        const out = await updateStudentDataFileUrlRedisV037(redis, ctx.spreadsheetId, rowIndex, row && row.url || '');
        last = out;
        if (out.url) saved++; else cleared++;
      }
      await appendAdminActivityLogV027(redis, ctx.spreadsheetId, 'Student data file links saved', 'Data Manager', getRequestUserEmail(req), saved + ' saved, ' + cleared + ' cleared, ' + skipped + ' skipped.');
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), { saved, cleared, skipped, last, message: saved + ' Google Form data link(s) saved' + (cleared ? (', ' + cleared + ' cleared') : '') + '.' }));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.post('/api/v0544/data-details/student', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const accessToken = await getRequestGoogleAccessToken(req, res);
      if (!accessToken) throw new Error('Google sign-in is required to read Form responses. Use Reconnect Google Forms Access if access was recently changed.');
      const out = await getStudentDataPointDetailsRedisV0544(redis, ctx.spreadsheetId, accessToken, body);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.post('/api/v0544/data-details/staff', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const accessToken = await getRequestGoogleAccessToken(req, res);
      if (!accessToken) throw new Error('Google sign-in is required to read Form responses. Use Reconnect Google Forms Access if access was recently changed.');
      const out = await getStaffDataContributionDetailsRedisV0544(redis, ctx.spreadsheetId, accessToken, body);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.get('/api/v0542/school-scope-diagnostic', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {}, { allowNoSchool: false });
      const props = await readCampusScopedPropertiesFromRedis(redis, ctx.spreadsheetId);
      const scheduleSheets = await listRedisSheets(redis, ctx.spreadsheetId);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), {
        propertyScope: '_V5Properties in selected school data store',
        bellScheduleSheetPresent: scheduleSheets.includes('Schedule Templates'),
        periodMetaPresent: !!props.V5_PERIOD_META_JSON,
        customStudentPeriodsPresent: !!props.V5_CUSTOM_STUDENT_PERIODS_JSON,
        schoolGuard: ctx.guard || 'validated',
        accessReason: ctx.access && ctx.access.reason || ''
      }));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });



  app.get('/api/v0545/staff-portal/last-view', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const staffName = String((req.query && (req.query.staffName || req.query.staff || req.query.name)) || '').trim();
      if (!staffName) throw new Error('staffName is required.');
      const out = await getStaffPortalLastViewDirectV0545(redis, ctx.spreadsheetId, staffName);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.get('/api/v027/staff-portal/access-summary', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const out = await buildStaffPortalAccessSummaryV027(redis, ctx.spreadsheetId);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/v027/communication/log', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const limit = Math.min(200, Math.max(1, Number(req.query.limit || 75) || 75));
      const out = await getCommunicationLogV027(redis, ctx.spreadsheetId, limit);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/v029/communication/log/clear', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, (req.body || {}));
      await writeRedisSheetValues(redis, ctx.spreadsheetId, '_ScheduleCommunicationLog', [['Timestamp','Published At','Schedule Hash','Mode','Staff','Modality','Recipient','Status','Message','Sent By','Version']]);
      await appendAdminActivityLogV027(redis, ctx.spreadsheetId, 'Communication log cleared', 'Communication Manager', getRequestUserEmail(req), 'Cleared by admin from Communication Manager.');
      res.json(Object.assign({ ok: true, version: VERSION, cleared: true }, ctxPublicV027(ctx)));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/v027/activity-log', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const limit = Math.min(200, Math.max(1, Number(req.query.limit || 75) || 75));
      const out = await getAdminActivityLogV027(redis, ctx.spreadsheetId, limit);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/v027/schedule/version', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const out = await getScheduleVersionV027(redis, ctx.spreadsheetId);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/v027/schedule/conflicts', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const out = await buildScheduleConflictsV027(redis, ctx.spreadsheetId);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/v027/schedule/explain', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const out = await buildScheduleExplainabilityV027(redis, ctx.spreadsheetId);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });


  app.get('/api/v034/calendar-safe', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const today = new Date();
      const year = Number(req.query.year || today.getFullYear()) || today.getFullYear();
      const month = Number(req.query.month || (today.getMonth() + 1)) || (today.getMonth() + 1);
      const selectedSchool = { campusId: ctx.school, schoolId: ctx.school, campusName: ctx.schoolName || ctx.school, schoolName: ctx.schoolName || ctx.school, spreadsheetId: ctx.spreadsheetId };
      const result = await runtime.call('admin', 'getCalendarManagerDataFastV5442', [year, month, selectedSchool], { userEmail: getRequestUserEmail(req), selectedSchool });
      res.json(Object.assign({ ok: true, version: VERSION, safeRenderer: 'v034-calendar' }, ctxPublicV027(ctx), { result }));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/v034/calendar-safe/save', async (req, res) => {
    try {
      const body = req.body || {};
      const ctx = await resolveSchoolContextV027(redis, req, body || {});
      const selectedSchool = { campusId: ctx.school, schoolId: ctx.school, campusName: ctx.schoolName || ctx.school, schoolName: ctx.schoolName || ctx.school, spreadsheetId: ctx.spreadsheetId };
      const payload = Object.assign({}, body, { year: Number(body.year || new Date().getFullYear()), month: Number(body.month || (new Date().getMonth() + 1)), school: selectedSchool, _selectedSchool: selectedSchool });
      const result = await runtime.call('admin', 'saveCalendarMonthFromManagerV5', [payload], { userEmail: getRequestUserEmail(req), selectedSchool });
      await appendAdminActivityLogV027(redis, ctx.spreadsheetId, 'Calendar saved', 'Calendar Manager', getRequestUserEmail(req), 'Saved visible month from safe renderer.');
      res.json(Object.assign({ ok: true, version: VERSION, safeRenderer: 'v034-calendar-save' }, ctxPublicV027(ctx), { result }));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/v034/attendance-safe', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const now = new Date();
      const month = String(req.query.month || (now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')));
      const selectedSchool = { campusId: ctx.school, schoolId: ctx.school, campusName: ctx.schoolName || ctx.school, schoolName: ctx.schoolName || ctx.school, spreadsheetId: ctx.spreadsheetId };
      const payload = { month, staff: String(req.query.staff || ''), showNonActive: String(req.query.showNonActive || '').toLowerCase() === 'true' || String(req.query.showNonActive || '') === '1', school: selectedSchool, _selectedSchool: selectedSchool };
      const result = await runtime.call('admin', 'getAttendanceManagerDataFastV5442', [payload], { userEmail: getRequestUserEmail(req), selectedSchool });
      res.json(Object.assign({ ok: true, version: VERSION, safeRenderer: 'v034-attendance' }, ctxPublicV027(ctx), { result }));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.get('/api/v027/staff-portal/meta', async (req, res) => {
    try {
      const query = await normalizeStaffPortalQuery(redis, req.query || {});
      const ctx = await selectedSchoolContextForStaffPortalV026(redis, query);
      if (!ctx || !ctx.spreadsheetId) throw new Error('Unknown Staff Portal school.');
      const out = await buildStaffPortalMetaV027(redis, ctx.spreadsheetId, query);
      res.json(Object.assign({ ok: true, version: VERSION, school: ctx.school || ctx.schoolId, spreadsheetId: ctx.spreadsheetId }, out));
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });

  app.post('/api/v027/theme', async (req, res) => {
    try {
      const mode = String((req.body && req.body.mode) || 'light').trim().toLowerCase();
      if (!/^(light|dark)$/.test(mode)) throw new Error('Theme must be light or dark.');
      res.cookie('ga_theme', mode, { httpOnly: false, sameSite: 'lax', secure: isSecure(req), maxAge: 365 * 24 * 60 * 60 * 1000 });
      res.json({ ok: true, version: VERSION, mode });
    } catch (err) { res.status(400).json({ ok: false, error: err.message }); }
  });


  // v0.54.18dj: school data isolation hardening for desktop admin calls.
  // Older admin code still has a server-side "selected campus" concept. That is unsafe for
  // multi-school/admin testing because two browser sessions for the same user can race that
  // value. Every school-scoped call must carry a tab-local selected school, the server must
  // validate access to that school, and the response is stamped so the browser can refuse to
  // paint it if the user has already switched schools.
  function isSchoolScopedReadFunctionV05418DJ(functionName) {
    const fn = String(functionName || '');
    if (!fn) return false;
    if (isSystemAdminFunctionV027(fn)) return false;
    return /Dashboard|ScheduleNow|Todo|Student|Staff|Schedule|Attendance|Calendar|Settings|Regular|Break|Builder|Optimizer|History|Logic|DataManager|DataFile|FolderDates|Agency|Advanced|Security|Passcode|Announcement|PortalDisplay|CampusData|Performance|Warm|Audit|Clean/i.test(fn);
  }
  function clientTabInfoV05418DJ(body) {
    body = body || {};
    return {
      clientTabId: String(body.clientTabId || body.tabId || '').slice(0, 80),
      clientSchoolSessionId: String(body.clientSchoolSessionId || body.schoolSessionId || '').slice(0, 120),
      clientRequestedAt: String(body.clientRequestedAt || '').slice(0, 80)
    };
  }
  function schoolGuardPublicV05418DJ(guard, tabInfo) {
    if (!guard || !guard.ctx) return null;
    const pub = Object.assign({}, guard.public || ctxPublicV027(guard.ctx));
    pub.school = guard.ctx.school;
    pub.schoolId = guard.ctx.school;
    pub.selectedCampusId = guard.ctx.school;
    pub.campusId = guard.ctx.school;
    pub.schoolName = guard.ctx.schoolName || guard.ctx.school;
    pub.selectedCampusName = guard.ctx.schoolName || guard.ctx.school;
    pub.campusName = guard.ctx.schoolName || guard.ctx.school;
    pub.spreadsheetId = guard.ctx.spreadsheetId;
    pub.selectedSpreadsheetId = guard.ctx.spreadsheetId;
    pub.guardVersion = 'v05418dj';
    pub.serverStampedAt = new Date().toISOString();
    if (tabInfo) {
      pub.clientTabId = tabInfo.clientTabId || '';
      pub.clientSchoolSessionId = tabInfo.clientSchoolSessionId || '';
    }
    return pub;
  }
  function attachSchoolGuardToResultV05418DJ(result, schoolGuard) {
    if (!schoolGuard || !result || typeof result !== 'object' || Array.isArray(result)) return result;
    const scope = {
      school: schoolGuard.school || schoolGuard.campusId || '',
      schoolId: schoolGuard.schoolId || schoolGuard.campusId || '',
      selectedCampusId: schoolGuard.selectedCampusId || schoolGuard.campusId || '',
      campusId: schoolGuard.campusId || schoolGuard.school || '',
      schoolName: schoolGuard.schoolName || schoolGuard.campusName || '',
      campusName: schoolGuard.campusName || schoolGuard.schoolName || '',
      spreadsheetId: schoolGuard.spreadsheetId || schoolGuard.selectedSpreadsheetId || '',
      guardVersion: schoolGuard.guardVersion || 'v05418dj',
      clientTabId: schoolGuard.clientTabId || '',
      clientSchoolSessionId: schoolGuard.clientSchoolSessionId || ''
    };
    if (!result.schoolScope) result.schoolScope = scope;
    if (result.dashboardSummary && typeof result.dashboardSummary === 'object' && !Array.isArray(result.dashboardSummary) && !result.dashboardSummary.schoolScope) result.dashboardSummary.schoolScope = scope;
    if (result.scheduleNow && typeof result.scheduleNow === 'object' && !Array.isArray(result.scheduleNow) && !result.scheduleNow.schoolScope) result.scheduleNow.schoolScope = scope;
    if (result.todo && typeof result.todo === 'object' && !Array.isArray(result.todo) && !result.todo.schoolScope) result.todo.schoolScope = scope;
    if (result.dashboardPage && typeof result.dashboardPage === 'object' && !Array.isArray(result.dashboardPage) && !result.dashboardPage.schoolScope) result.dashboardPage.schoolScope = scope;
    return result;
  }


  function normalizeNameForSchoolGuardV05418DN(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function addNameCandidateV05418DN(set, value) {
    const norm = normalizeNameForSchoolGuardV05418DN(value);
    if (norm) set.add(norm);
  }
  async function rosterNamesForDashboardGuardV05418DN(spreadsheetId) {
    const students = new Set();
    const staff = new Set();
    try {
      const studentValues = await readRedisSheetValues(redis, spreadsheetId, 'Students');
      const headers = Array.isArray(studentValues[0]) ? studentValues[0] : [];
      const nameCol = findHeaderIndex_(headers, ['name', 'student', 'student name'], 0);
      for (let i = 1; i < studentValues.length; i++) {
        const row = Array.isArray(studentValues[i]) ? studentValues[i] : [];
        addNameCandidateV05418DN(students, row[nameCol]);
      }
    } catch (_) {}
    try {
      const staffValues = await readRedisSheetValues(redis, spreadsheetId, 'Staff');
      const headers = Array.isArray(staffValues[0]) ? staffValues[0] : [];
      const nameCol = findHeaderIndex_(headers, ['name', 'staff', 'staff name', 'staff member', 'employee name'], 0);
      for (let i = 1; i < staffValues.length; i++) {
        const row = Array.isArray(staffValues[i]) ? staffValues[i] : [];
        addNameCandidateV05418DN(staff, row[nameCol]);
      }
    } catch (_) {}
    return { students, staff };
  }
  function schoolScopeForResultV05418DN(result) {
    result = result || {};
    return result.schoolScope || (result.dashboardSummary && result.dashboardSummary.schoolScope) || (result.scheduleNow && result.scheduleNow.schoolScope) || (result.todo && result.todo.schoolScope) || {};
  }
  function rowNameV05418DN(row, keys) {
    row = row || {};
    for (const key of keys || []) {
      const v = row[key];
      if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
    }
    return '';
  }
  function collectDashboardNamesV05418DN(result) {
    const out = [];
    const push = (kind, section, value) => { const norm = normalizeNameForSchoolGuardV05418DN(value); if (norm) out.push({ kind, section, value: String(value || '').trim(), norm }); };
    const summary = (result && (result.dashboardSummary || result.summary)) || {};
    const now = (result && result.scheduleNow) || {};
    (now.studentRows || []).forEach((r) => push('student', 'scheduleNow.studentRows', rowNameV05418DN(r, ['student','name'])));
    (now.staffRows || []).forEach((r) => push('staff', 'scheduleNow.staffRows', rowNameV05418DN(r, ['staff','name'])));
    (summary.freeTime || []).forEach((r) => push('staff', 'dashboardSummary.freeTime', rowNameV05418DN(r, ['staff','name'])));
    (summary.unassigned || []).forEach((r) => { push('student', 'dashboardSummary.unassigned', rowNameV05418DN(r, ['student','name'])); push('staff', 'dashboardSummary.unassigned', rowNameV05418DN(r, ['staff'])); });
    (summary.staffAbsences || []).forEach((r) => push('staff', 'dashboardSummary.staffAbsences', rowNameV05418DN(r, ['staff','name'])));
    (summary.studentAbsences || []).forEach((r) => push('student', 'dashboardSummary.studentAbsences', rowNameV05418DN(r, ['student','name'])));
    (summary.dataUpdates || []).forEach((r) => push('student', 'dashboardSummary.dataUpdates', rowNameV05418DN(r, ['student','name'])));
    return out;
  }
  function clearDashboardContentForIsolationV05418DN(result, publicGuard, mismatches) {
    result = result && typeof result === 'object' ? result : {};
    const scope = schoolScopeForResultV05418DN(result) || publicGuard || {};
    const safeSummary = Object.assign({}, result.dashboardSummary || result.summary || {});
    safeSummary.unassigned = [];
    safeSummary.allowedUnstaffed = [];
    safeSummary.freeTime = [];
    safeSummary.staffAbsences = [];
    safeSummary.studentAbsences = [];
    safeSummary.dataUpdates = [];
    safeSummary.warnings = [{ type: 'Dashboard data blocked', severity: 'High', detail: 'Dashboard content did not match the selected school roster. Refresh Data after confirming the selected school.' }];
    safeSummary.schoolScope = scope;
    safeSummary.crossSchoolContentBlocked = true;
    safeSummary.crossSchoolContentMismatches = (mismatches || []).slice(0, 20);
    const safeNow = Object.assign({}, result.scheduleNow || {});
    safeNow.status = 'Blocked';
    safeNow.item = '';
    safeNow.itemTitle = 'Selected-school data required';
    safeNow.nextLabel = '';
    safeNow.staffRows = [];
    safeNow.studentRows = [];
    safeNow.source = 'blocked-cross-school-content-v05418dn';
    safeNow.message = 'Current schedule content did not match the selected school roster.';
    safeNow.schoolScope = scope;
    safeNow.crossSchoolContentBlocked = true;
    result.dashboardSummary = safeSummary;
    result.summary = safeSummary;
    result.scheduleNow = safeNow;
    result.crossSchoolContentBlocked = true;
    result.crossSchoolContentMismatches = (mismatches || []).slice(0, 20);
    result.schoolScope = scope;
    return result;
  }

  function summarizeDashboardRowsForTraceV05418DO(result) {
    result = result || {};
    const summary = result.dashboardSummary || result.summary || {};
    const now = result.scheduleNow || {};
    const pick = (arr, keys, max) => (Array.isArray(arr) ? arr : []).slice(0, max || 12).map((r) => {
      const out = {};
      (keys || []).forEach(k => { if (r && Object.prototype.hasOwnProperty.call(r, k)) out[k] = r[k]; });
      return out;
    });
    return {
      scheduleNowStudents: pick(now.studentRows, ['student','name','support','coveredBy','location'], 16),
      scheduleNowStaff: pick(now.staffRows, ['staff','name','status','detail'], 16),
      freeTime: pick(summary.freeTime, ['staff','name','minutes','detail'], 16),
      unassigned: pick(summary.unassigned, ['student','staff','item','period','support'], 16),
      staffAbsences: pick(summary.staffAbsences, ['staff','name','type','detail'], 12),
      studentAbsences: pick(summary.studentAbsences, ['student','name','type','detail'], 12)
    };
  }
  function makeDashboardSourceTraceV05418DO(result, publicGuard, functionName, effectiveArgs) {
    const isDash = /Dashboard|ScheduleNow|Todo/i.test(String(functionName || ''));
    if (!isDash) return null;
    const legacy = result && result.__legacySourceTraceV05418DO ? result.__legacySourceTraceV05418DO : null;
    const names = collectDashboardNamesV05418DN(result || {}).slice(0, 80);
    const scope = schoolScopeForResultV05418DN(result || {});
    const selected = publicGuard || {};
    const selectedKey = `${String(selected.campusId || selected.school || selected.schoolId || '').toLowerCase()}|${String(selected.spreadsheetId || selected.selectedSpreadsheetId || '').toLowerCase()}`;
    const legacySheets = legacy && Array.isArray(legacy.events) ? legacy.events.filter(e => /spreadsheet|getSheet|cache|properties/i.test(e.kind || '')).slice(0, 140) : [];
    const spreadsheetIds = legacy && Array.isArray(legacy.spreadsheetIds) ? legacy.spreadsheetIds : [];
    const suspiciousSpreadsheetReads = spreadsheetIds.filter(id => selected.spreadsheetId && String(id).toLowerCase() !== String(selected.spreadsheetId).toLowerCase());
    const cacheKeys = legacy && Array.isArray(legacy.cacheKeys) ? legacy.cacheKeys : [];
    const suspiciousCacheKeys = cacheKeys.filter(k => {
      const lk = String(k || '').toLowerCase();
      const selectedSchool = String(selected.campusId || selected.school || '').toLowerCase();
      return selectedSchool && !lk.includes(selectedSchool) && /school|dashboard|schedule/i.test(lk);
    }).slice(0, 40);
    return {
      version: 'v05418do',
      functionName: String(functionName || ''),
      selectedSchool: selected,
      selectedKey,
      resultScope: scope,
      effectiveArgsPreview: Array.isArray(effectiveArgs) ? effectiveArgs.slice(0, 3) : [],
      contentNames: names,
      rowSamples: summarizeDashboardRowsForTraceV05418DO(result || {}),
      legacyTraceSummary: legacy ? { meta: legacy.meta, spreadsheetIds: legacy.spreadsheetIds, sheets: legacy.sheets, cacheKeys: legacy.cacheKeys, propertyReads: legacy.propertyReads, eventCount: legacy.eventCount } : null,
      suspiciousSpreadsheetReads,
      suspiciousCacheKeys,
      legacyEvents: legacySheets
    };
  }
  function attachDashboardSourceTraceV05418DO(result, trace) {
    if (!trace || !result || typeof result !== 'object' || Array.isArray(result)) return result;
    result.__dashboardSourceTraceV05418DO = trace;
    if (result.dashboardSummary && typeof result.dashboardSummary === 'object') result.dashboardSummary.__dashboardSourceTraceV05418DO = trace;
    if (result.summary && typeof result.summary === 'object') result.summary.__dashboardSourceTraceV05418DO = trace;
    if (result.scheduleNow && typeof result.scheduleNow === 'object') result.scheduleNow.__dashboardSourceTraceV05418DO = trace;
    if (result.todo && typeof result.todo === 'object') result.todo.__dashboardSourceTraceV05418DO = trace;
    return result;
  }


  function dashboardSelectedSchoolPayloadV05418DP(guard, selectedSchoolForRun) {
    const src = guard && guard.ctx ? {
      school: guard.ctx.school,
      schoolId: guard.ctx.school,
      selectedCampusId: guard.ctx.school,
      campusId: guard.ctx.school,
      name: guard.ctx.schoolName || guard.ctx.school,
      schoolName: guard.ctx.schoolName || guard.ctx.school,
      selectedCampusName: guard.ctx.schoolName || guard.ctx.school,
      campusName: guard.ctx.schoolName || guard.ctx.school,
      spreadsheetId: guard.ctx.spreadsheetId,
      selectedSpreadsheetId: guard.ctx.spreadsheetId
    } : selectedSchoolForRun;
    return sanitizeSelectedSchoolV025(src) || src || {};
  }
  function dashboardDaysArgV05418DP(rawArgs) {
    const n = Number(Array.isArray(rawArgs) ? rawArgs[0] : undefined);
    return Number.isFinite(n) && n > 0 ? n : 14;
  }
  function routeDashboardLegacyCallV05418DP(script, functionName, rawArgs, guard, selectedSchoolForRun) {
    // v05418em: disabled for main portal. Restore legacy direct Now/Dashboard calls so stale dashboard-page projections cannot overwrite the Now tile after hard refresh.
    return null;
    if (String(script || 'admin') !== 'admin') return null;
    const fn = String(functionName || '');
    const school = dashboardSelectedSchoolPayloadV05418DP(guard, selectedSchoolForRun);
    if (!school || (!school.school && !school.campusId && !school.spreadsheetId)) return null;
    const days = dashboardDaysArgV05418DP(rawArgs);
    const selected = mergeSelectedSchoolPayloadV025({}, school);
    if (/^getDashboardPageFastV5443$/.test(fn)) {
      return { functionName: 'getDashboardPageFastV5443', args: [days, selected], projection: 'page', originalFunctionName: fn, routed: false };
    }
    // v0.54.18dp: never allow legacy/no-arg Dashboard functions to decide the school from
    // UserProperties(V5_SELECTED_CAMPUS_ID) or any server-side current-campus fallback. A
    // diagnostic once showed V5_SELECTED_CAMPUS_ID lagging behind the tab-selected school;
    // these functions could return the wrong campus's content and cache it under the wrong key.
    if (/^(getScheduleNowFastV5195|getScheduleNowFastV5443)$/.test(fn)) {
      return { functionName: 'getDashboardPageFastV5443', args: [days, selected], projection: 'scheduleNow', originalFunctionName: fn, routed: true };
    }
    if (/^(getPortalDashboardSummaryFastV5195|getDashboardSummaryFastV5444|getPortalDashboardSummaryLightV686m20)$/.test(fn)) {
      return { functionName: 'getDashboardPageFastV5443', args: [days, selected], projection: 'dashboardSummary', originalFunctionName: fn, routed: true };
    }
    if (/^getTodoItemsV5$/.test(fn)) {
      return { functionName: 'getTodoItemsFastV5444', args: [selected], projection: 'todoItemsLegacy', originalFunctionName: fn, routed: true };
    }
    return null;
  }
  function projectDashboardLegacyResultV05418DP(result, routeInfo, publicGuard) {
    if (!routeInfo || !routeInfo.projection || routeInfo.projection === 'page') return result;
    let projected = result;
    if (routeInfo.projection === 'scheduleNow') projected = (result && (result.scheduleNow || result.now)) || {};
    else if (routeInfo.projection === 'dashboardSummary') projected = (result && (result.dashboardSummary || result.summary)) || {};
    else if (routeInfo.projection === 'todoItemsLegacy') projected = (result && (result.items || result.todoItems)) || [];
    if (projected && typeof projected === 'object' && !Array.isArray(projected)) {
      projected.__dashboardLegacyRouteV05418DP = { from: routeInfo.originalFunctionName, to: routeInfo.functionName, projection: routeInfo.projection, version: 'v05418dp' };
      projected.schoolScope = projected.schoolScope || publicGuard || (result && result.schoolScope) || {};
    }
    return projected;
  }

  async function hardenDashboardContentAgainstCrossSchoolV05418DN(result, publicGuard, functionName) {
    const fn = String(functionName || '');
    if (!/Dashboard|ScheduleNow/i.test(fn)) return result;
    if (!publicGuard || !publicGuard.spreadsheetId) return result;
    if (!result || typeof result !== 'object' || Array.isArray(result)) return result;
    const roster = await rosterNamesForDashboardGuardV05418DN(publicGuard.spreadsheetId);
    if (!roster.students.size && !roster.staff.size) return result;
    const names = collectDashboardNamesV05418DN(result);
    if (!names.length) return result;
    const mismatches = [];
    names.forEach((n) => {
      const sourceSet = n.kind === 'staff' ? roster.staff : roster.students;
      if (sourceSet.size && !sourceSet.has(n.norm)) mismatches.push(n);
    });
    // One unknown legacy/manual row should not blank the Dashboard, but two or more
    // cross-roster names in selected-school schedule tiles is a clear cross-school leak.
    if (mismatches.length >= 2) {
      try { console.warn('[v05418dn] Blocked Dashboard content that did not match selected-school roster', { functionName: fn, school: publicGuard.campusId || publicGuard.school, spreadsheetId: publicGuard.spreadsheetId, mismatches: mismatches.slice(0, 10) }); } catch (_) {}
      return clearDashboardContentForIsolationV05418DN(result, publicGuard, mismatches);
    }
    result.dashboardRosterGuardV05418DN = { ok: true, checked: names.length, mismatches: mismatches.length, version: 'v05418dn' };
    return result;
  }
  app.post('/api/google-script-run', async (req, res) => {
    const body = req.body || {};
    const script = body.script || 'admin';
    const functionName = body.functionName;
    const rawArgs = Array.isArray(body.args) ? body.args : [];
    if (!functionName) return res.status(400).json({ ok: false, error: 'Missing functionName.' });
    const selectedSchoolInput = body.selectedSchool || body.schoolContext || null;
    const args = injectSelectedSchoolArgsV025(script, functionName, rawArgs, selectedSchoolInput);
    try {
      const selectedSchoolForRun = sanitizeSelectedSchoolV025(selectedSchoolInput);
      const fn = String(functionName || '');
      if (String(script || 'admin') === 'admin' && isSchoolScopedReadFunctionV05418DJ(fn) && !selectedSchoolForRun) {
        throw new Error('School Data Guard: this school-scoped action did not include a tab-selected school. Refusing to use a shared or stale server selected school. Return to the school selector or refresh this tab.');
      }
      const guard = await validateSelectedSchoolForRunV027(redis, req, selectedSchoolForRun, functionName, rawArgs);
      const tabInfo = clientTabInfoV05418DJ(body);
      const publicGuard = schoolGuardPublicV05418DJ(guard, tabInfo);
      const effectiveSelectedSchoolForRun = guard && guard.ctx ? {
        school: guard.ctx.school,
        schoolId: guard.ctx.school,
        selectedCampusId: guard.ctx.school,
        campusId: guard.ctx.school,
        name: guard.ctx.schoolName || guard.ctx.school,
        schoolName: guard.ctx.schoolName || guard.ctx.school,
        selectedCampusName: guard.ctx.schoolName || guard.ctx.school,
        campusName: guard.ctx.schoolName || guard.ctx.school,
        spreadsheetId: guard.ctx.spreadsheetId,
        selectedSpreadsheetId: guard.ctx.spreadsheetId
      } : selectedSchoolForRun;
      const effectiveArgs = Array.isArray(args) ? args.slice() : args;
      if (guard && guard.ctx && Array.isArray(effectiveArgs) && effectiveArgs[0] && typeof effectiveArgs[0] === 'object' && !Array.isArray(effectiveArgs[0])) {
        effectiveArgs[0] = mergeSelectedSchoolPayloadV025(effectiveArgs[0], effectiveSelectedSchoolForRun);
      }
      if (String(script || 'admin') === 'admin' && String(functionName) === 'updateFolderDatesV5' && guard && guard.ctx && guard.ctx.spreadsheetId) {
        const accessToken = await getRequestGoogleAccessToken(req, res);
        if (accessToken) {
          const result = await refreshStudentDataMetricsV025(redis, guard.ctx.spreadsheetId, accessToken, getRequestUserEmail(req));
          await appendAdminActivityLogV027(redis, guard.ctx.spreadsheetId, 'Data files refreshed', 'updateFolderDatesV5', getRequestUserEmail(req), result && result.message ? result.message : 'Student data metrics refreshed.');
          const guardedResult = attachSchoolGuardToResultV05418DJ(Object.assign({}, result || {}), publicGuard);
          return res.json({ ok: true, result: guardedResult, schoolGuard: publicGuard });
        }
      }
      const serverShortcutV05418EI = await directServerScheduleShortcutV05418EI(redis, guard && guard.ctx && guard.ctx.spreadsheetId, functionName);
      if (serverShortcutV05418EI) {
        return res.json({ ok: true, result: attachSchoolGuardToResultV05418DJ(serverShortcutV05418EI.result, publicGuard), schoolGuard: publicGuard });
      }
      const dashboardRouteV05418DP = routeDashboardLegacyCallV05418DP(script, functionName, rawArgs, guard, effectiveSelectedSchoolForRun);
      const runtimeFunctionNameV05418DP = dashboardRouteV05418DP ? dashboardRouteV05418DP.functionName : functionName;
      const runtimeArgsV05418DP = dashboardRouteV05418DP ? dashboardRouteV05418DP.args : effectiveArgs;
      let rawResultV05418DP = await runtime.call(script, runtimeFunctionNameV05418DP, runtimeArgsV05418DP, { userEmail: getRequestUserEmail(req), selectedSchool: effectiveSelectedSchoolForRun });
      if (String(script || 'admin') === 'admin' && String(functionName) === 'saveStaffFromManagerV5' && effectiveSelectedSchoolForRun && effectiveSelectedSchoolForRun.spreadsheetId) {
        try {
          const savedPayload = Array.isArray(effectiveArgs) && effectiveArgs[0] ? effectiveArgs[0] : {};
          const staffNameForPhone = (rawResultV05418DP && rawResultV05418DP.name) || savedPayload.name || savedPayload.oldName || '';
          const rowIndexForPhone = (rawResultV05418DP && rawResultV05418DP.rowIndex) || savedPayload.rowIndex || 0;
          if (staffNameForPhone) {
            await saveStaffPhoneV05418PHDirect(redis, effectiveSelectedSchoolForRun.spreadsheetId, staffNameForPhone, rowIndexForPhone, savedPayload.phone || '');
          }
        } catch (phoneSyncErr) { /* the .gs save already succeeded; this only guarantees the phone column specifically */ }
      }
      // Note: the phone-overlay that used to live here (a second, redundant read of the
      // entire Staff sheet from Redis) was removed -- the underlying .gs function already
      // assigns st.phone correctly on its own, so this was doubling the Redis read cost
      // for the Staff sheet on every single Staff Manager data load for no benefit.
      if (String(script || 'admin') === 'admin' && /^getAdminSchedulePageHtmlFastV686m(13|14|17|18)$/.test(String(functionName)) && rawResultV05418DP && rawResultV05418DP.page === 'staffSchedules' && typeof rawResultV05418DP.html === 'string' && rawResultV05418DP.html.indexOf('STAFF_TABLE_PLACEHOLDER_V05418EL') >= 0) {
        try {
          const staffTable = await runtime.call('staff', 'renderPublicStaffViewTableOnlyV05418Test_', [rawResultV05418DP.data || {}], { userEmail: getRequestUserEmail(req), selectedSchool: effectiveSelectedSchoolForRun });
          rawResultV05418DP.html = rawResultV05418DP.html.replace('<!--STAFF_TABLE_PLACEHOLDER_V05418EL-->', (staffTable && staffTable.html) || '<div class="muted" style="padding:12px">No staff schedule rows were found.</div>');
        } catch (spliceErr) {
          rawResultV05418DP.html = rawResultV05418DP.html.replace('<!--STAFF_TABLE_PLACEHOLDER_V05418EL-->', '<div class="muted" style="padding:12px">Could not load staff schedule table: ' + (spliceErr && spliceErr.message ? spliceErr.message : String(spliceErr)) + '</div>');
        }
      }
      rawResultV05418DP = await patchDashboardPageWithPublishedNowV05418EI(redis, guard && guard.ctx && guard.ctx.spreadsheetId, rawResultV05418DP, functionName);
      const result = projectDashboardLegacyResultV05418DP(rawResultV05418DP, dashboardRouteV05418DP, publicGuard);
      let guardedResult = attachSchoolGuardToResultV05418DJ(result, publicGuard);
      if (dashboardRouteV05418DP && guardedResult && typeof guardedResult === 'object' && !Array.isArray(guardedResult)) {
        guardedResult.__dashboardLegacyRouteV05418DP = dashboardRouteV05418DP;
      }
      const dashboardSourceTraceV05418DO = makeDashboardSourceTraceV05418DO(guardedResult, publicGuard, functionName, runtimeArgsV05418DP);
      guardedResult = await hardenDashboardContentAgainstCrossSchoolV05418DN(guardedResult, publicGuard, functionName);
      guardedResult = attachDashboardSourceTraceV05418DO(guardedResult, dashboardSourceTraceV05418DO);
      if (guard && guard.ctx && isPotentialWriteFunctionV027(functionName)) {
        await appendAdminActivityLogV027(redis, guard.ctx.spreadsheetId, 'Portal action', String(functionName || ''), getRequestUserEmail(req), summarizeResultV027(result));
      }
      res.json({ ok: true, result: guardedResult, schoolGuard: publicGuard });
    } catch (err) {
      res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err), stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
    }
  });

  async function renderStaffPortalRouteV05418O(req, res, routeLabel) {
    try {
      const rawStaffQueryV027 = Object.assign({}, req.query || {});
      const query = await normalizeStaffPortalQuery(redis, req.query || {});
      const staffSchool = await selectedSchoolContextForStaffPortalV026(redis, query);
      await recordStaffPortalAccessV027(redis, req, query, staffSchool, rawStaffQueryV027, routeLabel || 'staff');
      let html = await runtime.call('staff', 'renderPublicStaffPortalPage_', [query, null], { userEmail: getRequestUserEmail(req), selectedSchool: staffSchool });
      html = await enforceStaffPortalRegularDisplayV05417(redis, html, staffSchool);
      html = injectStaffPortalRedisPatch(html, query, { mobile: false });
      html = injectSplitAwareStaffCardIntoHtmlV05418EF(html, await splitAwareStaffScheduleCardForRequestV05418EF(redis, staffSchool, query));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      res.status(500).send(renderError('Staff Portal failed to render', err));
    }
  }

  app.get('/staff/', async (req, res) => {
    const hasPortalQuery = !!(req.query && (req.query.school || req.query.schoolId || req.query.staff || req.query.staffName || req.query.staffToken || req.query.token));
    if (!hasPortalQuery) return res.redirect('/');
    return renderStaffPortalRouteV05418O(req, res, 'staff');
  });

  app.get('/staff', async (req, res) => {
    const hasPortalQuery = !!(req.query && (req.query.school || req.query.schoolId || req.query.staff || req.query.staffName || req.query.staffToken || req.query.token));
    if (!hasPortalQuery) return res.redirect('/');
    return renderStaffPortalRouteV05418O(req, res, 'staff');
  });

  app.get('/staff/:schoolParam', async (req, res) => {
    const raw = String((req.params && req.params.schoolParam) || '').trim();
    const parsed = raw.replace(/^school=/i, '').trim();
    req.query = Object.assign({}, req.query || {});
    if (parsed && !req.query.school && !req.query.schoolId) req.query.school = parsed;
    return renderStaffPortalRouteV05418O(req, res, 'staff');
  });

  app.get('/staff-mobile', async (req, res) => {
    try {
      const rawStaffQueryV027 = Object.assign({}, req.query || {});
      const query = await normalizeStaffPortalQuery(redis, Object.assign({}, req.query || {}, { mobile: '1' }));
      const staffSchool = await selectedSchoolContextForStaffPortalV026(redis, query);
      await recordStaffPortalAccessV027(redis, req, query, staffSchool, rawStaffQueryV027, 'staff-mobile');
      let html = await runtime.call('staff', 'renderPublicStaffPortalPage_', [query, null], { userEmail: getRequestUserEmail(req), selectedSchool: staffSchool });
      html = await enforceStaffPortalRegularDisplayV05417(redis, html, staffSchool);
      html = injectStaffPortalRedisPatch(html, query, { mobile: true });
      html = injectSplitAwareStaffCardIntoHtmlV05418EF(html, await splitAwareStaffScheduleCardForRequestV05418EF(redis, staffSchool, query));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      res.status(500).send(renderError('Mobile Staff Portal failed to render', err));
    }
  });

  app.post('/staff', async (req, res) => {
    try {
      const body = req.body || {};
      let effectiveBody = body;
      if (String(body.action || '').trim() === 'savePublicStaffPhone') {
        let noticeType = 'ok', noticeText = 'Phone saved.';
        try {
          const query = await normalizeStaffPortalQuery(redis, { school: body.school, staffName: body.staffName, staffToken: body.staffToken });
          const staffSchool = await selectedSchoolContextForStaffPortalV026(redis, query);
          if (!staffSchool) throw new Error('Unknown school.');
          const staffName = String(query.staffName || query.staff || '').trim();
          const staffToken = String(query.staffToken || '').trim();
          if (!staffName || !staffToken) throw new Error('This staff link is not valid. Open your current Staff Portal link and try again.');
          const cfg = await getStaffPortalBootstrapConfig(redis);
          const tokenVersion = await getStaffTokenVersionV05421(redis, staffSchool.spreadsheetId, staffName);
          const expected = makeStaffPortalToken(query.school, staffName, cfg.tokenSecret, tokenVersion);
          if (staffToken !== expected) throw new Error('This staff link is not valid. Open your current Staff Portal link and try again.');
          const result = await saveStaffPhoneV05418PHDirect(redis, staffSchool.spreadsheetId, staffName, 0, body.phone || '');
          noticeText = result.message || 'Phone saved.';
        } catch (phoneErr) {
          noticeType = 'err';
          noticeText = (phoneErr && phoneErr.message) || 'Could not save phone.';
        }
        effectiveBody = Object.assign({}, body, { action: 'refreshView', noticeKind: 'phone', noticeType, noticeText });
      }
      const e = { parameter: effectiveBody, parameters: effectiveBody, postData: { contents: JSON.stringify(effectiveBody) } };
      const staffSchool = await selectedSchoolContextForStaffPortalV026(redis, body || {});
      const html = await runtime.call('staff', 'doPost', [e], { userEmail: getRequestUserEmail(req), selectedSchool: staffSchool });
      try {
        const actionV05418N = String((body && body.action) || 'submitAbsence').trim();
        if (actionV05418N !== 'saveCommunicationPreferences' && actionV05418N !== 'savePublicStaffPhone' && /successPanel|Absence report submitted/i.test(String(html || ''))) {
          await sendBrevoAbsenceNotificationV05418N(redis, req, staffSchool, body || {});
        }
      } catch (notifyErrV05418N) {
        try { console.warn('Brevo absence notification failed:', notifyErrV05418N && notifyErrV05418N.message ? notifyErrV05418N.message : notifyErrV05418N); } catch (_) {}
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      res.status(500).send(renderError('Staff Portal post failed', err));
    }
  });

  app.post('/connector', async (req, res) => {
    try {
      const e = { parameter: req.query || {}, parameters: req.query || {}, postData: { contents: JSON.stringify(req.body || {}), type: 'application/json' } };
      const out = await runtime.call('connector', 'doPost', [e], { userEmail: getRequestUserEmail(req) });
      if (typeof out === 'string') return res.type('application/json').send(out);
      res.json(out);
    } catch (err) {
      res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
    }
  });

  app.get('/legacy-source/:name', (req, res) => {
    const allowed = { admin: 'admin_portal_current_m46.gs', staff: 'staff_portal_current_1_3_8.gs', connector: 'email_connector_current_1_4_3.gs' };
    const file = allowed[req.params.name];
    if (!file) return res.status(404).send('Not found');
    res.sendFile(path.resolve(__dirname, '..', 'legacy', file));
  });

  // v54.2: API routes must always return JSON. Without this guard, a mistyped or
  // outdated manager endpoint can fall through to index.html and the browser shows
  // confusing errors such as Unexpected token '<' or Unexpected end of JSON input.

  app.get('/api/v0546/staff-row-metrics', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const staffName = String((req.query && (req.query.staffName || req.query.staff || req.query.name)) || '').trim();
      if (!staffName) throw new Error('staffName is required.');
      const lastView = await getStaffPortalLastViewFromSummaryV0546(redis, ctx.spreadsheetId, staffName);
      const attendance = await getStaffAttendanceSummaryDirectV0546(redis, ctx.spreadsheetId, staffName);
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), { staffName, lastView, attendance }));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.get('/api/v0546/staff-attendance-details', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const staffName = String((req.query && (req.query.staffName || req.query.staff || req.query.name)) || '').trim();
      if (!staffName) throw new Error('staffName is required.');
      const attendance = await getStaffAttendanceSummaryDirectV0546(redis, ctx.spreadsheetId, staffName, { includeRows: true });
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), { staffName, attendance }));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.get('/api/v0546/custom-period-scope-diagnostic', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const props = await readCampusScopedPropertiesFromRedis(redis, ctx.spreadsheetId);
      let periodMeta = [], custom = {};
      try { periodMeta = JSON.parse(props.V5_PERIOD_META_JSON || '[]') || []; } catch { periodMeta = []; }
      try { custom = JSON.parse(props.V5_CUSTOM_STUDENT_PERIODS_JSON || '{}') || {}; } catch { custom = {}; }
      const customKeys = new Set();
      Object.values(custom || {}).forEach(map => Object.keys(map || {}).forEach(k => customKeys.add(k)));
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), {
        propertyScope: '_V5Properties in selected school data store; shared DocumentProperties are not used for custom periods',
        periodMetaCount: Array.isArray(periodMeta) ? periodMeta.length : 0,
        periodMetaKeys: (Array.isArray(periodMeta) ? periodMeta : []).map(x => x && x.key).filter(Boolean),
        customStudentCount: Object.keys(custom || {}).length,
        customPeriodKeys: Array.from(customKeys).sort()
      }));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });


  app.get('/api/v0547/custom-period-scope-diagnostic', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const props = await readCampusScopedPropertiesFromRedis(redis, ctx.spreadsheetId);
      let periodMeta = [], custom = {};
      try { periodMeta = JSON.parse(props.V5_PERIOD_META_JSON || '[]') || []; } catch { periodMeta = []; }
      try { custom = JSON.parse(props.V5_CUSTOM_STUDENT_PERIODS_JSON || '{}') || {}; } catch { custom = {}; }
      const customKeys = new Set();
      Object.values(custom || {}).forEach(map => Object.keys(map || {}).forEach(k => customKeys.add(k)));
      const scheduleTemplates = await readRedisSheetValues(redis, ctx.spreadsheetId, 'Schedule Templates');
      const templateItems = new Set();
      (scheduleTemplates || []).slice(1).forEach(row => {
        const item = row && row[1] != null ? String(row[1]).trim() : '';
        if (item) templateItems.add(item);
      });
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), {
        propertyScope: '_V5Properties in selected school data store; shared DocumentProperties are not used for custom periods',
        runtimeCacheFix: 'v0547 clears legacy Apps Script execution caches before every server call so period display names cannot leak across schools in the persistent Node VM',
        periodMetaCount: Array.isArray(periodMeta) ? periodMeta.length : 0,
        periodMetaRows: (Array.isArray(periodMeta) ? periodMeta : []).map(x => ({ key: x && x.key || '', displayName: x && (x.displayName || x.key) || '', blockType: x && (x.blockType || x.type) || '' })).filter(x => x.key),
        periodMetaKeys: (Array.isArray(periodMeta) ? periodMeta : []).map(x => x && x.key).filter(Boolean),
        customStudentCount: Object.keys(custom || {}).length,
        customPeriodKeys: Array.from(customKeys).sort(),
        scheduleTemplateItemCount: templateItems.size,
        scheduleTemplateItems: Array.from(templateItems).sort()
      }));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });



  // v54.8: Staff Manager row metrics use the same direct access-log source as Data Manager
  // first, then fall back to the access-summary path. This keeps Last View aligned with
  // Staff Portal access tracking and avoids UI-only stale blanks.
  app.get('/api/v0548/staff-row-metrics', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const staffName = String((req.query && (req.query.staffName || req.query.staff || req.query.name)) || '').trim();
      if (!staffName) throw new Error('staffName is required.');
      let lastView = await getStaffPortalLastViewDirectV0545(redis, ctx.spreadsheetId, staffName).catch(() => null);
      if (!lastView || !lastView.lastViewedRaw) lastView = await getStaffPortalLastViewFromSummaryV0546(redis, ctx.spreadsheetId, staffName).catch(() => lastView || {});
      // BUGFIX: "Last View" only ever reflected the Staff Portal (web) view timestamp, even
      // though a staff member may instead (or additionally) be viewing their schedule through
      // the paired mobile app, which tracks its own separate lastSeenAt (_AppDevices). A staff
      // member who only opens the app would show as stale/"Not viewed" here even though
      // they've genuinely seen the current schedule -- Communication Manager already surfaces
      // the app's lastSeenAt correctly, this just folds that same value in here. Take whichever
      // of portal-lastViewed or app-lastSeen is more recent as the effective last-view time, and
      // judge staleness (red) against that combined value, not portal-only.
      const appKeyV05418AC = normalizeKeyV05418X(staffName);
      const appDevicesV05418AC = await readAppDevicesV05418Y(redis, ctx.spreadsheetId).catch(() => []);
      const appLastSeenRawV05418AC = appDevicesV05418AC.filter((d) => normalizeKeyV05418X(d.staffName) === appKeyV05418AC && d.lastSeenAt).map((d) => d.lastSeenAt).sort().pop() || '';
      const portalRawV05418AC = (lastView && lastView.lastViewedRaw) || '';
      const portalDateV05418AC = portalRawV05418AC ? parseDateLooseV027(portalRawV05418AC) : null;
      const appDateV05418AC = appLastSeenRawV05418AC ? parseDateLooseV027(appLastSeenRawV05418AC) : null;
      if (appDateV05418AC && (!portalDateV05418AC || appDateV05418AC.getTime() > portalDateV05418AC.getTime())) {
        const publishV05418AC = await getScheduleVersionV027(redis, ctx.spreadsheetId).catch(() => ({}));
        const publishDateV05418AC = publishV05418AC && publishV05418AC.publishedAt ? parseDateLooseV027(publishV05418AC.publishedAt) : null;
        const viewedAfterPublishV05418AC = !!(publishDateV05418AC && appDateV05418AC.getTime() >= publishDateV05418AC.getTime());
        lastView = Object.assign({}, lastView, {
          source: 'app-device',
          lastViewedRaw: appLastSeenRawV05418AC,
          lastViewed: formatDateTimeV027(appLastSeenRawV05418AC),
          publishedAt: publishV05418AC.publishedAt || (lastView && lastView.publishedAt) || '',
          publishedAtFormatted: publishV05418AC.publishedAt ? formatDateTimeV027(publishV05418AC.publishedAt) : ((lastView && lastView.publishedAtFormatted) || ''),
          viewedAfterPublish: viewedAfterPublishV05418AC,
          stale: !!(publishDateV05418AC && !viewedAfterPublishV05418AC)
        });
      }
      const attendance = await getStaffAttendanceSummaryDirectV0546(redis, ctx.spreadsheetId, staffName);
      const commPreference = await getCommPreferenceV05418BV(redis, ctx.spreadsheetId, staffName).catch(() => 'email');
      res.json(Object.assign({ ok: true, version: VERSION, source: 'v0548-direct-first' }, ctxPublicV027(ctx), { staffName, lastView: lastView || {}, attendance, commPreference }));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.get('/api/v0548/staff-attendance-details', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const staffName = String((req.query && (req.query.staffName || req.query.staff || req.query.name)) || '').trim();
      if (!staffName) throw new Error('staffName is required.');
      const attendance = await getStaffAttendanceSummaryDirectV0546(redis, ctx.spreadsheetId, staffName, { includeRows: true });
      res.json(Object.assign({ ok: true, version: VERSION, source: 'v0548-attendance-direct' }, ctxPublicV027(ctx), { staffName, attendance }));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.get('/api/v0548/settings-announcement-diagnostic', async (req, res) => {
    try {
      const ctx = await resolveSchoolContextV027(redis, req, req.query || {});
      const props = await readCampusScopedPropertiesFromRedis(redis, ctx.spreadsheetId).catch(() => ({}));
      const regular = await buildRegularScheduleV022(redis, ctx.spreadsheetId).catch(err => ({ error: err.message }));
      res.json(Object.assign({ ok: true, version: VERSION }, ctxPublicV027(ctx), {
        showBadgesRaw: props.V5_SHOW_BADGES || '',
        showBadgesEffective: /^(true|yes|1)$/i.test(String(props.V5_SHOW_BADGES || '')),
        regularDisplayRaw: props.V5_DISPLAY_REGULAR_ON_STAFF_PORTAL || '',
        regularDisplayEffective: regular && regular.displayOnStaffPortal === true,
        announcementSchoolRaw: props.V5_STAFF_PORTAL_SCHOOL_ANNOUNCEMENT_JSON || '',
        announcementGlobalRaw: props.V5_STAFF_PORTAL_GLOBAL_ANNOUNCEMENT_JSON || '',
        note: 'v0548 protects false/unchecked settings from default yes overwrites and keeps announcements scoped by school/global target.'
      }));
    } catch (err) { res.status(400).json({ ok: false, version: VERSION, error: err.message }); }
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ ok: false, version: VERSION, error: 'API endpoint not found: ' + req.method + ' ' + req.originalUrl });
  });

  app.get(['/admin/*'], (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html')); });

  app.get('*', (req, res) => {
    res.status(404).send(renderError('Page not found', new Error('The page you requested is not available. Check the link and try again.')));
  });

  // HARDENING: catch-all Express error handler. Must be registered last (after every route
  // and other middleware) — Express only routes to a 4-arg handler like this one. This
  // catches synchronous throws from any route/middleware above (Express 4 forwards those
  // automatically) so a single bad request gets a clean JSON/HTML error response instead of
  // an unhandled exception. It intentionally does NOT catch rejected promises from `async`
  // route handlers that never call `next(err)` themselves — Express 4 doesn't do that
  // automatically. Most routes in this file already have their own try/catch; this is the
  // backstop for the ones that don't, working together with the process-level
  // uncaughtException/unhandledRejection handlers above for anything that slips past both.
  app.use((err, req, res, next) => {
    console.error('[error]', req.method, req.originalUrl, err && err.stack ? err.stack : err);
    if (res.headersSent) return next(err);
    if (req.path.startsWith('/api')) {
      res.status(500).json({ ok: false, version: VERSION, error: 'Internal server error' });
    } else {
      res.status(500).send(renderError('Something went wrong', err));
    }
  });

  const port = Number(process.env.PORT || 8080);
  const server = app.listen(port, () => console.log(`Support Schedules Redis runtime listening on :${port}`));

  // ===================================================================================
  // Auto-publish / auto-clear-published scheduler (v05420). In the original Apps Script
  // version, these settings worked by registering a ScriptApp.newTrigger(...).timeBased()
  // job that Apps Script itself would invoke every 5 minutes. That trigger API has no real
  // equivalent in this Node runtime -- the compatibility shim's ScriptApp.newTrigger(...)
  // is a silent no-op (it doesn't throw; it just returns as if a trigger was created), so
  // saving either setting persisted correctly but nothing was ever actually scheduled to
  // check it. autoPublishScheduleCheckV543() and autoClearPublishedScheduleCheckV5181()
  // (both in the admin legacy script) are themselves correct and unchanged -- this just
  // gives them a real, working heartbeat, looping over every configured school.
  // ===================================================================================
  async function runAutoPublishClearSchedulerTickV05420() {
    let schools;
    try { schools = (await getStaffPortalBootstrapConfig(redis)).schools || {}; }
    catch (err) { console.error('[auto-publish/clear scheduler] could not list schools:', err && err.message ? err.message : err); return; }
    for (const key of Object.keys(schools)) {
      const spreadsheetId = schools[key] && schools[key].spreadsheetId;
      if (!spreadsheetId) continue;
      const selectedSchool = { spreadsheetId };
      try {
        const r = await runtime.call('admin', 'autoPublishScheduleCheckV543', [], { selectedSchool });
        if (r && r.ok) console.log('[auto-publish]', key, 'published:', JSON.stringify(r.status || {}));
      } catch (err) { console.error('[auto-publish scheduler]', key, err && err.message ? err.message : err); }
      try {
        const r2 = await runtime.call('admin', 'autoClearPublishedScheduleCheckV5181', [], { selectedSchool });
        if (r2 && r2.ok) console.log('[auto-clear-published]', key, 'cleared:', JSON.stringify(r2.status || {}));
      } catch (err2) { console.error('[auto-clear-published scheduler]', key, err2 && err2.message ? err2.message : err2); }
    }
  }
  const autoPublishClearIntervalV05420 = setInterval(() => {
    runAutoPublishClearSchedulerTickV05420().catch((err) => console.error('[auto-publish/clear scheduler] tick failed:', err && err.message ? err.message : err));
  }, 5 * 60 * 1000);
  // Run once shortly after boot too, rather than waiting up to 5 minutes for the first check
  // (e.g. a server restart right at the auto-publish window shouldn't miss it).
  setTimeout(() => {
    runAutoPublishClearSchedulerTickV05420().catch((err) => console.error('[auto-publish/clear scheduler] initial tick failed:', err && err.message ? err.message : err));
  }, 15 * 1000);

  // HARDENING: graceful shutdown. Render (and most hosts) send SIGTERM before killing a
  // process on redeploy or scale-down. Without handling it, in-flight requests get dropped
  // mid-response instead of finishing, and the Redis connection is never closed cleanly.
  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] received ${signal}, closing server...`);
    clearInterval(autoPublishClearIntervalV05420);
    const forceExit = setTimeout(() => {
      console.warn('[shutdown] graceful shutdown timed out after 10s, forcing exit.');
      process.exit(1);
    }, 10000);
    forceExit.unref();
    server.close(async (err) => {
      if (err) console.error('[shutdown] error closing server:', err);
      try { if (redis && typeof redis.quit === 'function') await redis.quit(); } catch (e) { console.error('[shutdown] error closing redis:', e); }
      clearTimeout(forceExit);
      console.log('[shutdown] complete.');
      process.exit(0);
    });
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

function isAuthEnabled() { return /^true|1|yes$/i.test(String(process.env.GOOGLE_AUTH_ENABLED || '')); }
function isSecure(req) { return req.secure || String(req.get('x-forwarded-proto') || '').split(',')[0] === 'https'; }
function getBaseUrl(req) { return (process.env.PUBLIC_BASE_URL || `${isSecure(req) ? 'https' : 'http'}://${req.get('host')}`).replace(/\/$/, ''); }
function getClientIpV05422(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || (req.socket && req.socket.remoteAddress) || '';
}
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function signPayload(payload) { const secret = process.env.SESSION_SECRET || 'dev-session-secret-change-me'; const body = b64url(JSON.stringify(payload)); const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest()); return `${body}.${sig}`; }
function verifyPayload(token) { try { const [body, sig] = String(token || '').split('.'); if (!body || !sig) return null; const expected = b64url(crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-session-secret-change-me').update(body).digest()); if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null; const data = JSON.parse(Buffer.from(body.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8')); if (data.exp && data.exp < Date.now()) return null; return data; } catch { return null; } }
function setAuthCookie(res, user, req) { const payload = { email: user.email, name: user.name || '', accessToken: user.accessToken || '', refreshToken: user.refreshToken || '', tokenExpiresAt: user.tokenExpiresAt || 0, exp: Date.now() + 12 * 60 * 60 * 1000 }; res.cookie('ga_auth', signPayload(payload), { httpOnly: true, sameSite: 'lax', secure: isSecure(req), maxAge: 12 * 60 * 60 * 1000 }); }
function clearAuthCookie(res) { res.clearCookie('ga_auth'); }
function getRequestUser(req) { if (!isAuthEnabled()) return { email: process.env.GA_ACTIVE_USER_EMAIL || '', name: '' }; return verifyPayload(req.cookies.ga_auth); }
function getRequestUserEmail(req) { const user = getRequestUser(req); return (user && user.email) || process.env.GA_ACTIVE_USER_EMAIL || ''; }
async function getRequestGoogleAccessToken(req, res) {
  const user = getRequestUser(req);
  const exp = Number(user && user.tokenExpiresAt || 0);
  if (user && user.accessToken && (!exp || exp > Date.now())) return user.accessToken;
  if (user && user.refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: user.refreshToken,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          grant_type: 'refresh_token'
        })
      });
      const refreshed = await tokenRes.json();
      if (tokenRes.ok && refreshed.access_token) {
        const newExpiresAt = Date.now() + Math.max(0, Number(refreshed.expires_in || 0) - 60) * 1000;
        if (res) {
          // Google does not reissue a refresh_token on a refresh call -- the same one stays
          // valid and reusable, so it's carried forward here rather than dropped.
          setAuthCookie(res, { email: user.email, name: user.name || '', accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token || user.refreshToken, tokenExpiresAt: newExpiresAt }, req);
        }
        return refreshed.access_token;
      }
    } catch (err) { /* fall through to the legacy fallback below */ }
  }
  return process.env.GOOGLE_FORMS_ACCESS_TOKEN || process.env.GOOGLE_ACCESS_TOKEN || '';
}
async function isEmailAllowed(email, redis) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return false;
  if (isEmailAllowedByEnv(email)) return true;
  try {
    const internal = await isEmailAllowedByCampusUsers(redis, email);
    if (internal) return true;
  } catch (err) {
    console.warn('[auth access check]', err && err.message ? err.message : err);
  }
  // Development/bootstrap fallback: if no environment gate is configured and there are no
  // active in-app access rows yet, allow login so the first admin can seed access.
  const envConfigured = hasEnvAccessGate_();
  if (!envConfigured) {
    const hasRows = await hasAnyActiveCampusUserRows(redis);
    if (!hasRows) return true;
  }
  return false;
}

function hasEnvAccessGate_() {
  return !!String(process.env.AUTH_ALLOWED_EMAILS || process.env.AUTH_ALLOWED_DOMAINS || process.env.GA_ACTIVE_USER_EMAIL || '').trim();
}

function isEmailAllowedByEnv(email) {
  email = String(email || '').trim().toLowerCase();
  const emails = String(process.env.AUTH_ALLOWED_EMAILS || process.env.GA_ACTIVE_USER_EMAIL || '').split(/[;,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const domains = String(process.env.AUTH_ALLOWED_DOMAINS || '').split(/[;,\s]+/).map(s => s.trim().replace(/^@/,'').toLowerCase()).filter(Boolean);
  if (emails.length && emails.includes(email)) return true;
  const domain = email.split('@')[1] || '';
  if (domains.length && domains.includes(domain)) return true;
  return false;
}

function parseCampusUserRowV0541_(row) {
  row = Array.isArray(row) ? row : [];
  const email = String(row[0] || '').trim().toLowerCase();
  const c1 = String(row[1] || '').trim();
  const c2 = String(row[2] || '').trim();
  const c3 = String(row[3] || '').trim();
  const roleWords = /^(district|owner|admin|administrator|manager|staff|viewer)$/i;
  const statusWords = /^(active|inactive|disabled|archived)$/i;
  // Preferred/current sheet: Email | School Short Code | Role | Status.
  // Older runtime guard expected: Email | Role | School | Status.
  const currentShape = !roleWords.test(c1) && (roleWords.test(c2) || statusWords.test(c3));
  let campus, role, status;
  if (currentShape) {
    campus = c1 || '*';
    role = c2 || 'Staff';
    status = c3 || 'Active';
  } else {
    role = c1 || 'Staff';
    campus = c2 || '*';
    status = c3 || 'Active';
  }
  return { email, campus, role, status };
}

async function isEmailAllowedByCampusUsers(redis, email) {
  email = String(email || '').trim().toLowerCase();
  const rows = await readAllCampusUserRows(redis);
  return rows.some((row) => {
    const rec = parseCampusUserRowV0541_(row);
    const status = String(rec.status || 'Active').trim().toLowerCase();
    return rec.email === email && status !== 'inactive' && status !== 'disabled' && status !== 'archived';
  });
}

async function hasAnyActiveCampusUserRows(redis) {
  const rows = await readAllCampusUserRows(redis);
  return rows.some((row) => {
    const rec = parseCampusUserRowV0541_(row);
    const status = String(rec.status || 'Active').trim().toLowerCase();
    return rec.email && status !== 'inactive' && status !== 'disabled' && status !== 'archived';
  });
}

async function readAllCampusUserRows(redis) {
  if (!redis || !redis.keys || !redis.get) return [];
  const keys = await redis.keys('gas:spreadsheet:*:sheet:_CampusUsers:values');
  const out = [];
  for (const key of keys || []) {
    let raw = '';
    try { raw = await redis.get(key); } catch (err) { continue; }
    let values = [];
    try { values = JSON.parse(raw || '[]'); } catch (err) { values = []; }
    if (!Array.isArray(values)) continue;
    for (let i = 1; i < values.length; i++) {
      const row = Array.isArray(values[i]) ? values[i] : [];
      if (String(row[0] || '').trim()) out.push(row);
    }
  }
  return out;
}

async function seedRuntimeBootstrapProperties(redis) {
  // Seed both the Admin legacy script and the Staff Portal legacy script with the
  // same Staff Portal school map and token secret. In Apps Script these lived in
  // separate deployments, which is why the older Redis build could generate a
  // token in Admin that the Staff Portal could not validate.
  try {
    const cfg = await getStaffPortalBootstrapConfig(redis, { allowCreateSecret: true });
    if (redis && redis.hSet) {
      const props = {
        V5_PUBLIC_STAFF_PORTAL_SCHOOLS_JSON: JSON.stringify(cfg.schools || {}),
        V5_STAFF_PORTAL_TOKEN_SECRET_V5312: cfg.tokenSecret || ''
      };
      await redis.hSet('gas:properties:staff:script', props);
      await redis.hSet('gas:properties:admin:script', props);
    }
  } catch (err) {
    console.warn('[staff portal bootstrap]', err && err.message ? err.message : err);
  }
}

async function getStaffPortalBootstrapConfig(redis, options = {}) {
  const explicitSchools = String(process.env.STAFF_PORTAL_SCHOOLS_JSON || '').trim();
  let schools = {};
  if (explicitSchools) {
    try { schools = JSON.parse(explicitSchools); } catch (err) { throw new Error('STAFF_PORTAL_SCHOOLS_JSON is not valid JSON: ' + err.message); }
  } else {
    schools = await inferStaffPortalSchoolsFromRedis(redis);
  }
  const defaultSchoolId = String(process.env.STAFF_PORTAL_DEFAULT_SCHOOL_ID || Object.keys(schools)[0] || '').trim();
  let tokenSecret = String(process.env.STAFF_PORTAL_TOKEN_SECRET || '').trim();
  let tokenSecretSource = tokenSecret ? 'env:STAFF_PORTAL_TOKEN_SECRET' : '';

  // Preferred order: explicit env secret, existing Admin secret, existing Staff
  // Portal secret. Choosing Admin first preserves links that the Admin Portal may
  // already have generated before this unification fix.
  if (!tokenSecret && redis && redis.hGet) {
    const adminSecret = String(await redis.hGet('gas:properties:admin:script', 'V5_STAFF_PORTAL_TOKEN_SECRET_V5312') || '').trim();
    const staffSecret = String(await redis.hGet('gas:properties:staff:script', 'V5_STAFF_PORTAL_TOKEN_SECRET_V5312') || '').trim();
    if (adminSecret) { tokenSecret = adminSecret; tokenSecretSource = 'redis:gas:properties:admin:script'; }
    else if (staffSecret) { tokenSecret = staffSecret; tokenSecretSource = 'redis:gas:properties:staff:script'; }
  }
  if (!tokenSecret && options.allowCreateSecret && redis && redis.hSet) {
    tokenSecret = crypto.randomBytes(24).toString('hex');
    tokenSecretSource = 'generated-and-persisted';
  }
  if (tokenSecret && redis && redis.hSet) {
    await redis.hSet('gas:properties:staff:script', 'V5_STAFF_PORTAL_TOKEN_SECRET_V5312', tokenSecret);
    await redis.hSet('gas:properties:admin:script', 'V5_STAFF_PORTAL_TOKEN_SECRET_V5312', tokenSecret);
  }
  return { schools, defaultSchoolId, tokenSecret, tokenSecretSource };
}

async function inferStaffPortalSchoolsFromRedis(redis) {
  const schools = {};
  const bySpreadsheetId = {};
  const addSchool = (key, record) => {
    key = String(key || '').trim();
    if (!key) return;
    const spreadsheetId = String((record && record.spreadsheetId) || key).trim();
    if (!spreadsheetId) return;
    const name = String((record && record.name) || spreadsheetId || key).trim();
    schools[key] = { id: key, name, spreadsheetId };
    if (!bySpreadsheetId[spreadsheetId]) bySpreadsheetId[spreadsheetId] = schools[key];
  };

  const parseRows = (raw) => {
    try {
      const values = JSON.parse(raw || '[]');
      return Array.isArray(values) ? values : [];
    } catch (err) {
      return [];
    }
  };

  // First read the old multi-campus controller registry. This preserves numeric
  // school short codes such as school=1, which existing Staff Portal links use.
  if (redis && redis.keys && redis.get) {
    const registryKeys = await redis.keys('gas:spreadsheet:*:sheet:_CampusRegistry:values');
    for (const key of registryKeys || []) {
      let rows = [];
      try { rows = parseRows(await redis.get(key)); } catch (err) { rows = []; }
      for (let i = 1; i < rows.length; i++) {
        const row = Array.isArray(rows[i]) ? rows[i] : [];
        const shortCode = String(row[0] || '').trim();
        const schoolName = String(row[1] || '').trim();
        const spreadsheetId = String(row[2] || '').trim();
        const status = String(row[4] || 'Active').trim().toLowerCase();
        if (!shortCode || !spreadsheetId || status === 'inactive' || status === 'disabled') continue;
        addSchool(shortCode, { name: schoolName || shortCode, spreadsheetId });
      }
    }

    // Also include spreadsheet IDs/names as valid keys so direct Redis links and
    // diagnostic routes remain usable.
    const staffKeys = await redis.keys('gas:spreadsheet:*:sheet:Staff:values');
    (staffKeys || []).forEach((key) => {
      const id = String(key).split(':sheet:')[0].replace(/^gas:spreadsheet:/, '');
      if (!id) return;
      if (!bySpreadsheetId[id]) addSchool(id, { name: id, spreadsheetId: id });
    });
  }

  const envActive = String(process.env.GA_ACTIVE_SPREADSHEET_ID || '').trim();
  if (envActive && !bySpreadsheetId[envActive] && !schools[envActive]) addSchool(envActive, { name: envActive, spreadsheetId: envActive });
  addDerivedSchoolAliasesV015_(schools);
  return schools;
}



function compactAliasV015_(value) {
  return String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
}
function acronymV015_(value) {
  const words = String(value || '').replace(/^\s*GA\s+Scheduler\s*-\s*/i, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  return words.map(w => w.charAt(0).toLowerCase()).join('');
}
function addDerivedSchoolAliasesV015_(schools) {
  const additions = {};
  Object.keys(schools || {}).forEach((key) => {
    const rec = schools[key] || {};
    const candidates = [key, rec.id, rec.name, rec.spreadsheetId];
    const afterDash = String(rec.name || rec.spreadsheetId || '').split(/\s+-\s+/).pop();
    candidates.push(afterDash);
    candidates.push(acronymV015_(rec.name));
    candidates.push(acronymV015_(rec.spreadsheetId));
    candidates.push(acronymV015_(afterDash));
    candidates.forEach((c) => {
      const a = compactAliasV015_(c);
      if (a && !schools[a] && !additions[a]) additions[a] = Object.assign({}, rec, { id: a, aliasFor: key });
    });
  });
  Object.assign(schools, additions);
}


function normalizeKeyV05418X(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function boolV05418X(value) { return value === true || /^(true|1|yes|y|on|checked)$/i.test(String(value || '').trim()); }
function safeJsonStringV05418X(value) {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value == null ? {} : value); } catch { return '{}'; }
}
async function readStudentNamesV05418X(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, 'Students');
  return (values || []).slice(1).map(r => Array.isArray(r) ? String(r[0] || '').trim() : '').filter(Boolean);
}
async function readStudentAdvancedRowsV05418X(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StudentAdvancedScheduling');
  if (!values.length) return [];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = Array.isArray(values[i]) ? values[i] : [];
    const student = String(r[0] || '').trim();
    if (!student) continue;
    let twoToOnePeriods = {};
    let splitPeriodSupport = [];
    let twoToOneStaff = {};
    try { twoToOnePeriods = JSON.parse(String(r[5] || '{}')) || {}; } catch {}
    try { splitPeriodSupport = JSON.parse(String(r[6] || '[]')) || []; } catch {}
    try { twoToOneStaff = JSON.parse(String(r[8] || '{}')) || {}; } catch {}
    rows.push({
      rowIndex: i + 1,
      student,
      enableTwoToOne: boolV05418X(r[1]) || Object.keys(twoToOnePeriods || {}).some(k => !!twoToOnePeriods[k]) || Object.keys(twoToOneStaff || {}).some(k => { const v = twoToOneStaff[k] || {}; return !!(v.primary2 || v.secondary2); }),
      noTemporaryGrouping: boolV05418X(r[2]),
      prioritizeSameStaff: boolV05418X(r[3]),
      avoidBackToBackStaffChanges: boolV05418X(r[4]),
      twoToOnePeriods,
      splitPeriodSupport: Array.isArray(splitPeriodSupport) ? splitPeriodSupport : [],
      updated: String(r[7] || ''),
      // FEATURE: explicit per-period second-slot staff picks for 2:1 support, keyed by
      // period item -> { primary2, secondary2 }. See docs/scheduling-logic.md.
      twoToOneStaff: (twoToOneStaff && typeof twoToOneStaff === 'object') ? twoToOneStaff : {}
    });
  }
  return rows;
}
async function writeStudentAdvancedRowsV05418X(redis, spreadsheetId, rows) {
  const values = [[
    'Student','Enable 2:1 Support','Do Not Temporarily Group for Breaks/Lunches',
    'Prioritize Same Staff Across Day','Avoid Back-to-Back Staff Changes',
    '2:1 Periods JSON','Split-Period Support JSON','Updated','2:1 Second Staff JSON'
  ]];
  (rows || []).forEach(rec => {
    const student = String(rec.student || '').trim();
    if (!student) return;
    values.push([
      student,
      rec.enableTwoToOne ? 'Yes' : '',
      rec.noTemporaryGrouping ? 'Yes' : '',
      rec.prioritizeSameStaff ? 'Yes' : '',
      rec.avoidBackToBackStaffChanges ? 'Yes' : '',
      safeJsonStringV05418X(rec.twoToOnePeriods || {}),
      safeJsonStringV05418X(rec.splitPeriodSupport || []),
      rec.updated || new Date().toISOString(),
      safeJsonStringV05418X(rec.twoToOneStaff || {})
    ]);
  });
  await writeRedisSheetValues(redis, spreadsheetId, '_StudentAdvancedScheduling', values);
}
async function saveStudentAdvancedRecordV05418X(redis, spreadsheetId, body) {
  const student = String(body.student || body.studentName || '').trim();
  if (!student) throw new Error('Missing student name.');
  const rows = await readStudentAdvancedRowsV05418X(redis, spreadsheetId);
  const key = normalizeKeyV05418X(student);
  let rec = rows.find(r => normalizeKeyV05418X(r.student) === key);
  if (!rec) { rec = { student, twoToOnePeriods: {}, splitPeriodSupport: [], twoToOneStaff: {} }; rows.push(rec); }
  rec.student = student;
  rec.enableTwoToOne = boolV05418X(body.enableTwoToOne);
  rec.noTemporaryGrouping = boolV05418X(body.noTemporaryGrouping);
  rec.prioritizeSameStaff = boolV05418X(body.prioritizeSameStaff);
  rec.avoidBackToBackStaffChanges = boolV05418X(body.avoidBackToBackStaffChanges);
  if (body.twoToOnePeriods && typeof body.twoToOnePeriods === 'object') {
    const incomingPeriods = body.twoToOnePeriods || {};
    const replaceTwoPeriods = body.__replaceTwoToOnePeriods === true || body.replaceTwoToOnePeriods === true;
    // v0.54.18et: rendered Student Manager rows are authoritative when the client sends
    // an explicit replacement. This permits changing a period back from 2:1 and prevents
    // stale sidecar flags from being sticky forever. Partial/legacy posts still merge.
    rec.twoToOnePeriods = replaceTwoPeriods ? incomingPeriods : Object.assign({}, rec.twoToOnePeriods || {}, incomingPeriods);
  }
  if (Array.isArray(body.splitPeriodSupport)) rec.splitPeriodSupport = body.splitPeriodSupport;
  if (body.twoToOneStaff && typeof body.twoToOneStaff === 'object') {
    const incomingStaff = body.twoToOneStaff || {};
    const hasIncomingStaff = Object.keys(incomingStaff).some(k => { const v = incomingStaff[k] || {}; return !!(String(v.primary2 || '').trim() || String(v.secondary2 || '').trim()); });
    const replaceTwoStaff = body.__replaceTwoToOneStaff === true || body.replaceTwoToOneStaff === true;
    if (replaceTwoStaff) {
      rec.twoToOneStaff = incomingStaff;
    } else if (hasIncomingStaff) {
      rec.twoToOneStaff = Object.assign({}, rec.twoToOneStaff || {}, incomingStaff);
    }
  }
  if (body.enableTwoToOne === false || /^(false|0|no|n|off)$/i.test(String(body.enableTwoToOne || '').trim())) {
    rec.twoToOnePeriods = {};
    rec.twoToOneStaff = {};
  }
  if (Object.keys(rec.twoToOnePeriods || {}).some(k => !!rec.twoToOnePeriods[k]) || Object.keys(rec.twoToOneStaff || {}).some(k => { const v = rec.twoToOneStaff[k] || {}; return !!(v.primary2 || v.secondary2); })) rec.enableTwoToOne = true;
  rec.updated = new Date().toISOString();
  await writeStudentAdvancedRowsV05418X(redis, spreadsheetId, rows);
  return { record: rec, message: 'Advanced scheduling options saved.' };
}
async function readAgencyRowsV05418X(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_AgencyManager');
  if (!values.length) return [];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = Array.isArray(values[i]) ? values[i] : [];
    const agency = String(r[0] || '').trim();
    const student = String(r[1] || '').trim();
    if (!agency && !student) continue;
    rows.push({ rowIndex: i + 1, agency, student, requiresBreakCoverage: boolV05418X(r[2]), requiresLunchCoverage: boolV05418X(r[3]), fade: String(r[4] || '').trim(), notes: String(r[5] || '').trim(), active: !r[6] || boolV05418X(r[6]), emergencyDistrictCoverage: boolV05418X(r[7]) });
  }
  return rows;
}
async function writeAgencyRowsV05418X(redis, spreadsheetId, rows) {
  const values = [['Agency','Student','Requires Break Coverage','Requires Lunch Coverage','Agency fade / district coverage','Notes','Active','Emergency District Coverage']];
  (rows || []).forEach(row => {
    const agency = String(row.agency || '').trim();
    const student = String(row.student || '').trim();
    if (!agency && !student) return;
    values.push([agency, student, boolV05418X(row.requiresBreakCoverage) ? 'Yes' : '', boolV05418X(row.requiresLunchCoverage) ? 'Yes' : '', String(row.fade || '').trim(), String(row.notes || '').trim(), row.active === false ? 'No' : 'Yes', boolV05418X(row.emergencyDistrictCoverage) ? 'Yes' : '']);
  });
  await writeRedisSheetValues(redis, spreadsheetId, '_AgencyManager', values);
}

// V05418Y — mobile app pairing (OTP) and device registry.
//
// BUGFIX (no more "type your school"): this used to store codes in a per-spreadsheet sheet,
// which meant the app had to already know which school to check before it could even look up
// a code — hence the school text field. Codes are now stored in ONE global Redis key
// (gas:global:app-pairing-codes, not tied to any spreadsheetId), so the code itself carries
// its school with it. consumeAppPairingCodeV05418Y now returns {school, spreadsheetId,
// staffName} directly — the app never needs to know or ask for the school at all.
//
// Collision note: a 6-digit code is drawn from a shared global pool now instead of a
// per-school one, so createAppPairingCodeV05418Y checks for a collision against every
// currently-active code (across all schools) and regenerates if it hits one. With a TTL of
// 10 minutes and no realistic volume of simultaneous pairings, this is a rare, cheap check,
// not a real bottleneck.
const APP_PAIRING_CODE_TTL_SECONDS = 600; // 10 minutes
const APP_PAIRING_GLOBAL_KEY = 'gas:global:app-pairing-codes';

function generateAppPairingCodeV05418Y() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function readGlobalAppPairingCodesV05418Y(redis) {
  let raw;
  try { raw = await redis.get(APP_PAIRING_GLOBAL_KEY); } catch (e) { raw = null; }
  if (!raw) return [];
  let rows;
  try { rows = JSON.parse(raw); } catch (e) { return []; }
  if (!Array.isArray(rows)) return [];
  const nowMs = Date.now();
  // Same opportunistic-expiry approach as before, just against one global list now instead
  // of per-school lists — this key should never realistically hold more than a handful of
  // rows at once given the 10-minute TTL.
  return rows.filter((r) => r && r.expiresAt && new Date(r.expiresAt).getTime() >= nowMs);
}

async function writeGlobalAppPairingCodesV05418Y(redis, rows) {
  await redis.set(APP_PAIRING_GLOBAL_KEY, JSON.stringify(rows || []));
}

async function createAppPairingCodeV05418Y(redis, school, spreadsheetId, staffName) {
  const rows = await readGlobalAppPairingCodesV05418Y(redis);
  // One active code per staff member (scoped by school+name together, since the same
  // display name could in principle exist at two different schools) at a time — generating
  // a new one invalidates any previous unused code for that person.
  const staffKey = String(school || '').trim().toLowerCase() + '::' + normalizeKeyV05418X(staffName);
  const kept = rows.filter((r) => (String(r.school || '').trim().toLowerCase() + '::' + normalizeKeyV05418X(r.staffName)) !== staffKey);
  const existingCodes = new Set(kept.map((r) => r.code));
  let code = generateAppPairingCodeV05418Y();
  while (existingCodes.has(code)) code = generateAppPairingCodeV05418Y();
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + APP_PAIRING_CODE_TTL_SECONDS * 1000).toISOString();
  kept.push({ code, school, spreadsheetId, staffName, createdAt: nowIso, expiresAt });
  await writeGlobalAppPairingCodesV05418Y(redis, kept);
  return { code, expiresInSeconds: APP_PAIRING_CODE_TTL_SECONDS, expiresAt };
}

async function consumeAppPairingCodeV05418Y(redis, code) {
  const rows = await readGlobalAppPairingCodesV05418Y(redis);
  const match = rows.find((r) => r.code === String(code || '').trim());
  if (!match) return null;
  // Single-use: remove it immediately regardless of what happens next, so the same code
  // can't be replayed even if the caller retries.
  const remaining = rows.filter((r) => r.code !== match.code);
  await writeGlobalAppPairingCodesV05418Y(redis, remaining);
  return match;
}

async function readAppDevicesV05418Y(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_AppDevices');
  if (!values.length) return [];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = Array.isArray(values[i]) ? values[i] : [];
    const staffName = String(r[0] || '').trim();
    const deviceId = String(r[1] || '').trim();
    if (!staffName || !deviceId) continue;
    let subscription = null;
    try { subscription = r[2] ? JSON.parse(r[2]) : null; } catch (e) { subscription = null; }
    rows.push({ staffName, deviceId, subscription, platform: String(r[3] || '').trim(), pairedAt: String(r[4] || '').trim(), lastSeenAt: String(r[5] || '').trim() });
  }
  return rows;
}

async function writeAppDevicesV05418Y(redis, spreadsheetId, rows) {
  const values = [['Staff', 'Device ID', 'Push Subscription JSON', 'Platform', 'Paired At', 'Last Seen At']];
  (rows || []).forEach((row) => {
    if (!row.staffName || !row.deviceId) return;
    values.push([row.staffName, row.deviceId, safeJsonStringV05418X(row.subscription || null), row.platform || '', row.pairedAt || '', row.lastSeenAt || '']);
  });
  await writeRedisSheetValues(redis, spreadsheetId, '_AppDevices', values);
}

async function registerAppDeviceV05418Y(redis, spreadsheetId, { staffName, subscription, platform, clientDeviceId }) {
  const rows = await readAppDevicesV05418Y(redis, spreadsheetId);
  // Prefer the push subscription endpoint as the device identity when it exists. However,
  // iOS/Safari and pre-install browser launches can validly reach the pairing flow before
  // a PushManager endpoint is available or before notification permission is granted. In
  // that case, still complete the pairing with a locally generated install id so the staff
  // member is not sent back to manual OTP entry. If push is enabled later, a heartbeat can
  // register the endpoint-backed device record as well.
  const endpoint = subscription && subscription.endpoint ? String(subscription.endpoint) : '';
  let deviceId = '';
  if (endpoint) {
    deviceId = crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 24);
  } else {
    const rawClientId = String(clientDeviceId || '').trim();
    if (!rawClientId) throw new Error('Missing device identity.');
    deviceId = 'local-' + crypto.createHash('sha256').update(rawClientId).digest('hex').slice(0, 18);
  }
  const nowIso = new Date().toISOString();
  let rec = rows.find((r) => r.deviceId === deviceId);
  if (!rec) { rec = { staffName, deviceId, pairedAt: nowIso }; rows.push(rec); }
  rec.staffName = staffName;
  rec.subscription = endpoint ? subscription : null;
  rec.platform = platform || rec.platform || '';
  rec.lastSeenAt = nowIso;
  await writeAppDevicesV05418Y(redis, spreadsheetId, rows);
  return rec;
}

// Admin-facing revoke: removes every device registered to a staff member, not just one.
// A lost-phone scenario is the primary case this exists for, and an admin in that situation
// won't necessarily know how many devices that person has paired over time (multiple phones,
// a replaced device whose old registration never got cleaned up, etc.) -- revoking all of
// them is the safe default rather than requiring the admin to track down a specific deviceId.
//
// IMPORTANT: this also records a persistent revocation marker (_AppRevocations), not just
// deleting the device rows. Without that marker, a still-running app holds the same
// staffToken it always did (that token doesn't expire and isn't tied to any one device
// registration), so its next heartbeat (see /api/v05418y/app-devices/heartbeat) would just
// silently re-create the registration and undo the revoke entirely. The marker makes
// "revoked" sticky until the staff member deliberately re-pairs with a brand new OTP code --
// see the /app-pairing/verify handler, which clears this marker on a successful re-pair.
async function revokeAppDevicesV05418Y(redis, spreadsheetId, staffName) {
  const rows = await readAppDevicesV05418Y(redis, spreadsheetId);
  const key = normalizeKeyV05418X(staffName);
  const remaining = rows.filter((r) => normalizeKeyV05418X(r.staffName) !== key);
  const revokedCount = rows.length - remaining.length;
  if (revokedCount > 0) await writeAppDevicesV05418Y(redis, spreadsheetId, remaining);
  await setAppRevocationV05418Y(redis, spreadsheetId, staffName, true);
  return revokedCount;
}

async function readAppRevocationsV05418Y(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_AppRevocations');
  const set = new Set();
  for (let i = 1; i < values.length; i++) {
    const staffName = String((values[i] || [])[0] || '').trim();
    if (staffName) set.add(normalizeKeyV05418X(staffName));
  }
  return set;
}

async function setAppRevocationV05418Y(redis, spreadsheetId, staffName, revoked) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_AppRevocations');
  const key = normalizeKeyV05418X(staffName);
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const name = String((values[i] || [])[0] || '').trim();
    if (name && normalizeKeyV05418X(name) !== key) rows.push([name]);
  }
  if (revoked) rows.push([staffName]);
  await writeRedisSheetValues(redis, spreadsheetId, '_AppRevocations', [['Staff'], ...rows]);
}

// Communication preference: staff-set via the gear/settings popup on their own Staff Portal
// page. 'push'/'both' only make sense once a device is paired, but the value itself is
// stored regardless -- if a device later gets unpaired, sends should fall back to email
// rather than the preference silently vanishing, so the admin still has an accurate read of
// what the person actually asked for even if the app itself isn't currently reachable.
const VALID_COMM_PREFERENCES_V05418BV = ['email', 'push', 'both'];
async function getCommPreferencesV05418BV(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_CommunicationPreferences');
  const map = new Map();
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const name = String(row[0] || '').trim();
    const pref = String(row[1] || '').trim().toLowerCase();
    if (name && VALID_COMM_PREFERENCES_V05418BV.includes(pref)) map.set(normalizeKeyV05418X(name), { staffName: name, preference: pref });
  }
  return map;
}
async function getCommPreferenceV05418BV(redis, spreadsheetId, staffName) {
  const map = await getCommPreferencesV05418BV(redis, spreadsheetId);
  const rec = map.get(normalizeKeyV05418X(staffName));
  return (rec && rec.preference) || 'email';
}
async function setCommPreferenceV05418BV(redis, spreadsheetId, staffName, preference) {
  const pref = String(preference || '').trim().toLowerCase();
  if (!VALID_COMM_PREFERENCES_V05418BV.includes(pref)) throw new Error('Invalid preference.');
  const values = await readRedisSheetValues(redis, spreadsheetId, '_CommunicationPreferences');
  const key = normalizeKeyV05418X(staffName);
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const name = String(row[0] || '').trim();
    if (name && normalizeKeyV05418X(name) !== key) rows.push([name, String(row[1] || '')]);
  }
  rows.push([staffName, pref]);
  await writeRedisSheetValues(redis, spreadsheetId, '_CommunicationPreferences', [['Staff', 'Preference'], ...rows]);
}

// In-app inbox: retains push notifications (and any announcement, regardless of channel)
// within the app UI itself, since a push notification the OS dismisses or the person swipes
// away without reading is otherwise gone for good. Capped per staff member so this can't
// grow unbounded for someone who never opens the app to clear it.
const INBOX_MAX_PER_STAFF_V05418BV = 30;
async function readInboxMessagesV05418BV(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_AppInboxMessages');
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    if (!row[0]) continue;
    rows.push({ id: String(row[0] || ''), staffName: String(row[1] || ''), subject: String(row[2] || ''), message: String(row[3] || ''), sentAt: String(row[4] || ''), dismissed: String(row[5] || '').toLowerCase() === 'true' });
  }
  return rows;
}
async function writeInboxMessagesV05418BV(redis, spreadsheetId, rows) {
  const values = [['ID', 'Staff', 'Subject', 'Message', 'Sent At', 'Dismissed']];
  rows.forEach((r) => values.push([r.id, r.staffName, r.subject, r.message, r.sentAt, r.dismissed ? 'true' : 'false']));
  await writeRedisSheetValues(redis, spreadsheetId, '_AppInboxMessages', values);
}
async function addInboxMessagesV05418BV(redis, spreadsheetId, staffNames, subject, message) {
  const rows = await readInboxMessagesV05418BV(redis, spreadsheetId);
  const nowIso = new Date().toISOString();
  staffNames.forEach((staffName) => {
    rows.push({ id: crypto.randomUUID(), staffName, subject, message, sentAt: nowIso, dismissed: false });
  });
  // Cap per staff member (keep newest), not globally -- one very active recipient shouldn't
  // crowd out another's older-but-still-undismissed messages.
  const byStaff = new Map();
  rows.forEach((r) => { const k = normalizeKeyV05418X(r.staffName); if (!byStaff.has(k)) byStaff.set(k, []); byStaff.get(k).push(r); });
  const capped = [];
  byStaff.forEach((list) => { list.sort((a, b) => a.sentAt.localeCompare(b.sentAt)); capped.push(...list.slice(-INBOX_MAX_PER_STAFF_V05418BV)); });
  await writeInboxMessagesV05418BV(redis, spreadsheetId, capped);
}

// Saveable announcement templates -- reused by both Communication Manager's Announcement
// modal (desktop) and the admin app's Communicate screen, so a template saved in either
// place is available in both.
const TEMPLATES_MAX_V05418CB = 40;
async function readAnnouncementTemplatesV05418CB(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_AnnouncementTemplates');
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    if (!row[0]) continue;
    rows.push({ id: String(row[0] || ''), name: String(row[1] || ''), subject: String(row[2] || ''), message: String(row[3] || ''), createdAt: String(row[4] || '') });
  }
  return rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}
async function writeAnnouncementTemplatesV05418CB(redis, spreadsheetId, rows) {
  const values = [['ID', 'Name', 'Subject', 'Message', 'Created At']];
  rows.slice(0, TEMPLATES_MAX_V05418CB).forEach((r) => values.push([r.id, r.name, r.subject, r.message, r.createdAt]));
  await writeRedisSheetValues(redis, spreadsheetId, '_AnnouncementTemplates', values);
}
async function saveAnnouncementTemplateV05418CB(redis, spreadsheetId, { id, name, subject, message }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Enter a name for this template.');
  const rows = await readAnnouncementTemplatesV05418CB(redis, spreadsheetId);
  const existingId = String(id || '').trim();
  const filtered = rows.filter((r) => r.id !== existingId && r.name.toLowerCase() !== cleanName.toLowerCase());
  const saved = { id: existingId || crypto.randomUUID(), name: cleanName, subject: String(subject || '').trim(), message: String(message || '').trim(), createdAt: new Date().toISOString() };
  filtered.push(saved);
  await writeAnnouncementTemplatesV05418CB(redis, spreadsheetId, filtered);
  return saved;
}
async function deleteAnnouncementTemplateV05418CB(redis, spreadsheetId, id) {
  const rows = await readAnnouncementTemplatesV05418CB(redis, spreadsheetId);
  const filtered = rows.filter((r) => r.id !== String(id || '').trim());
  await writeAnnouncementTemplatesV05418CB(redis, spreadsheetId, filtered);
}

// Push sending is intentionally isolated behind this one function and a guarded require,
// matching how src/redisClient.js guards `require('redis')` — the app must keep working
// (Agency Manager, 2:1, everything else) even before `npm install` has pulled in web-push
// or before VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are configured. See docs/PUSH_NOTIFICATIONS.md.
let webPushLib = null;
try { webPushLib = require('web-push'); } catch (err) { webPushLib = null; }
let webPushConfigured = false;
function ensureWebPushConfiguredV05418Y() {
  if (webPushConfigured) return true;
  if (!webPushLib) return false;
  const pub = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const priv = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = String(process.env.VAPID_SUBJECT || 'mailto:support@supportschedules.com').trim();
  if (!pub || !priv) return false;
  webPushLib.setVapidDetails(subject, pub, priv);
  webPushConfigured = true;
  return true;
}

async function sendPushToStaffV05418Y(redis, spreadsheetId, staffNames, { title, body }) {
  const devices = await readAppDevicesV05418Y(redis, spreadsheetId);
  const targetKeys = new Set((staffNames || []).map(normalizeKeyV05418X));
  const targets = devices.filter((d) => targetKeys.has(normalizeKeyV05418X(d.staffName)));
  const results = (staffNames || []).map((name) => ({ staffName: name, status: 'no-device' }));
  if (!ensureWebPushConfiguredV05418Y()) {
    return { ok: false, configured: false, message: 'Push is not configured yet. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (see docs/PUSH_NOTIFICATIONS.md) and install the web-push package.', results };
  }
  const payload = JSON.stringify({ title: title || 'Support Schedules', body: body || '' });
  for (const device of targets) {
    const idx = results.findIndex((r) => normalizeKeyV05418X(r.staffName) === normalizeKeyV05418X(device.staffName) && r.status === 'no-device');
    try {
      await webPushLib.sendNotification(device.subscription, payload);
      if (idx >= 0) results[idx] = { staffName: device.staffName, status: 'sent' };
    } catch (err) {
      const code = err && err.statusCode;
      if (idx >= 0) results[idx] = { staffName: device.staffName, status: 'failed', error: err && err.message, statusCode: code };
      // 404/410 from a push service means that specific subscription is permanently gone
      // (uninstalled, or the iOS "unexpected unsubscribe" behavior discussed earlier) —
      // clean it up now rather than let it fail silently on every future send.
      if (code === 404 || code === 410) {
        const remaining = devices.filter((d) => d.deviceId !== device.deviceId);
        await writeAppDevicesV05418Y(redis, spreadsheetId, remaining);
      }
    }
  }
  return { ok: true, configured: true, results };
}

async function listRedisSheets(redis, spreadsheetId) {
  if (!redis || !redis.keys) return [];
  const keys = await redis.keys(`gas:spreadsheet:${spreadsheetId}:sheet:*:values`);
  return (keys || []).map(k => String(k).split(':sheet:')[1].replace(/:values$/, '')).filter(Boolean).sort();
}

async function writeRedisSheetValues(redis, spreadsheetId, sheetName, values) {
  if (!redis || !redis.set) throw new Error('Redis is not available.');
  await redis.set(`gas:spreadsheet:${spreadsheetId}:sheet:${sheetName}:values`, JSON.stringify(values || []));
}

function staffEmailLockKeyV025(staffName, rowIndex) {
  const staffKey = String(staffName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return staffKey || (rowIndex ? ('row:' + rowIndex) : '');
}
function truthyV025(value) {
  return value === true || /^true|1|yes|on|locked$/i.test(String(value || '').trim());
}
async function readStaffEmailLockV025(redis, spreadsheetId, staffName, rowIndex) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffEmailLocks');
  if (!values.length) return false;
  const wantedKey = staffEmailLockKeyV025(staffName, rowIndex);
  const wantedRow = Number(rowIndex || 0) || 0;
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const key = staffEmailLockKeyV025(row[1] || row[0] || '', row[2]);
    const rowNum = Number(row[2] || 0) || 0;
    if ((wantedKey && key === wantedKey) || (wantedRow && rowNum === wantedRow)) return truthyV025(row[3]);
  }
  return false;
}
async function writeStaffEmailLockV025(redis, spreadsheetId, staffName, rowIndex, locked) {
  const sheet = '_StaffEmailLocks';
  let values = await readRedisSheetValues(redis, spreadsheetId, sheet);
  if (!values.length) values = [['StaffKey','Staff','RowIndex','Locked','UpdatedAt']];
  if (!Array.isArray(values[0])) values[0] = ['StaffKey','Staff','RowIndex','Locked','UpdatedAt'];
  while (values[0].length < 5) values[0].push('');
  values[0][0] = 'StaffKey'; values[0][1] = 'Staff'; values[0][2] = 'RowIndex'; values[0][3] = 'Locked'; values[0][4] = 'UpdatedAt';
  const targetKey = staffEmailLockKeyV025(staffName, rowIndex);
  const targetRow = Number(rowIndex || 0) || 0;
  let found = -1;
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const key = staffEmailLockKeyV025(row[1] || row[0] || '', row[2]);
    const rowNum = Number(row[2] || 0) || 0;
    if ((targetKey && key === targetKey) || (targetRow && rowNum === targetRow)) { found = i; break; }
  }
  const next = [targetKey, String(staffName || '').trim(), targetRow || '', locked ? 'TRUE' : 'FALSE', new Date().toISOString()];
  if (found >= 1) values[found] = next; else values.push(next);
  await writeRedisSheetValues(redis, spreadsheetId, sheet, values);
  return locked;
}
function sanitizeSelectedSchoolV025(selected) {
  if (!selected || typeof selected !== 'object') return null;
  const out = {};
  const school = String(selected.school || selected.schoolId || selected.selectedCampusId || selected.campusId || selected.id || '').trim();
  const spreadsheetId = String(selected.spreadsheetId || selected.selectedSpreadsheetId || selected.ssId || '').trim();
  const name = String(selected.name || selected.schoolName || selected.selectedCampusName || selected.campusName || '').trim();
  if (school) { out.school = school; out.schoolId = school; out.selectedCampusId = school; out.campusId = school; }
  if (spreadsheetId) { out.spreadsheetId = spreadsheetId; out.selectedSpreadsheetId = spreadsheetId; }
  if (name) { out.name = name; out.schoolName = name; out.selectedCampusName = name; }
  return (out.school || out.spreadsheetId) ? out : null;
}
function mergeSelectedSchoolPayloadV025(payload, selected) {
  const school = sanitizeSelectedSchoolV025(selected);
  if (!school || !payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const merged = Object.assign({}, payload);

  // v0.54.18du: the tab-selected school is authoritative, but it must never be
  // merged into record identity fields such as `name` or `id`. Student, staff,
  // schedule, bell-period, agency, and other manager save payloads all commonly
  // use top-level `name` / `id` for the record being edited. v0.54.18dl overwrote
  // those fields with the school name/id while hardening school routing, which
  // made saves rename records to the selected school. Keep selected-school data
  // in `_selectedSchool` and school-specific fields only.
  const schoolId = school.school || school.schoolId || school.selectedCampusId || school.campusId || '';
  const sheetId = school.spreadsheetId || school.selectedSpreadsheetId || '';
  const schoolName = school.name || school.schoolName || school.selectedCampusName || school.campusName || '';

  merged._selectedSchool = Object.assign({}, school);
  if (schoolId) {
    merged.school = schoolId;
    merged.schoolId = schoolId;
    merged.selectedCampusId = schoolId;
    merged.campusId = schoolId;
    // Do not set merged.id here; record save payloads may use id as their own key.
  }
  if (sheetId) {
    merged.spreadsheetId = sheetId;
    merged.selectedSpreadsheetId = sheetId;
    merged.ssId = sheetId;
  }
  if (schoolName) {
    // Do not set merged.name here; record save payloads use top-level name.
    merged.schoolName = schoolName;
    merged.selectedCampusName = schoolName;
    merged.campusName = schoolName;
  }
  return merged;
}
function injectSelectedSchoolArgsV025(script, functionName, rawArgs, selected) {
  const args = Array.isArray(rawArgs) ? rawArgs.slice() : [];
  if (String(script || 'admin') !== 'admin') return args;
  const school = sanitizeSelectedSchoolV025(selected);
  if (!school) return args;
  const fn = String(functionName || '');
  const noArgSchoolActions = /^(runAllV5|runAllV5WithProgressV686m20|runAssignmentsAndDashboardV5|runBreaksOnlyV5|refreshHomeDashboardV5|setupV5Sheets|emailDailyScheduleV5|updateFolderDatesV5)$/;
  if (noArgSchoolActions.test(fn) && args.length === 0) return [school];
  if (args.length && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    args[0] = mergeSelectedSchoolPayloadV025(args[0], school);
  }
  return args;
}

async function refreshStudentDataMetricsV025(redis, spreadsheetId, accessToken, userEmail) {
  const values = await readRedisSheetValues(redis, spreadsheetId, 'Students');
  if (!values.length) return { ok: true, message: 'No student rows to update.', rows: 0 };
  const headers = Array.isArray(values[0]) ? values[0] : [];
  const linkCol = findHeaderIndex_(headers, ['data files', 'data file', 'data files url', 'data file url'], 36);
  const pointsCol = findHeaderIndex_(headers, ['data points', 'data point count'], 37);
  const dateCol = findHeaderIndex_(headers, ['data files last updated', 'data file last updated', 'last updated'], 38);
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId);
  const schoolYearStart = parseSchoolYearStartDateV025(props.V5_SCHOOL_YEAR_START_DATE || '');
  const staffNames = await listStaffNamesForDataMetricsV025(redis, spreadsheetId);
  const stats = {};
  staffNames.forEach(n => { stats[normalizeStaffNameV018(n)] = { name: n, count: 0, lastSubmitted: '', lastSubmittedMs: 0 }; });
  let updated = 0, errors = 0, formCount = 0;
  while (headers.length <= Math.max(linkCol, pointsCol, dateCol)) headers.push('');
  headers[linkCol] = headers[linkCol] || 'Data Files';
  headers[pointsCol] = headers[pointsCol] || 'Data Points';
  headers[dateCol] = headers[dateCol] || 'Data Files Last Updated';
  for (let r = 1; r < values.length; r++) {
    const row = Array.isArray(values[r]) ? values[r] : [];
    while (row.length <= Math.max(linkCol, pointsCol, dateCol)) row.push('');
    const url = String(row[linkCol] || '').trim();
    if (!url) { row[pointsCol] = ''; row[dateCol] = ''; values[r] = row; continue; }
    if (!/docs\.google\.com\/forms/i.test(url)) { values[r] = row; continue; }
    formCount++;
    try {
      const formId = extractGoogleFormIdV025(url);
      if (!formId) throw new Error('Could not read Google Form ID from URL.');
      const responses = await fetchGoogleFormResponsesV025(formId, accessToken);
      let count = 0, latest = null;
      for (const resp of responses) {
        const ts = parseGoogleFormResponseTimeV025(resp);
        if (!ts || (schoolYearStart && ts < schoolYearStart)) continue;
        count++;
        if (!latest || ts > latest) latest = ts;
        const matched = inferStaffFromGoogleFormResponseV025(resp, staffNames);
        if (matched) {
          const key = normalizeStaffNameV018(matched);
          if (!stats[key]) stats[key] = { name: matched, count: 0, lastSubmitted: '', lastSubmittedMs: 0 };
          stats[key].count++;
          if (ts.getTime() > (stats[key].lastSubmittedMs || 0)) {
            stats[key].lastSubmittedMs = ts.getTime();
            stats[key].lastSubmitted = formatDateForDataMetricV025(ts);
          }
        }
      }
      row[pointsCol] = String(count);
      row[dateCol] = latest ? formatDateForDataMetricV025(latest) : '';
      updated++;
    } catch (err) {
      errors++;
      const priorPoints = String(row[pointsCol] || '').trim();
      const priorDate = String(row[dateCol] || '').trim();
      // Preserve the last successful metrics snapshot. Only mark Form Access Error
      // when there was no prior successful value to hold.
      if (!priorPoints && (!priorDate || /Form Access Error/i.test(priorDate))) {
        row[pointsCol] = '';
        row[dateCol] = 'Form Access Error';
      }
    }
    values[r] = row;
  }
  await writeRedisSheetValues(redis, spreadsheetId, 'Students', values);
  const compact = {};
  Object.keys(stats).forEach(k => { compact[k] = { name: stats[k].name, count: stats[k].count, lastSubmitted: stats[k].lastSubmitted || '' }; });
  const stamp = formatDateForDataMetricV025(new Date());
  props.V5_FOLDER_DATES_LAST_REFRESH = stamp;
  props.V5_STAFF_DATA_STATS_V5288 = JSON.stringify(compact);
  props.V5_GOOGLE_FORMS_REFRESHED_BY_V025 = String(userEmail || '');
  await writeCampusScopedPropertiesToRedis(redis, spreadsheetId, props);
  return { ok: true, version: VERSION, message: errors ? `Student data points updated with ${errors} form access error(s).` : 'Student data points updated.', lastRefresh: stamp, formsChecked: formCount, updated, errors, auth: 'google-user-token' };
}
function extractGoogleFormIdV025(url) {
  const s = String(url || '');
  const m = s.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

function extractGoogleFormIdV026(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  const pathMatch = s.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];
  const paramMatch = s.match(/[?&](?:id|formId)=([a-zA-Z0-9_-]+)/);
  if (paramMatch) return paramMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return extractGoogleFormIdV025(s);
}

function escapeDriveQueryValueV026(value) {
  return String(value || '').trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function googleFormEditUrlV026(id) {
  return `https://docs.google.com/forms/d/${encodeURIComponent(id)}/edit`;
}

function formatGoogleModifiedV026(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' });
}

async function fetchGoogleJsonV026(url, accessToken, label) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (json && json.error && (json.error.message || json.error.status)) || ('Google API error ' + res.status);
    throw new Error((label || 'Google API request') + ' failed: ' + detail);
  }
  return json;
}

function driveFileToFormRowV026(file, formTitle) {
  const id = String((file && file.id) || '').trim();
  const name = String((file && file.name) || formTitle || id || 'Untitled Google Form').trim();
  return {
    id,
    name: formTitle || name,
    driveName: name,
    formTitle: formTitle || '',
    url: (file && file.webViewLink) || googleFormEditUrlV026(id),
    editUrl: googleFormEditUrlV026(id),
    updated: formatGoogleModifiedV026(file && file.modifiedTime),
    modifiedTime: (file && file.modifiedTime) || '',
    source: 'Google Drive',
    owner: ((file && file.owners && file.owners[0] && (file.owners[0].emailAddress || file.owners[0].displayName)) || '')
  };
}

async function searchAccessibleGoogleFormsV026(accessToken, query, limit) {
  const base = "mimeType = 'application/vnd.google-apps.form' and trashed = false";
  const q = escapeDriveQueryValueV026(query);
  const driveQueries = q ? [`${base} and name contains '${q}'`, `${base} and fullText contains '${q}'`] : [base];
  const seen = new Set();
  const rows = [];
  for (const driveQ of driveQueries) {
    let pageToken = '';
    for (let guard = 0; guard < 5 && rows.length < limit; guard++) {
      const params = new URLSearchParams({
        q: driveQ,
        pageSize: String(Math.min(100, Math.max(limit, 25))),
        fields: 'nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,owners(displayName,emailAddress),driveId)',
        orderBy: 'modifiedTime desc',
        includeItemsFromAllDrives: 'true',
        supportsAllDrives: 'true'
      });
      if (pageToken) params.set('pageToken', pageToken);
      const json = await fetchGoogleJsonV026(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, accessToken, 'Google Drive Forms search');
      for (const file of json.files || []) {
        if (!file || !file.id || seen.has(file.id)) continue;
        seen.add(file.id);
        rows.push(driveFileToFormRowV026(file, ''));
        if (rows.length >= limit) break;
      }
      pageToken = json.nextPageToken || '';
      if (!pageToken) break;
    }
  }
  return rows.slice(0, limit);
}

async function validateAccessibleGoogleFormV026(accessToken, formId) {
  const id = String(formId || '').trim();
  if (!id) throw new Error('Missing Google Form file ID.');
  const driveParams = new URLSearchParams({
    fields: 'id,name,mimeType,webViewLink,modifiedTime,owners(displayName,emailAddress),driveId',
    supportsAllDrives: 'true'
  });
  const file = await fetchGoogleJsonV026(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?${driveParams.toString()}`, accessToken, 'Google Drive Form validation');
  if (file.mimeType && file.mimeType !== 'application/vnd.google-apps.form') throw new Error('The selected file is not a Google Form.');
  let formTitle = '';
  try {
    const form = await fetchGoogleJsonV026(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(id)}`, accessToken, 'Google Forms validation');
    formTitle = String((form && form.info && form.info.title) || '').trim();
  } catch (err) {
    // Drive metadata is enough to select the form. Response/data-point refresh will report a
    // specific Forms API permission error later if the account cannot read responses.
  }
  return driveFileToFormRowV026(file, formTitle);
}

function googleFormViewUrlV037(id) {
  const cleanId = String(id || '').trim();
  return cleanId ? `https://docs.google.com/forms/d/${encodeURIComponent(cleanId)}/viewform` : '';
}
function googleFormEditUrlForDataRefreshV0541(id) {
  const cleanId = String(id || '').trim();
  return cleanId ? `https://docs.google.com/forms/d/${encodeURIComponent(cleanId)}/edit` : '';
}
function normalizeGoogleFormResponderUrlV037(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const id = extractGoogleFormIdV026(raw);
  // Store the canonical Drive/Form file ID URL, not the public /d/e responder URL,
  // so the response-count refresh can call the Google Forms API reliably.
  if (id) return googleFormEditUrlForDataRefreshV0541(id);
  return raw;
}
async function updateStudentDataFileUrlRedisV037(redis, spreadsheetId, rowIndex, url) {
  rowIndex = Number(rowIndex || 0);
  if (!rowIndex || rowIndex < 2) throw new Error('Student row not found.');
  let values = await readRedisSheetValues(redis, spreadsheetId, 'Students');
  if (!values.length) throw new Error('Students sheet not found.');
  const headers = Array.isArray(values[0]) ? values[0] : [];
  let col = findHeaderIndex_(headers, ['Data Files URL','Data Files','Data File URL','Data Files Link'], 36);
  if (col < 0) col = 36;
  const pointsCol = findHeaderIndex_(headers, ['Data Points','Data Point Count'], 37);
  const updatedCol = findHeaderIndex_(headers, ['Data Files Last Updated','Data File Last Updated','Last Updated'], 38);
  const maxCol = Math.max(col, pointsCol, updatedCol);
  while (values.length < rowIndex) values.push([]);
  while (values[0].length <= maxCol) values[0].push('');
  if (!String(values[0][col] || '').trim()) values[0][col] = 'Data Files URL';
  if (pointsCol >= 0 && !String(values[0][pointsCol] || '').trim()) values[0][pointsCol] = 'Data Points';
  if (updatedCol >= 0 && !String(values[0][updatedCol] || '').trim()) values[0][updatedCol] = 'Data Files Last Updated';
  const idx = rowIndex - 1;
  const row = Array.isArray(values[idx]) ? values[idx] : [];
  while (row.length <= maxCol) row.push('');
  const normalizedUrl = normalizeGoogleFormResponderUrlV037(url);
  row[col] = normalizedUrl;
  if (!normalizedUrl) {
    if (pointsCol >= 0) row[pointsCol] = '';
    if (updatedCol >= 0) row[updatedCol] = '';
  }
  values[idx] = row;
  await writeRedisSheetValues(redis, spreadsheetId, 'Students', values);
  return {
    rowIndex,
    col: col + 1,
    url: row[col],
    dataPoints: pointsCol >= 0 ? String(row[pointsCol] || '') : '',
    dataFilesLastUpdated: updatedCol >= 0 ? String(row[updatedCol] || '') : '',
    message: row[col] ? 'Google Form link saved.' : 'Data link cleared.'
  };
}


async function updateStudentDataFileUrlsBulkRedisV05418F(redis, spreadsheetId, rowsIn) {
  const rowsInput = (Array.isArray(rowsIn) ? rowsIn : [])
    .map(r => ({ rowIndex: Number((r && (r.rowIndex || r.row || r.index)) || 0), url: String((r && r.url) || '').trim() }))
    .filter(r => r.rowIndex >= 2);
  if (!rowsInput.length) return { rows: [], saved: 0, cleared: 0, message: 'No data links to save.' };
  let values = await readRedisSheetValues(redis, spreadsheetId, 'Students');
  if (!values.length) throw new Error('Students sheet not found.');
  const headers = Array.isArray(values[0]) ? values[0] : [];
  let col = findHeaderIndex_(headers, ['Data Files URL','Data Files','Data File URL','Data Files Link'], 36);
  if (col < 0) col = 36;
  let pointsCol = findHeaderIndex_(headers, ['Data Points','Data Point Count'], 37);
  let updatedCol = findHeaderIndex_(headers, ['Data Files Last Updated','Data File Last Updated','Last Updated'], 38);
  if (pointsCol < 0) pointsCol = 37;
  if (updatedCol < 0) updatedCol = 38;
  const maxCol = Math.max(col, pointsCol, updatedCol);
  while (values[0].length <= maxCol) values[0].push('');
  if (!String(values[0][col] || '').trim()) values[0][col] = 'Data Files URL';
  if (!String(values[0][pointsCol] || '').trim()) values[0][pointsCol] = 'Data Points';
  if (!String(values[0][updatedCol] || '').trim()) values[0][updatedCol] = 'Data Files Last Updated';
  const byRow = new Map();
  rowsInput.forEach(r => byRow.set(r.rowIndex, r.url));
  const outRows = [];
  for (const [rowIndex, rawUrl] of byRow.entries()) {
    while (values.length < rowIndex) values.push([]);
    const idx = rowIndex - 1;
    const row = Array.isArray(values[idx]) ? values[idx] : [];
    while (row.length <= maxCol) row.push('');
    const normalizedUrl = normalizeGoogleFormResponderUrlV037(rawUrl);
    row[col] = normalizedUrl;
    if (!normalizedUrl) {
      row[pointsCol] = '';
      row[updatedCol] = '';
    }
    values[idx] = row;
    outRows.push({ rowIndex, url: row[col] || '', dataPoints: String(row[pointsCol] || ''), dataFilesLastUpdated: String(row[updatedCol] || '') });
  }
  await writeRedisSheetValues(redis, spreadsheetId, 'Students', values);
  const saved = outRows.filter(r => r.url).length;
  const cleared = outRows.length - saved;
  return { rows: outRows, saved, cleared, message: 'Saved ' + saved + ' data link(s)' + (cleared ? ', cleared ' + cleared + '.' : '.') };
}

async function fetchGoogleFormResponsesV025(formId, accessToken) {
  const out = [];
  let pageToken = '';
  for (let guard = 0; guard < 100; guard++) {
    const qs = new URLSearchParams({ pageSize: '500' });
    if (pageToken) qs.set('pageToken', pageToken);
    const url = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}/responses?${qs.toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json && json.error && json.error.message) || ('Google Forms API error ' + res.status));
    (json.responses || []).forEach(r => out.push(r));
    pageToken = json.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}
function parseGoogleFormResponseTimeV025(resp) {
  const raw = (resp && (resp.lastSubmittedTime || resp.createTime)) || '';
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}
function parseSchoolYearStartDateV025(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0) : new Date(s);
  return d && !Number.isNaN(d.getTime()) ? d : null;
}
function formatDateForDataMetricV025(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(d);
    const get = (type) => (parts.find(p => p.type === type) || {}).value || '';
    return `${get('month')}/${get('day')}/${get('year')} @ ${String(get('hour') || '').padStart(2, '0')}:${get('minute')} ${get('dayPeriod')}`.trim();
  } catch (err) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    let h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const hh = String(h).padStart(2, '0');
    return `${mm}/${dd}/${yyyy} @ ${hh}:${min} ${ap}`;
  }
}
async function listStaffNamesForDataMetricsV025(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, 'Staff');
  if (!values.length) return [];
  const headers = Array.isArray(values[0]) ? values[0] : [];
  const colName = findHeaderIndex_(headers, ['name', 'staff', 'staff name', 'staff member', 'employee name'], 0);
  const colStatus = findHeaderIndex_(headers, ['status', 'staff status', 'active'], 8);
  const names = [];
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const name = String(row[colName] || '').trim();
    if (!name || /^vacancy/i.test(name)) continue;
    if (!staffStatusIsActive_(String(row[colStatus] || ''))) continue;
    names.push(name);
  }
  return names;
}
function inferStaffFromGoogleFormResponseV025(resp, staffNames) {
  const names = staffNames || [];
  const values = [];
  const answers = (resp && resp.answers) || {};
  Object.keys(answers).forEach(k => {
    const a = answers[k] || {};
    const text = a.textAnswers && Array.isArray(a.textAnswers.answers) ? a.textAnswers.answers.map(x => x && x.value || '').join(' ') : '';
    if (text) values.push(text);
  });
  const blob = normalizeStaffNameV018(values.join(' | '));
  for (const name of names) {
    const key = normalizeStaffNameV018(name);
    if (key && blob === key) return name;
  }
  for (const name of names) {
    const key = normalizeStaffNameV018(name);
    if (key && key.length >= 4 && blob.includes(key)) return name;
  }
  return '';
}


function responseTextAnswersV0544(resp) {
  const out = [];
  const answers = (resp && resp.answers) || {};
  Object.keys(answers).forEach(k => {
    const a = answers[k] || {};
    if (a.textAnswers && Array.isArray(a.textAnswers.answers)) {
      a.textAnswers.answers.forEach(x => { const v = String((x && x.value) || '').trim(); if (v) out.push(v); });
    }
  });
  return out;
}

function inferStaffFromGoogleFormResponseDetailedV0544(resp, staffNames) {
  const names = staffNames || [];
  const values = responseTextAnswersV0544(resp);
  const blob = normalizeStaffNameV018(values.join(' | '));
  let matched = '';
  for (const name of names) {
    const key = normalizeStaffNameV018(name);
    if (key && blob === key) { matched = name; break; }
  }
  if (!matched) {
    for (const name of names) {
      const key = normalizeStaffNameV018(name);
      if (key && key.length >= 4 && blob.includes(key)) { matched = name; break; }
    }
  }
  let submitted = '';
  if (matched) {
    const mk = normalizeStaffNameV018(matched);
    submitted = values.find(v => normalizeStaffNameV018(v) === mk) || values.find(v => normalizeStaffNameV018(v).includes(mk) || mk.includes(normalizeStaffNameV018(v))) || matched;
  }
  return { matchedStaff: matched || '', submittedStaffName: submitted || '' };
}

async function readStudentDataRowsForMetricsV0544(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, 'Students');
  if (!values.length) return { headers: [], rows: [] };
  const headers = Array.isArray(values[0]) ? values[0] : [];
  const nameCol = findHeaderIndex_(headers, ['name', 'student', 'student name'], 0);
  const linkCol = findHeaderIndex_(headers, ['data files', 'data file', 'data files url', 'data file url', 'data files link'], 36);
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const name = String(row[nameCol] || '').trim();
    const url = String(row[linkCol] || '').trim();
    if (!name) continue;
    rows.push({ rowIndex: i + 1, name, url });
  }
  return { headers, rows };
}

function chooseStudentDataRowV0544(rows, payload) {
  const wantedRow = Number(payload && payload.rowIndex || 0) || 0;
  const wantedName = normalizeStaffNameV018(payload && (payload.studentName || payload.name) || '');
  return (rows || []).find(r => (wantedRow && Number(r.rowIndex) === wantedRow) || (wantedName && normalizeStaffNameV018(r.name) === wantedName)) || null;
}

async function getStudentDataPointDetailsRedisV0544(redis, spreadsheetId, accessToken, payload) {
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId);
  const schoolYearStart = parseSchoolYearStartDateV025(props.V5_SCHOOL_YEAR_START_DATE || '');
  const sy = props.V5_SCHOOL_YEAR_START_DATE || '';
  const staffNames = await listStaffNamesForDataMetricsV025(redis, spreadsheetId);
  const data = await readStudentDataRowsForMetricsV0544(redis, spreadsheetId);
  const student = chooseStudentDataRowV0544(data.rows, payload || {});
  if (!student) return { studentName: String(payload && payload.studentName || ''), rows: [], schoolYearStartDate: sy, message: 'Student row was not found.' };
  if (!student.url || !/docs\.google\.com\/forms/i.test(student.url)) return { studentName: student.name, rows: [], schoolYearStartDate: sy, message: 'No Google Form data file was found for this student.' };
  const formId = extractGoogleFormIdV026(student.url);
  if (!formId) return { studentName: student.name, rows: [], schoolYearStartDate: sy, message: 'Could not read Google Form ID from the saved URL.' };
  const responses = await fetchGoogleFormResponsesV025(formId, accessToken);
  const rows = [];
  responses.forEach(resp => {
    const ts = parseGoogleFormResponseTimeV025(resp);
    if (!ts || (schoolYearStart && ts < schoolYearStart)) return;
    const who = inferStaffFromGoogleFormResponseDetailedV0544(resp, staffNames);
    rows.push({ date: ts.toISOString(), displayDate: formatDateForDataMetricV025(ts), sortMs: ts.getTime(), submittedStaffName: who.submittedStaffName || '', matchedStaff: who.matchedStaff || 'Unknown', matchConfidence: who.matchedStaff ? 'matched' : 'unknown' });
  });
  rows.sort((a, b) => Number(b.sortMs || 0) - Number(a.sortMs || 0));
  return { studentName: student.name, rows, schoolYearStartDate: sy, schoolYearStartDateDisplay: sy ? formatDateForDataMetricV025(parseSchoolYearStartDateV025(sy)) : '', source: 'google-forms-api' };
}

async function getStaffDataContributionDetailsRedisV0544(redis, spreadsheetId, accessToken, payload) {
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId);
  const schoolYearStart = parseSchoolYearStartDateV025(props.V5_SCHOOL_YEAR_START_DATE || '');
  const sy = props.V5_SCHOOL_YEAR_START_DATE || '';
  let staffName = String(payload && payload.staffName || '').trim();
  if (!staffName && payload && payload.rowIndex) {
    const staffValues = await readRedisSheetValues(redis, spreadsheetId, 'Staff');
    const headers = Array.isArray(staffValues[0]) ? staffValues[0] : [];
    const nameCol = findHeaderIndex_(headers, ['name', 'staff', 'staff name'], 0);
    const row = staffValues[Number(payload.rowIndex) - 1] || [];
    staffName = String(row[nameCol] || '').trim();
  }
  if (!staffName) return { staffName: '', rows: [], schoolYearStartDate: sy, message: 'Staff member was not found.' };
  const targetKey = normalizeStaffNameV018(staffName);
  const staffNames = await listStaffNamesForDataMetricsV025(redis, spreadsheetId);
  const data = await readStudentDataRowsForMetricsV0544(redis, spreadsheetId);
  const rows = [];
  const errors = [];
  for (const student of data.rows) {
    if (!student.url || !/docs\.google\.com\/forms/i.test(student.url)) continue;
    const formId = extractGoogleFormIdV026(student.url);
    if (!formId) { errors.push({ studentName: student.name, error: 'Could not read Google Form ID from URL.' }); continue; }
    try {
      const responses = await fetchGoogleFormResponsesV025(formId, accessToken);
      responses.forEach(resp => {
        const ts = parseGoogleFormResponseTimeV025(resp);
        if (!ts || (schoolYearStart && ts < schoolYearStart)) return;
        const who = inferStaffFromGoogleFormResponseDetailedV0544(resp, staffNames);
        if (normalizeStaffNameV018(who.matchedStaff || '') !== targetKey) return;
        rows.push({ date: ts.toISOString(), displayDate: formatDateForDataMetricV025(ts), sortMs: ts.getTime(), studentName: student.name, submittedStaffName: who.submittedStaffName || '' });
      });
    } catch (err) {
      errors.push({ studentName: student.name, error: err.message });
    }
  }
  rows.sort((a, b) => Number(b.sortMs || 0) - Number(a.sortMs || 0));
  return { staffName, rows, errors, errorCount: errors.length, schoolYearStartDate: sy, schoolYearStartDateDisplay: sy ? formatDateForDataMetricV025(parseSchoolYearStartDateV025(sy)) : '', source: 'google-forms-api' };
}

function parseJsonSafeV015_(raw, fallback) {
  try { return JSON.parse(raw || ''); } catch (err) { return fallback; }
}

function scheduleTextForStaffV015_(views, staffName) {
  const wanted = String(staffName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const lines = [];
  const staffSchedules = (views && views.staffSchedules) || [];
  const rec = Array.isArray(staffSchedules) ? staffSchedules.find(r => String((r && (r.staff || r.name || r.staffName)) || '').trim().toLowerCase().replace(/\s+/g, ' ') === wanted) : null;
  if (rec) {
    lines.push('Schedule for ' + (rec.staff || rec.name || staffName));
    Object.keys(rec).forEach(k => {
      if (/^(staff|name|staffName)$/i.test(k)) return;
      const v = rec[k];
      if (v == null || v === '') return;
      if (Array.isArray(v)) lines.push(k + ': ' + v.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join('; '));
      else if (typeof v === 'object') lines.push(k + ': ' + JSON.stringify(v));
      else lines.push(k + ': ' + String(v));
    });
  } else {
    lines.push('A published schedule is available in Support Schedules.');
    lines.push('Staff member: ' + staffName);
  }
  const breakItems = (views && views.breakItems) || [];
  const breaks = Array.isArray(breakItems) ? breakItems.filter(b => String((b && (b.staffOnBreak || b.staff || b.name)) || '').trim().toLowerCase().replace(/\s+/g, ' ') === wanted) : [];
  if (breaks.length) {
    lines.push('');
    lines.push('Breaks and lunches:');
    breaks.forEach(b => {
      const kind = restKindLabelV05418EG(b.type || b.breakType || b.notes || 'Break');
      const cover = cleanScheduleDisplayValueV05418EG(b.coveringStaff || '');
      lines.push('- ' + [kind, cleanScheduleDisplayValueV05418EG(b.time), cover ? ('covered by ' + cover) : '', cleanScheduleDisplayValueV05418EG(b.location)].filter(Boolean).join(' · '));
    });
  }
  return lines.join('\n');
}

async function buildPublishedEmailCandidates(redis, spreadsheetId) {
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId);
  const views = parseJsonSafeV015_(props.V5_PUBLISHED_SCHEDULE_JSON || props.V5_WORKING_SCHEDULE_JSON || '{}', {});
  const publishedAt = props.V5_PUBLISHED_AT || props.V5_WORKING_SCHEDULE_SAVED_AT || '';
  const staffValues = await readRedisSheetValues(redis, spreadsheetId, 'Staff');
  if (!staffValues.length) return [];
  const headers = Array.isArray(staffValues[0]) ? staffValues[0] : [];
  const colName = findHeaderIndex_(headers, ['name', 'staff', 'staff name'], 0);
  const colStatus = findHeaderIndex_(headers, ['status'], 8);
  const colEmail = findHeaderIndex_(headers, ['email', 'notification email'], 10);
  const out = [];
  for (let r = 1; r < staffValues.length; r++) {
    const row = Array.isArray(staffValues[r]) ? staffValues[r] : [];
    const name = String(row[colName] || '').trim();
    if (!name || /^vacancy/i.test(name)) continue;
    const status = colStatus >= 0 ? String(row[colStatus] || '').trim() : '';
    if (!staffStatusIsActive_(status)) continue;
    const email = String(row[colEmail] || '').trim();
    if (!email || !/@/.test(email)) continue;
    out.push({ key: name, staff: name, email, rowIndex: r + 1, publishedAt, subject: 'Support Schedules Published Schedule', text: scheduleTextForStaffV015_(views, name) });
  }
  return out;
}

async function sendPublishedScheduleEmails(candidates, fromName) {
  const nodemailer = require('nodemailer');
  const transport = process.env.EMAIL_TRANSPORT === 'smtp'
    ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: String(process.env.SMTP_PORT) === '465', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined })
    : nodemailer.createTransport({ jsonTransport: true });
  let sent = 0, failed = 0, skipped = 0;
  const details = [];
  for (const c of candidates || []) {
    if (!c.email) { skipped++; details.push({ staff: c.staff, status: 'skipped', message: 'No email.' }); continue; }
    try {
      const info = await transport.sendMail({
        to: c.email,
        from: process.env.SMTP_FROM || (fromName ? fromName + ' <' + (process.env.GA_ACTIVE_USER_EMAIL || 'support-schedules@example.org') + '>' : (process.env.GA_ACTIVE_USER_EMAIL || 'support-schedules@example.org')),
        subject: c.subject || 'Support Schedules Published Schedule',
        text: c.text || 'A published schedule is available in Support Schedules.'
      });
      sent++; details.push({ staff: c.staff, email: c.email, status: 'sent', messageId: info.messageId || '' });
    } catch (err) {
      failed++; details.push({ staff: c.staff, email: c.email, status: 'failed', message: err.message });
    }
  }
  return { sent, failed, skipped, details, message: `Schedule email workflow complete. Sent: ${sent}, skipped: ${skipped}, failed: ${failed}.` };
}



function boolFromSettingV018(value, defaultValue) {
  const s = String(value == null ? '' : value).trim().toLowerCase();
  if (!s) return !!defaultValue;
  if (/^(yes|true|1|on|enabled)$/i.test(s)) return true;
  if (/^(no|false|0|off|disabled)$/i.test(s)) return false;
  return !!defaultValue;
}
function normalizeStaffNameV018(name) {
  return String(name || '')
    .normalize('NFKC')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
function sha256ShortV018(text) { return crypto.createHash('sha256').update(String(text || '')).digest('hex').slice(0, 24); }
async function getCommunicationSettingsV018(redis, spreadsheetId) {
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId);
  const enabledRaw = props.V686M26_COMM_ENABLED;
  const emailRaw = props.V686M26_COMM_EMAIL_ENABLED;
  const brevoGlobalProps = await readBrevoSystemAdminPropertiesV05418O(redis);
  const brevo = brevoPublicSettingsV05418N(brevoGlobalProps);
  const brevoScheduleActive = !!(brevo.enabled && brevo.scheduleEnabled);
  return {
    enabled: boolFromSettingV018(enabledRaw, true) || brevoScheduleActive,
    emailEnabled: boolFromSettingV018(emailRaw, true) || brevoScheduleActive,
    emailFromName: String(props.V686M26_COMM_EMAIL_FROM_NAME || brevo.fromName || 'Support Schedules Schedule Update').trim() || 'Support Schedules Schedule Update',
    emailConnectorUrl: String(props.V686M26_COMM_EMAIL_CONNECTOR_URL || '').trim(),
    emailSharedSecretSaved: !!String(props.V686M26_COMM_EMAIL_SHARED_SECRET || '').trim(),
    deliveryMethods: brevoScheduleActive ? ['Brevo Email'] : ['Email'],
    brevo: brevo
  };
}
async function readCommunicationStateV018(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_ScheduleCommunicationState');
  const out = {};
  for (let i = 1; i < values.length; i++) { const row = Array.isArray(values[i]) ? values[i] : []; const key = String(row[0] || '').trim(); if (key) out[key] = String(row[1] == null ? '' : row[1]); }
  return out;
}
async function writeCommunicationStateV018(redis, spreadsheetId, state) {
  const rows = [['Key', 'Value', 'Updated']]; const stamp = formatDateTimeV027(new Date());
  Object.keys(state || {}).sort().forEach(key => { const value = state[key]; if (value == null || value === '') return; rows.push([key, String(value), stamp]); });
  await writeRedisSheetValues(redis, spreadsheetId, '_ScheduleCommunicationState', rows);
}
async function appendCommunicationLogV018(redis, spreadsheetId, rowsToAppend) {
  if (!rowsToAppend || !rowsToAppend.length) return;
  let values = await readRedisSheetValues(redis, spreadsheetId, '_ScheduleCommunicationLog');
  if (!values.length) values = [['Timestamp','Published At','Schedule Hash','Mode','Staff','Modality','Recipient','Status','Message','Sent By','Version']];
  values = values.concat(rowsToAppend);
  const header = values[0];
  const maxRows = Number(process.env.COMMUNICATION_LOG_MAX_ROWS || 250) || 250;
  if (values.length > maxRows + 1) values = [header].concat(values.slice(-maxRows));
  await writeRedisSheetValues(redis, spreadsheetId, '_ScheduleCommunicationLog', values);
}
async function getLivePublishedScheduleModelV05418AM_(runtime, school) {
  const opts = { userEmail: school.userEmail, selectedSchool: { spreadsheetId: school.spreadsheetId } };
  let views = null;
  try { views = await runtime.call('admin', 'getPublishedScheduleViewsV5', [], opts); } catch (eLive) { views = null; }
  if (!views || typeof views !== 'object') views = { items: [], staffSchedules: [], studentSchedules: [], breakItems: [] };
  const publishedAt = String(views.publishedAt || '').trim();
  const raw = JSON.stringify(views);
  const hash = sha256ShortV018(raw + '|' + publishedAt);
  const dailyVersion = Number(views.dailyVersion || 0) || 0;
  const scheduleLabel = String(views.scheduleLabel || '').trim();
  return { props: {}, raw, views, publishedAt, hash, dailyVersion, scheduleLabel };
}
async function getPublishedScheduleModelV018(redis, spreadsheetId) {
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId);
  const raw = String(props.V5_PUBLISHED_SCHEDULE_JSON || props.V5_WORKING_SCHEDULE_JSON || '').trim();
  const views = parseJsonSafeV015_(raw || '{}', {});
  const publishedAt = String(props.V5_PUBLISHED_AT || props.V5_WORKING_SCHEDULE_SAVED_AT || '').trim();
  const hash = String(props.V5_PUBLISHED_HASH || props.V5_CURRENT_SCHEDULE_HASH || sha256ShortV018(raw + '|' + publishedAt)).trim();
  return { props, raw, views, publishedAt, hash };
}
function communicationPublishInstanceV05418S(model) {
  model = model || {};
  const h = String(model.hash || '').trim();
  const p = String(model.publishedAt || '').trim();
  if (!h && !p) return '';
  return sha256ShortV018(h + '|' + p);
}
function cleanTextV018(value) { return String(value == null ? '' : value).trim(); }
function numMinutesV05418EF(value) { if (value === 0) return 0; if (value == null || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
function formatMinutesV05418EF(value) {
  const n = numMinutesV05418EF(value);
  if (n == null) return '';
  const h = Math.floor(n / 60);
  const m = n % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return hh + ':' + String(m).padStart(2, '0') + ' ' + ap;
}
function splitWindowRangeV05418EF(obj) {
  obj = obj || {};
  const raw = cleanTextV018(obj.splitWindowLabel || obj.splitLabel || obj.splitTimeLabel || obj.supportWindow || obj.timeWindow || '');
  if (raw && raw !== '-' && raw !== '(-)') return raw;
  const start = numMinutesV05418EF(obj.splitStartMinutes != null ? obj.splitStartMinutes : obj.startMinutes);
  const end = numMinutesV05418EF(obj.splitEndMinutes != null ? obj.splitEndMinutes : obj.endMinutes);
  if (start != null && end != null && end > start) return formatMinutesV05418EF(start) + ' - ' + formatMinutesV05418EF(end);
  const notes = Array.isArray(obj.notes) ? obj.notes.join(' ') : cleanTextV018(obj.notes || '');
  const m = notes.match(/Split-period support window:\s*([^;]+)/i);
  return m ? cleanTextV018(m[1]) : '';
}
function splitWindowCaptionV05418EF(obj) {
  obj = obj || {};
  const direct = cleanTextV018(obj.splitWindowCaption || obj.splitCaption || obj.windowCaption || '');
  if (direct) return direct;
  const mode = cleanTextV018(obj.splitWindowMode || obj.mode || obj.windowMode || obj.type || obj.segment || obj.position).toLowerCase();
  const minutes = cleanTextV018(obj.splitWindowMinutes || obj.minutes || obj.duration || obj.minuteCount || obj.lengthMinutes);
  if (mode === 'first' && minutes) return 'First ' + minutes + ' min';
  if (mode === 'last' && minutes) return 'Last ' + minutes + ' min';
  if (mode === 'between' && minutes) return 'Between ' + minutes + ' min';
  return '';
}
function splitWindowDisplayV05418EF(obj, opts) {
  opts = opts || {};
  const range = splitWindowRangeV05418EF(obj);
  const caption = splitWindowCaptionV05418EF(obj);
  if (caption && range && opts.includeRange !== false) return caption + ' · ' + range;
  return caption || range;
}
function studentLabelV018(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return cleanTextV018(value);
  if (typeof value === 'object') {
    let label = cleanTextV018(value.baseName || value.displayName || value.name || value.student || value.label || value.title || value.id || JSON.stringify(value));
    label = label.replace(/\s*\(split\s+\d+\)\s*$/i, '').trim();
    const split = splitWindowDisplayV05418EF(value);
    if (split && !label.toLowerCase().includes(split.toLowerCase())) label += ' (Split: ' + split + ')';
    if ((value.isTwoToOne || value.twoToOneSupport) && !/2\s*:\s*1/i.test(label)) label += ' (2:1 support)';
    return label;
  }
  return cleanTextV018(value);
}
function findStaffScheduleRecordV018(views, staffName) { const wanted = normalizeStaffNameV018(staffName); const schedules = Array.isArray(views && views.staffSchedules) ? views.staffSchedules : []; return schedules.find(r => normalizeStaffNameV018((r && (r.staff || r.name || r.staffName)) || '') === wanted) || null; }
function periodRowDisplayLabelV05418EF(row) {
  row = row || {};
  return cleanTextV018(row.title || row.period || row.item || row.label || row.block || 'Schedule item');
}
function rowHasSupportNeedV05418EF(row) {
  const support = cleanTextV018((row && (row.support || row.supportType)) || '');
  const location = cleanTextV018((row && (row.location || row.room)) || '');
  const noSupport = !support || /^(n\/?a|na|none|no support needed)$/i.test(support);
  const noLocation = !location || /^(n\/?a|na)$/i.test(location);
  return !noSupport && !noLocation;
}
function rowSplitBoundsV05418EF(row) {
  const start = numMinutesV05418EF(row && row.splitStartMinutes);
  const end = numMinutesV05418EF(row && row.splitEndMinutes);
  return start != null && end != null && end > start ? { start, end } : null;
}
function periodBoundsV05418EF(row) {
  const start = numMinutesV05418EF(row && row.startMinutes);
  const end = numMinutesV05418EF(row && row.endMinutes);
  return start != null && end != null && end > start ? { start, end } : null;
}
function mergeBusyV05418EF(list) {
  const rows = (list || []).filter(x => x && x.start != null && x.end != null && x.end > x.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  for (const x of rows) {
    if (!out.length || x.start > out[out.length - 1].end) out.push({ start: x.start, end: x.end });
    else out[out.length - 1].end = Math.max(out[out.length - 1].end, x.end);
  }
  return out;
}
function freeSegmentsV05418EF(row, busy) {
  const p = periodBoundsV05418EF(row);
  if (!p) return [];
  let cur = p.start;
  const out = [];
  for (const b of mergeBusyV05418EF(busy || [])) {
    if (b.start > cur) out.push({ start: cur, end: b.start });
    cur = Math.max(cur, b.end);
  }
  if (cur < p.end) out.push({ start: cur, end: p.end });
  return out.filter(x => x.end > x.start);
}
function supportTextV05418EF(row) {
  let support = cleanTextV018((row && (row.support || row.supportType || row.supportRaw)) || '');
  support = support.replace(/\s*\(\s*split-period\s*\)\s*/ig, '').trim();
  if (/2\s*:\s*1/i.test(support)) support = '2:1 Support';
  return support;
}
function linePrefixWithTimeV05418EF(period, obj) {
  const split = rowSplitBoundsV05418EF(obj);
  if (split) return period + ' ' + formatMinutesV05418EF(split.start) + ' - ' + formatMinutesV05418EF(split.end);
  return period;
}
function studentScheduleLinesV018(views, studentName) {
  const lines = [];
  const wanted = normalizeStaffNameV018(studentName);
  const schedules = Array.isArray(views && views.studentSchedules) ? views.studentSchedules : [];
  const rec = schedules.find(r => normalizeStaffNameV018((r && (r.student || r.name)) || '') === wanted) || null;
  if (rec) {
    const rowList = Array.isArray(rec.rows) ? rec.rows : [];
    rowList.forEach(row => {
      row = row || {};
      const period = periodRowDisplayLabelV05418EF(row);
      const support = supportTextV05418EF(row);
      const location = cleanTextV018(row.location || row.room || '');
      const staff = cleanTextV018(row.staff || '');
      const split = splitWindowDisplayV05418EF(row);
      const details = [];
      if (staff) details.push('with ' + staff);
      else if (support && !/^(n\/?a|na|none|no support needed)$/i.test(support)) details.push('Needs support - unassigned');
      if (location) details.push('@ ' + location);
      if (support && !/^(n\/?a|na|none|no support needed)$/i.test(support)) details.push(support);
      if (split) details.push('Split: ' + split);
      if (period || details.length) lines.push(linePrefixWithTimeV05418EF(period || 'Schedule item', row) + ': ' + (details.join(' · ') || 'No support needed'));
    });
  }
  return lines.filter(Boolean);
}

function supportFreeLabelV028(views) {
  const loc = cleanTextV018((views && views.unassignedSupportLocation) || '');
  return loc ? ('Support ' + loc) : 'Support';
}
function replaceFreeLabelV028(value, viewsOrLocation) {
  const loc = typeof viewsOrLocation === 'string' ? cleanTextV018(viewsOrLocation) : cleanTextV018((viewsOrLocation && viewsOrLocation.unassignedSupportLocation) || '');
  const label = loc ? ('Support ' + loc) : 'Support';
  return String(value || '').replace(/\bfree\b/gi, label);
}
function cleanScheduleDisplayValueV05418EG(value) {
  const s = cleanTextV018(Array.isArray(value) ? value.join(', ') : value);
  return /^(n\/?a|na)$/i.test(s) ? '' : s;
}
function restKindLabelV05418EG(type) {
  const s = cleanTextV018(type || '');
  if (/lunch/i.test(s)) return 'Lunch';
  if (/break/i.test(s)) return 'Break';
  return s || 'Rest';
}
function staffScheduleLinesV018(views, staffName) {
  const lines = [];
  const wanted = normalizeStaffNameV018(staffName);
  const rec = findStaffScheduleRecordV018(views, staffName);
  const freeLabel = supportFreeLabelV028(views);
  if (rec) {
    const rowList = Array.isArray(rec.rows) ? rec.rows : [];
    if (rowList.length) rowList.forEach(row => {
      row = row || {};
      const period = periodRowDisplayLabelV05418EF(row);
      const students = Array.isArray(row.students) ? row.students.filter(Boolean) : [];
      const loc = cleanTextV018(row.location || row.room || row.site || '');
      const restEvents = Array.isArray(row.restEvents) ? row.restEvents : [];
      const splitStudents = students.filter(st => !!splitWindowRangeV05418EF(st));
      const allSplit = students.length && splitStudents.length === students.length && !!periodBoundsV05418EF(row);
      if (allSplit) {
        const busy = [];
        splitStudents.forEach(st => {
          const bounds = rowSplitBoundsV05418EF(st);
          if (!bounds) return;
          busy.push(bounds);
          const details = [studentLabelV018(st)];
          const sLoc = cleanTextV018(st.location || loc || '');
          if (sLoc) details.push('@ ' + sLoc);
          lines.push(period + ' ' + formatMinutesV05418EF(bounds.start) + ' - ' + formatMinutesV05418EF(bounds.end) + ': ' + details.join(' · '));
        });
        if (!restEvents.length) {
          freeSegmentsV05418EF(row, busy).forEach(f => lines.push(period + ' ' + formatMinutesV05418EF(f.start) + ' - ' + formatMinutesV05418EF(f.end) + ': ' + freeLabel));
        }
      } else if (students.length) {
        const details = [students.map(studentLabelV018).filter(Boolean).join(', ')];
        if (loc) details.push('@ ' + loc);
        lines.push((period || 'Schedule item') + ': ' + details.filter(Boolean).join(' · '));
      } else {
        let raw = cleanTextV018(row.detail || row.assignment || row.freeText || row.status || row.source || freeLabel);
        raw = replaceFreeLabelV028(raw, views);
        if (period || raw) lines.push((period || 'Schedule item') + ': ' + (raw || freeLabel));
      }
    });
    else Object.keys(rec).forEach(k => { if (/^(staff|name|staffName|key)$/i.test(k)) return; const v = rec[k]; if (v == null || v === '') return; if (Array.isArray(v)) lines.push(k + ': ' + v.map(studentLabelV018).filter(Boolean).join('; ')); else if (typeof v === 'object') lines.push(k + ': ' + replaceFreeLabelV028(JSON.stringify(v), views)); else lines.push(k + ': ' + replaceFreeLabelV028(String(v), views)); });
  }
  const breakItems = Array.isArray(views && views.breakItems) ? views.breakItems : [];
  breakItems.forEach(b => {
    b = b || {};
    const roles = [b.staffOnBreak, b.staff, b.name, b.coveringStaff, b.helperStaff, b.helperCoveringFor].map(normalizeStaffNameV018);
    if (!roles.includes(wanted)) return;
    const kind = restKindLabelV05418EG(b.type || b.breakType || b.notes || 'Break');
    const onBreak = normalizeStaffNameV018(b.staffOnBreak || b.staff || b.name || '') === wanted;
    const role = onBreak ? ('Scheduled ' + cleanScheduleDisplayValueV05418EG(b.type || kind).toLowerCase()) : ('Covering ' + cleanScheduleDisplayValueV05418EG(b.staffOnBreak || b.staff || 'staff'));
    const students = replaceFreeLabelV028(cleanScheduleDisplayValueV05418EG(b.students || b.studentsSupported || ''), views);
    const detail = [cleanScheduleDisplayValueV05418EG(b.time || b.label || ''), role, students, cleanScheduleDisplayValueV05418EG(b.location || b.room || '')].filter(Boolean).join(' · ');
    if (detail) lines.push(kind + ': ' + detail);
  });
  return lines.filter(Boolean);
}
function splitAwareStaffLinesV05418EF(views, staffName) {
  const lines = staffScheduleLinesV018(views || {}, staffName).filter(Boolean);
  const splitOrReleased = lines.filter(line => /\bSplit:\b/i.test(line) || /\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[\u2013\u2014-]\s*\d{1,2}:\d{2}/i.test(line));
  return splitOrReleased.length ? splitOrReleased : [];
}
function splitAwareScheduleCardHtmlV05418EF(lines) {
  lines = (lines || []).filter(Boolean);
  if (!lines.length) return '';
  const items = lines.slice(0, 60).map(line => '<li>' + escapeHtmlV05418N(line) + '</li>').join('');
  return '<div id="splitAwareScheduleV05418EF" style="margin:12px 0;padding:12px 14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:14px;color:#0f172a;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box">'
    + '<strong>Split-period schedule details</strong>'
    + '<div style="font-size:12px;color:#475569;margin-top:3px">Only the listed split windows are assigned. Time outside the split window is available for lunch, break, coverage, or free time.</div>'
    + '<ul style="margin:8px 0 0 18px;padding:0;line-height:1.45;font-size:13px">' + items + '</ul></div>';
}
async function splitAwareStaffScheduleCardForRequestV05418EF(redis, staffSchool, query) {
  try {
    if (!staffSchool || !staffSchool.spreadsheetId) return '';
    const staffName = cleanTextV018((query && (query.staff || query.staffName)) || '');
    if (!staffName) return '';
    const model = await getPublishedScheduleModelV018(redis, staffSchool.spreadsheetId);
    const lines = splitAwareStaffLinesV05418EF(model.views || {}, staffName);
    return splitAwareScheduleCardHtmlV05418EF(lines);
  } catch (err) { return ''; }
}
function injectSplitAwareStaffCardIntoHtmlV05418EF(html, card) {
  html = String(html || '');
  card = String(card || '');
  if (!card || html.indexOf('splitAwareScheduleV05418EF') >= 0) return html;
  const script = '<script>(function(){var c=document.getElementById("splitAwareScheduleV05418EF");if(!c)return;var heads=Array.prototype.slice.call(document.querySelectorAll("h1,h2,h3"));var h=heads.find(function(x){return /^My Schedule(\\s|$)/i.test(String(x.textContent||"").trim());});var host=h&&(h.closest(".card,.box,section,main>div")||h.parentNode);if(host&&host.parentNode&&host.nextSibling!==c)host.parentNode.insertBefore(c,host.nextSibling);})();</script>';
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, card + script + '</body>');
  return html + card + script;
}
function staffSignatureV018(views, staffName) { return staffScheduleLinesV018(views || {}, staffName).join('\n').replace(/\s+/g, ' ').trim(); }
function changeSummaryV018(oldViews, newViews, staffName) {
  const oldLines = staffScheduleLinesV018(oldViews || {}, staffName); const newLines = staffScheduleLinesV018(newViews || {}, staffName); const oldSet = new Set(oldLines); const newSet = new Set(newLines); const added = newLines.filter(x => !oldSet.has(x)); const removed = oldLines.filter(x => !newSet.has(x)); const lines = [];
  added.slice(0, 10).forEach(x => lines.push('Added/Updated: ' + x)); removed.slice(0, 8).forEach(x => lines.push('Removed/Replaced: ' + x));
  if (!lines.length && newLines.length && oldLines.length) lines.push('Your published schedule details changed.'); if (!lines.length && newLines.length) lines.push('Your schedule is included in this published schedule.'); return lines;
}
function emailListV018(value) { return String(value || '').split(/[;,\s]+/).map(x => x.trim()).filter(x => /@/.test(x)); }
function fullScheduleMessageV018(candidate, mode, data) {
  const lines = [];
  if (data.publishedAt) lines.push('Published: ' + data.publishedAt);
  if (candidate.staff) lines.push('Staff: ' + candidate.staff);
  if (mode === 'changed' && candidate.changeSummary && candidate.changeSummary.length) { lines.push(''); lines.push('What changed:'); candidate.changeSummary.forEach(x => lines.push('- ' + x)); }
  lines.push(''); lines.push('Your current published schedule:'); const schedLines = candidate.scheduleLines && candidate.scheduleLines.length ? candidate.scheduleLines : ['No schedule rows were found for your staff record in the current published schedule.']; schedLines.forEach(x => lines.push('- ' + x));
  if (candidate.staffPortalLink) { lines.push(''); lines.push('Open your Staff Portal schedule:'); lines.push(candidate.staffPortalLink); }
  lines.push(''); lines.push('This message was sent by Support Schedules.'); return lines.join('\n');
}
async function buildCommunicationCandidatesV018(redis, req, school, spreadsheetId, liveModelOverride) {
  const settings = await getCommunicationSettingsV018(redis, spreadsheetId); const model = liveModelOverride || (await getPublishedScheduleModelV018(redis, spreadsheetId)); const publishMetaV05418U = liveModelOverride ? { label: liveModelOverride.scheduleLabel || '', dailyVersion: liveModelOverride.dailyVersion || 0 } : await getScheduleVersionV027(redis, spreadsheetId).catch(() => ({})); const state = await readCommunicationStateV018(redis, spreadsheetId); const oldViews = parseJsonSafeV015_(state.LAST_COMMUNICATED_SCHEDULE_JSON || '{}', null); const cfg = await getStaffPortalBootstrapConfig(redis); const baseUrl = getBaseUrl(req);
  // BUGFIX: a staff member with no email on file used to be entirely unselectable here --
  // disabled checkbox, excluded from both the email send AND the Send Push Notification
  // button -- even if they have the mobile app paired and could receive a push just fine.
  // Now checks paired-device status too, and only skips someone who has neither.
  const pairedDevices = await readAppDevicesV05418Y(redis, spreadsheetId).catch(() => []);
  const pairedKeys = new Set(pairedDevices.map((d) => normalizeKeyV05418X(d.staffName)));
  const preferences = await getCommPreferencesV05418BV(redis, spreadsheetId).catch(() => new Map());
  const tokenVersions = await getAllStaffTokenVersionsV05421(redis, spreadsheetId).catch(() => new Map());
  const staffValues = await readRedisSheetValues(redis, spreadsheetId, 'Staff'); const headers = Array.isArray(staffValues[0]) ? staffValues[0] : []; const colName = findHeaderIndex_(headers, ['name', 'staff', 'staff name', 'staff member', 'employee name'], 0); const colStatus = findHeaderIndex_(headers, ['status', 'status code', 'staff status', 'employee status', 'active status', 'active'], -1); const colEmail = findHeaderIndex_(headers, ['email', 'notification email'], 10); const colPhone = findHeaderIndex_(headers, ['phone', 'phone number'], 11); const map = new Map();
  for (let r = 1; r < staffValues.length; r++) { const row = Array.isArray(staffValues[r]) ? staffValues[r] : []; const name = cleanTextV018(row[colName] || ''); if (!name || /^vacancy/i.test(name)) continue; const key = normalizeStaffNameV018(name); if (!key || map.has(key)) continue; const status = colStatus >= 0 ? cleanTextV018(row[colStatus] || '') : ''; const active = staffStatusIsActive_(status); const email = cleanTextV018(row[colEmail] || ''); const phone = cleanTextV018(row[colPhone] || ''); map.set(key, { staff: name, key, status, active, email, phone, rowIndex: r + 1 }); }
  const schedules = Array.isArray(model.views && model.views.staffSchedules) ? model.views.staffSchedules : []; schedules.forEach(rec => { const name = cleanTextV018((rec && (rec.staff || rec.name || rec.staffName)) || ''); const key = normalizeStaffNameV018(name); if (key && !map.has(key)) map.set(key, { staff: name, key, status: '', active: true, email: '', rowIndex: null }); });
  const rows = Array.from(map.values()).map(c => { const scheduleLines = staffScheduleLinesV018(model.views, c.staff); const newSig = staffSignatureV018(model.views, c.staff); const oldSig = oldViews ? staffSignatureV018(oldViews, c.staff) : ''; const changed = !oldViews || newSig !== oldSig; const changeSummary = changed ? changeSummaryV018(oldViews || {}, model.views, c.staff) : []; const token = makeStaffPortalToken(school, c.staff, cfg.tokenSecret || '', tokenVersions.get(normalizeStaffPortalName(c.staff)) || 0); const staffPortalLink = baseUrl + '/staff?' + new URLSearchParams({ school, staff: c.staff, staffToken: token, view: 'my' }).toString(); const hasPushDevice = pairedKeys.has(normalizeKeyV05418X(c.staff)); const hasEmail = !!emailListV018(c.email).length; const prefRec = preferences.get(normalizeKeyV05418X(c.staff)); const preference = (prefRec && prefRec.preference) || 'email'; let skipReason = ''; if (!c.active) skipReason = 'Staff is not Active.'; else if (!hasEmail && !hasPushDevice) skipReason = 'No email or paired device for this staff member.'; return Object.assign({}, c, { notificationEmail: c.email, staffPortalLink, changed, hasPushDevice, hasEmail, preference, selectedAll: !skipReason, selectedChanged: !skipReason && changed, scheduleLines, schedulePreview: scheduleLines.slice(0, 5).join('\n'), changeSummary, skipReason }); }).sort((a, b) => String(a.staff).localeCompare(String(b.staff)));
  const changedRows = rows.filter(r => r.changed); const publishInstance = communicationPublishInstanceV05418S(model); const scheduleVersion = Number(publishMetaV05418U.dailyVersion || 0) || (model.publishedAt ? 1 : 0); const changedEligible = changedRows.filter(r => !r.skipReason).length; const recommendedMode = (scheduleVersion >= 2 && changedEligible > 0) ? 'changed' : 'all'; return { settings, views: model.views, publishedAt: model.publishedAt, hash: model.hash, publishInstance, scheduleVersion, scheduleLabel: publishMetaV05418U.label || '', lastCommunicatedHash: state.LAST_COMMUNICATED_HASH || '', lastCommunicatedInstance: state.LAST_COMMUNICATED_INSTANCE || '', lastCommunicatedAt: state.LAST_COMMUNICATED_AT || '', snoozedHash: state.SNOOZED_HASH || state.SNOOZED_PUBLISHED_HASH || '', snoozedInstance: state.SNOOZED_INSTANCE || '', hasLastCommunicated: !!oldViews, recommendedMode, all: rows, changed: changedRows, counts: { all: rows.length, allEligible: rows.filter(r => !r.skipReason).length, changed: changedRows.length, changedEligible } };
}
async function getCommunicationPromptStateV018(redis, req, school, spreadsheetId) {
  const data = await buildCommunicationCandidatesV018(redis, req, school, spreadsheetId);
  const currentInstance = data.publishInstance || data.hash || '';
  const alreadyCommunicated = !!(currentInstance && (currentInstance === data.lastCommunicatedInstance || (!data.lastCommunicatedInstance && data.hash && data.hash === data.lastCommunicatedHash)));
  const alreadySnoozed = !!(currentInstance && (currentInstance === data.snoozedInstance || (!data.snoozedInstance && data.hash && data.hash === data.snoozedHash)));
  const show = !!(data.settings.enabled && data.settings.emailEnabled && data.publishedAt && currentInstance && !alreadyCommunicated && !alreadySnoozed); let reason = 'Ready to share';
  if (!data.settings.enabled) reason = 'Communication workflow disabled'; else if (!data.settings.emailEnabled) reason = 'Email communication disabled'; else if (!data.publishedAt) reason = 'No published schedule'; else if (alreadyCommunicated) reason = 'Already communicated'; else if (alreadySnoozed) reason = 'Snoozed for current published schedule';
  return { show, enabled: data.settings.enabled, reason, publishedAt: data.publishedAt, hash: data.hash, publishInstance: data.publishInstance, scheduleVersion: data.scheduleVersion || 0, scheduleLabel: data.scheduleLabel || '', lastCommunicatedHash: data.lastCommunicatedHash, lastCommunicatedInstance: data.lastCommunicatedInstance, snoozedHash: data.snoozedHash, snoozedInstance: data.snoozedInstance, counts: data.counts, recommendedMode: data.recommendedMode };
}
async function sendScheduleCommunicationEmailsV018(candidates, mode, settings, data, sentBy, trackCtx) {
  const brevo = settings && settings.brevoPrivate ? settings.brevoPrivate : (settings && settings.brevo ? settings.brevo : null);
  const useBrevo = !!(brevo && brevo.enabled && brevo.scheduleEnabled && brevo.apiKey);
  let transport = null;
  if (!useBrevo) {
    const nodemailer = require('nodemailer');
    transport = process.env.EMAIL_TRANSPORT === 'smtp'
      ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: String(process.env.SMTP_PORT) === '465', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined })
      : nodemailer.createTransport({ jsonTransport: true });
  }
  const stamp = formatDateTimeV027(new Date()); let sent = 0, failed = 0, skipped = 0; const details = []; const logRows = [];
  for (const c of candidates || []) {
    const emails = emailListV018(c.notificationEmail || c.email || '');
    if (!emails.length) {
      skipped++;
      details.push({ staff: c.staff, status: 'skipped', message: 'No email.' });
      logRows.push([stamp, data.publishedAt || '', data.hash || '', mode, c.staff || '', useBrevo ? 'Brevo Email' : 'Email', '', 'Skipped', 'No email.', sentBy || '', VERSION]);
      continue;
    }
    const subject = mode === 'changed' ? ('Schedule changed: ' + c.staff) : ('Schedule published: ' + c.staff);
    const text = fullScheduleMessageV018(c, mode, data);
    try {
      let messageId = '';
      if (useBrevo) {
        const html = scheduleEmailHtmlV05418N(c, mode, data, text);
        const info = await sendBrevoTransactionalEmailV05418N(brevo, { to: emails, subject, textContent: text, htmlContent: html });
        messageId = info.messageId || '';
      } else {
        const info = await transport.sendMail({ to: emails.join(','), from: process.env.SMTP_FROM || ((settings.emailFromName || 'Support Schedules Schedule Update') + ' <' + (process.env.GA_ACTIVE_USER_EMAIL || 'support-schedules@example.org') + '>'), subject, text });
        messageId = info.messageId || '';
      }
      sent++;
      if (useBrevo && trackCtx && trackCtx.redis) {
        for (const email of emails) {
          try { await recordBrevoScheduleSendV05418Q(trackCtx.redis, { messageId, email, staff: c.staff, school: trackCtx.school || '', spreadsheetId: trackCtx.spreadsheetId || '', mode, hash: data.hash || '', publishInstance: data.publishInstance || data.hash || '', publishedAt: data.publishedAt || '', sentAt: stamp, sentBy, trackingEnabled: !!brevo.trackingEnabled }); } catch (_) {}
        }
      }
      details.push({ staff: c.staff, email: emails.join(','), status: 'sent', provider: useBrevo ? 'brevo' : (process.env.EMAIL_TRANSPORT === 'smtp' ? 'smtp' : 'json'), messageId });
      logRows.push([stamp, data.publishedAt || '', data.hash || '', mode, c.staff || '', useBrevo ? 'Brevo Email' : 'Email', emails.join(','), 'Sent', useBrevo ? ('Sent through Brevo. Message ID: ' + messageId) : (process.env.EMAIL_TRANSPORT === 'smtp' ? 'Sent by SMTP.' : 'Rendered by JSON email transport.'), sentBy || '', VERSION]);
    } catch (err) {
      failed++;
      details.push({ staff: c.staff, email: emails.join(','), status: 'failed', provider: useBrevo ? 'brevo' : 'smtp/json', message: err.message });
      logRows.push([stamp, data.publishedAt || '', data.hash || '', mode, c.staff || '', useBrevo ? 'Brevo Email' : 'Email', emails.join(','), 'Failed', err.message || String(err), sentBy || '', VERSION]);
    }
  }
  return { sent, failed, skipped, provider: useBrevo ? 'brevo' : (process.env.EMAIL_TRANSPORT === 'smtp' ? 'smtp' : 'json'), details, logRows, message: `Schedule communication complete. Email sent: ${sent}, skipped: ${skipped}, failed: ${failed}.` };
}





async function requireSystemAdminV05418O(redis, req) {
  if (!isAuthEnabled()) return true;
  const email = getRequestUserEmail(req);
  const explicitAdminEmails = String(process.env.AUTH_ALLOWED_EMAILS || process.env.GA_ACTIVE_USER_EMAIL || '').split(/[;,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  if (explicitAdminEmails.includes(String(email || '').toLowerCase())) return true;
  const rows = await readAllCampusUserRows(redis);
  if (!rows.length) return true;
  const allowed = rows.some(row => {
    const rec = parseCampusUserRowV0541_(row);
    const status = String(rec.status || 'Active').trim().toLowerCase();
    const role = String(rec.role || '').trim().toLowerCase();
    return rec.email === String(email || '').toLowerCase() && status === 'active' && (role === 'system admin' || role === 'district');
  });
  if (!allowed) throw new Error('System Admin access is required to edit Brevo provider settings.');
  return true;
}

async function readBrevoSystemAdminPropertiesV05418O(redis) {
  const key = 'gas:properties:admin:script';
  if (!redis || !redis.hGetAll) return {};
  return await redis.hGetAll(key) || {};
}
async function writeBrevoSystemAdminPropertiesV05418O(redis, props) {
  const key = 'gas:properties:admin:script';
  if (!redis || !redis.hSet) return;
  const out = {};
  [
    'V05418N_BREVO_ENABLED',
    'V05418N_BREVO_SCHEDULE_ENABLED',
    'V05418N_BREVO_ABSENCE_ENABLED',
    'V05418N_BREVO_CONTACT_ENABLED',
    'V05418N_BREVO_FROM_NAME',
    'V05418N_BREVO_FROM_EMAIL',
    'V05418N_BREVO_REPLY_TO_EMAIL',
    'V05418N_BREVO_TEST_RECIPIENT',
    'V05418N_BREVO_CONTACT_RECIPIENTS',
    'V05418N_BREVO_API_KEY',
    'V05418Q_BREVO_TRACKING_ENABLED',
    'V05418Q_BREVO_WEBHOOK_TOKEN'
  ].forEach(k => { if (Object.prototype.hasOwnProperty.call(props || {}, k)) out[k] = String(props[k] == null ? '' : props[k]); });
  out.V05418O_BREVO_SCOPE = 'system-admin';
  out.V05418O_BREVO_UPDATED_AT = formatDateTimeV027(new Date());
  await redis.hSet(key, out);
}



async function sendBrevoContactLeadV05418O(redis, lead) {
  const props = await readBrevoSystemAdminPropertiesV05418O(redis);
  const settings = brevoPrivateSettingsV05418N(props);
  if (!(settings.enabled && settings.contactEnabled && settings.apiKey)) return { skipped: true, reason: 'brevo-contact-disabled' };
  const recipients = emailListV018(settings.contactRecipients || '').slice(0, 25);
  if (!recipients.length) return { skipped: true, reason: 'no-contact-recipients' };
  const subject = 'Support Schedules inquiry: ' + (lead.organization || lead.name || 'New lead');
  const text = [
    'A new Support Schedules inquiry was submitted.', '',
    'Name: ' + (lead.name || 'N/A'),
    'Email: ' + (lead.email || 'N/A'),
    'Organization: ' + (lead.organization || 'N/A'),
    'Role: ' + (lead.role || 'N/A'),
    'Team size: ' + (lead.teamSize || 'N/A'),
    'Submitted: ' + (lead.submittedAt || ''), '',
    'Message:',
    lead.message || 'N/A'
  ].join('\n');
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#0f172a"><h2>New Support Schedules inquiry</h2>'
    + '<p><b>Name:</b> ' + escapeHtmlV05418N(lead.name || 'N/A') + '<br><b>Email:</b> ' + escapeHtmlV05418N(lead.email || 'N/A') + '<br><b>Organization:</b> ' + escapeHtmlV05418N(lead.organization || 'N/A') + '<br><b>Team size:</b> ' + escapeHtmlV05418N(lead.teamSize || 'N/A') + '</p>'
    + '<pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px">' + escapeHtmlV05418N(text) + '</pre>'
    + '<p style="font-size:12px;color:#64748b">Sent by Support Schedules through Brevo.</p></div>';
  const info = await sendBrevoTransactionalEmailV05418N(settings, { to: recipients, subject, textContent: text, htmlContent: html });
  return { ok: true, provider: 'brevo', recipients: recipients.length, messageId: info.messageId || '' };
}

function cleanBrevoTextV05418N(value) { return String(value == null ? '' : value).trim(); }
function escapeHtmlV05418N(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function maskBrevoApiKeyV05418N(key) {
  key = cleanBrevoTextV05418N(key);
  if (!key) return '';
  if (key.length <= 8) return 'saved';
  return key.slice(0, 4) + '...' + key.slice(-4);
}
function resolveSchoolForBrevoV05418N(cfg, raw) {
  raw = cleanBrevoTextV05418N(raw || (cfg && cfg.defaultSchoolId) || '');
  const schools = (cfg && cfg.schools) || {};
  if (schools[raw]) return { school: raw, schoolRec: schools[raw], matchedBy: 'key' };
  const want = raw.toLowerCase();
  for (const key of Object.keys(schools)) {
    const rec = schools[key] || {};
    const aliases = [key, rec.name, rec.schoolName, rec.campusName, rec.shortCode, rec.dataStoreName, rec.spreadsheetId].filter(Boolean).map(v => String(v).toLowerCase());
    if (aliases.includes(want)) return { school: key, schoolRec: rec, matchedBy: 'alias' };
  }
  throw new Error('Unknown school key: ' + raw + '. Known keys: ' + Object.keys(schools).join(', '));
}
function brevoPublicSettingsV05418N(props) {
  props = props || {};
  const apiKey = cleanBrevoTextV05418N(props.V05418N_BREVO_API_KEY || process.env.BREVO_API_KEY || '');
  return {
    enabled: boolFromSettingV018(props.V05418N_BREVO_ENABLED, false),
    scheduleEnabled: boolFromSettingV018(props.V05418N_BREVO_SCHEDULE_ENABLED, false),
    absenceEnabled: boolFromSettingV018(props.V05418N_BREVO_ABSENCE_ENABLED, false),
    contactEnabled: boolFromSettingV018(props.V05418N_BREVO_CONTACT_ENABLED, false),
    fromName: cleanBrevoTextV05418N(props.V05418N_BREVO_FROM_NAME || props.V686M26_COMM_EMAIL_FROM_NAME || 'Support Schedules'),
    fromEmail: cleanBrevoTextV05418N(props.V05418N_BREVO_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'schedules@supportschedules.com'),
    replyToEmail: cleanBrevoTextV05418N(props.V05418N_BREVO_REPLY_TO_EMAIL || process.env.BREVO_REPLY_TO_EMAIL || ''),
    testRecipient: cleanBrevoTextV05418N(props.V05418N_BREVO_TEST_RECIPIENT || ''),
    contactRecipients: cleanBrevoTextV05418N(props.V05418N_BREVO_CONTACT_RECIPIENTS || ''),
    trackingEnabled: boolFromSettingV018(props.V05418Q_BREVO_TRACKING_ENABLED, false),
    webhookTokenSaved: !!cleanBrevoTextV05418N(props.V05418Q_BREVO_WEBHOOK_TOKEN || process.env.BREVO_WEBHOOK_TOKEN || ''),
    webhookTokenMasked: maskBrevoApiKeyV05418N(cleanBrevoTextV05418N(props.V05418Q_BREVO_WEBHOOK_TOKEN || process.env.BREVO_WEBHOOK_TOKEN || '')),
    webhookPath: '/api/communication/brevo-webhook-v05418q?token=YOUR_TOKEN',
    apiKeySaved: !!apiKey,
    apiKeyMasked: maskBrevoApiKeyV05418N(apiKey),
    provider: 'brevo'
  };
}
function brevoPrivateSettingsV05418N(props) {
  const pub = brevoPublicSettingsV05418N(props || {});
  pub.apiKey = cleanBrevoTextV05418N((props && props.V05418N_BREVO_API_KEY) || process.env.BREVO_API_KEY || '');
  return pub;
}
async function sendBrevoTransactionalEmailV05418N(settings, message) {
  settings = settings || {}; message = message || {};
  const apiKey = cleanBrevoTextV05418N(settings.apiKey || process.env.BREVO_API_KEY || '');
  if (!apiKey) throw new Error('Brevo API key is not configured.');
  const fromEmail = cleanBrevoTextV05418N(settings.fromEmail || process.env.BREVO_FROM_EMAIL || '');
  if (!emailListV018(fromEmail).length) throw new Error('Brevo From Email is missing or invalid.');
  const to = (Array.isArray(message.to) ? message.to : emailListV018(message.to || '')).map(email => cleanBrevoTextV05418N(email)).filter(Boolean);
  if (!to.length) throw new Error('Brevo message has no recipient.');
  const body = {
    sender: { email: fromEmail, name: cleanBrevoTextV05418N(settings.fromName || 'Support Schedules') || 'Support Schedules' },
    to: to.map(email => ({ email })),
    subject: cleanBrevoTextV05418N(message.subject || 'Support Schedules notification'),
    textContent: String(message.textContent || message.text || '')
  };
  const html = String(message.htmlContent || message.html || '').trim();
  if (html) body.htmlContent = html;
  const replyTo = cleanBrevoTextV05418N(settings.replyToEmail || '');
  if (emailListV018(replyTo).length) body.replyTo = { email: replyTo };
  const controller = new AbortController();
  const timeoutMs = Math.max(3000, Number(process.env.BREVO_TIMEOUT_MS || 15000) || 15000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error('Brevo send timed out after ' + timeoutMs + ' ms.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let json = {}; try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { raw: text }; }
  if (!response.ok) throw new Error('Brevo send failed HTTP ' + response.status + ': ' + (json.message || text || response.statusText));
  return { ok: true, status: response.status, messageId: json.messageId || json.messageIds || '', response: json };
}

function normalizeBrevoMessageIdV05418T(value) {
  let s = cleanBrevoTextV05418N(value || '');
  if (!s) return '';
  if (Array.isArray(value)) s = cleanBrevoTextV05418N(value[0] || '');
  s = s.replace(/^<+|>+$/g, '').trim();
  return s;
}
function brevoMessageIdVariantsV05418T(value) {
  const raw = cleanBrevoTextV05418N(value || '');
  const norm = normalizeBrevoMessageIdV05418T(value);
  return Array.from(new Set([raw, norm, raw.toLowerCase(), norm.toLowerCase(), raw.replace(/^<+|>+$/g,'').trim(), norm ? '<' + norm + '>' : ''].filter(Boolean)));
}
async function rememberBrevoWebhookDiagnosticV05418T(redis, obj) {
  try {
    if (!redis || !redis.hSet) return;
    const now = formatDateTimeV027(new Date());
    const key = 'support_schedules:brevo:webhook_diagnostics:v05418t';
    const out = Object.assign({ updatedAt: now, version: VERSION }, obj || {});
    await redis.hSet(key, Object.fromEntries(Object.entries(out).map(([k,v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])));
    let rows = [];
    try { rows = JSON.parse(await redis.get(key + ':recent') || '[]') || []; } catch (_) { rows = []; }
    rows.push(out);
    if (rows.length > 25) rows = rows.slice(-25);
    await redis.set(key + ':recent', JSON.stringify(rows));
  } catch (_) {}
}
async function readBrevoWebhookDiagnosticsV05418T(redis) {
  const key = 'support_schedules:brevo:webhook_diagnostics:v05418t';
  const summary = await redis.hGetAll(key) || {};
  let recent = [];
  try { recent = JSON.parse(await redis.get(key + ':recent') || '[]') || []; } catch (_) { recent = []; }
  return { summary, recent };
}
async function recordBrevoScheduleSendV05418Q(redis, rec) {
  if (!redis || !rec) return { ok: false, skipped: true };
  const rawMessageId = cleanBrevoTextV05418N(rec.messageId || rec.message_id || '');
  let messageId = normalizeBrevoMessageIdV05418T(rec.messageId || rec.message_id || '');
  const email = cleanBrevoTextV05418N(rec.email || '').toLowerCase();
  if (!email) return { ok: false, skipped: true, reason: 'missing-email' };
  const now = formatDateTimeV027(new Date());
  if (!messageId) {
    const fallbackSeed = [rec.school || '', rec.hash || rec.publishInstance || '', rec.publishedAt || '', rec.staff || '', email, rec.sentAt || now].join('|');
    messageId = 'local-' + sha256ShortV018(fallbackSeed);
  }
  const key = messageId + '|' + email;
  const status = {
    key,
    messageId,
    rawMessageId,
    email,
    staff: cleanBrevoTextV05418N(rec.staff || ''),
    school: cleanBrevoTextV05418N(rec.school || ''),
    spreadsheetId: cleanBrevoTextV05418N(rec.spreadsheetId || ''),
    type: cleanBrevoTextV05418N(rec.type || 'schedule-share'),
    subject: cleanBrevoTextV05418N(rec.subject || ''),
    mode: cleanBrevoTextV05418N(rec.mode || ''),
    scheduleHash: cleanBrevoTextV05418N(rec.hash || ''),
    publishInstance: cleanBrevoTextV05418N(rec.publishInstance || rec.publishedInstance || rec.hash || ''),
    publishedAt: cleanBrevoTextV05418N(rec.publishedAt || ''),
    sentAt: cleanBrevoTextV05418N(rec.sentAt || now),
    sentBy: cleanBrevoTextV05418N(rec.sentBy || ''),
    provider: 'brevo',
    trackingEnabled: !!rec.trackingEnabled,
    currentStatus: 'sent',
    deliveredAt: '',
    firstOpenedAt: '',
    lastOpenedAt: '',
    clickedAt: '',
    failedAt: '',
    finalStatus: 'sent',
    openCount: 0,
    clickCount: 0,
    lastEvent: 'sent',
    lastEventAt: now,
    updatedAt: now,
    version: VERSION,
    eventKeys: []
  };
  await redis.hSet('support_schedules:brevo:staff_message_status:v05418q', key, JSON.stringify(status));
  for (const id of brevoMessageIdVariantsV05418T(rec.messageId || rec.message_id || messageId)) {
    await redis.hSet('support_schedules:brevo:staff_message_index:v05418q', id, key);
  }
  return { ok: true, key };
}

function brevoWebhookTokenFromRequestV05418Q(req) {
  const auth = cleanBrevoTextV05418N(req.headers && req.headers.authorization || '');
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  return cleanBrevoTextV05418N((req.query && req.query.token) || (req.headers && (req.headers['x-brevo-token'] || req.headers['x-support-schedules-token'])) || '');
}
function brevoWebhookMessageIdV05418Q(event) {
  event = event || {};
  return normalizeBrevoMessageIdV05418T(event.messageId || event.messageID || event['message-id'] || event['messageId'] || event.id || event.uuid || '');
}
function brevoWebhookEmailV05418Q(event) {
  event = event || {};
  return cleanBrevoTextV05418N(event.email || event.recipient || event.to || event.rcpt || '').toLowerCase();
}
function brevoWebhookEventNameV05418Q(event) {
  return cleanBrevoTextV05418N((event && (event.event || event.type || event.eventType || event.name)) || '').toLowerCase();
}
function brevoWebhookEventTimeV05418Q(event) {
  const raw = event && (event.date || event.ts || event.timestamp || event.time || event.createdAt);
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return formatDateTimeV027(new Date(n < 100000000000 ? n * 1000 : n));
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return formatDateTimeV027(d);
  }
  return formatDateTimeV027(new Date());
}
function applyBrevoEventToStatusV05418Q(status, event) {
  const name = brevoWebhookEventNameV05418Q(event) || 'event';
  const at = brevoWebhookEventTimeV05418Q(event || {});
  const eventKey = [name, brevoWebhookMessageIdV05418Q(event), brevoWebhookEmailV05418Q(event), event && (event.ts || event.timestamp || event.date || '')].join('|');
  status.eventKeys = Array.isArray(status.eventKeys) ? status.eventKeys : [];
  if (status.eventKeys.includes(eventKey)) return { status, duplicate: true };
  status.eventKeys.push(eventKey);
  if (status.eventKeys.length > 30) status.eventKeys = status.eventKeys.slice(-30);
  status.lastEvent = name;
  status.lastEventAt = at;
  status.updatedAt = formatDateTimeV027(new Date());
  if (/delivered/.test(name)) { status.deliveredAt = status.deliveredAt || at; status.currentStatus = 'delivered'; status.finalStatus = 'delivered'; }
  else if (/uniqueopened|unique_opened|opened|open/.test(name)) { status.firstOpenedAt = status.firstOpenedAt || at; status.lastOpenedAt = at; status.openCount = Number(status.openCount || 0) + 1; status.currentStatus = 'opened'; status.finalStatus = 'opened'; }
  else if (/click/.test(name)) { status.clickedAt = status.clickedAt || at; status.clickCount = Number(status.clickCount || 0) + 1; status.currentStatus = 'clicked'; status.finalStatus = 'clicked'; }
  else if (/bounce|blocked|invalid|spam|unsubscribed|deferred|error|failed/.test(name)) { status.failedAt = status.failedAt || at; status.currentStatus = name; status.finalStatus = name; }
  else if (/sent|request/.test(name)) { status.currentStatus = status.currentStatus || 'sent'; status.finalStatus = status.finalStatus || 'sent'; }
  return { status, duplicate: false };
}
async function handleBrevoWebhookV05418Q(redis, req) {
  const props = await readBrevoSystemAdminPropertiesV05418O(redis);
  const configured = cleanBrevoTextV05418N(props.V05418Q_BREVO_WEBHOOK_TOKEN || process.env.BREVO_WEBHOOK_TOKEN || '');
  if (!configured) { await rememberBrevoWebhookDiagnosticV05418T(redis, { result: 'error', error: 'token-not-configured' }); throw new Error('Brevo webhook token is not configured in System Admin.'); }
  const supplied = brevoWebhookTokenFromRequestV05418Q(req);
  if (!supplied || supplied !== configured) { await rememberBrevoWebhookDiagnosticV05418T(redis, { result: 'error', error: 'invalid-token' }); throw new Error('Invalid Brevo webhook token.'); }
  const events = Array.isArray(req.body) ? req.body : (Array.isArray(req.body && req.body.events) ? req.body.events : [req.body || {}]);
  let matched = 0, ignored = 0, duplicates = 0; const details = [];
  for (const event of events) {
    const messageId = brevoWebhookMessageIdV05418Q(event);
    const email = brevoWebhookEmailV05418Q(event);
    const eventName = brevoWebhookEventNameV05418Q(event);
    if (!messageId) { ignored++; details.push({ event: eventName, email, result: 'ignored', reason: 'missing-message-id' }); continue; }
    let statusKey = '';
    for (const id of brevoMessageIdVariantsV05418T(messageId)) {
      statusKey = await redis.hGet('support_schedules:brevo:staff_message_index:v05418q', id);
      if (statusKey) break;
    }
    if (statusKey && email && !String(statusKey).toLowerCase().endsWith('|' + email)) {
      for (const id of brevoMessageIdVariantsV05418T(messageId)) {
        const compound = id + '|' + email;
        const exists = await redis.hGet('support_schedules:brevo:staff_message_status:v05418q', compound);
        if (exists) { statusKey = compound; break; }
      }
    }
    if (!statusKey) { ignored++; details.push({ event: eventName, messageId, email, result: 'ignored', reason: 'no-matching-sent-email' }); continue; }
    const raw = await redis.hGet('support_schedules:brevo:staff_message_status:v05418q', statusKey);
    if (!raw) { ignored++; details.push({ event: eventName, messageId, email, result: 'ignored', reason: 'status-record-missing' }); continue; }
    let status = {}; try { status = JSON.parse(raw) || {}; } catch (_) { status = {}; }
    if (!status.type) { ignored++; details.push({ event: eventName, messageId, email, result: 'ignored', reason: 'untyped-status-record' }); continue; }
    const applied = applyBrevoEventToStatusV05418Q(status, event);
    if (applied.duplicate) { duplicates++; details.push({ event: eventName, messageId, email, staff: status.staff || '', result: 'duplicate' }); continue; }
    await redis.hSet('support_schedules:brevo:staff_message_status:v05418q', statusKey, JSON.stringify(applied.status));
    matched++; details.push({ event: eventName, messageId, email, staff: status.staff || '', result: 'matched' });
  }
  const result = { received: events.length, matched, ignored, duplicates, details: details.slice(-10) };
  await rememberBrevoWebhookDiagnosticV05418T(redis, { result: 'processed', received: events.length, matched, ignored, duplicates, lastDetails: details.slice(-10) });
  return result;
}
async function listBrevoStaffEmailStatusesV05418Q(redis, opts) {
  opts = opts || {};
  const all = await redis.hGetAll('support_schedules:brevo:staff_message_status:v05418q') || {};
  const school = cleanBrevoTextV05418N(opts.school || '').toLowerCase();
  const rows = Object.values(all).map(raw => { try { return JSON.parse(raw) || null; } catch (_) { return null; } }).filter(Boolean).filter(r => !school || String(r.school || '').toLowerCase() === school);
  rows.sort((a,b) => String(b.updatedAt || b.sentAt || '').localeCompare(String(a.updatedAt || a.sentAt || '')));
  return rows.slice(0, Math.max(1, Math.min(500, Number(opts.limit || 200) || 200)));
}

function formatBrevoStatusDisplayTimeV05418V(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  // Already-rendered platform timestamps should pass through unchanged.
  if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\s+\d{1,2}:\d{2}\s*(AM|PM)$/i.test(raw)) return raw;
  if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\s+\d{1,2}:\d{2}:\d{2}\s*(AM|PM)$/i.test(raw)) return raw.replace(/:(\d{2})\s*(AM|PM)$/i, ' $2');
  const numeric = Number(raw);
  let d = null;
  if (Number.isFinite(numeric) && numeric > 0) d = new Date(numeric < 100000000000 ? numeric * 1000 : numeric);
  else {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }
  return d ? formatDateTimeV027(d) : raw;
}
function decorateBrevoStatusRowsForDisplayV05418V(rows) {
  return (rows || []).map(row => {
    const out = Object.assign({}, row || {});
    ['sentAt','deliveredAt','firstOpenedAt','lastOpenedAt','clickedAt','failedAt','lastEventAt','updatedAt','publishedAt'].forEach(k => {
      if (out[k]) out[k + 'Display'] = formatBrevoStatusDisplayTimeV05418V(out[k]);
    });
    return out;
  });
}

function scheduleEmailHtmlV05418N(candidate, mode, data, text) {
  const lines = String(text || '').split('\n').map(escapeHtmlV05418N);
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#0f172a">'
    + '<h2 style="margin:0 0 10px">' + escapeHtmlV05418N(mode === 'changed' ? 'Schedule changed' : 'Schedule published') + '</h2>'
    + '<p><b>Staff:</b> ' + escapeHtmlV05418N(candidate && candidate.staff || '') + '</p>'
    + '<pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px">' + lines.join('\n') + '</pre>'
    + (candidate && candidate.staffPortalLink ? '<p><a href="' + escapeHtmlV05418N(candidate.staffPortalLink) + '" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;border-radius:999px;padding:10px 14px;font-weight:700">Open Staff Portal</a></p>' : '')
    + '<p style="font-size:12px;color:#64748b">Sent by Support Schedules through Brevo.</p></div>';
}
async function sendBrevoAbsenceNotificationV05418N(redis, req, staffSchool, payload) {
  staffSchool = staffSchool || {};
  const spreadsheetId = staffSchool.spreadsheetId || staffSchool.selectedSpreadsheetId || '';
  if (!spreadsheetId) return { ok: false, skipped: true, reason: 'missing-spreadsheet' };
  const props = await readBrevoSystemAdminPropertiesV05418O(redis);
  const settings = brevoPrivateSettingsV05418N(props);
  if (!(settings.enabled && settings.absenceEnabled && settings.apiKey)) return { ok: false, skipped: true, reason: 'brevo-absence-disabled' };
  const siteProps = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId);
  const recipients = emailListV018(siteProps.V5_ABSENCE_NOTIFY_EMAILS || '').slice(0, 25);
  if (!recipients.length) return { ok: false, skipped: true, reason: 'no-site-absence-recipients' };
  const schoolName = staffSchool.schoolName || staffSchool.name || staffSchool.campusName || staffSchool.school || 'Staff Portal';
  const staffName = cleanBrevoTextV05418N(payload.staffName || payload.staff || '');
  const start = cleanBrevoTextV05418N(payload.startDate || payload.date || '');
  const end = cleanBrevoTextV05418N(payload.endDate || payload.startDate || '');
  const partial = String(payload.dayPart || 'full').toLowerCase() === 'partial';
  const subject = schoolName + ' absence report: ' + (staffName || 'Staff');
  const text = [
    'A staff absence report was submitted through the Staff Portal.', '',
    'School: ' + schoolName,
    'Staff: ' + (staffName || 'N/A'),
    'Date: ' + start + (end && end !== start ? ' - ' + end : ''),
    'Reason: ' + (cleanBrevoTextV05418N(payload.reason) || 'N/A'),
    'Day part: ' + (partial ? 'Partial day' : 'Full day'),
    'Arrival time: ' + (cleanBrevoTextV05418N(payload.arrivalTime) || 'N/A'),
    'Leave time: ' + (cleanBrevoTextV05418N(payload.leaveTime) || 'N/A'),
    'Notes: ' + (cleanBrevoTextV05418N(payload.notes) || 'N/A'),
    'Submitted: ' + formatDateTimeV027(new Date())
  ].join('\n');
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#0f172a"><h2>Staff absence report</h2>'
    + '<p><b>School:</b> ' + escapeHtmlV05418N(schoolName) + '<br><b>Staff:</b> ' + escapeHtmlV05418N(staffName || 'N/A') + '<br><b>Date:</b> ' + escapeHtmlV05418N(start + (end && end !== start ? ' - ' + end : '')) + '</p>'
    + '<pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px">' + escapeHtmlV05418N(text) + '</pre>'
    + '<p style="font-size:12px;color:#64748b">Sent by Support Schedules through Brevo.</p></div>';
  const info = await sendBrevoTransactionalEmailV05418N(settings, { to: recipients, subject, textContent: text, htmlContent: html });
  await appendCommunicationLogV018(redis, spreadsheetId, [[formatDateTimeV027(new Date()), '', '', 'absence', staffName, 'Brevo Email', recipients.join(','), 'Sent', 'Absence notification sent through Brevo. Message ID: ' + (info.messageId || ''), getRequestUserEmail(req) || 'staff-portal', VERSION]]);
  return { ok: true, provider: 'brevo', recipients: recipients.length, messageId: info.messageId || '' };
}

async function buildRegularScheduleV019(redis, spreadsheetId) {
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId);
  const lockValues = await readRedisSheetValues(redis, spreadsheetId, '_ScheduleHistoryLocks');
  const lockMap = {};
  for (let i = 1; i < lockValues.length; i++) {
    const row = Array.isArray(lockValues[i]) ? lockValues[i] : [];
    const id = String(row[0] || '').trim();
    if (!id) continue;
    lockMap[id] = row[1] === true || /^true|1|yes|locked$/i.test(String(row[1] || ''));
  }
  let ids = Object.keys(lockMap).filter(id => lockMap[id]);
  if (!ids.length) {
    ids = String(props.V5_REGULAR_HISTORY_IDS || props.V5_REGULAR_HISTORY_ID || '').split(',').map(x => String(x || '').trim()).filter(Boolean);
  }
  const display = String(props.V5_DISPLAY_REGULAR_ON_STAFF_PORTAL || '').toLowerCase() === 'true';
  const history = await readRedisSheetValues(redis, spreadsheetId, '_ScheduleHistory');
  const byId = new Map();
  for (let i = 1; i < history.length; i++) {
    const row = Array.isArray(history[i]) ? history[i] : [];
    const id = String(row[0] || '').trim();
    if (!id) continue;
    byId.set(id, {
      row: i + 1,
      id,
      publishedAt: String(row[1] || ''),
      starred: row[2] === true || /^true$/i.test(String(row[2] || '')),
      notes: String(row[3] || ''),
      hash: String(row[4] || ''),
      summary: String(row[5] || ''),
      chunks: row.slice(6).map(v => String(v == null ? '' : v)).join('')
    });
  }
  const schedules = ids.map(id => {
    const rec = byId.get(id);
    if (!rec) return null;
    let views = {};
    try { views = JSON.parse(rec.chunks || '{}') || {}; } catch (err) { views = {}; }
    return { id, label: regularLabelV019(rec), publishedAt: rec.publishedAt, summary: rec.summary, views };
  }).filter(Boolean);
  return { displayOnStaffPortal: display, id: schedules[0] ? schedules[0].id : (ids[0] || ''), publishedAt: schedules[0] ? schedules[0].publishedAt : '', summary: schedules[0] ? schedules[0].summary : '', views: schedules[0] ? schedules[0].views : null, schedules, regularIds: ids, lockMap };
}
function regularLabelV019(rec) {
  const note = String((rec && rec.notes) || '').trim();
  if (note) return note.split('/')[0].trim() || note.substring(0, 24);
  return String((rec && rec.summary) || 'Regular Schedule').split(' · ')[0].split(' - ')[0] || 'Regular Schedule';
}
function allowedDbEditorSheetV019(sheet) {
  return ['Staff','Students','Attendance','Calendar','Campus Settings'].includes(String(sheet || '').trim());
}
function dbEditorVisibleColumnIndexesV019(sheet, headers) {
  sheet = String(sheet || '').trim();
  headers = Array.isArray(headers) ? headers : [];
  const keep = [];
  const hide = [];
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').trim();
    const hn = h.toLowerCase().replace(/\s+/g, ' ');
    let hidden = false;
    if (sheet === 'Students') {
      hidden = /^(period\s*\d|period\s*[1-9]|break|lunch)/i.test(h) || /secondary\s*lunch|lunch\s*secondary|primary|secondary|support\s*location|support\s*type/i.test(hn);
      // Keep the core student columns and non-schedule admin fields visible; hide the large schedule matrix.
      if (/^(name|student|priority|absent|max group size|room|notes|data files|data points|data files last updated)$/i.test(h)) hidden = false;
    }
    if (sheet === 'Campus Settings') {
      hidden = /schedule\s*[-–—]?\s*show\s*logic/i.test(hn);
    }
    (hidden ? hide : keep).push(i);
  }
  return { keep, hide };
}
function filterDbEditorValuesV019(sheet, values) {
  if (!allowedDbEditorSheetV019(sheet)) throw new Error('Redis Data Editor is limited to Staff, Students, Attendance, Calendar, and Campus Settings.');
  values = Array.isArray(values) ? values : [];
  const headers = Array.isArray(values[0]) ? values[0] : [];
  const idx = dbEditorVisibleColumnIndexesV019(sheet, headers);
  const keep = idx.keep.length ? idx.keep : headers.map((_, i) => i);
  return { values: values.map(row => keep.map(i => (Array.isArray(row) ? row[i] : '') == null ? '' : (Array.isArray(row) ? row[i] : ''))), columns: keep, hiddenColumns: idx.hide };
}
function mergeDbEditorValuesV019(sheet, existing, edited) {
  if (!allowedDbEditorSheetV019(sheet)) throw new Error('Redis Data Editor is limited to Staff, Students, Attendance, Calendar, and Campus Settings.');
  existing = Array.isArray(existing) ? existing.map(r => Array.isArray(r) ? r.slice() : [String(r == null ? '' : r)]) : [];
  edited = Array.isArray(edited) ? edited : [];
  const headers = Array.isArray(existing[0]) ? existing[0] : (Array.isArray(edited[0]) ? edited[0] : []);
  const idx = dbEditorVisibleColumnIndexesV019(sheet, headers);
  const keep = idx.keep.length ? idx.keep : headers.map((_, i) => i);
  const width = Math.max(headers.length, keep.length, existing.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0));
  const out = [];
  const rows = Math.max(existing.length, edited.length);
  for (let r = 0; r < rows; r++) {
    const base = (Array.isArray(existing[r]) ? existing[r].slice() : []);
    while (base.length < width) base.push('');
    const editRow = Array.isArray(edited[r]) ? edited[r] : [];
    for (let c = 0; c < keep.length; c++) base[keep[c]] = editRow[c] == null ? '' : String(editRow[c]);
    out.push(base);
  }
  while (out.length && out[out.length - 1].every(v => String(v == null ? '' : v).trim() === '')) out.pop();
  return out;
}


async function buildRegularScheduleV022(redis, spreadsheetId) {
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId);
  const display = String(props.V5_DISPLAY_REGULAR_ON_STAFF_PORTAL || '').toLowerCase() === 'true';
  const lockValues = await readRedisSheetValues(redis, spreadsheetId, '_ScheduleHistoryLocks');
  const lockMap = {};
  const ids = [];
  for (let i = 1; i < lockValues.length; i++) {
    const row = Array.isArray(lockValues[i]) ? lockValues[i] : [];
    const id = String(row[0] || '').trim();
    if (!id) continue;
    const locked = row[1] === true || /^true|1|yes|locked$/i.test(String(row[1] || ''));
    lockMap[id] = locked;
    if (locked && ids.indexOf(id) < 0) ids.push(id);
  }
  // Redis deployment rule: Regular Schedule is now driven only by explicit Historical
  // Schedule locks. The older V5_REGULAR_HISTORY_IDS property is intentionally ignored
  // so stale legacy IDs cannot make unlocked schedules appear in Regular Schedule or
  // Staff Portal.
  const history = await readRedisSheetValues(redis, spreadsheetId, '_ScheduleHistory');
  const byId = new Map();
  for (let i = 1; i < history.length; i++) {
    const row = Array.isArray(history[i]) ? history[i] : [];
    const id = String(row[0] || '').trim();
    if (!id) continue;
    byId.set(id, {
      row: i + 1,
      id,
      publishedAt: String(row[1] || ''),
      starred: row[2] === true || /^true$/i.test(String(row[2] || '')),
      notes: String(row[3] || ''),
      hash: String(row[4] || ''),
      summary: String(row[5] || ''),
      chunks: row.slice(6).map(v => String(v == null ? '' : v)).join('')
    });
  }
  const schedules = ids.map((id) => {
    const rec = byId.get(id);
    if (!rec) return null;
    let views = {};
    try { views = JSON.parse(rec.chunks || '{}') || {}; } catch (err) { views = {}; }
    return { id, label: regularLabelV019(rec), publishedAt: rec.publishedAt, summary: rec.summary, views };
  }).filter(Boolean);
  return { displayOnStaffPortal: display, id: schedules[0] ? schedules[0].id : '', publishedAt: schedules[0] ? schedules[0].publishedAt : '', summary: schedules[0] ? schedules[0].summary : '', views: schedules[0] ? schedules[0].views : null, schedules, regularIds: ids, lockMap, source: 'ScheduleHistoryLocksOnlyV022' };
}

async function findStaffPhoneRecordV05418PH(redis, spreadsheetId, staffName, rowIndex) {
  const values = await readRedisSheetValues(redis, spreadsheetId, 'Staff');
  if (!values.length) return null;
  const headers = Array.isArray(values[0]) ? values[0] : [];
  const colName = findHeaderIndex_(headers, ['name', 'staff', 'staff name', 'staff member', 'employee name'], 0);
  const colStatus = findHeaderIndex_(headers, ['status', 'status code', 'staff status', 'employee status', 'employment status', 'active status', 'active'], 8);
  const colPhone = 11; // Column L is the canonical Phone column.
  const wanted = String(staffName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  let idx = rowIndex && rowIndex > 1 && values[rowIndex - 1] ? rowIndex - 1 : -1;
  if (idx > 0) {
    const row = Array.isArray(values[idx]) ? values[idx] : [];
    const name = String(row[colName] || '').trim();
    if (wanted && name.toLowerCase().replace(/\s+/g, ' ') !== wanted) idx = -1;
  }
  if (idx < 1 && wanted) {
    for (let i = 1; i < values.length; i++) {
      const row = Array.isArray(values[i]) ? values[i] : [];
      const name = String(row[colName] || '').trim();
      if (name && name.toLowerCase().replace(/\s+/g, ' ') === wanted) { idx = i; break; }
    }
  }
  if (idx < 1) return null;
  const row = Array.isArray(values[idx]) ? values[idx] : [];
  const resolvedName = String(row[colName] || staffName || '').trim();
  const resolvedRowIndex = idx + 1;
  return { rowIndex: resolvedRowIndex, name: resolvedName, status: String(row[colStatus] || '').trim(), phone: String(row[colPhone] || '').trim(), values, colPhone };
}

function formatPhoneV05418PH(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
  if (digits.length === 11 && digits[0] === '1') return '(' + digits.slice(1, 4) + ') ' + digits.slice(4, 7) + '-' + digits.slice(7);
  return digits;
}

async function saveStaffPhoneV05418PHDirect(redis, spreadsheetId, staffName, rowIndex, phoneRaw) {
  const rec = await findStaffPhoneRecordV05418PH(redis, spreadsheetId, staffName, rowIndex);
  if (!rec) throw new Error('Could not find the staff row to save phone for: ' + (staffName || ('row ' + rowIndex)) + '.');
  const phone = formatPhoneV05418PH(phoneRaw);
  const values = rec.values;
  while (values[0].length < 12) values[0].push('');
  values[0][11] = 'Phone';
  const idx = rec.rowIndex - 1;
  const row = Array.isArray(values[idx]) ? values[idx] : [];
  while (row.length < 12) row.push('');
  row[11] = phone;
  values[idx] = row;
  await writeRedisSheetValues(redis, spreadsheetId, 'Staff', values);
  return { staff: rec.name, rowIndex: rec.rowIndex, phone, message: phone ? 'Phone saved.' : 'Phone cleared.' };
}

async function findStaffEmailRecordV022(redis, spreadsheetId, staffName, rowIndex) {
  const values = await readRedisSheetValues(redis, spreadsheetId, 'Staff');
  if (!values.length) return null;
  const headers = Array.isArray(values[0]) ? values[0] : [];
  const colName = findHeaderIndex_(headers, ['name', 'staff', 'staff name', 'staff member', 'employee name'], 0);
  const colStatus = findHeaderIndex_(headers, ['status', 'status code', 'staff status', 'employee status', 'employment status', 'active status', 'active'], 8);
  const colEmail = 10; // Column K is the canonical Email column.
  const wanted = String(staffName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  let idx = rowIndex && rowIndex > 1 && values[rowIndex - 1] ? rowIndex - 1 : -1;
  if (idx > 0) {
    const row = Array.isArray(values[idx]) ? values[idx] : [];
    const name = String(row[colName] || '').trim();
    if (wanted && name.toLowerCase().replace(/\s+/g, ' ') !== wanted) idx = -1;
  }
  if (idx < 1 && wanted) {
    for (let i = 1; i < values.length; i++) {
      const row = Array.isArray(values[i]) ? values[i] : [];
      const name = String(row[colName] || '').trim();
      if (name && name.toLowerCase().replace(/\s+/g, ' ') === wanted) { idx = i; break; }
    }
  }
  if (idx < 1) return null;
  const row = Array.isArray(values[idx]) ? values[idx] : [];
  const resolvedName = String(row[colName] || staffName || '').trim();
  const resolvedRowIndex = idx + 1;
  const locked = await readStaffEmailLockV025(redis, spreadsheetId, resolvedName, resolvedRowIndex);
  return { rowIndex: resolvedRowIndex, name: resolvedName, status: String(row[colStatus] || '').trim(), email: String(row[colEmail] || '').trim(), values, colEmail, locked };
}

async function saveStaffEmailV022(redis, spreadsheetId, staffName, rowIndex, email) {
  const rec = await findStaffEmailRecordV022(redis, spreadsheetId, staffName, rowIndex);
  if (!rec) throw new Error('Could not find the staff row to save email for: ' + (staffName || ('row ' + rowIndex)) + '.');
  const values = rec.values;
  while (values[0].length < 11) values[0].push('');
  values[0][10] = 'Email';
  const idx = rec.rowIndex - 1;
  const row = Array.isArray(values[idx]) ? values[idx] : [];
  while (row.length < 11) row.push('');
  row[10] = email;
  values[idx] = row;
  await writeRedisSheetValues(redis, spreadsheetId, 'Staff', values);
  return { staff: rec.name, rowIndex: rec.rowIndex, email, message: email ? 'Email saved.' : 'Email cleared.' };
}

async function readRedisSheetValues(redis, spreadsheetId, sheetName) {
  if (!redis || !redis.get) return [];
  const raw = await redis.get(`gas:spreadsheet:${spreadsheetId}:sheet:${sheetName}:values`);
  try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function normHeader_(v) { return String(v || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function findHeaderIndex_(headers, names, fallbackIndex) {
  const map = new Map();
  (headers || []).forEach((h, i) => { const k = normHeader_(h); if (k && !map.has(k)) map.set(k, i); });
  for (const n of names || []) { const k = normHeader_(n); if (map.has(k)) return map.get(k); }
  return fallbackIndex;
}
function staffStatusIsActive_(status) {
  const s = String(status || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return true;
  if (/^(inactive|not active|disabled|archived|former|no|n|false|0)$/.test(s)) return false;
  if (s.includes('not active') || s.includes('inactive') || s.includes('disabled') || s.includes('archived')) return false;
  return /^(active|a|yes|y|true|1|lead)/.test(s);
}
async function listStaffPortalStaff(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, 'Staff');
  if (!values.length) return [];
  const headers = Array.isArray(values[0]) ? values[0] : [];
  const colName = findHeaderIndex_(headers, ['name', 'staff', 'staff name', 'staff member', 'employee name'], 0);
  const colStatus = findHeaderIndex_(headers, ['status', 'status code', 'staff status', 'employee status', 'employment status', 'active status', 'active'], -1);
  const seen = new Set();
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = Array.isArray(values[r]) ? values[r] : [];
    const name = String(row[colName] || '').trim();
    if (!name || /^vacancy/i.test(name)) continue;
    const key = name.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    const status = colStatus >= 0 ? String(row[colStatus] || '').trim() : '';
    out.push({ name, status, active: staffStatusIsActive_(status), rowIndex: r + 1 });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
function cleanPeriodV05418AF(v) { return String(v == null ? '' : v).trim(); }
function normPeriodV05418AF(v) { return cleanPeriodV05418AF(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
function stripPeriodScopeV05418AF(v) { return cleanPeriodV05418AF(v).replace(/^campus_[a-z0-9_]+__/i, '').replace(/_/g, ' ').trim(); }
function periodIdentityV05418AF(v) { return normPeriodV05418AF(stripPeriodScopeV05418AF(v)); }
function titlePeriodV05418AF(v) { const s = stripPeriodScopeV05418AF(v) || cleanPeriodV05418AF(v); return s.replace(/\b\w/g, m => m.toUpperCase()); }
function corePeriodsV05418AF() { return ['Period 1','Period 2','Period 3','Period 4','Period 5','Period 6','Break','Lunch']; }
function isCorePeriodV05418AF(v) { const n = periodIdentityV05418AF(v); return corePeriodsV05418AF().some(x => normPeriodV05418AF(x) === n); }
function canonicalCorePeriodV05418AF(v) { const n = periodIdentityV05418AF(v); const hit = corePeriodsV05418AF().find(x => normPeriodV05418AF(x) === n); return hit || cleanPeriodV05418AF(v); }
function blockTypeV05418AF(value, key) {
  const k = periodIdentityV05418AF(key);
  if (k === 'break') return 'break';
  if (k === 'lunch') return 'lunch';
  const v = normPeriodV05418AF(value);
  if (v === 'break') return 'break';
  if (v === 'lunch') return 'lunch';
  return 'instruction';
}
function parseJsonSafeV05418AF(raw, fallback) { try { const parsed = JSON.parse(raw || ''); return parsed == null ? fallback : parsed; } catch (_) { return fallback; } }
function normalizePeriodMetaRowsV05418AF(rows) {
  rows = Array.isArray(rows) ? rows : [];
  const out = [];
  const seen = new Set();
  function push(row) {
    row = row || {};
    let key = cleanPeriodV05418AF(row.key || row.item || row.period || row.name || row.displayName || '');
    if (!key) return;
    if (isCorePeriodV05418AF(key)) key = canonicalCorePeriodV05418AF(key);
    const identity = periodIdentityV05418AF(key);
    if (!identity || seen.has(identity)) return;
    seen.add(identity);
    const displayName = cleanPeriodV05418AF(row.displayName || row.label || row.name || titlePeriodV05418AF(key) || key) || key;
    out.push({
      key,
      displayName,
      notes: cleanPeriodV05418AF(row.notes || row.note || ''),
      blockType: blockTypeV05418AF(row.blockType || row.type, key)
    });
  }
  corePeriodsV05418AF().forEach(key => {
    const existing = rows.find(r => periodIdentityV05418AF((r || {}).key || (r || {}).item || (r || {}).period || (r || {}).displayName) === normPeriodV05418AF(key));
    push(existing || { key, displayName: key, blockType: blockTypeV05418AF('', key) });
  });
  rows.forEach(push);
  return out;
}
function getScheduleTemplateItemsV05418AF(values) {
  values = Array.isArray(values) ? values : [];
  if (!values.length) return [];
  const header = Array.isArray(values[0]) ? values[0] : [];
  const h = header.map(normPeriodV05418AF);
  let itemCol = h.indexOf('item');
  if (itemCol < 0) itemCol = h.indexOf('period');
  if (itemCol < 0) itemCol = 1;
  const out = [];
  const seen = new Set();
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const item = cleanPeriodV05418AF(row[itemCol]);
    const identity = periodIdentityV05418AF(item);
    if (!item || !identity || seen.has(identity)) continue;
    seen.add(identity);
    out.push(item);
  }
  return out;
}
async function buildPeriodDisplaySourceRedisV05418AF(redis, spreadsheetId) {
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId).catch(() => ({}));
  const rawMeta = parseJsonSafeV05418AF(props.V5_PERIOD_META_JSON || '[]', []);
  const templateValues = await readRedisSheetValues(redis, spreadsheetId, 'Schedule Templates').catch(() => []);
  const scheduleItems = getScheduleTemplateItemsV05418AF(templateValues);
  const scheduleByIdentity = new Map();
  scheduleItems.forEach(item => { const id = periodIdentityV05418AF(item); if (id && !scheduleByIdentity.has(id)) scheduleByIdentity.set(id, item); });
  const normalizedMeta = normalizePeriodMetaRowsV05418AF(rawMeta);
  const periodMeta = [];
  const itemLabels = {};
  const itemOrder = [];
  const seen = new Set();
  function periodNumberV05418AH(item) {
    const stripped = stripPeriodScopeV05418AF(item);
    let m = String(stripped || '').match(/^period\s*(\d+)$/i);
    if (m) return Number(m[1]);
    m = String(item || '').match(/(?:^|[_\s])period[_\s]*(\d+)(?:$|[_\s])/i);
    return m ? Number(m[1]) : null;
  }
  function addLabelAliasesV05418AH(item, displayName) {
    item = cleanPeriodV05418AF(item);
    displayName = cleanPeriodV05418AF(displayName || item);
    if (!item || !displayName) return;
    const aliases = [item, stripPeriodScopeV05418AF(item)];
    const num = periodNumberV05418AH(item);
    if (num != null) aliases.push('Period ' + num, 'period_' + num, 'campus_top__period_' + num, 'campus_top_period_' + num);
    aliases.forEach(k => { k = cleanPeriodV05418AF(k); if (k) itemLabels[k] = displayName; });
  }
  function addOrder(item) {
    item = cleanPeriodV05418AF(item);
    const id = periodIdentityV05418AF(item);
    if (!item || !id || seen.has(id)) return;
    seen.add(id);
    itemOrder.push(item);
  }
  corePeriodsV05418AF().forEach(addOrder);
  const metaByIdentity = new Map();
  normalizedMeta.forEach(row => {
    const originalKey = cleanPeriodV05418AF(row.key);
    const id = periodIdentityV05418AF(originalKey);
    if (!id) return;
    const finalKey = isCorePeriodV05418AF(originalKey) ? canonicalCorePeriodV05418AF(originalKey) : (scheduleByIdentity.get(id) || originalKey);
    const displayName = cleanPeriodV05418AF(row.displayName || titlePeriodV05418AF(finalKey) || finalKey);
    const copy = { key: finalKey, displayName, notes: cleanPeriodV05418AF(row.notes || ''), blockType: blockTypeV05418AF(row.blockType || row.type, finalKey) };
    if (!metaByIdentity.has(id)) {
      metaByIdentity.set(id, copy);
      periodMeta.push(copy);
    }
    addLabelAliasesV05418AH(originalKey, displayName);
    addLabelAliasesV05418AH(finalKey, displayName);
  });
  scheduleItems.forEach(item => {
    const id = periodIdentityV05418AF(item);
    if (!id || metaByIdentity.has(id)) return;
    const displayName = titlePeriodV05418AF(item) || item;
    const row = { key: item, displayName, notes: '', blockType: blockTypeV05418AF('', item), inferredFromBellSchedule: true };
    metaByIdentity.set(id, row);
    periodMeta.push(row);
    addLabelAliasesV05418AH(item, displayName);
  });
  periodMeta.forEach(row => addOrder(row.key));
  scheduleItems.forEach(addOrder);
  periodMeta.forEach(row => {
    addLabelAliasesV05418AH(row.key, row.displayName);
  });
  return { periodMeta, itemLabels, itemOrder, items: itemOrder, periods: itemOrder, scheduleTemplateItems: scheduleItems };
}


async function findStaffPortalStaffRecord(redis, spreadsheetId, staffName) {
  const wanted = normalizeStaffPortalName(staffName);
  if (!wanted) return null;
  const staff = await listStaffPortalStaff(redis, spreadsheetId);
  return staff.find(s => normalizeStaffPortalName(s.name) === wanted) || null;
}

function normalizeStaffPortalName(name) {
  return String(name || '')
    .normalize('NFKC')
    // Google Sheets (and Docs) autocorrect a hyphen typed with spaces around it (e.g. while
    // entering a hyphenated last name) into an en dash or similar -- visually almost
    // indistinguishable from a plain hyphen, but a different character, which silently broke
    // exact-match token generation/verification for exactly the staff this happened to.
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    // Smart quotes, similarly auto-substituted by the same tools, normalized for the same reason.
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Zero-width characters that can get pasted in invisibly from other documents.
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function makeStaffPortalToken(schoolId, staffName, secret, version) {
  const v = Number(version) || 0;
  const raw = String(schoolId || 'default').trim() + '|' + normalizeStaffPortalName(staffName) + '|' + v;
  return crypto.createHmac('sha256', String(secret || '')).update(raw).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 24);
}

// Staff-portal/app-pairing tokens are otherwise a pure function of (school, name, secret) --
// deterministic and reproducible forever, with no way to invalidate one staff member's
// existing QR codes/links short of rotating the shared secret for the entire school. This
// per-staff version number is folded into the token above; bumping it (see
// bumpStaffTokenVersionV05421 below) makes every token issued before that moment stop
// matching on verification, while a freshly generated one (using the new version) works
// immediately -- the same "invalidate everything issued so far" pattern used for session
// tokens elsewhere, just without needing a full token-blacklist store.
async function getAllStaffTokenVersionsV05421(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffTokenVersions');
  const map = new Map();
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const key = String(row[0] || '').trim();
    const version = Number(row[1] || 0) || 0;
    if (key) map.set(key, version);
  }
  return map;
}
async function getStaffTokenVersionV05421(redis, spreadsheetId, staffName) {
  const map = await getAllStaffTokenVersionsV05421(redis, spreadsheetId);
  return map.get(normalizeStaffPortalName(staffName)) || 0;
}
async function bumpStaffTokenVersionV05421(redis, spreadsheetId, staffName) {
  const key = normalizeStaffPortalName(staffName);
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffTokenVersions');
  const rows = values.length ? values.slice() : [['Staff Key', 'Version', 'LinkGeneratedAt']];
  let found = -1;
  for (let i = 1; i < rows.length; i++) { if (String((rows[i] || [])[0] || '').trim() === key) { found = i; break; } }
  const nextVersion = (found >= 1 ? Number(rows[found][1] || 0) || 0 : 0) + 1;
  // LinkGeneratedAt clears on every revoke -- a revoked staff member shows red (no issued
  // link at their current version) until an admin explicitly issues a new one, either via
  // Security Manager's regenerate action or the next QR letter batch.
  if (found >= 1) rows[found] = [key, nextVersion, '']; else rows.push([key, nextVersion, '']);
  await writeRedisSheetValues(redis, spreadsheetId, '_StaffTokenVersions', rows);
  await clearStaffPasscodeV05422(redis, spreadsheetId, staffName).catch(() => {});
  return nextVersion;
}
async function markLinkGeneratedV05422(redis, spreadsheetId, staffName) {
  const key = normalizeStaffPortalName(staffName);
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffTokenVersions');
  const rows = values.length ? values.slice() : [['Staff Key', 'Version', 'LinkGeneratedAt']];
  let found = -1;
  for (let i = 1; i < rows.length; i++) { if (String((rows[i] || [])[0] || '').trim() === key) { found = i; break; } }
  const version = found >= 1 ? Number(rows[found][1] || 0) || 0 : 0;
  const row = [key, version, new Date().toISOString()];
  if (found >= 1) rows[found] = row; else rows.push(row);
  await writeRedisSheetValues(redis, spreadsheetId, '_StaffTokenVersions', rows);
}
async function getAllLinkGeneratedV05422(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffTokenVersions');
  const map = new Map();
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const key = String(row[0] || '').trim();
    if (key) map.set(key, String(row[2] || ''));
  }
  return map;
}

// SECURITY_ACCESS_LOG_LIMIT_V05422: per staff member, not global -- oldest entries for that
// staff are dropped once they exceed this, keeping storage flat forever regardless of staff
// count or how long the school has been using the product. This is a dedicated log for the
// Security Manager (device/IP visibility) and intentionally separate from
// _StaffPortalAccessLog/_StaffPortalAccessLatest, which already power the unrelated Last
// View feature elsewhere -- kept untouched here to avoid any risk of regressing that.
const SECURITY_ACCESS_LOG_LIMIT_V05422 = 25;
async function recordSecurityAccessV05422(redis, spreadsheetId, staffName, route, ip, userAgent) {
  try {
    const key = normalizeStaffPortalName(staffName);
    if (!key) return;
    const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffSecurityAccessLog');
    const rows = values.length ? values.slice() : [['Timestamp', 'StaffKey', 'Staff', 'Route', 'IP', 'UserAgent']];
    rows.push([new Date().toISOString(), key, staffName, route || '', ip || '', String(userAgent || '').slice(0, 240)]);
    // Prune this staff member's own entries down to the cap; everyone else's rows are
    // untouched, so this scan cost only grows with one staff member's own history, not the
    // whole school's.
    const header = rows[0];
    const mine = [];
    const others = [];
    for (let i = 1; i < rows.length; i++) { if (rows[i][1] === key) mine.push(rows[i]); else others.push(rows[i]); }
    const trimmedMine = mine.slice(-SECURITY_ACCESS_LOG_LIMIT_V05422);
    const rebuilt = [header].concat(others, trimmedMine);
    await writeRedisSheetValues(redis, spreadsheetId, '_StaffSecurityAccessLog', rebuilt);
  } catch (err) { console.warn('[security access log]', err && err.message ? err.message : err); }
}
async function getSecurityAccessLogV05422(redis, spreadsheetId, staffName, limit) {
  const key = normalizeStaffPortalName(staffName);
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffSecurityAccessLog').catch(() => []);
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i] || [];
    if (String(r[1] || '') === key) rows.push({ timestamp: r[0] || '', staff: r[2] || '', route: r[3] || '', ip: r[4] || '', userAgent: r[5] || '' });
  }
  rows.reverse();
  return rows.slice(0, limit || SECURITY_ACCESS_LOG_LIMIT_V05422);
}
async function getAllLastSecurityAccessV05422(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffSecurityAccessLog').catch(() => []);
  const map = new Map();
  for (let i = 1; i < values.length; i++) {
    const r = values[i] || [];
    const key = String(r[1] || '');
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || String(r[0] || '') > existing.timestamp) map.set(key, { timestamp: r[0] || '', route: r[3] || '', ip: r[4] || '' });
  }
  return map;
}


// ===================================================================================
// Security Manager events, force-checks, flags, and revoked/inactive list (v05422+)
// ===================================================================================
const SECURITY_EVENT_LOG_LIMIT_V05422 = 50;
const SECURITY_REVOKED_LOG_LIMIT_V05422 = 100;

async function appendSecurityEventV05422(redis, spreadsheetId, staffName, event, detail) {
  try {
    const key = normalizeStaffPortalName(staffName);
    if (!key) return;
    const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffSecurityEventLog').catch(() => []);
    const rows = values.length ? values.slice() : [['Timestamp', 'StaffKey', 'Staff', 'Event', 'Detail']];
    rows.push([new Date().toISOString(), key, staffName, event || '', detail || '']);
    const mine = [];
    const others = [];
    for (let i = 1; i < rows.length; i++) { if (String((rows[i] || [])[1] || '') === key) mine.push(rows[i]); else others.push(rows[i]); }
    await writeRedisSheetValues(redis, spreadsheetId, '_StaffSecurityEventLog', [rows[0]].concat(others, mine.slice(-SECURITY_EVENT_LOG_LIMIT_V05422)));
  } catch (err) { console.warn('[security event log]', err && err.message ? err.message : err); }
}

async function getSecurityEventLogV05422(redis, spreadsheetId, staffName, limit) {
  const key = normalizeStaffPortalName(staffName);
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffSecurityEventLog').catch(() => []);
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i] || [];
    if (String(r[1] || '') === key) rows.push({ timestamp: r[0] || '', staff: r[2] || '', event: r[3] || '', detail: r[4] || '' });
  }
  return rows.reverse().slice(0, limit || SECURITY_EVENT_LOG_LIMIT_V05422);
}

async function appendRevokedInactiveRecordV05422(redis, spreadsheetId, rec) {
  try {
    const staffName = String(rec.staffName || '').trim();
    if (!staffName) return;
    const values = await readRedisSheetValues(redis, spreadsheetId, '_SecurityRevokedInactiveLog').catch(() => []);
    const rows = values.length ? values.slice() : [['Timestamp', 'StaffKey', 'Staff', 'Status', 'Event', 'By']];
    rows.push([new Date().toISOString(), normalizeStaffPortalName(staffName), staffName, rec.status || 'Revoked', rec.event || '', rec.by || 'Admin']);
    await writeRedisSheetValues(redis, spreadsheetId, '_SecurityRevokedInactiveLog', [rows[0]].concat(rows.slice(1).slice(-SECURITY_REVOKED_LOG_LIMIT_V05422)));
  } catch (err) { console.warn('[revoked/inactive log]', err && err.message ? err.message : err); }
}

async function getRevokedInactiveRecordsV05422(redis, spreadsheetId, staffRows, limit) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_SecurityRevokedInactiveLog').catch(() => []);
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i] || [];
    rows.push({ timestamp: r[0] || '', staffName: r[2] || '', status: r[3] || '', event: r[4] || '', by: r[5] || '' });
  }
  rows.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const currentKeys = new Set(rows.map((r) => normalizeStaffPortalName(r.staffName) + '|' + r.status + '|' + r.event));
  (staffRows || []).forEach((s) => {
    if (!s || s.active) return;
    const k = normalizeStaffPortalName(s.name) + '|Inactive|Staff inactive';
    if (!currentKeys.has(k)) rows.push({ timestamp: s.lastAccess && s.lastAccess.timestamp ? s.lastAccess.timestamp : '', staffName: s.name, status: 'Inactive', event: 'Staff inactive', by: 'System' });
  });
  rows.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  return rows.slice(0, limit || SECURITY_REVOKED_LOG_LIMIT_V05422);
}

async function getForcedPasscodeMapV05422(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_SecurityForcedPasscode').catch(() => []);
  const map = new Map();
  for (let i = 1; i < values.length; i++) {
    const r = values[i] || [];
    const key = String(r[0] || '');
    if (key) map.set(key, { staffKey: key, staff: r[1] || '', requestedAt: r[2] || '', completedAt: r[3] || '' });
  }
  return map;
}
async function getForcedPasscodeRowV05422(redis, spreadsheetId, staffName) {
  const map = await getForcedPasscodeMapV05422(redis, spreadsheetId);
  return map.get(normalizeStaffPortalName(staffName)) || null;
}
async function setForcedPasscodeCheckV05422(redis, spreadsheetId, staffName, enabled) {
  const key = normalizeStaffPortalName(staffName);
  const values = await readRedisSheetValues(redis, spreadsheetId, '_SecurityForcedPasscode').catch(() => []);
  const rows = values.length ? values.slice() : [['StaffKey', 'Staff', 'RequestedAt', 'CompletedAt']];
  let found = -1;
  for (let i = 1; i < rows.length; i++) { if (String((rows[i] || [])[0] || '') === key) { found = i; break; } }
  if (enabled) {
    const row = [key, staffName, new Date().toISOString(), ''];
    if (found >= 1) rows[found] = row; else rows.push(row);
  } else if (found >= 1) {
    rows.splice(found, 1);
  }
  await writeRedisSheetValues(redis, spreadsheetId, '_SecurityForcedPasscode', rows);
}
async function completeForcedPasscodeCheckV05422(redis, spreadsheetId, staffName) {
  const key = normalizeStaffPortalName(staffName);
  const values = await readRedisSheetValues(redis, spreadsheetId, '_SecurityForcedPasscode').catch(() => []);
  if (!values.length) return;
  const rows = values.slice();
  for (let i = 1; i < rows.length; i++) {
    if (String((rows[i] || [])[0] || '') === key && !String((rows[i] || [])[3] || '')) rows[i] = [rows[i][0], rows[i][1] || staffName, rows[i][2] || '', new Date().toISOString()];
  }
  await writeRedisSheetValues(redis, spreadsheetId, '_SecurityForcedPasscode', rows);
}

async function getReviewedSecurityFlagsMapV05422(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_SecurityReviewedFlags').catch(() => []);
  const map = new Map();
  for (let i = 1; i < values.length; i++) {
    const r = values[i] || [];
    const key = String(r[0] || '');
    const flagId = String(r[1] || '');
    if (key && flagId) map.set(key + '|' + flagId, String(r[2] || ''));
  }
  return map;
}
async function markSecurityFlagReviewedV05422(redis, spreadsheetId, staffName, flagId) {
  const key = normalizeStaffPortalName(staffName);
  const when = new Date().toISOString();
  const ids = flagId === 'all' ? ['new-device', 'multiple-devices'] : [flagId];
  const values = await readRedisSheetValues(redis, spreadsheetId, '_SecurityReviewedFlags').catch(() => []);
  const rows = values.length ? values.slice() : [['StaffKey', 'FlagId', 'ReviewedAt']];
  ids.forEach((id) => {
    let found = -1;
    for (let i = 1; i < rows.length; i++) { if (String((rows[i] || [])[0] || '') === key && String((rows[i] || [])[1] || '') === id) { found = i; break; } }
    const row = [key, id, when];
    if (found >= 1) rows[found] = row; else rows.push(row);
  });
  await writeRedisSheetValues(redis, spreadsheetId, '_SecurityReviewedFlags', rows);
}
function flagReviewedAfterV05422(reviewedMap, key, flagId, triggeredAt) {
  const reviewedAt = reviewedMap.get(key + '|' + flagId) || '';
  return reviewedAt && (!triggeredAt || String(reviewedAt) >= String(triggeredAt));
}
function computeSecurityFlagsV05422(ctx) {
  const flags = [];
  const devices = ctx.appDevices || [];
  const latestPair = ctx.latestPair || '';
  if (devices.length > 0 && !flagReviewedAfterV05422(ctx.reviewedMap, ctx.key, 'new-device', latestPair)) flags.push({ id: 'new-device', label: 'Opened from new device', severity: 'amber', reviewable: true, triggeredAt: latestPair });
  if (devices.length > 1 && !flagReviewedAfterV05422(ctx.reviewedMap, ctx.key, 'multiple-devices', latestPair)) flags.push({ id: 'multiple-devices', label: 'Opened from multiple devices', severity: 'amber', reviewable: true, count: devices.length, triggeredAt: latestPair });
  if (!ctx.active && ctx.access) flags.push({ id: 'inactive-access', label: 'Portal opened after staff became inactive', severity: 'red', reviewable: false, triggeredAt: ctx.access.timestamp || '' });
  if (devices.length > 0 && ctx.linkStatus === 'revoked') flags.push({ id: 'app-paired-link-revoked', label: 'App paired but portal link revoked', severity: 'red', reviewable: false, count: devices.length });
  if (ctx.active && ctx.passcodePolicy && ctx.passcodePolicy.mode === 'required' && !ctx.hasPasscode) flags.push({ id: 'missing-passcode-required', label: 'Staff has no passcode while passcodes are required', severity: 'amber', reviewable: false });
  return flags;
}

// ===================================================================================
// Passcode / PIN system (v05422). A 4-digit PIN has only 10,000 possibilities -- hashing
// it doesn't change that. The real protection is the 3-attempt lockout on the live
// endpoint below; the hash below is defense-in-depth against a raw database read, not the
// primary defense against guessing.
// ===================================================================================
const PASSCODE_MAX_ATTEMPTS_V05422 = 3;
const PASSCODE_LOCKOUT_MS_V05422 = 15 * 60 * 1000;
const SECURITY_SESSION_TTL_MS_V05422 = 25 * 60 * 1000; // under the 30-minute requirement, with margin
const PASSCODE_RESET_TTL_MS_V05422 = 30 * 60 * 1000;

function hashPasscodeV05422(pin, salt) {
  return crypto.pbkdf2Sync(String(pin || ''), String(salt || ''), 100000, 32, 'sha256').toString('hex');
}
function makeSecuritySessionTokenV05422(school, staffName, secret) {
  const exp = Date.now() + SECURITY_SESSION_TTL_MS_V05422;
  const payload = Buffer.from(JSON.stringify({ s: String(school || ''), n: normalizeStaffPortalName(staffName), e: exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', String(secret || '')).update(payload).digest('base64url');
  return payload + '.' + sig;
}
function verifySecuritySessionTokenV05422(token, school, staffName, secret) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return false;
    const [payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', String(secret || '')).update(payload).digest('base64url');
    if (sig !== expectedSig) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.s !== String(school || '') || data.n !== normalizeStaffPortalName(staffName)) return false;
    if (!data.e || Date.now() > data.e) return false;
    return true;
  } catch (e) { return false; }
}

async function getPasscodePolicyV05422(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_SecurityPasscodePolicy').catch(() => []);
  const row = values[1] || [];
  const mode = String(row[0] || 'disabled').trim();
  const forgotOption = String(row[1] || 'email').trim();
  return {
    mode: ['disabled', 'optional', 'required'].includes(mode) ? mode : 'disabled',
    forgotOption: ['none', 'email'].includes(forgotOption) ? forgotOption : 'email'
  };
}
async function savePasscodePolicyV05422(redis, spreadsheetId, policy) {
  const mode = ['disabled', 'optional', 'required'].includes(policy.mode) ? policy.mode : 'disabled';
  const forgotOption = ['none', 'email'].includes(policy.forgotOption) ? policy.forgotOption : 'email';
  await writeRedisSheetValues(redis, spreadsheetId, '_SecurityPasscodePolicy', [['Mode', 'ForgotOption'], [mode, forgotOption]]);
  return { mode, forgotOption };
}

async function getStaffPasscodeRowV05422(redis, spreadsheetId, staffName) {
  const key = normalizeStaffPortalName(staffName);
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffPasscodes').catch(() => []);
  for (let i = 1; i < values.length; i++) {
    const r = values[i] || [];
    if (String(r[0] || '') === key) return { rowIndex: i, staffKey: key, salt: String(r[1] || ''), hash: String(r[2] || ''), failedAttempts: Number(r[3] || 0) || 0, lockedUntil: String(r[4] || ''), updatedAt: String(r[5] || '') };
  }
  return null;
}
async function setStaffPasscodeV05422(redis, spreadsheetId, staffName, pin) {
  const key = normalizeStaffPortalName(staffName);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPasscodeV05422(pin, salt);
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffPasscodes').catch(() => []);
  const rows = values.length ? values.slice() : [['StaffKey', 'Salt', 'Hash', 'FailedAttempts', 'LockedUntil', 'UpdatedAt']];
  let found = -1;
  for (let i = 1; i < rows.length; i++) { if (String((rows[i] || [])[0] || '') === key) { found = i; break; } }
  const row = [key, salt, hash, 0, '', new Date().toISOString()];
  if (found >= 1) rows[found] = row; else rows.push(row);
  await writeRedisSheetValues(redis, spreadsheetId, '_StaffPasscodes', rows);
}
async function clearStaffPasscodeV05422(redis, spreadsheetId, staffName) {
  const key = normalizeStaffPortalName(staffName);
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffPasscodes').catch(() => []);
  if (!values.length) return;
  const rows = [values[0]].concat(values.slice(1).filter((r) => String((r || [])[0] || '') !== key));
  await writeRedisSheetValues(redis, spreadsheetId, '_StaffPasscodes', rows);
}
async function verifyStaffPasscodeV05422(redis, spreadsheetId, staffName, pin) {
  const row = await getStaffPasscodeRowV05422(redis, spreadsheetId, staffName);
  if (!row) return { ok: false, error: 'No passcode is set for this account.' };
  if (row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now()) {
    return { ok: false, locked: true, error: 'Too many incorrect attempts. Try again later, or use Forgot Passcode.' };
  }
  const match = hashPasscodeV05422(pin, row.salt) === row.hash;
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffPasscodes').catch(() => []);
  const rows = values.slice();
  if (match) {
    rows[row.rowIndex] = [row.staffKey, row.salt, row.hash, 0, '', new Date().toISOString()];
    await writeRedisSheetValues(redis, spreadsheetId, '_StaffPasscodes', rows);
    return { ok: true };
  }
  const attempts = row.failedAttempts + 1;
  const lockedUntil = attempts >= PASSCODE_MAX_ATTEMPTS_V05422 ? new Date(Date.now() + PASSCODE_LOCKOUT_MS_V05422).toISOString() : '';
  rows[row.rowIndex] = [row.staffKey, row.salt, row.hash, attempts, lockedUntil, row.updatedAt];
  await writeRedisSheetValues(redis, spreadsheetId, '_StaffPasscodes', rows);
  if (lockedUntil) return { ok: false, locked: true, error: 'Too many incorrect attempts. Locked for 15 minutes, or use Forgot Passcode.' };
  return { ok: false, remainingAttempts: PASSCODE_MAX_ATTEMPTS_V05422 - attempts, error: 'Incorrect passcode.' };
}

async function createPasscodeResetV05422(redis, spreadsheetId, staffName) {
  const key = normalizeStaffPortalName(staffName);
  const token = crypto.randomBytes(24).toString('base64url');
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffPasscodeResets').catch(() => []);
  const rows = values.length ? values.slice() : [['StaffKey', 'Token', 'ExpiresAt']];
  const kept = rows.slice(1).filter((r) => String((r || [])[0] || '') !== key && new Date(String((r || [])[2] || 0)).getTime() > Date.now());
  const expiresAt = new Date(Date.now() + PASSCODE_RESET_TTL_MS_V05422).toISOString();
  const rebuilt = [rows[0]].concat(kept, [[key, token, expiresAt]]);
  await writeRedisSheetValues(redis, spreadsheetId, '_StaffPasscodeResets', rebuilt);
  return token;
}
async function consumePasscodeResetV05422(redis, spreadsheetId, token) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_StaffPasscodeResets').catch(() => []);
  if (values.length < 2) return null;
  let match = null;
  const remaining = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i] || [];
    const notExpired = new Date(String(r[2] || 0)).getTime() > Date.now();
    if (String(r[1] || '') === token && notExpired) { match = String(r[0] || ''); continue; }
    if (notExpired) remaining.push(r);
  }
  await writeRedisSheetValues(redis, spreadsheetId, '_StaffPasscodeResets', [values[0]].concat(remaining));
  return match;
}


async function readCampusScopedPropertiesFromRedis(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_V5Properties');
  const raw = {};
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const key = String(row[0] || '').trim();
    if (!key) continue;
    raw[key] = String(row[1] == null ? '' : row[1]);
  }
  const out = {};
  const chunkPrefix = '__CHUNKED__:';
  const chunkMark = '::chunk::';
  Object.keys(raw).forEach((key) => {
    if (key.includes(chunkMark)) return;
    const val = raw[key] || '';
    if (val.startsWith(chunkPrefix)) {
      const count = Number(val.substring(chunkPrefix.length)) || 0;
      let combined = '';
      for (let i = 0; i < count; i++) combined += raw[key + chunkMark + ('0000' + i).slice(-4)] || '';
      out[key] = combined;
    } else {
      out[key] = val;
    }
  });
  return out;
}

async function writeCampusScopedPropertiesToRedis(redis, spreadsheetId, props) {
  const stamp = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const rows = [['Key', 'Value', 'Updated']];
  const chunkSize = 45000;
  const chunkPrefix = '__CHUNKED__:';
  const chunkMark = '::chunk::';
  Object.keys(props || {}).sort().forEach((key) => {
    const value = String(props[key] == null ? '' : props[key]);
    if (value.length > chunkSize) {
      const chunks = [];
      for (let i = 0; i < value.length; i += chunkSize) chunks.push(value.substring(i, i + chunkSize));
      rows.push([key, chunkPrefix + chunks.length, stamp]);
      chunks.forEach((chunk, idx) => rows.push([key + chunkMark + ('0000' + idx).slice(-4), chunk, stamp]));
    } else {
      rows.push([key, value, stamp]);
    }
  });
  await redis.set(`gas:spreadsheet:${spreadsheetId}:sheet:_V5Properties:values`, JSON.stringify(rows));
}

async function findStaffRecordAcrossSchools(redis, cfg, staffName) {
  const found = [];
  for (const key of Object.keys((cfg && cfg.schools) || {})) {
    const schoolRec = cfg.schools[key];
    const rec = await findStaffPortalStaffRecord(redis, schoolRec.spreadsheetId, staffName);
    if (rec) found.push({ schoolKey: key, school: schoolRec, record: rec });
  }
  return found;
}

async function selectedSchoolContextForStaffPortalV026(redis, query) {
  try {
    const cfg = await getStaffPortalBootstrapConfig(redis);
    const key = String((query && (query.school || query.schoolId)) || cfg.defaultSchoolId || '').trim();
    const rec = cfg.schools[key];
    if (!rec) return null;
    return { school: key, schoolId: key, selectedCampusId: key, name: rec.name || key, spreadsheetId: rec.spreadsheetId || '' };
  } catch (err) { return null; }
}

async function normalizeStaffPortalQuery(redis, originalQuery) {
  const q = Object.assign({}, originalQuery || {});
  try {
    const cfg = await getStaffPortalBootstrapConfig(redis);
    const requestedSchool = String(q.school || q.schoolId || cfg.defaultSchoolId || '').trim();
    const requestedStaff = String(q.staff || q.staffName || '').trim();
    if (!requestedSchool && cfg.defaultSchoolId) q.school = cfg.defaultSchoolId;
    if (!requestedStaff) return q;
    const schoolRec = cfg.schools[requestedSchool];
    let rec = schoolRec ? await findStaffPortalStaffRecord(redis, schoolRec.spreadsheetId, requestedStaff) : null;
    let finalSchool = requestedSchool;
    let finalSchoolRec = schoolRec;
    if (!rec) {
      const matches = await findStaffRecordAcrossSchools(redis, cfg, requestedStaff);
      const active = matches.filter(m => m.record && m.record.active);
      const pick = active[0] || matches[0];
      if (pick) {
        finalSchool = pick.schoolKey;
        finalSchoolRec = pick.school;
        rec = pick.record;
      }
    }
    if (rec && cfg.tokenSecret && finalSchoolRec) {
      q.school = finalSchool;
      q.staff = rec.name || requestedStaff;
      q.staffName = rec.name || requestedStaff;
      const queryTokenVersion = await getStaffTokenVersionV05421(redis, finalSchoolRec.spreadsheetId, rec.name || requestedStaff);
      q.staffToken = makeStaffPortalToken(finalSchool, rec.name || requestedStaff, cfg.tokenSecret, queryTokenVersion);
      if (!q.view) q.view = 'my';
    }
  } catch (err) {
    console.warn('[staff portal query normalize]', err && err.message ? err.message : err);
  }
  return q;
}

function injectStaffPortalRedisPatch(html, query, options) {
  options = options || {};
  const school = String((query && (query.school || query.schoolId)) || '').trim();
  const staff = String((query && (query.staff || query.staffName)) || '').trim();
  const token = String((query && (query.staffToken || query.token)) || '').trim();
  const mobile = !!options.mobile;
  const patch = `<script>(function(){\n` +
`function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\\"':'&quot;','"':'&quot;'}[c]||c;});}\n`+
`function qs(){return new URLSearchParams({school:${JSON.stringify(school)},staff:${JSON.stringify(staff)},staffToken:${JSON.stringify(token)},_t:String(Date.now())}).toString();}\n`+
`function fillAbsenceNames(){try{var sel=document.querySelector('select[name="staffName"]');if(!sel||sel.options.length>1)return;fetch('/api/staff-portal/active-staff?school='+encodeURIComponent(${JSON.stringify(school)}),{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){var names=(j&&j.activeStaff)||[];if(!sel||!names.length)return;sel.innerHTML='<option value="">Choose</option>'+names.map(function(n){return '<option value="'+esc(n)+'">'+esc(n)+'</option>';}).join('');}).catch(function(){});}catch(e){}}\n`+
`function installTheme(){try{var raw=localStorage.getItem('gaThemeV027')||document.cookie.replace(/(?:(?:^|.*;\\s*)ga_theme\\s*\\=\\s*([^;]*).*$)|^.*$/,'$1')||'light';var dark=raw==='dark'||(raw==='system'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',dark?'dark':'light');}catch(e){}}\n`+
`function freeLabel(loc){loc=String(loc||'').trim();return loc?'Support '+loc:'Support';}
`+
`function replaceFreeLabels(loc){try{var label=freeLabel(loc);if(!label)return;var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(n){var p=n.parentNode;if(!p||/^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION)$/i.test(p.nodeName))return NodeFilter.FILTER_REJECT;return /\bfree\b/i.test(n.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});var nodes=[];while(w.nextNode())nodes.push(w.currentNode);nodes.forEach(function(n){n.nodeValue=String(n.nodeValue).replace(/\bfree\b/gi,label);});}catch(e){}}
`+
`function addMeta(){try{fetch('/api/v027/staff-portal/meta?'+qs(),{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){if(!j||!j.ok)return;document.querySelectorAll('#staffPortalStatusV027,.staffPortalStatusV027,#regularHiddenV027,.staffPortalNoteV027').forEach(function(x){try{x.remove();}catch(e){}});Array.prototype.slice.call(document.querySelectorAll('.card,.box')).forEach(function(c){var t=String(c.textContent||'').replace(/\s+/g,' ').trim();if(/^My Schedule Schedule v\d+/i.test(t)||/Regular Schedule is currently hidden by admin/i.test(t)){try{c.remove();}catch(e){}}});var line=j.scheduleLabel||(j.lastPublishedAt?('Published '+j.lastPublishedAt):'');var sub=document.querySelector('.brand .sub,.top .sub,.sub');if(sub&&line)sub.textContent=line;replaceFreeLabels(j.unassignedSupportLocation||'');var scheduleRoot=null;Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3,.card,.box')).some(function(c){var txt=String(c.textContent||'').trim();if(/^My Schedule(\s|$)/i.test(txt)&&!/Schedule v\d+/i.test(txt)){scheduleRoot=c.closest&&c.closest('.card,.box,section,main>div')||c;return true;}return false;});if(j.changedLines&&j.changedLines.length){var ch=document.getElementById('staffChangesV027');if(!ch){ch=document.createElement('div');ch.id='staffChangesV027';ch.className='staffChangesV027';}ch.innerHTML='<strong>Recent schedule changes</strong><ul>'+j.changedLines.slice(0,8).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>';if(scheduleRoot&&scheduleRoot.parentNode){if(scheduleRoot.nextSibling!==ch)scheduleRoot.parentNode.insertBefore(ch,scheduleRoot.nextSibling);}else document.body.appendChild(ch);}else{var ch2=document.getElementById('staffChangesV027');if(ch2)ch2.remove();}}).catch(function(){});}catch(e){}}\n`+
`function addMobileClass(){try{if(${mobile?'true':'false'})document.documentElement.classList.add('staffMobileV027');}catch(e){}}\n`+
`installTheme();addMobileClass();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){fillAbsenceNames();addMeta();});else{fillAbsenceNames();addMeta();}setTimeout(fillAbsenceNames,500);setTimeout(addMeta,900);\n`+
`})();</script>`;
  const passcodePatch = `<script>(function(){
function c(v){return String(v==null?'':v).trim();}
var SCHOOL=${JSON.stringify(school)},STAFF=${JSON.stringify(staff)},TOKEN=${JSON.stringify(token)},VIEW=${JSON.stringify(String((query && query.view) || ''))},RESET=${JSON.stringify(String((query && query.resetToken) || ''))};
function body(o){return Object.assign({school:SCHOOL,staffName:STAFF,staffToken:TOKEN},o||{});}
function post(u,o){return fetch(u,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body(o))}).then(function(r){return r.json().then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||'Request failed');return j;});});}
function msg(t,k){var m=document.getElementById('ssPasscodeMsgV05423');if(m){m.textContent=t||'';m.className='ssPasscodeMsgV05423 '+(k||'');}}
function attachMask(input){if(!input||input.__maskV05418DG)return;input.__maskV05418DG=true;input.__maskV05418DF=true;input.type='tel';input.inputMode='numeric';input.pattern='[0-9]*';input.maxLength=4;input.autocomplete=input.autocomplete||'one-time-code';input.dataset.pin='';var timer=null;var rendering=false;function digits(v){return String(v==null?'':v).replace(/\D/g,'').slice(0,4);}function render(show){var pin=digits(input.dataset.pin||'');input.dataset.pin=pin;rendering=true;input.value=!pin?'':(show&&pin.length?('*'.repeat(Math.max(0,pin.length-1))+pin.slice(-1)):'*'.repeat(pin.length));rendering=false;if(timer)clearTimeout(timer);if(show)timer=setTimeout(function(){render(false);},650);}function addDigits(txt){var d=digits(txt);if(!d){render(false);return;}var pin=digits(input.dataset.pin||'');input.dataset.pin=(pin+d).slice(0,4);render(true);}input.addEventListener('beforeinput',function(e){if(e.inputType==='deleteContentBackward'){e.preventDefault();input.dataset.pin=digits(input.dataset.pin||'').slice(0,-1);render(false);return;}if(e.inputType==='deleteContentForward'){e.preventDefault();input.dataset.pin='';render(false);return;}if(e.inputType&&e.inputType.indexOf('insert')===0){e.preventDefault();addDigits(e.data||'');return;}});input.addEventListener('keydown',function(e){if(e.ctrlKey||e.metaKey||e.altKey)return;if(/^\d$/.test(e.key)){e.preventDefault();addDigits(e.key);return;}if(e.key==='Backspace'){e.preventDefault();input.dataset.pin=digits(input.dataset.pin||'').slice(0,-1);render(false);return;}if(e.key==='Delete'){e.preventDefault();input.dataset.pin='';render(false);return;}if(['Tab','ArrowLeft','ArrowRight','Home','End','Enter'].indexOf(e.key)>=0)return;e.preventDefault();});input.addEventListener('paste',function(e){e.preventDefault();var txt='';try{txt=(e.clipboardData||window.clipboardData).getData('text')||'';}catch(x){}addDigits(txt);});input.addEventListener('input',function(){if(rendering)return;var v=digits(input.value||'');if(v)input.dataset.pin=v;render(!!v);});render(false);}
function pinOf(input){return String((input&&input.dataset&&input.dataset.pin)||'').replace(/\D/g,'').slice(0,4);}
function overlay(){var el=document.getElementById('ssPasscodeOverlayV05423');if(el)return el;var st=document.createElement('style');st.textContent='html.ssPasscodeLockedV05423 body>*:not(#ssPasscodeOverlayV05423){filter:blur(2px);pointer-events:none;user-select:none}.ssPasscodeOverlayV05423{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:18px}.ssPasscodePanelV05423{width:min(430px,100%);background:#fff;color:#0f172a;border-radius:20px;padding:22px;box-shadow:0 24px 80px rgba(15,23,42,.3);font-family:Arial,Helvetica,sans-serif}.ssPasscodePanelV05423 h2{margin:0 0 8px;font-size:20px}.ssPasscodePanelV05423 p{color:#64748b;font-size:13px;line-height:1.4}.ssPasscodePanelV05423 input{width:100%;box-sizing:border-box;border:1px solid #cfe0f4;border-radius:12px;padding:12px;font-size:20px;letter-spacing:6px;text-align:center;margin-top:8px}.ssPasscodeActionsV05423{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}.ssPasscodePanelV05423 button{border:1px solid #cfd8e6;border-radius:10px;padding:9px 12px;background:#fff;font-family:Arial,Helvetica,sans-serif;font-weight:800;cursor:pointer}.ssPasscodePanelV05423 .primary{background:#2563eb;color:#fff;border-color:#2563eb}.ssPasscodePanelV05423 .danger{background:#dc2626;color:#fff;border-color:#dc2626}.ssPasscodeMsgV05423{min-height:18px;color:#64748b;font-size:12px;margin-top:8px}.ssPasscodeMsgV05423.err{color:#b91c1c}.ssPasscodeSettingsV05423{margin:16px 0 0;padding-top:16px;border-top:1px solid #e5e7eb}.ssPasscodeSettingsV05423 h3{margin:0 0 4px;font-size:15px}.ssPasscodeSettingsV05423 .muted{margin:0 0 10px}.ssPasscodeMainActionsV05423{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ssPasscodeDisableMainV05423{border-color:#fecaca!important;background:#fee2e2!important;color:#991b1b!important}';document.head.appendChild(st);el=document.createElement('div');el.id='ssPasscodeOverlayV05423';el.className='ssPasscodeOverlayV05423';document.body.appendChild(el);return el;}
function closeUnlock(){document.documentElement.classList.remove('ssPasscodeLockedV05423');var el=document.getElementById('ssPasscodeOverlayV05423');if(el)el.remove();}
function panel(kind,required,has){var el=overlay();document.documentElement.classList.toggle('ssPasscodeLockedV05423',!!required);var isDisable=kind==='disable';var title=kind==='verify'?'Enter your Staff Portal passcode':(kind==='reset'?'Reset your Staff Portal passcode':(isDisable?'Disable Staff Portal passcode':'Create your Staff Portal passcode'));var note=kind==='verify'?'This extra step protects your schedule access on shared or saved devices.':(isDisable?'Enter your current 4 digit passcode to disable it.':'Choose a 4 digit passcode. Enter it twice to confirm.');var needsConfirm=kind!=='verify'&&!isDisable;var forgot=(kind==='verify'&&has)?'<button type=button id=ssForgotV05423>Forgot passcode</button>':'';var confirm=needsConfirm?'<input id=ssPinConfirmV05423 maxlength=4 inputmode=numeric autocomplete=one-time-code placeholder="Confirm">':'';el.innerHTML='<div class=ssPasscodePanelV05423><h2>'+title+'</h2><p>'+note+'</p><input id=ssPinV05423 maxlength=4 inputmode=numeric autocomplete=one-time-code placeholder="----">'+confirm+'<div id=ssPasscodeMsgV05423 class=ssPasscodeMsgV05423></div><div class=ssPasscodeActionsV05423>'+forgot+'<button type=button id=ssCancelPassV05423>Cancel</button><button type=button class="'+(isDisable?'danger':'primary')+'" id=ssPassGoV05423>'+(kind==='verify'?'Unlock':(kind==='reset'?'Reset':(isDisable?'Disable':'Save')))+'</button></div></div>';var input=document.getElementById('ssPinV05423');var input2=document.getElementById('ssPinConfirmV05423');attachMask(input);attachMask(input2);setTimeout(function(){try{input.focus();}catch(e){}},60);document.getElementById('ssCancelPassV05423').onclick=function(){if(required)msg('A passcode is required before continuing.','err');else closeUnlock();};document.getElementById('ssPassGoV05423').onclick=function(){var pin=pinOf(input);var pin2=input2?pinOf(input2):pin;if(pin.length!==4){msg('Enter a 4 digit passcode.','err');return;}if(needsConfirm&&pin!==pin2){msg('Passcodes do not match.','err');return;}msg(kind==='verify'?'Checking...':(isDisable?'Disabling...':'Saving...'));var url=kind==='verify'?'/api/v05422/passcode/verify':(kind==='reset'?'/api/v05422/passcode/reset-with-token':(isDisable?'/api/v05422/passcode/disable':'/api/v05422/passcode/set'));var payload=kind==='reset'?{school:SCHOOL,staffName:STAFF,resetToken:RESET,pin:pin}:{pin:pin};post(url,payload).then(function(){msg(isDisable?'Disabled.':'Saved.');closeUnlock();refreshStatus(true);}).catch(function(e){msg(e.message,'err');});};var fb=document.getElementById('ssForgotV05423');if(fb)fb.onclick=function(){msg('Sending reset instructions...');post('/api/v05422/passcode/forgot',{}).then(function(){msg('If email is enabled and an address is on file, reset instructions were sent.');}).catch(function(e){msg(e.message,'err');});};}
function addButton(status){try{if(status.mode==='disabled')return;var modal=document.querySelector('#publicCommPrefsModal .modalBox');if(!modal){setTimeout(function(){addButton(status);},300);return;}var sec=document.getElementById('ssPortalPasscodeSectionV05423');if(!sec){sec=document.createElement('div');sec.id='ssPortalPasscodeSectionV05423';sec.className='ssPasscodeSettingsV05423';sec.innerHTML='<h3>Passcode</h3><p class="muted">Add a 4 digit passcode for extra protection on saved or shared devices.</p><div class="ssPasscodeMainActionsV05423"><button type="button" class="btn" id="ssPortalPasscodeBtnV05423"></button><button type="button" class="btn ssPasscodeDisableMainV05423" id="ssPortalPasscodeDisableBtnV05423" style="display:none">Disable Passcode</button></div>';}var b=sec.querySelector('#ssPortalPasscodeBtnV05423');if(b){b.textContent=status.hasPasscode?'Manage Passcode':'Enable Passcode';b.onclick=function(){panel('set',false,status.hasPasscode);};}var d=sec.querySelector('#ssPortalPasscodeDisableBtnV05423');if(d){d.style.display=(status.hasPasscode&&status.policyMode!=='required')?'':'none';d.onclick=function(){panel('disable',false,true);};}modal.appendChild(sec);}catch(e){}}
function refreshStatus(skipLock){if(!SCHOOL||!STAFF||!TOKEN)return;fetch('/api/v05422/passcode-status?'+new URLSearchParams({school:SCHOOL,staff:STAFF,staffToken:TOKEN,_t:Date.now()}).toString(),{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json();}).then(function(j){if(!j||j.ok===false)return;addButton(j);if(!skipLock&&j.mode==='required')panel(j.hasPasscode?'verify':'set',true,j.hasPasscode);}).catch(function(){});}
function boot(){if(VIEW==='resetPasscode'&&RESET){panel('reset',true,false);return;}refreshStatus(false);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();</script>`;
  const style = `<style>
:root{--ga-bg:#f6f8fb;--ga-card:#fff;--ga-text:#0f172a;--ga-muted:#64748b;--ga-border:#dbe3ef;--ga-primary:#2563eb;--ga-soft:#f8fafc;--ga-ok:#137333;--ga-warn:#a16207;--ga-danger:#b3261e;}
button,.btn,.tab,.tools button,.tools .btn{font-family:Arial,Helvetica,sans-serif!important;font-size:14px!important;font-weight:800!important;line-height:1.1!important;}
html[data-theme="dark"]{--ga-bg:#0f172a;--ga-card:#172033;--ga-text:#f8fafc;--ga-muted:#cbd5e1;--ga-border:#334155;--ga-primary:#60a5fa;--ga-soft:#111827;--ga-ok:#86efac;--ga-warn:#fde68a;--ga-danger:#fca5a5;color-scheme:dark;}
html[data-theme="dark"] body{background:var(--ga-bg)!important;color:var(--ga-text)!important;}html[data-theme="dark"] .card,html[data-theme="dark"] .box,html[data-theme="dark"] .panel,html[data-theme="dark"] main,html[data-theme="dark"] section{background:var(--ga-card)!important;color:var(--ga-text)!important;border-color:var(--ga-border)!important;}html[data-theme="dark"] input,html[data-theme="dark"] select,html[data-theme="dark"] textarea{background:#0b1220!important;color:var(--ga-text)!important;border-color:var(--ga-border)!important;}html[data-theme="dark"] .muted,html[data-theme="dark"] small{color:var(--ga-muted)!important;}
.staffPortalStatusV027{margin:12px auto;padding:12px 14px;border:1px solid var(--ga-border);background:var(--ga-card);border-radius:14px;max-width:980px;display:flex;gap:10px;align-items:center;justify-content:space-between;color:var(--ga-text);box-sizing:border-box}.staffPortalStatusV027 span{color:var(--ga-muted);font-size:13px}.staffPortalStatusV027,#staffPortalStatusV027,.staffPortalNoteV027,#regularHiddenV027{display:none!important}.staffChangesV027{margin:10px 0;padding:10px 12px;border-radius:12px;width:100%;max-width:none;background:var(--ga-soft);border:1px solid var(--ga-border);color:var(--ga-text);box-sizing:border-box}.staffChangesV027 ul{margin:6px 0 0 18px;padding:0}.staffMobileV027 body{font-size:16px}.staffMobileV027 .staffPortalStatusV027{position:sticky;top:0;z-index:50;border-radius:0;margin:0;max-width:none}.staffMobileV027 table{font-size:14px}.staffMobileV027 button,.staffMobileV027 input,.staffMobileV027 select{min-height:42px}.staffMobileV027 .card,.staffMobileV027 .box{border-radius:14px!important;margin:10px!important;width:auto!important;max-width:none!important}
</style>`;
  let out = String(html || '');
  if (!/<title>/i.test(out)) out = out.replace(/<head([^>]*)>/i, '<head$1><title>Staff Portal - Support Schedules</title>' + style);
  else out = out.replace(/<title>.*?<\/title>/i, '<title>Staff Portal - Support Schedules</title>' + style);
  return out.replace('</body>', patch + passcodePatch + '</body>');
}

function ctxPublicV027(ctx) {
  return { school: ctx.school, schoolId: ctx.school, schoolName: ctx.schoolName || ctx.school, spreadsheetId: ctx.spreadsheetId, schoolGuard: ctx.guard || 'validated' };
}

function resolveCanonicalSchoolKeyV040_(cfg, rawSchool, spreadsheetId) {
  const schools = (cfg && cfg.schools) || {};
  const raw = String(rawSchool || '').trim();
  const ss = String(spreadsheetId || '').trim();
  const canonicalFromKey = (key) => {
    const rec = schools[key];
    if (!rec) return '';
    const aliasFor = String(rec.aliasFor || '').trim();
    return aliasFor && schools[aliasFor] ? aliasFor : key;
  };
  if (raw && schools[raw]) return canonicalFromKey(raw);
  if (raw && schools[raw.toLowerCase()]) return canonicalFromKey(raw.toLowerCase());
  if (ss) {
    const found = Object.keys(schools).find(k => String(schools[k] && schools[k].spreadsheetId || '') === ss);
    if (found) return canonicalFromKey(found);
  }
  const compact = compactAliasV015_(raw);
  if (compact && schools[compact]) return canonicalFromKey(compact);
  if (compact) {
    for (const key of Object.keys(schools)) {
      const rec = schools[key] || {};
      const candidates = [key, rec.id, rec.name, rec.spreadsheetId, rec.aliasFor];
      for (const c of candidates) {
        if (compactAliasV015_(c) === compact) return canonicalFromKey(key);
      }
    }
  }
  return raw;
}

async function resolveSchoolContextV027(redis, req, source, options = {}) {
  source = source || {};
  const cfg = await getStaffPortalBootstrapConfig(redis);
  const requestedSchool = String(source.school || source.schoolId || source.selectedCampusId || source.campusId || '').trim();
  const spreadsheetId = String(source.spreadsheetId || source.selectedSpreadsheetId || source.ssId || '').trim();
  let school = resolveCanonicalSchoolKeyV040_(cfg, requestedSchool, spreadsheetId);
  if (!school) school = resolveCanonicalSchoolKeyV040_(cfg, cfg.defaultSchoolId || '', spreadsheetId);
  if (!school && options.allowNoSchool) return null;
  const schoolRec = (cfg.schools || {})[school];
  if (!schoolRec) {
    const known = Object.keys(cfg.schools || {}).slice(0, 25).join(', ');
    throw new Error('School Data Guard: unknown selected school key: ' + (requestedSchool || school || '(blank)') + '. Known keys include: ' + known + '.');
  }
  if (spreadsheetId && String(schoolRec.spreadsheetId || '') !== spreadsheetId) throw new Error('School Data Guard: selected school does not match the selected data store. Refusing to continue.');
  const userEmail = getRequestUserEmail(req);
  const access = await schoolAccessStatusV027(redis, userEmail, school, schoolRec.spreadsheetId);
  if (!access.allowed) throw new Error('School Data Guard: this account is not allowed to access the selected school.');
  return { school, requestedSchool: requestedSchool || school, schoolName: schoolRec.name || school, schoolRec, spreadsheetId: schoolRec.spreadsheetId, userEmail, access, guard: 'validated' };
}


async function schoolAccessStatusV027(redis, email, school, spreadsheetId) {
  email = String(email || '').trim().toLowerCase();
  if (!isAuthEnabled()) return { allowed: true, reason: 'auth disabled' };
  if (isEmailAllowedByEnv(email)) return { allowed: true, reason: 'environment access' };
  const rows = await readAllCampusUserRows(redis);
  if (!rows.length && !hasEnvAccessGate_()) return { allowed: true, reason: 'bootstrap access' };
  for (const row of rows) {
    const rec = parseCampusUserRowV0541_(row);
    if (rec.email !== email) continue;
    const role = String(rec.role || '').trim().toLowerCase();
    const campus = String(rec.campus || '').trim().toLowerCase();
    const status = String(rec.status || 'Active').trim().toLowerCase();
    if (status === 'inactive' || status === 'disabled' || status === 'archived') continue;
    if (role === 'district' || role === 'owner' || role === 'admin' || role === 'administrator') return { allowed: true, reason: 'district/admin access' };
    const tokens = campus.split(/[;,|]/).map(x => x.trim()).filter(Boolean);
    if (!tokens.length || tokens.includes('*') || tokens.includes(String(school).toLowerCase()) || tokens.includes(String(spreadsheetId).toLowerCase())) return { allowed: true, reason: 'site access' };
  }
  return { allowed: false, reason: 'no matching active school access' };
}

async function validateSelectedSchoolForRunV027(redis, req, selectedSchoolForRun, functionName, rawArgs) {
  const fn = String(functionName || '');
  let src = selectedSchoolForRun || {};
  if ((!src || !Object.keys(src).length) && Array.isArray(rawArgs) && rawArgs[0] && typeof rawArgs[0] === 'object' && !Array.isArray(rawArgs[0])) {
    src = rawArgs[0]._selectedSchool || rawArgs[0];
  }
  const mustGuard = (isPotentialWriteFunctionV027(fn) || (typeof isSchoolScopedReadFunctionV05418DJ === 'function' && isSchoolScopedReadFunctionV05418DJ(fn)) || /save|update|delete|create|clear|publish|generate|run|email|send|import|replace|stabilize|setup/i.test(fn)) && !isSystemAdminFunctionV027(fn);
  if (!src || !Object.keys(src).length) {
    if (mustGuard) throw new Error('School Data Guard: this action did not include a selected school context. Refusing to continue.');
    return null;
  }
  const ctx = await resolveSchoolContextV027(redis, req, src);
  return { ctx, public: ctxPublicV027(ctx) };
}

function isPotentialWriteFunctionV027(functionName) {
  return /save|update|delete|create|clear|publish|generate|run|email|send|import|replace|stabilize|setup|write|set|sync|assign/i.test(String(functionName || ''));
}
function isSystemAdminFunctionV027(functionName) {
  return /CampusV5|CampusV525|CampusUser|MultiCampus|UserEmulation|PortalSecurity|verifyPortalPasscode|getCampusSelector|setSelectedCampus|clearUserEmulation|setUserEmulation/i.test(String(functionName || ''));
}
function summarizeResultV027(result) {
  if (!result) return '';
  if (typeof result === 'string') return result.slice(0, 240);
  if (result.message) return String(result.message).slice(0, 240);
  if (result.ok === false && result.error) return String(result.error).slice(0, 240);
  try { return JSON.stringify(result).slice(0, 240); } catch { return ''; }
}

async function appendAdminActivityLogV027(redis, spreadsheetId, action, target, userEmail, detail) {
  if (!spreadsheetId) return;
  let values = await readRedisSheetValues(redis, spreadsheetId, '_AdminActivityLog');
  if (!values.length) values = [['Timestamp','Action','Target','User','Detail','Version']];
  values.push([new Date().toISOString(), String(action || ''), String(target || ''), String(userEmail || ''), String(detail || ''), VERSION]);
  if (values.length > 1500) values = [values[0]].concat(values.slice(-1499));
  await writeRedisSheetValues(redis, spreadsheetId, '_AdminActivityLog', values);
}

async function getAdminActivityLogV027(redis, spreadsheetId, limit) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_AdminActivityLog');
  const rows = (values || []).slice(1).map(r => ({ timestamp: String(r[0] || ''), action: String(r[1] || ''), target: String(r[2] || ''), user: String(r[3] || ''), detail: String(r[4] || ''), version: String(r[5] || '') })).reverse().slice(0, limit || 75);
  return { rows, count: rows.length };
}

async function getCommunicationLogV027(redis, spreadsheetId, limit) {
  const values = await readRedisSheetValues(redis, spreadsheetId, '_ScheduleCommunicationLog');
  const rows = (values || []).slice(1).map(r => ({ timestampRaw: String(r[0] || ''), timestamp: formatDateTimeV027(r[0] || ''), publishedAtRaw: String(r[1] || ''), publishedAt: formatDateTimeV027(r[1] || ''), scheduleHash: String(r[2] || ''), mode: String(r[3] || ''), staff: String(r[4] || ''), modality: String(r[5] || ''), recipient: String(r[6] || ''), status: String(r[7] || ''), message: String(r[8] || ''), sentBy: String(r[9] || ''), version: String(r[10] || '') })).reverse().slice(0, limit || 75);
  // Enrich with open/click tracking (works for any tracked communication type, not just
  // schedule-share, since the webhook now accepts every type -- see brevo-webhook-v05418q).
  const tracked = await listBrevoStaffEmailStatusesV05418Q(redis, { school: '', limit: 500 }).catch(() => []);
  const trackedByKey = new Map();
  tracked.forEach((t) => { if (t.spreadsheetId === spreadsheetId) trackedByKey.set(String(t.email || '').toLowerCase() + '|' + String(t.sentAt || ''), t); });
  rows.forEach((r) => {
    if (r.modality !== 'Email' && r.modality !== 'Brevo Email') return;
    const emails = String(r.recipient || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    const matches = emails.map((e) => trackedByKey.get(e + '|' + r.timestampRaw)).filter(Boolean);
    if (!matches.length) return;
    r.opened = matches.some((m) => !!m.firstOpenedAt);
    r.openedAt = (matches.find((m) => m.firstOpenedAt) || {}).firstOpenedAt || '';
    r.tracked = true;
  });
  const access = await buildStaffPortalAccessSummaryV027(redis, spreadsheetId);
  return { rows, count: rows.length, portalAccess: access.staff || [] };
}

async function buildSettingsAuditV027(redis, req, ctx) {
  const props = await readCampusScopedPropertiesFromRedis(redis, ctx.spreadsheetId);
  const comm = await getCommunicationSettingsV018(redis, ctx.spreadsheetId);
  const reg = await buildRegularScheduleV022(redis, ctx.spreadsheetId).catch(() => ({}));
  const version = await getScheduleVersionV027(redis, ctx.spreadsheetId).catch(() => ({}));
  const diagnostics = await buildDiagnosticsV027(redis, req, ctx).catch(err => ({ diagnosticsError: err.message }));
  const keys = [
    ['Regular Schedule on Staff Portal', reg.displayOnStaffPortal ? 'Yes' : 'No', 'V5_DISPLAY_REGULAR_ON_STAFF_PORTAL'],
    ['Show Badges', props.V5_SHOW_BADGES || props.SHOW_BADGES || '(default)', 'V5_SHOW_BADGES'],
    ['Communication Workflow', comm.enabled ? 'Enabled' : 'Disabled', 'V686M26_COMM_ENABLED'],
    ['Email Communication', comm.emailEnabled ? 'Enabled' : 'Disabled', 'V686M26_COMM_EMAIL_ENABLED'],
    ['Email Sender Name', comm.emailFromName || '', 'V686M26_COMM_EMAIL_FROM_NAME'],
    ['Last Data Refresh', props.V5_FOLDER_DATES_LAST_REFRESH || 'Not recorded', 'V5_FOLDER_DATES_LAST_REFRESH'],
    ['School Year Start', props.V5_SCHOOL_YEAR_START_DATE || 'Not set', 'V5_SCHOOL_YEAR_START_DATE'],
    ['Published Schedule', version.label || 'Not published', 'V5_PUBLISHED_AT'],
    ['School Data Guard', 'Validated', 'runtime']
  ];
  return { settings: keys.map(([label, value, key]) => ({ label, value, key })), diagnostics };
}

async function buildDiagnosticsV027(redis, req, ctx) {
  const token = await getRequestGoogleAccessToken(req);
  const authUser = getRequestUser(req);
  const redisMode = redis && redis.isMemory ? 'memory' : 'redis';
  const out = { authEnabled: isAuthEnabled(), userEmail: (authUser && authUser.email) || getRequestUserEmail(req) || '', googleAccessTokenPresent: !!token, googleDriveFormsScopeLikely: !!token, redisMode, redisPersistent: redisMode === 'redis', selectedSchoolValidated: !!ctx, schoolAccessReason: ctx && ctx.access && ctx.access.reason || '' };
  if (token) {
    try {
      const params = new URLSearchParams({ pageSize: '1', q: "mimeType = 'application/vnd.google-apps.form' and trashed = false", fields: 'files(id,name)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
      const json = await fetchGoogleJsonV026(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, token, 'Google Drive Forms access check');
      out.googleFormsSearchOk = true; out.googleFormsSampleCount = (json.files || []).length;
    } catch (err) { out.googleFormsSearchOk = false; out.googleFormsError = err.message; }
  } else { out.googleFormsSearchOk = false; out.googleFormsError = 'No Google access token available.'; }
  return out;
}


async function diagnoseGoogleFormAccessV05418F(redis, spreadsheetId, accessToken, opts, userEmail) {
  const values = await readRedisSheetValues(redis, spreadsheetId, 'Students');
  const headers = Array.isArray(values[0]) ? values[0] : [];
  const colName = findHeaderIndex_(headers, ['name','student','student name'], 0);
  const colUrl = findHeaderIndex_(headers, ['data files','data file','data files url','data file url'], 36);
  const colPoints = findHeaderIndex_(headers, ['data points','data point count'], 37);
  const colUpdated = findHeaderIndex_(headers, ['data files last updated','data file last updated','last updated'], 38);
  const wantedRow = Number((opts && (opts.rowIndex || opts.row)) || 0);
  const limit = Math.max(1, Math.min(25, Number((opts && opts.limit) || 10)));
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const rowIndex = i + 1;
    if (wantedRow && wantedRow !== rowIndex) continue;
    const student = String(row[colName] || '').trim();
    const url = String(row[colUrl] || '').trim();
    if (!url) continue;
    rows.push({ rowIndex, student, url, points: String(row[colPoints] || ''), lastUpdated: String(row[colUpdated] || '') });
    if (!wantedRow && rows.length >= limit) break;
  }
  const out = { userEmail: String(userEmail || ''), tokenPresent: !!accessToken, tokenSource: accessToken ? 'session-or-env' : 'missing', checked: [] };
  if (!accessToken) {
    out.summary = 'No Google access token was available to the server for this session.';
    out.checked = rows.map(r => Object.assign({}, r, { ok: false, stage: 'auth', error: 'No Google access token available.' }));
    return out;
  }
  for (const r of rows) {
    const rec = Object.assign({}, r, { ok: false, formId: extractGoogleFormIdV025(r.url) || extractGoogleFormIdV026(r.url) || '' });
    if (!rec.formId) {
      rec.stage = 'parse'; rec.error = 'Could not extract a Google Form ID from the saved URL.'; out.checked.push(rec); continue;
    }
    try {
      const metaUrl = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(rec.formId) + '?fields=id,name,mimeType,capabilities/canReadRevisions,capabilities/canEdit,capabilities/canComment,owners(displayName,emailAddress),webViewLink&supportsAllDrives=true';
      const meta = await fetchGoogleJsonV026(metaUrl, accessToken, 'Drive metadata for form');
      rec.driveOk = true;
      rec.driveName = meta.name || '';
      rec.mimeType = meta.mimeType || '';
      rec.canEdit = !!(meta.capabilities && meta.capabilities.canEdit);
      rec.owner = (meta.owners && meta.owners[0] && (meta.owners[0].emailAddress || meta.owners[0].displayName)) || '';
    } catch (err) {
      rec.driveOk = false;
      rec.driveError = err.message || String(err);
    }
    try {
      const formUrl = 'https://forms.googleapis.com/v1/forms/' + encodeURIComponent(rec.formId);
      const form = await fetchGoogleJsonV026(formUrl, accessToken, 'Forms metadata');
      rec.formsMetadataOk = true;
      rec.formTitle = (form.info && form.info.title) || '';
    } catch (err) {
      rec.formsMetadataOk = false;
      rec.formsMetadataError = err.message || String(err);
    }
    try {
      const qs = new URLSearchParams({ pageSize: '1' });
      const resUrl = 'https://forms.googleapis.com/v1/forms/' + encodeURIComponent(rec.formId) + '/responses?' + qs.toString();
      const responses = await fetchGoogleJsonV026(resUrl, accessToken, 'Forms responses');
      rec.responsesOk = true;
      rec.sampleResponseCount = (responses.responses || []).length;
      rec.nextPageTokenPresent = !!responses.nextPageToken;
      rec.ok = true;
      rec.stage = 'responses';
    } catch (err) {
      rec.responsesOk = false;
      rec.responsesError = err.message || String(err);
      rec.stage = 'responses';
      rec.error = rec.responsesError;
    }
    out.checked.push(rec);
  }
  const failures = out.checked.filter(r => !r.ok);
  out.summary = failures.length ? (failures.length + ' form(s) failed response access diagnostics.') : 'All checked forms allowed response access.';
  return out;
}

async function getDataFileStatusV027(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, 'Students');
  if (!values.length) return { rows: [], summary: { total: 0, connected: 0, needsAttention: 0, lastRefresh: '' } };
  const headers = Array.isArray(values[0]) ? values[0] : [];
  const colName = findHeaderIndex_(headers, ['name','student','student name'], 0);
  const colUrl = findHeaderIndex_(headers, ['data files','data file','data files url','data file url'], 36);
  const colPoints = findHeaderIndex_(headers, ['data points','data point count'], 37);
  const colUpdated = findHeaderIndex_(headers, ['data files last updated','data file last updated','last updated'], 38);
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const student = String(row[colName] || '').trim();
    if (!student) continue;
    const url = String(row[colUrl] || '').trim();
    if (!url) continue;
    const points = String(row[colPoints] || '').trim();
    const lastUpdated = String(row[colUpdated] || '').trim();
    let status = 'No form linked', severity = 'warn';
    if (url && /Form Access Error/i.test(lastUpdated)) { status = 'Needs permission'; severity = 'error'; }
    else if (url && !/docs\.google\.com\/forms/i.test(url)) { status = 'Review link'; severity = 'warn'; }
    else if (url && !lastUpdated) { status = 'Connected; needs refresh'; severity = 'warn'; }
    else if (url) { status = 'Connected'; severity = 'ok'; }
    rows.push({ rowIndex: i + 1, student, url, points, lastUpdated, status, severity });
  }
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId);
  const connected = rows.filter(r => r.severity === 'ok').length;
  return { rows, summary: { total: rows.length, connected, needsAttention: rows.length - connected, lastRefresh: props.V5_FOLDER_DATES_LAST_REFRESH || '' } };
}


// Fixes the reported "published time off by 7-8 hours" bug: V5_PUBLISHED_AT is stored as an
// already-Pacific-formatted string with no timezone marker (e.g. "7/3/2026 2:37 PM", written
// by Utilities.formatDate(new Date(), 'America/Los_Angeles', ...) at every publish site). A
// naive `new Date(string)` misinterprets that as server-local time (UTC on most hosts), and
// formatting THAT to Pacific again applies the offset twice. This recognizes that specific
// "M/d/yyyy h:mm a" pattern and reverses it back to the true UTC instant, DST-aware -- and
// falls back to plain native parsing for anything else (genuine ISO/UTC strings, e.g.
// _StaffPortalAccessLatest's "Last Viewed" column, which was never affected by this bug and
// must keep working exactly as before).
function parseDateLooseV027(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (m) {
    let mo = Number(m[1]), da = Number(m[2]), yr = Number(m[3]), hr = Number(m[4]), mi = Number(m[5]), se = Number(m[6] || 0);
    let ap = m[7];
    if (ap) { ap = ap.toUpperCase(); if (ap === 'PM' && hr !== 12) hr += 12; if (ap === 'AM' && hr === 12) hr = 0; }
    try {
      const guessUtc = Date.UTC(yr, mo - 1, da, hr, mi, se);
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(guessUtc));
      const get = (t) => Number((parts.find(p => p.type === t) || {}).value);
      const asIfPacific = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
      const offsetMs = guessUtc - asIfPacific;
      const d = new Date(guessUtc + offsetMs);
      return Number.isNaN(d.getTime()) ? null : d;
    } catch (e) { /* fall through to native parsing below */ }
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function localDateKeyV027(value) {
  const d = value instanceof Date ? value : parseDateLooseV027(value);
  if (!d) return '';
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); } catch { return d.toISOString().slice(0, 10); }
}
function formatDateTimeV027(value) {
  const d = value instanceof Date ? value : parseDateLooseV027(value);
  if (!d) return String(value || '');
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: '2-digit', day: '2-digit', year: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(d);
    const get = (type) => (parts.find(p => p.type === type) || {}).value || '';
    return `${get('month')}-${get('day')}-${get('year')} ${get('hour')}:${get('minute')} ${get('dayPeriod')}`.trim();
  } catch {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    let h = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}-${dd}-${yy} ${h}:${min} ${ap}`;
  }
}

async function getScheduleVersionV027(redis, spreadsheetId) {
  const model = await getPublishedScheduleModelV018(redis, spreadsheetId);
  const publishedAt = model.publishedAt || '';
  const dateKey = localDateKeyV027(publishedAt);
  const propDate = String((model.props && model.props.V5_PUBLISHED_VERSION_DATE) || '').trim();
  const propCount = Number((model.props && model.props.V5_PUBLISHED_VERSION_COUNT) || 0) || 0;
  let versionNum = 0;
  if (propDate && propDate === dateKey && propCount > 0) {
    // Same shared property the main portal's own Publish flow writes to -- using this
    // directly, rather than an independently-counted total, is what keeps the two
    // in sync instead of drifting apart whenever a publish goes through a path that
    // only updates one of them.
    versionNum = propCount;
  } else {
    const history = await readRedisSheetValues(redis, spreadsheetId, '_ScheduleHistory');
    let matchingRow = 0;
    for (let i = 1; i < history.length; i++) {
      const row = Array.isArray(history[i]) ? history[i] : [];
      const rowDateKey = localDateKeyV027(row[1]);
      if (!dateKey || rowDateKey !== dateKey) continue;
      versionNum++;
      const rowHash = String(row[4] || '').trim();
      if ((model.hash && rowHash && rowHash === model.hash) || String(row[1] || '').trim() === String(publishedAt || '').trim()) matchingRow = versionNum;
    }
    if (matchingRow) versionNum = matchingRow;
  }
  if (!versionNum && publishedAt) versionNum = 1;
  const label = publishedAt ? `Schedule v${versionNum || 1} — Published ${formatDateTimeV027(publishedAt)}` : 'No published schedule';
  return { publishedAt, hash: model.hash || '', dailyVersion: versionNum || 0, dateKey, label, versionLabel: versionNum ? ('v' + versionNum) : '' };
}


function hasNowRowsV05418EI(now) {
  return !!(now && ((Array.isArray(now.staffRows) && now.staffRows.length) || (Array.isArray(now.studentRows) && now.studentRows.length)));
}
function safeJsonV05418EI(raw, fallback) { try { return JSON.parse(String(raw || '')); } catch (_) { return fallback; } }
function laNowPartsV05418EI() {
  const d = new Date();
  let hour = 0, minute = 0, label = '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(d);
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    hour = Number(map.hour || 0) || 0;
    minute = Number(map.minute || 0) || 0;
    if (hour === 24) hour = 0;
  } catch (_) { hour = d.getHours(); minute = d.getMinutes(); }
  try { label = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', hour12: true }).format(d); } catch (_) { label = `${hour}:${String(minute).padStart(2, '0')}`; }
  return { hour, minute, minutes: hour * 60 + minute, timeLabel: label };
}
function normKeyV05418EI(v) { return String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function timeToMinutesLooseV05418EI(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})(?:\s*[:.]\s*|\s+)(\d{2})\s*([AP]\.?M\.?)?/i) || raw.match(/\b(\d{1,2})\s*([AP]\.?M\.?)\b/i);
  if (!m) return null;
  let h = Number(m[1]);
  let min = m[2] && /^\d{2}$/.test(m[2]) ? Number(m[2]) : 0;
  const ap = String(m[3] || (m[2] && /[AP]/i.test(m[2]) ? m[2] : '')).toUpperCase().replace(/\./g, '');
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}
function rangeFromTextV05418EI(text) {
  const raw = String(text == null ? '' : text);
  const matches = [];
  const re = /(\d{1,2})(?:\s*[:.]\s*|\s+)(\d{2})\s*([AP]\.?M\.?)?/ig;
  let m;
  while ((m = re.exec(raw)) && matches.length < 4) {
    matches.push({ text: m[0], index: m.index, hour: Number(m[1]), min: Number(m[2]), ap: String(m[3] || '').toUpperCase().replace(/\./g, '') });
  }
  if (matches.length < 2) return null;
  // Fill a missing AM/PM from the nearest explicit peer in the same range.
  for (let i = 0; i < matches.length; i++) if (!matches[i].ap) matches[i].ap = (matches[i + 1] && matches[i + 1].ap) || (matches[i - 1] && matches[i - 1].ap) || '';
  const a = timeToMinutesLooseV05418EI(`${matches[0].hour}:${String(matches[0].min).padStart(2, '0')} ${matches[0].ap}`);
  const b = timeToMinutesLooseV05418EI(`${matches[1].hour}:${String(matches[1].min).padStart(2, '0')} ${matches[1].ap}`);
  if (a == null || b == null || b <= a) return null;
  return { start: a, end: b };
}
function formatMinutesV05418EI(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  let h = Math.floor(n / 60); const m = n % 60; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}
function itemKeyV05418EI(it) { return typeof it === 'string' ? it : String((it && (it.key || it.item || it.period || it.label || it.title || it.displayName)) || ''); }
function itemLabelV05418EI(it) { return typeof it === 'string' ? it : String((it && (it.title || it.displayName || it.label || it.period || it.item || it.key)) || ''); }
function itemRangeV05418EI(it) {
  if (!it) return null;
  if (typeof it === 'object') {
    const start = Number(it.startMinutes != null ? it.startMinutes : it.startMinute);
    const end = Number(it.endMinutes != null ? it.endMinutes : it.endMinute);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) return { start, end };
    const direct = rangeFromTextV05418EI([it.startTime, it.endTime].filter(Boolean).join(' - '));
    if (direct) return direct;
  }
  const text = typeof it === 'string' ? it : [it.title, it.label, it.displayName, it.time, it.timeLabel, it.period, it.item, it.key].filter(Boolean).join(' ');
  return rangeFromTextV05418EI(text);
}
function findScheduleRowV05418EI(rows, it) {
  rows = Array.isArray(rows) ? rows : [];
  const wanted = [itemKeyV05418EI(it), itemLabelV05418EI(it)].map(normKeyV05418EI).filter(Boolean);
  for (const r of rows) {
    const p = normKeyV05418EI(r && (r.period || r.item || r.label || r.title || r.displayName || ''));
    if (p && wanted.includes(p)) return r || {};
  }
  return {};
}
function splitActiveAtV05418EI(obj, minutes) {
  obj = obj || {};
  const s = Number(obj.splitStartMinutes != null ? obj.splitStartMinutes : obj.startMinutes);
  const e = Number(obj.splitEndMinutes != null ? obj.splitEndMinutes : obj.endMinutes);
  if (Number.isFinite(s) && Number.isFinite(e) && e > s) return minutes >= s && minutes < e;
  return true;
}
function scheduleViewsFromPublishedPropsV05418EI(props) {
  props = props || {};
  const published = safeJsonV05418EI(props.V5_PUBLISHED_SCHEDULE_JSON || '', null);
  if (published && ((published.staffSchedules || []).length || (published.studentSchedules || []).length || (published.breakItems || []).length)) {
    published.publishedAt = published.publishedAt || props.V5_PUBLISHED_AT || props.V5_WORKING_SCHEDULE_SAVED_AT || '';
    return { views: published, source: 'published' };
  }
  // If the working snapshot is explicitly marked as the published/live copy, it is safe for Now.
  const mode = String(props.V5_WORKING_SCHEDULE_MODE || '').toLowerCase().trim();
  const working = mode === 'published' ? safeJsonV05418EI(props.V5_WORKING_SCHEDULE_JSON || '', null) : null;
  if (working && ((working.staffSchedules || []).length || (working.studentSchedules || []).length || (working.breakItems || []).length)) {
    working.publishedAt = working.publishedAt || props.V5_PUBLISHED_AT || props.V5_WORKING_SCHEDULE_SAVED_AT || '';
    return { views: working, source: 'working-published' };
  }
  return { views: null, source: 'empty' };
}
function buildScheduleNowFromPublishedViewsV05418EI(views, source) {
  views = views || {};
  const items = (Array.isArray(views.items) ? views.items : []).slice().sort((a, b) => {
    const ar = itemRangeV05418EI(a) || {}; const br = itemRangeV05418EI(b) || {};
    return (ar.start == null ? 99999 : ar.start) - (br.start == null ? 99999 : br.start);
  });
  const now = laNowPartsV05418EI();
  let current = null, status = 'Now', next = null;
  for (const it of items) { const r = itemRangeV05418EI(it); if (r && now.minutes >= r.start && now.minutes < r.end) { current = it; break; } }
  if (!current && items.length) {
    const future = items.find(it => { const r = itemRangeV05418EI(it); return r && now.minutes < r.start; });
    next = future || null;
    return { ok: true, version: VERSION, status: 'outside-hours', unavailableReason: 'Current time is outside active schedule hours.', item: '', itemTitle: 'Now', timeLabel: now.timeLabel, nextLabel: future ? itemLabelV05418EI(future) : '', staffRows: [], studentRows: [], source: source || 'published-server-fallback' };
  }
  if (current) {
    const cr = itemRangeV05418EI(current) || {};
    next = items.find(it => { const r = itemRangeV05418EI(it); return r && cr.start != null && r.start > cr.start; }) || null;
  } else {
    return { ok: true, version: VERSION, status: 'outside-hours', unavailableReason: 'Current time is outside active schedule hours.', item: '', itemTitle: 'Now', timeLabel: now.timeLabel, nextLabel: '', staffRows: [], studentRows: [], source: source || 'published-server-fallback' };
  }
  const currentLabel = current ? itemLabelV05418EI(current) : '';
  const currentKey = current ? itemKeyV05418EI(current) : '';
  const title = currentLabel || currentKey || 'Schedule';
  const staffRows = (Array.isArray(views.staffSchedules) ? views.staffSchedules : []).map(s => {
    const r = findScheduleRowV05418EI(s.rows || [], current || currentKey || currentLabel) || {};
    const allStudents = Array.isArray(r.students) ? r.students : [];
    const activeStudents = allStudents.filter(st => splitActiveAtV05418EI(st, now.minutes));
    const rest = Array.isArray(r.restEvents) && r.restEvents.length ? r.restEvents.map(ev => {
      ev = ev || {};
      return ev.role === 'cover' ? ('Covering ' + (ev.staffOnBreak || 'staff') + (ev.time ? ' · ' + ev.time : '')) : ((String(ev.type || '').toLowerCase().includes('lunch') ? 'Lunch' : 'Break') + (ev.time ? ' · ' + ev.time : ''));
    }).join(' / ') : '';
    const students = activeStudents.map(st => st.name || st.student || st.displayName || '').filter(Boolean).join(', ');
    let st = r.status === 'timeBlocked' || r.status === 'timeblocked' ? 'Time Blocked' : (students ? students : (rest || (r.seeLead ? 'See Lead' : 'Free')));
    const detailParts = [];
    if (r.location) detailParts.push(String(r.location));
    const splitLabels = activeStudents.map(st => st.splitWindowCaption || st.splitWindowLabel || '').filter(Boolean);
    if (splitLabels.length) detailParts.push(splitLabels.join(' + '));
    return { staff: s.staff || s.name || '', status: st, detail: detailParts.join(' · ') };
  }).filter(x => x.staff);
  const studentRows = (Array.isArray(views.studentSchedules) ? views.studentSchedules : []).map(stu => {
    const r = findScheduleRowV05418EI(stu.rows || [], current || currentKey || currentLabel) || {};
    if (r && r.splitPeriodSupport && !splitActiveAtV05418EI(r, now.minutes)) {
      return { student: stu.student || stu.name || '', url: stu.url || stu.dataFileUrl || stu.dataFiles || '', location: '', support: 'Free outside split window', coveredBy: 'No support scheduled now' };
    }
    const support = String(r.support || r.supportType || '').trim();
    const location = String(r.location || '').trim();
    const sNorm = support.toUpperCase(); const lNorm = location.toUpperCase();
    const noSupport = !support || sNorm === 'N/A' || sNorm === 'NA' || sNorm === 'NONE' || sNorm.startsWith('NO SUPPORT');
    const noLocation = !location || lNorm === 'N/A' || lNorm === 'NA';
    const hasNeed = !noSupport && !noLocation;
    let covered = r.staff || (r.allowedUnstaffed ? 'Allowed unstaffed (Optimization)' : (hasNeed ? 'Needs support - unassigned' : 'No support needed'));
    if (r.isTwoToOne && Array.isArray(r.twoToOneStaffNames) && r.twoToOneStaffNames.length) covered = r.twoToOneStaffNames.join(' / ');
    return { student: stu.student || stu.name || '', url: stu.url || stu.dataFileUrl || stu.dataFiles || '', location, support: [support, r.splitWindowCaption || r.splitWindowLabel || ''].filter(Boolean).join(' · '), coveredBy: covered };
  }).filter(x => x.student);
  return { ok: true, version: VERSION, status, item: currentKey || currentLabel, itemTitle: title, timeLabel: now.timeLabel, nextLabel: next ? itemLabelV05418EI(next) : '', staffRows, studentRows, source: source || 'published-server-fallback' };
}
async function buildPublishedNowFallbackV05418EI(redis, spreadsheetId) {
  if (!spreadsheetId) return null;
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId).catch(() => ({}));
  const snap = scheduleViewsFromPublishedPropsV05418EI(props);
  if (!snap.views) return null;
  return buildScheduleNowFromPublishedViewsV05418EI(snap.views, snap.source);
}
async function buildPublishStatusFallbackV05418EI(redis, spreadsheetId, base) {
  if (!spreadsheetId) return base || null;
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId).catch(() => ({}));
  const publishedJson = String(props.V5_PUBLISHED_SCHEDULE_JSON || '').trim();
  const workingJson = String(props.V5_WORKING_SCHEDULE_JSON || '').trim();
  const mode = String(props.V5_WORKING_SCHEDULE_MODE || '').trim();
  const publishedAt = String(props.V5_PUBLISHED_AT || (publishedJson ? props.V5_WORKING_SCHEDULE_SAVED_AT : '') || '').trim();
  const publishedHash = String(props.V5_PUBLISHED_HASH || props.V5_CURRENT_SCHEDULE_HASH || '').trim();
  const workingHash = String(props.V686M18_WORKING_SCHEDULE_HASH || props.V5_CURRENT_SCHEDULE_HASH || '').trim();
  const hasPublished = !!(publishedAt || publishedHash || publishedJson || mode.toLowerCase() === 'published');
  const workingDirty = /true|yes|1/i.test(String(props.V686M18_WORKING_DIRTY || ''));
  const unpublished = hasPublished && !!(workingJson || workingHash) && mode.toLowerCase() !== 'published' && (workingDirty || (publishedHash && workingHash && workingHash !== publishedHash));
  const stamp = publishedAt || (base && base.publishedAt) || '';
  const navText = unpublished ? (stamp ? ('Unpublished draft · Last published ' + stamp) : 'Unpublished draft · Never published') : (stamp ? ('Published ' + stamp) : (hasPublished ? 'Published schedule available' : 'Never published'));
  return Object.assign({}, base || {}, { ok: true, version: VERSION, displayOnly: true, publishedAt: stamp, activePublishedAt: stamp, currentHash: workingHash || publishedHash || '', publishedHash, workingHash, workingMode: mode, workingDirty, unpublished, unpublishedChanges: unpublished, draft: unpublished, neverPublished: !hasPublished, hasPublished, hasActivePublished: hasPublished, navText, detailText: stamp ? ('Published at ' + stamp) : (hasPublished ? 'Published schedule available' : 'Never published') });
}
async function directServerScheduleShortcutV05418EI(redis, spreadsheetId, functionName) {
  const fn = String(functionName || '');
  if (!spreadsheetId) return null;
  if (/^getSchedulePublishStatus(FastV686m\d+|V5)?$/.test(fn)) {
    return { result: await buildPublishStatusFallbackV05418EI(redis, spreadsheetId, {}) };
  }
  if (/^(getScheduleNowFastV5195|getScheduleNowFastV5443|getScheduleNowV5)$/.test(fn)) {
    const now = await buildPublishedNowFallbackV05418EI(redis, spreadsheetId);
    if (now) return { result: now };
  }
  return null;
}
async function patchDashboardPageWithPublishedNowV05418EI(redis, spreadsheetId, result, originalFunctionName) {
  if (!spreadsheetId || !result || typeof result !== 'object' || Array.isArray(result)) return result;
  const fn = String(originalFunctionName || '');
  if (/^getDashboardPageFastV5443$/.test(fn)) {
    try { result.publishStatus = await buildPublishStatusFallbackV05418EI(redis, spreadsheetId, result.publishStatus || {}); } catch (_) {}
    const currentNow = result.scheduleNow || result.now || {};
    if (!hasNowRowsV05418EI(currentNow) || String(currentNow.source || '').toLowerCase() === 'empty') {
      const fallback = await buildPublishedNowFallbackV05418EI(redis, spreadsheetId).catch(() => null);
      if (fallback && hasNowRowsV05418EI(fallback)) result.scheduleNow = fallback;
    }
  }
  return result;
}

async function readStaffDirectoryV027(redis, spreadsheetId) {
  const values = await readRedisSheetValues(redis, spreadsheetId, 'Staff');
  if (!values.length) return new Map();
  const headers = Array.isArray(values[0]) ? values[0] : [];
  const cName = findHeaderIndex_(headers, ['name','staff','staff name','staff member','employee name'], 0);
  const cStatus = findHeaderIndex_(headers, ['status','staff status','active'], 8);
  const cBlocks = findHeaderIndex_(headers, ['time blocks','blocked times','blocks','time blocked','blocked periods'], 5);
  const cEmail = findHeaderIndex_(headers, ['email','notification email'], 10);
  const cPhone = findHeaderIndex_(headers, ['phone','phone number'], 11);
  const cAbsent = findHeaderIndex_(headers, ['absent','absent today','today absent'], -1);
  const map = new Map();
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    const name = String(row[cName] || '').trim(); if (!name || /^vacancy/i.test(name)) continue;
    const status = String(row[cStatus] || '').trim();
    const active = staffStatusIsActive_(status);
    const absent = cAbsent >= 0 && /^(true|yes|y|1|absent)$/i.test(String(row[cAbsent] || '').trim());
    map.set(normalizeStaffNameV018(name), { name, rowIndex: i + 1, status, active, absent, blocks: String(row[cBlocks] || '').trim(), email: String(row[cEmail] || '').trim(), phone: String(row[cPhone] || '').trim() });
  }
  return map;
}
function rowHasScheduleAssignmentV027(row) {
  if (!row || typeof row !== 'object') return false;
  if (Array.isArray(row.students) && row.students.length) return true;
  const s = String(row.staff || row.assignment || row.detail || row.status || row.source || '').trim();
  return !!s && !/free|available|support\s*$|no support needed/i.test(s);
}
function periodKeyV027(row) { return String((row && (row.title || row.period || row.label || row.item || row.block)) || '').trim(); }
function blockMatchesPeriodV027(blocks, period) {
  const b = String(blocks || '').toLowerCase(); const p = String(period || '').toLowerCase();
  if (!b || !p) return false;
  return b.split(/[\/;,|]/).map(x => x.trim()).filter(Boolean).some(x => x === p || p.includes(x) || x.includes(p));
}
async function buildScheduleConflictsV027(redis, spreadsheetId) {
  const model = await getPublishedScheduleModelV018(redis, spreadsheetId);
  const staffMap = await readStaffDirectoryV027(redis, spreadsheetId);
  const issues = [];
  const staffSchedules = Array.isArray(model.views && model.views.staffSchedules) ? model.views.staffSchedules : [];
  for (const rec of staffSchedules) {
    const staff = String((rec && (rec.staff || rec.name || rec.staffName)) || '').trim();
    if (!staff) continue;
    const info = staffMap.get(normalizeStaffNameV018(staff));
    const rows = Array.isArray(rec.rows) ? rec.rows : [];
    for (const row of rows) {
      if (!rowHasScheduleAssignmentV027(row)) continue;
      const period = periodKeyV027(row);
      if (!info) issues.push({ severity: 'warning', type: 'Staff not found', staff, period, message: `${staff} appears in the published schedule but was not found in Staff Manager.` });
      else {
        if (!info.active) issues.push({ severity: 'critical', type: 'Inactive staff assigned', staff, period, message: `${staff} is not active but appears assigned during ${period || 'a schedule block'}.` });
        if (info.absent) issues.push({ severity: 'critical', type: 'Absent staff assigned', staff, period, message: `${staff} is marked absent but appears assigned during ${period || 'a schedule block'}.` });
        if (blockMatchesPeriodV027(info.blocks, period)) issues.push({ severity: 'critical', type: 'Blocked time assignment', staff, period, message: `${staff} appears assigned during a blocked time (${period}).` });
      }
    }
  }
  const studentSchedules = Array.isArray(model.views && model.views.studentSchedules) ? model.views.studentSchedules : [];
  for (const st of studentSchedules) {
    const student = String((st && (st.student || st.name || st.studentName)) || '').trim();
    const rows = Array.isArray(st && st.rows) ? st.rows : [];
    for (const row of rows) {
      const support = String(row && (row.support || row.supportType || row.need) || '').trim();
      const location = String(row && (row.location || row.room || '') || '').trim();
      const noSupport = !support || /^(n\/?a|na|none|no support needed)$/i.test(support);
      const staff = String(row && row.staff || '').trim();
      if (!noSupport && location && !staff && !(row && row.allowedUnstaffed)) issues.push({ severity: 'warning', type: 'Unstaffed support need', student, period: periodKeyV027(row), message: `${student || 'A student'} has a support need without assigned staff.` });
    }
  }
  return { publishedAt: model.publishedAt || '', hash: model.hash || '', issues, count: issues.length, criticalCount: issues.filter(i => i.severity === 'critical').length };
}

async function buildScheduleExplainabilityV027(redis, spreadsheetId) {
  const model = await getPublishedScheduleModelV018(redis, spreadsheetId);
  const conflicts = await buildScheduleConflictsV027(redis, spreadsheetId);
  const conflictKeys = new Set((conflicts.issues || []).map(i => normalizeStaffNameV018(i.staff || '') + '|' + String(i.period || '').toLowerCase()));
  const staffMap = await readStaffDirectoryV027(redis, spreadsheetId);
  const rows = [];
  const staffSchedules = Array.isArray(model.views && model.views.staffSchedules) ? model.views.staffSchedules : [];
  for (const rec of staffSchedules) {
    const staff = String((rec && (rec.staff || rec.name || rec.staffName)) || '').trim();
    const info = staffMap.get(normalizeStaffNameV018(staff));
    (Array.isArray(rec.rows) ? rec.rows : []).forEach(row => {
      if (!rowHasScheduleAssignmentV027(row)) return;
      const period = periodKeyV027(row);
      const students = Array.isArray(row.students) ? row.students.map(studentLabelV018).filter(Boolean).join(', ') : '';
      const key = normalizeStaffNameV018(staff) + '|' + String(period || '').toLowerCase();
      const why = ['Assignment appears in the current published schedule.'];
      if (info) why.push(info.active ? 'Staff member is active in Staff Manager.' : 'Staff member is not active in Staff Manager.');
      if (info && !blockMatchesPeriodV027(info.blocks, period)) why.push('No matching blocked-time conflict was detected for this period.');
      if (!conflictKeys.has(key)) why.push('No current Schedule Issues were detected for this assignment.');
      rows.push({ staff, period, assignment: students || String(row.location || row.detail || row.status || 'Assigned'), why });
    });
  }
  return { publishedAt: model.publishedAt || '', rows: rows.slice(0, 250), count: rows.length };
}

async function recordStaffPortalAccessV027(redis, req, query, staffSchool, rawQuery, route) {
  try {
    if (!staffSchool || !staffSchool.spreadsheetId) return;
    const cfg = await getStaffPortalBootstrapConfig(redis);
    const school = String(staffSchool.school || staffSchool.schoolId || query.school || '').trim();
    const staff = String(query.staff || query.staffName || '').trim();
    if (!school || !staff) return;
    const provided = String((rawQuery && rawQuery.staffToken) || (query && query.staffToken) || '').trim();
    const recordTokenVersion = cfg.tokenSecret ? await getStaffTokenVersionV05421(redis, staffSchool.spreadsheetId, staff) : 0;
    const expected = cfg.tokenSecret ? makeStaffPortalToken(school, staff, cfg.tokenSecret, recordTokenVersion) : '';
    const tokenValid = !!provided && !!expected && provided === expected;
    if (!tokenValid) return;
    const publish = await getScheduleVersionV027(redis, staffSchool.spreadsheetId).catch(() => ({}));
    const stamp = new Date().toISOString();
    const tokenHash = sha256ShortV018(provided);
    let log = await readRedisSheetValues(redis, staffSchool.spreadsheetId, '_StaffPortalAccessLog');
    if (!log.length) log = [['Timestamp','School','Staff','Token Hash','Token Valid','Published At','Schedule Hash','Schedule Version','Route','User Agent']];
    log.push([stamp, school, staff, tokenHash, tokenValid ? 'TRUE' : 'FALSE', publish.publishedAt || '', publish.hash || '', publish.dailyVersion || '', route || 'staff', String(req.get('user-agent') || '').slice(0, 240)]);
    if (log.length > 3000) log = [log[0]].concat(log.slice(-2999));
    await writeRedisSheetValues(redis, staffSchool.spreadsheetId, '_StaffPortalAccessLog', log);
    let latest = await readRedisSheetValues(redis, staffSchool.spreadsheetId, '_StaffPortalAccessLatest');
    if (!latest.length) latest = [['Staff Key','Staff','Last Viewed','Published At','Schedule Hash','Schedule Version','Route','Updated']];
    const key = normalizeStaffNameV018(staff); let found = -1;
    for (let i = 1; i < latest.length; i++) if (String(latest[i] && latest[i][0] || '') === key) { found = i; break; }
    const row = [key, staff, stamp, publish.publishedAt || '', publish.hash || '', publish.dailyVersion || '', route || 'staff', stamp];
    if (found >= 1) latest[found] = row; else latest.push(row);
    await writeRedisSheetValues(redis, staffSchool.spreadsheetId, '_StaffPortalAccessLatest', latest);
    await recordSecurityAccessV05422(redis, staffSchool.spreadsheetId, staff, 'portal', getClientIpV05422(req), req.get('user-agent'));
  } catch (err) { console.warn('[staff portal access v027]', err && err.message ? err.message : err); }
}



async function getStaffPortalLastViewDirectV0545(redis, spreadsheetId, staffName) {
  const name = String(staffName || '').trim();
  const key = normalizeStaffNameV018(name);
  let best = null;
  const latest = await readRedisSheetValues(redis, spreadsheetId, '_StaffPortalAccessLatest').catch(() => []);
  for (let i = 1; i < latest.length; i++) {
    const r = latest[i] || [];
    const rowKey = String(r[0] || '').trim();
    const rowStaff = String(r[1] || '').trim();
    if (rowKey === key || normalizeStaffNameV018(rowStaff) === key) {
      best = { source: '_StaffPortalAccessLatest', staff: rowStaff || name, lastViewedRaw: String(r[2] || ''), publishedAtAtView: String(r[3] || ''), scheduleHashAtView: String(r[4] || ''), scheduleVersionAtView: String(r[5] || ''), route: String(r[6] || '') };
      break;
    }
  }
  if (!best || !best.lastViewedRaw) {
    const log = await readRedisSheetValues(redis, spreadsheetId, '_StaffPortalAccessLog').catch(() => []);
    for (let i = log.length - 1; i >= 1; i--) {
      const r = log[i] || [];
      const rowStaff = String(r[2] || '').trim();
      if (normalizeStaffNameV018(rowStaff) === key) {
        best = { source: '_StaffPortalAccessLog', staff: rowStaff || name, lastViewedRaw: String(r[0] || ''), publishedAtAtView: String(r[5] || ''), scheduleHashAtView: String(r[6] || ''), scheduleVersionAtView: String(r[7] || ''), route: String(r[8] || '') };
        break;
      }
    }
  }
  const publish = await getScheduleVersionV027(redis, spreadsheetId).catch(() => ({}));
  const raw = best && best.lastViewedRaw ? best.lastViewedRaw : '';
  const viewedDate = raw ? parseDateLooseV027(raw) : null;
  const publishDate = publish && publish.publishedAt ? parseDateLooseV027(publish.publishedAt) : null;
  const viewedAfterPublish = !!(viewedDate && publishDate && viewedDate.getTime() >= publishDate.getTime());
  return {
    staff: name,
    found: !!raw,
    source: best && best.source || '',
    lastViewedRaw: raw,
    lastViewed: raw ? formatDateTimeV027(raw) : '',
    publishedAt: publish.publishedAt || '',
    publishedAtFormatted: publish.publishedAt ? formatDateTimeV027(publish.publishedAt) : '',
    viewedAfterPublish,
    stale: !!(publish.publishedAt && !viewedAfterPublish)
  };
}

async function buildStaffPortalAccessSummaryV027(redis, spreadsheetId) {
  const latest = await readRedisSheetValues(redis, spreadsheetId, '_StaffPortalAccessLatest');
  const latestMap = new Map();
  for (let i = 1; i < latest.length; i++) {
    const r = latest[i] || []; latestMap.set(String(r[0] || ''), { staff: String(r[1] || ''), lastViewed: String(r[2] || ''), publishedAtAtView: String(r[3] || ''), scheduleHashAtView: String(r[4] || ''), scheduleVersionAtView: String(r[5] || ''), route: String(r[6] || '') });
  }
  const publish = await getScheduleVersionV027(redis, spreadsheetId).catch(() => ({}));
  const staffDir = await readStaffDirectoryV027(redis, spreadsheetId);
  const staff = Array.from(staffDir.values()).filter(s => s.active).map(s => {
    const v = latestMap.get(normalizeStaffNameV018(s.name)) || { staff: s.name, lastViewed: '' };
    const viewedAfterPublish = !!(v.lastViewed && publish.publishedAt && parseDateLooseV027(v.lastViewed) && parseDateLooseV027(publish.publishedAt) && parseDateLooseV027(v.lastViewed).getTime() >= parseDateLooseV027(publish.publishedAt).getTime());
    return Object.assign({}, v, { staff: s.name, email: s.email || '', phone: s.phone || '', rowIndex: s.rowIndex, lastViewedRaw: v.lastViewed || '', lastViewed: v.lastViewed ? formatDateTimeV027(v.lastViewed) : '', viewedAfterPublish, stale: !!publish.publishedAt && !viewedAfterPublish });
  });
  return { staff, publishedAt: publish.publishedAt || '', publishedAtFormatted: publish.publishedAt ? formatDateTimeV027(publish.publishedAt) : '', scheduleLabel: publish.label || '', scheduleVersion: publish.dailyVersion || 0, notViewedCount: staff.filter(s => s.stale).length, viewedCount: staff.filter(s => s.viewedAfterPublish).length };
}

async function buildStaffPortalMetaV027(redis, spreadsheetId, query) {
  const publish = await getScheduleVersionV027(redis, spreadsheetId).catch(() => ({}));
  const regular = await buildRegularScheduleV022(redis, spreadsheetId).catch(() => ({}));
  const state = await readCommunicationStateV018(redis, spreadsheetId).catch(() => ({}));
  const data = await getPublishedScheduleModelV018(redis, spreadsheetId).catch(() => ({}));
  const staff = String(query.staff || query.staffName || '').trim();
  const staffToken = String(query.staffToken || query.token || '').trim();
  let changedLines = [];
  if (staff && staffToken) {
    try { changedLines = changeSummaryV018(parseJsonSafeV015_(state.LAST_COMMUNICATED_SCHEDULE_JSON || '{}', {}), data.views || {}, staff); } catch (err) { changedLines = []; }
  }
  const unassignedSupportLocation = cleanTextV018((data.views && data.views.unassignedSupportLocation) || '');
  changedLines = changedLines.map(line => replaceFreeLabelV028(line, unassignedSupportLocation));
  const staffDir = await readStaffDirectoryV027(redis, spreadsheetId);
  const info = staffDir.get(normalizeStaffNameV018(staff));
  let statusMessage = '';
  if (info && info.absent) statusMessage = 'You are marked absent today.';
  else if (info && !info.active) statusMessage = 'Your staff profile is not active.';
  else if (!publish.publishedAt) statusMessage = 'No schedule has been published yet.';
  return { scheduleLabel: publish.label || '', lastPublishedAt: publish.publishedAt ? formatDateTimeV027(publish.publishedAt) : '', regularHidden: regular.displayOnStaffPortal === false, statusMessage, changedLines, unassignedSupportLocation };
}

async function buildTodaySetupV027(redis, req, ctx) {
  const publish = await getScheduleVersionV027(redis, ctx.spreadsheetId).catch(() => ({}));
  const data = await getDataFileStatusV027(redis, ctx.spreadsheetId).catch(() => ({ summary: {} }));
  const access = await buildStaffPortalAccessSummaryV027(redis, ctx.spreadsheetId).catch(() => ({}));
  const conflicts = await buildScheduleConflictsV027(redis, ctx.spreadsheetId).catch(() => ({ issues: [], count: 0, criticalCount: 0 }));
  const diag = await buildDiagnosticsV027(redis, req, ctx).catch(err => ({ googleFormsSearchOk: false, googleFormsError: err.message }));
  const comm = await getCommunicationPromptStateV018(redis, req, ctx.school, ctx.spreadsheetId).catch(() => ({}));
  return { published: publish, dataFiles: data.summary || {}, staffPortalAccess: { viewed: access.viewedCount || 0, notViewed: access.notViewedCount || 0, total: (access.staff || []).length }, scheduleIssues: { count: conflicts.count || 0, critical: conflicts.criticalCount || 0 }, diagnostics: diag, communication: comm };
}


async function enforceStaffPortalRegularDisplayV05417(redis, html, staffSchool) {
  html = String(html || '');
  html = html.replace(/<h2>Regular Schedule\s*<span class=\"stamp\">[\s\S]*?<\/span><\/h2>/gi, '<h2>Regular Schedule</h2>');
  try {
    const spreadsheetId = staffSchool && (staffSchool.spreadsheetId || staffSchool.selectedSpreadsheetId || staffSchool.id);
    if (!spreadsheetId) return html;
    const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId);
    const hasSaved = Object.prototype.hasOwnProperty.call(props, 'V5_DISPLAY_REGULAR_ON_STAFF_PORTAL');
    const display = hasSaved && String(props.V5_DISPLAY_REGULAR_ON_STAFF_PORTAL || '').toLowerCase() === 'true';
    if (display) return html;
    const css = '<style id="v05418RegularStaffPortalHide">a[data-public-tab="regular"],a[data-view="regular"],section[data-public-view="regular"],#regularHiddenV027{display:none!important;visibility:hidden!important}</style>';
    const js = '<script id="v05418RegularStaffPortalHideScript">(function(){try{function kill(){try{document.querySelectorAll(\'a[data-public-tab="regular"],a[data-view="regular"],section[data-public-view="regular"]\').forEach(function(x){x.remove();});if(location.search&&/view=regular/i.test(location.search)){var first=document.querySelector(\'a[data-view="my"],a[data-view="staff"]\');if(first&&first.click)first.click();}}catch(e){}}if(document.readyState===\'loading\')document.addEventListener(\'DOMContentLoaded\',kill);else kill();setTimeout(kill,50);setTimeout(kill,250);}catch(e){}})();</script>';
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, css + '</head>');
    else html = css + html;
    if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, js + '</body>');
    else html += js;
    return html;
  } catch (err) {
    return html;
  }
}





function landingFooterV05418AA() {
  return '<footer class="footer"><div class="shell footerIn"><div>&copy; ' + new Date().getFullYear() + ' Support Schedules. All rights reserved.</div><div class="footerLinks"><a href="/about">About</a><a href="/#pricing">Pricing</a><a href="/security">Security</a><a href="/privacy">Privacy</a><a href="/terms">Terms of Service</a></div></div></footer>';
}

function contactModalV05418AA() {
  return '<div class="modal" id="contactModal" role="dialog" aria-modal="true" aria-labelledby="contactTitle"><form class="modalPanel" id="contactForm"><div class="modalHead"><div><h2 id="contactTitle">Tell us about your team</h2><p>Share a few details and we will follow up about Support Schedules options.</p></div><button class="xBtn" type="button" id="contactClose" aria-label="Close">&times;</button></div><div class="grid2"><div><label>Name</label><input name="name" autocomplete="name" required></div><div><label>Email</label><input name="email" type="email" autocomplete="email" required></div></div><div class="grid2"><div><label>Organization / team</label><input name="organization" required></div><div><label>Approx. team size</label><input name="teamSize" placeholder="e.g., 25"></div></div><label>Role / title</label><input name="role" placeholder="Optional"><label>How can we help?</label><textarea name="message" placeholder="Tell us a little about your scheduling needs."></textarea><input class="hp" name="website" tabindex="-1" autocomplete="off"><div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="primaryBtn" type="submit">Send</button></div><div class="msg" id="contactMsg"></div></form></div>';
}

function contactScriptV05418AA() {
  return `<script>(function(){var m=document.getElementById('contactModal'),close=document.getElementById('contactClose'),form=document.getElementById('contactForm'),msg=document.getElementById('contactMsg');function show(e){if(e&&e.preventDefault)e.preventDefault();if(!m)return;m.classList.add('active');setTimeout(function(){var x=form&&form.querySelector('input[name=name]');if(x)x.focus();},0)}function hide(){if(m)m.classList.remove('active')}document.querySelectorAll('[data-demo],a[href="#contact"]').forEach(function(x){x.addEventListener('click',show);});if(close)close.addEventListener('click',hide);if(m)m.addEventListener('click',function(e){if(e.target===m)hide();});document.addEventListener('keydown',function(e){if(e.key==='Escape')hide();});if(form)form.addEventListener('submit',function(e){e.preventDefault();msg.className='msg';msg.textContent='Sending...';var data={};Array.prototype.slice.call(new FormData(form).entries()).forEach(function(x){data[x[0]]=x[1];});fetch('/api/contact-lead-v05418o',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(function(r){return r.json().then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||'Request failed');return j;});}).then(function(j){msg.className='msg ok';msg.textContent=j.message||'Thanks. We received your request.';form.reset();}).catch(function(err){msg.className='msg err';msg.textContent=err.message||String(err);});});})();</script>`;
}

function legalLayoutV05418AA(title, subtitle, bodyHtml) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Support Schedules</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Public+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="icon" type="image/png" href="/app/icons/icon-192.png"><link rel="apple-touch-icon" href="/app/icons/icon-180.png"><style>
:root{--ink:#0A2540;--ink-soft:#274566;--muted:#5B6B84;--line:#E1E7F2;--accent:#007AFF;--accent-deep:#0C3FBF;--paper-alt:#F4F7FC;--serif:'Fraunces',Georgia,serif;--sans:'Public Sans',-apple-system,Arial,sans-serif}
*{box-sizing:border-box}
body{margin:0;font-family:var(--sans);color:var(--ink);background:#fff;line-height:1.62;-webkit-font-smoothing:antialiased}
a{color:inherit}
a:focus-visible,button:focus-visible{outline:2.5px solid var(--accent);outline-offset:2px;border-radius:4px}
.shell{width:min(820px,calc(100% - 36px));margin:0 auto}
.nav{background:rgba(255,255,255,.9);border-bottom:1px solid var(--line);backdrop-filter:blur(12px);position:sticky;top:0}
.navIn{height:78px;display:flex;align-items:center;justify-content:space-between;width:min(1160px,calc(100% - 40px));margin:0 auto}
.logo{display:flex;align-items:center;gap:11px;font-weight:800;text-decoration:none;color:var(--ink);font-size:18px}
.logoMark{height:38px;width:auto}
.back{color:var(--ink-soft);text-decoration:none;font-weight:600;font-size:14px}
.back:hover{color:var(--accent)}
main{padding:64px 0 40px}
h1{font-family:var(--serif);font-weight:500;font-size:clamp(34px,5vw,52px);line-height:1.08;letter-spacing:-.01em;margin:0 0 14px}
h2{font-family:var(--serif);font-weight:500;font-size:24px;letter-spacing:-.005em;margin:36px 0 10px}
p,li{color:var(--ink-soft);font-size:15.5px}
ul{padding-left:20px}
.note{border:1px solid #D8E7FF;background:var(--paper-alt);border-radius:14px;padding:16px 18px;color:var(--ink-soft);font-size:14.5px;margin-bottom:8px}
.footer{background:#071B33;color:#9FB2CC;padding:40px 0;font-size:13.5px;margin-top:40px}
.footer .shell{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;width:min(1160px,calc(100% - 40px))}
.links{display:flex;gap:18px;flex-wrap:wrap}
.links a{text-decoration:none;color:#9FB2CC}
.links a:hover{color:#fff}
@media(max-width:600px){.navIn{padding:0 4px}.back{font-size:13px}}
</style></head><body><header class="nav"><div class="navIn"><a class="logo" href="/"><img src="/brand/logo-color-only.png" alt="" class="logoMark">Support Schedules</a><a class="back" href="/">&larr; Back to home</a></div></header><main><div class="shell"><h1>${escapeHtml(title)}</h1><p class="note">${escapeHtml(subtitle)}</p>${bodyHtml}</div></main><footer class="footer"><div class="shell"><span>&copy; 2026 Support Schedules. All rights reserved.</span><div class="links"><a href="/about">About</a><a href="/mission">Mission</a><a href="/#pricing">Pricing</a><a href="/security">Security</a><a href="/privacy">Privacy</a><a href="/terms">Terms of Service</a></div></div></footer></body></html>`;
}





function renderStandaloneBaseV039(title, body, script) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} - Support Schedules</title><style>
    :root{--bg:#f5f7fb;--card:#fff;--text:#0f172a;--muted:#52627a;--border:#d8e2f0;--primary:#2563eb;--danger:#ef4444;--danger-bg:#fef2f2;--danger-border:#fecaca;--ok:#16a34a;--ok-bg:#ecfdf5;--ok-border:#bbf7d0;--nav:#eef4ff}
    *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;background:var(--bg);color:var(--text);font-size:14px}.top{position:sticky;top:0;z-index:10;background:rgba(245,247,251,.96);border-bottom:1px solid var(--border);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{display:flex;align-items:center;gap:10px;min-width:0}.brand h1{font-size:22px;margin:0}.brand .sub{color:var(--muted);font-size:12px;margin-top:2px}.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.wrap{padding:16px 18px 28px}.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px;box-shadow:0 1px 2px rgba(15,23,42,.04)}button,.btn{height:34px;border:1px solid var(--border);border-radius:10px;background:#fff;color:#111827;font-weight:800;padding:0 13px;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;text-decoration:none;white-space:nowrap}button.primary,.btn.primary{background:var(--primary);border-color:var(--primary);color:#fff}button.danger{background:#fff;color:#991b1b;border-color:#fecaca}.notice{border:1px solid var(--border);background:#f8fafc;border-radius:12px;padding:10px;margin-bottom:12px;color:var(--muted)}.err{border:1px solid var(--danger-border);background:var(--danger-bg);color:#991b1b;border-radius:12px;padding:10px;margin:10px 0}.ok{border:1px solid var(--ok-border);background:var(--ok-bg);color:#166534;border-radius:12px;padding:10px;margin:10px 0}.muted{color:var(--muted)}label{font-weight:800;font-size:12px;color:#0f172a;display:block;margin-bottom:4px}select,input{height:34px;border:1px solid var(--border);border-radius:10px;padding:0 10px;background:#fff;color:#0f172a;min-width:0}.toolbar{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin:10px 0}.toolbar>div{min-width:170px}.dow,.calGrid{display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:8px}.dow{font-size:12px;font-weight:800;color:var(--muted);margin:10px 0 6px}.day{border:1px solid var(--border);border-radius:13px;background:#fff;padding:8px;min-height:100px}.day.out{opacity:.55}.day.today{outline:2px solid #bfdbfe}.dayHead{display:flex;justify-content:space-between;gap:6px;font-weight:800;margin-bottom:6px}.day select,.day input.note{width:100%;margin-top:6px}.tableScroll{overflow:auto;max-height:72vh;border:1px solid var(--border);border-radius:14px}.safeTable{width:100%;border-collapse:collapse;background:#fff}.safeTable th,.safeTable td{border-bottom:1px solid #e5edf7;border-right:1px solid #e5edf7;padding:7px;text-align:left;vertical-align:top;font-size:12px}.safeTable th{position:sticky;top:0;background:#f8fafc;z-index:1}.diagGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.pill{border:1px solid var(--border);border-radius:999px;padding:4px 9px;background:#fff;font-size:12px}.schoolInput{width:150px}.debug{white-space:pre-wrap;background:#0f172a;color:#f8fafc;border-radius:12px;padding:12px;max-height:55vh;overflow:auto;font-size:12px}.hidden{display:none!important}@media(max-width:900px){.top{align-items:flex-start;flex-direction:column}.dow,.calGrid{grid-template-columns:1fr}.toolbar>div{width:100%}.toolbar select,.toolbar input{width:100%}}
  </style></head><body>${body}<script>${script}</script></body></html>`;
}


function normStaffV0546(v){ return String(v || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function headerIndexV0546(headers, names, fallback) {
  const map = new Map();
  (headers || []).forEach((h, i) => { const k = String(h || '').trim().toLowerCase().replace(/\s+/g, ' '); if (k && !map.has(k)) map.set(k, i); });
  for (const n of names || []) { const k = String(n || '').trim().toLowerCase().replace(/\s+/g, ' '); if (map.has(k)) return map.get(k); }
  return fallback;
}
function parseDateV0546(v){ if (v instanceof Date && !Number.isNaN(v.getTime())) return v; const s=String(v||'').trim(); if(!s) return null; let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return new Date(Date.UTC(+m[1],+m[2]-1,+m[3])); m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if(m){let y=+m[3]; if(y<100)y+=2000; return new Date(Date.UTC(y,+m[1]-1,+m[2]));} const d=new Date(s); return Number.isNaN(d.getTime())?null:d; }
function isoV0546(d){ return d&&!Number.isNaN(d.getTime()) ? d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0') : ''; }
function dispDateV0546(d){ return d&&!Number.isNaN(d.getTime()) ? String(d.getUTCMonth()+1).padStart(2,'0')+'/'+String(d.getUTCDate()).padStart(2,'0')+'/'+d.getUTCFullYear() : ''; }
function plusDayV0546(d){ return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)); }
async function getStaffAttendanceSummaryDirectV0546(redis, spreadsheetId, staffName, opts = {}) {
  const target = normStaffV0546(staffName);
  const values = await readRedisSheetValues(redis, spreadsheetId, 'Attendance').catch(() => []);
  if (!values.length) return { count: 0, rows: [], rowCount: 0, uniqueDateCount: 0, source: 'Attendance', found: false };
  const h = Array.isArray(values[0]) ? values[0] : [];
  const cName=headerIndexV0546(h,['name','staff','staff name'],1), cStart=headerIndexV0546(h,['start date','absence date','date'],3), cEnd=headerIndexV0546(h,['end date','last day'],4), cReason=headerIndexV0546(h,['reason'],5), cDay=headerIndexV0546(h,['day part','daypart'],6), cArr=headerIndexV0546(h,['arrival time','arrival'],7), cLeave=headerIndexV0546(h,['leave time','leave'],8), cNotes=headerIndexV0546(h,['notes'],9), cStatus=headerIndexV0546(h,['status'],10);
  const props = await readCampusScopedPropertiesFromRedis(redis, spreadsheetId).catch(()=>({}));
  const sy = parseDateV0546(props.V5_SCHOOL_YEAR_START_DATE || '');
  const rows=[], dates=new Set();
  for(let i=1;i<values.length;i++){
    const r=Array.isArray(values[i])?values[i]:[]; const nm=String(r[cName]||'').trim(); if(!nm||normStaffV0546(nm)!==target) continue;
    const status=String(r[cStatus]||'').trim(); if(/^(deleted|void|cancelled|canceled)$/i.test(status)) continue;
    const st=parseDateV0546(r[cStart]); if(!st) continue; const en=parseDateV0546(r[cEnd])||st; if(sy&&en<sy) continue;
    let dayCount=0; for(let d=st; d<=en; d=plusDayV0546(d)){ if(sy&&d<sy) continue; dates.add(isoV0546(d)); dayCount++; }
    rows.push({ rowIndex:i+1, staff:nm, startDate:dispDateV0546(st), endDate:isoV0546(en)!==isoV0546(st)?dispDateV0546(en):'', dayCount, reason:String(r[cReason]||'').trim(), dayPart:String(r[cDay]||'').trim()||'Full day', arrival:String(r[cArr]||'').trim(), leave:String(r[cLeave]||'').trim(), notes:String(r[cNotes]||'').trim(), status });
  }
  rows.sort((a,b)=>b.rowIndex-a.rowIndex);
  return { count: dates.size || rows.length, rows: opts.includeRows ? rows : [], rowCount: rows.length, uniqueDateCount: dates.size, schoolYearStartDate: sy ? isoV0546(sy) : '', source: 'Attendance', found: true };
}
async function getStaffPortalLastViewFromSummaryV0546(redis, spreadsheetId, staffName) {
  const target = normStaffV0546(staffName);
  try { const summary = await buildStaffPortalAccessSummaryV027(redis, spreadsheetId); const match = (summary.staff || []).find(s => normStaffV0546(s.staff || s.name) === target); if (match) return { found: !!match.lastViewedRaw, source: 'access-summary', lastViewedRaw: match.lastViewedRaw || '', lastViewed: match.lastViewed || '', viewedAfterPublish: !!match.viewedAfterPublish, stale: !!match.stale, publishedAt: summary.publishedAt || '', publishedAtFormatted: summary.publishedAtFormatted || '' }; } catch (err) {}
  return await getStaffPortalLastViewDirectV0545(redis, spreadsheetId, staffName);
}

function renderStandaloneCalendarManagerV039() {
  const body = `<div class="top"><div class="brand"><div><h1>Calendar Manager</h1><div class="sub">Standalone safe page · avoids the Admin Portal legacy Calendar loader</div></div></div><div class="actions"><input id="schoolBox" class="schoolInput" placeholder="school key"><a class="btn" href="/admin/">Back to Admin Portal</a><a class="btn" href="/diag/calendar-attendance">Diagnostics</a><button id="reloadBtn">Reload</button><button id="saveBtn" class="primary">Save Month</button></div></div><div class="wrap"><div id="msg"></div><div class="card"><div class="notice">This page intentionally does <b>not</b> load the main Admin Portal JavaScript. If this page works while the left-menu Calendar page crashes, the crash is in the Admin Portal legacy client renderer, not in the Calendar data.</div><div class="toolbar"><button id="prevBtn">‹ Previous</button><button id="todayBtn">Today</button><button id="nextBtn">Next ›</button><div><label>Bulk schedule</label><select id="bulkSchedule"></select></div><button id="applySelectedBtn">Apply to Selected Days</button><button id="applyAllBtn">Apply to All Days</button><button id="clearBtn" class="danger">Clear Visible Month</button></div><h2 id="monthTitle">Loading...</h2><div class="dow"><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div></div><div id="grid" class="calGrid"></div><div id="status" class="muted" style="margin-top:10px"></div></div></div>`;
  const script = standaloneSharedScriptV039() + `
  let calDate=new Date(); calDate.setDate(1); let calendarData={};
  function optionHtml(names,val){let out='<option value=""></option>'; (names||[]).forEach(n=>{out+='<option value="'+esc(n)+'" '+(String(n)===String(val)?'selected':'')+'>'+esc(n)+'</option>';}); return out;}
  function renderCalendar(data){calendarData=data||{}; by('monthTitle').textContent=data.monthName||''; by('bulkSchedule').innerHTML=optionHtml(data.scheduleNames||[],by('bulkSchedule').value||''); const days=(data.days||[]).filter(day=>{const d=new Date(day.dateIso+'T00:00:00'); const dow=d.getDay(); return dow!==0&&dow!==6;}); by('grid').innerHTML=days.map(day=>'<div class="day '+(day.inMonth?'':'out')+(day.isToday?' today':'')+'" data-iso="'+esc(day.dateIso)+'"><div class="dayHead"><label style="margin:0"><input type="checkbox" class="pick" style="height:auto"> '+esc(day.day)+'</label><span>'+esc(day.dateIso)+'</span></div><select class="sched">'+optionHtml(data.scheduleNames||[],day.scheduleType||'')+'</select><input class="note" placeholder="Notes" value="'+esc(day.notes||'')+'">'+(day.attendanceAbsenceCount?'<div class="muted" style="font-size:12px;margin-top:5px">Absences: '+esc(day.attendanceAbsenceCount)+'</div>':'')+'</div>').join('');}
  function loadCalendar(){setMsg('Loading calendar...',''); const school=schoolId(); if(!school){setMsg('Missing school key. Return to the Admin Portal and open Calendar again, or enter the school key above.','err'); return;} fetchJson('/api/v034/calendar-safe?'+new URLSearchParams({school,year:String(calDate.getFullYear()),month:String(calDate.getMonth()+1),_t:String(Date.now())})).then(j=>{renderCalendar(j.result||{}); by('status').textContent='Loaded '+(j.schoolName||j.school||school)+' using standalone safe Calendar Manager.'; setMsg('','');}).catch(e=>setMsg('Calendar could not load: '+e.message,'err'));}
  function collectDays(){return Array.from(document.querySelectorAll('.day')).map(d=>({dateIso:d.getAttribute('data-iso'),scheduleType:(d.querySelector('.sched')||{}).value||'',notes:(d.querySelector('.note')||{}).value||''}));}
  function saveCalendar(){const school=schoolId(); if(!school){setMsg('Missing school key.','err');return;} setMsg('Saving calendar...',''); fetchJson('/api/v034/calendar-safe/save',{method:'POST',body:JSON.stringify({school,year:calDate.getFullYear(),month:calDate.getMonth()+1,days:collectDays()})}).then(j=>{renderCalendar(j.result||{}); setMsg('Calendar saved.','ok');}).catch(e=>setMsg('Calendar save failed: '+e.message,'err'));}
  function applyBulk(all){const val=by('bulkSchedule').value; if(!val){setMsg('Choose a bulk schedule first.','err');return;} document.querySelectorAll('.day').forEach(d=>{if(all||(d.querySelector('.pick')&&d.querySelector('.pick').checked)){const s=d.querySelector('.sched'); if(s)s.value=val;}}); setMsg('Applied '+val+'. Click Save Month to persist.','ok');}
  by('reloadBtn').onclick=loadCalendar; by('saveBtn').onclick=saveCalendar; by('prevBtn').onclick=()=>{calDate.setMonth(calDate.getMonth()-1);loadCalendar();}; by('nextBtn').onclick=()=>{calDate.setMonth(calDate.getMonth()+1);loadCalendar();}; by('todayBtn').onclick=()=>{calDate=new Date();calDate.setDate(1);loadCalendar();}; by('applySelectedBtn').onclick=()=>applyBulk(false); by('applyAllBtn').onclick=()=>applyBulk(true); by('clearBtn').onclick=()=>{document.querySelectorAll('.day:not(.out)').forEach(d=>{const s=d.querySelector('.sched'),n=d.querySelector('.note'); if(s)s.value=''; if(n)n.value='';}); setMsg('Visible month cleared. Click Save Month to persist.','ok');};
  initSchoolBox(); loadCalendar();`;
  return renderStandaloneBaseV039('Calendar Manager', body, script);
}

function renderStandaloneAttendanceManagerV039() {
  const body = `<div class="top"><div class="brand"><div><h1>Attendance Manager</h1><div class="sub">Standalone safe page · avoids the Admin Portal legacy Attendance loader</div></div></div><div class="actions"><input id="schoolBox" class="schoolInput" placeholder="school key"><a class="btn" href="/admin/">Back to Admin Portal</a><a class="btn" href="/diag/calendar-attendance">Diagnostics</a><button id="printBtn">Print</button><button id="reloadBtn" class="primary">Load</button></div></div><div class="wrap"><div id="msg"></div><div class="card"><div class="notice">This page intentionally does <b>not</b> load the main Admin Portal JavaScript. If this page works while the left-menu Attendance page crashes, the crash is in the Admin Portal legacy client renderer, not in the attendance data.</div><div class="toolbar"><div><label>Month</label><select id="monthSelect"></select></div><div><label>Staff filter</label><input id="staffFilter" placeholder="optional staff name"></div><label style="display:flex;align-items:center;gap:6px;margin-top:21px"><input id="showNonActive" type="checkbox" style="height:auto"> Show non-active current staff</label></div><h2 id="heading">Attendance</h2><div id="grid" class="tableScroll"></div><div id="status" class="muted" style="margin-top:10px"></div></div></div>`;
  const script = standaloneSharedScriptV039() + `
  function monthOptions(){const now=new Date(); now.setDate(1); let html=''; const current=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0'); for(let off=-6;off<=12;off++){const d=new Date(now.getFullYear(),now.getMonth()+off,1); const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); const label=d.toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'long',year:'numeric'}); html+='<option value="'+key+'" '+(key===current?'selected':'')+'>'+esc(label)+'</option>'; } return html;}
  function renderAttendance(data){data=data||{}; by('heading').textContent='Attendance - '+(data.monthLabel||data.month||''); const days=data.days||[], rows=data.rows||[]; if(!rows.length){by('grid').innerHTML='<div class="muted" style="padding:14px">No attendance rows found.</div>';return;} by('grid').innerHTML='<table class="safeTable"><thead><tr><th>Staff</th>'+days.map(d=>'<th title="'+esc(d.label||d.key||'')+'">'+esc(d.day||String(d.key||'').slice(-2))+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>{const cells=r.cells||{}; return '<tr><td><b>'+esc(r.staff||'')+'</b></td>'+days.map(d=>{const k=d.key||d.dateIso||''; return '<td>'+esc(cells[k]||'')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';}
  function loadAttendance(){setMsg('Loading attendance...',''); const school=schoolId(); if(!school){setMsg('Missing school key. Return to the Admin Portal and open Attendance again, or enter the school key above.','err'); return;} const params={school,month:by('monthSelect').value,staff:by('staffFilter').value||'',showNonActive:by('showNonActive').checked?'true':'false',_t:String(Date.now())}; fetchJson('/api/v034/attendance-safe?'+new URLSearchParams(params)).then(j=>{renderAttendance(j.result||{}); by('status').textContent='Loaded '+(j.schoolName||j.school||school)+' using standalone safe Attendance Manager.'; setMsg('','');}).catch(e=>setMsg('Attendance could not load: '+e.message,'err'));}
  by('monthSelect').innerHTML=monthOptions(); by('reloadBtn').onclick=loadAttendance; by('printBtn').onclick=()=>window.print(); by('monthSelect').onchange=loadAttendance; by('showNonActive').onchange=loadAttendance; initSchoolBox(); loadAttendance();`;
  return renderStandaloneBaseV039('Attendance Manager', body, script);
}

function renderCalendarAttendanceDiagnosticsV039() {
  const body = `<div class="top"><div class="brand"><div><h1>Calendar / Attendance Diagnostics</h1><div class="sub">Use this to identify whether the crash is API/data, standalone UI, or Admin Portal shell.</div></div></div><div class="actions"><input id="schoolBox" class="schoolInput" placeholder="school key"><a class="btn" href="/admin/">Back to Admin Portal</a><a class="btn primary" id="calLink" href="/calendar-manager">Calendar Standalone</a><a class="btn primary" id="attLink" href="/attendance-manager">Attendance Standalone</a></div></div><div class="wrap"><div id="msg"></div><div class="diagGrid"><div class="card"><h2>1. API-only tests</h2><p class="muted">These call the server endpoints and do not render the full manager UI.</p><button id="testCalApi">Test Calendar API</button> <button id="testAttApi">Test Attendance API</button><pre id="apiOut" class="debug"></pre></div><div class="card"><h2>2. Standalone pages</h2><p class="muted">These avoid all Admin Portal legacy JavaScript. If these work, use them while we continue isolating the shell crash.</p><p><a id="calStandalone" class="btn primary" href="/calendar-manager">Open Calendar Manager</a> <a id="attStandalone" class="btn primary" href="/attendance-manager">Open Attendance Manager</a></p></div><div class="card"><h2>3. Interpretation</h2><p>If API-only fails, the problem is server/data/access. If API-only works and standalone works, the problem is the Admin Portal shell legacy renderer. If standalone fails, copy the visible error text.</p><p class="muted">v040 normalizes selected school keys before loading standalone pages and APIs.</p></div></div></div>`;
  const script = standaloneSharedScriptV039() + `
    function updateLinks(){const s=schoolId(); const q=s?'?school='+encodeURIComponent(s):''; ['calLink','calStandalone'].forEach(id=>by(id).href='/calendar-manager'+q); ['attLink','attStandalone'].forEach(id=>by(id).href='/attendance-manager'+q);}
    function test(url){const s=schoolId(); if(!s){setMsg('Enter a school key first.','err');return;} by('apiOut').textContent='Testing '+url+' ...'; fetchJson(url+'?'+new URLSearchParams({school:s,_t:String(Date.now())})).then(j=>{by('apiOut').textContent=JSON.stringify(j,null,2); setMsg('API test completed.','ok');}).catch(e=>{by('apiOut').textContent=e.stack||e.message; setMsg('API test failed: '+e.message,'err');});}
    initSchoolBox(); updateLinks(); by('schoolBox').addEventListener('input',updateLinks); by('testCalApi').onclick=()=>test('/api/v034/calendar-safe'); by('testAttApi').onclick=()=>test('/api/v034/attendance-safe');`;
  return renderStandaloneBaseV039('Calendar / Attendance Diagnostics', body, script);
}

function standaloneSharedScriptV039() {
  return `function by(id){return document.getElementById(id)}function esc(v){return String(v==null?'':v).replace(/[&<\>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c))}function setMsg(m,t){const el=by('msg'); if(!el)return; el.innerHTML=m?'<div class="'+(t==='err'?'err':t==='ok'?'ok':'notice')+'">'+m+'</div>':''}function canonicalSchoolClientV040(v){v=String(v||'').trim(); return v.toLowerCase();}function fetchJson(url,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(url,opts).then(r=>r.json().catch(()=>({})).then(j=>{if(!r.ok||j.ok===false)throw new Error(j.error||j.message||('HTTP '+r.status));return j}))}function schoolId(){const p=new URLSearchParams(location.search); return canonicalSchoolClientV040((p.get('school')||by('schoolBox')&&by('schoolBox').value||localStorage.getItem('gaLastSchoolV039')||localStorage.getItem('selectedSchool')||sessionStorage.getItem('selectedSchool')||'').trim())}function initSchoolBox(){const p=new URLSearchParams(location.search); const s=canonicalSchoolClientV040((p.get('school')||localStorage.getItem('gaLastSchoolV039')||localStorage.getItem('selectedSchool')||sessionStorage.getItem('selectedSchool')||'').trim()); if(by('schoolBox')){by('schoolBox').value=s; by('schoolBox').addEventListener('input',()=>localStorage.setItem('gaLastSchoolV039',canonicalSchoolClientV040(by('schoolBox').value.trim())))} if(s)localStorage.setItem('gaLastSchoolV039',s)}`;
}

function renderError(title, err) {
  const msg = err && err.message ? err.message : String(err || 'Unknown error');
  const stack = err && err.stack ? err.stack : '';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;background:#f6f8fb;margin:0;padding:24px;color:#0f172a}.box{background:#fff;border:1px solid #dbe3ef;border-radius:16px;padding:18px;max-width:900px;margin:auto}pre{white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:10px}</style></head><body><div class="box"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(msg)}</p>${process.env.NODE_ENV === 'development' ? `<pre>${escapeHtml(stack)}</pre>` : ''}</div></body></html>`;
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

main().catch(err => { console.error(err); process.exit(1); });

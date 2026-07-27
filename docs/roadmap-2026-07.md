# Roadmap: strengthening GA Scheduler for day-of support-staff scheduling

Written 2026-07-02, against v0.54.18ar. Covers: feature development, UI consistency,
multi-school hardening, Redis speed/cost, overall speed, and other recommendations. Marked
**[DONE]** where I implemented and validated a fix this pass, **[RECOMMENDED]** where I found
a real, specific issue but didn't touch the code (too risky to do blind, or out of scope for
this pass), and **[IDEA]** for net-new feature suggestions.

Everything here is grounded in this specific codebase — file names, function names, and line
numbers are real, not generic advice. I could not run the app in this environment (no network
access to install `express`/`redis`, no browser), so runtime-facing changes are validated by
isolated logic tests and `node --check` only; treat anything marked [DONE] as "implemented and
reasoned through carefully, not yet seen running."

---

## 1. Redis integration — speed and cost

This is where the highest-value, best-evidenced findings were. The core mechanism worth
understanding: every single legacy `.gs` RPC call (`runtime.call(...)` in
`src/runtime/appsScriptRuntime.js`) re-hydrates the *entire* active spreadsheet from Redis
before running, on purpose — `__setActiveSpreadsheetId` in `src/runtime/googleServices.js`
explicitly evicts and reloads it every time, with a comment explaining this was added (v0.54.16)
specifically to stop a Node-process-lifetime cache from serving stale data across requests.
That fix was correct and necessary — the problem was *how* the reload happened.

### 1a. [DONE] Hydration was N sequential Redis round trips per request, now 1

`RedisSpreadsheet.hydrate()` in `src/runtime/redisSpreadsheet.js` was doing:
```js
for (const key of keys) { const raw = await redis.get(key); ... }
```
For a spreadsheet with N sheets (Students, Staff, Rooms, `_AgencyManager`,
`_StudentAdvancedScheduling`, etc. — realistically 15-20+ sheets per school), this meant **N
sequential network round trips to Redis, one after another, on every single admin or staff
portal request** — not just page loads, every RPC call. On a hosted Redis (your `.env.example`
is templated for Upstash), each round trip is real network latency, and providers like Upstash
bill per command — so this was directly costing both time and money, multiplied by every
request, every school, all day.

Fixed to use `redis.mGet(keys)` (single round trip) with a `Promise.all` fallback (still N
calls, but concurrent instead of serial) if the client doesn't support `mGet`. Validated with
an isolated test: confirmed 1 `keys` + 1 `mGet` call replaces 1 `keys` + N sequential `get`
calls, correctly loads the same data, and handles the empty-spreadsheet case without error.
Also added `mGet` to the in-memory dev/test Redis shim in `src/redisClient.js` so local
dev/`npm run smoke` stay consistent with production behavior.

**This is the single highest-leverage change in this pass** — it applies to every request the
app serves, for every school, all day, with no behavior change and no new risk (same data,
same freshness guarantee, just fewer round trips to get it).

### 1b. [RECOMMENDED] Replace `redis.keys()` pattern-scan with a maintained set

`hydrate()` still starts with `redis.keys('gas:spreadsheet:${id}:sheet:*:values')` —
`KEYS` is a well-known Redis anti-pattern: it's O(N) over Redis's *entire* keyspace (not just
your app's keys) and blocks the single-threaded Redis server while it scans. Hosted providers
often throttle, disable, or heavily penalize `KEYS` in production tiers. `hydrateAll()`
(`src/runtime/redisSpreadsheet.js`) uses the even broader `gas:spreadsheet:*:sheet:*:values`
pattern.

Didn't fix this pass — it needs either a maintained Redis `SET` per spreadsheet
(`gas:spreadsheet:${id}:sheets`, updated via `SADD`/`SREM` whenever `insertSheet`/`deleteSheet`
run, read via `SMEMBERS`) or a `SCAN`-based iterator, both of which change the write path in
several places (`insertSheet`, `deleteSheet`, plus a one-time migration to populate the set
for existing schools) and I didn't want to touch that blind. Worth a dedicated pass once you
can test against a real Redis instance.

### 1c. [RECOMMENDED] `pendingWrites` is global, not per-spreadsheet

`RedisSpreadsheetApp.pendingWrites` (`src/runtime/redisSpreadsheet.js`) is a single array
shared across *every* school. `__setActiveSpreadsheetId` calls `await SpreadsheetApp.flush()`
before switching spreadsheets, which awaits `Promise.allSettled(pendingWrites)` — **all**
pending writes, from any school, not just the one being switched away from. Under concurrent
load (multiple schools' staff/admins using the system at the same time — the exact
multi-school scenario this app is for), a slow write from School A's request can measurably
delay a read for School B's unrelated request. Scoping `pendingWrites` per spreadsheet ID
(a `Map<id, Promise[]>` instead of one array) would fix this cleanly; didn't attempt it this
pass since it touches the same hot path as 1a/1b and I'd want to validate all three together
against a real Redis instance rather than stack three untested changes on the same file.

### 1d. [RECOMMENDED] Only hydrate sheets actually needed by a given call

Even with 1a fixed, every RPC call still loads *every* sheet for that school, whether the
specific function needs one sheet or twelve. A lazy-load model (fetch a sheet on first
`getSheetByName()` access, cache it for the request, still force-refresh per the existing
`__setActiveSpreadsheetId` contract) would cut Redis command volume further for
narrowly-scoped calls (e.g., saving one student's Agency Manager row currently still pulls
every sheet in the spreadsheet). This is architecturally bigger than 1a-1c — some code may
assume all sheets are already loaded (e.g., bulk sheet enumeration in admin tooling) — so I'd
want this scoped as its own reviewed change, not bundled in blind.

---

## 2. Overall speed

### 2a. [DONE] Response compression (gzip)

Nothing was compressing responses. `public/index.html` alone is **1.2MB of uncompressed
text** (it's the full admin app — HTML, CSS, and all client JS — as one static file), served
on every admin page load, plus ~500KB more across the loaded patch scripts. Added the standard
`compression` Express middleware, applied globally (covers the HTML, the JS patch files, and
JSON API responses). gzip typically cuts text payloads like this by 70-85%. This matters most
for exactly the scenario your objective describes — staff checking or adjusting coverage
**on the go**, often on school WiFi or mobile data, where every KB is round-trip time.

**Needs `npm install`** (the `compression` package isn't in this environment) and I could not
runtime-test it here — after deploying, verify with `curl -H "Accept-Encoding: gzip" -I <url>`
and check for a `Content-Encoding: gzip` response header.

### 2b. [DONE] Cache-Control for versioned static assets

This project's own convention is to ship new client features as new, uniquely-versioned
filenames (`ga-redis-v05418ar-....js`) rather than editing an existing one in place — so once
deployed, a given filename's content is effectively immutable. Nothing was telling browsers
that. Added `Cache-Control: public, max-age=31536000, immutable` specifically for files
matching that versioned naming pattern, so repeat visits skip re-downloading them entirely
instead of paying a round trip for a 304. Deliberately left `index.html` and other
constant-named files alone, since those *do* get overwritten in place on redeploy and must
always be revalidated — caching those aggressively would risk serving a stale app after a
deploy.

### 2c. [RECOMMENDED] Split the 1.2MB `index.html` into cacheable pieces

Compression (2a) and caching (2b) both help, but the underlying architecture — one giant
static HTML file containing the entire admin app inline, rather than separate HTML/CSS/JS
files — means the *whole thing* is one uncacheable unit at the HTTP level (2b can't help
`index.html` itself, since it changes on every deploy). Splitting the inline `<style>` block
and the largest inline `<script>` sections into separate `.css`/`.js` files under `public/`
would let the CSS (which changes rarely) get the same immutable-caching treatment as the
patch files, shrinking what needs to be re-fetched on every deploy to just the parts that
actually changed. This is a real, substantial win but is a genuinely large, mechanical
refactor of a 9,500-line template literal with no test harness to validate against — I'd
want this done as its own careful pass, ideally with the ability to actually load the page in
a browser to confirm nothing broke.

### 2d. [RECOMMENDED] Lazy-load the Advanced Scheduling / Agency Manager modals

Both `ga-redis-v05418aq-advanced-layout-period-warm.js` and the new
`ga-redis-v05418ar-agency-manager.js` install their CSS and wire up event listeners on every
page load, for every user, whether or not they ever open those modals. This is small in
isolation but is the same pattern across all 25+ patch files currently loaded on every visit —
consider a lightweight lazy-load convention going forward (only inject a patch's CSS/DOM when
its trigger UI is actually reached) rather than adding to the always-loaded baseline every
time a new feature ships.

---

## 3. Multi-school hardening

The existing "School Data Guard" (`resolveSchoolContextV027`, `validateSelectedSchoolForRunV027`,
`schoolAccessStatusV027` in `src/server.js`) is genuinely well-designed — it validates that
write-risk RPC calls carry a resolved school context, checks per-user campus access rows, and
supports district/admin roles. It's a real access-control layer, not an afterthought. That
said, three gaps are worth knowing about:

### 3a. [RECOMMENDED] Silent "wide open" bootstrap mode

`schoolAccessStatusV027`: if there are no `_CampusUsers` rows configured *and* no
environment-based access gate, **every visitor is allowed access to every school** —
`{ allowed: true, reason: 'bootstrap access' }`. This is a reasonable default for a fresh
deployment (you have to be able to log in and configure access rules somehow), but nothing
surfaces this state to an admin. A district could stay in this wide-open mode indefinitely
without realizing it. Recommend: surface a persistent, impossible-to-miss banner in the admin
UI whenever `schoolAccessStatusV027` would return `bootstrap access`, so it gets fixed rather
than forgotten.

### 3b. [RECOMMENDED] Auth-optional means access control is entirely bypassed

`schoolAccessStatusV027` returns `allowed: true` immediately if `!isAuthEnabled()` — i.e., the
entire multi-school access-control layer is conditional on `GOOGLE_AUTH_ENABLED=true`. If a
district runs with auth disabled (e.g., trusted-intranet-only deployment), there's no
user-level isolation between schools in the browser UI at all — anyone with a link can act on
any school by setting the right `school` parameter. This may be intentional for some
deployment modes, but it's worth being explicit about in your own deployment documentation:
**if you run more than one school and want them isolated from each other in the UI (not just
from outside attackers), `GOOGLE_AUTH_ENABLED=true` with properly configured `_CampusUsers`
rows is required, not optional.**

### 3c. [RECOMMENDED] Global write-flush contention across schools (see 1c above)

Same underlying issue as the Redis section above, restated here because it's specifically a
multi-school concern: one school's in-flight write can delay another school's read, since
`pendingWrites` isn't scoped per spreadsheet.

### 3d. [RECOMMENDED] No rate limiting on the Staff Portal

Flagged in an earlier pass, restated because it's a multi-school concern specifically: the
Staff Portal is intentionally public/token-based per school. Without rate limiting, a
compromised or guessed token for one school's portal could be hit hard enough to affect Redis
performance for *all* schools sharing the same Redis instance (noisy-neighbor risk). Worth
rate-limiting `/staff` and related routes even though they're meant to be publicly reachable.

---

## 4. UI consistency across tools

You asked specifically for a consistent UI across tools — this codebase currently has real,
visible inconsistency worth naming directly:

- **Two Font Awesome versions loaded simultaneously** — `public/index.html` loads both
  Font Awesome 4.7.0 *and* 6.5.2 (`<link>` tags for both). Different patch files use `fa-` vs
  `fa-solid fa-` icon class prefixes inconsistently depending on which version they were
  written against. This is both a UI-consistency problem (icons can render differently
  depending on which library's class won) and a small speed problem (loading two full icon
  font libraries when one would do).
- **Three-plus generations of the same modal**, still partially present: `advancedSchedulingModalV05418X`,
  `advancedSchedulingModalV05418AO`, and the current `advancedSchedulingModalV05418AQ` all
  exist in the client code (the current one explicitly deactivates the older two on open —
  see `openModal()` in `ga-redis-v05418aq-advanced-layout-period-warm.js`). Each generation
  has its own CSS class names and slightly different visual treatment. The old ones are dead
  weight at this point.
- **Two different "alert badge" systems**: the core `renderIssueBadgesForStudent`/`renderIssueBadgesForStaff`
  badge system (`<span class="badge warn/bad/good">`) used throughout Student/Staff Manager,
  versus one-off custom-styled elements like `studentAgencySupportedFlagV05418AQ` (its own
  amber pill with bespoke CSS) built by individual patches. I deliberately used the *existing*
  badge system for the new "Agency Supported" list alert last pass specifically to not add a
  fourth variant — worth applying that same discipline (reuse `renderIssueBadgesForStudent`'s
  badge classes) to any future alerts rather than each patch inventing its own pill styling.
- **Recommendation**: before adding more UI, worth a short, dedicated pass to (a) drop Font
  Awesome 4.7.0 and standardize on 6.5.2 icon classes everywhere, (b) delete the two dead
  Advanced Scheduling modal generations, (c) write down the "house style" (which badge
  classes, which modal CSS pattern, which button classes) in one place so new patches inherit
  it instead of each one visually reinventing itself. This is exactly the kind of drift the
  period-label bug's root cause came from — not a correctness bug this time, but the same
  underlying pattern (new version added alongside old, old never removed).

---

## 5. Feature ideas for day-of scheduling & support-staff management

Grounded in what the app already does well (the assignment engine, Assignment Analyzer's
decision drilldown, the Agency Manager work from last pass) and where the day-of gap actually
is — this app is strong at *building* a schedule, less built out for *the day itself* when
someone's absent and coverage needs to change in real time:

- **[IDEA] "Who's uncovered right now" live view.** The assignment engine already computes,
  per period, exactly which students are unassigned and why (`buildUnassignedDecisionContextV512_`).
  Today that surfaces in the Assignment Analyzer as a planning tool. A day-of dashboard — "as
  of right now, these students have no coverage this period, here's why, here's who's
  available" — reusing that exact same drilldown data, would directly serve the stated
  objective of day-of management rather than requiring an admin to re-run generation to see it.
- **[IDEA] One-tap absence → re-solve for a single staff member.** Marking one staff member
  absent today already exists as a field; what doesn't appear to exist is a fast, mobile-sized
  "this person is out today, show me who it affects and let me accept a rescue option"
  flow — essentially a day-of-scoped version of the existing Assignment Genie, focused on one
  person's absence rather than a full regeneration.
- **[IDEA] Mobile-first day-of view.** The admin portal is desktop-oriented (dense multi-column
  tables). A stripped-down, phone-sized "my coverage today" or "today's gaps" view — reusing
  existing data, not new backend — would matter a lot for a front-office person calling
  around for last-minute coverage.
- **[IDEA] Push/text alert on emergency agency coverage.** Since last pass added the Emergency
  District Coverage toggle, a natural next step: when that toggle is flipped on for a student,
  notify whoever's on duty that district staff now need to cover that student today, instead
  of the change being silent until someone happens to check Agency Manager.
- **[IDEA] Printable/exportable day-of coverage sheet.** For situations where staff genuinely
  need a paper or offline copy (fire drill, sub with no login), a one-click "print today's
  coverage assignments" view, separate from the full schedule builder.

These are intentionally framed as ideas, not implemented — they're feature decisions that
should be validated with the people actually doing day-of coverage before building, not
something to guess at blind.

---

## 6. Other recommendations (carried over / restated from prior passes)

- **No CI actually runs on push/PR** — `npm run check`/`npm run smoke` exist but nothing
  triggers them automatically. A two-line GitHub Action would have caught the still-present
  missing `ga-redis-v021-ui-patches.js` file (404 on every page load) automatically.
- **1,291 empty `catch(e) {}` blocks** in `legacy/admin_portal_current_m46.gs` remain
  unaddressed — likely where future "it's broken but there's no error" reports trace back to.
- **~3,300 lines of dead code** from duplicate top-level function definitions (97 function
  names, up to 8 copies each) — see `docs/scheduling-logic.md` — still not removed; flagged
  again since it's directly related to the UI-consistency drift in section 4.
- **No `package-lock.json`** — still needs `npm install` run in an environment with registry
  access and the result committed; couldn't be generated here.
- **No error monitoring/alerting** — errors are logged to console only. For a system managing
  real students' coverage, worth considering a lightweight error-tracking integration so a
  broken assignment run surfaces to someone immediately rather than being discovered by a
  student going uncovered.

---

## Summary of what changed this pass

| File | Change |
|---|---|
| `src/runtime/redisSpreadsheet.js` | Batch sheet hydration via `mGet` (N round trips → 1) |
| `src/redisClient.js` | Added `mGet` to the in-memory dev/test store for parity |
| `src/server.js` | Added `compression` middleware; added immutable Cache-Control for versioned static JS; version bump |
| `package.json` | Added `compression` dependency; version bump |

No changes to `legacy/admin_portal_current_m46.gs` this pass — the assignment engine and
data model were untouched. No changes to Redis keys, data shapes, or the school-context/access
model — same freshness and isolation guarantees as before, just fewer round trips to get there.

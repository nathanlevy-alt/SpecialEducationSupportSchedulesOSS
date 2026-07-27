# Support Schedules (self-hosted)

A day-of coverage scheduler for special education and student-support teams. It builds,
publishes, and communicates daily staff coverage schedules — matching staff to student needs
while respecting blocked pairings, room limits, support-type requirements, rest preferences,
and priority holds, then explains exactly why any student couldn't be covered.

This is the self-hosted, open-source build: the admin portal, the staff-facing portal, the
admin companion app, and the staff mobile app, all served from one Node/Express server backed
by Redis. There's no external marketing site or account system bundled in — you run it, you
own the data.

## What's here

- **Admin Portal** (`/admin`) — full scheduling engine, staff/student managers, calendar,
  attendance, communication tools, settings.
- **Staff Portal** (`/staff`) — token-based, no login required; staff open their personal link
  to see their schedule.
- **Admin App** (`/admin-app`) — a lighter-weight mobile PWA for day-of admin actions
  (absences, coverage, quick communication).
- **Staff App** (`/app`) — a mobile PWA for staff to view their schedule and manage
  notifications.

## Quick start (Docker)

The fastest path — this brings up the app and a local Redis together:

```bash
git clone <this repo>
cd <this repo>
cp .env.example .env   # then edit .env, see "Configuration" below
docker-compose up --build
```

Once it's running, open `http://localhost:8080/admin`.

## Quick start (without Docker)

Requires Node 18+ and a Redis instance (local or hosted — [Upstash](https://upstash.com) works
well for a free tier).

```bash
npm install
cp .env.example .env   # then edit .env
npm start
```

## Configuration

Copy `.env.example` to `.env` and fill in the values you need. The essentials:

- `REDIS_URL` — your Redis connection string. **Never leave this unset or pointed at
  `memory` in production** — that mode is non-persistent and exists only for local
  smoke-testing.
- `GOOGLE_AUTH_ENABLED` — set to `true` to gate the admin portal behind Google sign-in
  (recommended for any real deployment). See the Google OAuth section in `.env.example` for
  the client ID/secret/allowed-email settings that go with it. The Staff Portal (`/staff`)
  stays token-based and public-link accessible either way — it's designed for staff who
  shouldn't need any login at all.
- `STAFF_PORTAL_TOKEN_SECRET` — set this to a long random value; it signs staff portal links.
- `SESSION_SECRET` — set this to a long random value if `GOOGLE_AUTH_ENABLED=true`.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — only needed for push notifications in the mobile
  apps. Generate your own with `npx web-push generate-vapid-keys` after `npm install`. The
  rest of the app works fine without these (push endpoints degrade gracefully). See
  `docs/PUSH_NOTIFICATIONS.md`.

Everything else in `.env.example` has inline comments explaining what it does.

## First-time setup

1. Start the server and open `/admin`.
2. If `GOOGLE_AUTH_ENABLED=true`, sign in with an email listed in `AUTH_ALLOWED_EMAILS` or
   `AUTH_ALLOWED_DOMAINS`.
3. Use **Settings → Data Health Check** to confirm Redis connectivity, then **Stabilize
   Database** once to initialize the underlying data structures for a new school.
4. Add staff and students in the Staff Manager / Student Manager, configure your bell
   schedule / calendar, then use **Generate Schedules** to run the assignment engine.
5. **Publish** when you're ready — this is what staff see in the Staff Portal and Staff App.

## Verifying your setup

```bash
npm run check   # syntax-checks the server and runtime modules
npm run smoke   # boots the app against an in-memory Redis and confirms both portals render
```

## Architecture, briefly

- `src/server.js` — the Express server: routes, auth, API endpoints.
- `src/runtime/` — an emulation layer that runs the original Google Apps Script codebase
  (`legacy/*.gs`) against Redis instead of Google's infrastructure. This is why the core
  scheduling logic lives in `.gs` files even though the server is plain Node.
- `legacy/admin_portal_current_m46.gs` — the scheduling engine and admin portal backend logic.
- `legacy/staff_portal_current_1_3_8.gs` — the staff portal backend logic.
- `public/` — the front-end for all four surfaces (admin portal, admin app, staff app, and
  supporting assets).

For a deeper walkthrough of how the scheduling engine actually makes assignments — the
multi-pass priority system, constraint enforcement, rest preferences — see
`docs/scheduling-logic.md`. Other docs in `docs/` cover the Redis data model, staff portal
auth design, and push notifications.

## A known area worth knowing about

`docs/scheduling-logic.md` documents that the core scheduling engine is solid, but the
surrounding display/API layer in `legacy/admin_portal_current_m46.gs` has a meaningful amount
of dead code from iterative development (functions redefined in place rather than edited,
leaving old versions unreachable but still present in the file). It's documented there in
detail, including exactly what a cleanup pass would involve. Safe to leave as-is; also safe to
clean up if you want to contribute that.

## License

GPL-3.0 license

# Mobile app pairing and push notifications

Backend and UI for OTP device pairing and push are built and validated (isolated logic
tests + syntax checks — see `CHANGELOG.md`). This doc covers what's actually working today,
what still needs configuration, and how the pieces fit together.

## What's built

1. **Staff Portal → settings popup (gear icon) → "Pair mobile app"** — a staff member
   generates a 6-digit, single-use code (10 minute expiry), authenticated via their existing
   Staff Portal token (no new auth mechanism). `POST /api/v05418y/app-pairing/generate`.
2. **App pairing verification** — `POST /api/v05418y/app-pairing/verify`. This is what the
   *app itself* calls once someone enters the code. Not built yet (see "What's not built"
   below) — the endpoint is ready and tested, there's just no app calling it yet.
3. **Device registry** — `_AppDevices` sheet, one row per paired device, keyed by the push
   subscription's own endpoint (so a device can't spoof another device's registration).
4. **Communication Manager page** (new nav page — this didn't exist before, same situation
   Agency Manager was in) — shows every active staff member's Staff Portal access status and
   app pairing status side by side. `GET /api/v05418y/communication-manager`.
5. **Share Schedules popup → "Send Push Notification" button** — sends to whichever staff are
   checked in that popup, using their own row's staff name (not relying on the row's internal
   `key` matching the display name). `POST /api/v05418y/push/send`.

## What's NOT built yet — and why that's fine for now

**The actual iPhone app.** Every piece above is server + admin/staff-portal UI. None of it
requires the app to exist to be useful today — Communication Manager will just show "Not
paired" for everyone until an app exists and calls the verify endpoint. That was the point of
building backend-first: this is now the well-defined contract an app needs to implement
(generate happens in the browser via the Staff Portal; the app only ever needs to call
`verify` once, then hold onto its own subscription).

## What needs configuring before push actually delivers anything

**1. Install the new dependency.**
```bash
npm install
```
This pulls in `web-push`. Until this runs, `sendPushToStaffV05418Y` in `src/server.js`
degrades gracefully — the endpoint still responds, `configured: false`, with a clear message,
rather than crashing. Nothing else in the app is affected either way.

**2. Set VAPID keys.** These are what let your server prove to Apple's/Google's push
infrastructure that it's allowed to send to a given subscription — not an Apple Developer
account, not a paid service, just a keypair your server holds.

For local testing right now, a **real, valid keypair** (generated in this environment,
safe to use for development — generate your own for actual production use):
```
VAPID_PUBLIC_KEY=BPQz4Tk0joBUGID9MJZVWRkJ7WxAjjScmKs70kcwRg65YH7YgWoNae9bVMV7iiwilw1K_hvL85ULYxF3S4vwyfE
VAPID_PRIVATE_KEY=k5AS_izR4XPwm1y9_3HOtfe1KgutgoIKdLtDPlyrnJE
VAPID_SUBJECT=mailto:you@example.org
```
To generate your own for production, after `npm install`:
```bash
npx web-push generate-vapid-keys
```
Add all three to your `.env` (see the updated `.env.example`) or your host's environment
variables.

**3. Build the app itself.** The PWA prototype from earlier in this conversation is the
starting point — it already has a real `service-worker.js` with a `push` event handler
structurally ready to receive these. It needs:
- A real pairing screen that calls `POST /api/v05418y/app-pairing/verify` with the code the
  user enters and the browser's own `PushManager` subscription object.
- Registering for push via the standard Web Push API (`registration.pushManager.subscribe(...)`
  using `VAPID_PUBLIC_KEY` as the `applicationServerKey`).

## Known limitation carried over from the PWA discussion

iOS can silently drop a push subscription after a period of inactivity (see the earlier
conversation, and `docs/roadmap-2026-07.md`) — `sendPushToStaffV05418Y` already handles the
*server-side* half of this (a 404/410 response from the push service means that subscription
is gone, and it's removed from `_AppDevices` automatically so it doesn't keep failing silently
on every future send) but there's no user-facing "your device disconnected, re-pair" signal
yet. Worth adding once the app exists to test against.

## Not yet added: Staff Manager

Per direction, app-linkage status was added to Communication Manager only, not Staff Manager,
for now.

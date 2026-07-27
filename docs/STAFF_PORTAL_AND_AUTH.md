# Staff Portal and Authentication Architecture - v0.7

## Admin Portal

The Admin Portal is served at `/`. When `GOOGLE_AUTH_ENABLED=true`, the Admin Portal and `/api/*` endpoints require Google login.

Google OAuth callback routes supported:

- `/auth/google/callback` - preferred
- `/auth/callback` - legacy alias

Render environment variables:

- `GOOGLE_AUTH_ENABLED=true`
- `PUBLIC_BASE_URL=https://your-render-app.onrender.com`
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `SESSION_SECRET=long random secret`
- `AUTH_ALLOWED_EMAILS=email1@example.org,email2@example.org`
- `AUTH_ALLOWED_DOMAINS=example.org` optional

## Staff Portal

The Staff Portal is served from the same repository at `/staff`. It remains public-link/token based even when Admin authentication is enabled.

Staff portal links should use:

`/staff?school=<schoolKey>&staff=<staffName>&staffToken=<token>&view=my`

The legacy Staff Portal token logic is preserved:

`token = base64url(HMAC_SHA256(schoolId + '|' + normalizedStaffName, secret)).slice(0, 24)`

The app seeds the legacy Staff Portal script properties before loading the staff portal script:

- `V5_PUBLIC_STAFF_PORTAL_SCHOOLS_JSON`
- `V5_STAFF_PORTAL_TOKEN_SECRET_V5312`

You can configure these with environment variables:

- `STAFF_PORTAL_SCHOOLS_JSON` optional explicit JSON mapping
- `STAFF_PORTAL_DEFAULT_SCHOOL_ID` optional default school key
- `STAFF_PORTAL_TOKEN_SECRET` optional stable secret

If `STAFF_PORTAL_SCHOOLS_JSON` is blank, the app infers schools from Redis keys such as:

`gas:spreadsheet:<spreadsheetId>:sheet:Staff:values`

## Admin helper endpoints

These endpoints are under `/api`, so they require Google auth when auth is enabled.

- `/api/staff-portal/config` shows inferred/configured school keys and whether a token secret exists.
- `/api/staff-portal/link?school=<schoolKey>&staff=<staffName>` generates a staff-specific token link.

## Recommended production setup

1. Enable Google auth for Admin Portal.
2. Keep `/staff` token-based for staff-facing use.
3. Set a permanent `STAFF_PORTAL_TOKEN_SECRET` in Render so staff links remain stable across rebuilds.
4. Use `/api/staff-portal/config` to confirm school keys.
5. Generate/test one staff link with `/api/staff-portal/link`.

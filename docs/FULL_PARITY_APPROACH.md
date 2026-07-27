# GA Scheduler Redis Full-Parity Approach

This package uses a legacy-runtime strategy instead of a screen-by-screen rewrite.

The Admin Portal UI is extracted from the current GA Scheduler Apps Script source. The standalone Staff Portal is rendered by the current Staff Portal source through a Node-based Apps Script compatibility runtime. Server calls are dispatched by function name so the existing client-side code can keep using `google.script.run` style calls.

## Why this approach was selected

The current Admin Portal source contains a very large function surface and many years of layered logic. A manual rewrite would almost certainly lose behavior. The closest theoretical path to full parity is to execute the existing Apps Script JavaScript itself and replace the Google services underneath it.

## What the compatibility runtime emulates

- SpreadsheetApp using Redis-backed spreadsheet/sheet/range objects
- PropertiesService using Redis-backed property stores
- CacheService with execution-local caches
- LockService with no-op locks for single-process development
- HtmlService/ContentService enough to render existing pages
- Utilities common helpers
- Session active/effective user
- MailApp/GmailApp through SMTP/json transport
- DriveApp/FormApp minimal compatibility stubs

## What still requires environment validation

Some Google services cannot be perfectly emulated without district-specific configuration or external APIs. Drive/Form discovery, URL fetch integrations, and any advanced Google-only behavior must be validated and either ported to native Node equivalents or intentionally disabled.

This package is therefore the most complete parity scaffold possible in a single packaged conversion, but it should be tested against real GA Scheduler workflows before replacing the live Apps Script deployment.

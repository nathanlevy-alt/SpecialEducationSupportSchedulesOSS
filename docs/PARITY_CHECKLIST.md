# Parity Checklist

## UI
- [x] Admin Portal HTML extracted from current Admin m46 source
- [x] Existing `google.script.run` client pattern preserved through shim
- [x] Standalone Staff Portal rendered from current Staff Portal source
- [x] Email-only communication direction preserved
- [x] Legacy source files included for exact text/function reference

## Runtime / backend
- [x] Legacy Apps Script functions loaded into Node VM
- [x] Function-name dispatcher exposed at `/api/google-script-run`
- [x] Redis-backed sheet/value model included
- [x] Redis-backed property model included
- [x] Staff Portal GET/POST routes included
- [x] Email connector POST route included

## Needs real-data validation
- [ ] Import current Google Sheet workbooks into Redis-backed sheets
- [ ] Confirm Dashboard load
- [ ] Confirm Staff Manager load/save
- [ ] Confirm Student Manager load/save
- [ ] Confirm Generate Schedules output matches Apps Script version
- [ ] Confirm publish/history/schedule changes
- [ ] Confirm Staff Portal submission and column K email writes
- [ ] Confirm email connector behavior with SMTP/Gmail service

# Redis Data Model

The compatibility layer stores spreadsheet-style data in Redis so the legacy code can continue to think in sheets, rows, columns, and ranges.

## Spreadsheet values

`gas:spreadsheet:{spreadsheetId}:sheet:{sheetName}:values`

Value: JSON matrix, equivalent to `sheet.getDataRange().getValues()`.

## Properties

`gas:properties:admin:script`
`gas:properties:staff:script`
`gas:properties:connector:script`
`gas:properties:document:{spreadsheetId}`
`gas:properties:user:{email}`

Values: Redis hashes.

## Important migration note

This model intentionally preserves spreadsheet semantics for parity. A later optimization pass can normalize staff, students, schedules, settings, and history into first-class Redis JSON records, but that should happen after behavior parity is proven.

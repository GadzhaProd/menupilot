# MenuPilot CLI

The CLI reads data through the running local server and its private token file (mode `0600` on macOS/Linux). Start the server with `npm start`. If it is stopped, data commands report `unavailable` and say to start it. `doctor` works offline and never repairs files. Use either `npm run menupilot -- <command>` or the installed `menupilot` binary.

```sh
npm run menupilot -- status
npm run menupilot -- what-changed --since 30d
npm run menupilot -- what-changed --since 2026-10-01 --locale nl
npm run menupilot -- dishes
npm run menupilot -- dish dish_classic_burger --json
npm run menupilot -- ingredients
npm run menupilot -- ingredient "Beef mince"
npm run menupilot -- preps
npm run menupilot -- simulate --dish "Classic Burger" --menu-price 13,83 --volume 300
npm run menupilot -- simulate --dish dish_classic_burger --ingredient-price ing_beef=14 --ingredient-price ing_tomatoes=7 --qty l1=160\ g --volume 300 --json
npm run menupilot -- history
npm run menupilot -- journal --json
npm run menupilot -- backups
npm run menupilot -- doctor --json
```

## Input, lookup, and output

`--locale en|nl` affects human formatting and each money object's `display` only. JSON amount keys and exact values do not change. Money input accepts a decimal comma or point, but not grouping separators. Menu prices are labelled `incl. VAT`; pack/supplier prices are `excl. VAT`. `simulate` is read-only: repeated `--ingredient-price` and `--qty` flags compose a scenario; quantity overrides affect top-level dish lines only. Supported quantity units are `g`, `kg`, `ml`, `l`, and `pc`.

Lookups accept an ID (case-insensitive) or exact name (case-insensitive, trimmed, Unicode NFC). Duplicate exact names are an error with candidates. Fuzzy and substring matches are suggestions only; the CLI never selects them. A prep passed to `dish` is reported as a prep.

`what-changed --since` accepts `7d`, `30d`, `90d`, any positive integer followed by `d`, or `YYYY-MM-DD`. Day ranges use the same UTC calendar-date calculation as Dashboard quick presets. A date compares through `23:59:59.999Z`; future dates are rejected.

## JSON contract, version 1

Success output has this envelope:

```json
{
  "apiVersion": 1,
  "command": "what-changed",
  "documentId": "dataset-id-or-null",
  "revision": 3,
  "data": {},
  "warnings": [{"code": "backup-overdue", "message": "Latest backup is overdue."}]
}
```

Errors have `{ "apiVersion": 1, "error": { "code": "not-found", "message": "...", "candidates": [] } }`; candidates are omitted when none exist. `--json` writes the success object to stdout and errors to stderr. `warnings` is always an array of `{code,message}` and contains only active warnings. `documentId` and `revision` are taken from the same `/api/document` response as the data.

Every calculated money value is an object such as `{ "cents": "784", "display": "€7.84" }` or `{ "micro": "4200000", "display": "€4.20" }`. The integer strings are exact cents or micro-euros; `display` is presentation only and follows `--locale`. `*Cents` and `*Micro` fields are base-10 integer strings, never formatted text. Unknown amounts are `null`. Percentages are display strings. Counts, quantities, revisions, and rates remain JSON numbers.

### Stable command data shapes

- `status`: `{mode,dataDir,lastBackup,lastExternalBackup}`. Document identity and revision exist once, in the envelope. Warnings exist once, in the envelope.
- `doctor`: `{node,dataDir,databaseVersion,documentFormat,lockStatus,checks,warnings}`. Each check has `{name,ok,detail}` and has `advice` only when `ok` is false. Exit code is `1` when any check is `CHECK`.
- `dish`: explicit dish identity, menu price, VAT, portions, monthly volume, cost/contribution amounts, and recipe lines with a compact target (`id,name,kind,unit`); it does not expose the stored document object.
- `ingredient`: `{id,name,unit,priceHistory}` with each price entry carrying a cents string, formatted amount, VAT label, pack size, timestamp, and sequence.
- `simulate`: dish identity/status, menu price, recipe-based ingredient cost, contribution, deltas, volume, monthly contribution, food cost, and contribution margin. Amounts use the money shape above; no values are persisted.
- `what-changed`: date, per-dish current/comparison costs, change, monthly impact, status and coded `excludedReason` (`no-volume`, `cost-unknown`, `no-price-on-date`, or `error`); menu total; excluded list and counters.

Warning codes: `backup-overdue`, `external-backup-overdue`, `backup-error`, `backup-integrity`, `system-clock`, `local-folder`, `server-unavailable`.

## Exit codes

| Code | Meaning |
|---:|---|
| 0 | Success, including `--help`; doctor has no failed checks |
| 1 | Other failure, or doctor found one or more `CHECK` results |
| 2 | Invalid syntax, option, amount, unit, or date |
| 3 | Local server unavailable; start it with `npm start` |
| 4 | No exact match or ambiguous match |
| 5 | Missing, insecure, or rejected CLI token |

Stable error codes include `usage`, `invalid-argument`, `invalid-unit`, `not-found`, `ambiguous`, `unavailable`, `unauthorized`, `server-error`, `response-lost`, `conflict`, `confirmation-required`, and `command-failed`.

## Existing administrative commands

`open-url` and `backup list|verify|restore` remain available. Backup restore retains its confirmation flow. If a write request loses its response, the CLI says it may have completed; check the current status before retrying. `doctor` checks Node support, folder access/free space, cloud/network location, port and lock, token permissions, SQLite `quick_check`, document format, and backup freshness. A damaged database is never repaired automatically; use a verified backup after reviewing the report.

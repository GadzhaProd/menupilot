# MenuPilot CLI

The CLI is a read-only client of the local MenuPilot server. Start the server with
`npm start` first. The CLI reads its private token from the data folder; on macOS
and Linux the token file must have mode `0600`. Without a live server, data commands
report: `MenuPilot is unavailable. Run npm start, then try the command again.`

```sh
npm run menupilot -- status
npm run menupilot -- what-changed --since 30d
npm run menupilot -- what-changed --since 2026-10-01 --locale nl
npm run menupilot -- dishes
npm run menupilot -- dish dish_classic_burger
npm run menupilot -- ingredient "Beef mince"
npm run menupilot -- simulate --dish "Classic Burger" --menu-price 13,83 --volume 300
npm run menupilot -- history
npm run menupilot -- journal --json
npm run menupilot -- backups --json
npm run menupilot -- doctor
```

An installed `menupilot` binary accepts the same arguments. `--locale en|nl` selects
currency and percentage formatting (default `en`). Decimal comma and decimal point
are accepted for money and quantities; thousands separators are rejected. All menu
prices are labelled `incl. VAT`; supplier and pack prices are labelled `excl. VAT`.
`simulate` only calculates a scenario and does not save it. Quantity changes apply
to top-level dish lines only.

## Lookup and errors

An entity can be selected by exact ID or exact name, ignoring name case. Repeated
exact names are ambiguous and require an ID. A fuzzy match can appear as a suggestion,
but the CLI never selects one automatically. Ambiguous and missing searches include
candidate IDs, names, units and latest pack details where available.

Exit codes: `0` success, `1` other command/server failure, `2` invalid syntax or input,
`3` local server unavailable, `4` no match or ambiguous match, `5` rejected/missing
private CLI token.

## JSON contract, version 1

Successful commands return one JSON object:

```json
{
  "apiVersion": 1,
  "command": "what-changed",
  "documentId": "dataset-id-or-null",
  "revision": 3,
  "data": { "since": "2026-09-22", "dishes": [] },
  "warnings": []
}
```

Errors return `{ "apiVersion": 1, "error": { "code": "not-found", "message": "...", "candidates": [] } }`;
`candidates` is omitted when there are none. `--json` writes only this object to stdout
on success and stderr on error. Warnings remain structured strings in the envelope.

Money and BigInt calculation results are returned as ready-to-display euro strings,
for example `"€4.85"`, `"-€195.00"`, or `"€ 4,20"` in Dutch locale. Unknown amounts
are JSON `null`; unavailable human output is `—`. These strings include the euro unit
and follow `--locale`. Stored non-money quantities, revisions, counts, basis points,
and milli-units remain JSON numbers. Percentages include `%` in their strings.

`what-changed` uses the Dashboard calculation functions and current prices compared
with the selected date. Dishes with no monthly volume estimate are excluded from the
menu total; dishes with unknown cost are reported with an exclusion reason.
`simulate` calls the same calculation core used by the Profit Simulator. Its deltas
are scenario values minus the current baseline.

The CLI also supports the existing `open-url` and `backup list|verify|restore`
administrative commands. Backup restore can change data and keeps its existing
confirmation flow; it is not part of the read-only command set.

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
npm run menupilot -- stop
npm run menupilot -- doctor --json
```

## Input, lookup, and output

`--locale en|nl` affects human formatting and each formatted `display`; exact JSON value keys do not change. Human `what-changed` labels are translated too. Money input accepts a decimal comma or point, but not grouping separators. Menu prices are labelled `incl. VAT`; pack/supplier prices are `excl. VAT`. `simulate` is read-only: repeated `--ingredient-price` and `--qty` flags compose a scenario; quantity overrides affect top-level dish lines only. Supported quantity units are `g`, `kg`, `ml`, `l`, and `pc`.

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
- `dish`: explicit dish identity, menu price, raw `vatRateBp` plus `vatRate: {value,display}`, portions, monthly volume, cost/contribution amounts, and recipe lines. Each line retains `netQtyMilli`/`yieldBp` and adds `quantity: {value,display}` and `yield: {value,display}`, plus a compact target (`id,name,kind,unit`); it does not expose the stored document object.
- `ingredient`: `{id,name,unit,priceHistory}` with each historical price retaining `packSizeMilli` and adding `packSize: {value,display}` and `unitPrice: {value:{cents,per},display}`. `ingredients` provides the same ready-to-display fields under `currentPrice`.
- `preps`: each prep retains `outputMilli`/`outputUnit`, adds `output: {value,display}`, and returns recipe lines with the same raw and ready-to-display quantity/yield fields as `dish`.
- `simulate`: dish identity/status, menu price, recipe-based ingredient cost, contribution, deltas, volume, monthly contribution, food cost, and contribution margin. Amounts use the money shape above; no values are persisted.
- `what-changed`: date, per-dish current/comparison costs, change, monthly impact, status and coded `excludedReason` (`no-volume`, `cost-unknown`, `no-price-on-date`, or `error`); menu total; excluded list and counters.

Ready-to-display field examples (the raw integer fields remain present):

```json
{"packSizeMilli":1000000,"packSize":{"value":"1","display":"1 kg"},"unitPrice":{"value":{"cents":"1700","per":"kg"},"display":"€17.00/kg"}}
{"vatRateBp":900,"vatRate":{"value":"9","display":"9%"},"netQtyMilli":125000,"quantity":{"value":"125","display":"125 g"},"yieldBp":8500,"yield":{"value":"85","display":"85%"}}
```

For Dutch locale, `display` uses Dutch decimal/currency formatting and the UI unit label (`st` for pieces); the exact values and raw milli/basis-point fields stay unchanged.

Warning codes: read commands and plan reads/proposals include active backup and health warnings: `backup-overdue`, `external-backup-overdue`, `backup-error`, `backup-integrity`, `system-clock`. `status` may also include `local-folder`; offline `doctor` may include `server-unavailable`. A failed shutdown snapshot returns `shutdown-backup-failed` from `stop`.

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

`open-url` asks the server to open the browser; the API returns only `{opened: true|false}`, never a launch URL or UI token. The CLI prints whether it opened. On failure, open the address from the terminal window running `npm start`, or restart `npm start`. Normal commands and API responses do not disclose the window key. The key is held in server memory and printed in the startup terminal; opening the browser also briefly exposes it as a process argument. `--revoke-sessions` also revokes existing UI sessions.

`stop` requests a graceful server shutdown through the authenticated local API. It stops accepting new requests/writes, waits for work already in progress, creates a shutdown backup when data changed, returns that result to the CLI, then closes HTTP and releases the lock. On success the terminal prints `MenuPilot stopped. Your data is in <data-folder>`; JSON uses `data: {stopped:true,dataDir}` and `warnings: []`. If the snapshot fails, the database is closed and the lock is released, but the CLI exits `1`; JSON uses `data: {stopped:false,dataDir}` and warning `{code:"shutdown-backup-failed",message:"Data is saved in the database; the backup was not created — it will be made on the next start (reason: <error>)"}`. Human output prints that same message. Ctrl+C in the `npm start` window uses the same snapshot result and prints the same failure message if the copy cannot be made.

Agents must never open or apply their own plans, or access data files directly (AGENTS.md). This guards against agent mistakes in normal operation; a process running as the same user could intercept the one-use key from the process list during browser opening (even if visible only for a fraction of a second), or modify data files. This is not protection against malicious software with the user’s permissions.

`backup list|verify|restore` remains available. `backup list --json` writes the versioned JSON envelope to stdout (`data` contains the restore points and `warnings` is an array). An unknown ID passed to `backup verify` returns exit code 4 and error code `not-found`; run `backup list` to see available IDs. Backup restore retains its confirmation flow. If a write request loses its response, the CLI says it may have completed; check the current status before retrying. `doctor` checks Node support, folder access/free space, cloud/network location, port and lock, token permissions, SQLite `quick_check`, document format, and backup freshness. A damaged database is never repaired automatically; use a verified backup after reviewing the report.

## Propose a supplier price (local mode)

```sh
npm run menupilot -- propose add-price --ingredient "Beef mince 80/20" --pack-price 18,00 --pack-size 1 kg
npm run menupilot -- propose add-price --ingredient ing_beef --pack-price 18.00 --pack-size "1 kg" --json
npm run menupilot -- plans --json
npm run menupilot -- plan status <plan-id> --json
```

**Supplier price excl. VAT, as on the invoice.** Enter decimal text with comma or point, no grouping separators. Agent proposals have a maximum pack price of €100,000 (`price-limit`, exit 2). Zero is allowed with a prominent warning, consistently with manual price entry; negative, excess-precision and unsafe-integer prices are refused. Pack size must be positive and compatible with the ingredient: g/kg, ml/l, or pc. Price history retains the normalized pack price and size; per-kg/l/pc prices are display only. IDs and exact names are trimmed, NFC-normalized and case-insensitive. Ambiguous IDs/names and missing exact matches are refused with candidates; no fuzzy selection is used.

A proposal saves a **plan**, not an ingredient price. Human output includes its ID, 24-hour expiry, consequences and `Waiting for owner confirmation in MenuPilot` (Dutch with `--locale nl`). In the open MenuPilot window, the owner reviews old/new pack and unit prices, affected dishes/preps, food cost and monthly contribution changes, then chooses Apply or Reject and confirms in a dialog. The CLI has no apply/reject command; using its token on either endpoint returns HTTP 403 `ui-required`, even with a forged same-origin header. Browser confirmation needs a live UI bearer session and the exact local Origin.

Changes to the document (including unrelated edits or replacement) make pending plans stale. Expired/stale plans cannot apply: ask the agent to propose again. Unknown costs are `null`, never zero. Dishes without monthly volume show `—` and are excluded from the menu total. The total includes known impacts only; excluded counters must be shown alongside it. Consequences compare the current catalog to the proposed catalog using the same calculation functions as Dashboard. They compare against the moment of proposal, not Dashboard's default 30-day date.

### Plan JSON, protocol 1

Success keeps the version-1 CLI envelope. `propose` and `plan status` return a plan in `data`; envelope identity/revision are that plan's preconditions. `plans` returns a newest-first array of pending/recent plans, with the current document identity/revision in the envelope. `warnings` is an array of `{code,message}`. `zero-price` warns about a zero pack price; `large-price-change` warns when price per kg/l/pc changes by more than ×3 in either direction (including transitions from/to zero). Warnings appear in the plan and the CLI envelope and use `--locale`. Every `*Cents`/`*Micro` amount uses `{cents,display}` / `{micro,display}`; unknown amounts remain null. `unitPrice` uses `{cents,display,per}`. `--locale en|nl` changes displays, never exact integer strings.

```text
Plan = {
  id: string, opId: string, protocolVersion: 1, kind: "add-price",
  documentId: string | null, revision: safeInteger,
  status: "pending" | "applied" | "rejected" | "expired" | "stale" | "superseded",
  source: "cli" | "agent", createdAt: ISOInstant, expiresAt: ISOInstant,
  ingredient: { id: string, name: string, unit: "g" | "ml" | "pc" },
  price: { seq: safeInteger, recordedAt: ISOInstant,
           packPriceCents: { cents: decimalIntegerString, display: string }, packSizeMilli: safeInteger },
  previousPrice: Packaging | null, proposedPrice: Packaging,
  effects: { dishes: DishEffect[], preps: PrepEffect[],
             totalMonthlyImpactCents: { cents: decimalIntegerString, display: string } | null,
             excludedWithoutVolume: integer, excludedWithVolume: integer },
  warnings: { code: "zero-price" | "large-price-change", message: string }[],
  supersedes: string[], supersededBy?: string,
  receipt?: { opId: string, documentId: string, revision: safeInteger, changed: boolean },
  appliedAt?: ISOInstant, rejectedAt?: ISOInstant
}
Packaging = Price & { unitPrice: { cents: decimalIntegerString, display: string, per: "kg" | "l" | "pc" } }
DishEffect = {
  id, name, menuPriceInclVatCents, priceExclVatMicro,
  currentCostMicro, comparisonCostMicro, currentContributionMicro,
  currentFoodCostTenthsPct, comparisonFoodCostTenthsPct, foodCostDeltaTenthsPct,
  costDeltaCents, monthlyImpactCents, monthlyVolume,
  status: "ready" | "cost-unknown" | "no-price-on-date" | "error",
  excludedReason: null | "no-volume" | "cost-unknown"
}
PrepEffect = {
  id, name, currentBatchMicro, comparisonBatchMicro, outputMilli, outputUnit,
  current, comparison, noPriceOnDate, costUnknown
}
```

All money fields in effects are amount objects with exact integer strings and localized `display`; calculated percentage fields are integer strings (tenths of a percent). Unavailable results are `null`. `monthlyVolume`/`outputMilli` are safe integers or null as appropriate. Prep `current`/`comparison` are shared Dashboard display strings per kg/l/pc. `price.seq` and `recordedAt`, plus `opId` and plan `id`, are fixed at proposal time. Price entries have no separate UUID in the existing document format.

Authenticated endpoints: `GET /api/plans` returns `{documentId,revision,plans}` from one queued snapshot (no separate version request); `POST /api/plans/propose` with `{ingredient,packPrice,packSize}` as text; `POST /api/plans/status` with `{id}`. The HTTP UI transport keeps raw exact money strings; the CLI formats the public amount objects described above. UI-only `POST /api/plans/apply` and `/api/plans/reject` accept `{id}` only. Apply returns the current stored-document envelope plus the original operation receipt; reject returns the plan. Repeat apply returns the same receipt without another price or revision, including after restart and subsequent writes.

Lifecycle is refreshed on access. Retention is bounded to 50 pending, 200 total plans, 256 KiB per proposal, and 2 MiB total UTF-8 JSON (with 1 KiB per plan reserved for receipt/lifecycle metadata). Old terminal plans may be removed to fit the budget; terminal plans older than seven days after expiry are removed on access. A new valid proposal for the same ingredient atomically replaces its previous pending proposal: the old plan becomes `superseded`, and the new plan lists its ID in `supersedes`. Invalid proposals leave the previous one pending. Pending plans for other ingredients are never evicted. Receipt replay through the plan endpoint is guaranteed while the plan remains in retention. A lost proposal response may have created a pending plan: inspect `plans` before proposing again.

Additional stable errors: `plan-budget`, `plan-stale`, `plan-expired`, `plan-rejected`, `plan-applied`, `plan-superseded`, `plan-version`, `write-failed` (exit 1); `ui-required` and `origin` (HTTP 403, exit 1); `invalid-argument`/`invalid-unit`/`usage` (exit 2); `ambiguous`/`not-found` (exit 4, with candidates for ingredient resolution). `plan-stale` and `plan-expired` return HTTP 409 with advice to ask the agent again. `price-limit` returns exit 2. Pack sizes accept `1 kg` and `1kg`.

A failed apply leaves the ingredient, revision, history, journal, receipt and applied mark unchanged.

# MenuPilot

**Live demo: <https://gadzhaprod.github.io/menupilot/>** (fictional demo data, runs entirely in your browser)

MenuPilot is a small web app for independent restaurant owners. It turns recipes and supplier prices into a clear answer to one question: *"My supplier raised a price. What does that do to my dishes and to my month, and what should I change?"*

![Dashboard: dishes that got more expensive over the last 30 days, with monthly impact at the owner's own sales estimate](docs/screenshots/dashboard.jpg)

## Problem

Supplier prices keep changing. An owner sees a new invoice but cannot quickly tell:

- which dishes now cost more to make, and by how much;
- how much contribution is lost per month at current sales;
- what happens if the menu price goes up, or a portion gets smaller;
- which of those options is better.

## Solution

MenuPilot keeps ingredients with their price history, builds dish and prep (sub-recipe) costs from them, shows what changed since a chosen date, and lets the owner play out decisions in a **Profit Simulator** without touching real data.

## Key features

- **Dashboard.** Compare costs now against 7 / 30 / 90 days ago, or any date. Per dish: ingredient cost then and now, change in euros and in food-cost points, contribution now, and the monthly impact at the owner's own volume estimate. Preps are listed separately with their cost per kg, l or pc.
- **Profit Simulator.** For one dish, try a new menu price, new ingredient pack prices, other quantities and your own sales estimate. Up to three scenarios (A, B, C) are compared side by side with **Baseline** (today's real data), with differences per portion and per month. Scenarios are saved separately with their own baseline snapshot and never change real prices or recipes.
- **Preps and sub-recipes.** A sauce, dough or stock is a recipe of its own that dishes use. An ingredient price change flows through every level (up to 5). Cycles are rejected; an unknown price makes every parent show "cost unknown" instead of a wrong number.
- **Price history.** Ingredient prices are append-only. The current price is the latest entry and older ones stay visible.
- **VAT handling.** The menu price is entered incl. VAT (9% or 21%); all calculations use the price excl. VAT. Every price on screen is labelled "incl. VAT" or "excl. VAT".
- **Backup.** The *Data* page exports all data as one JSON file, imports it back (atomic: a bad file changes nothing) and resets to the demo data.
- A step-by-step user guide in English, Dutch and Russian is built into the app: **Help**. It opens in the language of the screen (EN/NL); Russian is chosen by hand. The pictures show the light theme, with Dutch screenshots for the Dutch guide.

| Simulator with three scenarios | Recipe with a prep |
|---|---|
| ![Simulator: Baseline compared with three scenarios](docs/screenshots/simulator.jpg) | ![Recipe: Classic Burger uses the Burger sauce prep and shows its cost summary](docs/screenshots/recipe.jpg) |

| Ingredient price history | On a phone (375 px) |
|---|---|
| ![Price history dialog of an ingredient](docs/screenshots/ingredient-history.jpg) | ![Dashboard on a 375 px wide screen](docs/screenshots/mobile-dashboard.jpg) |

## Important to know

- **Contribution is not profit.** "Contribution" is the menu price excl. VAT minus the recipe-based ingredient cost. It is *before* labour, rent and all other costs. MenuPilot never calls it profit.
- **Ingredient cost is theoretical.** "Recipe-based ingredient cost" is what the recipe should cost, not what was actually used (waste and over-portioning are not measured).
- **Scenarios are not forecasts.** They are calculations on the numbers you type, including your own monthly sales estimate. MenuPilot does not predict demand.
- **In the public demo, your data lives in your browser.** There is no account. Clearing browser data, or using private mode, can erase it. Export a backup regularly.
- **Browser previous versions:** Data and recovery keep up to 10 versions within 1 MiB; restoring creates a new revision. A seven-day Export reminder starts with your own changes. Clearing the browser deletes this history too; only a backup file kept elsewhere protects against that loss.

## How MenuPilot differs

Tools such as Apicbase, meez, MarketMan and Restaurant365 are broad restaurant operations systems (inventory, purchasing, POS and more), built mainly for multi-location businesses. MenuPilot is deliberately much smaller: a fast scenario calculator for a single restaurant. In the public materials I looked at, I did not find an interface that compares a Baseline with scenarios A/B/C for one dish side by side. That is a statement about what I found, not a claim that no such feature exists anywhere. This is not a comparison of quality or price.

## Architecture

```
  Screens (React 19, Tailwind v4, shadcn/ui)       src/ui/pages, layout, dashboard, simulator
        │
  Typed adapter (readonly TS types, BigInt results) src/ui/domain/*.ts
        │
  ┌─────┴───────────────┐
  │ src/calc  (pure)    │  all formulas, BigInt, no I/O, no DOM
  │ src/store (JSDoc JS)│  validation, versioned JSON document, import/export
  └─────────────────────┘
        │
  localStorage  (static app, no backend, deployed to GitHub Pages)
```

- The store is the single source of truth. A command runs outside React's reducers; on success the new document replaces the one on screen, on failure the screen keeps the old document and shows the error.
- Only the document is saved. Calculation results are derived with `useMemo` and never stored.
- Hash routes (`#/`, `#/ingredients`, `#/recipes`, `#/recipe/:id`, `#/simulator/:id`, `#/data`) work on GitHub Pages.
- Planning documents (product spec, architecture, implementation plan) are in [docs/planning](docs/planning/).

## Money and rounding

- Money is stored as **integer euro cents**. No floats are used for money, and user decimals are parsed from strings, never with `parseFloat`.
- Inside `src/calc` costs are **integer micro-euros** (1 € = 1 000 000 µ€) in `BigInt`.
- The only rounding operation is `roundDiv`: division rounded **half away from zero**, the same for positive and negative numbers. It is applied only at the points listed in the rounding contract (section 6 of [03_ARCHITECTURE.md](docs/planning/03_ARCHITECTURE.md)), for example once per recipe line and when a value is shown in cents.
- Scenario differences are computed from the displayed (already rounded) values, so the screen always adds up.

## Run locally (preview)

Requires macOS or Linux and **Node 24.15.0 LTS** (tested patch; SQLite 3.51.3).
Newer 24.x and Node 25.8.1+ in the 25.x series are accepted; 25.8.1 is also tested.
This raises the project tooling minimum above Vite's minimum. No new dependencies.
[Node 24.15.0 release](https://nodejs.org/en/blog/release/v24.15.0).

```sh
npm ci
npm start
# Open the complete private address printed above (#k=…) — stop with Ctrl+C
```

The first local launch starts empty. Add an ingredient, or choose Data → Reset to
demo data. The UI builds when needed. Only the server writes the SQLite database;
a second server using the same folder refuses to start and prints the first address.

Data stays outside the checkout: macOS `~/Library/Application Support/MenuPilot`,
Linux `$XDG_DATA_HOME/menupilot` (default `~/.local/share/menupilot`). Override with
`MENUPILOT_DATA_DIR=/absolute/local/path`; change the port with `MENUPILOT_PORT=4711`.
Use a local disk folder, not a network or cloud-synced folder. The header shows the
canonical data path. Updating the checkout does not replace this data.

Lock recovery is automatic for a dead process, a reused PID, an incomplete lock
older than 5 seconds, or an orphaned `lock.guard` older than 30 seconds. A separate
`lock-coordinator.sqlite` serializes recovery; do not delete it. A live owner is
never displaced merely because it stops answering HTTP. The console always gives
**Data folder**, **Lock file**, and one next step:

- **Already running** (verified matching instance): run `npm run menupilot -- open-url`.
- **Lock looks stale or MenuPilot is still starting**: stop the existing MenuPilot
  process, then run `npm start` again.
- **Incomplete lock**: wait 5 seconds, then run `npm start` again.
- **Lock maintenance interrupted**: wait 30 seconds, then run `npm start` again.
- **Cannot verify process identity**: allow process inspection, then run `npm start` again.

To migrate: Export in the browser version, then Data → Import backup locally.
Review the counts and confirm replacement. A browser export gets a new local
dataset identity; there is no merge or synchronization. Keep the original file.
Local history retains up to 32 versions within 64 MiB. Automatic SQLite backups
are described below; keep exported files for longer-term archives.

After restarting the server, an open page preserves drafts and asks you to copy
unsaved input before reloading. An interrupted write may have committed: reload
the latest data before submitting a new command. There is no offline write queue.

Local security (D2): `npm start` prints a private, one-use address ending in
`/menupilot/#k=…`, valid for 15 minutes. Open the complete address. The login script
replaces the current session-history entry before exchanging the secret. This does
**not** guarantee erasure from browser history or sync, crash recovery, or terminal
scrollback. Consumed, replaced or expired links cannot be reused.

The exchange returns a separate token for each session. The UI stores it in
`sessionStorage`, which is isolated by origin **including the port**, and sends it
as Authorization for config and API requests. The HttpOnly, SameSite=Strict cookie
(Path `/menupilot/`) only unlocks HTML containing no secrets. A cookie captured by
another loopback port cannot fetch the config/token or read/write the API.
Sessions expire after 10 hours absolutely or 1 hour without authorized requests.
An open page polls the server, so the absolute deadline still applies. A new tab
without sessionStorage needs its own sign-in address. Closing a tab normally
clears sessionStorage, but browser session recovery may restore it.

For another tab/browser, an expired link, or after a server restart:

```sh
npm run menupilot -- open-url
# Open the browser AND revoke all existing sessions:
npm run menupilot -- open-url --revoke-sessions
```

Use the server's `MENUPILOT_DATA_DIR` if set. Every `open-url` call uses the private
CLI token to ask the server to open the browser with a new one-use secret; the CLI
receives only `{opened: true|false}`, never the URL or secret. Previous links become invalid. Existing
sessions remain valid unless revoked or expired. Restart invalidates every session.
Launch keys are not saved in data files: the server holds them in memory and prints
the initial key in the `npm start` terminal. Browser opening briefly passes the key
in a process argument, visible to a process running as the same user.
The CLI `token` file is replaced with mode 0600. At most 128
sessions are retained; a further sign-in evicts the oldest remaining session.

### Read data from the terminal

With `npm start` running, use `npm run menupilot -- status`, `what-changed --since 30d`,
`dishes`, `dish <id|exact name>`, `ingredients`, `ingredient <id|exact name>`, `preps`,
`simulate --dish <id|exact name>`, `history`, `journal`, or `backups`. Add `--json` for
the versioned machine-readable contract and `--locale nl` for Dutch display formatting.
For examples, search rules, exit codes and JSON details, see [docs/cli.md](docs/cli.md).
These read commands require the server and its private 0600 CLI token; if it is stopped,
the CLI says to run `npm start`. `doctor` also reports local checks when the server is stopped.
Run `npm run menupilot -- doctor` to check the Node version, database, token, folder,
port, lock and backup freshness; a failing check returns exit code 1.

The server binds only to 127.0.0.1. Exact Host checks prevent DNS rebinding;
`localhost` at the page URL shows a short instruction to use 127.0.0.1. All API
reads require a token. Foreign and `null` Origins are rejected; UI POST requires
the server's exact Origin. CLI-token POST may omit Origin; raw writes remain denied.
CSP permits only same-origin scripts, forbids frames, forms and external connections;
inline styles remain allowed for UI layout. CORP/COOP are same-origin. Responses
use nosniff/no-referrer; HTML, config and API use no-store. Only listed routes,
methods and build files are served. Build assets are read into memory at startup;
rebuilding or deleting dist files does not change the running server's snapshot.
Request-handler failures, including errors while sending an error response, are
contained without terminating the server.

JSON bodies are limited to 15,100,000 UTF-8 bytes (5 million UTF-16 units can need
15 million bytes, plus command metadata); login/open-url bodies to 1024 bytes.
Header/body deadlines are 10/15 seconds, keep-alive 5 seconds (Node may add a
1-second socket buffer), at most 32 connections and 100 requests per connection.
Local DoS remains possible: another process can repeatedly fill all 32 connections
and deny access even though idle connections time out. These limits bound resources;
they do not guarantee availability against a hostile local process.

Diagnostics in `logs/server.log` contain timestamps, fixed event names, levels,
numeric HTTP status and optional fixed denial reasons (`host`, `origin`, `sign-in`,
`token`, `size`): no URLs, tokens, cookies, secrets, arbitrary error text or documents.
Rotation keeps three files total, at most 1 MiB each.
`MENUPILOT_LOG_LEVEL=off|error|warn|info` controls logging (default `warn`, so successful
polling does not displace denial events). The SQLite journal is separate: deleting
an unused ingredient records its ID, name and price-entry count and saves the
pre-change document in bounded version history.

This protects against hostile websites, unauthenticated loopback clients and other
OS users who cannot read private files. **A leaked UI token grants full read/write
access** until expiry, revocation or restart: Origin can be forged by a native client.
The launch secret grants a session while valid. This does not isolate data from a
process running as your user (it can read 0600 files and SQLite), root, page-capable
extensions or a compromised browser. Cookie theft alone no longer grants API access.
HttpOnly does not prove human approval against an agent with your OS access.
CLI reads and diagnostics (D4) and owner-confirmed proposals (D5) are implemented.
Installation polish (D6) remains.
D3 implements automatic backups and the emergency recovery command below.

## Local backups and recovery

After a saved change, MenuPilot starts a verified SQLite snapshot after four minutes,
leaving one minute to meet its **five-minute recovery-point target**. It also copies
pending changes on normal shutdown and on the next startup after a crash. The pending
flag is stored in the database. The server must be running for scheduled work; sleep,
slow disks, unavailable storage and errors can delay it. The local-mode header shows
last backup time, pending changes, failures and a warning after five minutes. Check
that warning: the five-minute target is not a guarantee when copying cannot finish.
No-change days also get a daily copy while the server is running. Each scheduler cycle
compares elapsed time with the system clock. A forward or backward clock jump pauses
automatic deletion in both folders and shows a warning; new copies continue using
elapsed time, even if an older copy has a future date. The pause survives restarts.
Check the date, verify your copies and manually archive older files if the budget
fills; correcting the clock does not silently authorize deletion again.

Copies live in `backups/` inside the data folder. A copy appears in `backup list` only
after SQLite finishes, `integrity_check` and document validation pass, and a temporary
file is flushed and atomically renamed. Each file contains its dataset ID, revision,
time and database structure version. Keep all snapshots from the last 24 hours plus
one per day for 14 older days, plus a verified spare behind the newest copy. Before
rotation, MenuPilot restores candidates into temporary databases and checks them.
It publishes a replacement before retiring older copies. Damaged copies move to
`quarantine/`, do not count as restore points, and trigger a warning; they still count
against the storage budget and are never automatically deleted. A verification that
cannot run (for example, because the temporary disk is full) stops rotation.
The hard limit is **512 files / 2 GiB** (whichever is
reached first); when the retention window cannot fit, copying fails visibly instead
of silently discarding recent restore points. Archive older files outside `backups/`
and free disk space if this happens. A full disk rejects writes without confirming
success; the previous committed document remains. Files left with `.partial` are not
backups and are cleaned up on restart. History/receipts/journal have separate budgets.

Import, reset, history restore, backup restore and database migration first create a
verified copy under the writer queue. No other save can enter between that copy and
the replacement. If the copy fails, the replacement is refused. Ordinary saves can
continue while automatic copies are failing, with a visible warning.

For a second location, **create the destination folder first**, then start with:

```sh
MENUPILOT_BACKUP_DIR="/path/to/external-or-cloud-folder" npm start
```

MenuPilot copies only ready, verified snapshots into a private `menupilot-<installation-id>`
subfolder, checks the destination copy, then publishes it atomically. It retries failures
with backoff (1 second up to 5 minutes). The UI shows the last completed external copy
and warns if none is confirmed within 24 hours. The same retention and size limits apply.
**A file written into a cloud folder does not prove cloud synchronization.** A folder
on the same disk is not protection against disk loss. Check the sync client's own status.
Known cloud/network data paths warn at startup; path/filesystem detection is a heuristic,
not proof that a folder is safe. Keep the live database on a local disk.

Run these commands while `npm start` is running, using the same `MENUPILOT_DATA_DIR`
if you set one. IDs come from the list (they are not file paths):

```sh
npm run menupilot -- doctor # backup health, clock and damaged-copy warnings
npm run menupilot -- backup list
npm run menupilot -- backup verify <id>
npm run menupilot -- backup restore <id>
# Scripts only, after reviewing the selected ID:
npm run menupilot -- backup restore <id> --yes
```

`verify` actually restores into a temporary database and checks its integrity, format
and documents. Run it after upgrades and periodically (for example monthly) for the
copies you rely on. `restore` asks for confirmation, copies the current state first,
then puts the selected document through the normal CAS write protocol. It creates a
**new revision**, journal entry and operation receipt; it does not replace the live
file or roll back the revision counter. A concurrent edit cancels the restore. A lost
response may mean the restore completed: inspect current data before another attempt.
Without the server, these commands say to run `npm start`.

If the main database is corrupt and the server cannot start, use the separate offline
emergency procedure:

1. Stop MenuPilot. Keep the data folder and its `.db`, `-wal` and `-shm` files together.
2. Choose a backup ID from a previous list, or from a `backups/<id>.sqlite` filename.
   If only an external copy survives, copy that complete `.sqlite` file into the data
   folder's `backups/` first. Never copy an active database file from a running server.
3. Run `npm run menupilot -- doctor --recover-from-backup <id>` and confirm `RESTORE`
   (`--yes` is available for scripts). A running server prevents this operation.
4. The command verifies the copy, preserves the original database and sidecars in a
   neighbouring `recovery-<id>/` folder, installs the recovered database and writes
   `report.json` there. Run `npm start` and check the ingredients and recipes.

Emergency recovery creates a **new dataset identity**, invalidates old receipts/plans,
and records the recovered revision in its report. It cannot know the highest revision
lost from the damaged database; changes after the chosen snapshot are lost. Unlike a
normal restore, it is a physical replacement. If interrupted, normal startup refuses
while `recovery-pending.json` exists: repeat the same doctor command; do not delete
that marker or the preserved originals. Recovery archives are never automatically
deleted; review and archive them yourself after checking recovery.

| Event | Protection and limit |
| --- | --- |
| Application crash | Confirmed SQLite commits use WAL + FULL; startup backs up pending changes. SIGKILL tests do not prove hardware power-loss durability. |
| Accidental replacement | Verified pre-change copy and bounded version history; restoring creates a new revision. |
| Main database lost/corrupt | Target ≤5 minutes with healthy storage and a running server. Use the visible last successful copy, not an assumed schedule. |
| Device/disk lost | Local copies are lost too. Only a sufficiently recent independent external copy helps; cloud sync is not verified by MenuPilot. |
| Disk full / destination unavailable | No false successful save; refused destructive operations, visible copy errors and retries. Copy freshness can exceed the target. |
| System clock jumps forward or backward | Every scheduler cycle compares wall and monotonic time. Deletion pauses in both folders, including after restart; daily copies continue. The UI and doctor warn. The budget still applies; archive old copies manually if needed. |
| A snapshot becomes corrupt | Rotation restore-tests candidates, isolates damaged files and preserves a verified spare. No protection if every copy is damaged or the whole disk is lost. |

## Testing

```sh
npm test          # test:core (node:test) + test:ui (Vitest, Testing Library, jsdom)
npm run check     # typecheck + all tests + production build
npm run test:mutations # six intentional defects must be caught (also in npm test)
npm run test:server # SQLite/HTTP contract, process lock, transaction and security tests
npm run test:e2e:local # Local server, desktop + 375 px, restart and migration
npm run test:e2e  # Playwright on Chromium against production preview under /menupilot/
```

`npm run check` intentionally skips Playwright to keep the fast local check quick. `npm run test:e2e:install` installs Chromium for local runs. Playwright runs Chromium at 1280×800 and 375×812 against the production build and blocks external network requests. CI runs these browser tests on pull requests and branches, and on `main` before uploading the GitHub Pages deployment artifact. Failed CI runs retain the HTML report, screenshots, and traces as an artifact.

Playwright uses `retries: 0`; a failure is reported immediately with its trace and screenshot so flaky behavior stays visible. The fast check currently covers 161 core tests and 363 UI tests. The E2E suite has 21 Chromium tests across desktop and 375 px projects. Keep the manual browser check for changes to screens: inspect desktop and 375 px layouts, keyboard and focus behavior in dialogs, and field validation messages.

Calculation changes are written test-first. Unit and UI tests use in-memory storage; e2e starts each test with clean browser storage and exercises the real local production preview without external services.

## Run locally

```sh
npm ci            # install the exact locked dependencies
npm run dev       # development server, http://localhost:5173/
npm run build     # production build into dist/ (base path /menupilot/)
npm run preview   # serve dist/ at http://localhost:4173/menupilot/
npm run typecheck # tsc --noEmit
npm run check     # typecheck + tests + build
npm run test:e2e:install # install Playwright Chromium
npm run test:e2e  # production build + Chromium end-to-end tests; no retries
```

Money input accepts a decimal comma or point and rejects thousands separators.

## Requirements

- **Node.js** `^24.15.0` or `^25.8.1` (local preview needs built-in SQLite with the WAL fix; CI uses Node 24.15.0).
- **Browsers** (set by Tailwind CSS v4): Safari 16.4+, Chrome 111+, Firefox 128+.

## Deployment

Every push to `main` runs typecheck, tests and build in GitHub Actions (`.github/workflows/pages.yml`) and publishes `dist/` to GitHub Pages at `/menupilot/`. Other branches and pull requests run the same checks in `ci.yml`.

## Authorship

**MenuPilot is original work by GadzhaProd.** The product idea, scope and every stage were defined and approved by the product owner; the code was written for this project by AI coding agents working under that direction. The calculation core (`src/calc`), the data store and validation (`src/store`), the Profit Simulator, the Dashboard, the built-in Help guide and all screens were built from scratch for MenuPilot.

The plan, architecture decisions and agent rules are public: [docs/planning](docs/planning/) and [AGENTS.md](AGENTS.md).

**Built with open-source tools.** Like any modern web app, MenuPilot runs on open-source libraries — React, Vite, Tailwind CSS, Radix UI, lucide-react and others, pinned to exact versions. Their licences require a notice, so they are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), together with:

- [shadcn/ui](https://ui.shadcn.com) base components (MIT) in `src/components/ui/`;
- two small MIT-licensed components from [21st.dev](https://21st.dev) (Badge Delta, Alert with Action Buttons), adapted; licence texts in `third_party/21st/`.

**Inspiration.** The costing approach (base units, yield %, costs excl. VAT) was inspired by [kitchen-costing-for-claude-code](https://github.com/Enterprise-DNA-OS/kitchen-costing-for-claude-code) (MIT, Enterprise DNA). No code was copied from it.

## Demo data

The demo restaurant, its dishes, suppliers and prices are fictional.

## License

MenuPilot is released under the [MIT License](LICENSE) © 2026 GadzhaProd. Third-party code keeps its own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Let an agent propose a supplier price

With the local server running, an agent can run:

```sh
npm run menupilot -- propose add-price --ingredient "Beef mince 80/20" --pack-price 18,00 --pack-size 1 kg
npm run menupilot -- plans
npm run menupilot -- plan status <plan-id>
```

This is the **Supplier price excl. VAT, as on the invoice**. The command creates a proposal valid for 24 hours. It does not change the ingredient. Open MenuPilot using your terminal sign-in address: the “Awaiting your confirmation” panel shows the old/new pack and unit prices, affected dishes and preps, food cost, and monthly contribution change at your own volume estimates. Choose **Apply** or **Reject**, then confirm in the dialog. Missing volume and unknown costs are explicitly excluded. The interface supports EN/NL and mobile screens.

If any data changed after the proposal, or it expired, ask the agent to propose again. Approval appends exactly one price; repeat approval returns the original receipt. Unsaved recipe/ingredient drafts retain the existing protection against external changes. The static browser version has no proposal panel or API calls.

The CLI token cannot apply/reject plans. This workflow guards against agent mistakes and makes owner confirmation an explicit step. **It does not isolate a process with the user's full computer permissions**: a process running as the same user could intercept the one-use launch key while the browser opens (it is briefly visible in the process list), inspect process memory, or modify data files. Normal commands and API responses do not disclose the window key; this is protection against agent mistakes, not malicious software.
Agents must never open or apply their own plans or access data files directly (see AGENTS.md).
If opening the browser fails, open the address in the terminal running `npm start`, or restart `npm start`. Other websites cannot approve through the browser: the API requires a UI session, exact Origin and local Host, and provides no CORS access. See [CLI commands and JSON contract](docs/cli.md).

| Who | Normal local workflow |
|---|---|
| CLI / agent | Read and propose. Normal commands/API responses do not disclose the window key; the CLI token cannot apply/reject. A same-user process could intercept the brief browser-launch process argument or modify data files. |
| MenuPilot window | Review, confirm apply or reject using its UI session and same Origin. |
| Another website | Cannot read or approve through the browser: Origin, Host and session checks reject it. |

This boundary prevents agent mistakes; it is not an OS sandbox against a process with the user's full permissions.

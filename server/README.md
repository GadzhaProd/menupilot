# Local MenuPilot

For the current capability and storage map, see [PRODUCT.md — Operating Context](../PRODUCT.md#operating-context).
For owner instructions, see [Run locally](../README.md#run-locally),
[Use with an AI agent](../README.md#use-with-an-ai-agent) and
[Local backups and recovery](../README.md#local-backups-and-recovery).
The old D1-only preview description is superseded: security, backups, CLI,
owner-confirmed proposals and installation/recovery guidance are implemented.

## Code map

- `start.js` checks the supported runtime before importing `node:sqlite`.
  `startLocal.js` owns startup, shutdown, the data-directory lock and SQLite.
  `build.js` rebuilds changed UI inputs with the same Node executable;
  Vite also emits the complete third-party license files.
- `http.js` serves an explicit build-file allowlist and the local API.
  `session.js` and `login.html` handle the one-use sign-in key and browser session.
  CLI and UI credentials have different permissions; writes requiring owner
  confirmation require a UI session. Origin/Host checks, CSP and framing headers
  defend the browser boundary. The data-free `/menupilot-instance` probe checks
  the lock owner. This is not isolation from software running as the same OS user.
- `sqlite.js` implements transactions, revision checks, history, operation receipts
  and storage budgets. `src/store/remoteAdapter.js` owns per-client revision state;
  `httpAdapter.js` adds HTTP retries. Calculation code remains shared with the
  browser version.
- `backups.js`, `backupFiles.js` and `recovery.js` provide verified SQLite snapshots,
  retention, an optional second destination and recovery. Replacement operations
  first require a verified copy. See the main README for limits and failure cases.
- `cli.js`, `cliRead.js` and `cliPlans.js` provide supported reads, calculations,
  diagnostics, lifecycle/backup commands and supplier-price proposals. Human
  output escapes terminal control characters; JSON retains original strings.
  [CLI reference](../docs/cli.md) describes commands and the versioned JSON contract.
- `plans.js` stores price proposals and validates their dataset/revision and
  24-hour expiry. Apply/Reject happens in the owner’s window; CLI credentials
  cannot approve or reject. Approval appends a price and records a receipt.

[Architecture](../docs/planning/03_ARCHITECTURE.md) covers transaction order,
receipt semantics, lock recovery, storage and security constraints. D1 headings
there describe the foundation, not the full current capability set.

## Verification

Server tests and mutation checks run inside `npm test` / `npm run check`.
Separate commands: `npm run test:server`, `npm run test:mutations`,
`npm run test:e2e:local`. Tests use isolated temporary databases and browser
storage, including real child processes; they do not simulate physical power loss.

The CLI accepts a test clock only when both `MENUPILOT_TEST_CLOCK=1` and
`MENUPILOT_TEST_NOW` are set. `MENUPILOT_TEST_NOW` must be an ISO UTC instant
with milliseconds, such as `2027-12-31T12:00:00.000Z`. These variables are for
tests only; ordinary CLI use follows the system clock.

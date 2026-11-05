# Local MenuPilot server

This directory implements the optional single-owner local mode. For product and
storage capabilities, see [PRODUCT.md](../PRODUCT.md#operating-context). Installation,
security limits and recovery instructions live in the [main README](../README.md#run-locally);
commands and JSON contracts live in the [CLI reference](../docs/cli.md).

## Module map

| Module | Responsibility and boundary |
| --- | --- |
| `start.js`, `runtime.js` | Check the supported Node runtime before loading SQLite. |
| `startLocal.js` | Own startup and shutdown: stop accepting writes, drain storage and create the final backup, close HTTP, release the writer lock. |
| `lock.js` | Canonical data directory and single-writer ownership; recover only with evidence that the old process is gone. |
| `build.js` | Fingerprint trusted UI/build/license inputs and rebuild with the current Node executable. |
| `http.js` | Explicit method/path/role/handler tables, request limits, Host/Origin checks, security headers and an in-memory build-file allowlist. |
| `session.js` | One-use launch keys, separate browser bearer/cookie credentials and private token-file publication. |
| `login.html`, `login.js` | Sign-in page and fragment exchange; remove the launch key before exchanging it. |
| `openBrowser.js`, `log.js` | OS browser launch and bounded diagnostics that exclude credentials and request payloads. |
| `sqlite.js` | Atomic document/history/journal/receipt writes, dataset/revision CAS, append-only transition checks and retention budgets. |
| `plans.js` | Proposal lifecycle, dependency checks and owner approval against the reviewed consequences fingerprint. |
| `planEffects.js` | Derive proposal consequences through the shared calculation core; encode exact amounts for transport. |
| `backups.js` | Serialize writes and snapshots in one queue; schedule backups, external copies and final shutdown capture. |
| `backupFiles.js` | Publish verified SQLite snapshots, restore-test them, quarantine corruption and retain recovery points within budgets. |
| `recovery.js` | Guard emergency recovery and preserve originals before replacing database files; warn about sync/network locations. |
| `cli.js`, `cliRead.js` | CLI transport, exit codes, safe terminal output, reads, shared calculations and local diagnostics. |
| `cliPlans.js`, `cliSecurity.js` | Supplier-price proposals and their presentation; reject capability-bearing open-url responses. |

The calculation and document validation rules remain shared with `src/calc/` and
`src/store/`. The browser adapter keeps each client's observed CAS version; the
server is the only database writer. See [architecture](../docs/planning/03_ARCHITECTURE.md)
for transaction and receipt invariants.

## Verification

`npm run test:server` checks isolated temporary databases and real child processes.
`npm run test:mutations` checks that disabling individual protections fails their
tests; the neutral comment control deliberately survives. Both run within
`npm run check`. `npm run test:e2e:local` exercises the local browser flow. These
checks do not simulate physical power loss.

The CLI accepts a test clock only when both `MENUPILOT_TEST_CLOCK=1` and
`MENUPILOT_TEST_NOW` are set. The latter must be an ISO UTC instant with milliseconds,
for example `2027-12-31T12:00:00.000Z`. Normal operation uses the system clock.

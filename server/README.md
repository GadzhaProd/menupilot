# Local preview (D1)

`start.js` checks the runtime before importing `node:sqlite`. `startLocal.js` owns
startup/shutdown, the data-directory lock, the token and the SQLite connection.
`build.js` hashes build inputs and the Node version; a changed/missing stamp builds
with the same Node executable. `http.js` serves only the build allowlist and five
API routes. `sqlite.js` implements transactions, history, receipts and budgets.
`src/store/remoteAdapter.js` owns per-client CAS state; `httpAdapter.js` adds HTTP
retries. No calculation code or dependency was added.

See [the protocol in architecture](../docs/planning/03_ARCHITECTURE.md#локальный-режим-d1)
for transaction order, receipt semantics, lock recovery and retention limits.

Tests: `npm run test:server`, `npm run test:e2e:local`,
`node test/server/mutations.js`. All data goes into disposable temporary directories.
The server tests include real child processes; they do not simulate power loss.

D2 owns Origin/CSP/framing and complete security review. D3 owns independent
backups, restore verification and disk/power-failure exercises. D4/D5 own CLI and
owner-approved proposals. D6 owns installation/doctor/recovery guidance. The D1
`plans` table is empty and has no read/write API; it cannot accumulate entries.

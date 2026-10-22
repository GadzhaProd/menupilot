# D5 verification — 2026-10-22

Implemented supplier-price proposal plans, CLI read/propose commands and local-only EN/NL owner approval. No dependencies, SQL schema version, document format or calculation modules changed. DB v2 already contains the required plans table; no migration is necessary.

## Commands actually run

Final `VITEST_MAX_WORKERS=2 npm run check` exited 0:

```text
> tsc --noEmit
ℹ tests 195
ℹ pass 195
ℹ fail 0
Test Files 36 passed (36)
Tests 391 passed (391)
ℹ tests 125
ℹ pass 125
ℹ fail 0
89 mutation checks: CAUGHT
✓ 2117 modules transformed.
✓ built in 262ms
```

Final `npm run test:e2e` exited 0: `23 passed (10.6s)`.
Final `npm run test:e2e:local` exited 0: `4 passed (32.1s)`.
`git diff --check` exited 0.

Chromium and process-identity tests require execution outside the macOS sandbox. The first sandboxed attempts failed with Chromium MachPort permission denied / `lock-uncertain`; full final runs above were outside the sandbox. Build emits its existing >500 kB chunk warning. Tests also emit Node localStorage-file / Playwright NO_COLOR warnings; no test failures remain.

## Coverage

- CLI cannot apply/reject, including with the exact Origin; UI bearer without/with foreign Origin is refused.
- Fixed normalized cents, pack size, price sequence/time, plan/op IDs; exact/NFC/case-folded lookup, ambiguity candidates, incompatible units, comma, zero, negative and unsafe prices.
- Document ID and revision staleness, exact 24-hour expiry, rejection and durable replay after another write/reopen.
- Failure at the final plan UPDATE rolls back the appended price, revision, history, journal and receipt.
- Before/after Dashboard parity through three prep levels, no-volume exclusion and null unknown cost.
- Pending count, individual/total bytes and terminal retention budgets.
- Ten new D5 mutants are caught: approval gate, revision/identity gates, expiry, replay, atomic commit, pending/byte limits, impact direction and compatible units. Existing 79 mutants still caught.
- Local e2e: actual CLI proposal → subscribed panel → keyboard confirmation → Dashboard cost; rejection leaves the dish unchanged; applying while editing preserves an owner's unsaved recipe on desktop and 375 px.
- UI tests: confirmation is required, focus is in dialog, apply success, rejection, stale/expired cards, stale failure remains visible.

## Real browser (bb browser-automation)

Session used local headless Chrome on host_mqe28unaid, production assets under `/menupilot/`, with a disposable SQLite data folder and real HTTP/CLI. A temporary clock offset was injected only into this isolated storage fixture to exercise expiry; no production clock controls were added.

Verified EN/NL at 1280×900 and 375×812; no horizontal overflow; Tab and Shift+Tab inside the Radix dialog, Escape returns focus to Apply/Toepassen, Enter reopens it. Applied a real proposal; another pending proposal became stale. Expired a plan while its confirmation dialog was open: confirmation returned the localized expiry error, without changing the ingredient.

Screenshots and full command logs are retained in the BB thread artifact folder:
`/Users/gadzha/.bb/thread-storage/thr_ae7jmeh9n6/d5-verification/`

Files: `en-desktop.jpg`, `nl-desktop.jpg`, `en-375.jpg`, `nl-375.jpg`, `dialog-nl-375.jpg`, `stale-nl-desktop.jpg`, `expired-dialog-nl-desktop.jpg`, `expired-dialog-nl-375.jpg`, `expired-en-desktop.jpg`, `expired-en-375.jpg`, `keyboard-focus.json`, `check.log`, `e2e.log`, `e2e-local.log`.

## Implementation boundaries

`src/store/price.js` only extracts former `newPrice` construction and ingredient lookup/append; store validation/clock-backwards/zero-price behavior is unchanged. Plan application reuses it and the existing SQLite validation/write path. Plans share the D3 backup queue and mark metadata mutations dirty for backup. The 2 MiB budget reserves 1 KiB per plan for the eventual receipt and lifecycle timestamps.

Pending plans expire at 24 hours. Terminal plan retention is bounded (200 plans, 2 MiB, seven days after expiry), so plan replay is guaranteed within retention, not forever. Lifecycle cleanup is lazy on access. Costs use the current pre-proposal catalog; comparing with Dashboard requires the matching comparison point, not necessarily its default 30-day date.

CLI-vs-UI separation guards against agent mistakes and other browser sites. It is not a security boundary against a local process with full user privileges. Independent coordinator/reviewer review remains separate from this implementation report.

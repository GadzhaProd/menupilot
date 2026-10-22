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

## Coordinator review follow-up — 2026-10-22

Status: complete. Security fix committed separately from plan/CLI and panel fixes.

- CLI open-url returns `{opened}` only, invokes the OS launcher without a shell, and never returns a capability URL. Launch keys are no longer written to data files. An automated regression reads fixture files and probes routes using only CLI credentials; the capability-leak mutation is caught. E2E sign-in reads startup stdout.
- New proposals supersede pending proposals for the same ingredient atomically. Invalid proposals preserve their predecessor. Agent prices are capped at €100,000; zero and exact unit-price ratios beyond ×3 produce EN/NL warnings. Journal includes plan/ingredient IDs; stale/expired refusals use HTTP 409.
- CLI money objects follow D4 for propose/list/status, with one snapshot for list/version. Human quantities accept 1kg, show 2,5 kg and unit prices, and localize the owner-confirmation text. Ingredients no longer print object coercions.
- Panel shows three pending cards at most, paging, confirmed Reject all and one dismissible inactive summary. One panel status region, timed success messages, shared VAT labels, Dutch Bijdrage terminology and non-wrapping money values. Zero/×3 warnings appear in card and dialog.

Final actual output (all exit 0):

```text
VITEST_MAX_WORKERS=2 npm run check
> tsc --noEmit
ℹ tests 195 / pass 195 / fail 0
Test Files 36 passed (36)
Tests 399 passed (399)
ℹ tests 132 / pass 132 / fail 0
101 mutation checks: CAUGHT
✓ 2117 modules transformed.
✓ built in 267ms
npm run test:e2e
23 passed (14.8s)
npm run test:e2e:local
4 passed (30.8s)
```

Earlier check stopped on an obsolete mutation target for the removed launch-URL validator; replaced with a mutation allowing extra capability fields in `{opened}`. An earlier mobile local E2E exposed test navigation racing the asynchronous sign-in reload; it now waits for the old session warning to disappear. Final full runs above passed. Existing >500 kB chunk, Node localStorage and NO_COLOR warnings remain.

Artifacts: `/Users/gadzha/.bb/thread-storage/thr_ae7jmeh9n6/d5-verification/review/` — complete logs and panel/dialog EN/NL screenshots at desktop/375 px, visible ×3 warning, NL expired refusal, inactive summary and keyboard focus. In Chromium, Tab stayed inside the dialog, Escape returned focus to Apply (or the panel heading once a card was inactive), 375 px had no horizontal overflow, and negative money stayed on one line. Expiry uses a controlled fixture only; no owner data was accessed.

### Отчёт владельцу
1. Исправлена граница CLI/UI, очередь предложений и панель подтверждения.
2. Агент больше не получает ссылку входа через штатную команду; необычные цены заметны до подтверждения.
3. Агент предлагает, владелец проверяет последствия и подтверждает в MenuPilot. Повторное предложение заменяет старое, не меняя цену само.
4. В локальном режиме предложить цену через CLI, проверить карточку, открыть диалог и применить либо отклонить. Для нескольких ингредиентов доступно «Отклонить все». Цена 0 или изменение более ×3 показывает предупреждение.
5. Все обязательные проверки прошли; фактические результаты указаны выше.
6. Не осталось известных незакрытых пунктов ревью. Это защита от ошибок в штатном процессе, не изоляция от процесса с полными правами пользователя. Зависимости, формат документа и src/calc не менялись.

| Кто | Что может штатно |
|---|---|
| CLI/агент | Читать и предлагать. Не получает UI-токен; не применяет и не отклоняет. Правила запрещают открывать свои планы и обращаться к файлам данных. |
| Окно MenuPilot | Через UI-сеанс и правильный Origin подтверждать применение/отклонение. |
| Другой сайт | Не читает и не подтверждает через браузер: мешают Origin/Host/сеанс. |

Агент с полным shell-доступом теоретически может обойти процесс (например, изменив БД); это прямо отражено в README/CLI и AGENTS.md.

## Final review polish — 2026-10-22

README, CLI docs and the permissions table now distinguish the supported API from same-user OS access: normal responses do not disclose the window key, but a process with the user's permissions can intercept its brief browser-launch process argument or modify data files. Agent rules and mandatory UI confirmation protect against mistakes, not malicious same-user software.

Added regression tests for both pack/unit VAT labels in EN/NL and startup removal of an existing legacy launch-secret. Both mutants are caught; the new UI mutation first runs a clean baseline in the disposable copy. NL human output uses Foodcostpercentage/uitgesloten and Dutch exclusion reasons; both old and new unit prices show /kg, /l or /pc. Mobile below 640 px shows one pending card with paging; desktop retains three. The resize/paging test reproduced the former mobile behavior before the fix.

Final clean `VITEST_MAX_WORKERS=2 npm run check` exited 0:

```text
> tsc --noEmit
ℹ tests 195 / pass 195 / fail 0
Test Files 36 passed (36)
Tests 402 passed (402)
ℹ tests 133 / pass 133 / fail 0
103 mutation checks: CAUGHT
✓ 2117 modules transformed.
✓ built in 264ms
```

The initial attempt stopped because the new UI mutation copied `vitest.config.ts` instead of the repository's `vitest.config.js`; the corrected full run above passed. Existing chunk-size/Node warnings remain.

Browser verification used four isolated proposals: desktop rendered three cards, 375 px rendered one, “3 more” advanced to the next card and “2 more”, NL VAT labels remained visible, and no horizontal overflow occurred. Tab remained in the confirmation dialog; Escape restored focus to Toepassen. Screenshots, focus output and complete command logs are in `/Users/gadzha/.bb/thread-storage/thr_ae7jmeh9n6/d5-verification/final-polish/`. The browser and fixture server were stopped and the temporary data directory removed.

Sequential final browser suites both exited 0:

```text
npm run test:e2e
23 passed (8.7s)
npm run test:e2e:local
4 passed (30.3s)
```

All final-review requests are complete. No calculation code, data schema or dependencies changed. No push/merge.

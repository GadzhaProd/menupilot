# Invoice-wide proposal confirmation

Implementation commits: `b589134` (server, calculation composition, CLI/docs) and
`2a364b7` (UI, translations, help and local browser test).

## What changed

- `POST /api/plans/review-all` returns the selected pending price rows and one
  combined consequence preview. `POST /api/plans/apply-all` accepts `planIds`,
  `consequencesFingerprint` and `opId`. Both routes require the existing UI session
  and same-origin protection; CLI tokens cannot use either route.
- One `BEGIN IMMEDIATE` covers lifecycle/dependency checks, the live combined
  calculation, fingerprint comparison, shared `appendPrice` calls on a private
  document, one storage save/revision/history entry/journal entry/receipt and all
  applied marks. The journal and receipt carry every `planId` in `planIds`.
- The fingerprint binds the sorted IDs, displayed ingredient/pack/warning data,
  combined effects, document identity and revision. A conflicting confirmation
  writes nothing and returns `409 plan-consequences-changed`. Duplicate ingredient
  selections are explicitly refused, including a superseded/replacement pair.
- Replaying the same operation returns its original receipt, also after a later
  edit and database reopen. Reusing the operation ID with different membership or
  a different fingerprint is refused. Existing operation retention budgets apply.
- The EN/NL panel offers Apply all when at least two proposals are pending. Its
  dialog lists every price, not only the currently visible paginated cards, and
  shows one combined result. After a conflict it reloads pending membership and
  effects, then requires another owner confirmation. A failed review disables
  confirmation; a lost apply response can retry the same operation ID.
- CLI `plans` includes the owner-only Apply all hint in text and the JSON
  `confirmation` field. Agent instructions, invoice recipe and EN/NL/RU help were
  updated. No dependency versions, document format or price-entry behavior changed.

## Calculation and TDD

`src/calc/planEffects.js::proposalEffects` is a pure composition of the existing
`dashboardData`, monthly-contribution, cost-change and impact functions. It moves
existing single-plan composition out of the server, and accepts a list of changed
ingredients to select their union of affected dishes and preps. It introduces no
new formulas, rounding points or floating-point monetary arithmetic. The server
wrapper only encodes exact values for transport.

The new test first failed because `proposalEffects` was absent, then passed after
implementation. It compares the simultaneous two-price result with Dashboard,
including shared ingredients, nested prep use, no volume, unknown cost and an
unaffected dish. Input documents are frozen. Server tests first failed because
batch review/apply were absent; UI tests first failed because Apply all was absent.
A separate failing test exposed the superseded/replacement duplicate case and
another exposed stale batch membership after a single apply in a second window.

## Verification coverage

- Shared/nested effects match Dashboard after applying all prices.
- Injected failure on the second applied mark restores every table, including
  document revision, first mark, receipts, journal, history and backup metadata.
- Both orders of single-apply/batch-apply competition, another window's revision
  with unchanged displayed effects, expiry, own-price edits, rejection,
  supersession, invalid lists, malformed bodies, duplicate ingredients and UI-only
  authorization are covered.
- Receipt replay, reusing an operation ID incorrectly, reopening the database,
  lost UI responses, stale review, failed review and refreshed pending membership
  are covered.
- Eight added mutation cases: fingerprint comparison, revision binding, pending
  state, duplicate ingredient, replay membership, transaction boundary, applying
  every selected price and UI-only route. Each runs with a green baseline and a
  neutral comment control. An initial surviving revision mutant exposed a test
  fixture gap (first-save document identity also changed); the added HTTP race on
  an already saved document kills that mutant.
- Local browser flow: three CLI proposals → EN and NL combined dialog → keyboard
  confirmation → one new revision → Dashboard parity. Chromium desktop and
  375 px; axe serious/critical violations must be zero.
- A real `bb browser-automation` session also checked the desktop EN dialog,
  375 px NL price list and totals, Tab, Escape, returned focus, Enter confirmation,
  no horizontal overflow and the updated Dashboard. Only a temporary isolated
  SQLite fixture was used. There are no new form fields; error handling is tested
  at the confirmation action.

## Environment notes

Node 25.8.1. `node_modules` is the requested symlink to the main checkout.
That shared installation lacks the already locked `@axe-core/playwright@4.14.0`.
For verification only, this exact package was installed under
`/tmp/menupilot-apply-all-axe` with scripts disabled. A temporary Node resolution
hook (`/tmp/menupilot-apply-all-axe-resolve.mjs`) loads it for Playwright via
`NODE_OPTIONS=--import=/tmp/menupilot-apply-all-axe-resolve.mjs`; neither the shared
installation nor package/lock files were edited. On a complete `npm ci`
installation the hook is unnecessary.

An initial full Chromium run had one pre-test page-load failure: the trace showed
HTTP 404 for `/menupilot/`, before ingredient-test actions. A later WebKit trace
identified the cause: server process tests rebuild the same `dist` while preview
browsers still use old chunk URLs (`RecipePage` / `NotFoundPage` returned 404).
The overlapping compatibility run was interrupted; browser suites were repeated
after server checks/builds, with one worker. The initial local run failed only on the
missing axe module; the focused desktop/mobile invoice flow passed after temporary
module resolution was configured.

## Completed commands

- `VITEST_MAX_WORKERS=2 npm run check:future` on the final implementation:
  `219` core passed, `45` UI files / `479` UI tests passed, `169` server passed;
  every failure count is `0`.
- `node --test test/calc/planEffects.test.js test/server/plans-all.test.js test/server/plans.test.js`:
  `tests 32`, `pass 32`, `fail 0`.
- `VITEST_MAX_WORKERS=2 npx vitest run test/ui/plans.test.tsx`:
  `Test Files 1 passed`, `Tests 24 passed`.
- `MENUPILOT_MUTATION_FILTER=apply-all node test/server/mutations.js`:
  `Mutation summary: 8 CAUGHT, 1 SURVIVED (includes neutral control)`.
  Only the neutral comment control survives.
- `npm run test:e2e -- --workers=1` with the temporary axe resolver:
  `31 passed (2.4m)` on the production `/menupilot/` preview.
- `npm run typecheck`: `tsc --noEmit`, exit `0`.

- `npm run test:e2e:local` with the temporary axe resolver:
  `10 passed (1.5m)`; both invoice-dialog axe checks passed with zero
  serious/critical violations.

- `VITEST_MAX_WORKERS=2 npm run check`: exit `0`; typecheck passed;
  `219` core, `476` UI and `167` server tests passed; production build completed
  (`built in 807ms`). This long run began before the final additional regression
  cases. Its mutation snapshot reported `128 CAUGHT, 2 SURVIVED`, comprising the
  neutral control and the revision-binding fixture gap described above. The final
  eight-case batch rerun killed every behavioral batch mutant, including revision
  binding. The final complete future-clock regression run above includes all later
  cases (`479` UI / `169` server).

- `npm run test:e2e:compat -- --workers=2` with the temporary axe resolver:
  `58 passed (5.0m)`, `4 failed`. All four failures were Firefox desktop axe
  cases exceeding the existing `30000ms` test timeout, not accessibility
  violations. These are repeated with
  `--last-failed --workers=1 --timeout=60000` below.

- `npm run test:e2e:compat -- --last-failed --workers=1 --timeout=60000`
  with the temporary axe resolver: `4 passed (1.8m)`; individual durations
  `26.1s`, `25.4s`, `25.3s`, `25.0s`. Together with the 58 passing cases above,
  every compatibility case has passed. The unchanged default 30-second deadline
  remains tight on this host with two Firefox workers.

## Artifacts

Logs and screenshots are in the BB thread storage directory
`thr_ztwzvhepim/apply-all/`: `check.log`, `check-future.log`, `mutants.log`,
`server-focused.log`, `ui-focused.log`, `e2e-chromium.log`, `e2e-local.log`,
`compat-full.log` and the compatibility retry log. Browser images include
`desktop-en.jpg`, `mobile-nl-prices.jpg`, `mobile-nl-total.jpg`,
`mobile-nl-dashboard.jpg`, and the Playwright EN/NL dialog screenshots for both
viewports. The temporary axe resolver is also copied there for reproducibility.

## Отчёт владельцу

1. **Что сделано.** Добавлена кнопка «Применить все» / «Alles toepassen» для
   нескольких ожидающих предложений, общее окно цен и последствий, подсказки CLI
   и справка на трёх языках.
2. **Зачем.** Строки одной накладной можно проверить и подтвердить вместе; общий
   итог учитывает несколько новых цен в одном блюде и в его заготовках.
3. **Как работает.** Сначала показываются цены без НДС, предупреждения и изменение
   Contribution. После подтверждения сохраняются все выбранные цены сразу. При
   изменении данных окно обновляется и просит подтвердить ещё раз. Агент применять
   предложения по-прежнему не может.
4. **Как проверить.** Подготовьте предложения по нескольким строкам накладной.
   В MenuPilot откройте «Ожидает вашего подтверждения» → Apply all / Alles toepassen.
   Проверьте упаковки, цены без НДС, предупреждения и общий итог. Проверьте «Отмена»
   или Escape; затем откройте окно снова и подтвердите. Dashboard должен показать
   новые значения. EN/NL переключается в шапке; окно также проверено на 375 px.
5. **Проверки.** Фактический вывод команд приведён выше. Проверены общий расчёт,
   полный откат при сбое, конкурирующие изменения, повтор операции, запрет
   CLI-токена, клавиатура, доступность и браузерный путь из трёх предложений.
6. **Что не доделано.** Публикация, pull request и merge не выполнялись: по заданию
   их делает координатор после независимого ревью. Новые зависимости и изменение
   формата документа не потребовались.

## Review corrections ALL-R2 and ALL-R1

The byte-budget regression reproduces the reviewer's production-limit fixture:
50 ingredients feed one prep and 100 dishes. Before the fix, accepting all 50
proposals and applying them exceeded the 2 MiB plans limit. The red run also
reproduced the missing final budget guard and the CLI hint with one pending plan
(7 passed, 3 failed).

Pending proposals now reserve a full maximum-membership batch receipt, including
worst-case JSON escaping of a 200-character operation ID, in addition to the
existing lifecycle allowance. Large proposal sets can therefore reach
`plan-budget` earlier, before acceptance. A second check measures the future
serialized applied records under the writer transaction, before the price write.
It protects older pending proposals that were accepted with the smaller reserve.
A refusal leaves document, plans, operations, journal, history and metadata
unchanged. The receipt representation and domain document format stay the same.

The regression applies every accepted proposal with the longest escaped opId and
asserts the actual stored UTF-8 bytes remain within the production limit. Another
regression models an old insufficient reserve and installs an INSERT trigger to
prove refusal occurs before the document write. The CLI test covers 2, 1 and 0
pending proposals in EN/NL, in JSON and printed text, with terminal plans still
present. The batch hint appears only with at least two pending proposals.

Three new harness mutants remove the receipt reserve, final total-budget check,
and CLI pending-count condition. Each runs after its own green baseline.

Targeted verification after these corrections:

- `node --test test/server/plans-all.test.js test/server/plans.test.js`: exit 0,
  33 passed, 0 failed.
- `VITEST_MAX_WORKERS=2 npx vitest run test/ui/plans.test.tsx`: exit 0,
  1 file / 24 tests passed.
- `NODE_OPTIONS=--import=/tmp/menupilot-apply-all-axe-resolve.mjs npm run test:e2e:local`:
  exit 0, `10 passed (1.4m)`, desktop and 375 px. The existing temporary resolver
  supplies the lockfile-pinned axe dependency missing from shared node_modules;
  no dependency or lockfile changes were made.
- `VITEST_MAX_WORKERS=2 npm run check`: exit 0; typecheck passed; core
  `219 passed / 0 failed`; UI `45 files / 479 tests passed`; server
  `171 passed / 0 failed`; nested `npm run test:mutations` reported
  `132 CAUGHT, 1 SURVIVED (includes neutral control)`; the only survivor was the
  neutral comment control. Production build completed: `✓ built in 558ms`.

Revision logs (red, targeted server/UI, full check including mutations, local e2e)
are saved in `/Users/gadzha/.bb/thread-storage/thr_ztwzvhepim/apply-all-review/`.
The local e2e ran while the mutation harness was in its disposable checkout;
server-suite rebuilds had finished before the browser started. No push or merge
was performed.

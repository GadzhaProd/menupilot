# MenuPilot — rules for agents

MenuPilot is a small web app for independent restaurant owners: recipe costing
and a what-if Profit Simulator. This file has two parts. Find yours:

- **Helping a restaurant owner use MenuPilot** (answering questions about their
  prices, dishes and costs; entering a supplier price) → the next section.
- **Developing MenuPilot** (changing code, tests, docs) → every section after it.

## If you are helping a restaurant owner use MenuPilot (not developing it)

Full guide and ready-made recipes: [docs/agent/README.md](docs/agent/README.md) and
[docs/agent/recipes.md](docs/agent/recipes.md). Command reference: [docs/cli.md](docs/cli.md).
The owner is not technical: answer in the owner's language, in short plain sentences.

- **Numbers come only from MenuPilot commands** `npm run menupilot -- <command>` (use `--json`
  when you need exact values). Do not calculate, convert, average or round anything yourself;
  quote the `display` text of a money object. If a command does not give a number, say so.
- **Do not open, read or change the data files or the database** (data folder, `menupilot.db`,
  `token`, backups). Use only the supported commands. If the server is not running, tell the
  owner to run `npm start` (exit code 3); do not start a workaround.
- **Changes only through `propose`, confirmed by the owner in the MenuPilot window.** The only
  change you can propose is a new supplier price (`propose add-price`). A proposal changes nothing.
  Never run `open-url`, never try to apply or reject a plan, never call the API directly.
  Tell the owner to open the "Awaiting your confirmation" panel, check the consequences, and
  choose Apply or Reject. If the plan is stale or expired, propose again.
- **Supplier prices are excl. VAT, as on the invoice.** If the owner gives a price incl. VAT or
  the invoice basis is unclear, ask. Say "incl. VAT" or "excl. VAT" next to every price.
- **Ambiguity: ask, do not guess.** Several candidates, an unknown name, an unclear pack size or
  unit: show the candidates from the command output and ask the owner to choose. Use the exact
  name or ID that the owner picked.
- **Say "Contribution", never "profit".** Contribution is the menu price excl. VAT minus the
  recipe-based ingredient cost, before labour, rent and other costs. Call the cost
  "Recipe-based ingredient cost": what the recipe should cost, not what was used.
- **Monthly volume is the owner's estimate, not a forecast.** "—" means no estimate; say that
  such dishes are excluded from the menu total. An unknown cost is "cost unknown", never zero.
- **Warnings count.** Repeat warnings from the output (zero price, price change above ×3,
  overdue backups) to the owner before they confirm anything.
- **Never suggest recipe changes that affect food safety or allergens.** Price and portion
  what-ifs are fine; swapping or removing ingredients for safety or allergen reasons is not yours
  to advise.

The rest of this file is for agents that develop MenuPilot.

# Development rules

The owner is non-technical: report in simple Russian, code and identifiers in English.
Read docs/planning/*.md before larger changes.

## Scope
- Build only what the current stage in docs/planning/04_IMPLEMENTATION_PLAN.md asks for.
- Out of scope unless the owner approves: AI features, POS, invoices/OCR, inventory,
  auth, multi-location, billing, analytics, new currencies.
- Use only the approved exact-version dependencies and commit the lockfile: react, react-dom, vite, @vitejs/plugin-react, typescript, tailwindcss, @tailwindcss/vite, vitest, jsdom, @testing-library/react, @testing-library/user-event, @playwright/test, @types/react, @types/react-dom. For shadcn use only needed Radix primitives, class-variance-authority, clsx, tailwind-merge, lucide-react. The owner approved a motion library (motion) if a screen truly needs it; it is not installed now — add it with an exact version only when used. No other dependency without coordinator approval; never use --force/--legacy-peer-deps.

## Money and numbers (non-negotiable)
- Money is stored as integer euro cents. Never store or sum money as floats.
- Intermediate costs use integer micro-euros; round half away from zero only at the points
  defined in docs/planning/03_ARCHITECTURE.md (Rounding rules).
- All calculations use prices EXCLUDING VAT. Label every price "incl. VAT" or "excl. VAT".
- "Contribution" is never called profit.
- Use the UI term "Recipe-based ingredient cost": theoretical recipe cost, not actual usage.
- Supplier-price input hint: "Supplier price excl. VAT, as on the invoice".
- Monthly impact uses the owner's optional `monthlyVolume` estimate (safe integer ≥ 0), never a forecast. It is monthly contribution at current prices minus monthly contribution at comparison-date prices (same rule as simulator deltas, see 03 step 10); dishes without volume display "—" and are excluded from the menu total.
- Calculations inside src/calc/ use BigInt; stored values are safe integers;
  parse user decimals from strings, never via parseFloat.
- All formulas live in src/calc/ (pure functions, no I/O, no DOM). UI never
  re-implements a formula.

## UI stack
- UI stack: Vite + React 19 + strict TypeScript + Tailwind v4 + shadcn/ui. Core `src/calc/` and `src/store/` remains JS+JSDoc; screens in `src/ui/`, shadcn components in `src/components/ui/`, alias `@` → `src`.
- Keep a thin TS adapter in `src/ui/domain/*.ts` for explicit readonly document, calc-result (including BigInt fields), and store-method types. `npm run typecheck` is `tsc --noEmit` and required in CI.
- Commands return Promises; publish only after success. Persist through StorageAdapter; keep domain logic and backup validation shared. Version the storage envelope separately from the domain document.
- Store is the sole source of truth. Call store methods outside reducers; on success dispatch `documentReplaced`, on failure show the error and keep the displayed document unchanged. Reducers are pure. Form drafts are component-local; calc results are derived with `useMemo`, never stored or serialized. JSON/localStorage contain only document, baseline, and safe-integer overrides. Format money with existing formatters; never convert BigInt to Number.

## Local agent confirmation
- Agents may propose prices through the CLI, but must never open or apply their own plans.
- Do not access or modify the owner’s local data files directly; use the supported CLI.
- Isolated test fixtures are allowed for automated verification; owner confirmation remains a UI action.

## Data integrity
- The simulator never changes real ingredients, prices or recipes. Scenarios are
  stored separately with their own baseline snapshot.
- Ingredient prices are append-only history; the current price is the latest entry.
- A recipe has `kind: "dish" | "prep"`. Prep has `outputMilli` and `outputUnit` (`g|ml|pc`) and no menu price, VAT, portions, or monthly volume. Lines use `ref: { kind: "ingredient" | "prep", id }`, `netQtyMilli`, and `yieldBp`; `netQtyMilli` is always in the base unit of the referenced ingredient or prep output (lines have no own unit; the UI converts kg/l on input).
- Reject prep self-reference and cycles on save and import; cap nesting depth at 5 with a clear error. Do not delete a referenced ingredient or prep. Unknown cost propagates through all parent preps and dishes.
- Prep line cost uses `roundDiv(batchCostµ(prep) * netQtyMilli * 10^4, outputMilli * yieldBp)`; ingredient-line arithmetic and every rounding point are defined in 03. Price-date selection is shared by every nesting level.
- In the simulator, ingredient-price overrides flow through all prep levels; quantity overrides affect only dish top-level lines. Baseline snapshots include every reachable prep and its prices.
- Pack price per kg/l/pc is display-only; never rewrite stored pack price or size for the conversion.
- Unknown is not zero: a recipe with a missing price shows "cost unknown".
- Validate all user input and imported files; reject with a clear message. Fail fast.
  A failed import or save must leave existing data untouched.
- Changing the stored data format requires bumping `version` and a tested upgrade step.
- Never suggest recipe changes that affect food safety or allergens.

## Tests
- Calculation changes: write or update a failing test in test/calc first (TDD).
- Bug fix: reproduce, add a regression test, fix the cause, run npm test.
- `test:core` runs node:test only for `test/calc` and `test/store` via explicit globs/paths; `test:ui` runs `vitest run` only for UI tests (jsdom + Testing Library). `npm test` runs both and fails if either fails. Avoid `node --test test/` (Node 25 directory behavior).
- `npm run check` runs typecheck, test, and build. CI also runs `npm run test:e2e` against a production preview before deploying GitHub Pages on push to main; production base is `/menupilot/`. Verify production preview under that subpath.
- Each UI stage requires real-browser checking with bb browser-automation: desktop and 375 px screenshots, keyboard/focus in dialogs, and field errors. `npm run test:e2e` adds Playwright with Chromium only, desktop and 375 px projects, production build under `/menupilot/`, and no external network requests.
- Core and UI tests use in-memory storage. E2E tests use isolated browser storage and block external requests. No external services or network calls are used by tests.
- Never report tests as passed without running them; show the actual output.

## Workflow
- Small steps; one feature per commit; commit only when tests pass.
- Do not refactor unrelated code. Keep changed code clean (boy scout rule).
- No git push, publishing or deleting data without the owner's approval.
- If a task grows much larger than planned, stop and explain why.

## Report after each stage (in Russian)
1. Что сделано. 2. Зачем. 3. Как работает простыми словами.
4. Как владельцу проверить (шаги в браузере). 5. Какие тесты прошли (вывод).
6. Что не доделано.

## Attribution
Ideas (base units, yield %, ex-tax costing) are inspired by
kitchen-costing-for-claude-code (MIT, Enterprise DNA). No code is copied unless
noted in README "Acknowledgements" with the MIT notice.

## 21st.dev components
- Access 21st.dev only through `sh scripts/21st.sh`; never expose its key in client code, `VITE_*`, or logs.
- Copy a component only with an explicit MIT, Apache-2.0, BSD, or ISC license. Keep the full license with author and URL at `third_party/21st/<slug>/LICENSE`, add a source/license comment and `THIRD_PARTY_NOTICES.md` entry; include existing Apache NOTICE. If licensing is absent or unclear, do not copy or rewrite its code; use another component or build with shadcn primitives.
- Check the license with `sh scripts/21st.sh license <url path from search --json>` (the CLI itself does not show licenses). Only `License: mit|apache-2.0|bsd|isc` may be copied; `unknown` may not. For the LICENSE file use the standard text with the author/library as copyright holder and the component URL.
- Check peer deps, Tailwind v3 config, Next.js imports, dynamic classes, and CSS variables before adoption.

## Runtime support
- Keep Node `engines` and README at `^24.15.0 || ^25.8.1`; local SQLite requires the WAL fix. Tested patches: 24.15.0 LTS and 25.8.1. CI uses 24.15.0. Target Safari 16.4+, Chrome 111+, Firefox 128+.

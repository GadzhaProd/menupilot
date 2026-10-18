# MenuPilot — rules for coding agents

MenuPilot is a small web app for independent restaurant owners: recipe costing
and a what-if Profit Simulator. Read docs/planning/*.md before larger changes.
The owner is non-technical: report in simple Russian, code and identifiers in English.

## Scope
- Build only what the current stage in docs/planning/04_IMPLEMENTATION_PLAN.md asks for.
- Out of scope unless the owner approves: AI features, POS, invoices/OCR, inventory,
  auth, multi-location, billing, analytics, new currencies.
- Use only the approved exact-version dependencies and commit the lockfile: react, react-dom, vite, @vitejs/plugin-react, typescript, tailwindcss, @tailwindcss/vite, vitest, jsdom, @testing-library/react, @testing-library/user-event, @types/react, @types/react-dom. For shadcn use only needed Radix primitives, class-variance-authority, clsx, tailwind-merge, lucide-react. No other dependency (including framer-motion) without coordinator approval; never use --force/--legacy-peer-deps.

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
- Store is the sole source of truth. Call store methods outside reducers; on success dispatch `documentReplaced`, on failure show the error and keep the displayed document unchanged. Reducers are pure. Form drafts are component-local; calc results are derived with `useMemo`, never stored or serialized. JSON/localStorage contain only document, baseline, and safe-integer overrides. Format money with existing formatters; never convert BigInt to Number.

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
- `npm run check` runs typecheck, test, and build. CI runs it and deploys GitHub Pages on push to main; production base is `/menupilot/`. Verify production preview under that subpath.
- Each UI stage requires real-browser checking with bb browser-automation: desktop and 375 px screenshots, keyboard/focus in dialogs, and field errors. Playwright is post-MVP.
- Tests use in-memory storage only. No external services, no network.
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
- Check peer deps, Tailwind v3 config, Next.js imports, dynamic classes, and CSS variables before adoption.

## Runtime support
- Set Node `engines` and README to the minimum required by installed Vite. Target Safari 16.4+, Chrome 111+, Firefox 128+.

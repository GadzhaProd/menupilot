# MenuPilot: making a supplier price change understandable

[Live demo](https://gadzhaprod.github.io/menupilot/) · [Architecture decisions](adr/) · [Run locally](../README.md#run-locally)

MenuPilot helps an independent café owner connect a supplier price change to affected dishes and compare responses: “What changed, what does it mean at my sales volume, and what if I change the menu price?” The target is one location with a small menu.

The output is **contribution before other costs**, not net profit. Recipe-based ingredient cost is theoretical; monthly volume is the owner's estimate, not a demand forecast.

## Decisions that shaped the product

**Make rounding a written contract.** Pack and menu prices are stored as safe-integer euro cents. Pure calculation functions use `BigInt`, with micro-euros for intermediate costs and half-away-from-zero rounding at named boundaries. Rounding every ingredient to cents too early can distort a recipe or its monthly contribution. This requires explicit conversion and formatting. [ADR 001](adr/001-integer-money.md)

**Treat missing information as missing.** No supplier price means “cost unknown”, including through nested preps. A missing monthly estimate excludes that dish from the total and is disclosed. Substituting zero would make incomplete data look reassuringly cheap. The interface explicitly withholds unsupported results. [ADR 002](adr/002-unknown-costs.md)

**Keep one coherent document, with revisions.** Recipes, prices and scenario snapshots form a bounded document that can be validated and exported together. Dataset identity and revision checks reject stale writes; operation receipts make retries safe within their retention contract. SQLite commits the document and associated history atomically. This is understandable for one café, but whole-document writes and growing price history impose capacity and concurrency limits. The deferred cloud plan uses a different model. [ADR 003](adr/003-document-revisions.md)

**Offer local persistence before a cloud service.** The static browser version makes the demo accessible without installation. The local server adds SQLite, verified backups and a CLI using the same calculation core. It keeps restaurant data on the owner's machine while avoiding hosted accounts and tenant isolation for this stage. It also makes installation, updates and recovery the owner's responsibility. The cloud plan is explicitly deferred. [ADR 004](adr/004-browser-and-local.md) · [Server module map](../server/README.md#module-map)

**Let the agent propose; let the owner decide.** An agent can read results and propose one supplier price at a time. The UI shows affected dishes and refreshed consequences before approval. The CLI token cannot approve; application and its receipt commit together. This is a workflow safeguard against mistakes, not isolation from malicious software running with the owner's OS permissions. [ADR 005](adr/005-owner-confirmation.md)

**Keep experiments separate from real recipes.** Scenarios A/B/C use a baseline snapshot and overrides. Ingredient-price changes flow through nested preps, but do not write back to real prices. A changed baseline is made visible. Exploration cannot accidentally edit real recipes. [ADR 006](adr/006-scenario-isolation.md)

## Verification

The plan requires calculation tests first: hand-worked examples, rounding boundaries, unknown costs and frozen-input simulation checks. Separate agents reviewed stages; later independent AI-agent audits by Fable and Astra identified defects that earlier checks missed. These were engineering reviews, not external certification. [Plan](planning/04_IMPLEMENTATION_PLAN.md) · [Recorded review fixes](../server/D2_VERIFICATION.md)

Verification snapshot: **5 November 2026, integrated source baseline `6970019`, macOS, Node `v25.8.1`, Playwright `1.64.1`**. Counts below are runner-reported test cases, not assertions or a coverage percentage. Repeating a suite under another clock does not add new tests to the count.

| Command | Observed result |
|---|---|
| `VITEST_MAX_WORKERS=2 npm run check` | Exit 0: typecheck, 218 core/store + 474 UI + 161 server tests (**853**); mutations: **121 CAUGHT, 1 SURVIVED** (neutral control); production build. |
| `VITEST_MAX_WORKERS=2 npm run check:future` | Exit 0: 218 core/store, 474 UI, 161 server tests passed again. |
| `npm run test:e2e` | Exit 0: `23 passed (56.4s)` functional + `8 passed (1.4m)` axe; Chromium desktop + mobile. |
| `npm run test:e2e:local` | Exit 0 in the isolated copy: `8 passed (1.2m)`; local SQLite server, Chromium desktop + mobile. |
| `npm run test:e2e:compat` | Exit 0 in an isolated copy: `46 passed (2.0m)` functional + `16 passed (3.9m)` axe; Playwright WebKit + Firefox. |

Axe reported **zero serious/critical violations** across six screens and two dialogs, EN/NL, light/dark and both viewport sizes in all three engines. An initial concurrent compatibility run hit a preview 404 during Firefox reload (45/46 passed); the focused repeat and full isolated run passed. Run suites sequentially or use separate build directories.

Screens now load in separate chunks on demand. The minified entry JavaScript chunk is **297.96 kB** (**93.40 kB gzip**, as reported by Vite), down from **626.66 kB** in the previous verified baseline. This measures the entry chunk, not the whole application or loading time.

The future-date command runs core/UI/server suites at **2027-12-31T12:00:00.000Z**. It does not run Playwright: static-browser e2e has its own fixed clock. The browser suites exercise desktop and 375 px layouts; static e2e uses the production `/menupilot/` path. Tests use isolated storage. The mutation harness requires a passing unmodified baseline and expects a harmless comment edit to survive; targeted mutants are not a repository-wide mutation score. [ADR 007](adr/007-explicit-time-and-evidence.md)

## Known limits

There is no observed café pilot or evidence of retention, time saved or willingness to pay. Input freshness remains essential. The local version requires Node, Git and macOS or Linux; there is no multi-user cloud service, POS integration, invoice OCR or inventory. Whole-document storage has explicit size limits. TypeScript checks the UI boundary, not all JavaScript in the calculation core and server. This verification uses Playwright Chromium, WebKit and Firefox on macOS. WebKit is an engine check, not a test of the installed Safari app or a real iPhone; minimum browser versions and Linux remain untested here. Automated axe checks do not establish full WCAG compliance or screen-reader usability. Physical power-loss durability and off-device backup synchronization remain unproven.

## What I would do differently

From the product owner's perspective, lessons from the audits:

- **Stop the calculator from becoming a platform.** Locks, recovery, retention and agent protocols became a substantial maintenance commitment. I would test the smallest useful workflow with café owners before adding more infrastructure.
- **Make time explicit from the start.** Dashboard and CLI clocks drifted from test fixtures. I would treat clock injection and future-date checks as foundational contracts alongside integer money.
- **Budget for two versions.** Shared calculations do not remove two storage, recovery and documentation surfaces. I would decide earlier whether the browser version is primarily a demo or a fully supported product.
- **Write the showcase before the reference manual.** The README accumulated operational detail ahead of the product story. I would keep a short introduction and clear paths for owners and reviewers from the beginning.
- **Record decisions before large merges.** Commit volume showed activity more clearly than reasoning. Smaller reviewed changes and short ADRs would make trade-offs easier to follow. These ADRs are retrospective, not a claim that this discipline existed throughout.

The owner directed and approved the product; AI agents wrote the code and tests. The portfolio presents that process openly.

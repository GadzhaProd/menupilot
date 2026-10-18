# MenuPilot

MenuPilot is a small browser app for recipe-based ingredient costing and what-if contribution scenarios for independent restaurants. It is a work in progress: the app shell, navigation and a Dashboard preview are in place; ingredient and recipe editing and the Profit Simulator come in later stages.

## Requirements

- **Node.js** `^20.19.0`, `^22.13.0` or `>=24` (the range Vite 8 and the test tools support; CI uses Node 24).
- **Browsers** (set by Tailwind CSS v4): Safari 16.4+, Chrome 111+, Firefox 128+.

## Run locally

```sh
npm ci            # install the exact locked dependencies
npm run dev       # development server, http://localhost:5173/
npm run build     # production build into dist/ (base path /menupilot/)
npm run preview   # serve dist/ at http://localhost:4173/menupilot/
npm run typecheck # tsc --noEmit
npm run test:core # calculation and store tests (node:test)
npm run test:ui   # screen and routing tests (Vitest + Testing Library, jsdom)
npm test          # both test suites
npm run check     # typecheck + tests + build: run this before every commit
```

Money input accepts a decimal comma or point and rejects thousands separators.

## How it is built

- `src/calc/`, `src/store/`: calculation core and data store. Plain JavaScript with JSDoc, no dependencies, money as integers (BigInt inside `calc`). The UI never re-implements a formula.
- `src/ui/`: the screens (Vite + React 19 + TypeScript + Tailwind CSS v4).
  - `domain/`: the typed boundary to the core: document types (read-only), types of the BigInt calculation results, and the only place the UI imports `src/calc` and `src/store` from. `core.d.ts` declares the core's types by hand; a test checks that the declared exports exist.
  - `data/`: the store is the single source of truth. A command runs the store method outside the reducer; on success the new document replaces the one on screen, on failure the screen keeps the old document and shows the error.
  - `router/`: a small hash router (`#/`, `#/ingredients`, `#/recipe/:id`, `#/simulator/:id`) that works on GitHub Pages.
  - `pages/`, `layout/`: screens and the page shell.
- `src/components/ui/`: shadcn/ui components (`button`, `card`, `table`). `@` is an alias for `src`.
- `test/calc`, `test/store`: core tests. `test/ui`: UI tests.

Only the document is stored (in `localStorage`); calculation results are recomputed and never saved.

## Deployment

Every push to `main` runs typecheck, tests and build in GitHub Actions (`.github/workflows/pages.yml`) and publishes `dist/` to GitHub Pages at `/menupilot/`. Pages must be enabled once in the repository settings (Source: GitHub Actions). Other branches and pull requests run the same checks in `ci.yml`.

## UI components from 21st.dev

21st.dev is used only through `sh scripts/21st.sh` (search, code, themes). The API key lives in the git-ignored `.env.local`, and never in client code, `VITE_*` variables or logs. A component's code is copied only if its licence is clearly permissive (MIT, Apache-2.0, BSD, ISC): the full licence text goes to `third_party/21st/<slug>/LICENSE`, the file gets a header comment, and `THIRD_PARTY_NOTICES.md` an entry. A missing or unclear licence means the code is not copied (and not paraphrased); use another component or build it from shadcn primitives.

See [planning documents](docs/planning/) for the approved architecture and implementation plan. Third-party licences: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Acknowledgements

Ideas about base units, yield, and cost excluding VAT were inspired by [kitchen-costing-for-claude-code](https://github.com/Enterprise-DNA-OS/kitchen-costing-for-claude-code), MIT licensed, by Enterprise DNA. No code was copied.

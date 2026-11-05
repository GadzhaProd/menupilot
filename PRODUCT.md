# MenuPilot — Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owners and managers of independent cafés and restaurants in the Netherlands, usually one location and 10–60 dishes. They are of any age; many are immigrants and some have little experience with computers. Age is not a target segment. They know supplier invoices and menu prices, not accounting terminology. This audience comes from the owner’s design brief and docs/planning/02_PRODUCT_SPEC.md.

## Product Purpose

Show which dishes became more expensive, the contribution change at the owner's own monthly sales estimate, and the consequences of alternatives before changing real recipes or prices.

## Positioning

A small recipe-costing and scenario calculator. Its central workflow connects dated supplier prices and nested preparations to dishes, then compares today's Baseline with up to three independent scenarios A/B/C. Do not claim market uniqueness or promise higher profit.

## Operating Context

The owner enters supplier pack prices from invoices, maintains recipes, checks Dashboard, and tries changes in Profit Simulator. Both modes share these calculations and screens. Demo dishes, suppliers and prices are fictional.

This is the current capability and storage map; the old D1-only server preview description is superseded.

| Capability / storage | Published browser version | Local version (`npm start`) |
|---|---|---|
| Saved ingredients, prices, recipes and scenarios | Browser storage on this device/origin | SQLite database `menupilot.db` in the computer’s data folder; the header shows the exact path |
| First use | Fictional demo cafe | Empty; demo can be loaded explicitly from Data |
| Recipe drafts | Browser storage for this dataset, up to 7 days | Same; clearing the browser removes drafts, not the database |
| Other browser state | Language/theme preferences; unsaved simulator scenarios in the open app | Same, plus the window session; ingredient/price dialog entries are not retained |
| Portable backup | JSON export/import through Data; import previews and requires confirmation | Same; independent of the browser installation, with no merge or sync |
| Previous versions | Up to 10 versions within 1 MiB | Up to 32 versions within 64 MiB |
| Automatic database copies | None | Verified snapshots under `backups/`, normally within about five minutes of changes and daily while running; pending changes also copied on normal shutdown. Errors/sleep can delay this. Optional second destination via `MENUPILOT_BACKUP_DIR` |
| Recovery | JSON import or previous versions; clearing browser storage also removes history | JSON import, previous versions, verified database backup restore; offline recovery instructions in README |
| Agent access | No local API or CLI connection | CLI reads/calculations; agent proposes one supplier price excl. VAT at a time; owner reviews consequences and confirms Apply/Reject in the window |
| Proposal lifetime | Not available | 24 hours; any dataset/revision change makes it stale; a newer proposal for the same ingredient supersedes the old one |
| Start / stop / sign-in | Open the published site | `npm start`; Ctrl+C or `npm run menupilot -- stop`; a fresh sign-in link via `npm run menupilot -- open-url` |

No accounts, hosted data service or automatic device/browser-to-local synchronization. The local server listens on loopback. CLI credentials cannot confirm proposals, and browser Origin/Host/session checks block confirmation from other websites. These controls protect against mistakes, not malicious software with the owner’s OS permissions. Keep the live database on a local disk; copies on that same disk do not protect against losing it.

Owner instructions, default data paths, backup limits and failure/recovery cases: [Run locally](README.md#run-locally), [Use with an AI agent](README.md#use-with-an-ai-agent), [Local backups and recovery](README.md#local-backups-and-recovery). Technical entry points: [server/README.md](server/README.md).

## Capabilities and Constraints

- Preserve Dashboard, Ingredients and append-only price history, dish/prep recipes, Profit Simulator, Data backups and Help.
- All prices explicitly say incl. VAT or excl. VAT. All calculations exclude VAT. Preserve “Recipe-based ingredient cost”, “Contribution (before other costs)”, “Estimated monthly contribution” and “Monthly impact at your volume”. Contribution is never called profit. Preserve the product name “Profit Simulator” where already used.
- Supplier-price hint: “Supplier price excl. VAT, as on the invoice”. Pack conversion to kg/l/pc is display-only.
- Monthly figures use the owner's optional safe-integer estimate ≥ 0, never a forecast. Missing volume is “—”, excluded from menu total; zero is a valid estimate. Unknown ingredient cost is not zero.
- Scenarios never change real data. Their baseline snapshots include reachable preps; stale scenarios remain visibly stale until the existing explicit update action.
- Prep nesting, cycle/depth guards, immutability on failed saves/imports and all arithmetic remain as defined in docs/planning/03_ARCHITECTURE.md and AGENTS.md.
- No built-in AI model, POS, OCR, inventory, account authentication, billing, multi-location, new currencies, demand forecasting or food-safety/allergen advice. External agents can use the local CLI under owner-confirmation rules.
- Existing stack: React 19, strict TypeScript UI, Tailwind v4, shadcn/Radix; JS/JSDoc core. Calculations stay in src/calc, document state in store. No new dependencies installed by this design task. Motion is permitted by the owner; the design candidate is exact version 14.4.0, with runtime checks required before implementation.
- The interface is EN/NL through typed t() keys; Help is EN/NL/RU and follows the active storage mode. Preserve stable Help anchors. No DOM text replacement is permitted for localisation.

## Brand Commitments

Name: MenuPilot. Selected direction: C+ “Kitchen line”, with full light/dark themes, system preference by default, a persistent manual choice and always-light printing. A remains an archived backup; B was rejected. A contemporary, recognisable working tool rather than a generic SaaS template. Clear numbers, large targets and readable language outrank decoration. Report to the owner in Russian; code and identifiers remain English.

## Evidence on Hand

README.md; docs/planning/02_PRODUCT_SPEC.md, 03_ARCHITECTURE.md, 04_IMPLEMENTATION_PLAN.md; src/ui and src/components; fictional demo data; live demo https://gadzhaprod.github.io/menupilot/. Existing screenshots are historical evidence; current browser inspection takes precedence for current appearance. No customer claims or commercial metrics are supplied.

## Product Principles

1. Explain a change before asking for a decision.
2. Keep real data and what-if changes unmistakably separate.
3. Keep uncertainty visible, especially unknown costs and absent volume.
4. Preserve the owner's control over saving, replacing and backing up data.
5. Make one task easy to read without removing the detail needed to check it.

## Accessibility & Inclusion

Support 375 px through desktop, keyboard operation, visible focus, dialog focus return, nearby field errors and browser zoom. Use explicit labels rather than icon-only navigation, colour-only meaning, hover-only help or disappearing error notices. Target WCAG AA contrast in the proposed design, then verify rendered states during implementation. Existing runtime targets: Safari 16.4+, Chrome 111+, Firefox 128+.

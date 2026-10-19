# MenuPilot — Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owners and managers of independent cafés and restaurants in the Netherlands, usually one location and 10–60 dishes. Many are immigrants; some are older or uncomfortable with computers. They know supplier invoices and menu prices, not accounting terminology. This audience comes from the owner’s design brief and docs/planning/02_PRODUCT_SPEC.md.

## Product Purpose

Show which dishes became more expensive, the contribution change at the owner's own monthly sales estimate, and the consequences of alternatives before changing real recipes or prices.

## Positioning

A small recipe-costing and scenario calculator. Its central workflow connects dated supplier prices and nested preparations to dishes, then compares today's Baseline with up to three independent scenarios A/B/C. Do not claim market uniqueness or promise higher profit.

## Operating Context

The owner enters supplier pack prices from invoices, maintains recipes, checks Dashboard, and tries changes in Profit Simulator. Data stays in this browser; JSON export/import is the backup mechanism. There are no accounts or server synchronisation. Demo dishes, suppliers and prices are fictional.

## Capabilities and Constraints

- Preserve Dashboard, Ingredients and append-only price history, dish/prep recipes, Profit Simulator, Data backups and Help.
- All prices explicitly say incl. VAT or excl. VAT. All calculations exclude VAT. Preserve “Recipe-based ingredient cost”, “Contribution (before other costs)”, “Estimated monthly contribution” and “Monthly impact at your volume”. Contribution is never called profit. Preserve the product name “Profit Simulator” where already used.
- Supplier-price hint: “Supplier price excl. VAT, as on the invoice”. Pack conversion to kg/l/pc is display-only.
- Monthly figures use the owner's optional safe-integer estimate ≥ 0, never a forecast. Missing volume is “—”, excluded from menu total; zero is a valid estimate. Unknown ingredient cost is not zero.
- Scenarios never change real data. Their baseline snapshots include reachable preps; stale scenarios remain visibly stale until the existing explicit update action.
- Prep nesting, cycle/depth guards, immutability on failed saves/imports and all arithmetic remain as defined in docs/planning/03_ARCHITECTURE.md and AGENTS.md.
- No AI, POS, OCR, inventory, auth, billing, multi-location, new currencies, demand forecasting or food-safety/allergen advice.
- Existing stack: React 19, strict TypeScript UI, Tailwind v4, shadcn/Radix; JS/JSDoc core. Calculations stay in src/calc, document state in store. No new dependencies installed by this design task. Motion is permitted by the owner, but a pinned version and compatibility check would be needed before adoption.
- Current repository interface is EN; Help is EN/RU. The owner’s audience includes EN/NL. This design reserves space for NL; whether implementation includes Dutch translation remains an open scope decision, not a claim that NL already exists.

## Brand Commitments

Name: MenuPilot. A contemporary, recognisable working tool rather than a generic SaaS template. Clear numbers, large targets and readable language outrank decoration. Report to the owner in Russian; code and identifiers remain English.

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

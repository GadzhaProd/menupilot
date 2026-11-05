# ADR 006 — Keep what-if scenarios separate

Status: accepted; recorded retrospectively, 2026-11-05.

## Context
An owner needs to compare alternatives without accidentally changing real prices or recipes.
A saved comparison should remain understandable after its source data changes.

## Decision
Save a baseline snapshot of the dish, all reachable preps and their ingredient prices.
Apply scenario overrides through pure calculation functions; keep scenarios separate from real data.
Let price overrides flow through nested preps; quantity overrides affect only top-level dish lines.
Show a changed-baseline notice and compare up to three scenarios against Baseline.

## Consequences
Exploration is reversible and repeatable; frozen-input tests check that simulations do not mutate inputs.
Snapshots consume storage and can become outdated; monthly figures depend on the owner's estimate.
The simulator does not forecast demand or establish food safety when quantities change.

Sources: [Product spec §5](../planning/02_PRODUCT_SPEC.md), [Architecture §5–7](../planning/03_ARCHITECTURE.md), [TDD stage 2](../planning/04_IMPLEMENTATION_PLAN.md).

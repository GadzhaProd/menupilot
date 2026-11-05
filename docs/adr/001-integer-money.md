# ADR 001 — Integer money and explicit rounding

Status: accepted; recorded retrospectively, 2026-11-05.

## Context
Recipe quantities, yields and VAT division create fractions smaller than a cent.
Early cent rounding can distort totals; binary floating-point adds another source of ambiguity.

## Decision
Store money as safe-integer euro cents; parse decimal input from strings.
Use `BigInt` arithmetic and integer micro-euros inside pure `src/calc/` functions.
Apply half-away-from-zero division only at the specified rounding boundaries.
Derive comparison deltas from displayed values so the visible table reconciles.

## Consequences
Results follow a testable contract shared by UI and CLI, with no floating-point money sums.
Formatting and wire serialization need explicit conversions; BigInt is not stored in JSON.

Sources: [Architecture §5–6](../planning/03_ARCHITECTURE.md), [calculation TDD stages](../planning/04_IMPLEMENTATION_PLAN.md).

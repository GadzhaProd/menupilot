# ADR 002 — Unknown is not zero

Status: accepted; recorded retrospectively, 2026-11-05.

## Context
An incomplete recipe can look artificially inexpensive if a missing price becomes zero.
A missing sales estimate also cannot support a meaningful monthly contribution total.

## Decision
Propagate unknown ingredient costs through every parent prep and dish.
Display “cost unknown” and withhold dependent results; an explicit zero price remains distinct.
Show “—” for a missing monthly estimate and disclose exclusions from menu totals.
Call the result contribution before other costs and the cost recipe-based ingredient cost.

## Consequences
Incomplete input stays visible instead of silently inflating contribution.
The UI must explain partial totals and missing values, even when a number would look simpler.

Sources: [Product terminology and acceptance](../planning/02_PRODUCT_SPEC.md), [Architecture §6](../planning/03_ARCHITECTURE.md).

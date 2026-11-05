# ADR 005 — Agent proposals require owner confirmation

Status: accepted; recorded retrospectively, 2026-11-05.

## Context
An agent can misunderstand an ingredient, pack size or VAT basis; a plausible price can still be wrong.
Consequences may change between proposing and approving a price.

## Decision
Give the CLI read/propose capability for supplier prices, with no apply/reject capability.
Show current consequences in the UI; bind approval to the reviewed preview fingerprint.
Recheck dependencies and expiry, then commit price, history, journal, receipt and plan atomically.
Keep independent proposals pending after another ingredient changes; refresh their consequences.

## Consequences
The owner makes the decision in MenuPilot; changed consequences require another review.
Invoice lines still require separate proposals and confirmations; there is no batch approval.
This prevents ordinary agent mistakes, not access by malicious code with the owner's OS permissions.

Sources: [Local plan §5](../planning/06_LOCAL_VERSION_PLAN.md), [Architecture: D5](../planning/03_ARCHITECTURE.md).

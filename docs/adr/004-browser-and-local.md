# ADR 004 — Shared core, browser and local persistence

Status: accepted; cloud deferred; recorded retrospectively, 2026-11-05.

## Context
A static demo should open without installation; local use needs backups and agent access.
A hosted service would add accounts, tenant isolation, operations and a different growth model.

## Decision
Keep the React interface, pure calculation core and validation shared across both versions.
Use localStorage in the static app; use an HTTP adapter and a loopback-only SQLite server locally.
Keep local data outside the checkout and publish verified backup snapshots.
Transfer browser data by explicit export/import; do not synchronize the versions.

## Consequences
The demo is easy to try; local data stays on the owner's computer without a hosted account.
Local installation needs Node, Git and macOS/Linux; the owner must manage updates and independent copies.
Two storage modes create two testing and recovery surfaces even with shared business logic.

Sources: [Architecture](../planning/03_ARCHITECTURE.md), [local-version plan](../planning/06_LOCAL_VERSION_PLAN.md), [deferred cloud plan](../planning/07_CLOUD_PLAN.md).

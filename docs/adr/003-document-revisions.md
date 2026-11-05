# ADR 003 — One bounded document with revisions

Status: accepted for browser/local modes; recorded retrospectively, 2026-11-05.

## Context
One café needs a coherent recipe graph, append-only prices and portable backups.
Multiple windows and a lost write response can otherwise overwrite work or repeat an operation.

## Decision
Persist one validated domain document behind a shared StorageAdapter contract.
Compare dataset identity and revision before writes; retain bounded operation receipts for retries.
Use browser Web Locks for browser writes and one SQLite server writer with atomic transactions locally.
History restores create a new revision; storage-envelope and domain versions evolve separately.

## Consequences
Validation, import/export and conflict handling share a clear boundary; stale writes fail visibly.
Whole-document writes, history and serialization need size budgets; receipts are not retained forever.
The deferred cloud plan calls for a relational catalog rather than scaling this model unchanged.

Sources: [Architecture: storage and revisions](../planning/03_ARCHITECTURE.md), [local plan §2](../planning/06_LOCAL_VERSION_PLAN.md), [cloud plan §A.1](../planning/07_CLOUD_PLAN.md).

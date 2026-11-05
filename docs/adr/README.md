# Architecture decision records

These short English records were written retrospectively on 5 November 2026 from the original baseline `586e56d`, then checked against portfolio integration `6970019` and the linked planning documents. They explain current decisions and consequences; they do not imply that ADRs were maintained during the original implementation. The planning documents retain the detailed contracts and their evolution.

| Record | Decision |
|---|---|
| [001](001-integer-money.md) | Integer cents, BigInt micro-euros and explicit rounding |
| [002](002-unknown-costs.md) | Unknown costs and missing estimates are not zero |
| [003](003-document-revisions.md) | One bounded document with identity, revisions and receipts |
| [004](004-browser-and-local.md) | Shared core, browser demo and local SQLite; cloud deferred |
| [005](005-owner-confirmation.md) | Agents propose supplier prices; owners confirm consequences |
| [006](006-scenario-isolation.md) | Scenarios keep their own baseline and never edit real recipes |
| [007](007-explicit-time-and-evidence.md) | Explicit time and verified test baselines |

[Server module map](../../server/README.md#module-map) · [Case study](../CASE_STUDY.md) · [Implementation plan](../planning/04_IMPLEMENTATION_PLAN.md) · [Full architecture](../planning/03_ARCHITECTURE.md)

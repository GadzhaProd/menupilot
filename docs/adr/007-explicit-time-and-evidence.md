# ADR 007 — Make time and test evidence explicit

Status: accepted; recorded retrospectively and updated for integration `6970019`, 2026-11-05.

## Context
Audits found date-dependent failures and a mutation runner that could misread an already-failing test.
A large count of tests was insufficient evidence that the relevant safeguards worked.

## Decision
Inject the UI data clock and gate CLI test-clock overrides explicitly.
Run core/UI/server suites on a fixed future date with `check:future`; keep e2e clocks explicit.
Require a green baseline before each targeted mutation and a surviving neutral comment control.
Run functional and axe checks in Chromium, WebKit and Firefox; require zero serious/critical axe violations.

## Consequences
Calendar drift and broken baselines become observable; test reruns are not counted as new tests.
Browser-engine and axe checks do not establish minimum-version support or full accessibility.
The future-date command does not run e2e, and process crash tests do not prove power-loss durability.

Sources: [Calculation TDD and staged verification](../planning/04_IMPLEMENTATION_PLAN.md), [local verification plan §7](../planning/06_LOCAL_VERSION_PLAN.md); implementation: [clock contract](../../server/README.md), [mutation runner](../../test/server/mutations.js), [commands](../../package.json).

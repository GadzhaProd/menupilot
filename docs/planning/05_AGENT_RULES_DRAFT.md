# 05. Черновик правил для coding-агентов MenuPilot

Это проект правил, а не действующий файл. После утверждения он станет `AGENTS.md` в корне репозитория MenuPilot, а `CLAUDE.md` будет содержать одну строку `@AGENTS.md`, чтобы Claude Code и другие агенты (Codex, Cursor) читали один источник. Эталонные `AGENTS.md`/`CLAUDE.md` из kitchen-costing мы **не копируем и не изменяем**: они описывают другой продукт (CLI-склад для агента).

Глобальные правила пользователя (`~/.bb/AGENTS.md`: безопасность, без push без разрешения) действуют поверх проектных и имеют приоритет.

---

## Черновик `AGENTS.md`

```markdown
# MenuPilot — rules for coding agents

MenuPilot is a small web app for independent restaurant owners: recipe costing
and a what-if Profit Simulator. Read docs/planning/*.md before larger changes.
The owner is non-technical: report in simple Russian, code and identifiers in English.

## Scope
- Build only what the current stage in docs/planning/04_IMPLEMENTATION_PLAN.md asks for.
- Out of scope unless the owner approves: AI features, POS, invoices/OCR, inventory,
  auth, multi-location, billing, analytics, new currencies.
- Never add a dependency without stating why in the report. Prefer Node built-ins.

## Money and numbers (non-negotiable)
- Money is stored as integer euro cents. Never store or sum money as floats.
- No runtime dependencies and no build step without the owner's approval.
- Intermediate costs use integer micro-euros; round half-up only at the points
  defined in docs/planning/03_ARCHITECTURE.md (Rounding rules).
- All calculations use prices EXCLUDING VAT. Label every price "incl. VAT" or "excl. VAT".
- "Contribution" is never called profit.
- Monthly figures come only from the user's explicit sales volume. No forecasts.
- Calculations inside src/calc/ use BigInt; stored values are safe integers;
  parse user decimals from strings, never via parseFloat.
- All formulas live in src/calc/ (pure functions, no I/O, no DOM). UI never
  re-implements a formula.

## Data integrity
- The simulator never changes real ingredients, prices or recipes. Scenarios are
  stored separately with their own baseline snapshot.
- Ingredient prices are append-only history; the current price is the latest entry.
- Unknown is not zero: a recipe with a missing price shows "cost unknown".
- Validate all user input and imported files; reject with a clear message. Fail fast.
  A failed import or save must leave existing data untouched.
- Changing the stored data format requires bumping `version` and a tested upgrade step.
- Never suggest recipe changes that affect food safety or allergens.

## Tests
- Calculation changes: write or update a failing test in test/calc first (TDD).
- Bug fix: reproduce, add a regression test, fix the cause, run npm test.
- Tests use in-memory storage only. No external services, no network.
- Never report tests as passed without running them; show the actual output.

## Workflow
- Small steps; one feature per commit; commit only when tests pass.
- Do not refactor unrelated code. Keep changed code clean (boy scout rule).
- No git push, publishing or deleting data without the owner's approval.
- If a task grows much larger than planned, stop and explain why.

## Report after each stage (in Russian)
1. Что сделано. 2. Зачем. 3. Как работает простыми словами.
4. Как владельцу проверить (шаги в браузере). 5. Какие тесты прошли (вывод).
6. Что не доделано.

## Attribution
Ideas (base units, yield %, ex-tax costing) are inspired by
kitchen-costing-for-claude-code (MIT, Enterprise DNA). No code is copied unless
noted in README "Acknowledgements" with the MIT notice.
```

---

## Как это встроить
1. На этапе 0 реализации создать `AGENTS.md` (текст выше) и `CLAUDE.md` с одной строкой `@AGENTS.md`.
2. Правила, которые зависят от архитектуры (папки `src/calc/`, правила округления), сверять с утверждённой версией `03_ARCHITECTURE.md`; при изменении архитектуры обновлять оба файла в одном коммите.
3. Файл держать коротким (до ~80 строк): детали живут в `docs/planning/`, агент читает их по ссылке.

# Working with a MenuPilot owner (guide for AI agents)

You are Claude Code, Codex or a similar agent, started in the MenuPilot project folder by a restaurant owner. The owner wants answers about their own prices and dishes, and sometimes wants a supplier price entered. This guide is how to do that safely. Ready-made question → command → answer examples are in [recipes.md](recipes.md). The full command reference is in [../cli.md](../cli.md). The rules are in [../../AGENTS.md](../../AGENTS.md) (first section).

The owner is not technical. Answer in **the owner's language**, in short plain sentences. Keep commands out of the answer unless the owner needs to run one.

## The five rules

1. **Every number comes from a MenuPilot command.** Do not calculate, convert, average or round. Quote the `display` text (for example `€4.85`, `-€195.00`). If the command gives no number, say so.
2. **Never touch the data files or the database.** No `sqlite3`, no reading the data folder, `token`, `menupilot.db` or `backups/`, no calls to the HTTP API.
3. **You can propose, not change.** The only change available is a new supplier price: `propose add-price`. It saves a plan and changes nothing. The owner applies or rejects it in the MenuPilot window.
4. **Never run `open-url`, and never try to apply or reject a plan.** Opening the window and confirming are the owner's steps. (`open-url` hands out a new sign-in to the window; that is for the owner.)
5. **Ask when unsure.** Several matches, an unknown name, an unclear pack size, a price that may include VAT: stop and ask the owner. The CLI never picks a fuzzy match for you, and neither should you.

Plus the wording rules:

- Say **Contribution**, never "profit". It is the menu price excl. VAT minus the recipe-based ingredient cost, *before* labour, rent and other costs.
- Say **Recipe-based ingredient cost** (what the recipe should cost, not what was used).
- Monthly figures use the owner's own **sales volume estimate**, not a forecast. `—` means no estimate: the dish is left out of the menu total.
- An unknown cost is "cost unknown", never zero.
- Always say **incl. VAT** or **excl. VAT**. Supplier prices are *excl. VAT, as on the invoice*. Menu prices are *incl. VAT*.
- Never advise recipe changes that affect food safety or allergens.

## How to call the CLI

```sh
npm run --silent menupilot -- <command> [options] --json
```

- Always use `--silent` with `--json`. Plain `npm run` prints two header lines (`> menupilot@0.1.0 menupilot` …) to stdout before the JSON, which breaks parsing. `node server/cli.js <command> --json` is equivalent.
- Without `--json` you get readable text, good for a quick look. With `--json` you get an envelope `{apiVersion, command, documentId, revision, data, warnings}` on stdout; errors go to stderr as `{apiVersion, error: {code, message, candidates?}}`.
- Every money value in JSON is an object such as `{"cents": "485", "display": "€4.85"}` or `{"micro": "4850000", "display": "€4.85"}`. Use `display` when talking to the owner. Never convert the integer strings to floating-point numbers.
- `--locale nl` changes `display` formatting (`€ 4,85`) and the language of the human text. Use the owner's locale if it is `en` or `nl`; the exact numbers do not change.
- Money input accepts a comma or a point (`18,00` or `18.00`), no thousands separators.
- Names: an ID or the **exact** name (case-insensitive). Prefer IDs once you know them. If the owner's wording differs from the stored name, run `ingredients` / `dishes` / `preps`, show the owner the closest names and ask.

## Commands

All commands need the server running (`npm start`), except `doctor`, which also works offline.

| Command | Use it for |
|---|---|
| `status` | Is the server up? Data folder, last backup. |
| `doctor` | Health check: Node, folder, port, lock, database, backups. Never repairs. |
| `what-changed --since 30d` | Which dishes got more expensive since a date (`7d`, `30d`, `90d`, any `Nd`, or `YYYY-MM-DD`), with monthly impact. |
| `dishes`, `ingredients`, `preps` | Lists with IDs and current prices. |
| `dish <id\|name>` | One dish: price incl. VAT, VAT, portions, volume, cost, contribution, recipe lines. |
| `ingredient <id\|name>` | One ingredient with its append-only price history. |
| `simulate --dish <id\|name> [--menu-price 14] [--ingredient-price ing_id=14]… [--qty line_id="160 g"]… [--volume 300]` | What-if. Read-only, nothing is saved. |
| `history`, `journal`, `backups` | Version history, change journal, automatic backup copies. |
| `propose add-price --ingredient <id\|name> --pack-price 18,00 --pack-size "1 kg"` | Propose a supplier price. Saves a plan valid for 24 hours; changes nothing. |
| `plans`, `plan status <plan-id>` | Look at proposals and see whether the owner applied them. |

Not for you: `open-url`, `backup restore …`, `doctor --recover-from-backup …`. They change what the owner sees or what is stored; if they are needed, tell the owner what to run and why.

## Proposing a supplier price, step by step

1. Identify the ingredient (exact name or ID). If unclear → ask the owner (see "Ambiguous or unknown name" in [recipes.md](recipes.md)).
2. Confirm with the owner: **price excl. VAT, as on the invoice**, and the **pack size** the price is for (for example `18,00` for `1 kg`). If the invoice shows a price incl. VAT, ask for the excl. VAT price.
3. Run `propose add-price …`.
4. Read the output **with the owner in mind**: repeat the old → new price per kg/l/piece, which dishes change, the monthly contribution change (and which dishes are excluded for lack of volume), and any `⚠` warning (zero price, change above ×3).
5. Tell the owner to open the MenuPilot window, check the panel **Awaiting your confirmation**, and choose **Apply** or **Reject**. Do not say it is done.
6. Optionally check later with `plan status <plan-id>`: `applied`, `rejected`, `pending`, `expired`, `stale` or `superseded`.

Other things to know:

- A newer proposal for the same ingredient replaces the older one (`superseded`). Proposals for other ingredients stay.
- Any change to the data (even unrelated) makes pending proposals `stale`. A proposal also expires after 24 hours. In both cases propose again.
- If a command's response is lost, a plan may exist already. Run `plans` before proposing again.
- Prices above €100,000 per pack are refused (`price-limit`). A zero price is allowed with a warning.

## Exit codes and errors

| Exit | Code | What to do |
|---:|---|---|
| 0 | | Success. `doctor` returns 0 only if every check is OK. |
| 1 | `command-failed`, `server-error`, `conflict`, `plan-stale`, `plan-expired`, … | Read the message. Stale or expired plan → propose again. `doctor` found a `CHECK` → relay its advice. |
| 2 | `usage`, `invalid-argument`, `invalid-unit`, `price-limit` | Fix the syntax, amount, unit or date, and run again. Ask the owner if the value came from them. |
| 3 | `unavailable` | The server is not running. Tell the owner: run `npm start` and leave that window open. |
| 4 | `not-found`, `ambiguous` | Show the `candidates` to the owner and ask which one. |
| 5 | `unauthorized` | The CLI token is missing, insecure or rejected. Run `doctor` and relay its advice; do not work around it (never read or create the token file yourself). |

Full list of codes and the plan format: [../cli.md](../cli.md#exit-codes).

## Warnings in the output

Success output can carry `warnings`: `backup-overdue`, `external-backup-overdue`, `backup-error`, `backup-integrity`, `system-clock`, `local-folder`, `server-unavailable`. Mention them to the owner in one sentence; a backup that is behind is worth a line even if the question was about something else. Proposal warnings (`zero-price`, `large-price-change`) must be shown **before** the owner confirms.

## What the owner sees and does

- Starts MenuPilot with `npm start` and keeps the window open. Stops it with Ctrl+C.
- Opens MenuPilot in the browser. Proposals appear at the top as **Awaiting your confirmation** with old/new prices, affected dishes, food cost and monthly contribution change at their own volume estimates. They choose **Apply** or **Reject** and confirm in a dialog.
- This guards against agent mistakes. It does not stop a program running with the owner's full permissions; so the rules above are rules, not just technical limits. Keep to them.

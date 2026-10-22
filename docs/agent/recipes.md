# Recipes: common owner questions

Each recipe has the question, the exact command, a real output fragment, and how to retell it. Read [README.md](README.md) first (rules and CLI basics).

- The commands are written as `npm run --silent menupilot -- …`. In a real session use the same form; add `--json` when you need exact values. The outputs below are plain text (without `--json`), where that is clearer.
- Outputs come from the fictional demo restaurant (English display; `--locale nl` gives `€ 4,85` style). The owner's numbers will differ.
- The retellings are in Russian, because this owner works in Russian. **Answer in the owner's language.** Keep the numbers exactly as the command printed them; do not recompute or round them.

## 1. The server is not running

Any data command while `npm start` is not running:

```text
$ npm run --silent menupilot -- status
MenuPilot is unavailable. Run npm start, then try the command again.
(exit code 3)
```

With `--json`: `{"apiVersion":1,"error":{"code":"unavailable","message":"MenuPilot is unavailable. Run npm start, then try the command again."}}` on stderr, exit code 3.

Retell: «MenuPilot сейчас не запущен, поэтому я не вижу ваши данные. Откройте терминал в папке MenuPilot, выполните `npm start` и оставьте это окно открытым. Скажите, когда будет готово — продолжу.»

Do not start the server yourself in the owner's data folder, do not read the database as a workaround. `npm run --silent menupilot -- doctor` still works offline and tells what is wrong (port, lock, folder).

## 2. "What got more expensive this month?"

```text
$ npm run --silent menupilot -- what-changed --since 30d
What changed since 2026-09-22
Classic Burger: €4.20 → €4.85 (€0.65); monthly impact -€195.00
Crispy Chicken Burger: €2.34 → €2.49 (€0.15); monthly impact -€33.00
Fries with Burger Sauce: €0.49 → €0.52 (€0.03); monthly impact -€14.18
Tomato Soup: €0.48 → €0.56 (€0.08); monthly impact —; excluded: no-volume
House Red Wine (glass): €1.20 → €1.32 (€0.12); monthly impact -€31.20
Menu monthly impact: -€273.38
Excluded: 1 without volume; 0 with unknown/incomplete cost.
```

Each line is the Recipe-based ingredient cost per portion then → now, and the monthly impact at the owner's own volume estimate. A negative impact means monthly contribution got smaller.

Retell: «За последние 30 дней подорожали пять блюд. Сильнее всего ударил Classic Burger: себестоимость по рецептуре была €4,20, стала €4,85 — это на €0,65 больше за порцию. С вашей оценкой продаж (300 в месяц) это минус €195,00 к вкладу в месяц. По всему меню — минус €273,38 в месяц, но это без Tomato Soup: для него не указан объём продаж.»

Note: say "вклад" / "Contribution", not "прибыль". Mention that it is before labour, rent and other costs when the owner asks about profit.

Other periods: `--since 7d`, `--since 90d`, `--since 45d`, `--since 2026-10-01`. A future date is refused (exit 2).

## 3. A dish shows "—" instead of a monthly figure

In the output above: `Tomato Soup: … monthly impact —; excluded: no-volume`.

Meaning: the owner has not entered a monthly sales estimate for this dish. It is left out of the menu total. It does not mean zero impact. The JSON says `"excludedReason": "no-volume"`. Other reasons: `cost-unknown` (a price is missing somewhere in the recipe), `no-price-on-date`.

Retell: «У Tomato Soup в MenuPilot не указан объём продаж в месяц, поэтому сумму в евро я не могу назвать, и в общий итог она не вошла. Если вы вставите примерное число порций в месяц в рецепте блюда, итог станет точнее.»

Do not suggest a number yourself.

## 4. "What does a dish cost and how much does it earn?"

```text
$ npm run --silent menupilot -- dish "Classic Burger" --json
```

```json
{"apiVersion":1,"command":"dish","documentId":"c7363b7e-…","revision":3,
 "data":{"id":"dish_classic_burger","name":"Classic Burger",
  "menuPriceInclVat":{"cents":"1308","display":"€13.08"},"menuPriceLabel":"incl. VAT","vatRateBp":900,
  "portions":1,"monthlyVolume":300,
  "recipeBasedIngredientCost":{"micro":"4850000","display":"€4.85"},
  "contribution":{"micro":"7150000","display":"€7.15"}, "lines":[…]},"warnings":[]}
```

Use `--json` for `dish`: the plain text output prints raw `…Micro` fields. `lines` lists the recipe lines (ingredient or prep).

Retell: «Classic Burger стоит в меню €13,08 с НДС (9%). Себестоимость продуктов по рецептуре — €4,85 на порцию, без НДС. Вклад (цена без НДС минус эта себестоимость, до зарплат, аренды и прочих расходов) — €7,15 с порции. Это теоретическая себестоимость по рецепту, а не фактический расход продуктов.»

## 5. "What if I raise the Classic Burger price to €14?"

`--menu-price` is the new price **incl. VAT**. `simulate` changes nothing.

```text
$ npm run --silent menupilot -- simulate --dish "Classic Burger" --menu-price 14
Classic Burger: recipe-based ingredient cost €4.85; contribution €7.99 (+€0.84); monthly contribution €2,398.21 (+€253.21)
```

Retell: «Если поставить €14,00 с НДС, вклад с порции вырастет с €7,15 до €7,99 (плюс €0,84). При ваших 300 порциях в месяц это около плюс €253,21 в месяц — при условии, что продажи не изменятся. Это расчёт, а не прогноз: сколько гостей уйдёт или останется, MenuPilot не знает.»

You may add `--volume 250` to try another sales estimate: «а если продажи упадут до 250?». Say it is the owner's what-if number.

## 6. "What if beef mince costs €14 instead of €17?"

`--ingredient-price <ingredient id>=<pack price excl. VAT>`; repeat the flag for several ingredients. Find IDs with `ingredients`.

```text
$ npm run --silent menupilot -- simulate --dish "Classic Burger" --ingredient-price ing_beef=14 --volume 300
Classic Burger: recipe-based ingredient cost €4.31; contribution €7.69 (+€0.54); monthly contribution €2,307.00 (+€162.00)
```

Retell: «Если фарш будет стоить €14,00 за упаковку (без НДС), себестоимость Classic Burger станет €4,31 вместо €4,85, а вклад с порции — €7,69 (плюс €0,54). Это плюс €162,00 в месяц при 300 порциях.»

The price override flows through preps too (for example a sauce that uses the ingredient).

## 7. "What if the patty is 160 g instead of 180 g?"

`--qty <line id>=<amount with unit>`; units `g`, `kg`, `ml`, `l`, `pc`. Line IDs are in `dish … --json` (`lines[].id`). Quantity overrides affect only the dish's own lines, not lines inside a prep.

```text
$ npm run --silent menupilot -- simulate --dish dish_classic_burger --qty "l1=160 g"
Classic Burger: recipe-based ingredient cost €4.51; contribution €7.49 (+€0.34); monthly contribution €2,247.00 (+€102.00)
```

Retell: «С котлетой 160 г вместо 180 г себестоимость €4,51 (было €4,85), вклад с порции €7,49 (плюс €0,34), в месяц около плюс €102,00 при 300 порциях.» Do not comment on whether a smaller portion is acceptable for guests, allergens or food safety.

## 8. "What happened with the price of beef?"

```text
$ npm run --silent menupilot -- ingredient "Beef mince 80/20"
id: ing_beef
name: Beef mince 80/20
unit: g
priceHistory: - sequence: 1
  recordedAt: 2026-08-08T07:39:01.658Z
  packPriceCents: 1400
  packPrice: €14.00
  packPriceLabel: excl. VAT
  packSizeMilli: 1000000
- sequence: 2
  recordedAt: 2026-10-08T07:39:01.658Z
  packPriceCents: 1700
  packPrice: €17.00
  packPriceLabel: excl. VAT
  packSizeMilli: 1000000
```

`packSizeMilli: 1000000` is 1 kg for a gram ingredient (thousandths of the base unit, g). Prices are append-only; the last entry is the current price.

Retell: «Фарш: 8 августа упаковка 1 кг стоила €14,00 без НДС, 8 октября — €17,00. Сейчас €17,00 за кг.» (Per-kg conversion: use the unit price a command prints, for example in a proposal; do not divide yourself.)

## 9. "The supplier sent an invoice: mince is €18 per kg. Enter it."

First check with the owner: is €18,00 the price **excl. VAT, as on the invoice**, for exactly 1 kg? Then:

```text
$ npm run --silent menupilot -- propose add-price --ingredient "Beef mince 80/20" --pack-price 18,00 --pack-size 1 kg
Plan b1feed6b-d4df-469c-ae75-516cd3282ebc: pending
Beef mince 80/20 [ing_beef]
Supplier price excl. VAT, as on the invoice
€17.00 → €18.00 excl. VAT; 1 kg
€17.00/kg → €18.00/kg excl. VAT
Expires: 2026-10-23T07:39:21.306Z
Classic Burger: Recipe-based ingredient cost €4.85 → €5.03 excl. VAT; food cost 40.4% → 41.9%; monthly contribution change -€54.00
Menu monthly contribution change: -€54.00; excluded: 0 without volume, 0 with unknown cost.
Waiting for owner confirmation in MenuPilot
```

The ingredient is **not** changed yet.

Retell: «Я подготовил предложение: фарш с €17,00 до €18,00 за кг (без НДС, как в счёте). Если принять, себестоимость Classic Burger станет €5,03 вместо €4,85, доля продуктов в цене — 41,9% вместо 40,4%, а вклад в месяц уменьшится на €54,00. Пока ничего не записано. Откройте окно MenuPilot, в блоке «Ожидает вашего подтверждения» проверьте цифры и нажмите «Применить» (или «Отклонить»), затем подтвердите в окне. Предложение действует 24 часа.»

Never say "I entered the price" or "done". If the owner says they already confirmed, check: `plan status b1feed6b-d4df-469c-ae75-516cd3282ebc` → `applied`.

## 10. Ambiguous or unknown name

Unknown or approximate name (the CLI does not guess):

```text
$ npm run --silent menupilot -- ingredient "Beef mince"
No ingredient matches “Beef mince”. Perhaps you meant: Beef mince 80/20 (ing_beef).
- ing_beef: Beef mince 80/20 (g); pack €17.00 excl. VAT
(exit code 4)
```

Two ingredients with the same exact name:

```text
$ npm run --silent menupilot -- ingredient "Beef mince 80/20"
More than one ingredient has the exact name “Beef mince 80/20”. Choose an ID.
- ing_beef: Beef mince 80/20 (g); pack €17.00 excl. VAT
- ing_beef_2: Beef mince 80/20 (g); pack €17.00 excl. VAT
(exit code 4)
```

Same for `propose add-price` (`More than one ingredient matches. Choose an exact ID.`). With `--json` the error has `error.code` `ambiguous` or `not-found` and `error.candidates`.

Retell: «У меня два подходящих ингредиента: «Beef mince 80/20» (фарш, упаковка €17,00 без НДС) и ещё один с тем же названием. Какой из них? Если не уверены — загляните в список ингредиентов в MenuPilot.» For a near match: «Точного «Beef mince» нет, есть «Beef mince 80/20». Вы это имели в виду?»

Only after the owner chooses, use the ID (`--ingredient ing_beef`). Do not pick the "most likely" one.

## 11. Price warning: zero price or more than ×3

If the proposed price per kg/l/piece differs from the previous one by more than ×3 (up or down), or is zero, the output carries `⚠` lines. Example from a €60 pack for an ingredient that cost €17:

```text
$ npm run --silent menupilot -- propose add-price --ingredient "Beef mince 80/20" --pack-price 60 --pack-size 1 kg
Plan 3e8454c0-abb9-45f3-9b05-7d78393ff802: pending
Beef mince 80/20 [ing_beef]
Supplier price excl. VAT, as on the invoice
€17.00 → €60.00 excl. VAT; 1 kg
€17.00/kg → €60.00/kg excl. VAT
…
Classic Burger: Recipe-based ingredient cost €4.85 → €12.59 excl. VAT; food cost 40.4% → 104.9%; monthly contribution change -€2,322.00
…
⚠ The price per kg/l/pc changes by more than ×3. Check the pack size and invoice before confirming.
Supersedes: b1feed6b-d4df-469c-ae75-516cd3282ebc
```

`Supersedes:` means this proposal replaced an earlier pending one for the same ingredient.

Retell: «Внимание: цена выросла больше чем в 3 раза — с €17,00 до €60,00 за кг. Тогда себестоимость Classic Burger была бы €12,59, а это больше его цены без НДС. Это стоит перепроверить: возможно, другой размер упаковки или в цене есть НДС. Посмотрите счёт: цена без НДС и сколько кг в упаковке. Предыдущее предложение по фаршу (€18,00) я заменил этим. Если €60 неверно, скажите правильную цену, и я предложу заново.» A zero price gives its own warning («цена равна нулю») — same approach: ask for the invoice.

Do not talk the owner out of a price that is correct; just make sure they have seen the warning.

## 12. The proposal is stale, expired or replaced

```text
$ npm run --silent menupilot -- plan status 6952f6c4-c899-45ed-a2a7-3d73869606f1
Plan 6952f6c4-c899-45ed-a2a7-3d73869606f1: stale
Aged cheddar [ing_cheddar]
…
Ask the agent to propose again.
```

Statuses: `pending` (waiting for the owner), `applied`, `rejected`, `expired` (24 hours passed), `stale` (any data changed after the proposal), `superseded` (a newer proposal for the same ingredient replaced it). An unknown id gives `This plan is no longer available. Ask the agent to propose again.` (exit 4). If the owner sees an error in the window like "Data changed. Ask the agent to propose again." it means the same.

What to do: run `plans` to see what is still pending, then run `propose add-price …` again with the same values (after confirming with the owner that the invoice price is still right). The consequences are recalculated against the current data.

Retell: «Это предложение устарело: после него в MenuPilot что-то изменилось (или прошло 24 часа). Цифры в нём могли поменяться, поэтому применить его нельзя. Я подготовлю новое — оно покажет актуальные последствия. Подтвердить цену по-прежнему €18,00 за кг без НДС?»

## 13. "Are my backups OK?" / "Is everything working?"

```text
$ npm run --silent menupilot -- doctor
OK node: 25.8.1
OK platform: darwin
OK data-folder: /…/data; 151382 MiB free
OK local-folder: /…/data
OK cli-token: permissions 0600
OK lock: server is reachable
OK port: 47123: MenuPilot is listening
OK database-format: SQLite format 2; document schema 2
OK backup-freshness: 2026-10-22T07:43:34.057Z
OK external-backup: not configured
OK backup-integrity: no damaged backups
OK system-clock: clock check clear
OK backup-error: no backup error
```

```text
$ npm run --silent menupilot -- backups
1792655003144-9cb69cda-…  2026-10-22T07:43:23.144Z  revision 3  DB v2  startup
1792654830283-33d0b961-…  2026-10-22T07:40:30.283Z  revision 2  DB v2  shutdown
```

A failed check starts with `CHECK` instead of `OK`, has advice, and makes the exit code 1. `external-backup: not configured` is normal unless the owner set `MENUPILOT_BACKUP_DIR`.

Retell (all OK): «Всё в порядке: программа работает, база целая, автоматические копии делаются, последняя сделана сегодня. Копии лежат на этом же компьютере; если он сломается, они пропадут, поэтому время от времени сохраняйте файл через «Данные → Экспорт резервной копии» в другое место.» If a check failed: relay the advice in one or two sentences and do not run restore or recovery commands yourself — tell the owner which command exists and why.

## 14. The owner gives a price that may include VAT

Owner: «Фарш 19,62 за кг» — and the invoice shows a VAT line.

Ask: «Это цена без НДС, как в счёте, или с НДС?» MenuPilot compares supplier prices **excl. VAT**. Do not remove VAT yourself ("÷1.09") — ask for the excl. VAT figure from the invoice. If the owner only has the incl. VAT number, ask them to read the excl. VAT line or total from the invoice.

## When a command returns something unexpected

- Exit 2 (`usage`, `invalid-argument`, `invalid-unit`, `price-limit`): wrong syntax, amount, unit or date. Examples: `Pack size must include g, kg, ml, l or pc.`, `This ingredient uses g; l is incompatible.`, `Enter a non-negative amount with at most two decimal places.`, `--since cannot be in the future.` Fix and retry; if the value came from the owner, ask.
- Exit 5 (`unauthorized`): run `doctor`; relay the advice.
- Anything else: show the owner the message in plain words and do not try other routes into the data.

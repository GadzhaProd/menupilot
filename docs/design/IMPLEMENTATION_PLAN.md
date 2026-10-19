# План реализации для координатора и исполнителя

Этот пакет меняет только дизайн-документы. Прежде чем править приложение, координатор
фиксирует выбранное направление; не считать файлы доказательством уже реализованной
функции или разрешением расширять MVP. Stage 0–7 уже отмечены завершёнными в
docs/planning/04_IMPLEMENTATION_PLAN.md; данный пакет — запрошенное владельцем
дизайн-направление для отдельного последующего UI-прохода.

## 1. Зафиксировать контрольные данные и границы

Прочитать PRODUCT.md, DESIGN.md, SCREEN_CONCEPTS.md, COMPONENT_PLAN.md, AGENTS.md,
03_ARCHITECTURE.md. Зафиксировать текущие screenshots и `npm run check`. Сохранить
контрольный сценарий: €12.00 net, cost €4.20 → €4.85, contribution €7.80 → €7.15,
300 порций, −€195.00/month. Не переносить фиктивные строки HTML в demo.json.

Формулы, document schema, store methods, route IDs, help section IDs и поведение
импорта/сценариев остаются прежними. NL — отдельное уточнение scope; резервировать
длину строк, не изобретать непроверенные переводы финансовых терминов.

## 2. Токены и шрифты

**Файлы будущего изменения:** `src/index.css`, при необходимости локальные font assets
и соответствующая атрибуция. Сопоставить semantic tokens из DESIGN с текущими shadcn
variables. Source Sans 3 self-hosted, regular + semibold, OFL/license сохраняется.
Табличные цифры централизованно в money/number role, не отдельные случайные классы.

Проверить контраст текста, placeholder, borders, focus, hover, selected, disabled,
warning/error на реальном фоне. Размеры контролов 48 px; не заменять все 14 px на 18 px
механически. Тёмную тему не добавлять. Никаких новых npm-зависимостей на этом шаге.

## 3. Примитивы и оболочка

**Файлы:** `src/components/ui/button.tsx`, `input.tsx`, `select.tsx`, `label.tsx`,
`dialog.tsx`, `table.tsx`, `card.tsx`, `badge-delta.tsx`, `alert.tsx`,
`src/components/form-field.tsx`, `src/ui/layout/Shell.tsx`.

Сначала проверить Button/Input/Dialog на одном существующем потоке. Для Origin Input
исполнить лицензионный шаг из COMPONENT_PLAN до копирования композиции. Новых Radix
или icon packages не нужно. Привести card к редким крупным рабочим областям; не
переписывать компонентную библиотеку целиком. Shell: 200 px текстовая навигация desktop,
верхняя на tablet, inline раскрытие Menu на 375. Сохранить skip link, aria-current,
route focus; Help продолжает сам управлять фокусом своих секций.

**Проверка:** Tab/Shift+Tab, Enter/Space, Escape, возврат фокуса; открытый диалог
при 375 px и экранной клавиатуре; error text и focus не закрыты footer.

## 4. Dashboard

**Файлы:** `src/ui/pages/DashboardPage.tsx`, `src/ui/dashboard/SummaryCards.tsx`,
`ComparisonPicker.tsx`, `DishImpactTable.tsx`, `DishImpactCards.tsx`, `PrepCostList.tsx`.

Превратить SummaryCards в полосу, сгруппировать before/now, сохранить каждую метрику
и все VAT-labels. Mobile показывает короткий набор и All figures; это раскрытие
дополнительных данных, не новая формула. Не менять порядок блюд и не добавлять сортировку.
Каждая мобильная и desktop-проекция получает один и тот же типизированный результат
из domain; не складывать monthly total в компоненте. Все цены форматировать как сейчас.

**Приёмка:** пустое меню, все unknown, mixed known/unknown, no-volume, volume=0;
итог не включает отсутствующий объём; prep не получает contribution. Desktop и 375
показывают одинаковые значения; body не скроллится горизонтально.

## 5. Simulator — наиболее рискованный UI-шаг

**Файлы:** `src/ui/pages/SimulatorPage.tsx`, `src/ui/simulator/Workbench.tsx`,
`ScenarioCard.tsx`, `BaselineCards.tsx`, `ComparisonTable.tsx`, `DishPicker.tsx`,
`DeleteScenarioDialog.tsx`; при необходимости view-only selection state.

Выделить активный редактор A/B/C, сохранив drafts всех сценариев. Не менять
`session.tsx`, `scenarioForm.ts`, `scenarios.ts` ради косметики; если перестановка
требует изменения жизненного цикла, сначала тест на сохранность drafts и переключения.
Сначала desktop edit/compare, затем mobile baseline/active. Read-only values — общие
компоненты/derived props; два независимых input state запрещены. Правки ingredient-price
проходят в nested preps по существующему calc; quantity overrides только top-level.

Сохранить все восемь строк ComparisonTable, highest/tie/exclusion logic, save/remove/
update baseline и различие shared/own volume. Не брать marketing comparison code,
не помещать `recommended` на сценарий. Stale дельты не выводить как актуальные.

**Приёмка:** A/B/C → переходы не теряют ввод; real document не меняется до/после
simulation; failed save сохраняет экран и draft; изменение общей оценки не стирает
override=0; пустой input наследует baseline/общий объём по текущим правилам.

## 6. Recipe editor и Ingredients

**Файлы:** `src/ui/recipe/RecipeEditor.tsx`, `LineRow.tsx`, `CostSummary.tsx`,
`DeleteRecipeDialog.tsx`, `src/ui/pages/IngredientsPage.tsx`,
`src/ui/ingredients/IngredientDialogs.tsx`, `PriceFields.tsx`.

Только композиция: детали/состав/итог, компактные согласованные строки, New price и
History видимы, Rename/Delete в подписанном раскрытии. Не ставить новую библиотеку
dropdown: при необходимости простой inline details либо уже одобренный primitive
после согласования точной версии. Не добавлять новый поиск.

Сохранить supplier hint, display-only pack conversion, base units, append-only history,
dish/prep различия, запрет удаления используемой сущности, depth/cycle errors и atomic
failed saves. Форма цены остаётся Radix dialog, а не inline-форма из демонстрационного HTML.

**Приёмка:** g/kg, ml/l, pc; запятая и точка в money strings; empty vs zero;
невозможная единица; неизвестная цена через prep; сохранение невалидной формы.

## 7. Help и Data

**Файлы:** `src/ui/pages/HelpPage.tsx`, `src/ui/help/HelpBlocks.tsx`, `HelpNav.tsx`,
`HelpLink.tsx`, `images.ts`, существующие help images; `src/ui/pages/DataPage.tsx`
и `src/ui/data/ReplaceDataDialog.tsx` только если наследуемые стили требуют поправки.

Сохранить весь текст EN/RU, не копировать сокращённую статью мокапа. Полезные большие
цели и размер текста текущего Help не уменьшать. Оглавление/язык/печать/deep links
проверить после смены Shell. Снять новые help screenshots только после завершения
всех production-экранов. Data сохраняет export/import/reset и защитные подтверждения.

## 8. Проверка и финальный Impeccable-проход

- `npm run check`: typecheck + core tests + UI tests + production build. При изменении
  поведения сначала регрессионный тест. В расчётах изменений не ожидается; если они
  понадобились, остановить UI-этап и согласовать причину, затем TDD в test/calc.
- Через **bb browser-automation** проверить production preview на `/menupilot/`,
  все hash routes, desktop 1440 и 375, 200% zoom, длинные EN/NL имена/подписи,
  ошибки полей, dialog keyboard/focus, reduced motion и отсутствие body overflow.
- Последовательность проверки владельцем: новая цена → Dashboard → Simulate → A/B/C
  → сохранение → переход обратно → реальные цены не изменены → export/import copy
  в отдельном тестовом профиле → Help EN/RU и печать.
- Impeccable **audit**: a11y, contrast, focus, responsive, numeric labels, semantic
  states. **polish**: равные колонки, переносы, единый размер controls, текст при ошибках,
  соответствие DESIGN. Реально запустить `context` в новом сеансе, читать соответствующие
  reference/audit.md и polish.md; не называть ручной взгляд автоматическим audit.
- Один `impeccable detect --json <changed-ui-targets>` в конце, сохранить вывод;
  findings разобрать, не объявлять exit 2 успешным чистым проходом. По возможности
  независимый reviewer координатора, так как данный дочерний поток не мог делегировать.
- После реализации обновить DESIGN по фактическому интерфейсу; `.impeccable/design.json`
  и surface briefs возможны только в рамках разрешённых координатором путей.
- Один ограниченный круг desktop/mobile screenshots → пакет правок → подтверждающий
  круг. Не прятать оставшиеся ограничения в заявлении «всё готово».

## Разбиение на коммиты

1. Токены/шрифт/базовые controls и Shell.
2. Dashboard.
3. Simulator.
4. Recipe + Ingredients (можно разделить по экранам).
5. Help/Data и финальная проверка.

Один функциональный блок в коммите; только после успешных проверок. Без push/merge
и публикации без отдельного разрешения владельца. Не обновлять зависимости заодно.

## Риски и открытые решения

| Риск | Как контролировать |
|---|---|
| Потеря draft при переключении A/B/C | регрессионный UI-тест до перестановки state/монтажа |
| Две разные mobile/desktop суммы | единый domain result, общий formatter, tests обеих проекций |
| NL длиннее EN | flex/min-width, переносы, pseudolocalization; перевод отдельным scope |
| Новый шрифт меняет переносы | self-hosted WOFF2 + fallback; проверка fonts.ready и 200% |
| Лицензия или deps 21st не совпадают с registry | проверять source imports и LICENSE, не ставить latest |
| Sidebar сужает таблицу на небольшом ноутбуке | до 1200 перейти на top navigation; внутренний table scroll |
| Акцент mistaken for recommendation | active синий, highest текстовый зелёный; никогда recommended |
| Статичные mockups принимают за готовую программу | явная подпись static, отключённые save, ограничения в отчёте |

Открыто: утверждение направления владельцем/координатором, входит ли NL в будущий
этап. Motion не требуется для предложенных эффектов; если понадобятся сложные
переходы, точную версию проверить и согласовать до добавления в lockfile.

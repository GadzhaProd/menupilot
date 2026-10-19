# Реализация C+ — план для координатора

Владелец выбрал C+ «Кухонная линия» с полноценными light/dark, верхним меню и явным EN/NL. Корневой DESIGN.md теперь канонический. Этот документ разрешает планировать изменения, но текущий коммит содержит только документы/мокапы; src/calc и src/store не изменены. A остаётся запасным, B отклонён.

## 1. Зафиксировать поведение до изменения оболочки

Прочитать PRODUCT, DESIGN, planning02/03/04, AGENTS и [C+макеты](alternatives/C-plus/index.html). Снять production desktop/375 и выполнить npm run check. Зафиксировать source-order dishes, route IDs, Help anchors, errors/drafts/baseline lifecycle. Контроль: historical4.20→4.85; contribution7.80→7.15;300portions⇒−195.00; menu−273.38. Simulator baseline today cost4.85, B price14.17incl/13.00excl ⇒+300/month; C volume200⇒−715/month.

Все денежные вычисления остаются в calc; BigInt нельзя переводить в Number. Сохраняются данные, функции, формулы, сравнения, unknown/zero различия, append-only history, ограничения prep и atomic saves/import. Фиктивные HTML-цифры не переносить в demo.json.

## 2. Темы и локальные UI preferences

Будущие файлы: `src/index.css`, `src/ui/theme/ThemeProvider.tsx`, `src/ui/theme/preferences.ts`, `src/ui/theme/ThemeSelect.tsx`, минимальный bootstrap в `index.html` или существующей точке входа. Из DESIGN перенести semantic роли в shadcn variables: background/foreground,card,popover,muted,border,input,ring,primary,destructive +cost/contribution semantic colours. Ни literal theme colours по компонентам, ни filter invert.

`ThemePreference = 'system'|'light'|'dark'`; default system. Key **menupilot.ui.theme.v1**, отдельно от document/baseline/localStorage ключей приложения. Parse allowlist; invalid/absent→system. try/catch при read/write; при ошибке сохранить in-memory выбор и показать локализованное спокойное уведомление. Не использовать localStorage.clear и не привязывать тему к импорту/reset данных. Подписка matchMedia change только меняет effective theme, когда preference=system; event storage синхронизирует вкладки, cleanup on unmount. Ручной выбор переживает OS changes. Не записывать system как resolved light/dark.

До paint применить validated choice и color-scheme, чтобы не было светлой вспышки. Bootstrap использует тот же формат/ключ и минимальную проверку, не импортирует store; при CSP дать hash/nonce или отдельный early script. Header native select с видимым Theme и опциями System/Light/Dark; на 375 доступное имя остаётся полным. Input native UI/scrollbar/selection тоже следуют теме.

Печать: @media print принудительно light, независимо от data-theme. Не менять storage; после выхода возвращается screen theme. Скрыть nav/editor/theme controls, выводить дату/название/selected result и полную таблицу; все сценарии A/B/C, все блюда и нужные VAT-labels. Повтор thead, avoid row breaks, A4landscape. Не рассчитывать на printing backgrounds: знаки и границы должны работать ч/б.

Проверки: default system при обеих OS темах, live OS update, manual override, reload, cross-tab, invalid value, storage denied; dark→print light→dark. Контраст текст/числа/акцент/±/focus обеих тем, включая placeholders и popovers. [48 исходных пар](alternatives/C-plus/CONTRAST.md); runtime states проверить отдельно.

## 3. Явный i18n EN/NL до переноса экранов

Будущие `src/ui/i18n/en.ts`, `nl.ts`, `index.ts`, `LocaleProvider.tsx`, типизированный `t(key,params)` и hook. Без новой зависимости: небольшие typed dictionaries достаточно текущему MVP. EN — тип ключей, NL — `satisfies Record<TranslationKey,string>`; compile-time и тест полного покрытия. Никакого поиска английской строки в DOM, MutationObserver, replace(textContent), innerHTML, post-render translation. Все UI strings из render через t, включая aria,validation,status,empty,confirm,table headings и Help nav.

Key **menupilot.ui.locale.v1**, en/nl allowlist, default EN для сохранения поведения; `html.lang` синхронно меняется с LocaleProvider. UI preference не попадает в JSON export/import. Не переводить пользовательские dish/supplier names. Даты черезlocale-aware formatter, all money через существующие exact integer formatters с параметром locale; если нужен новый display adapter, покрыть точку/запятую/отрицательные/большие значения без Number(BigInt). Не менять parsing или хранимые единицы ради локализации.

[Канонический терминологический словарь](alternatives/C-plus/I18N.md). В EN сохранить «Contribution (before other costs)», «Recipe-based ingredient cost», supplier hint incl/exclVAT. В NL bijdrage≠winst. Строки собирать цельными ключами с параметрами, не переводить слова по отдельности. Ошибки domain/store перевести по stable typed codes через UI adapter; если сейчас есть только message, отдельно добавить код результата с тестами, не regex перевод текста ошибки и не менять document schema. Generic localized fallback для неизвестной ошибки, без скрытого английского fallback известных ключей.

Help: сохранить EN/RU и anchors; добавить полный NL content set с теми же typed block/section IDs, а не переводить готовый DOM. Язык оболочки и язык статьи должны быть явными; RU остаётся дополнительным выбором. До выпуска — языковое ревью NL финансовых формулировок, при этом не отложить инфраструктуру i18n до конца.

## 4. Шрифты, primitives, оболочка

Archivo600 и SourceSans3 self-hosted OFL из пакета; полные лицензии и provenance сохранить. Не загружать Google Fonts runtime. Общий MoneyValue/CurrencyText получает formatted string, tabular-nums, sign и semantic tone по смыслу метрики; negative contribution и increasedcost используют negative, zero нейтрален. Существующие calc/formatters — источник значения.

Файлы: `src/components/ui/{button,input,select,label,table,dialog,alert,badge-delta}.tsx`, `src/components/form-field.tsx`, `src/ui/layout/Shell.tsx`, theme/i18n additions. Верхняя nav: full1440, отдельная строка 1024, disclosure375. Все route/state/deep links сохраняются. Targets48px, outline3px, captions15px; не заменять полезные подписи иконками. Двухтемные dialogs retain focus trap, Escape/return, scroll body, errors у полей.

[21st решения C+](alternatives/C-plus/COMPONENT_PLAN.md): build own ThemeSelect/ScenarioChoice на существующем стеке. Ни один новый кандидат не копируется; AGPL theme dropdown исключён. Без `latest` и новых dependency packages. Motion14.4.0 опционален: если нужен, exact pin+lockfile и bundle/runtime check; правила лицензий AGENTS остаются обязательными при любом будущем copy/adapt.

## 5. Dashboard

Файлы: `src/ui/pages/DashboardPage.tsx`, `dashboard/{SummaryCards,ComparisonPicker,DishImpactTable,DishImpactCards,PrepCostList,format}.tsx/ts`, тонкий `src/ui/domain/dashboard.ts` при необходимости derived selection.

Верх: existing menu monthly total + **max positive absolute costDeltaCents per portion exclVAT**, только known comparable values. Это новая явно запрошенная владельцем selection projection, не новая финансовая формула. Сравнивать BigInt напрямую; tie — первый в текущем порядке и явный tied label; основной список не сортировать. Missing volume допускает cost-highlight, monthly будет—. Нет положительных дельт/все unknown→объяснение вместо ложного «наибольшего» нуля. Любой click открывает существующий simulator route для выбранного ID.

Таблица: 19sep/now/change/contribution/monthly; menu incl/excl и food-cost points в отдельных подстроках. Не удалять действующие значения/действия ради плотности; row recipe-link и Simulate различить в production. Screenshot mock ведёт к simulator для быстрой демонстрации и не определяет routing production. Mobile — связанные строки и раскрытие полных данных, без горизонтального body scroll. Preps без contribution.

Приёмка: control figures, tie, no positive delta, unknown, missing/zero volume, comparison date before firstprice, длинные EN/NL имена/суммы,1024/1280 cell overflow. Total из domain/store, не sum в JSX.

## 6. Simulator

Файлы: `src/ui/pages/SimulatorPage.tsx`, `simulator/{Workbench,ScenarioCard,BaselineCards,ComparisonTable,DishPicker,DeleteScenarioDialog}.tsx`, format labels. Большая chosen monthly delta над рабочей областью. Editor слева 238–280px, compare справа,1024+. На 375 baseline и active рядом, editor ниже; рядом с mobile editor повторить derived chosen result, чтобы видеть эффект ввода без прыжка наверх. Это одна source projection, не второй draft/calculation.

Сохранять 8 реальных строк ROWS, все delta hints, margin%, highest/tie/exclusion и disclaimer. Не менять `session.tsx`/reducers/store effects ради расположения. A/B/C draft сохраняются при переключении и responsive reflow, active editor знает собственную базу. All calculations derived useMemo, никогда не serialized. Stale overrides не получает актуальную delta. Shared/own volume, zero override, nestedprep price propagation и top-level quantity semantics прежние.

Radios/tabs: полный текст, aria/keyboards, visible focus, активная колонка связана с правильным draft. Не переносить mock's readonly inputs и HTML panel-toggle в React lifecycle. Сохранить Save/replace/delete/updatebaseline с подтверждениями. failedsave оставляет document и draft; no auto real-data mutation.

Приёмка: переключение A/B/C не теряет ввод; валидный/невалидный moneydraft; baseline stale; prices unknown; volume absent/0/override; same/tie scenarios; удаление/отмена; клавиатура и viewport reflow; суммы совпадают с calc tests.

## 7. Остальные экраны и движение

RecipeEditor/LineRow/CostSummary и Ingredients/PriceFields/IngredientDialogs наследуют токены, t и размеры; не менять формы/prep validation/history. DataPage/ReplaceDataDialog сохраняют backup/import/reset safeguards и не сбрасывают theme/locale. HelpPage/HelpBlocks/HelpNav — Read-mode,65–75ch,контраст обеих тем, EN/NL и сохранённый RU; новые help screenshots только после стабилизации реальных экранов.

Движение: theme colors сразу (никаких промежуточных низкоконтрастных пар); selected marker160–180ms; после валидного расчёта одно 180ms underline/outline emphasis. Денежные цифры сразу конечные, без ticker/rolling, без задержки field validation. Reduced motion мгновенный state без потери обратной связи. Не добавлять motion ради fade каждого блока; CSS достаточно простому prototype.

## 8. Финальная приёмка

Выполнить реальные Impeccable context по новой сессии, audit по 5 измерениям, затем polish по подтверждённым проблемам. Если context требует detect — один `detect --json <changed targets>`, findings разобрать, не приравнивать exit0 к визуальному качеству. Не заменять работу выдуманными CLI `audit/polish`: это playbooks. Зафиксировать browser evidence до/после, не бесконечный цикл косметики.

`npm run check` (typecheck+core+UI+build); production preview under /menupilot/. Реальный bb-browser desktop1440,1280,1024,375,200%zoom; light/dark/system/print/reduced-motion, keyboard dialogs/fields/errors, unknown/empty/loading/stale/long NL. Проверить Safari16.4+,Chrome111+,Firefox128+ и настоящий мобильный touch/клавиатуру. Мокап проверен Chromium и не заменяет эти production проверки. Размер/console/network/font fallback/accessibility inspect отдельно.

Координатор принимает этапы небольшими коммитами: themes+i18n foundations →primitives+Shell →Dashboard →Simulator →Recipe/Ingredients →Help/Data →audit/polish. Не менять расчёты и модель данных без отдельного обоснованного задания; никакого push/deploy из дизайн-потока.

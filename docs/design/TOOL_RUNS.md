# Инструменты и фактические проверки

Дата: 2026-10-19. Ветка отдельного worktree; `bb status` подтвердил родителя
`thr_fx3nks64rw`. В начале `git status --short` был пустым.

## Impeccable 4.3.1

Реально прочитан skill:
`/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/SKILL.md`.
Применены references init, new-work, shape, critique, operate, document, craft-floor.

Ниже `IMPECCABLE` обозначает точный исполняемый файл:
`/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/scripts/impeccable`.
Все команды выполнялись из корня этого проекта.

| Реальный вызов | Результат |
|---|---|
| `IMPECCABLE context` | exit 0; `NO_PRODUCT_MD`, `BUILD_INIT_REQUIRED`, `EXISTING_VISUAL_SYSTEM`, `MANUAL_DETECTOR_REQUIRED`; resolved projectRoot совпал с worktree, productPath/designPath null |
| `IMPECCABLE concept-seed --scope direction --mode operate` | exit 0; key `82a98500`, source `api`, assigned index **7**, 6 challengers; approved pool `c3b204a1eed6`, 306/564 |
| `IMPECCABLE detect --json src/ui src/components` | exit **2**, один warning `side-tab`, HelpBlocks.tsx:121; [полный JSON](evidence/incumbent-detect.json) |
| `IMPECCABLE detect --json docs/design/mockups` | exit **2**, 39 findings до пакета правок: 13 warnings, 26 advisories; [полный JSON](evidence/mockups-detect.json) |

`init`, `shape` и `critique` выполнены как **playbook-процессы навыка**, а не выданы
за отдельные запущенные shell-команды. Init создал PRODUCT.md; shape/new-work —
дизайн-направление, DESIGN.md, SCREEN_CONCEPTS и HTML. Critique: браузер + код +
detector, с явным degraded-banner. Формальные audit/polish будущей реализации пока
не выполнены: их шаги включены в IMPLEMENTATION_PLAN.

`context` сообщил `UPDATE_AVAILABLE` (latest 4.6.0). Обновление не запускалось,
сохранена указанная владельцем 4.3.1. Ни один инструмент не менял src, test или
package.json; откатывать чужие/побочные правки не пришлось.

## Ограничения workflow

- Пользователь прямо запретил дочернему потоку делегирование и запись вне
  PRODUCT.md/DESIGN.md/docs/design. Поэтому critique single-context; нет выдуманного
  независимого review, sidecar `.impeccable/design.json`, config, critique storage
  или build-phase state. Будущий исполнитель завершает эти процедуры в своём scope.
- Перед PRODUCT был задан реальный async-вопрос о EN/NL. Ответ не поступил к моменту
  создания пакета; решение о переводе помечено открытым. Факты продукта взяты из
  подробного задания и локальных документов, без имитации интервью.
- Визуальный мир — предложение дизайнера, не утверждённый владельцем comp.
  Concept list оформлен после seed (ограничение воспроизводимости рейтинга отмечено
  в DIRECTION_EXPLORATION). Изображения challengers не оценивались; оценена грамматика
  из реального tool output. Нет фиктивного выбора пользователя или telemetry.
- Статичные HTML-мокапы созданы напрямую по разрешению задания. Генерации изображений
  и копирования 21st-кода нет. Не заявляется pixel-perfect соответствие image comp.

## Что показал detector мокапов

| Правило | Количество | Реакция |
|---|---:|---|
| design-system-font | 6 | найден некорректный unquoted font-family в @font-face; исправлен. Browser после правки: обе гарнитуры Source Sans 3 loaded |
| low-contrast | 4 | hover primary применялся к disabled-кнопке; hover/active ограничены :not(:disabled) |
| cramped-padding | 1 | warning от сочетания desktop border-left и mobile border-top; desktop inset 24 px, mobile border-left снят явно, text не прилегает к границе |
| flat-type-hierarchy | 2 | Help h2 на mobile поднят до 28 px; Recipe число 24 px детектор считает body, это data role, не основной текст 18 px |
| design-system-radius | 8 | мелкие радиусы унифицированы, badge 4 px добавлен в токены, read-callout 12 px |
| design-system-color | 4 | table heading и selection добавлены в нормативную палитру; hover/active уже определены |
| design-system-font-size | 14 | промежуточные 13/17/22/25/26 px убраны, роли добавлены в YAML; данные и подписи по общей шкале |

Detector намеренно не запущен вторично (ограниченный проход навыка). Поэтому JSON
сохраняет первоначальные findings, а не изображает чистую финальную проверку.
Правки подтверждены browser measurements и просмотром второй серии снимков;
это не заявление «detector теперь даёт 0».

## 21st MCP

Реально вызывались **mcp__codex_apps__21st_search** и
**mcp__codex_apps__21st_get_component**. Search: type=component, limit=2.

Запросы: `sidebar navigation`, `metric statistics card`, `comparison table`,
`data table`, `currency money input`, `dialog form`, `empty state`,
`date range segmented tabs`, `toast notification`, `badge delta`.

get_component demo IDs: **19371, 4245, 26827, 23604, 124, 370, 18266, 34764, 24297, 514**.
Все успешны, `isError=false`, нет locked/found=false. Source и registry dependencies
прочитаны; текст кода в файлы проекта не копировался. Registry не всегда перечисляет
все source imports — поэтому таблица отдельно называет iconsax, remixicon, Radix icons.

Для каждого URL реально выполнен `sh scripts/21st.sh license <path>`.
Восемь ответов MIT/mit, два **no-license**. Точный вывод, авторы, URL, зависимости:
[21st-candidates.json](evidence/21st-candidates.json). Итог: **use 0 / adapt 2 /
inspire 2 / build own 6**. Владельческий ключ не выводился и не добавлялся в мокапы.

## Браузер

Использован реальный **bb browser-automation**, local/headless,
host `host_mqe28unaid`. Обе previewDirective опубликованы в потоке.
Первая сессия — live demo; вторая — локальные mockups через
`python3 -m http.server 8766 --bind 127.0.0.1 --directory docs/design/mockups`.

Просмотрены Dashboard и Simulator desktop/mobile, Recipe, Ingredients и Help desktop;
7 финальных JPEG сохранены в previews и каждый открыт image viewer.
Для пяти mockup pages на 375: `innerWidth=375`, `documentElement.scrollWidth=375`;
видимые input/select ≥ 48 px. Desktop 1440: scrollWidth=1440.
Финальные fonts: regular и semibold `loaded`. Проверены раскрытие/закрытие Menu,
раскрытие All figures. Измерена первая dish row Dashboard: y=743.15625 px.
Снимки mobile имеют высоту 1000/1200 для показа содержимого; viewport 812 отдельно
использован для проверки overflow. Это не полный keyboard/screen-reader audit.

В исходном demo проверен Add ingredient → пустой submit: «Enter a name.», фокус Name,
aria-invalid и связь ошибки. Реальные данные владельца не использовались.
Новая несохранённая scenario A была создана только в изолированном профиле демо.

## Ошибки инструментальных вызовов, без сокрытия

- `bb browser instances --json`: `required option '--host <id>' not specified`.
  Вывод сам сообщил host id; затем явно открыт local/headless на нём.
- Первая browser session истекла: `session_unavailable: Session stopped or expired;
  open a new session`. Открыта новая, работа продолжена в ней.
- FontFaceSet.check с некорректно quoted font shorthand: `DOMException: SyntaxError:
  Failed to execute 'check' on 'FontFaceSet': Could not resolve '18px Source Sans 3'
  as a font.` Проверка заменена чтением реальных loaded FontFace entries; CSS исправлен.
- Один curl URL не был заключён в кавычки: zsh `no matches found`; вызов повторён
  с кавычками. Запрос WOFF2 сначала вернул каталоги, затем прочитан нужный OTF-каталог.
- `rg docs/design` до создания каталога: `No such file or directory`; это не отказ MCP.
- Обязательные Impeccable launcher и 21st MCP **не были недоступны**. Exit 2 detector —
  документированные findings, не авария запуска.
- При уборке попытка прочитать процесс через `ps` была запрещена sandbox:
  `PermissionError: [Errno 1] Operation not permitted: 'ps'`. Обход разрешений не
  потребовался: собственный HTTP-сервер остановлен Ctrl+C в исходной exec-session,
  результат `Keyboard interrupt received, exiting.`, exit 0. Browser session закрыта.

## Проверки приложения и документов

Первый `npm run check` в worktree остановился: `sh: tsc: command not found`, exit 127.
Причина: в worktree отсутствует node_modules. [Исходный вывод](evidence/npm-check.txt).

Затем неизменённые tracked files этого worktree скопированы в собственный временный
каталог `/tmp/menupilot-design-check-lyi14sya`; node_modules скопирован из основного
checkout. До запуска проверено: **package-lock побайтно совпадает; все прямые
dependency/devDependency версии совпадают с package.json**. В рабочее дерево
node_modules не создавался, новые зависимости не устанавливались.

В этой изолированной копии `npm run check` завершился **exit 0**:

```text
> tsc --noEmit
ℹ tests 125
ℹ pass 125
ℹ fail 0
 Test Files  16 passed (16)
      Tests  248 passed (248)
vite v8.3.4 building client environment for production...
✓ 2064 modules transformed.
✓ built in 492ms
```

Итого **373 теста**. Node 25 выдаёт warning `--localstorage-file was provided without
a valid path`; он сохранён в [полном логе](evidence/npm-check-isolated.txt), тесты от
него не упали. Build относится к текущему приложению, не к реализации нового дизайна.
Новый production preview `/menupilot/` не проверялся: приложение не изменялось.

Проверка HTML: 6 страниц, 169 локальных ссылок, нет отсутствующих файлов/якорей,
нет повторных id, ровно один h1 на страницу. Markdown file links существуют.
Размер всей docs/design меньше 2 МБ. Контраст 11 пар токенов рассчитан стандартным
sRGB/WCAG способом: [token-contrast.json](evidence/token-contrast.json); это проверка
палитры, не всех возможных production-состояний. Финальные границы git проверены
перед коммитом: только PRODUCT.md, DESIGN.md и docs/design/**.

Финальный размер до коммита около 1.05 МБ. Временная копия для тестов убрана после
сохранения лога; локальный сервер и браузер закрыты. Для просмотра использовать
самостоятельные HTML/JPEG, либо заново запустить команду из README этого пакета.

---

# B/C alternatives — 19 October 2026

## Real Impeccable calls and playbooks

- Launcher: `/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable`.
- `context` invoked from repo root at the beginning of this follow-up. Its combined tool response was truncated together with oversized discovery metadata; raw stdout was **not preserved**. No specific directives or exit code are invented here. It was not rerun, respecting once-per-session. Existing PRODUCT.md and DESIGN context were read directly.
- Read actual SKILL.md, reference/bolder.md, new-work.md and craft-floor.md. `bolder` is a skill playbook, not a fictional shell subcommand. Its own routing sends an open direction round to the **bolder register**. No `impeccable bolder` CLI execution is claimed.
- Actual CLI:

```sh
/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/scripts/impeccable concept-seed --scope direction --mode operate --register bolder --from 82a98500 --reroll 1
```

Exit 0. Output starts `DIRECTION CONCEPT SEED (key: 82a98500; mode: operate; source: api; approved pool: c3b204a1eed6; 306/564 human-approved...)`, then `RE-ROLL ROUND 1 (BOLDER REGISTER, user-requested)`. Assigned grounded index suspended; six challengers, leader `operate-c-emission-line-rail`. [Full stdout](alternatives/concept-seed.txt), [honest treatment/deviations](alternatives/EXPLORATION.md). No telemetry choice ping: owner has not selected.
- Initial direct download of quality-bar hero: exact error `urllib.error.HTTPError: HTTP Error 403: Forbidden`. Same two hero URLs opened successfully in real bb browser, screenshot inspection completed. No catalog image copied into deliverable. This was an asset-fetch failure, not an unavailable Impeccable launcher.
- Actual `.../scripts/impeccable detect --json docs/design/alternatives` → **exit 2**, 67 findings: 12 warning /55 advisory. [Raw JSON](alternatives/detect.json). 27 color +28 font-size advisories, six font warnings compare B/C against root A; root DESIGN deliberately not rewritten. Others: two cream-palette, three side-tab, one cramped-padding. [Disposition](alternatives/REVIEW.md). No claim of clean detector output or completed production audit.
- No Impeccable-written code change in src/test/package. No rollback necessary. No subagents spawned under child-thread restrictions. Proposed designs and judgments authored here using the real skill, not a separate simulated Impeccable model.

## Real 21st MCP calls

`mcp__codex_apps__21st_search`, type component:

1. `number counter typography`, limit3 →3.
2. `segmented tabs navigation`, limit3 →3.
3. `price comparison table`, limit2 →2.
4. `badge status`, limit2 →2.
5. `navigation tabs motion`, limit2 →2.

12 results /11 unique (10473 repeated). `mcp__codex_apps__21st_get_component` called for **24967, 29887, 21513, 26923, 21218, 25395, 24930**; each returned component +quota. Actual imports inspected; empty dependency metadata not trusted. Full component code not stored or copied.

All seven license calls used the repository script; exit0:

| `sh scripts/21st.sh license <path>` | Actual License line |
|---|---|
| @motiondotdev/components/motion-number-counter | mit |
| @shadcnspace/components/number-ticker-08 | MIT |
| @shadcnspace/components/number-ticker-02 | no-license |
| @micka_design/components/tabs-base | MIT |
| @olewandowski1/components/comparison-3 | MIT-0 |
| @diceui/components/status | MIT |
| @educalvolpz/components/animated-tabs | MIT |

MIT-0 was not silently mapped to MIT; no-license and MIT-0 have inspire-only decisions under this task's allowlist. [Metadata and exact author/license outputs](alternatives/21st-research.json). [Decisions](alternatives/COMPONENT_PLAN.md): use0/adapt1/inspire2/build-own4; adapt is future eligibility, no code accepted now.

## Fonts, Motion and browser

- Barlow Condensed Bold and Archivo variable fetched from official Google Fonts repository; their OFL URLs checked via web tool. Full OFL stored with both fonts, Source Sans reused from A.
- Official Motion layout docs checked. web open of registry latest returned `Internal Error`; Python urllib to same public registry succeeded, yielding motion **14.4.0**, MIT, React/ReactDOM ^18||^19, transitive framer-motion14.4.0. [Captured metadata](alternatives/motion-version.json). No npm package installed.
- Used real `bb browser-automation open --backend local --headless --machine host_mqe28unaid --json`, session `715b784c-8d11-42d0-b255-601492d30467`; `run` navigated local HTTP pages, awaited fonts, captured JPEG, inspected dimensions and fields.
- One batched initial inspection of all four screens at1440/375, one fix batch (mobile nav, C disclosure/context, B table density), final confirmation. A later numeric accessibility check found C input border2.55:1; one targeted correction to#929A92→4.07:1, then focus/border and screenshot confirmed. Header focus inherits high-contrast text colour. No unbounded polish loop.
- [Desktop readings](alternatives/browser-desktop.txt), [375 readings](alternatives/browser-375.txt), [comparison/focus](alternatives/browser-comparison.txt). Both sizes have scrollWidth=innerWidth; all local fonts loaded; input heights48px. Comparison all images complete. Browser is Chromium only, not Safari/Firefox or a screen-reader certification.
- JPEGs are direct local-browser captures, no generative images or third-party pictures. Provenance/hashes and limitations in [REVIEW](alternatives/REVIEW.md).

## Follow-up verification

`npm run check` повторно прошёл в `/tmp/menupilot-alternatives-check-rqsujubq`: package-lock совпал побайтно, точные версии прямых зависимостей в скопированном node_modules проверены. Exit0: tsc; core125pass/0fail; UI248pass,16files; Vite8.3.4,2064modules,454ms. [Полный свежий вывод](alternatives/npm-check.txt). Node warning о --localstorage-file сохранён. Временная копия удалена, исходное приложение не менялось.

Проверка цифр сначала использовала неполный CSS font shorthand (получился body font); этот результат отброшен. Исправленный readout с explicit family/size/weight: Barlow700/88px — все10цифр43.828125px; Archivo600/52px — все30.109375px. [Вывод](alternatives/browser-digits.txt). A DOM реально прочитан: `Help with this page`.

Финальная проверка документов:11HTML,276локальных ссылок,0битых ссылок/повторных id; ровно один h1 на страницу. A HTML побайтно сверены с99e1e39 после единственной разрешённой замены пробела (3файла); root DESIGN.md совпадает с99e1e39. Новый пакет около1.77MB, лимит3MB соблюдён. git diff --check без ошибок; src/test/package не менялись. [Машинный результат](alternatives/validation.json).

Завершение: bb browser-automation close →state closed, exit0. Локальный HTTP server остановлен Ctrl+C →`Keyboard interrupt received, exiting.`, exit0. Внешняя публикация/push/merge не выполнялись.

---

# C+ — выбранное направление, 19 October 2026

## Реальные Impeccable и контекст

Использована именно4.3.1 из `/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable`. Сначала прочитан SKILL.md; реально выполнено из корня:

```sh
/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/scripts/impeccable context > docs/design/alternatives/C-plus/context.txt
```

Exit0. На этот раз **весь stdout сохранён**: [context.txt](alternatives/C-plus/context.txt). RESOLVED_CONTEXT: productPath PRODUCT.md,designPath DESIGN.md,platform web,hasVisualImplementation true; MANUAL_DETECTOR_REQUIRED. Context ещё прочитал A, потому что это было до авторизованной замены корневого DESIGN. Сигнал UPDATE_AVAILABLE4.7.0 записан, обновление не выполнялось: владелец указал4.3.1.

Прочитаны реальные reference/adapt.md,craft-floor.md,audit.md,polish.md. Adapt применён к выбранному C, а не новый случайный раунд. Новые init/concept-seed/bolder не запускались: выбор владельца уже получен. Audit/polish — playbooks с проверкой в этом потоке, не вымышленные shell verbs; subagents не запускались по ограничению дочернего потока. Сам skill код приложения не редактировал; git checkout/rollback не понадобился.

Реально выполнено `.../scripts/impeccable detect --json docs/design/alternatives/C-plus` после сборки: **exit2,7warning** (4cramped-padding,2side-tab,1border-accent-on-rounded),0advisory. [JSON](alternatives/C-plus/detect.json), [разбор и audit16/20](alternatives/C-plus/REVIEW.md). Не заявлен чистый scan.

## Реальные21st MCP

- `mcp__codex_apps__21st_search({query:"theme switcher system light dark",type:"component",limit:3})` →1612,23700,3552.
- `mcp__codex_apps__21st_search({query:"tabs segmented control reduced motion",type:"component",limit:2})` →35020,34763.
- `mcp__codex_apps__21st_get_component({id:1612|23700|35020})` — три отдельных успешных вызова, каждый вернул component+quota; source imports реально просмотрены.

Лицензии, каждая команда exit0:

```text
sh scripts/21st.sh license @haydenbleasel/components/theme-switcher
- Author: [Hayden Bleasel](https://21st.dev/@haydenbleasel)
- Library: [Kibo UI](https://21st.dev/@haydenbleasel/library/kibo-ui)
- License: mit

sh scripts/21st.sh license @felipemenezes098/components/dropdown-14
- Author: [felipemenezes098](https://21st.dev/@felipemenezes098)
- Library: @flx
- License: AGPL-3.0

sh scripts/21st.sh license @kuratlielia/components/segmented-control
- Author: [kuratlielia](https://21st.dev/@kuratlielia)
- Library: kuratlielia
- License: MIT
```

5кандидатов,3подробно изучены,3license calls. [Metadata](alternatives/C-plus/21st-research.json), [решения](alternatives/C-plus/COMPONENT_PLAN.md): use0/adapt0/inspire1/build own2. AGPL компонент — только идея, код не скопирован/не переписан. Native select/radios предпочтены новым зависимостям. Motion14.4.0 берётся из предыдущей фактической metadata-проверки, новая registry-проверка не заявляется; пакет не установлен.

## Браузер, токены, тесты

Реальный `bb browser-automation open --backend local --headless --machine host_mqe28unaid --json`, первая session `cd0aa9a6-1018-4bb6-8393-2a540e98ecd0`. `run` проверил8комбинаций, await document.fonts.ready, ширины, theme controls, keyboard, media. Пока записывались документы, сессия истекла; следующий run вернул точную ошибку `session_unavailable: Session stopped or expired; open a new session`. Открыта новая `9ea43bef-0a9d-4df4-a5e0-5555f03f67ad`; финальные8JPEG и print capture сделаны в ней, временные изображения первой сессии не выданы как сохранённые артефакты.

Первый immediate read после emulateMediaFeatures дал старое light; после ожидания двух requestAnimationFrame подтвердилось корректное systemdark. Отдельно проверены fresh absent,invalid stored value,manual override after OS change,persistence,storage-write exception with visible NL warning,ArrowRight/Left scenario selection/focus,print light with preserved preference,reduce transition0s. [Логи](alternatives/C-plus/browser-complete.txt), [асинхронный event/focus](alternatives/C-plus/cpVerifyFinal.txt). Начальная синтаксическая ошибка JS-оркестрации была до первого shell command и повторена корректно; никаких действий от неё не произошло.

Финальные размеры:1440×1280 и375×1100,scrollWidth=width,0clipped cells. Дополнительно обе темы ×1024/1280 ×Dashboard/Simulator — тоже0clipped cells. UI labels полностьюNL; языкHTML nl. Расчёт WCAG sRGB по tokens.json:24пары на тему,48pass; [light](evidence/token-contrast-cplus-light.json),[dark](evidence/token-contrast-cplus-dark.json),[таблица](alternatives/C-plus/CONTRAST.md). Это не утверждение о WCAG-сертификации ещё не реализованного приложения.

`npm run check` повторно запущен в `/tmp/menupilot-cplus-check-vo_9ds45` на копии tracked source, с node_modules основного checkout после проверки совпадения package-lock и exact direct versions. Exit0: tsc; core125pass/0fail; UI248pass/16files; Vite8.3.4,2064modules,458ms. [Полный вывод](alternatives/C-plus/npm-check.txt). Warning Node25 --localstorage-file сохранён. Временная копия удалена; dependencies/package/lockfile/src/test в worktree не менялись.

Финальная проверка документов C+:14HTML,353локальныеHTML-ссылки,125локальныхMarkdown-ссылок,0битых ссылок/повторныхid;8основныхJPEG. Изменённый пакет около1.03MB(<3MB). Исходные A/B/C HTML/CSS/JPEG побайтно неизменны относительноb37e34f, архив A DESIGN отличается только разрешением относительных ссылок по новому расположению. [validation.json](alternatives/C-plus/validation.json). git diff --check прошёл. Финальная браузерная session закрыта (state closed,exit0), HTTP server остановлен Ctrl+C (Keyboard interrupt received, exiting.,exit0). Push/merge/publish не выполнялись.


## C+ implementation, part 1 — 2026-10-19 (Codex / Astra)

Scope: runtime foundation only. Existing screens retain their layout and EN body copy for parts 2–3; only a few fixed amber colours were replaced with semantic tokens so dark-mode statuses remain legible. `data/demo.json` already has English names and was not modified. Full integration API and chosen NL vocabulary: [src/ui/i18n/README.md](../../src/ui/i18n/README.md).

### Impeccable: actual calls and findings

Read PRODUCT.md, DESIGN.md, implementation/component plans, C+ index/previews, the installed Impeccable SKILL.md and reference/craft-floor.md. Direction was already owner-approved; no new design interview or delegation was started.

Command executed from the project root before UI edits:

```sh
/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/scripts/impeccable context
```

Exit 0. Actual resolved context: `productPath: PRODUCT.md`, `designPath: DESIGN.md`, `hasVisualImplementation: true`, `platform: web`. Output required manual `detect --json <changed targets>` because no automatic design hook was active. It also reported installed v4.3.1 / available v4.7.0; no skill update performed.

Detector was executed once over changed `.tsx/.ts/.css` under src/ui and src/components plus src/index.css (tracked diff + new files). Actual exit **2**, five findings below; exit was not treated as a clean audit:

```json
[
  {
    "antipattern": "design-system-font-size",
    "name": "Font size outside DESIGN.md",
    "description": "A literal font-size is off the type ramp documented in DESIGN.md typography. Use a documented size step or update the design system if the new step is intentional.",
    "severity": "advisory",
    "category": "quality",
    "file": "/Users/gadzha/.bb/plugins/environment-git-worktree/host-data/worktrees/thr_6uihmdg9pz-1/RestaurantAI/src/components/ui/table.tsx",
    "line": 12,
    "snippet": "text-[…] class: 17px is off the DESIGN.md type ramp",
    "advisory": true,
    "ignoreValue": "17px"
  },
  {
    "antipattern": "design-system-font-size",
    "name": "Font size outside DESIGN.md",
    "description": "A literal font-size is off the type ramp documented in DESIGN.md typography. Use a documented size step or update the design system if the new step is intentional.",
    "severity": "advisory",
    "category": "quality",
    "file": "/Users/gadzha/.bb/plugins/environment-git-worktree/host-data/worktrees/thr_6uihmdg9pz-1/RestaurantAI/src/index.css",
    "line": 110,
    "snippet": "font-size: 17px is off the DESIGN.md type ramp",
    "advisory": true,
    "ignoreValue": "17px"
  },
  {
    "antipattern": "design-system-font-size",
    "name": "Font size outside DESIGN.md",
    "description": "A literal font-size is off the type ramp documented in DESIGN.md typography. Use a documented size step or update the design system if the new step is intentional.",
    "severity": "advisory",
    "category": "quality",
    "file": "/Users/gadzha/.bb/plugins/environment-git-worktree/host-data/worktrees/thr_6uihmdg9pz-1/RestaurantAI/src/index.css",
    "line": 112,
    "snippet": "font-size: 22px is off the DESIGN.md type ramp",
    "advisory": true,
    "ignoreValue": "22px"
  },
  {
    "antipattern": "design-system-font-size",
    "name": "Font size outside DESIGN.md",
    "description": "A literal font-size is off the type ramp documented in DESIGN.md typography. Use a documented size step or update the design system if the new step is intentional.",
    "severity": "advisory",
    "category": "quality",
    "file": "/Users/gadzha/.bb/plugins/environment-git-worktree/host-data/worktrees/thr_6uihmdg9pz-1/RestaurantAI/src/index.css",
    "line": 120,
    "snippet": "font-size: 31px is off the DESIGN.md type ramp",
    "advisory": true,
    "ignoreValue": "31px"
  },
  {
    "antipattern": "side-tab",
    "name": "Side-tab accent border",
    "description": "Thick colored border on one side of a card — the most recognizable tell of AI-generated UIs. Use a subtler accent or remove it entirely.",
    "severity": "warning",
    "category": "slop",
    "file": "/Users/gadzha/.bb/plugins/environment-git-worktree/host-data/worktrees/thr_6uihmdg9pz-1/RestaurantAI/src/ui/help/HelpBlocks.tsx",
    "line": 121,
    "snippet": "border-l-4"
  }
]
```

Review: 17px body-on-mobile and 17px tables, plus 31px mobile h1, are explicitly specified in DESIGN.md prose, although absent from its YAML ramp. The 22px mobile wordmark is a deliberate compact brand size between the 18px body and 31px heading; no low-contrast or clipped type was found. Table mobile size was made explicit at 16px, matching DESIGN.md. `border-l-4` is an existing Help block (only warning colour was changed); its composition belongs to part 3 and was not redesigned here. Detector is mechanical evidence, not a claim of visual certification.

### 21st.dev and motion

Actual calls (only through the approved wrapper):

```sh
sh scripts/21st.sh license @haydenbleasel/components/theme-switcher
# - Author: [Hayden Bleasel](https://21st.dev/@haydenbleasel)
# - Library: [Kibo UI](https://21st.dev/@haydenbleasel/library/kibo-ui)
# - License: mit
sh scripts/21st.sh search 'theme switcher' --limit 2 --json
# Results: 6609 / ncdai / @ncdai/components/theme-switcher-1
#          1714 / shugar / @shugar/components/theme-switcher
```

Followed C+ COMPONENT_PLAN decision: **build own** labelled native select, existing Radix dialogs and primitives. No new 21st source copied or rewritten; search results are catalogue-only, not licence-approved adoptions. Existing badge/alert source comments and third_party licences remain intact. New numeric fields are original composition over FormField/Input.

Installed `motion@14.4.0` exactly, lockfile + permitted dependency line updated. `npm ls` confirms framer-motion14.4.0, motion-dom14.4.0, motion-utils14.1.1. Read [official accessibility guidance](https://motion.dev/docs/react-accessibility). Runtime uses `motion/mini` for a single 160ms navigation underline emphasis, instantaneous colours/money, explicit reduced-motion check. Full `motion` import originally produced 517.41kB main chunk and Vite size warning; mini reduced it to 462.87kB /139.46kB gzip, without that warning. The mini API requires Element.animate; the first targeted jsdom rerun exposed its absence (33 tests failed). A capability check now preserves immediate selection without animation when unavailable; the subsequent full test run passes. No test-only animation shim was added.

### Fonts and data

Archivo existing licensed TTF converted to WOFF2 using an isolated `/tmp/menupilot-font-tools` Python environment (fontTools/Brotli, not project dependencies). Source Sans 3 regular/semibold WOFF2 copied unchanged from licensed design assets. Full OFL notices under public/fonts and THIRD_PARTY_NOTICES.md. Public production copies are necessary for Vite `/menupilot/fonts/` URLs; archival design assets were retained as required by the file scope. Browser resource list confirmed only local font requests and `document.fonts.status=loaded`.

Locale formatter logic was taken from `git show bb/luna-en-nl-thr_97zhejtw7g:src/calc/money.js`; tests adapted from that branch with negative sign policy, bounded Intl cache, no BigInt→Number, pp in both languages, n.v.t. in NL, null and 10^30 coverage. Old unlocalised APIs remain unchanged for existing screens/core. On this runtime en-NL integer grouping produced `€2.145.00` with the currency template; explicit en-GB gives the reviewed English `€2,145.00`. This deliberate correction is documented in the API notes.

New EN/NL demo parity test strips only `name` and compares all remaining structure, IDs, values, prices and dates. Store reset accepts an optional translated document, validates before processing, then persists atomically. UI only selects translated demo on initial bundled-demo load or explicit reset, never when the language alone changes. Terminology: basisrecept / Huidige situatie / Foodcostpercentage / Verkocht per maand / Voorbeeldgegevens / je-jouw. Browser language default overrides the older plan's EN-only default, per the task.

### Browser evidence

Actual session: `bb browser-automation open --backend local --headless --machine host_mqe28unaid --json`, ID `774177f6-cf44-4f89-bbc0-bf37d3002e2b`. Production `npm run preview -- --host 127.0.0.1 --port 4173`, URL `/menupilot/`.

- Eight combinations EN/NL × light/dark ×1440/375: **scrollWidth=viewport width**, fonts loaded, Shell translated, demo names follow initial locale. Dashboard body copy deliberately remains EN for part 2.
- 1024px: navigation moves to a separate row, no body overflow.
- Mobile Menu opens, Escape closes and returns focus to Menu; computed focus outline `rgb(242,199,92) solid 3px` in dark mode.
- Ingredient dialog at375: invalid empty name gives linked nearby `Enter a name`, first invalid field focused, input height48px, dialog height719px within900px viewport; Shift+Tab remains trapped; Escape closes and focus returns to Add ingredient. No valid ingredient was saved in the browser check.
- Print from dark: body `rgb(245,246,243)`, header `display:none`, saved choice remains dark; screen restored `rgb(39,42,41)`. Screenshot is CSS print emulation, not physical paper/PDF pagination certification. Existing screen-specific print composition remains for parts2–3.
- System media change: first immediate post-emulation read was light; next browser turn read `systemDark:dark,matches:true` (async media event). Manual light survives dark OS. Reduced motion during navigation reports **0 Web Animations calls**.
- One browser inspection used an unquoted multiword FontFaceSet.check name and raised SyntaxError; corrected inspection used loaded resource URLs/font status. This was tooling only, not an app error.
- No claims of native Safari/Firefox or physical touchscreen testing.

Evidence directory: `/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz`.

Screenshots: [NL desktop light](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-nl-light-desktop.jpg), [NL desktop dark](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-nl-dark-desktop.jpg), [NL375 light](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-nl-light-375.jpg), [NL375 dark](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-nl-dark-375.jpg), [EN desktop light](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-en-light-desktop.jpg), [EN desktop dark](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-en-dark-desktop.jpg), [EN375 light](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-en-light-375.jpg), [EN375 dark](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-en-dark-375.jpg), [Menu](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-menu.jpg), [Dialog/error](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-dialog.jpg), [Print](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-print.jpg). Raw run JSON files and detect JSON are alongside these artifacts.

### Tests

Initial npm run check could not start: `tsc: command not found` in the fresh worktree. `npm ci` installed the existing exact lockfile, then motion was installed explicitly. TDD red: new formatters were absent; reset ignored the translated document and accepted invalid source; NL demo absent. After implementation: all new tests pass. Tests use in-memory storage only.

Final `npm run check` exit0: typecheck + node:test + Vitest + Vite. Actual summary:

```text
ℹ tests 130
ℹ pass 130
ℹ fail 0
Test Files 19 passed (19)
Tests 259 passed (259)
✓ 2359 modules transformed.
dist/assets/index-CCOZ-ytb.js 462.87 kB │ gzip: 139.46 kB
✓ built in 254ms
```

Full output: [/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-check-final.log](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-check-final.log). Existing Node warning about `--localstorage-file` remains; tests do not use browser localStorage. `git diff --check` clean. After the check, only a CSS max-width correction1604→1540 and removal of npm's incidental root license metadata from lockfile were applied; final build/check evidence is updated below before delivery.

Delivery rerun after the final CSS/lockfile adjustments: `npm run check` **exit0**, core130/130, UI259/259 in19files, typecheck pass; Vite2359 modules, main462.87kB /139.46kB gzip, built253ms. [Full delivery output](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/cplus-check-delivery.log). Browser session closed (`state:closed`, exit0); preview server stopped with Ctrl+C (exit130). No server left running by this task. No push, merge or publication.

## Foundation review follow-up — 2026-10-19

Coordinator authorised Sonnet items 2–12; item 13 needs no change. Read the final review via `bb thread log thr_zcgt59yc95`. No new component selection or copied 21st code: no additional 21st license lookup needed. BadgeDelta's MIT source header now describes its actual semantic text colours, removed solid fills and metric-dependent tone.

Before UI edits ran:

```sh
/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/scripts/impeccable context
```

Result: exit 0, PRODUCT.md / DESIGN.md resolved, `MANUAL_DETECTOR_REQUIRED`. Same approved C+ context and craft-floor as the foundation implementation.

After UI edits ran once:

```sh
/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/scripts/impeccable detect --json src/components/numeric-field.tsx src/ui/layout/Shell.tsx src/ui/i18n/LocaleSelect.tsx src/components/ui/badge-delta.tsx src/index.css
```

Result: exit 0, three `design-system-font-size` findings, all `severity: advisory`:

```text
src/index.css:111  font-size: 17px is off the DESIGN.md type ramp
src/index.css:113  font-size: 22px is off the DESIGN.md type ramp
src/index.css:121  font-size: 31px is off the DESIGN.md type ramp
```

[Exact detector JSON](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/review-impeccable-detect.json). These are the previously reviewed sizes: 17px and 31px occur in DESIGN.md prose; 22px is the compact mobile brand size. This follow-up does not change those sizes. No other detector findings. The browser screenshot confirms readable, unclipped mobile navigation.

TDD evidence: MoneyField tests first failed 5/6 (missing automatic VAT labels), then passed in both languages and VAT modes. Shell tests first failed 4/8 (Escape outside nav, EN label, StrictMode initial focus), then passed; motion is stopped on subsequent navigation/unmount. Locale tests first failed for missing normalization API and invalid date RangeError; all pass after fixing. Rich message tests first failed 3/3 before the API existed; now test typed required parameters/components, translation order, and literal user markup.

`test/ui/bootstrap.test.ts` executes the real inline index.html script in jsdom with injected memory storage/matchMedia; 160 preference/browser/system combinations match runtime parsers, plus blocked storage. Inline constants deliberately remain synchronous copies (no asynchronous module fetch before first paint); parity tests assert the actual read keys. Plural tests check both pair directions, parameters and rich tag parity. A warning-only legacy formatter scan is in `test/ui/legacy-formatters.test.ts`; screen migration remains assigned to parts 2–3. [Supplementary rg inventory](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/review-legacy-formatters.txt).

Real browser: `bb browser-automation open --backend local --headless --machine host_mqe28unaid --json`; production `npm run preview -- --host 127.0.0.1 --port 4173`, `/menupilot/`.

- EN desktop light, NL mobile dark (375×900): both locale buttons measure exactly 48×48; no horizontal overflow at 375. Escape from the language control closes Menu and focuses its trigger.
- Both font preloads resolve under `/menupilot/fonts/`; performance entries confirm each was fetched once.
- Print emulation from dark mode: background token `#f5f6f3`, header `display:none`, Dashboard date input and period button `display:block`, no global `@page` rules. Reset confirmation and its Radix overlay both become `display:none` during print; no reset was confirmed.
- [NL mobile dark](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/review-nl-dark-375.jpg), [EN desktop light](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/review-en-light-desktop.jpg), [Print](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/review-print-desktop.jpg). Screenshots inspected visually. Existing Dashboard English copy is intentionally awaiting part 2.

Full `npm run check` (typecheck, core, UI, build), exit 0:

```text
ℹ tests 137
ℹ pass 137
ℹ fail 0
Test Files 23 passed (23)
Tests 279 passed (279)
✓ 2360 modules transformed.
✓ built in 489ms
```

[Check log](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/review-final-check.log). Existing Node `--localstorage-file` warning remains. No dependencies changed. No push/merge.

Delivery check after strengthening the plural-parameter parity assertion: `npm run check` exit 0, core137/137, UI279/279 (23 files), typecheck passed, Vite2360 modules /545ms. [Delivery log](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/review-delivery-check.log). Browser session closed (`state:closed`); preview stopped with Ctrl+C (exit130). No server left running by this follow-up.

## Critical Shell resize fix — 2026-10-19

Reproduced in a regression test with Motion's cleanup mocked to throw the browser's `InvalidStateError: Failed to execute 'commitStyles': Target element is not rendered` for a hidden/detached target. The old Shell entered ErrorBoundary after hiding its nav and navigating. [Failing test output](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/shell-resize-red.log). Inspected installed `motion-dom/dist/es/animation/NativeAnimation.mjs`: `stop()` calls `commitStyles()`; its connected-element check does not exclude `display:none` ancestors.

Removed the JS nav animation, target ref and cleanup; selection now uses a CSS 160ms underline-offset transition, disabled by the existing reduced-motion rule. `rg` over src confirms no remaining runtime motion/animate/commitStyles/stop calls. The approved pinned dependency is retained for subsequent screen work. README updated. Regression test covers hidden nav, Dashboard→Simulator, resize back, language/theme switch, StrictMode initial focus and unmount.

Ran Impeccable context before editing and one detector pass afterward:

```sh
/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/scripts/impeccable context
/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/scripts/impeccable detect --json src/ui/layout/Shell.tsx src/index.css
```

Both exit0. Detector returns only the same three existing advisory type-ramp findings (17px at line111, 22px at113, 31px at121); no new findings. These sizes are unchanged and their interpretation is documented above. [Exact output](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/shell-resize-detect.json). No new components or 21st code used.

`npm run check` exit0: **137 core /137 pass, 279 UI /279 pass (23 files), typecheck passed, build2079 modules /274ms**. [Full output](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/shell-resize-check.log).

Production browser verification using bb browser-automation, local headless host_mqe28unaid, `/menupilot/`:

- 1440→375, EN, light, `#/`→`#/simulator`: `errors:[]`, heading Simulator, lang en, theme light, nav display none.
- 375→1440, dark, NL, `#/`→`#/simulator`: `errors:[]`, heading Simulator, lang nl, theme dark, nav display block, active Simulator.
- Reduced-motion emulation: `matches:true`, computed transition duration `0s` (normal `0.16s`).
- [375 EN light](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/shell-resize-375-en-light.jpg), [desktop NL dark](/Users/gadzha/.bb/thread-storage/thr_6uihmdg9pz/shell-resize-desktop-nl-dark.jpg); both visually inspected. Mobile screenshot is scrolled to main by the existing navigation focus behaviour.

Browser session closed; preview stopped (Ctrl+C, exit130). `git diff --check` clean; no push/merge.

## Part 2

### Scope and integration

C+ Dashboard (`#/`), dish picker (`#/simulator`), and selected-scenario workbench (`#/simulator/:id`). Read AGENTS.md, DESIGN.md, planning/architecture and design implementation plans, C+ dashboard/simulator HTML and JPG references, i18n README, the real Impeccable skill and craft-floor. Kept calc/store unchanged; domain adapters expose existing BigInt results and structured translation notes. Own dictionaries are part2.en.ts/part2.nl.ts with two-line import/spread additions to the foundation dictionaries.

Merged foundation through `a8f49e6`: packPrice/prepCost, required MoneyField vat, EN/NL controls, and the Shell animation fix. Git printed a packed-refs.lock permission warning during fast-forward; HEAD was verified as a8f49e6. No foundation implementation edits. Coordinator explicitly authorized only Dashboard heading expectations in help/router/shell tests and the changed price-field accessible label in help.test.tsx (two occurrences in the same test); behavior assertions are preserved.

### Actual Impeccable calls and bounded review

Before implementation, ran from the repository root:

```sh
/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/scripts/impeccable context --target src/ui/pages/DashboardPage.tsx
```

Exit 0; PRODUCT.md / DESIGN.md resolved and manual detector required. Applied reference/audit.md and reference/polish.md as review playbooks; these are not invented CLI commands. After implementation, ran the detector on the two pages and component directories, then once more after the bounded polish pass:

```sh
/Users/gadzha/.codex/plugins/cache/openai-curated-remote/impeccable/4.3.1/skills/impeccable/scripts/impeccable detect --json src/ui/pages/DashboardPage.tsx src/ui/pages/SimulatorPage.tsx src/ui/dashboard src/ui/simulator
```

Exit 0. Initial: 12 advisory font-size findings. Final: 10, all `design-system-font-size`, no other finding kinds. [Final detector JSON](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-detect-final.json). Removed the two 26px headings in favor of text-xl. Retained C+ headline/figure sizes 31/42/46/60px (specified in the design prose/mockups but not the detector's type-ramp list), 13px mobile table hints, and 11px print table text. These are documented intentional exceptions, not a claim of zero detector findings.

Audit (0–4 per dimension, scoped technical review, 16/20; no formal WCAG certification):
- Accessibility 3: semantic headings/tables, radio scenario selection, labelled fields, error association and first-error focus; Tab/Escape in deletion dialog and focus return verified. Delta direction has text/sign/icon as well as color. Native screen-reader and full contrast-ratio audit were not run.
- Performance 3: no new dependencies/assets, memoized calculations, at most three mounted editors to preserve drafts; no screen-specific animation. Production main bundle 489.79 kB / gzip 145.79 kB. No profiler claim.
- Theming 4: semantic theme tokens, both themes and languages inspected, currency signs/separators follow locale; print switches from dark to light.
- Responsive 3: desktop table, mobile cards and baseline/selected comparison columns; 375/1024/1440 have no document overflow on exercised data. Radio labels/controls and inputs have 48px targets. Extreme-length arbitrary user data was not exhaustively browser-tested.
- Implementation integrity 3: C+ hierarchy, no invented financial calculations or translated user data; typed translation keys for validation/rebase; detector exceptions above. Existing EN HelpLink is outside scope and still Russian in this branch, assigned to Part 3.

Polish findings and resolution: moved primary menu/volume inputs ahead of derived results; collapsed shared estimate so the scenario controls align with comparison; made mobile radio selector use the whole row; replaced ad-hoc price/quantity inputs with shared fields and explicit VAT; removed dead legacy formatters/disclaimer text and global print page orientation. Preserved simultaneous scenario calculations, independent invalid drafts, save/delete/rebase semantics and unknown-vs-zero behavior.

### Actual 21st calls

```sh
sh scripts/21st.sh search 'comparison table' --limit 3 --json
sh scripts/21st.sh search 'segmented control' --limit 2 --json
sh scripts/21st.sh license @mohammadshehadeh/components/comparison-02
sh scripts/21st.sh license @halaska-studio/components/segmented-control
```

Comparison result 26827: Mohammad Shehadeh, Hirael, MIT. Segmented result 34763: halaska-studio, @delego, MIT. License responses rechecked and stored: [comparison](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-21st-comparison-license.txt), [segmented](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-21st-segmented-license.txt). No component source was fetched/copied/adapted: implemented C+ with existing shadcn primitives and native radio/table elements. No third-party notice or dependency added.

### Verification and browser evidence

`VITEST_MAX_WORKERS=2 npm run check` passed (the worker limit avoids contention with parallel threads without changing checks). [Final full log](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-check-final.log):

```text
tsc --noEmit: exit 0
ℹ tests 137
ℹ pass 137
ℹ fail 0
Test Files 25 passed (25)
Tests 283 passed (283)
✓ 2086 modules transformed.
✓ built in 557ms
```

New tests cover largest positive comparable cost increase/ties/unknown/no-volume, NL dashboard, independent scenario drafts including invalid input across locale/theme switches, and unknown costs with a zero estimate. Existing calculator/store and scenario behaviors still pass. Initial integration failures from the renamed EN/NL controls and MoneyField label were corrected; under unrestricted parallel load an earlier run hit existing help-loading timeouts, hence bounded workers. Node still reports its pre-existing invalid --localstorage-file warning.

Real browser: `bb browser-automation open --backend local --headless --machine host_mqe28unaid --json`; production preview `npm run preview -- --host 127.0.0.1 --port 4175`, served under `/menupilot/`. Main session 9b3798ca-c371-465f-89bc-e5c6857f0647. Initial resize/navigation exposed a foundation P1: Motion stop() called commitStyles on a hidden nav link. Reported to coordinator; temporary reduced-motion matrix was followed by a full final matrix after merging a8f49e6 with `prefers-reduced-motion: no-preference` (confirmed false). Final 24 route/state captures: EN/NL × light/dark × 1440/375 × dashboard/picker/workbench. No render crash or horizontal overflow; fonts loaded. [Matrix output](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-matrix-final.log). Files follow `part2-{dashboard|picker|simulator}-{en|nl}-{light|dark}-{1440|375}.jpg` in thread storage. Representative final screenshots were visually inspected in both themes/languages and sizes.

- [Dashboard EN light desktop](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-dashboard-en-light-1440.jpg), [NL dark mobile](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-dashboard-nl-dark-375.jpg).
- [Simulator NL dark desktop](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-simulator-nl-dark-1440.jpg), [EN light mobile](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-simulator-en-light-375.jpg).
- [Dish picker NL light mobile](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-picker-nl-light-375.jpg), [1024px](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-tablet-1024.jpg), [print from dark](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-print.jpg).

Browser interaction checks: create three scenarios, change and save independent price/volume values, select A/B/C, retain drafts across theme/language; invalid menu price focuses its input on save ([capture](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-invalid-field.jpg)); saved deletion opens with Cancel focus, Tab reaches delete, Escape closes and returns focus to Delete. Changing Beef mince price through the ingredient UI produces [Baseline changed](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-stale.jpg), hides stale deltas, excludes stale scenarios from ranking; Update baseline preserves applicable overrides and requires Save. No estimate shows [Not enough data](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-no-estimate.jpg); entering zero is valid ([zero volume NL](/Users/gadzha/.bb/thread-storage/thr_n4jax9mwdj/part2-zero-volume.jpg)). These mutations affect only the isolated headless demo profile. Unknown ingredient cost is additionally covered in the UI regression suite, not claimed as a separate manual browser fixture.

Print emulation verified all Baseline/A/B/C columns visible, editor hidden, light background rgb(245,246,243), and full table. No native Safari/Firefox, physical touch device, screen reader, or PDF pagination checks claimed. EN HelpLink integration remains assigned to Part 3.

Session closed with state:closed; preview stopped with Ctrl+C (exit 130). No preview server remains running from Part 2. Final git diff --check passed. No push or integration merge performed by this thread.

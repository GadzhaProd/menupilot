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

# Финальный review B/C

Это завершённый пакет **альтернатив для выбора**, не реализованный редизайн и не сертификация доступности приложения. Рекомендация B, решение владельца ещё не получено. A и его исходные JPEG сохранены, root DESIGN.md не переписан; исправление A — только неразрывный пробел в Help with this page на трёх HTML-экранах.

## Фактическая проверка

- Chromium через bb browser-automation: B/C × Dashboard/Simulator ×1440×1100/375×1100. Снимки просмотрены. На всех четырёх страницах обе ширины совпадают со scrollWidth; local fonts loaded; inputs48px. [desktop](browser-desktop.txt), [375](browser-375.txt).
- Comparison page:1440/375 без overflow, все img complete. [Результат и focus](browser-comparison.txt). Нажатие ссылки открывает самостоятельный HTML/JPEG; никто не обязан запускать приложение ради выбора.
- Табличные цифры реально проверены по ширине глифов0–9: Barlow700/88px — все43.828125px; Archivo600/52px — все30.109375px. [Вывод](browser-digits.txt). Первая проба через CSS font shorthand измерила наследуемый body font и не использована как доказательство; повтор с explicit family/size/weight исправил метод.
- A DOM после пробела: `Help with this page`. Старые JPEG намеренно не переписаны и могут показывать старый слитный текст.
- [Контраст10 пар](contrast.json): body пары≥6.8:1, focus≥7.34:1, C field boundary4.07:1. Исходная C граница2.55:1 найдена расчётом и исправлена. Header focus использует цвет текста. Это проверка токенов и выбранного поля, не всех production-состояний.
- `npm run check` заново выполнен в собственной временной копии tracked source; node_modules из основного checkout после проверки byte-identical package-lock и точного совпадения прямых dependency versions. Exit0: tsc, core125/125, UI248/248 (16 files), Vite8.3.4,2064modules,454ms. [Полный лог](npm-check.txt). Node предупреждает `--localstorage-file was provided without a valid path`, failures0. Временная копия удалена после сохранения лога, зависимости в worktree не создавались.

## Реальный Impeccable detect, не «всё зелёное»

`detect --json docs/design/alternatives` вернул exit2, **67 findings:12 warning/55 advisory**. [Вывод](detect.json).

- 27 color +28 font-size advisories и6 font warnings: B/C намеренно отличаются от корневого DESIGN.md A. Токены новых вариантов описаны рядом с ними; root менять до выбора запрещено. Не скрывали findings через ignore-конфиг.
- 2 cream-palette: B светлая подложка #FAFAF3, но основной выразительный регион — насыщенный жёлтый с condensed sans. Это осознанный риск близости к светлой бумажной палитре, не «исправлено автоматически».
- 3 side-tab: separator/геометрическая стрелка B и двойное подчёркивание C. Не декоративная толстая левая полоса на карточке; оставлены как функциональные разделители и selection marker.
- 1 cramped-padding market-total: screenshot показывает40px inset справа desktop и24px снизу mobile; справа в mobile border отсутствует. Визуальный дефект не подтверждён.

Detector запускался до финального изменения C input boundary и header focus. Повторный чистый результат не заявляется. Audit/polish production остаются в плане реализации. Открытые состояния error/loading/stale описаны, но не нарисованы отдельными экранами; это не скрытое утверждение о тестировании их runtime.

## Что пока ограничено

Мокапы статические: поля readonly, период disabled, сценарий B фиксирован, ссылки сценариев ведут к области сравнения. Раскрытия details и переходы между HTML работают. Реальные save/delete/baseline-update/overrides не реализованы и не удаляются из будущего приложения. Матрица показывает основные показатели; production comparison сохраняет полный текущий набор и tie/exclusion rules.

B действительно использует NL длинные слова, decimal comma и исходные английские финансовые термины. Это предварительный перевод, не заменяет языковое ревью. C требует проверки в солнечном помещении/на бликующем устройстве и отдельного light design, если будет выбран. Safari, Firefox, screen reader,200% zoom, полные диалоговые клавиатурные сценарии в этих статических эскизах не проверены.

## Растры, размер и воспроизведение

Все новые JPEG — прямые screenshots собственных HTML в локальном Chromium19Oct2026. Никаких заимствованных фотографий/каталожных картинок в пакете. comparison.jpg — обзор страницы сравнения, которая встраивает исходные A и новые B/C снимки. [SHA256](ASSET_HASHES.txt); fonts имеют отдельные [источники и полные OFL](fonts/PROVENANCE.md). Новый пакет меньше3MB, точный финальный размер в TOOL_RUNS.md.

Открыть [index.html](index.html) непосредственно или из корня репозитория:

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory docs/design
```

Затем `http://127.0.0.1:8766/alternatives/index.html`. Ссылка на JPEG открывает полный снимок, HTML можно сузить до375px. Сервер не публикует сайт и не пишет данные приложения.

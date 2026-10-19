# C+ — финальная проверка макета

Статус: готовый **дизайн-пакет перед реализацией**. Это не работающая новая версия MenuPilot: деньги демонстрационные, поля readonly. Действуют theme/system/storage, scenario radio selection, mobile Menu и details. A-мокапы и их изображения не менялись; root A DESIGN сохранён отдельно, в архивной копии адаптированы только относительные ссылки.

## Проверено в реальном браузере

- Chromium через bb-browser: Dashboard/Simulator ×light/dark ×1440/375; просмотрены финальные JPEG. Desktop1440×1280, mobile375×1100. Все fonts loaded в первом проходе; финальные страницы без body overflow и без переполненных ячеек. [light](browser-light.txt), [dark](browser-dark.txt).
- В обеих темах ещё 1024/1280: обе таблицы, `scrollWidth=innerWidth`, `clippedCells:0`. Editor238px и table718px при 1024; editor280px и table908px при 1280. Длинные NL подписи переносятся, числа не обрезаются. [Полная матрица](browser-complete.txt).
- Theme: fresh absent→system/dark; System light→dark после media change; ручной light сохраняется при OSdark; выбор переживает navigation; invalid stored value→system; Storage.setItem throwing→in-memory choice+видимое NL уведомление. Изолированный key `menupilot.design.cplus.theme.v1`; document/store не читаются и не пишутся.
- Первое немедленное чтение после emulateMediaFeatures показало старую тему. После двух animation frames change event обработан: light→light,dark→dark. Это исправление метода проверки асинхронного события, не подмена результата. [Первый вывод](cpInteraction.txt), [проверка после event](cpVerifyFinal.txt).
- Native scenario radios: ArrowRight B→C, focus остаётся наC, видимая 3px янтарная обводка; ArrowLeft возвращаетB. Выбранные summary/editor/column меняются вместе. C показывает−€715,00, B+€300,00. Readonly fields с labels и heights≥48px.
- print media при screen dark: whitebody, darktext, lightaccent#795400; nav/editor hidden, все 5 колонок matrix видимы; preference не перезаписан. [Снимок print media](print-evidence.jpg). Это эмуляция CSS media, не проверка пагинации реального PDF/принтера.
- Reduced motion: duration selected control=`0s`; monetary values и theme colors всегда мгновенны. Визуальные эффекты не блокируют focus/readout.
- Все видимые/доступные подписи этих 2 макетов NL; собственное имяMenuPilot не переводится. EN/NL mapping и t()-план в I18N.md, runtime DOM translation отсутствует.

## Контраст

[Таблица](CONTRAST.md):48 пар,48pass. Основной текст/числа min light12.04/dark8.71; secondary5.83/6.70; accent5.74/6.16; positive6.13/6.78; negative6.08/6.68; focus5.76/7.10. Отдельно checked controls and selected backgrounds, button foreground, border≥3. All token values взяты из фактического tokens.json и совпадают с CSS themes. При print применяются light tokens.

## Impeccable audit / polish макетов

Playbooks прочитаны и применены здесь, без дочернего делегирования (ограничение потока). Не выдумывались CLI `audit`/`polish`. Integrity verdict: **coherent, pass for prototype scope**, не certification production.

| Измерение | Балл | Основание / граница |
|---|---:|---|
| A11y |3/4|48contrast checks, native controls, keyboard/focus; screen reader/реальный touch не проверены |
| Performance |3/4|нет dependencies/external runtime assets, локальные переиспользуемые fonts; LCP и мобильный CPU не измерялись |
| Responsive |3/4|375/1024/1280/1440, no clipped cells;200%browserzoom и реальные устройства ещё нужны |
| Theming |4/4|system/manual/persistence/error/reduced-motion/print проверены |
| Integrity |3/4|полный выбранный визуальный мир, единый язык; error/loading/unknown production states пока specification |
| **Всего** |**16/20**|Good, готово для утверждения макета, не выпуска приложения |

Найденных P0/P1 дефектов в проверенном prototype scope нет. P2 verification gaps перед выпуском: (1) Safari/Firefox и реальный touch, (2)screen reader/200%zoom, (3)полные error/loading/stale/empty states, (4)реальная печатная пагинация. Это непроверенные области, не заявленные работающими возможности. NL языковое ревью до выпуска также полезно.

`impeccable detect --json docs/design/alternatives/C-plus` →**exit2,7warning**,0advisory. [Полный вывод](detect.json):

- 4cramped-padding: details outer wrapper имеет 0inset возлеborder, но summary min-height48px и vertically-centred text дают фактический внутренний отступ. Скриншоты не подтвердили прижатый текст.
- 2side-tab: border-right2px принадлежит геометрической стрелке before→now и раскрывающему шевронуMenu. Это не окрашенная боковая полоса карточки.
- 1border-accent-on-rounded: автоматическое совпадение selected controls/radius. Акцент намеренно обозначает выбранный radio/navigation; никаких decorative KPI-card edges. В rootDESIGN это описано.

Detector не выдавался за чистый. Polish batch: понятный chevron уMenu и печатная таблица без лишнего блока readonly-форм. Финальный просмотр после этих правок выполнен; бесконечного цикла не было. Production audit/polish остаются обязательными в плане.

## Проверки приложения

`npm run check` — exit0 в собственной временной копии tracked source. Перед копированием dependencies проверены byte-identical package-lock и exact direct versions из основного checkout. tsc успешен; core125/125; UI248/248,16files; Vite8.3.4,2064modules,458ms. [Полный лог](npm-check.txt). Node25 warning о --localstorage-file присутствует, failures0. Никакой npm install и node_modules в worktree, временная копия удалена. Build проверяет существующий код приложения, не реализацию этих макетов.

## Provenance и воспроизведение

Все 8 основных JPEG и print-evidence — прямые screenshots наших HTML в Chromium,19Oct2026. Из 21st source и сторонние raster images не копировались. Файлы Archivo/SourceSans переиспользованы из прошлого пакета с существующими OFL; новых font binaries нет. [SHA256](ASSET_HASHES.txt).

Открыть [галерею](index.html) либо `python3 -m http.server 8766 --bind 127.0.0.1 --directory docs/design` и URL `/alternatives/C-plus/index.html`. Выбрать тему; перейти на Simulator, выбрать A/B/C стрелками, проверить Print Preview. Поля readonly намеренно; новые calculations, saves и язык переключения не симулируются.

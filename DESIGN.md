---
name: MenuPilot C+ — Кухонная линия
description: Выбрано владельцем; две темы и ровные сравнения
colors:
  light-bg: "#F5F6F3"
  light-surface: "#FFFFFF"
  light-panel: "#E9EDE7"
  light-text: "#252C27"
  light-muted: "#515D54"
  light-line: "#BEC6BC"
  light-border: "#6E7D70"
  light-accent: "#795400"
  light-accentSoft: "#F4EBD4"
  light-positive: "#17633F"
  light-negative: "#9A352A"
  light-focus: "#795400"
  light-button: "#283D30"
  light-onButton: "#FFFFFF"
  dark-bg: "#272A29"
  dark-surface: "#2D322F"
  dark-panel: "#343C36"
  dark-text: "#F2F1E8"
  dark-muted: "#C1C9BE"
  dark-line: "#657166"
  dark-border: "#929E92"
  dark-accent: "#F2C75C"
  dark-accentSoft: "#49432F"
  dark-positive: "#8AD8AE"
  dark-negative: "#FFB4A6"
  dark-focus: "#F2C75C"
  dark-button: "#E6EDDF"
  dark-onButton: "#233025"
typography:
  heading:
    fontFamily: "Archivo, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.15
  body:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.35
  money:
    fontFamily: "Archivo, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  control: "4px"
  editor: "8px"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
  desktop-inset: "32px"
---

# C+ — «Кухонная линия»

Выбрано владельцем 19 октября 2026. Это финальный макет перед реализацией, не выполненный редизайн приложения. A сохранён без изменений в [архиве](docs/design/alternatives/A-difference/DESIGN.md); исходные A/B/C-мокапы не переписаны.

## Идея

Рабочая поверхность с верхним меню и ровными колонками. Вверху Dashboard — общий маandeffect и блюдо с самым большим абсолютным удорожанием одной порции; рядом видно «было → стало». В Simulator крупная дельта выбранного сценария и поля рядом с общей таблицей. Выразительность — в форме и размере цифр, а не в ярких плашках.

Пользователи любого возраста, включая людей без технического опыта. Простота — требование к устройству интерфейса, не возрастная эстетика. Dashboard/Simulator/редакторы — **Operate**; Help — **Read**.

## Светлая и тёмная темы

Единые semantic roles, два явно заданных набора значений; никакого CSS invert, смешения тёмных строк со светлыми полями или автоматического lightening. Светлая использует белые рабочие поверхности на светлом нейтральном фоне, зелёно-графитный текст и тёмный охристый акцент; тёмная — графит, мягкий светлый текст и янтарный акцент. Не переносить жёлтые области B.

| Токен | Light | Dark | Назначение |
|---|---|---|---|
| bg | #F5F6F3 | #272A29 | фон приложения |
| surface | #FFFFFF | #2D322F | рабочая поверхность |
| panel | #E9EDE7 | #343C36 | выбранная строка/колонка |
| text | #252C27 | #F2F1E8 | текст и числа |
| muted | #515D54 | #C1C9BE | пояснения |
| line | #BEC6BC | #657166 | неинтерактивные разделители |
| border | #6E7D70 | #929E92 | граница control |
| accent | #795400 | #F2C75C | выбор, ссылки-акценты |
| accentSoft | #F4EBD4 | #49432F | фон выбранной маленькой кнопки |
| positive | #17633F | #8AD8AE | рост contribution / снижение cost |
| negative | #9A352A | #FFB4A6 | снижение contribution / рост cost |
| focus | #795400 | #F2C75C | видимый фокус 3px + offset |
| button | #283D30 | #E6EDDF | основное действие |
| onButton | #FFFFFF | #233025 | текст основного действия |

Default preference **system**: effective theme = matchMedia(prefers-color-scheme). Header select: System/Light/Dark (NL Systeem/Licht/Donker), accessible label. Production key `menupilot.ui.theme.v1`, values `system|light|dark`; absent/invalid = system. Только этот ключ; не включать UI preference в документ меню, JSON backup или baseline. Проверять storage errors, сохранять рабочий выбор в памяти, не очищать данные. При system реагировать на change; ручной выбор не перезаписывать при смене OS; storage event синхронизирует вкладки. До первого paint применить validated preference; в CSP учесть маленький bootstrap. Mock использует отдельный `menupilot.design.cplus.theme.v1`, не ключ приложения.

Печать всегда light через `@media print`, даже если screen preference dark. Не менять сохранённый выбор; после печати восстановление происходит CSS автоматически. Убрать меню/controls/редактор, напечатать заголовок, дату сравнения/базы, выбранный итог и все колонки матрицы/все блюда. Повторять thead, не резать строки; A4 landscape для широкой таблицы. Не зависеть от включения фоновой печати: знак, подпись и double rule остаются понятны.

Контраст проверен по WCAG2 sRGB: [light JSON](docs/design/evidence/token-contrast-cplus-light.json), [dark JSON](docs/design/evidence/token-contrast-cplus-dark.json), 24 пары на тему. Text/muted/accent/positive/negative ≥4.5:1 на bg/surface/panel, accent на accentSoft ≥4.5, onButton ≥4.5; focus и control border ≥3.0. `line` — только декоративный разделитель, не единственный признак границы control. Полная таблица минимумов — [CONTRAST](docs/design/alternatives/C-plus/CONTRAST.md). Это palette verification плюс браузерные spot checks, не сертификат всего будущего приложения.

## Шрифты и числа

Archivo600 — заголовки и главные суммы; Source Sans3 regular/semibold — строки и подписи. Уже имеющиеся self-hosted OFL assets: [Archivo](docs/design/alternatives/fonts/PROVENANCE.md), [Source Sans3](docs/design/mockups/fonts/PROVENANCE.md); не дублировать бинарники. Body18px desktop/17px mobile, подписи 15px, таблица 17/16px; для плотной mobile comparison captions13px, labels15px при сохранении контраста. Heading36/31px, общий итог 60/46px, новая стоимость 48/42px; максимум<6rem.

Все money roles: `font-variant-numeric:tabular-nums lining-nums`, выравнивание вправо, без разбивки числа на декоративные разряды. Значения выводят существующие exact formatters: BigInt не превращать в Number, числа не парсить через parseFloat. Locale en-NL/nl-NL меняет только представление. Отрицательная contribution — `−` + negative; положительная — `+` +positive; увеличение cost — negative, даже со знаком `+`. Zero нейтрален, unknown — текст, не 0.

## Композиция и компоненты

Desktop main≤1540px, поля 32px;1024px поля 24px,375px поля 20px. Навигация сверху, на 1024 переносится отдельной строкой, на 375 — подписанный Menu disclosure. Targets48px, явный focus; иконки только существующий lucide20px с подписью, без декоративных плиток.

Dashboard: общая сводка и один выделенный пример на общей линии. **Largest increase = max positive costDeltaCents per portion excluding VAT**, только known comparable values; не процент и не общий monthly impact. При tie первый в существующем порядке документа; показать текст «одинаковое максимальное удорожание» при нескольких, не выдавать единственного победителя. Если положительных сравнимых дельт нет — нейтральное объяснение, не подставлять 0. Missing volume не исключает блюдо из cost-rank; его monthly impact остаётся—. Не сортировать основную таблицу автоматически. Увеличение одной порции не является рекомендацией менять рецепт.

Таблица из A: 19sep /now/change/contribution/monthly. Menu price incl/excl и food-cost points сохранены вторыми строками, не удалены. На 375 блюда становятся связанными строками с All figures. Prep показывает только стоимость на выходную единицу и не получает contribution.

Simulator: desktop editor280px (238px при 1024) +table; выбранный сценарий содержит и draft и итог. Не пересоздавать draft при смене A/B/C или breakpoint. Таблица сохраняет все 8 существующих метрик, deltas и highest/tie/exclusion; дополнительная итоговая строка monthly delta. На 375 показывать Baseline и active side-by-side, остальные доступны тем же radio/tab control; все колонки печатаются. Compact chosen summary остаётся рядом с mobile edit workflow: при реализации можно повторить derived summary у полей, не заводя второй draft или расчёт.

Inputs48px, явные labels incl/excl VAT или локальные эквиваленты. Сохранять supplier hint. Диалоги остаются Radix с focus trap/return, Escape, scroll body, nearby errors; успех inline status, критические ошибки постоянный alert. Бейджи без пульсации. Решения [21st C+](docs/design/alternatives/C-plus/COMPONENT_PLAN.md): новые theme/control строить самостоятельно на разрешённых primitives; чужой код пока не принят.

## Язык без смешения

Вся строка UI, aria-label, ошибки, empty/status и подписи форм проходят typed `t(key, params)` из EN/NL dictionaries. Не подменять textContent/innerHTML после render, не искать английские слова в DOM; данные блюд и supplier names — пользовательские данные, не ключи. HTML-мокап полностью NL; UI terms переведены последовательно и сопоставлены в [I18N](docs/design/alternatives/C-plus/I18N.md). В EN сохранять точные обязательные термины. В NL contribution переводится как «bijdrage», никогда «winst». Help сохраняет RU и получает полную NL-версию со стабильными anchor IDs.

## Движение

Точный опциональный кандидат `motion@14.4.0`, не установлен в дизайн-задаче. Тема переключается **сразу**: плавная инверсия всех цветов может дать нечитаемые промежуточные пары; допускается 160ms движения индикатора самого theme control. Выбор сценария —160–180ms перемещения selected marker, данные появляются сразу. После валидного пересчёта — одно 180ms подчёркивание результата, без rolling counter, промежуточных денежных сумм, bounce и задержки ввода. При reduced motion всё мгновенно, остаются текст и selected state; live region сообщает итог после валидного изменения с коротким debounce, не каждую цифру ввода. В mock темы и денежные результаты мгновенны; лишь background/border radio transition160ms при no-preference.

## Состояния и ограничения

Unknown cost, отсутствующий объём, нулевой объём, stale baseline, invalid input, loading и empty имеют собственный текст. При failed save сохранить draft и displayed document. Stale исключается из сравнений; обозначать причину, не показывать устаревшую delta как актуальную. Нет новых валют, графиков, AI, POS, forecast или рекомендаций по безопасности еды.

Анти-референсы: жёлтые большие плашки B; новая sidebar; одинаковые KPI-карточки; paper texture/рваные чеки; неон; icon-only controls; цвет без знака; анимированные деньги. Ключевые макеты [C+](docs/design/alternatives/C-plus/index.html). Реализация следует [плану](docs/design/IMPLEMENTATION_PLAN.md), а не копирует read-only mock handlers в store.

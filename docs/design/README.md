# MenuPilot — дизайн-пакет

Начать с [галереи HTML](mockups/index.html) или
[Dashboard desktop](previews/dashboard-desktop.jpg) /
[Dashboard 375](previews/dashboard-375.jpg) /
[Simulator desktop](previews/simulator-desktop.jpg) /
[Simulator 375](previews/simulator-375.jpg).

Для владельца: «Сначала разница» делает изменения цен заметными и связывает их
с конкретным блюдом. В симуляторе исходные числа стоят рядом с выбранным вариантом,
а поле цены — рядом с результатом. Интерфейс отличается от ряда одинаковых карточек
ровными сравнениями и спокойным распределением внимания. Читаемость важнее эффектов.

| Документ | Содержание |
|---|---|
| [PRODUCT.md](../../PRODUCT.md) | факты продукта и ограничения |
| [DESIGN.md](../../DESIGN.md) | идея, токены, шрифт, сетка, состояния, движение |
| [CRITIQUE.md](CRITIQUE.md) | обзор существующего UI с доказательствами и ограничениями |
| [DIRECTION_EXPLORATION.md](DIRECTION_EXPLORATION.md) | настоящий seed и оценка направлений |
| [COMPONENT_PLAN.md](COMPONENT_PLAN.md) | 10 реальных 21st-кандидатов, лицензии, use/adapt/inspire/build |
| [SCREEN_CONCEPTS.md](SCREEN_CONCEPTS.md) | пять экранов, mobile, состояния и границы |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | последовательность будущей реализации и приёмка |
| [TOOL_RUNS.md](TOOL_RUNS.md) | реальные вызовы, результаты, ошибки и проверки |

Открыть mockups/index.html прямо в браузере либо из корня проекта:

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory docs/design/mockups
```

Открыть http://127.0.0.1:8766/ . После просмотра остановить сервер Ctrl+C.
Переключаться по страницам, изменить ширину до 375 px, открыть All figures и Menu,
сравнить подписи чисел, прочитать русскую выдержку Help. Мокапы работают без внешней
сети: шрифты локальные. Это статичные образцы: деньги не пересчитываются, данные
не сохраняются, A/B/C и период показаны в выбранном состоянии. Не вводить реальные данные.

Приложение и его тексты не изменены. Реализация, полный audit/a11y/keyboard/production
preview нового UI и утверждение направления — следующий этап. Тёмная тема и motion
dependency не нужны этому предложению; scope перевода на NL остаётся открытым.

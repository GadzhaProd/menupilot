# Компоненты: реальные результаты 21st MCP и решение Impeccable

2026-10-19. **10 вызовов search, 20 результатов первичного отбора, 10 подробных
кандидатов, 10 вызовов get_component, 10 проверок license.** Все get_component
успешны; ответ quota — paid, без locked/paywall. Приложение, зависимости и registry
не устанавливались. Источник и лицензия каждого кандидата проверены отдельно.
Метаданные и буквальный вывод лицензий: [evidence/21st-candidates.json](evidence/21st-candidates.json).

21st задаёт материал для оценки; выбор делает Impeccable по Operate, ограничениям
аудитории и собственному визуальному миру. Ни один найденный layout не принят целиком.
Получение кода не означает разрешение его копировать. Мокапы написаны самостоятельно;
нового кода компонентов 21st в этом коммите нет.

## Решения

| Место | Кандидат / demo id / автор | Лицензия через script | Зависимости и совместимость | Решение и обоснование |
|---|---|---|---|---|
| Оболочка и навигация | [Sidebar 1](https://21st.dev/@uiable/components/uiable-sidebar-1) · **19371** · uiable | MIT | React, lucide; shadcn Button/Card/Input/ScrollArea; registry: Radix slot/scroll-area/separator, CVA. Фиксированные 450/500 px, поиск и категории каталога. | **build own**. Здесь шесть постоянных маршрутов, не каталог. Сохранить Shell и сделать текстовые группы; не добавлять поиск, ScrollArea и ещё одну вложенную карточку. |
| Сводные показатели | [Statistics Card 10](https://21st.dev/@sean0205/components/statistics-card-10) · **4245** · Sean Hello / ReUI | mit | React, lucide, CVA, umbrella radix-ui; нестандартные badge-2, button-1, CardToolbar, DropdownMenu. Component содержит generic counter, нужная статистика находится в demo. | **build own**. Текущие domain-результаты выводить полосой итогов. Revenue и декоративное меню чужды задаче; равные карточки сохранят нынешнюю проблему. |
| Baseline / A / B / C | [Comparison Table](https://21st.dev/@mohammadshehadeh/components/comparison-02) · **26827** · Mohammad Shehadeh / Hirael | MIT | React, lucide, Button/Badge, Radix slot, CVA; жёсткие три колонки boolean/string, marketing CTA. Next imports нет. | **build own**. Нужны четыре числовых столбца, unknown/stale/дельты, выделение active отдельно от highest monthly. Продолжить существующую ComparisonTable; не превращать таблицу в тарифную. |
| Таблица блюд | [Records Table](https://21st.dev/@theshanelevine/components/records-table) · **23604** · theshanelevine | **no-license** | React hooks; собственные CSS classes/variables, SVG, selection/sort/calculation логика; registry npmDependencies пуст. | **inspire**. Только общий принцип закреплённой подписи и аккуратного табличного ритма. Не копировать и не переписывать этот код. Самостоятельная таблица поверх текущих данных, без CRM тегов, bulk selection и формул UI. |
| Поле денег | [Input — inline add-ons](https://21st.dev/@originui/components/input) · **124** · Origin UI | mit | React, cn, Input/Label; registry пуст, но cn требует существующие clsx/tailwind-merge. 36 px, small font, opacity focus. `type=text`; парсера денег нет. | **adapt** (на этапе реализации). Взять композицию prefix/input, поднять до 48 px/16 px; unit + VAT в label/hint, inputMode decimal, aria-invalid/describedby. Существующий строковый parse/validation остаётся. EUR selector не добавлять. |
| Диалоги | [Dialog — feedback demo](https://21st.dev/@originui/components/dialog) · **370** · Origin UI | mit | React, Radix Dialog, **@radix-ui/react-icons** в source; Button/Textarea; registry показывает Radix label/CVA и не полон. animate-in/out требует отдельного CSS. | **build own** поверх уже имеющегося Radix Dialog. Дублировать библиотечный wrapper и ставить ещё один icon package незачем. Настроить размеры, overflow, контраст и footer текущего компонента. |
| Пустые состояния | [Empty Background](https://21st.dev/@uiable/components/empty-background) · **18266** · uiable | MIT | Button/Empty; **iconsax-reactjs** в source; registry Radix slot/avatar/CVA. Есть несоответствие имён EmptyMuted/EmptyBackground. | **build own**. Заголовок причины + одно следующее действие, иконка необязательна. Не ставить iconsax, не копировать notification-specific текст и лишние primitives. |
| Период сравнения | [Segmented Control](https://21st.dev/@halaska-studio/components/segmented-control) · **34764** · halaska-studio / @delego | MIT | React, собственный theme context, tokens и DOM measurement; registry пуст. В коде мелкий типографический масштаб и цельная чужая тема. | **build own**. Существующие кнопки 7/30/90 дней + native date. 48 px, aria-pressed, общий label; без дублирования темы и измеряемого «бегунка». |
| Уведомления | [Toast](https://21st.dev/@cnippet-dev/components/toast) · **24297** · Cnippet | **no-license** | **@base-ui/react/toast**, React, lucide, CVA; собственный manager/swipe/позиционирование; Base UI вне утверждённого стека. | **inspire**. Только принцип отличимого значка статуса и текста. Никакого кода/переписывания; собственные inline status/alert на существующем Alert. Не скрывать ошибки таймером. |
| Бейдж изменения | [Badge Delta](https://21st.dev/@serafimcloud/components/badge-delta) · **514** · Serafim | mit | React, CVA, cn, **@remixicon/react**, Tremor-only utility classes; registry пуст и не отражает source imports. В репо уже есть адаптация с lucide. | **adapt** существующую лицензированную реализацию, не импортировать заново. Применить токены, 14–16 px, знак и направление лучше/хуже по метрике; существующий tone сохранить. |

Итог по десяти кандидатам: **use 0 · adapt 2 · inspire 2 · build own 6**.
Build own означает простую самостоятельную композицию на уже установленных
примитивах, а не новый UI framework. Вторые результаты поиска не стали кандидатами:
например, Currency Amount Input Group предлагает ненужную валюту; Empty State with
Marquee — отвлекающее движение; Delta Bars — отсутствующую в продукте аналитическую историю.

## Условия переноса кода исполнителем

Для будущей адаптации Origin Input до копирования:

1. Повторить `sh scripts/21st.sh license @originui/components/input`, сохранить результат.
2. Создать **third_party/21st/originui-input/LICENSE**: полный стандартный MIT текст,
   правообладатель Origin UI, URL оригинального компонента. Не придумывать год copyright.
3. Добавить source/license comment в копируемый файл и строку в **THIRD_PARTY_NOTICES.md**.
4. Не запускать install command с `latest`. Повторно проверить прямые и транзитивные
   imports, React 19, Tailwind v4, alias, CSS variables, Next.js imports, динамические
   class names и peer deps. В план включена только композиция; новый пакет не требуется.

Badge Delta уже имеет `third_party/21st/badge-delta/LICENSE`, source comment и notice;
проверить их сохранность после изменения. Иные кандидаты не копируются. Если появится
Apache-кандидат, полный LICENSE и существующий NOTICE обязательны. no-license/unknown
не становятся MIT от того, что код выдаётся MCP.

В этом задании root `third_party/**` и THIRD_PARTY_NOTICES.md не разрешены к изменению,
поэтому новых копий кода нет. OFL-шрифт для самостоятельных мокапов сопровождается
полным [LICENSE](mockups/fonts/LICENSE.md) и [PROVENANCE](mockups/fonts/PROVENANCE.md).

## Дополнительный раунд B/C

Новый поиск и отдельные решения для альтернатив: [alternatives/COMPONENT_PLAN.md](alternatives/COMPONENT_PLAN.md). Исходная таблица A выше сохранена.

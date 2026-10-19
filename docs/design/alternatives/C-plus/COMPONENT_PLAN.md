# 21st → C+: решения Impeccable

2 реальных search →5 кандидатов;3get_component и 3license-проверки. [Metadata/импорты/фактические лицензии](21st-research.json). Критерии adapt/polish: понятное System/Light/Dark, клавиатура, отсутствие лишней зависимости и декоративного движения. Кода из 21st не копировали; все mock controls написаны самостоятельно.

| Компонент | Автор / license script | Зависимости | Решение |
|---|---|---|---|
| [1612 Theme Switcher](https://21st.dev/@haydenbleasel/components/theme-switcher) | Hayden Bleasel / Kibo UI, **mit** | React, @radix-ui/react-use-controllable-state, lucide-react, motion/react; registry deps пуст | **build own**. Подписанный native select с 3 опциями лучше вмещается в 375px и сразу поддерживает клавиатуру. Сохраняем идею явного System; не нужны три icon-only кнопки и ещё один hook-package. |
| [23700 Theme Switcher Dropdown](https://21st.dev/@felipemenezes098/components/dropdown-14) | felipemenezes098 / @flx, **AGPL-3.0** | Radix dropdown-menu/slot, CVA,lucide `latest`; React и utils | **inspire** только идея группы system/light/dark. Лицензия вне allowlist проекта: не копировать и не переписывать source. Собственный native select. |
| [35020 Segmented Control](https://21st.dev/@kuratlielia/components/segmented-control) | kuratlielia / MIT | React,motion/react,custom motion tokens,CSS module | **build own**. Для трёх сценариев достаточно разрешённых primitives/native radio semantics. Убрать edge fade, горизонтальный scroll и новые motion tokens; сохранить видимые полные подписи. |

Итого shortlist: use0/adapt0/inspire1/build own2. Кандидаты 3552 и 34763 остались catalog-only, их source/лицензии не проверялись и копирование не разрешено. Ранее изученные таблицы, badges, dialogs см. [предыдущий план](../COMPONENT_PLAN.md): C+ использует существующие UI primitives и собственную композицию, не маркетинговую matrix.

ThemeSelect, ScenarioChoice, MoneyValue, semantic Table, Button, Input, Dialog/Alert — реализовать поверх уже одобренного стека. Ни Next.js/next-themes, ни Base UI, ни @number-flow/react, ни новый dropdown-пакет не устанавливать. Motion опционален, точный кандидат 14.4.0 из [предыдущей проверки registry](../motion-version.json), transitive framer-motion14.4.0 — часть этого пакета, не независимый выбор версии.

Если исполнитель позже решит копировать MIT-кандидат вместо build own, потребуется отдельное решение и полный LICENSE с copyright автора/URL, source comment и THIRD_PARTY_NOTICES.md по AGENTS. В текущем пакете такие файлы не создаются: source adoption отсутствует.

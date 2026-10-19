# C+ foundation API for screens (parts 2–3)

`DataProvider` mounts `LocaleProvider` + `ThemeProvider` once above the document provider. Do not nest another provider in a screen or remount it on locale/route changes. It keeps existing document and scenario drafts intact.

```tsx
import { useLocale, useFormatters } from '@/ui/i18n';
const { locale, setLocale, t, plural } = useLocale();
const f = useFormatters();
t('common.save');
t('count.dishes.other', { count: 5 }); // required parameters are checked by TypeScript
plural('count.dishes', count); // one/other, whole messages; safe non-negative integer
f.money(result.monthlyContributionCents); // number | bigint cents
f.microMoney(result.contributionMicro); // bigint micro-euros; existing rounding
f.percent(result.foodCostTenths); // bigint | null; n/a / n.v.t.
f.points(deltaTenths); // +5.4 pp / +5,4 pp; pp in BOTH languages
f.date(iso); // UTC date, locale-specific month
```

Add semantic keys in `en.ts` (`as const`) and identical keys/parameters in `nl.ts` (`satisfies Record<TranslationKey, string>`). `test/ui/i18n.test.ts` verifies parity, parameter names and nonempty messages. `createTranslator(locale)` is the equivalent pure API for form adapters; do not use hooks outside components. Do not translate user names or domain error.message via regex/DOM. Form errors should use typed keys at the UI validation boundary; domain errors can map by stable error code. Existing screens retain EN copy until their assigned stage. No global mutable locale is used by the formatters.

## Terminology

NL: prep = **basisrecept**; Baseline = **Huidige situatie** (chosen over mock “Uitgangssituatie”); Food cost % = **Foodcostpercentage** (chosen over “Kostenaandeel”); **Verkocht per maand**; **Voorbeeldgegevens**; **Bijdrage vóór overige kosten**; **Ingrediëntkosten volgens recept**; **btw**; **je/jouw**. The old Luna dictionary was consulted as draft text only: no English-string keys or DOM mutation were adopted.

## Preferences and demo

- Locale key `menupilot.ui.locale.v1`: en/nl; absent/invalid uses browser nl* → nl, otherwise en (task overrides the older implementation-plan EN default).
- Theme key `menupilot.ui.theme.v1`: system/light/dark; absent/invalid = system. `useTheme()` from `@/ui/theme/ThemeProvider` returns `preference`, effective `theme`, `setPreference`, `storageError`. Theme colours update immediately; only nav selection has a 160 ms accent motion via `motion/mini`, disabled for reduced motion or unavailable Web Animations API.
- `DataProvider` selects `demoForLocale(locale)` on first load when given the bundled EN demo. Custom fixture documents are respected. Saved user documents always win. Locale changes never replace loaded data.
- Explicit reset: `execute(store => store.resetToDemo(demoForLocale(locale)))`. Validation/write failure leaves both current document and storage unchanged. No preference goes into backups/scenarios.

## Components

Existing imports remain valid: Button (variants/default, outline, secondary, ghost, link, destructive; all sizes ≥48 px), Input, Select (native), Label, FormField, Table, Card, Radix Dialog, Alert, BadgeDelta. Theme tokens cover both modes; use `positive`/`negative` by metric meaning, not mathematical sign alone. `BadgeDelta` keeps `deltaType`, formatted `value`, explicit `tone="good" | "bad" | "neutral"`. For cost increases pass bad, contribution increases good. Zero stays neutral.

New compositions:

- `@/components/numeric-field`: `MoneyField` and `QuantityField` accept `label`, string `value`, `onValueChange`, optional `hint`/`error` and native input props. Money label must specify incl./excl. VAT; `supplier` adds the required invoice hint. Quantity requires `unit`. They never parse/round drafts.
- `@/components/ui/money-value`: `MoneyValue` receives formatted `value: string | null`, optional `tone` (neutral/positive/negative), `className`, `unknownLabel`. `BeforeAfter` receives formatted `before`, `after`, optional labels/tone. No arithmetic. Supply VAT context beside these displays.
- `@/components/ui/surface`: `Surface` is a section with background/dividers and padding; add a labelled heading.
- `@/components/ui/empty-state`: `EmptyState { title, description, action? }`.
- `@/components/ui/inline-status`: `InlineStatus { tone?: info|success|error, children }`; persistent status/alert, no disappearing timer.

CSS uses semantic variables and Tailwind tokens (`bg-surface`, `bg-panel`, `text-positive`, `text-negative`, `text-accent-foreground`, `border-input` for controls, `border-line` for separators). Do not add fixed light-only colour classes. Global keyboard focus is 3px + 3px offset. Money uses Archivo and tabular lining numerals. Print overrides to light without storage writes; header, controls, dialogs and `.no-print` are hidden. Screen-specific print column/editor rules remain with parts 2–3.

Legacy no-locale formatters are unchanged for existing screens/core. New `*Locale` functions are exported through `@/ui/domain/calc`. They preserve arbitrarily large BigInt values, cache Intl instances for the two supported languages and deliberately put the minus before €: EN `-€273.38`, NL `-€ 273,38` (NBSP). English numeric formatting uses en-GB explicitly: the runtime's en-NL integer grouping otherwise mixes dot grouping with decimal dots. No BigInt → Number conversion.

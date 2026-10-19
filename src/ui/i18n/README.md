# C+ foundation API for screens (parts 2–3)

`DataProvider` mounts `LocaleProvider` + `ThemeProvider` once above the document provider. Do not nest another provider in a screen or remount it on locale/route changes. It keeps existing document and scenario drafts intact.

```tsx
import { useLocale, useFormatters } from '@/ui/i18n';
const { locale, setLocale, t, tRich, plural } = useLocale();
const f = useFormatters();
t('common.save');
tRich('common.deleteNamed', { name: recipe.name }, { b: children => <strong>{children}</strong> });
// EN: Delete <strong>Soup</strong>?  NL: <strong>Soep</strong> verwijderen?
t('count.dishes.other', { count: 5 }); // required parameters are checked by TypeScript
plural('count.dishes', count); // one/other, whole messages; safe non-negative integer
plural('count.dishes', count, { count: f.integer(count) }); // optional typed display parameters; numeric count still selects the form
f.integer(1000); // safe integer number | bigint, EN 1,000 / NL 1.000; rejects fractional/unsafe numbers
f.money(result.monthlyContributionCents); // number | bigint cents
f.microMoney(result.contributionMicro); // bigint micro-euros; existing rounding
f.percent(result.foodCostTenths); // bigint | null; n/a / n.v.t.
f.points(deltaTenths); // +5.4 pp / +5,4 pp; pp in BOTH languages
f.date(iso); // UTC date, locale-specific month
f.packPrice(packCents, packSizeMilli, unit); // exact cost per kg/l/pc, formatted by locale
f.prepCost(batchMicro, outputMilli, outputUnit); // bigint | null batch; unknown stays explicit
```

Add semantic keys in `en.ts` (`as const`) and identical keys/parameters in `nl.ts` (`satisfies Record<TranslationKey, string>`). `test/ui/i18n.test.ts` verifies parity, parameter names, paired one/other keys, rich tag names and nonempty messages. `tRich(key, params, components)` accepts typed parameters and named component callbacks; only paired tags without attributes belong in dictionaries. User parameters remain escaped React text. The pure equivalent is `createRichTranslator(locale)`. `createTranslator(locale)` is the equivalent pure API for form adapters; do not use hooks outside components. Do not translate user names or domain error.message via regex/DOM. Form errors should use typed keys at the UI validation boundary; domain errors can map by stable error code. Existing screens retain EN copy until their assigned stage. No global mutable locale is used by the formatters.

## Terminology

NL: prep = **basisrecept**; Baseline = **Huidige situatie** (chosen over mock “Uitgangssituatie”); Food cost % = **Foodcostpercentage** (chosen over “Kostenaandeel”); **Verkocht per maand**; **Voorbeeldgegevens**; **Bijdrage vóór overige kosten**; **Ingrediëntkosten volgens recept**; **btw**; **je/jouw**. The old Luna dictionary was consulted as draft text only: no English-string keys or DOM mutation were adopted.

## Preferences and demo

- Locale key `menupilot.ui.locale.v1`: en/nl; absent/invalid uses browser nl* → nl, otherwise en (task overrides the older implementation-plan EN default).
- Theme key `menupilot.ui.theme.v1`: system/light/dark; absent/invalid = system. `useTheme()` from `@/ui/theme/ThemeProvider` returns `preference`, effective `theme`, `setPreference`, `storageError`. Theme colours update immediately; nav selection uses a 160 ms CSS underline-offset transition, disabled by the global reduced-motion rule. No JavaScript animation cleanup runs when navigation is hidden or unmounted. The approved motion dependency remains available for later screen work; foundation has no runtime motion calls.
- `DataProvider` selects `demoForLocale(locale)` on first load when given the bundled EN demo. Custom fixture documents are respected. Saved user documents always win. Locale changes never replace loaded data.
- Explicit reset: `execute(store => store.resetToDemo(demoForLocale(locale)))`. Validation/write failure leaves both current document and storage unchanged. No preference goes into backups/scenarios.

## Components

Existing imports remain valid: Button (variants/default, outline, secondary, ghost, link, destructive; all sizes ≥48 px), Input, Select (native), Label, FormField, Table, Card, Radix Dialog, Alert, BadgeDelta. Theme tokens cover both modes; use `positive`/`negative` by metric meaning, not mathematical sign alone. `BadgeDelta` keeps `deltaType`, formatted `value`, explicit `tone="good" | "bad" | "neutral"`. For cost increases pass bad, contribution increases good. Zero stays neutral.

New compositions:

- `@/components/numeric-field`: `MoneyField` and `QuantityField` accept `label`, string `value`, `onValueChange`, optional `hint`/`error` and native input props. `MoneyField` requires `vat="incl" | "excl"` and appends the translated VAT suffix to `label` (do not repeat VAT in the label); `supplier` adds the required invoice hint. Quantity requires `unit`. They never parse/round drafts.
- `@/components/ui/money-value`: `MoneyValue` receives formatted `value: string | null`, optional `tone` (neutral/positive/negative), `className`, `unknownLabel`. `BeforeAfter` receives formatted `before`, `after`, optional labels/tone. No arithmetic. Supply VAT context beside these displays.
- `@/components/ui/surface`: `Surface` is a section with background/dividers and padding; add a labelled heading.
- `@/components/ui/empty-state`: `EmptyState { title, description, action? }`.
- `@/components/ui/inline-status`: `InlineStatus { tone?: info|success|error, children }`; persistent status/alert, no disappearing timer.

CSS uses semantic variables and Tailwind tokens (`bg-surface`, `bg-panel`, `text-positive`, `text-negative`, `text-accent-foreground`, `border-input` for controls, `border-line` for separators). Do not add fixed light-only colour classes. Global keyboard focus is 3px + 3px offset. Money uses Archivo and tabular lining numerals. Print overrides to light without storage writes; header, dialogs and `.no-print` are hidden. Inputs, selects and buttons remain printable unless their screen marks them `.no-print` or `print:hidden`. Page orientation belongs to the screen. Screen-specific print column/editor rules remain with parts 2–3.

Migration for parts 2–3: replace old `formatEURFrom*` calls and literal `n/a` in `src/ui` with `useFormatters()` (or `t('common.notApplicable')` for a label). `test/ui/legacy-formatters.test.ts` prints the remaining file/line inventory as warnings only until the screens are merged. Legacy no-locale formatters remain available for compatibility with core. New `*Locale` functions are exported through `@/ui/domain/calc`. They preserve arbitrarily large BigInt values, cache Intl instances for the two supported languages and deliberately put the minus before €: EN `-€273.38`, NL `-€ 273,38` (NBSP). English numeric formatting uses en-GB explicitly: the runtime's en-NL integer grouping otherwise mixes dot grouping with decimal dots. No BigInt → Number conversion. `normalizeLocale()` in calc is the single runtime normalizer: case-insensitive nl* → NL; unsupported languages → EN. Invalid dates display `n/a` / `n.v.t.` without throwing. The synchronous inline bootstrap must run before modules load; its mirrored preference keys and parsing rules are guarded against the runtime by `test/ui/bootstrap.test.ts`.


## Unit prices (foundation follow-up)

`packUnitPriceCents(packPriceCents, packSizeMilli, unit)` and `prepUnitCostCents(batchCostMicro, outputMilli, outputUnit)` are exported through `@/ui/domain/calc`. Both return the readonly `UnitPrice` shape `{ cents: bigint, per: 'kg' | 'l' | 'pc' }`; the prep function returns null for unknown batch cost. Sizes always mean thousandths of the base unit, even when unit is kg/l. All scaling, validation and rounding live in calc. Legacy `packUnitPriceDisplay`/`prepUnitCostDisplay` delegate to these numeric APIs and keep their exact EN output (including null for unknown prep).

For rendered screens use `f.packPrice(...)` / `f.prepCost(...)`. Examples: EN `€11.20/kg`, `€0.70/pc`; NL `€ 11,20/kg`, `€ 0,70/st.` (currency space is NBSP). Unknown prep is `cost unknown` / `kosten onbekend`, zero stays a formatted zero. Unit labels come from typed `units.kg/l/pc` messages. Formatting never parses an EN display string. Keep the **excl. VAT / excl. btw** label next to these displayed unit prices.

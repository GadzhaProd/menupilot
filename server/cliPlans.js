import { formatEURFromCentsLocale, formatEURFromMicroLocale, formatPercentTenthsLocale } from '../src/calc/money.js';
const usage = () => { throw Object.assign(new Error('Use propose add-price --ingredient <id|exact name> --pack-price <excl. VAT> --pack-size <quantity unit>, plans, or plan status <id> [--json] [--locale en|nl].'), { code: 'usage' }); };
export async function executePlanCommand(command, args, api) {
  let locale = 'en'; const words = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') continue;
    if (args[i] === '--locale') { locale = args[++i]; if (!['en', 'nl'].includes(locale)) usage(); }
    else words.push(args[i]);
  }
  let data;
  if (command === 'plans' && words.length === 0) data = await api('plans');
  else if (command === 'plan' && words.length === 2 && words[0] === 'status') data = await api('plans/status', { method: 'POST', body: { id: words[1] } });
  else if (command === 'propose' && words.shift() === 'add-price') {
    const body = {}, keys = { '--ingredient': 'ingredient', '--pack-price': 'packPrice', '--pack-size': 'packSize' };
    while (words.length) {
      const flag = words.shift(), key = keys[flag];
      if (!key || body[key] !== undefined || !words.length || words[0].startsWith('--')) usage();
      body[key] = words.shift();
      if (key === 'packSize' && words.length && /^(g|kg|ml|l|pc)$/i.test(words[0])) body[key] += ' ' + words.shift();
    }
    if (Object.keys(body).length !== 3) usage();
    data = await api('plans/propose', { method: 'POST', body });
  } else usage();
  const version = data;
  data = command === 'plans' ? data.plans : data;
  const formatted = formatPlan(data, locale);
  const warnings = (Array.isArray(formatted) ? formatted : [formatted]).flatMap(p => p.warnings ?? []);
  return { apiVersion: 1, command, documentId: version.documentId, revision: version.revision, data: formatted, warnings, locale };
}
// CLI presentation only; persisted plans and the UI transport retain exact values.
export function formatPlan(value, locale, key = '') {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(v => formatPlan(v, locale));
  if (typeof value === 'object') {
    if (key === 'unitPrice') return { ...value, display: formatEURFromCentsLocale(BigInt(value.cents), locale) };
    if (value.code && value.message && locale === 'nl') return { ...value, message: value.code === 'zero-price'
      ? 'De voorgestelde leveranciersprijs is nul. Controleer de factuur voordat je bevestigt.'
      : 'De prijs per kg/l/pc verandert met meer dan ×3. Controleer de verpakking en factuur voordat je bevestigt.' };
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, formatPlan(v, locale, k)]));
  }
  if (/(?:Cents|Micro)$/.test(key)) {
    const micro = key.endsWith('Micro');
    return { [micro ? 'micro' : 'cents']: String(value), display: (micro ? formatEURFromMicroLocale : formatEURFromCentsLocale)(BigInt(value), locale) };
  }
  return value;
}
export function printPlan(result) {
  const nl = result.locale === 'nl', vat = nl ? 'excl. btw' : 'excl. VAT';
  const money = v => v === null ? '—' : v.display;
  const cost = v => v === null ? (nl ? 'kosten onbekend' : 'cost unknown') : v.display;
  const pct = v => v === null ? '—' : formatPercentTenthsLocale(BigInt(v), result.locale);
  for (const plan of Array.isArray(result.data) ? result.data : [result.data]) {
    const unit = plan.ingredient.unit;
    const big = unit !== 'pc' && plan.price.packSizeMilli >= 1000000;
    const size = new Intl.NumberFormat(result.locale, { maximumFractionDigits: 5 }).format(plan.price.packSizeMilli / (big ? 1000000 : 1000));
    const packUnit = big ? (unit === 'g' ? 'kg' : 'l') : unit;
    console.log(`Plan ${plan.id}: ${plan.status}\n${plan.ingredient.name} [${plan.ingredient.id}]\n${nl ? 'Leveranciersprijs excl. btw, zoals op de factuur' : 'Supplier price excl. VAT, as on the invoice'}\n${money(plan.previousPrice?.packPriceCents ?? null)} → ${money(plan.price.packPriceCents)} ${vat}; ${size} ${packUnit}\n${plan.previousPrice ? plan.previousPrice.unitPrice.display : '—'} → ${plan.proposedPrice.unitPrice.display}/${plan.proposedPrice.unitPrice.per} ${vat}\n${nl ? 'Geldig tot' : 'Expires'}: ${plan.expiresAt}`);
    for (const row of plan.effects.dishes) console.log(`${row.name}: ${nl ? 'Ingrediëntkosten volgens recept' : 'Recipe-based ingredient cost'} ${cost(row.comparisonCostMicro)} → ${cost(row.currentCostMicro)} ${vat}; food cost ${pct(row.comparisonFoodCostTenthsPct)} → ${pct(row.currentFoodCostTenthsPct)}; ${nl ? 'maandelijkse verandering in bijdrage' : 'monthly contribution change'} ${money(row.monthlyImpactCents)}${row.excludedReason ? ' (excluded: ' + row.excludedReason + ')' : ''}`);
    for (const row of plan.effects.preps) console.log(`${row.name} (${nl ? 'basisrecept' : 'prep batch'}): ${cost(row.comparisonBatchMicro)} → ${cost(row.currentBatchMicro)} ${vat}`);
    console.log(`${nl ? 'Verandering in maandelijkse bijdrage van het menu' : 'Menu monthly contribution change'}: ${money(plan.effects.totalMonthlyImpactCents)}; excluded: ${plan.effects.excludedWithoutVolume} without volume, ${plan.effects.excludedWithVolume} with unknown cost.`);
    for (const warning of plan.warnings ?? []) console.log(`⚠ ${warning.message}`);
    if (plan.supersedes?.length) console.log(`${nl ? 'Vervangt' : 'Supersedes'}: ${plan.supersedes.join(', ')}`);
    if (plan.status === 'pending') console.log(nl ? 'Wacht op bevestiging van de eigenaar in MenuPilot' : 'Waiting for owner confirmation in MenuPilot');
    if (['stale', 'expired'].includes(plan.status)) console.log(nl ? 'Vraag de agent om een nieuw voorstel.' : 'Ask the agent to propose again.');
  }
}

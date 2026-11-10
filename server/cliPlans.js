import { formatEURFromCentsLocale, formatEURFromMicroLocale, formatPercentTenthsLocale } from '../src/calc/money.js';
import { safeHumanValue, statusWarnings } from './cliRead.js';

const PROPOSAL_USAGE =
  "Use propose add-price " +
  "--ingredient <id|exact name> --pack-price <excl. VAT> " +
  "--pack-size <quantity unit>, plans, or plan status <id> [--json] [--locale en|nl].";
const LARGE_PRICE_WARNING_NL =
  "De prijs per kg/l/pc verandert met meer dan ×3." +
  " Controleer de verpakking en factuur voordat je bevestigt.";

const usage = () => {
  throw Object.assign(new Error(PROPOSAL_USAGE), { code: 'usage' });
};

export async function executePlanCommand(command, args, api) {
  let locale = 'en';
  const words = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') {
      continue;
    }
    if (args[i] === '--locale') {
      locale = args[++i];
      if (!['en', 'nl'].includes(locale)) {
        usage();
      }
    } else {
      words.push(args[i]);
    }
  }
  let data;
  if (command === 'plans' && words.length === 0) {
    data = await api('plans');
  } else if (command === 'plan' && words.length === 2 && words[0] === 'status') {
    data = await api('plans/status', { method: 'POST', body: { id: words[1] } });
  } else if (command === 'propose' && words.shift() === 'add-price') {
    const body = {};
    const keys = {
      '--ingredient': 'ingredient',
      '--pack-price': 'packPrice',
      '--pack-size': 'packSize'
    };
    while (words.length) {
      const flag = words.shift();
      const key = keys[flag];
      if (!key || body[key] !== undefined || !words.length || words[0].startsWith('--')) {
        usage();
      }
      body[key] = words.shift();
      if (key === 'packSize' && words.length && /^(g|kg|ml|l|pc)$/i.test(words[0])) {
        body[key] += ' ' + words.shift();
      }
    }
    if (Object.keys(body).length !== 3) {
      usage();
    }
    data = await api('plans/propose', { method: 'POST', body });
  } else {
    usage();
  }
  const version = data;
  data = command === 'plans' ? data.plans : data;
  const formatted = formatPlan(data, locale);
  const warnings = [
    ...(Array.isArray(formatted) ? formatted : [formatted]).flatMap(p => p.warnings ?? []),
    ...statusWarnings(
      await api('backups/status')
    )
  ];
  return {
    apiVersion: 1,
    command,
    documentId: version.documentId,
    revision: version.revision,
    data: formatted,
    ...(command === 'plans' && { confirmation: locale === 'nl'
      ? 'De eigenaar kan alle openstaande voorstellen tegelijk bevestigen met Alles toepassen in het MenuPilot-venster. De agent kan niet bevestigen.'
      : 'The owner can confirm all pending proposals together with Apply all in the MenuPilot window. The agent cannot confirm.' }),
    warnings,
    locale
  };
}
// CLI presentation only; persisted plans and the UI transport retain exact values.

export function formatPlan(value, locale, key = '') {
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(v => formatPlan(v, locale));
  }
  if (typeof value === 'object') {
    if (key === 'unitPrice') {
      return { ...value, display: formatEURFromCentsLocale(BigInt(value.cents), locale) };
    }
    if (value.code && value.message && locale === 'nl') {
      return {
        ...value,
        message: value.code === 'zero-price'
          ? 'De voorgestelde leveranciersprijs is nul. Controleer de factuur voordat je bevestigt.'
          : LARGE_PRICE_WARNING_NL
      };
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, formatPlan(v, locale, k)]));
  }
  if (/(?:Cents|Micro)$/.test(key)) {
    const micro = key.endsWith('Micro');
    return {
      [micro ? 'micro' : 'cents']: String(value),
      display: (micro ? formatEURFromMicroLocale : formatEURFromCentsLocale)(BigInt(value), locale)
    };
  }
  return value;
}

function planExclusion(reason, nl) {
  if (!reason) return '';
  const text = nl
    ? ' (uitgesloten: ' + (reason === 'no-volume' ? 'zonder maandvolume' : 'kosten onbekend')
    : ' (excluded: ' + reason;
  return text + ')';
}

export function printPlan(result) {
  result = safeHumanValue(result);
  const nl = result.locale === 'nl';
  const vat = nl ? 'excl. btw' : 'excl. VAT';
  const money = v => v === null ? '—' : v.display;
  const cost = v => v === null ? nl ? 'kosten onbekend' : 'cost unknown' : v.display;
  const pct = v => v === null ? '—' : formatPercentTenthsLocale(BigInt(v), result.locale);
  const plans = Array.isArray(result.data) ? result.data : [result.data];
  if (!plans.length) {
    console.log(nl ? 'Geen prijsvoorstellen.' : 'No price proposals.');
  }
  if (result.confirmation) console.log(result.confirmation);
  for (const plan of plans) {
    const unit = plan.ingredient.unit;
    const big = unit !== 'pc' && plan.price.packSizeMilli >= 1000000;
    const size = new Intl.NumberFormat(
      result.locale,
      { maximumFractionDigits: 5 }
    ).format(
      plan.price.packSizeMilli / (big
          ? 1000000
          : 1000)
    );
    const packUnit = big ? unit === 'g' ? 'kg' : 'l' : unit;
    const supplierLabel = nl
      ? 'Leveranciersprijs excl. btw, zoals op de factuur'
      : 'Supplier price excl. VAT, as on the invoice';
    const previousPrice = money(plan.previousPrice?.packPriceCents ?? null);
    const proposedPrice = money(plan.price.packPriceCents);
    const previousUnitPrice = plan.previousPrice
      ? plan.previousPrice.unitPrice.display + '/' + plan.previousPrice.unitPrice.per
      : '—';
    const proposedUnitPrice = `${plan.proposedPrice.unitPrice.display}/${plan.proposedPrice.unitPrice.per}`;
    console.log([
      `Plan ${plan.id}: ${plan.status}`,
      `${plan.ingredient.name} [${plan.ingredient.id}]`,
      supplierLabel,
      `${previousPrice} → ${proposedPrice} ${vat}; ${size} ${packUnit}`,
      `${previousUnitPrice} → ${proposedUnitPrice} ${vat}`,
      `${nl ? 'Geldig tot' : 'Expires'}: ${plan.expiresAt}`,
    ].join('\n'));
    if (plan.effectsUpdated) {
      console.log(nl ? 'Gevolgen bijgewerkt na andere wijzigingen.' : 'Consequences updated after other changes.');
    }
    for (const row of plan.effects.dishes) {
      const costLabel = nl ? 'Ingrediëntkosten volgens recept' : 'Recipe-based ingredient cost';
      const foodCostLabel = nl ? 'Foodcostpercentage' : 'food cost';
      const monthlyLabel = nl ? 'maandelijkse verandering in bijdrage' : 'monthly contribution change';
      const costChange = `${cost(row.comparisonCostMicro)} → ${cost(row.currentCostMicro)}`;
      const foodCostChange = `${pct(row.comparisonFoodCostTenthsPct)} → ${pct(row.currentFoodCostTenthsPct)}`;
      const monthlyChange = money(row.monthlyImpactCents);
      console.log(`${row.name}: ${costLabel} ${costChange} ${vat}; ` +
        `${foodCostLabel} ${foodCostChange}; ${monthlyLabel} ${monthlyChange}` +
        planExclusion(row.excludedReason, nl));
    }
    for (const row of plan.effects.preps) {
      const batchLabel = nl ? 'basisrecept' : 'prep batch';
      const batchChange = `${cost(row.comparisonBatchMicro)} → ${cost(row.currentBatchMicro)}`;
      console.log(`${row.name} (${batchLabel}): ${batchChange} ${vat}`);
    }
    const totalLabel = nl
      ? 'Verandering in maandelijkse bijdrage van het menu'
      : 'Menu monthly contribution change';
    const excludedLabel = nl ? 'uitgesloten' : 'excluded';
    const noVolumeLabel = nl ? 'zonder maandvolume' : 'without volume';
    const unknownCostLabel = nl ? 'met onbekende kosten' : 'with unknown cost';
    const total = money(plan.effects.totalMonthlyImpactCents);
    const noVolume = plan.effects.excludedWithoutVolume;
    const unknownCost = plan.effects.excludedWithVolume;
    console.log(`${totalLabel}: ${total}; ${excludedLabel}: ${noVolume} ${noVolumeLabel}, ` +
      `${unknownCost} ${unknownCostLabel}.`);
    for (const warning of plan.warnings ?? []) {
      console.log(`⚠ ${warning.message}`);
    }
    if (plan.supersedes?.length) {
      console.log(`${nl ? 'Vervangt' : 'Supersedes'}: ${plan.supersedes.join(', ')}`);
    }
    if (plan.status === 'pending') {
      console.log(
        nl ? 'Wacht op bevestiging van de eigenaar in MenuPilot' : 'Waiting for owner confirmation in MenuPilot'
      );
    }
    if (['stale', 'expired'].includes(plan.status)) {
      console.log(nl ? 'Vraag de agent om een nieuw voorstel.' : 'Ask the agent to propose again.');
    }
  }
  // Plan warnings print with their plan above; backup and health warnings print once.
  const planWarnings = new Set(plans.flatMap(plan => plan.warnings ?? []));
  for (const warning of result.warnings ?? []) {
    if (!planWarnings.has(warning)) {
      console.log(`${nl ? 'Waarschuwing' : 'Warning'}: ${warning.message}`);
    }
  }
}

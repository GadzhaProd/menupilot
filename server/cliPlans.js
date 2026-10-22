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
  const version = Array.isArray(data) ? await api('version') : data;
  return { apiVersion: 1, command, documentId: version.documentId, revision: version.revision, data, warnings: [], locale };
}
export function printPlan(result) {
  const cents = v => v === null ? '—' : formatEURFromCentsLocale(BigInt(v), result.locale);
  const micro = v => v === null ? 'cost unknown' : formatEURFromMicroLocale(BigInt(v), result.locale);
  const pct = v => v === null ? '—' : formatPercentTenthsLocale(BigInt(v), result.locale);
  for (const plan of Array.isArray(result.data) ? result.data : [result.data]) {
    console.log(`Plan ${plan.id}: ${plan.status}\n${plan.ingredient.name} [${plan.ingredient.id}]\nSupplier price excl. VAT, as on the invoice\n${cents(plan.previousPrice?.packPriceCents ?? null)} → ${cents(plan.price.packPriceCents)} excl. VAT; pack ${plan.price.packSizeMilli} milli-${plan.ingredient.unit}\nExpires: ${plan.expiresAt}`);
    for (const row of plan.effects.dishes) console.log(`${row.name}: Recipe-based ingredient cost ${micro(row.comparisonCostMicro)} → ${micro(row.currentCostMicro)} excl. VAT; food cost ${pct(row.comparisonFoodCostTenthsPct)} → ${pct(row.currentFoodCostTenthsPct)}; monthly contribution change ${cents(row.monthlyImpactCents)}${row.excludedReason ? ' (excluded: ' + row.excludedReason + ')' : ''}`);
    for (const row of plan.effects.preps) console.log(`${row.name} (prep batch): ${micro(row.comparisonBatchMicro)} → ${micro(row.currentBatchMicro)} excl. VAT`);
    console.log(`Menu monthly contribution change: ${cents(plan.effects.totalMonthlyImpactCents)}; excluded: ${plan.effects.excludedWithoutVolume} without volume, ${plan.effects.excludedWithVolume} with unknown cost.`);
    if (plan.status === 'pending') console.log('Ожидает подтверждения владельца в окне MenuPilot');
    if (['stale', 'expired'].includes(plan.status)) console.log('Ask the agent to propose again.');
  }
}

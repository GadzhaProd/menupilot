import { createHash, randomUUID } from 'node:crypto';
import { StoreError } from '../src/store/errors.js';
import { appendPrice } from '../src/store/price.js';
import { assertValidDocument } from '../src/store/schema.js';
import { parseMoneyToCents } from '../src/calc/money.js';
import { parseQuantityToMilli } from '../src/calc/units.js';
import { encodePlan, packaging, planEffects } from './planEffects.js';
export const PLAN_LIMITS = {
  pending: 50,
  count: 200,
  bytes: 2 * 1024 * 1024,
  singleBytes: 256 * 1024,
  ttl: 86400000,
  retention: 7 * 86400000
};
// Canonical field order keeps JSON property order unrelated to price-history identity.
const priceHistoryHash = prices => createHash('sha256').update(JSON.stringify(prices.map(({
  seq,
  recordedAt,
  packPriceCents,
  packSizeMilli
}) => [seq, recordedAt, packPriceCents, packSizeMilli]))).digest('hex');
const normalize = value => value.trim().normalize('NFC').toLocaleLowerCase('en');
const fail = (code, message, candidates) => {
  throw Object.assign(new StoreError(code, message), {
    ...(candidates && { candidates }),
    ...(['plan-stale', 'plan-expired', 'plan-consequences-changed'].includes(code) && {
        status: 409
      })
  });
};

function findIngredient(entries, token) {
  const needle = normalize(token);
  const ids = entries.filter(i => normalize(i.id) === needle);
  const matches = ids.length ? ids : entries.filter(i => normalize(i.name) === needle);
  if (matches.length === 1) {
    return matches[0];
  }
  const candidates = (matches.length
    ? matches
    : entries.slice(
      0,
      20
    )).map(
    ({ id, name, unit }) => ({ id, name, unit })
  );
  fail(
    matches.length ? 'ambiguous' : 'not-found',
    matches.length
      ? 'More than one ingredient matches. Choose an exact ID.'
      : 'No exact ingredient match. Choose an exact ID or name.',
    candidates
  );
}

/** All entrypoints run synchronously inside the single writer's backup queue. */

export function createPlans(storage, now) {
  const { db } = storage;
  const timestamp = () => new Date(now()).toISOString();
  const markDirty = () => {
    db.prepare("INSERT OR IGNORE INTO meta(key,value) VALUES('backupDirtySince',?)").run(timestamp());
    db.prepare("INSERT INTO meta(key,value) VALUES('backupDirty','1') ON CONFLICT(key) DO " +
      "UPDATE SET value='1'").run();
  };
  const save = plan => {
    db.prepare('UPDATE plans SET plan=? WHERE id=?').run(JSON.stringify(plan), plan.id);
    markDirty();
  };
  function transaction(fn) {
    try {
      db.exec('BEGIN IMMEDIATE');
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {/* BEGIN may fail. */}
      if (error instanceof StoreError) {
        throw error;
      }
      throw new StoreError(
        'write-failed',
        'The plan could not be saved. Previous data is unchanged. Check disk space and retry.'
      );
    }
  }
  const replacementId = () => db.prepare("SELECT value FROM meta WHERE key='planReplacementId'").get()?.value ?? null;
  const basis = target => ({
    priceHistoryHash: priceHistoryHash(target.prices),
    replacementId: replacementId()
  });
  function stale(plan, current) {
    const target = current.document.ingredients.find(i => i.id === plan.ingredient.id);
    // The first save assigns an ID to an initially unsaved document; it is not a replacement.
    if (plan.documentId !== null && plan.documentId !== current.documentId || !target
      || target.unit !== plan.ingredient.unit) {
      return true;
    }
    if (!plan.basis) {
      return plan.revision !== current.revision;
    } // Legacy proposal: no dependency snapshot.
    return plan.basis.replacementId !== replacementId()
      || plan.basis.priceHistoryHash !== priceHistoryHash(
          target.prices
        );
  }
  function preview(plan, current = storage.load()) {
    if (plan.status !== 'pending') {
      return plan;
    }
    const after = structuredClone(current.document);
    appendPrice(after, plan.ingredient.id, {
      packPriceCents: Number(plan.price.packPriceCents),
      packSizeMilli: plan.price.packSizeMilli
    }, plan.price.recordedAt);
    const effects = planEffects(current.document, after, plan.ingredient.id, timestamp());
    const ingredient = {
      ...plan.ingredient,
      name: current.document.ingredients.find(i => i.id === plan.ingredient.id).name
    };
    const consequencesFingerprint = createHash('sha256').update(JSON.stringify({
      id: plan.id,
      ingredient,
      price: plan.price,
      effects
    })).digest('hex');
    return {
      ...plan,
      ingredient,
      consequencesFingerprint,
      effects,
      effectsUpdated: JSON.stringify(effects) !== JSON.stringify(plan.effects)
    };
  }
  function refresh() {
    const current = storage.load();
    const time = new Date(now()).getTime();
    const rows = db.prepare('SELECT plan FROM plans ORDER BY rowid DESC').all();
    const kept = [];
    for (const row of rows) {
      const plan = JSON.parse(row.plan);
      if (plan.status === 'pending') {
        const status = Date.parse(plan.expiresAt) <= time ? 'expired' : stale(plan, current) ? 'stale' : 'pending';
        if (status !== plan.status) {
          plan.status = status;
          save(plan);
        }
      }
      if (plan.status !== 'pending' && time - Date.parse(plan.expiresAt) > PLAN_LIMITS.retention) {
        db.prepare('DELETE FROM plans WHERE id=?').run(plan.id);
      } else {
        kept.push(plan);
      }
    }
    return kept;
  }
  function get(id) {
    if (typeof id !== 'string' || !id || id.length > 200) {
      fail('invalid-argument', 'Provide a plan ID.');
    }
    const plan = refresh().find(p => p.id === id);
    if (!plan) {
      fail('not-found', 'This plan is no longer available. Ask the agent to propose again.');
    }
    return plan;
  }
  function pending(plan) {
    if (plan.protocolVersion !== 1) {
      fail('plan-version', 'Unsupported plan. Ask the agent to propose again.');
    }
    if (plan.status !== 'pending') {
      fail('plan-' + plan.status, `This plan is ${plan.status}. Ask the agent to propose again.`);
    }
  }
  return {
    list: () => transaction(() => refresh().map(p => preview(p))),
    snapshot: () => transaction(() => ({
      ...storage.version(),
      plans: refresh().map(p => preview(p))
    })),
    get: id => transaction(() => preview(get(id))),
    propose(input, source = 'cli') {
      return transaction(() => {
        const plans = refresh();
        if (!input || Object.keys(input).some(k => !['ingredient', 'packPrice', 'packSize'].includes(k))
          || !['ingredient', 'packPrice', 'packSize'].every(
            k => typeof input[k] === 'string'
              && input[k].trim()
              && input[k].length <= 200
          )) {
          fail('invalid-argument', 'Provide ingredient, packPrice and packSize as text.');
        }
        if (!['cli', 'agent'].includes(source)) {
          fail('invalid-argument', 'Invalid proposal source.');
        }
        const current = storage.load();
        const target = findIngredient(current.document.ingredients, input.ingredient);
        let packPriceCents;
        let quantity;
        try {
          packPriceCents = parseMoneyToCents(input.packPrice);
        } catch (e) {
          fail('invalid-argument', e.message);
        }
        if (packPriceCents > 10_000_000) {
          fail('price-limit', 'Agent proposals are limited to a pack price of €100,000 excl. VAT.');
        }
        const match = /^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|pc)$/i.exec(input.packSize.trim());
        if (!match) {
          fail('invalid-unit', 'Pack size must include g, kg, ml, l or pc.');
        }
        try {
          quantity = parseQuantityToMilli(match[1], match[2]);
        } catch (e) {
          fail('invalid-unit', e.message);
        }
        if (quantity.unit !== target.unit) {
          fail('invalid-unit', `This ingredient uses ${target.unit}; ${match[2]} is incompatible.`);
        }
        const supersedes = plans.filter(p => p.status === 'pending' && p.ingredient.id === target.id);
        if (plans.filter(p => p.status === 'pending').length - supersedes.length >= PLAN_LIMITS.pending) {
          fail('plan-budget', 'Too many pending plans. Review pending plans first.');
        }
        const warnings = [];
        if (packPriceCents === 0) {
          warnings.push({
            code: 'zero-price',
            message: 'The proposed supplier price is zero. Check the invoice before confirming.'
          });
        }
        const oldPrice = target.prices.at(-1);
        // Exact ratio comparison for the approval guardrail, without rounding either unit price.
        if (oldPrice) {
          const next = BigInt(packPriceCents) * BigInt(oldPrice.packSizeMilli);
          const previous = BigInt(oldPrice.packPriceCents) * BigInt(quantity.quantityMilli);
          if (next > previous * 3n || previous > next * 3n) {
            warnings.push({
              code: 'large-price-change',
              message: ("The price per kg/l/pc changes by more than ×3. Check the pack size and invoice " +
                "before confirming.")
            });
          }
        }
        const createdAt = timestamp();
        const document = structuredClone(current.document);
        const price = appendPrice(document, target.id, {
          packPriceCents,
          packSizeMilli: quantity.quantityMilli
        }, createdAt);
        assertValidDocument(document, { now: createdAt });
        const plan = encodePlan({
          id: randomUUID(),
          opId: randomUUID(),
          protocolVersion: 1,
          kind: 'add-price',
          documentId: current.documentId,
          revision: current.revision,
          status: 'pending',
          source,
          createdAt,
          expiresAt: new Date(Date.parse(createdAt) + PLAN_LIMITS.ttl).toISOString(),
          ingredient: { id: target.id, name: target.name, unit: target.unit },
          price,
          basis: basis(target),
          previousPrice: packaging(target.prices.at(-1), target.unit),
          proposedPrice: packaging(price, target.unit),
          effects: planEffects(current.document, document, target.id, createdAt),
          warnings,
          supersedes: supersedes.map(p => p.id)
        });
        for (const old of supersedes) {
          old.status = 'superseded';
          old.supersededBy = plan.id;
          save(old);
        }
        const raw = JSON.stringify(plan);
        const bytes = Buffer.byteLength(raw);
        if (bytes > PLAN_LIMITS.singleBytes) {
          fail('plan-budget', 'Too many pending plans or this plan is too large. Review pending plans first.');
        }
        // Evict oldest terminal plans only; pending plans are never silently discarded.
        // Reserve room for receipts and lifecycle timestamps before accepting a plan.
        const reservedBytes = p => Buffer.byteLength(JSON.stringify(p)) + 1024;
        let total = plans.reduce((n, p) => n + reservedBytes(p), bytes + 1024);
        let count = plans.length + 1;
        for (const old of [...plans].reverse()) {
          if (total <= PLAN_LIMITS.bytes && count <= PLAN_LIMITS.count) {
            break;
          }
          if (old.status === 'pending') {
            continue;
          }
          db.prepare('DELETE FROM plans WHERE id=?').run(old.id);
          total -= reservedBytes(old);
          count--;
        }
        if (total > PLAN_LIMITS.bytes || count > PLAN_LIMITS.count) {
          fail('plan-budget', 'Plan storage budget reached. Review pending plans first.');
        }
        db.prepare('INSERT INTO plans(id,expiresAt,plan) VALUES(?,?,?)').run(plan.id, plan.expiresAt, raw);
        markDirty();
        return preview(plan, current);
      });
    },
    apply(id, consequencesFingerprint) {
      // Check dependencies and write the price/receipt under the same writer transaction.
      // Return lifecycle refusals so their stale/expired mark can commit before throwing.
      const outcome = transaction(() => {
        const plan = get(id);
        if (plan.status === 'applied') {
          return { ...storage.load(), receipt: plan.receipt };
        }
        try {
          pending(plan);
        } catch (error) {
          return { error };
        }
        const current = storage.load();
        const document = structuredClone(current.document);
        // Confirm exactly the figures the owner reviewed, even after unrelated compatible edits.
        if (consequencesFingerprint !== preview(plan, current).consequencesFingerprint) {
          fail('plan-consequences-changed', 'Consequences changed. Review the updated figures and confirm again.');
        }
        const price = appendPrice(document, plan.ingredient.id, {
          packPriceCents: Number(plan.price.packPriceCents),
          packSizeMilli: plan.price.packSizeMilli
        }, plan.price.recordedAt);
        if (JSON.stringify(encodePlan(price)) !== JSON.stringify(plan.price)) {
          fail('plan-stale', 'Price history changed. Ask the agent to propose again.');
        }
        const result = storage.write({
          kind: 'save',
          document,
          expectedDocumentId: current.documentId,
          expectedRevision: current.revision,
          opId: plan.opId
        }, 'agent', { withinTransaction: true, planId: plan.id, ingredientId: plan.ingredient.id });
        if (result.conflict) {
          fail('plan-stale', 'Data changed. Ask the agent to propose again.');
        }
        plan.status = 'applied';
        plan.receipt = result.receipt;
        plan.appliedAt = timestamp();
        save(plan);
        return result;
      });
      if (outcome.error) {
        throw outcome.error;
      }
      return outcome;
    },
    reject(id) {
      const plan = transaction(() => get(id));
      if (plan.status === 'rejected') {
        return plan;
      }
      pending(plan);
      return transaction(() => {
        plan.status = 'rejected';
        plan.rejectedAt = timestamp();
        save(plan);
        return plan;
      });
    }
  };
}

// Frozen v1 client from the pre-step-2a base. Compatibility test fixture; do not modernize.
import { createBackupStatus } from '../../src/store/backup.js';
import { createHistory } from '../../src/store/history.js';
import { instantNotAfter, isObject } from '../../src/store/check.js';
import { shiftDemoDates } from '../../src/store/demo.js';
import { StoreError } from '../../src/store/errors.js';
import { FORMAT_VERSION, assertValidDocument, emptyDocument } from '../../src/store/schema.js';

export { StoreError };
export const STORAGE_KEY = 'menupilot:v1';
const REVISION_KEY = 'menupilot:revision';

function randomId(prefix) {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(6));
  return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function writeError(error) {
  const quota = ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(error?.name)
    || error?.code === 22 || error?.code === 1014;
  if (quota) {
    return new StoreError('quota', 'Browser storage is full, so the change was not saved. Export a backup and free some space.');
  }
  return new StoreError('write-failed',
    `The change could not be saved (${error?.message ?? 'unknown error'}). Your previous data is unchanged.`);
}

const MAX_DOCUMENT_CHARS = 5_000_000; // about the size of a whole localStorage quota

/** Parse and validate document text from storage or from an imported file. */
function parseDocumentText(text, source, options) {
  if (typeof text !== 'string' || text.length > MAX_DOCUMENT_CHARS) {
    throw new StoreError('invalid', `${source} is too large or not text (limit ${MAX_DOCUMENT_CHARS} characters).`);
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new StoreError('corrupt-json', `${source} is not valid JSON.`);
  }
  if (isObject(doc) && doc.version !== undefined && doc.version !== FORMAT_VERSION) {
    throw new StoreError('unsupported-version',
      `${source} uses data format version ${JSON.stringify(doc.version)}, but this app supports version ${FORMAT_VERSION}.`);
  }
  assertValidDocument(doc, options);
  return doc;
}

const recipeUsers = (doc, kind, id) => doc.recipes
  .filter((recipe) => recipe.lines.some((entry) => entry.ref.kind === kind && entry.ref.id === id))
  .map((recipe) => recipe.name);

function findOrThrow(list, id, what) {
  const found = list.find((entry) => entry.id === id);
  if (!found) {
    throw new StoreError('not-found', `Unknown ${what} '${id}'.`);
  }
  return found;
}

function refuseIfUsed(users, name) {
  if (users.length > 0) {
    throw new StoreError('in-use', `Cannot delete '${name}': it is used by ${users.join(', ')}.`);
  }
}

/** Replace the entry with the same id, or append it. */
function upsert(list, entry) {
  const index = list.findIndex((existing) => existing.id === entry.id);
  if (index === -1) {
    list.push(entry);
  } else {
    list[index] = entry;
  }
}

/**
 * Create the store over a localStorage-like object (getItem/setItem).
 * Documents returned by the store are deep-frozen; every change builds a new copy
 * and replaces the stored document only after validation and a successful write.
 * @param {{getItem:Function, setItem:Function}} storage
 * @param {object} options
 * @param {object} options.demo REQUIRED: the parsed data/demo.json (the UI fetches it);
 *   the store itself does no file or network I/O. Must be a valid document.
 * @param {()=>Date|number|string} [options.now] Clock; default `() => new Date()`.
 * @param {(prefix:string)=>string} [options.createId] Id generator; default random hex.
 * @throws {StoreError} bad-options if storage or demo is missing; invalid if demo is not valid.
 */
export function createStore(storage, { now = () => new Date(), demo, createId = randomId } = {}) {
  if (typeof storage?.getItem !== 'function' || typeof storage?.setItem !== 'function') {
    throw new StoreError('bad-options', 'createStore needs a localStorage-like storage with getItem and setItem.');
  }
  if (!isObject(demo)) {
    throw new StoreError('bad-options', 'createStore needs the parsed data/demo.json as the `demo` option.');
  }
  assertValidDocument(demo);
  let current = null;
  // Exact document bytes plus an independent revision marker prevent stale writes and ABA.
  let expectedRaw;
  let expectedRevision;
  let historyWarning = false;
  const isoNow = () => new Date(now()).toISOString();
  const history = createHistory(storage, isoNow);
  const backup = createBackupStatus(storage, isoNow);

  function loaded() {
    if (current === null) {
      throw new StoreError('not-loaded', 'Data is not loaded yet. Call load() first, or reset to the demo data.');
    }
    return current;
  }

  /**
   * Validate, write, and only then publish `candidate` as the current document.
   * `checkFuture` also rejects price records from the future (used for save and import).
   */
  function persist(candidate, { checkFuture = false, ownData = true, requireHistory = false, preservedHistoryId = undefined } = {}) {
    assertValidDocument(candidate, checkFuture ? { now: isoNow() } : undefined);
    const text = JSON.stringify(candidate);
    const actualRaw = readRaw();
    if (expectedRaw !== undefined && (actualRaw !== expectedRaw || storage.getItem(REVISION_KEY) !== expectedRevision)) {
      throw new StoreError('conflict', 'Another tab changed the saved data. Load the latest data, review your draft and save again.');
    }
    if (text === actualRaw) {
      expectedRaw = text;
      expectedRevision = storage.getItem(REVISION_KEY);
      current ??= deepFreeze(JSON.parse(text));
      return current;
    }
    const snapshot = history.archive(actualRaw, preservedHistoryId);
    if (requireHistory && !snapshot.available) {
      throw new StoreError(snapshot.error ? writeError(snapshot.error).code : 'quota', `A copy of the current data could not be stored${snapshot.error?.message ? ` (${snapshot.error.message})` : ''}. Replacement was cancelled. Export a backup and free browser storage before trying again.`);
    }
    // The sidecar prevents ABA (restore A after B) without changing document v1.
    // Write it before the document: an interrupted commit invalidates stale writers.
    // A failed main write can leave a new token and a redundant snapshot, safely.
    const revision = crypto.randomUUID();
    for (;;) {
      try {
        storage.setItem(REVISION_KEY, revision);
        expectedRevision = revision;
        storage.setItem(STORAGE_KEY, text);
        break;
      } catch (error) {
        if (error instanceof StoreError) throw error;
        const failure = writeError(error);
        if (failure.code === 'quota') {
          try { if (history.evictOldest(snapshot.protectedKey, preservedHistoryId)) continue; }
          catch (evictionError) { if (evictionError instanceof StoreError) throw evictionError; }
        }
        throw failure;
      }
    }
    historyWarning = !snapshot.available;
    expectedRaw = text;
    current = deepFreeze(JSON.parse(text));
    // Ancillary reminder metadata must never turn a committed save into a failure.
    try { backup.saved(ownData); } catch { /* best effort, file backup remains available */ }
    return current;
  }

  /** Copy the current document, let `mutate` edit the copy, persist it. */
  function change(mutate) {
    const draft = structuredClone(loaded());
    mutate(draft);
    return persist(draft);
  }

  function readRaw() {
    try {
      return storage.getItem(STORAGE_KEY);
    } catch (error) {
      throw new StoreError('read-failed', `Browser storage could not be read (${error?.message ?? 'unknown error'}).`);
    }
  }

  function demoDocument(source = demo) {
    assertValidDocument(source);
    const doc = shiftDemoDates(source, isoNow());
    assertValidDocument(doc, { now: isoNow() });
    return doc;
  }

  function newPrice(prices, { packPriceCents, packSizeMilli }) {
    const last = prices.at(-1);
    const stamp = isoNow();
    return {
      seq: last ? last.seq + 1 : 1,
      // A clock that went backwards must not break the "recordedAt never decreases" rule.
      recordedAt: last && instantNotAfter(stamp, last.recordedAt) ? last.recordedAt : stamp,
      packPriceCents,
      packSizeMilli,
    };
  }

  return {
    /** Load saved data (first run: the demo, not yet written). Never overwrites bad data. */
    load({ beforeReplace = () => {} } = {}) {
      const raw = readRaw();
      const revision = storage.getItem(REVISION_KEY);
      if (current === null) { expectedRaw = raw; expectedRevision = revision; }
      const doc = raw === null ? demoDocument() : parseDocumentText(raw, 'The saved data');
      beforeReplace(deepFreeze(doc));
      expectedRaw = raw;
      expectedRevision = revision;
      current = deepFreeze(doc);
      return current;
    },

    getDocument: loaded,
    listHistory: history.list,
    getBackupStatus: backup.get,
    recordExport: backup.exported,
    remindLater: backup.remindLater,
    getHistoryWarning: () => historyWarning,
    restoreHistory(id) {
      const entry = history.list().find(item => item.id === id);
      if (!entry) throw new StoreError('not-found', 'This version is no longer available.');
      return persist(parseDocumentText(entry.raw, 'The saved version', { now: isoNow() }), { requireHistory: true, preservedHistoryId: id });
    },
    /** Explicit recovery of the memory document only if storage is still empty. */
    saveMemoryAsNew() {
      const candidate = loaded();
      if (readRaw() !== null) throw new StoreError('conflict', 'Another tab has saved data. Load the latest data first.');
      expectedRaw = null;
      expectedRevision = storage.getItem(REVISION_KEY);
      return persist(structuredClone(candidate));
    },
    /** Comparison token for the loaded document; never performs storage I/O. */
    getRevision: () => expectedRaw,
    readRaw,

    /** Replace the whole document (validated, then written). */
    save(doc) {
      loaded();
      return persist(structuredClone(doc), { checkFuture: true });
    },

    addIngredient({ id = createId('ing'), name, unit, price }) {
      const prices = price ? [newPrice([], price)] : [];
      return { id, document: change((draft) => { draft.ingredients.push({ id, name, unit, prices }); }) };
    },

    updateIngredient(id, { name, unit }) {
      return change((draft) => {
        const target = findOrThrow(draft.ingredients, id, 'ingredient');
        if (name !== undefined) {
          target.name = name;
        }
        if (unit !== undefined && unit !== target.unit) {
          if (target.prices.length > 0 || recipeUsers(draft, 'ingredient', id).length > 0) {
            throw new StoreError('invalid', `The unit of '${target.name}' cannot be changed once it has prices or is used in a recipe.`);
          }
          target.unit = unit;
        }
      });
    },

    /** Append a price record; earlier records are never changed. */
    addPrice(ingredientId, price) {
      return change((draft) => {
        const target = findOrThrow(draft.ingredients, ingredientId, 'ingredient');
        target.prices.push(newPrice(target.prices, price));
      });
    },

    deleteIngredient(id) {
      return change((draft) => {
        const target = findOrThrow(draft.ingredients, id, 'ingredient');
        refuseIfUsed(recipeUsers(draft, 'ingredient', id), target.name);
        draft.ingredients = draft.ingredients.filter((entry) => entry.id !== id);
      });
    },

    /** Insert or replace a dish or prep (matched by id; a missing id is generated). */
    saveRecipe(recipe) {
      const id = recipe.id ?? createId('rcp');
      return {
        id,
        document: change((draft) => {
          const previous = draft.recipes.find((entry) => entry.id === id);
          const outputUnitChanged = previous?.kind === 'prep'
            && recipe.kind === 'prep'
            && previous.outputUnit !== recipe.outputUnit;

          if (outputUnitChanged) {
            const users = recipeUsers(draft, 'prep', id);
            if (users.length > 0) {
              throw new StoreError(
                'in-use',
                `Cannot change '${previous.name}' output unit: it is used by ${users.join(', ')}.`,
                users,
              );
            }
          }

          upsert(draft.recipes, { ...structuredClone(recipe), id });
        }),
      };
    },

    /**
     * Delete a recipe. A prep that is still used is refused ('in-use'). A dish that has
     * scenarios is refused too (error.details = scenario names) unless
     * `{ deleteScenarios: true }` is passed, which removes those scenarios with it.
     */
    deleteRecipe(id, { deleteScenarios = false } = {}) {
      return change((draft) => {
        const target = findOrThrow(draft.recipes, id, 'recipe');
        refuseIfUsed(recipeUsers(draft, 'prep', id), target.name);
        const scenarios = draft.scenarios.filter((entry) => entry.recipeId === id);
        if (scenarios.length > 0 && !deleteScenarios) {
          const names = scenarios.map((entry) => entry.name);
          throw new StoreError('in-use', `Cannot delete '${target.name}': it has saved scenarios (${names.join(', ')}).`, names);
        }
        draft.recipes = draft.recipes.filter((entry) => entry.id !== id);
        draft.scenarios = draft.scenarios.filter((entry) => entry.recipeId !== id);
      });
    },

    saveScenario(scenario) {
      const id = scenario.id ?? createId('scn');
      return { id, document: change((draft) => upsert(draft.scenarios, { ...structuredClone(scenario), id })) };
    },

    deleteScenario(id) {
      return change((draft) => {
        findOrThrow(draft.scenarios, id, 'scenario');
        draft.scenarios = draft.scenarios.filter((entry) => entry.id !== id);
      });
    },

    updateSettings({ defaultVatRateBp }) {
      return change((draft) => { draft.settings.defaultVatRateBp = defaultVatRateBp; });
    },

    exportJSON() {
      return JSON.stringify(loaded(), null, 2);
    },

    /** Replace all data with a backup file. Any error leaves current data untouched. */
    importJSON(text) {
      // Recovery is allowed after load() captured even an unreadable document.
      if (expectedRaw === undefined) loaded();
      return persist(parseDocumentText(text, 'The imported file', { now: isoNow() }), { requireHistory: true });
    },

    /** Optional translated demo; validated before shifting/writing, never mutates the caller. */
    resetToDemo(source = demo) {
      return persist(demoDocument(source), { ownData: false, requireHistory: true });
    },

    /** Replace all data with an empty document (nothing is kept). Like resetToDemo, atomic. */
    resetToEmpty() {
      return persist(emptyDocument(), { requireHistory: true });
    },
  };
}

import { newPrice, appendPrice } from './price.js';
import { createBrowserStorageAdapter, STORAGE_KEY } from './browserAdapter.js';
import { newId } from './ids.js';
import { parseBackup, serializeBackup } from './serialization.js';
import { isObject } from './check.js';
import { shiftDemoDates } from './demo.js';
import { StoreError } from './errors.js';
import { assertValidDocument, emptyDocument } from './schema.js';

export { StoreError };
export { STORAGE_KEY };

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
export function createStore(storage, { now = () => new Date(), demo, createId = randomId, adapter, locks } = {}) {
  if (!adapter && (typeof storage?.getItem !== 'function' || typeof storage?.setItem !== 'function')) {
    throw new StoreError('bad-options', 'createStore needs a localStorage-like storage with getItem and setItem.');
  }
  if (!isObject(demo)) {
    throw new StoreError('bad-options', 'createStore needs the parsed data/demo.json as the `demo` option.');
  }
  assertValidDocument(demo);
  let current = null;
  let revision = 0;
  let documentId = null;
  const isoNow = () => new Date(now()).toISOString();
  const persistence = adapter ?? createBrowserStorageAdapter(storage, { initialDocument: demoDocument(), now, locks });
  let inFlight = false;
  let opened = false;
  function publish(result) {
    if (result.conflict) {
      const error = new StoreError('conflict', 'Another tab changed the saved data. Load the latest data and try again.');
      error.latest = result;
      throw error;
    }
    revision = result.revision;
    documentId = result.documentId;
    current = deepFreeze(structuredClone(result.document));
    return current;
  }

  function loaded() {
    if (current === null) {
      throw new StoreError('not-loaded', 'Data is not loaded yet. Call load() first, or reset to the demo data.');
    }
    return current;
  }

  async function persist(candidate, options) {
    assertValidDocument(candidate, options?.checkFuture ? { now: isoNow() } : undefined);
    return publish(await persistence.save(candidate, revision, newId()));
  }

  function change(mutate) {
    const draft = structuredClone(loaded());
    mutate(draft);
    return persist(draft);
  }

  function demoDocument(source = demo) {
    assertValidDocument(source);
    const doc = shiftDemoDates(source, isoNow());
    assertValidDocument(doc, { now: isoNow() });
    return doc;
  }


  const commands = {
    /** Load saved data (first run: the demo, not yet written). Never overwrites bad data. */
    async load(options) {
      try { return publish(await (options?.recovery && persistence.browserRecovery ? persistence.browserRecovery.loadForRecovery() : persistence.load(options))); }
      finally { opened = true; }
    },
    getDocument: loaded,
    getRevision: () => revision,
    getDocumentId: () => documentId,
    browserRecovery: persistence.browserRecovery,
    previewImport: text => parseBackup(text, 'The imported file', { now: isoNow() }).document,
    readHistory: persistence.history.read,
    listHistory: persistence.history.list,
    getBackupStatus: persistence.browserMetadata?.getBackupStatus ?? (() => ({ startedAt: null, lastExportAt: null, due: false })),
    recordExport: persistence.browserMetadata?.recordExport ?? (async () => {}),
    remindLater: persistence.browserMetadata?.remindLater ?? (async () => {}),
    getHistoryWarning: persistence.browserMetadata?.getHistoryWarning ?? (() => false),
    async restoreHistory(id) { return publish(await persistence.history.restore(id, revision, newId())); },
    async saveMemoryAsNew() { return publish(await persistence.saveMemoryAsNew(loaded(), newId())); },

    /** Replace the whole document (validated, then written). */
    save(doc) {
      loaded();
      return persist(structuredClone(doc), { checkFuture: true });
    },

    /** `effectiveDate` (YYYY-MM-DD, UTC) is the optional "valid from" day of the initial price. */
    async addIngredient({ id = createId('ing'), name, unit, price, effectiveDate }) {
      const prices = price ? [newPrice([], price, isoNow(), effectiveDate)] : [];
      return { id, document: await change((draft) => { draft.ingredients.push({ id, name, unit, prices }); }) };
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

    /**
     * Append a price record; earlier records are never changed. `effectiveDate` (YYYY-MM-DD, UTC)
     * is the optional "valid from" day: not before the previous price's day, not in the future.
     */
    addPrice(ingredientId, price, { effectiveDate } = {}) {
      return change((draft) => {
        appendPrice(draft, ingredientId, price, isoNow(), effectiveDate);
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
    async saveRecipe(recipe) {
      const id = recipe.id ?? createId('rcp');
      return {
        id,
        document: await change((draft) => {
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

    async saveScenario(scenario) {
      const id = scenario.id ?? createId('scn');
      return { id, document: await change((draft) => upsert(draft.scenarios, { ...structuredClone(scenario), id })) };
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

    async exportJSON() { return serializeBackup({ document: loaded(), documentId, revision }, true); },

    async importJSON(text) {
      const imported = parseBackup(text, 'The imported file', { now: isoNow() });
      return publish(await persistence.importDocument(imported, revision, newId()));
    },

    /** Optional translated demo; validated before shifting/writing, never mutates the caller. */
    async resetToDemo(source = demo) {
      if (!opened) await commands.load();
      return publish(await persistence.reset(demoDocument(source), revision, newId(), 'demo'));
    },

    /** Replace all data with an empty document (nothing is kept). Like resetToDemo, atomic. */
    async resetToEmpty() {
      if (!opened) await commands.load();
      return publish(await persistence.reset(emptyDocument(), revision, newId(), 'empty'));
    },
  };
  // Reject overlapping commands before executing domain operations. A double click
  // cannot append two prices, even before React renders the pending state.
  const reads = new Set(['getDocument', 'getRevision', 'getDocumentId', 'browserRecovery', 'previewImport', 'readHistory', 'recordExport', 'remindLater', 'getBackupStatus', 'getHistoryWarning', 'listHistory', 'exportJSON']);
  return Object.fromEntries(Object.entries(commands).map(([name, command]) => [name, reads.has(name) ? command : async (...args) => {
    if (inFlight) throw new StoreError('write-busy', 'A command is already in progress. Wait for it to finish.');
    inFlight = true;
    try { return await command(...args); }
    finally { inFlight = false; }
  }]));
}

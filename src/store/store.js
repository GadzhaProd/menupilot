import { instantNotAfter, isObject } from './check.js';
import { shiftDemoDates } from './demo.js';
import { StoreError } from './errors.js';
import { FORMAT_VERSION, assertValidDocument, emptyDocument } from './schema.js';

export { StoreError };
export const STORAGE_KEY = 'menupilot:v1';

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

/** Parse and validate document text from storage or from an imported file. */
function parseDocumentText(text, source) {
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
  assertValidDocument(doc);
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
 * Create the store over a localStorage-like object (getItem/setItem/removeItem).
 * Documents returned by the store are deep-frozen; every change builds a new copy
 * and replaces the stored document only after validation and a successful write.
 * @param {{getItem:Function, setItem:Function}} storage
 * @param {{now?:()=>Date|number|string, demo?:object, createId?:(prefix:string)=>string}} [options]
 *   `demo` is the parsed data/demo.json (the store itself does no file or network I/O).
 */
export function createStore(storage, { now = () => new Date(), demo = emptyDocument(), createId = randomId } = {}) {
  let current = null;
  const isoNow = () => new Date(now()).toISOString();

  function loaded() {
    if (current === null) {
      throw new StoreError('not-loaded', 'Data is not loaded yet. Call load() first, or reset to the demo data.');
    }
    return current;
  }

  /** Validate, write, and only then publish `candidate` as the current document. */
  function persist(candidate) {
    assertValidDocument(candidate);
    const text = JSON.stringify(candidate);
    try {
      storage.setItem(STORAGE_KEY, text);
    } catch (error) {
      throw writeError(error);
    }
    current = deepFreeze(JSON.parse(text));
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

  function demoDocument() {
    const doc = shiftDemoDates(demo, isoNow());
    assertValidDocument(doc);
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
    load() {
      const raw = readRaw();
      const doc = raw === null ? demoDocument() : parseDocumentText(raw, 'The saved data');
      current = deepFreeze(doc);
      return current;
    },

    getDocument: loaded,
    readRaw,

    /** Replace the whole document (validated, then written). */
    save(doc) {
      loaded();
      return persist(structuredClone(doc));
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
      return { id, document: change((draft) => upsert(draft.recipes, { ...structuredClone(recipe), id })) };
    },

    /** Delete a recipe; a prep that is still used is refused, a dish takes its scenarios with it. */
    deleteRecipe(id) {
      return change((draft) => {
        const target = findOrThrow(draft.recipes, id, 'recipe');
        refuseIfUsed(recipeUsers(draft, 'prep', id), target.name);
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
      loaded();
      return persist(parseDocumentText(text, 'The imported file'));
    },

    resetToDemo() {
      return persist(demoDocument());
    },
  };
}

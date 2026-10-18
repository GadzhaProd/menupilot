import { selectPriceAtDate } from '../calc/costing.js';

const MAX_REPORTED_ERRORS = 50;

export const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Join a path and a field name: join('recipes[1]', 'portions') -> 'recipes[1].portions'. */
export const field = (path, key) => (path ? `${path}.${key}` : key);

export function fail(errors, path, message) {
  errors.push(path ? `${path}: ${message}` : message);
}

/** Turn collected messages into the public `{ valid, errors }` result. */
export function toResult(errors) {
  const shown = errors.slice(0, MAX_REPORTED_ERRORS);
  if (errors.length > shown.length) {
    shown.push(`...and ${errors.length - shown.length} more problems`);
  }
  return { valid: errors.length === 0, errors: shown };
}

/** True for a strict ISO timestamp with time zone (same parser as the calc module). */
export function isInstant(value) {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    selectPriceAtDate([], value);
    return true;
  } catch {
    return false;
  }
}

/** True when instant `a` is the same as or earlier than `b`; both must be valid. */
export function instantNotAfter(a, b) {
  return selectPriceAtDate([{ seq: 0, recordedAt: a }], b) !== null;
}

export function checkInstant(value, path, errors) {
  if (!isInstant(value)) {
    fail(errors, path, 'must be an ISO timestamp with time zone, e.g. 2026-01-31T12:00:00Z');
    return false;
  }
  return true;
}

/** Safe integer in [min, max]; `max` defaults to Number.MAX_SAFE_INTEGER. */
export function checkInt(value, path, errors, min, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    const range = max === Number.MAX_SAFE_INTEGER ? `of at least ${min}` : `from ${min} to ${max}`;
    fail(errors, path, `must be an integer ${range}`);
    return false;
  }
  return true;
}

export function checkText(value, path, errors) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 200) {
    fail(errors, path, 'must be non-empty text of at most 200 characters');
    return false;
  }
  return true;
}

export function checkId(value, path, errors) {
  if (typeof value !== 'string' || value === '' || value.length > 100) {
    fail(errors, path, 'must be a non-empty id of at most 100 characters');
    return false;
  }
  return true;
}

/** Report fields outside `allowed`; fields set to undefined count as absent. */
export function checkKeys(object, allowed, path, errors, notAllowedHere = {}) {
  for (const key of Object.keys(object)) {
    if (object[key] === undefined || allowed.includes(key)) {
      continue;
    }
    fail(errors, field(path, key), notAllowedHere[key] ?? 'unknown field');
  }
}

export function checkArray(value, path, errors) {
  if (!Array.isArray(value)) {
    fail(errors, path, 'must be an array');
    return false;
  }
  return true;
}

export function checkUniqueIds(items, path, errors) {
  const seen = new Set();
  items.forEach((item, index) => {
    if (!isObject(item) || typeof item.id !== 'string') {
      return;
    }
    if (seen.has(item.id)) {
      fail(errors, `${path}[${index}].id`, `duplicate id '${item.id}'`);
    }
    seen.add(item.id);
  });
}

import { assertValidDocument } from './schema.js';
import { StoreError } from './errors.js';
import { isObject, checkKeys, checkId, checkInt } from './check.js';

export const SCHEMA_VERSION = 2;
const MAX_DOCUMENT_CHARS = 5_000_000;

/** Domain documents retain their independent v1 shape. The storage/backup envelope is v2. */
export function parseBackup(text, source = 'The saved data', options) {
  if (typeof text !== 'string' || text.length > MAX_DOCUMENT_CHARS) {
    throw new StoreError('invalid', `${source} is too large or not text (limit ${MAX_DOCUMENT_CHARS} characters).`);
  }
  let value;
  try { value = JSON.parse(text); }
  catch { throw new StoreError('corrupt-json', `${source} is not valid JSON.`); }
  if (isObject(value) && value.version === 1) {
    assertValidDocument(value, options);
    return { document: value, schemaVersion: 1, documentId: null, revision: 0 };
  }
  if (isObject(value) && value.version !== undefined && value.version !== SCHEMA_VERSION) {
    throw new StoreError('unsupported-version', `${source} uses data format version ${JSON.stringify(value.version)}, but this app supports versions 1 and ${SCHEMA_VERSION}.`);
  }
  if (!isObject(value) || value.version !== 2 || value.schemaVersion !== 2) {
    throw new StoreError('invalid', `${source} has an invalid storage envelope.`);
  }
  const errors = [];
  checkKeys(value, ['version', 'schemaVersion', 'documentId', 'revision', 'document'], '', errors);
  checkId(value.documentId, 'documentId', errors);
  checkInt(value.revision, 'revision', errors, 0);
  if (errors.length) throw new StoreError('invalid', `${source} has invalid revision metadata.`, errors);
  assertValidDocument(value.document, options);
  return { document: value.document, schemaVersion: 2, documentId: value.documentId, revision: value.revision };
}

export function serializeBackup({ document, documentId, revision }, pretty = false) {
  const value = { version: SCHEMA_VERSION, schemaVersion: SCHEMA_VERSION, documentId, revision, document };
  const text = JSON.stringify(value, null, pretty ? 2 : undefined);
  parseBackup(text); // Same validation on every transport boundary.
  return text;
}

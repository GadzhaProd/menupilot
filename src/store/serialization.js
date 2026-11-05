import { assertValidDocument } from './schema.js';
import { StoreError } from './errors.js';
import { isObject, checkKeys, checkId, checkInt } from './check.js';

// Envelope version is independent of document.version (the domain schema).
export const SCHEMA_VERSION = 2;
// Compact domain JSON, measured in UTF-16 code units (String.length). Identity,
// revision and bounded operation receipts must not consume the document budget.
export const MAX_DOCUMENT_CHARS = 5_000_000;
export const MAX_BACKUP_CHARS = MAX_DOCUMENT_CHARS + 30_000;
function checkDocumentBudget(document) {
  if (JSON.stringify(document).length > MAX_DOCUMENT_CHARS) {
    throw new StoreError('invalid', `The document is too large (limit ${MAX_DOCUMENT_CHARS} UTF-16 code units).`);
  }
}

/** Domain documents retain their independent v1 shape. The storage/backup envelope is v2. */
export function parseBackup(text, source = 'The saved data', options) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_CHARS) {
    throw new StoreError('invalid', `${source} is too large or not text (limit ${MAX_BACKUP_CHARS} UTF-16 code units including metadata).`);
  }
  let value;
  try { value = JSON.parse(text); }
  catch { throw new StoreError('corrupt-json', `${source} is not valid JSON.`); }
  if (isObject(value) && value.version === 1) {
    assertValidDocument(value, options);
    checkDocumentBudget(value);
    return { document: value, schemaVersion: 1, documentId: null, revision: 0 };
  }
  if (isObject(value) && value.version !== undefined && value.version !== SCHEMA_VERSION) {
    throw new StoreError('unsupported-version', `${source} uses data format version ${JSON.stringify(value.version)}, but this app supports versions 1 and ${SCHEMA_VERSION}.`);
  }
  if (!isObject(value) || value.version !== 2 || value.schemaVersion !== 2) {
    throw new StoreError('invalid', `${source} has an invalid storage envelope.`);
  }
  const errors = [];
  checkKeys(value, ['version', 'schemaVersion', 'documentId', 'revision', 'document', 'operationIds'], '', errors);
  checkId(value.documentId, 'documentId', errors);
  checkInt(value.revision, 'revision', errors, 0);
  if (value.operationIds !== undefined && (!Array.isArray(value.operationIds) || value.operationIds.length > 128 || value.operationIds.some(id => typeof id !== 'string' || !id || id.length > 200))) errors.push('Invalid operation receipts.');
  if (errors.length) throw new StoreError('invalid', `${source} has invalid revision metadata.`, errors);
  assertValidDocument(value.document, options);
  checkDocumentBudget(value.document);
  return { document: value.document, schemaVersion: 2, documentId: value.documentId, revision: value.revision, ...(value.operationIds && { operationIds: value.operationIds }) };
}

// Callers serialize validated records; parsing belongs only to input boundaries.
export function serializeBackup({ document, documentId, revision, operationIds }, pretty = false) {
  checkDocumentBudget(document);
  const value = { version: SCHEMA_VERSION, schemaVersion: SCHEMA_VERSION, documentId, revision, document, ...(operationIds && { operationIds }) };
  const source = documentId === null ? document : value;
  let text = JSON.stringify(source, null, pretty ? 2 : undefined);
  if (pretty && text.length > MAX_BACKUP_CHARS) text = JSON.stringify(source);
  if (text.length > MAX_BACKUP_CHARS) throw new StoreError('invalid', `The backup is too large (limit ${MAX_BACKUP_CHARS} UTF-16 code units including metadata).`);
  return text;
}

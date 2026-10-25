/**
 * Error thrown by the store and by assertValidDocument.
 * `code` is one of: corrupt-json, unsupported-version, invalid, read-failed,
 * write-failed, quota, in-use, not-found, not-loaded, bad-options, conflict,
 * write-busy, write-unavailable. `details` lists every
 * validation message when code is "invalid" (or "unsupported-version").
 * @property {Array<{path: string, code: string, entityKind: string, entityId?: string, entityName?: string, relatedNames?: string[], relatedId?: string}>} structuredDetails
 */
export class StoreError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {string[]} [details]
   * @param {Array<{path: string, code: string, entityKind: string, entityId?: string, entityName?: string, relatedNames?: string[], relatedId?: string}>} [structuredDetails]
   */
  constructor(code, message, details = [], structuredDetails = []) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
    this.details = details;
    /** @type {Array<{path: string, code: string, entityKind: string, entityId?: string, entityName?: string, relatedNames?: string[], relatedId?: string}>} */
    this.structuredDetails = structuredDetails;
  }
}

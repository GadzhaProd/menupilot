/**
 * Error thrown by the store and by assertValidDocument.
 * `code` is one of: corrupt-json, unsupported-version, invalid, read-failed,
 * write-failed, quota, in-use, not-found, not-loaded, bad-options. `details` lists every
 * validation message when code is "invalid" (or "unsupported-version").
 */
export class StoreError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
    this.details = details;
  }
}

declare module '@/store/serialization.js' {
  export const SCHEMA_VERSION: 2;
  export function parseBackup(text: string, source?: string, options?: { now?: string }): import('./storageAdapter').StoredDocument;
  export function serializeBackup(value: import('./storageAdapter').StoredDocument, pretty?: boolean): string;
}
declare module '@/store/browserAdapter.js' {
  export function createBrowserStorageAdapter(storage: import('@/ui/domain/store').StorageLike, options: { initialDocument: import('@/ui/domain/types').MenuDocument; now?: () => Date | string | number; locks?: LockManager | null }): import('./storageAdapter').StorageAdapter;
}

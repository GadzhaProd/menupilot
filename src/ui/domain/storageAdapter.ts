import type { MenuDocument } from './types';
import type { HistoryEntry, BackupStatus } from './storeHistory';
export interface StoredDocument {
  readonly document: MenuDocument;
  readonly schemaVersion: number;
  readonly documentId: string | null;
  readonly revision: number;
}
export interface Conflict {
  readonly conflict: true;
  readonly revision: number;
  readonly documentId: string | null;
  readonly document?: MenuDocument;
}
export type WriteResult = StoredDocument | Conflict;
/** Inputs are validated by the common store. Server implementations validate at their boundary too.
 * load establishes the expected dataset identity; transports send it with expectedRevision.
 * The adapter/server owns identity. Revisions increase within a documentId.
 * Replaying opId returns latest committed state without applying the operation again.
 */
export interface StorageAdapter {
  load(options?: { beforeReplace?: (document: MenuDocument) => void }): Promise<StoredDocument>;
  save(document: MenuDocument, expectedRevision: number, opId: string): Promise<WriteResult>;
  importDocument(source: StoredDocument, expectedRevision: number, opId: string): Promise<WriteResult>;
  reset(document: MenuDocument, expectedRevision: number, opId: string, kind: 'empty' | 'demo'): Promise<WriteResult>;
  history: {
    list(): Promise<readonly HistoryEntry[]>;
    read(id: string): Promise<StoredDocument>;
    restore(id: string, expectedRevision: number, opId: string): Promise<WriteResult>;
  };
  saveMemoryAsNew(document: MenuDocument, opId: string): Promise<WriteResult>;
  subscribe?(changed: () => void): () => void;
}
/** Optional browser integration, not part of the transport contract. */
export interface BrowserRecovery {
  readRaw(): string | null;
  getRaw(): string | null | undefined;
  loadForRecovery(): Promise<StoredDocument>;
  migrationSource(): string | null;
  confirmMigrationDownload(raw: string): void;
}
export interface BrowserStorageAdapter extends StorageAdapter {
  browserRecovery: BrowserRecovery;
  browserMetadata: {
    getHistoryWarning(): boolean;
    getBackupStatus(): BackupStatus;
    recordExport(): Promise<void>;
    remindLater(): Promise<void>;
  };
}

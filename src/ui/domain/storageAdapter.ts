import type { MenuDocument } from './types';
import type { HistoryEntry, BackupStatus } from './storeHistory';

export interface StoredDocument {
  readonly document: MenuDocument;
  readonly schemaVersion: number;
  readonly documentId: string | null;
  readonly revision: number;
}
export interface SaveOptions {
  readonly checkFuture?: boolean;
  readonly requireHistory?: boolean;
  readonly force?: boolean;
  readonly ownData?: boolean;
  readonly documentId?: string;
}
/** Errors reject with StoreError, including code=conflict. Publication follows durability. */
export interface StorageAdapter {
  load(options?: { recovery?: boolean; beforeReplace?: (document: MenuDocument) => void }): Promise<StoredDocument>;
  save(document: MenuDocument, expectedRevision: number, options?: SaveOptions): Promise<StoredDocument>;
  history: {
    list(): Promise<readonly HistoryEntry[]>;
    read(id: string): Promise<StoredDocument>;
    restore(id: string, expectedRevision: number): Promise<StoredDocument>;
  };
  exportBackup(): Promise<string>;
  importBackup(text: string, expectedRevision: number): Promise<StoredDocument>;
  saveMemoryAsNew(document: MenuDocument): Promise<StoredDocument>;
  /** Browser recovery/notification capabilities; remote adapters can omit these. */
  readRaw?(): string | null;
  getRaw?(): string | null | undefined;
  getHistoryWarning?(): boolean;
  getBackupStatus?(): BackupStatus;
  recordExport?(): Promise<void>;
  remindLater?(): Promise<void>;
  subscribe?(changed: () => void): () => void;
}

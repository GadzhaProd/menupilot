import type { MenuDocument } from '@/ui/domain/types';
import '@/store/store.js';

export interface HistoryEntry { readonly id: string; readonly order: number; readonly savedAt: string }
export interface BackupStatus { readonly startedAt: string | null; readonly lastExportAt: string | null; readonly due: boolean }
declare module '@/store/store.js' {
  interface StorageLike { removeItem?(key: string): void }
  interface Store {
    readHistory(id: string): Promise<import('./storageAdapter').StoredDocument>;
    listHistory(): Promise<readonly HistoryEntry[]>;
    getHistoryWarning(): boolean;
    restoreHistory(id: string): Promise<MenuDocument>;
    saveMemoryAsNew(): Promise<MenuDocument>;
    getBackupStatus(): BackupStatus;
    recordExport(): Promise<void>;
    remindLater(): Promise<void>;
  }
}

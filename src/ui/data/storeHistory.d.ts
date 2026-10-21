import type { MenuDocument } from '@/ui/domain/types';
import '@/store/store.js';

export interface HistoryEntry { readonly id: string; readonly order: number; readonly savedAt: string; readonly raw: string }
export interface BackupStatus { readonly startedAt: string | null; readonly lastExportAt: string | null; readonly due: boolean }
// Kept with this feature so the existing domain boundary remains unchanged.
declare module '@/store/store.js' {
  interface StorageLike { removeItem?(key: string): void }
  interface Store {
    listHistory(): readonly HistoryEntry[];
    getHistoryWarning(): boolean;
    restoreHistory(id: string): MenuDocument;
    saveMemoryAsNew(): MenuDocument;
    getBackupStatus(): BackupStatus;
    recordExport(): void;
  }
}

declare module '@/store/writeAccess.js' {
  export interface WriteAccess {
    acquire(): Promise<void>;
    release(): void;
    assertWritable(): void;
  }
  export function createWriteAccess(locks: LockManager | null, onChange?: (held: boolean) => void): WriteAccess;
}

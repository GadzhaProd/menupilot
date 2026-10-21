declare module '@/store/writeAccess.js' {
  export const WRITE_LOCK: string;
  export function withWriteLock<T>(locks: LockManager | null | undefined, work: () => T | Promise<T>): Promise<T>;
}

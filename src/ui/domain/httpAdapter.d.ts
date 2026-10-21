declare module '@/store/httpAdapter.js' {
  export function createHttpStorageAdapter(options: {
    token: string;
    baseUrl?: string;
    pollMs?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    onConnectionChange?: (status: 'offline' | 'session-expired' | null) => void;
  }): import('./storageAdapter').StorageAdapter;
}

import { StoreError } from './errors.js';
import { createRemoteAdapter } from './remoteAdapter.js';

/** Retries only transport errors, using one immutable encoded request and opId. */
export function createHttpStorageAdapter({ baseUrl = '', token, fetchImpl = globalThis.fetch,
  pollMs = 2000, retryDelayMs = 150, timeoutMs = 8000, onConnectionChange = () => {} }) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new StoreError('local-config', 'Invalid local server configuration. Restart MenuPilot and reload this page.');
  return createRemoteAdapter(async (route, body) => {
    const encoded = body === undefined ? undefined : JSON.stringify(body);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetchImpl(`${baseUrl}/api/${route}`, { method: encoded === undefined ? 'GET' : 'POST',
          headers: { Authorization: `Bearer ${token}`, ...(encoded === undefined ? {} : { 'Content-Type': 'application/json' }) },
          body: encoded, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
        const result = await res.json();
        if (!res.ok) throw new StoreError(result.code ?? 'server-error', result.message ?? 'The local server rejected the request.', result.details ?? []);
        onConnectionChange(null);
        return result;
      } catch (error) {
        if (error instanceof StoreError) { if (error.code === 'session-expired') onConnectionChange(error.code); throw error; }
        if (attempt === 2) {
          onConnectionChange('offline');
          throw new StoreError('connection-failed', 'Cannot reach the local MenuPilot server. Keep this page open and start npm start. Your drafts remain here. A change may already have been saved; reload the latest data before submitting again.');
        }
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt + 1)));
      }
    }
  }, { pollMs });
}

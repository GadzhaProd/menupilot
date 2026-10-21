import { createContext, useContext } from 'react';

export interface LocalConfig {
  readonly mode: 'local';
  readonly apiVersion: 1;
  readonly token: string;
  readonly dataDir: string;
}
export function readLocalConfig(): LocalConfig | null {
  const marker = document.querySelector('meta[name="menupilot-mode"]');
  const element = document.getElementById('menupilot-local-config');
  if (!marker && !element) return null;
  try {
    const value: unknown = JSON.parse(element?.textContent ?? '');
    if (marker?.getAttribute('content') !== 'local' || !value || typeof value !== 'object') throw new Error();
    const config = value as Partial<LocalConfig>;
    if (config.mode !== 'local' || config.apiVersion !== 1 || typeof config.token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(config.token) || typeof config.dataDir !== 'string' || !config.dataDir.startsWith('/')) throw new Error();
    return config as LocalConfig;
  } catch { throw new Error('Invalid local server configuration. Restart MenuPilot and reload this page.'); }
}
/** Bearer-authorized config is fetched only for server-marked HTML. */
export async function loadLocalConfig(): Promise<LocalConfig | null> {
  if (!document.querySelector('meta[name="menupilot-mode"]') || document.getElementById('menupilot-local-config')) return readLocalConfig();
  try {
    const token = sessionStorage.getItem('menupilot.local.token.v1');
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new Error();
    const response = await fetch('/menupilot/local-config.json', { headers: { Authorization: `Bearer ${token}` }, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error();
    const config = { ...await response.json(), token } as Partial<LocalConfig>;
    if (config.mode !== 'local' || config.apiVersion !== 1 || typeof config.token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(config.token) || typeof config.dataDir !== 'string' || !config.dataDir.startsWith('/')) throw new Error();
    return config as LocalConfig;
  } catch { throw new Error('Invalid local server configuration. Open the address from npm run menupilot -- open-url.'); }
}
export type ConnectionState = 'offline' | 'session-expired' | null;
export const LocalModeContext = createContext<{ dataDir: string; connection: ConnectionState } | null>(null);
export const useLocalMode = () => useContext(LocalModeContext);

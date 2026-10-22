import { createContext, useContext } from 'react';
import { LOCALE_KEY } from '@/ui/i18n/preferences';

export interface LocalConfig {
  readonly mode: 'local';
  readonly apiVersion: 1;
  readonly token: string;
  readonly dataDir: string;
}
function uiLocale(): 'en' | 'nl' {
  if (document.documentElement.lang === 'nl') return 'nl';
  try { if (localStorage.getItem(LOCALE_KEY) === 'nl') return 'nl'; } catch { /* use English when browser storage is unavailable */ }
  return 'en';
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
  let missingSessionToken = false;
  try {
    const token = sessionStorage.getItem('menupilot.local.token.v1');
    if (!token) { missingSessionToken = true; throw new Error(); }
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error();
    const response = await fetch('/menupilot/local-config.json', { headers: { Authorization: `Bearer ${token}` }, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error();
    const config = { ...await response.json(), token } as Partial<LocalConfig>;
    if (config.mode !== 'local' || config.apiVersion !== 1 || typeof config.token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(config.token) || typeof config.dataDir !== 'string' || !config.dataDir.startsWith('/')) throw new Error();
    return config as LocalConfig;
  } catch {
    if (missingSessionToken) throw new Error(uiLocale() === 'nl'
      ? 'MenuPilot is al geopend in een ander tabblad. Open het hier met npm run menupilot -- open-url.'
      : 'MenuPilot is already open in another tab. To open it here, run npm run menupilot -- open-url.');
    throw new Error(document.documentElement.lang === 'nl'
      ? 'MenuPilot is opnieuw gestart. Open het opnieuw met npm run menupilot -- open-url.'
      : 'MenuPilot was restarted. Open it again with npm run menupilot -- open-url.');
  }
}
export type ConnectionState = 'offline' | 'session-expired' | null;
export const LocalModeContext = createContext<{ dataDir: string; token?: string; connection: ConnectionState } | null>(null);
export const useLocalMode = () => useContext(LocalModeContext);

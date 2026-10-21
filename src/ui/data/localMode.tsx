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
export type ConnectionState = 'offline' | 'session-expired' | null;
export const LocalModeContext = createContext<{ dataDir: string; connection: ConnectionState } | null>(null);
export const useLocalMode = () => useContext(LocalModeContext);

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/** The capability URL goes only to the OS browser launcher, never to CLI or logs. */
export async function openBrowser(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'linux' ? 'xdg-open' : null;
  if (!command) return false;
  try {
    await promisify(execFile)(command, [url], { timeout: 5000, maxBuffer: 4096 });
    return true;
  } catch { return false; }
}

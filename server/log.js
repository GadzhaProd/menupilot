import { mkdirSync, statSync, renameSync, appendFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
const ranks = { off: 0, error: 1, warn: 2, info: 3 };
/** Deliberately accepts no URL, headers, payload, error text or other free text. */
export function createLogger(dir, { level = process.env.MENUPILOT_LOG_LEVEL ?? 'info', maxBytes = 1024 * 1024, files = 3 } = {}) {
  if (!(level in ranks)) throw new Error('MENUPILOT_LOG_LEVEL must be off, error, warn or info.');
  const root = join(dir, 'logs'); mkdirSync(root, { recursive: true, mode: 0o700 }); chmodSync(root, 0o700);
  const path = join(root, 'server.log');
  function size(file) { try { return statSync(file).size; } catch (e) { if (e.code === 'ENOENT') return 0; throw e; } }
  return (event, status) => {
    if (!['started', 'stopped', 'request'].includes(event)) return;
    if (event === 'request' && (!Number.isInteger(status) || status < 100 || status > 599)) return;
    const severity = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    if (ranks[severity] > ranks[level]) return;
    const line = JSON.stringify({ at: new Date().toISOString(), level: severity, event, ...(event === 'request' && { status }) }) + '\n';
    try {
      if (size(path) + Buffer.byteLength(line) > maxBytes) {
        for (let i = files - 1; i >= 1; i--) {
          const from = i === 1 ? path : `${path}.${i - 1}`;
          if (size(from)) renameSync(from, `${path}.${i}`);
        }
      }
      appendFileSync(path, line, { mode: 0o600 }); chmodSync(path, 0o600);
    } catch { /* Diagnostics must never turn a committed write into an apparent failure. */ }
  };
}

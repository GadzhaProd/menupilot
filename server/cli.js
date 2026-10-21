import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertRuntime } from './runtime.js';

try {
  assertRuntime();
  const args = process.argv.slice(2);
  if (args[0] !== 'open-url' || args.length > 2 || (args[1] !== undefined && args[1] !== '--revoke-sessions')) throw new Error('Usage: npm run menupilot -- open-url [--revoke-sessions]');
  const { canonicalDataDir } = await import('./lock.js');
  const dir = canonicalDataDir();
  const owner = JSON.parse(readFileSync(join(dir, 'lock'), 'utf8'));
  if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(owner.address)) throw new Error();
  const response = await fetch(owner.address + '/menupilot-instance', { signal: AbortSignal.timeout(1500), redirect: 'error' });
  const instance = await response.json();
  if (!response.ok || instance.instanceId !== owner.instanceId) throw new Error();
  const token = readFileSync(join(dir, 'token'), 'utf8');
  const issued = await fetch(owner.address + '/api/open-url', { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ revokeSessions: args[1] === '--revoke-sessions' }),
    signal: AbortSignal.timeout(1500), redirect: 'error' });
  if (!issued.ok) throw new Error();
  const { url } = await issued.json();
  if (typeof url !== 'string' || !url.startsWith(owner.address + '/menupilot/#k=')) throw new Error();
  console.log(url);
} catch (error) {
  console.error(error.message?.startsWith('Usage:') ? error.message : 'MenuPilot is unavailable. Run npm start, then try open-url again.');
  process.exitCode = 1;
}

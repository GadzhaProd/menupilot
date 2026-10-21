import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertRuntime } from './runtime.js';

try {
  assertRuntime();
  if (process.argv.slice(2).join(' ') !== 'open-url') throw new Error('Usage: npm run menupilot -- open-url');
  const { canonicalDataDir } = await import('./lock.js');
  const dir = canonicalDataDir();
  const owner = JSON.parse(readFileSync(join(dir, 'lock'), 'utf8'));
  if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(owner.address)) throw new Error();
  const response = await fetch(owner.address + '/menupilot-instance', { signal: AbortSignal.timeout(1500), redirect: 'error' });
  const instance = await response.json();
  if (!response.ok || instance.instanceId !== owner.instanceId) throw new Error();
  const key = readFileSync(join(dir, 'launch-secret'), 'utf8');
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error();
  console.log(`${owner.address}/menupilot/#k=${key}`);
} catch (error) {
  console.error(error.message?.startsWith('Usage:') ? error.message : 'MenuPilot is unavailable. Run npm start, then try open-url again.');
  process.exitCode = 1;
}

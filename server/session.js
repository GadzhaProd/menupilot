import { randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';
import { openSync, writeFileSync, fsyncSync, closeSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export const tokenMatches = (given, expected) => typeof given === 'string' && /^[a-f0-9]{64}$/.test(given) && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
export function privateFile(dir, name, content) {
  const temporary = join(dir, `${name}.${randomUUID()}`), fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, content); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, join(dir, name));
}
export function createSession(dir) {
  let key;
  const cookie = randomBytes(32).toString('hex');
  function rotate() {
    const next = randomBytes(32).toString('hex');
    privateFile(dir, 'launch-secret', next);
    key = next;
  }
  rotate();
  return {
    get key() { return key; },
    hasCookie(req, name) {
      const values = (req.headers.cookie ?? '').split(';').map(s => s.trim()).filter(s => s.startsWith(name + '='));
      return values.length === 1 && tokenMatches(values[0].slice(name.length + 1), cookie);
    },
    exchange(given, name) {
      if (!tokenMatches(given, key)) return null;
      rotate(); // Invalidate before responding; no replay, even concurrent requests.
      return `${name}=${cookie}; HttpOnly; SameSite=Strict; Path=/menupilot/`;
    },
  };
}

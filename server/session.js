import { randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';
import { openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export const tokenMatches = (given, expected) => typeof given === 'string' && /^[a-f0-9]{64}$/.test(given) && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
export function privateFile(dir, name, content) {
  const temporary = join(dir, `${name}.${randomUUID()}`), fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, content); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, join(dir, name));
}
export const SESSION_ABSOLUTE_MS = 10 * 60 * 60_000;
export const SESSION_IDLE_MS = 60 * 60_000;
export const LAUNCH_TTL_MS = 15 * 60_000;
export function createSession(dir, now = Date.now) {
  // Remove the obsolete D2 launch file; current keys live only in memory.
  try { unlinkSync(join(dir, 'launch-secret')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let key, issuedAt;
  const sessions = new Map();
  function rotate(revokeSessions = false) {
    const next = randomBytes(32).toString('hex');
    key = next; issuedAt = now();
    if (revokeSessions) sessions.clear();
    return key;
  }
  function valid(record) {
    return now() - record.createdAt < SESSION_ABSOLUTE_MS && now() - record.lastUsed < SESSION_IDLE_MS;
  }
  function prune() {
    for (const [token, record] of sessions) if (!valid(record)) sessions.delete(token);
  }
  rotate();
  return {
    get key() { return key; }, rotate,
    authorize(token) {
      prune();
      const record = sessions.get(token);
      if (!record) return false;
      record.lastUsed = now(); return true;
    },
    hasCookie(req, name) {
      prune();
      const values = (req.headers.cookie ?? '').split(';').map(s => s.trim()).filter(s => s.startsWith(name + '='));
      return values.length === 1 && [...sessions.values()].some(record => tokenMatches(values[0].slice(name.length + 1), record.cookie));
    },
    exchange(given, name) {
      if (!tokenMatches(given, key) || now() - issuedAt >= LAUNCH_TTL_MS) return null;
      rotate(); // Invalidate before responding; no replay, even concurrent requests.
      prune();
      if (sessions.size >= 128) sessions.delete(sessions.keys().next().value);
      const token = randomBytes(32).toString('hex'), cookie = randomBytes(32).toString('hex');
      sessions.set(token, { cookie, createdAt: now(), lastUsed: now() });
      return { token, cookie: `${name}=${cookie}; HttpOnly; SameSite=Strict; Path=/menupilot/; Max-Age=${SESSION_ABSOLUTE_MS / 1000}` };
    },
  };
}

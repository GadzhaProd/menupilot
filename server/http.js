import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, lstatSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { createSession, tokenMatches } from './session.js';
import { createLogger } from './log.js';
import { StoreError } from '../src/store/errors.js';

// 5m UTF-16 code units can require 15m UTF-8 bytes; leave room for envelope/CAS.
export const MAX_BODY_BYTES = 15_100_000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff' };
function staticFiles(root) {
  const files = new Map();
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name), stat = lstatSync(path);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile() && MIME[extname(name)] && !name.endsWith('.map')) files.set('/menupilot/' + relative(root, path).split('\\').join('/'), { type: MIME[extname(name)], body: readFileSync(path) });
    }
  }
  walk(root); return files;
}
async function jsonBody(req, maxBytes = MAX_BODY_BYTES) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw Object.assign(new StoreError('content-type', 'Use application/json.'), { status: 415 });
  if (Number(req.headers['content-length']) > maxBytes) throw Object.assign(new StoreError('body-too-large', 'The request is too large.'), { status: 413 });
  let size = 0; const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new StoreError('body-too-large', 'The request is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  if (req.expired) throw Object.assign(new StoreError('timeout', 'Request timed out.'), { status: 408 });
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new StoreError('invalid', 'The request must contain valid JSON.'); }
}
function send(res, status, value) {
  const body = JSON.stringify(value);
  res.denialCode = value?.code;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

export function handleRequestError(req, res, error) {
  try {
    if (res.writableEnded) return;
    if (res.headersSent) { res.destroy(); return; }
    if (!req.complete || error?.status === 413) res.setHeader('Connection', 'close');
    send(res, error?.status ?? (error instanceof StoreError ? 400 : 500), {
      code: error instanceof StoreError ? error.code : 'server-error',
      message: error instanceof StoreError ? error.message : 'Local server could not complete the request.',
      details: error instanceof StoreError ? error.details : [],
    });
  } catch { try { res.destroy(); } catch { /* Broken response cannot be reported again. */ } }
}

export function dispatchRequest(handle, req, res) {
  void handle(req, res).catch(error => handleRequestError(req, res, error));
}

/** No arbitrary filesystem paths or arbitrary adapter method dispatch are accepted. */
export async function serveLocal({ storage, dataDir, distDir, port, instanceId = randomUUID(), cliToken = randomBytes(32).toString('hex'), limits = {}, now = Date.now }) {
  const session = createSession(dataDir, now), log = createLogger(dataDir);
  const policy = { headersMs: 10000, bodyMs: 15000, keepAliveMs: 5000, connections: 32, ...limits };
  const loginPage = readFileSync(new URL('./login.html', import.meta.url));
  const loginScript = readFileSync(new URL('./login.js', import.meta.url));
  const headerTimers = new Map();
  const root = realpathSync(distDir), files = staticFiles(root);
  // Preserve the existing synchronous appearance bootstrap without allowing inline JS.
  // Sources come only from our trusted build, never a request or stored document.
  const bootstraps = new Map();
  const template = readFileSync(join(root, 'index.html'), 'utf8').replace(/<script>([\s\S]*?)<\/script>/g, (_tag, script) => {
    const path = `/menupilot/bootstrap-${bootstraps.size}.js`;
    bootstraps.set(path, script);
    return `<script src="${path}"></script>`;
  });
  let address;
  // EventEmitter does not observe async listener rejections. Contain even errors
  // thrown while producing an error response, rather than terminating the writer.
  const server = createServer((req, res) => {
    dispatchRequest(handle, req, res);
  });
  async function handle(req, res) {
    clearTimeout(headerTimers.get(req.socket));
    headerTimers.delete(req.socket);
    const deadline = setTimeout(() => {
      req.expired = true;
      if (!res.headersSent) { res.setHeader('Connection', 'close'); send(res, 408, { code: 'timeout', message: 'Request timed out.' }); }
      else res.destroy();
    }, policy.bodyMs);
    deadline.unref();
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => { clearTimeout(deadline); log('request', res.statusCode, res.denialCode); if (!req.socket.destroyed) armHeaders(req.socket); });
    res.on('close', () => clearTimeout(deadline));
    try {
      const host = new URL(address).host;
      if (req.headers.host === `localhost:${server.address().port}` && (req.method === 'GET' || req.method === 'HEAD') && ['/', '/menupilot', '/menupilot/'].includes(req.url)) {
        res.denialCode = 'host';
        res.writeHead(403, { 'Content-Type': MIME['.html'] });
        res.end(req.method === 'HEAD' ? undefined : `<!doctype html><html lang="en"><title>MenuPilot</title><h1>Use 127.0.0.1</h1><p>Open ${address}/menupilot/ and use the sign-in address from your terminal.</p><p lang="nl">Gebruik 127.0.0.1 en het aanmeldadres uit je terminal.</p></html>`); return;
      }
      if (req.headers.host !== host) { send(res, 403, { code: 'host', message: 'Invalid Host.' }); return; }
      const url = new URL(req.url, address);
      if (url.origin !== address) { send(res, 403, { code: 'host', message: 'Invalid request target.' }); return; }
      const path = url.pathname;
      if (req.headers.origin !== undefined && req.headers.origin !== address) { send(res, 403, { code: 'origin', message: 'Invalid Origin.' }); return; }
      const cookieName = `menupilot_session_${server.address().port}`;
      if (path === '/menupilot/session' && req.method === 'POST') {
        if (req.headers.origin !== address) { send(res, 403, { code: 'origin', message: 'Same-origin sign-in required.' }); return; }
        const body = await jsonBody(req, 1024);
        const exchanged = session.exchange(body?.key, cookieName);
        if (!exchanged) { send(res, 401, { code: 'sign-in', message: 'Open a new address from the terminal.' }); return; }
        res.setHeader('Set-Cookie', exchanged.cookie); send(res, 200, { token: exchanged.token }); return;
      }
      if (path === '/menupilot/local-config.json' && req.method === 'GET') {
        if (!session.authorize(req.headers.authorization?.replace(/^Bearer /, ''))) { send(res, 401, { code: 'session-expired', message: 'Open the address from the terminal.' }); return; }
        send(res, 200, { mode: 'local', apiVersion: 1, dataDir }); return;
      }
      if (req.method === 'GET' && bootstraps.has(path)) {
        res.writeHead(200, { 'Content-Type': MIME['.js'] }); res.end(bootstraps.get(path)); return;
      }
      if (path === '/menupilot/login.js' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': MIME['.js'] }); res.end(loginScript); return;
      }
      if (req.method === 'GET' && path === '/menupilot-instance') { send(res, 200, { service: 'MenuPilot', instanceId }); return; }
      if (path.startsWith('/api/')) {
        const token = req.headers.authorization?.replace(/^Bearer /, '');
        const source = session.authorize(token) ? 'ui' : tokenMatches(token, cliToken) ? 'cli' : null;
        if (!source) { send(res, 401, { code: 'session-expired', message: 'The local server session changed. Copy any unsaved drafts, then reload this page.' }); return; }
        if (req.method !== 'GET' && req.headers.origin !== address && source !== 'cli') { send(res, 403, { code: 'origin', message: 'Same-origin request required.' }); return; }
        let value;
        if (req.method === 'POST' && path === '/api/open-url') {
          if (source !== 'cli') { send(res, 403, { code: 'cli-required', message: 'Use open-url in your terminal.' }); return; }
          const body = await jsonBody(req, 1024);
          if (!body || Array.isArray(body) || Object.keys(body).some(k => k !== 'revokeSessions') || (body.revokeSessions !== undefined && typeof body.revokeSessions !== 'boolean')) throw new StoreError('invalid', 'Invalid open-url options.');
          const key = session.rotate(body.revokeSessions === true);
          value = { url: `${address}/menupilot/#k=${key}` };
        }
        else if (req.method === 'GET' && path === '/api/backups/status' && storage.backups) value = storage.backups.status();
        else if (req.method === 'GET' && path === '/api/backups' && storage.backups) value = storage.backups.list();
        else if (req.method === 'POST' && ['/api/backups/verify', '/api/backups/restore'].includes(path) && storage.backups) {
          const body = await jsonBody(req, 2048);
          clearTimeout(deadline); // Body arrived; SQLite work has its own durable outcome.
          if (path.endsWith('/verify')) {
            if (!body || typeof body.id !== 'string' || Object.keys(body).length !== 1) throw new StoreError('invalid', 'Provide a backup ID.');
            const checked = await storage.backups.verify(body.id);
            value = { verified: true, ...checked.metadata };
          } else {
            if (source !== 'cli') { send(res, 403, { code: 'cli-required', message: 'Use backup restore in your terminal.' }); return; }
            value = await storage.backups.restore(body, source);
          }
        }
        else if (req.method === 'GET' && path === '/api/document') value = storage.load();
        else if (req.method === 'GET' && path === '/api/version') value = storage.version();
        else if (req.method === 'GET' && path === '/api/history') value = storage.history.list();
        else if (req.method === 'GET' && path === '/api/journal' && storage.journal) value = storage.journal.list();
        else if (req.method === 'GET' && path === '/api/local/status') value = { dataDir, databaseVersion: storage.db?.prepare('PRAGMA user_version').get().user_version ?? null };
        else if (req.method === 'POST' && path === '/api/history/read') {
          const body = await jsonBody(req);
          if (!body || Array.isArray(body) || typeof body.id !== 'string' || !body.id || Object.keys(body).length !== 1) throw new StoreError('invalid', 'Provide a history entry ID.');
          value = storage.history.read(body.id);
        }
        else if (req.method === 'POST' && path === '/api/write') {
          // Future CLI writes must use D5 proposals and owner approval, never raw saves.
          if (source !== 'ui') { send(res, 403, { code: 'ui-required', message: 'Changes require the MenuPilot window.' }); return; }
          const body = await jsonBody(req);
          clearTimeout(deadline);
          if (body?.kind === 'backup-restore') throw new StoreError('invalid', 'Use the backup restore command.');
          value = await storage.write(body, source);
        } else { send(res, 404, { code: 'not-found', message: 'Unknown API route or method.' }); return; }
        send(res, 200, value); return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, { code: 'method', message: 'Method not allowed.' }); return; }
      if (path === '/' || path === '/menupilot') { res.writeHead(302, { Location: '/menupilot/', 'Cache-Control': 'no-store' }); res.end(); return; }
      if (path === '/menupilot/' || path === '/menupilot/index.html') {
        const html = session.hasCookie(req, cookieName)
          ? template.replace('<head>', () => '<head><meta name="menupilot-mode" content="local"><script src="/menupilot/login.js" defer></script>') : loginPage;
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(req.method === 'HEAD' ? undefined : html); return;
      }
      const file = files.get(path);
      if (!file || file.type === MIME['.html']) { send(res, 404, { code: 'not-found', message: 'File not found.' }); return; }
      res.writeHead(200, { 'Content-Type': file.type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : file.body);
    } catch (error) { handleRequestError(req, res, error); }
  }
  function armHeaders(socket) {
    clearTimeout(headerTimers.get(socket));
    const timer = setTimeout(() => {
      headerTimers.delete(socket);
      socket.end('HTTP/1.1 408 Request Timeout\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      socket.destroySoon();
    }, policy.headersMs);
    timer.unref(); headerTimers.set(socket, timer);
  }
  server.maxConnections = policy.connections;
  server.maxRequestsPerSocket = 100;
  server.requestTimeout = policy.bodyMs; server.headersTimeout = Math.min(policy.headersMs, policy.bodyMs); server.keepAliveTimeout = policy.keepAliveMs;
  server.on('connection', socket => {
    armHeaders(socket);
    socket.on('close', () => { clearTimeout(headerTimers.get(socket)); headerTimers.delete(socket); });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  address = `http://127.0.0.1:${server.address().port}`;
  log('started');
  let closing;
  return { address, cliToken, get openUrl() { return `${address}/menupilot/#k=${session.key}`; },
    close() {
      return closing ??= new Promise((resolve, reject) => {
        // Unfinished bodies/keep-alive clients cannot hold the writer lock forever.
        // SQLite writes are synchronous, so no transaction can be interrupted here.
        const deadline = setTimeout(() => server.closeAllConnections(), 1000);
        deadline.unref();
        server.close(error => { clearTimeout(deadline); log('stopped'); error ? reject(error) : resolve(); });
        server.closeIdleConnections();
      });
    },
  };
}

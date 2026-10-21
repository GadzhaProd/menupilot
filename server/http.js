import { createServer } from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, lstatSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { StoreError } from '../src/store/errors.js';

// 5m UTF-16 code units can require 15m UTF-8 bytes; leave room for envelope/CAS.
export const MAX_BODY_BYTES = 15_100_000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const tokenMatches = (given, expected) => typeof given === 'string' && /^[a-f0-9]{64}$/.test(given) && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
export const escapeConfig = config => JSON.stringify(config).replace(/[<>&\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
function staticFiles(root) {
  const files = new Map();
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name), stat = lstatSync(path);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile() && MIME[extname(name)] && !name.endsWith('.map')) files.set('/menupilot/' + relative(root, path).split('\\').join('/'), path);
    }
  }
  walk(root); return files;
}
async function jsonBody(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw Object.assign(new StoreError('content-type', 'Use application/json.'), { status: 415 });
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) throw Object.assign(new StoreError('body-too-large', 'The request is too large.'), { status: 413 });
  let size = 0; const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new StoreError('body-too-large', 'The request is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new StoreError('invalid', 'The request must contain valid JSON.'); }
}
function send(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}

/** No arbitrary filesystem paths or arbitrary adapter method dispatch are accepted. */
export async function serveLocal({ storage, dataDir, distDir, port, instanceId = randomUUID(), cliToken = randomBytes(32).toString('hex') }) {
  const uiToken = randomBytes(32).toString('hex');
  const root = realpathSync(distDir), files = staticFiles(root);
  const template = readFileSync(join(root, 'index.html'), 'utf8');
  let address;
  const server = createServer(async (req, res) => {
    try {
      const host = new URL(address).host;
      if (req.headers.host !== host) { send(res, 403, { code: 'host', message: 'Invalid Host.' }); return; }
      const url = new URL(req.url, address);
      if (url.origin !== address) { send(res, 403, { code: 'host', message: 'Invalid request target.' }); return; }
      const path = url.pathname;
      if (req.method === 'GET' && path === '/menupilot-instance') { send(res, 200, { service: 'MenuPilot', instanceId }); return; }
      if (path.startsWith('/api/')) {
        const token = req.headers.authorization?.replace(/^Bearer /, '');
        const source = tokenMatches(token, uiToken) ? 'ui' : tokenMatches(token, cliToken) ? 'cli' : null;
        if (!source) { send(res, 401, { code: 'session-expired', message: 'The local server session changed. Copy any unsaved drafts, then reload this page.' }); return; }
        let value;
        if (req.method === 'GET' && path === '/api/document') value = storage.load();
        else if (req.method === 'GET' && path === '/api/version') value = storage.version();
        else if (req.method === 'GET' && path === '/api/history') value = storage.history.list();
        else if (req.method === 'POST' && path === '/api/history/read') {
          const body = await jsonBody(req);
          if (!body || Array.isArray(body) || typeof body.id !== 'string' || !body.id || Object.keys(body).length !== 1) throw new StoreError('invalid', 'Provide a history entry ID.');
          value = storage.history.read(body.id);
        }
        else if (req.method === 'POST' && path === '/api/write') {
          // Future CLI writes must use D5 proposals and owner approval, never raw saves.
          if (source !== 'ui') { send(res, 403, { code: 'ui-required', message: 'Changes require the MenuPilot window.' }); return; }
          value = storage.write(await jsonBody(req), source);
        } else { send(res, 404, { code: 'not-found', message: 'Unknown API route or method.' }); return; }
        send(res, 200, value); return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, { code: 'method', message: 'Method not allowed.' }); return; }
      if (path === '/' || path === '/menupilot') { res.writeHead(302, { Location: '/menupilot/', 'Cache-Control': 'no-store' }); res.end(); return; }
      if (path === '/menupilot/' || path === '/menupilot/index.html') {
        const config = escapeConfig({ mode: 'local', apiVersion: 1, token: uiToken, dataDir });
        const html = template.replace('<head>', () => `<head><meta name="menupilot-mode" content="local"><script id="menupilot-local-config" type="application/json">${config}</script>`);
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(req.method === 'HEAD' ? undefined : html); return;
      }
      const file = files.get(path);
      if (!file || extname(file) === '.html') { send(res, 404, { code: 'not-found', message: 'File not found.' }); return; }
      res.writeHead(200, { 'Content-Type': MIME[extname(file)], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
    } catch (error) {
      if (error.status === 413) res.setHeader('Connection', 'close');
      if (!res.headersSent) send(res, error.status ?? (error instanceof StoreError ? 400 : 500), {
        code: error instanceof StoreError ? error.code : 'server-error',
        message: error instanceof StoreError ? error.message : 'Local server could not complete the request.',
        details: error instanceof StoreError ? error.details : [],
      });
      else res.destroy();
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  address = `http://127.0.0.1:${server.address().port}`;
  let closing;
  return { address, uiToken, cliToken,
    close() {
      return closing ??= new Promise((resolve, reject) => {
        // Unfinished bodies/keep-alive clients cannot hold the writer lock forever.
        // SQLite writes are synchronous, so no transaction can be interrupted here.
        const deadline = setTimeout(() => server.closeAllConnections(), 1000);
        deadline.unref();
        server.close(error => { clearTimeout(deadline); error ? reject(error) : resolve(); });
        server.closeIdleConnections();
      });
    },
  };
}

import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/** Create a static server rooted at a directory. */
export function createStaticServer(rootDirectory) {
  const rootPath = resolve(rootDirectory);
  return createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent((request.url ?? '/').split('?', 1)[0]);
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (!pathname.startsWith('/') || pathname.split(/[\\/]+/).includes('..')) {
      response.writeHead(404).end();
      return;
    }

    const filePath = resolve(rootPath, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${sep}`)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const [realRoot, realFile] = await Promise.all([realpath(rootPath), realpath(filePath)]);
      if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${sep}`)) {
        response.writeHead(404).end();
        return;
      }
      const body = await readFile(realFile);
      response.writeHead(200, { 'Content-Type': MIME_TYPES[extname(realFile).toLowerCase()] ?? 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.code === 'EISDIR' ? 404 : 500).end();
    }
  });
}

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const isMainModule = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMainModule) {
  const port = Number.parseInt(process.env.PORT ?? '8080', 10);
  createStaticServer(projectRoot).listen(port, '127.0.0.1', () => {
    console.log(`MenuPilot is available at http://127.0.0.1:${port}`);
  });
}

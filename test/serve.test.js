import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createStaticServer } from '../scripts/serve.mjs';

async function startServer(root) {
  const server = createStaticServer(root);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

async function get(port, requestPath) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: requestPath }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function withFixture(t, setup) {
  const directory = await mkdtemp(join(tmpdir(), 'menupilot-serve-'));
  const root = join(directory, 'public');
  await mkdir(root);
  await setup(directory, root);
  t.after(() => rm(directory, { recursive: true, force: true }));
  return root;
}

test('serves the index and assigns static file MIME types', async (t) => {
  const root = await withFixture(t, async (_directory, publicRoot) => {
    await writeFile(join(publicRoot, 'index.html'), '<h1>MenuPilot</h1>');
    await writeFile(join(publicRoot, 'app.js'), 'export {};');
    await writeFile(join(publicRoot, 'styles.css'), 'body {}');
    await writeFile(join(publicRoot, 'data.json'), '{}');
    await writeFile(join(publicRoot, 'icon.svg'), '<svg/>');
    await writeFile(join(publicRoot, 'image.png'), 'png');
  });
  const server = await startServer(root);

  try {
    const port = server.address().port;
    const index = await get(port, '/');
    assert.equal(index.statusCode, 200);
    assert.match(index.contentType, /^text\/html/);
    assert.equal(index.body, '<h1>MenuPilot</h1>');

    const mimeTypes = [
      ['/app.js', 'text/javascript'],
      ['/styles.css', 'text/css'],
      ['/data.json', 'application/json'],
      ['/icon.svg', 'image/svg+xml'],
      ['/image.png', 'image/png'],
    ];
    for (const [path, expectedType] of mimeTypes) {
      const response = await get(port, path);
      assert.equal(response.statusCode, 200, path);
      assert.ok(response.contentType.startsWith(expectedType), path);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('returns 404 for a missing file', async (t) => {
  const root = await withFixture(t, async () => {});
  const server = await startServer(root);

  try {
    const response = await get(server.address().port, '/missing.html');
    assert.equal(response.statusCode, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('does not serve files outside the static root through traversal paths', async (t) => {
  const root = await withFixture(t, async (directory) => {
    await writeFile(join(directory, 'package.json'), 'outside the static root');
  });
  const server = await startServer(root);

  try {
    for (const path of ['/../package.json', '/%2e%2e/package.json', '/..\\package.json', '/%2e%2e%5cpackage.json']) {
      const response = await get(server.address().port, path);
      assert.equal(response.statusCode, 404, path);
      assert.notEqual(response.body, 'outside the static root');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('rejects a NUL byte in the decoded pathname with HTTP 400', async (t) => {
  const root = await withFixture(t, async () => {});
  const server = await startServer(join(root, 'missing-root'));

  try {
    const response = await get(server.address().port, '/%00/package.json');
    assert.equal(response.statusCode, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('does not serve a symlink that resolves outside the static root', async (t) => {
  const root = await withFixture(t, async (directory, publicRoot) => {
    const outsideFile = join(directory, 'secret.txt');
    await writeFile(outsideFile, 'outside the static root');
    await symlink(outsideFile, join(publicRoot, 'secret.txt'));
  });
  const server = await startServer(root);

  try {
    const response = await get(server.address().port, '/secret.txt');
    assert.equal(response.statusCode, 404);
    assert.notEqual(response.body, 'outside the static root');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

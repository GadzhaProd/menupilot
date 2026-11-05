import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { collectLicenses } from '../../scripts/licenses.js';

test('licenses include full installed texts, copied components, transitive fallback and fonts', () => {
  const root = resolve('.');
  const ids = ['react/index.js', 'react-dom/client.js', 'scheduler/index.js', '@radix-ui/react-dialog/dist/index.mjs', 'class-variance-authority/dist/index.mjs', 'clsx/dist/clsx.mjs', 'tailwind-merge/dist/bundle-mjs.mjs', 'lucide-react/dist/esm/lucide-react.js', 'react-remove-scroll-bar/dist/es2015/index.js'].map(name => join(root, 'node_modules', name));
  const result = collectLicenses(ids, root);
  for (const name of ['react', 'react-dom', 'scheduler', '@radix-ui/react-dialog', 'class-variance-authority', 'clsx', 'tailwind-merge', 'lucide-react']) assert.ok(result.text.includes(readFileSync(join(root, 'node_modules', name, name === 'tailwind-merge' ? 'LICENSE.md' : 'LICENSE'), 'utf8').trim()), name);
  for (const name of ['shadcn', '21st/badge-delta', '21st/alert-with-action-buttons', 'npm/react-remove-scroll-bar/2.3.8']) assert.ok(result.text.includes(readFileSync(join(root, 'third_party', name, name === 'tailwind-merge' ? 'LICENSE.md' : 'LICENSE'), 'utf8').trim()), name);
  assert.match(result.text, /SIL OPEN FONT LICENSE/i);
  assert.match(result.text, /Apache License/);
  assert.ok(result.html.includes('&lt;thekashey@gmail.com&gt;'));
  assert.equal(collectLicenses([...ids].reverse(), root).text, result.text);
});

test('new bundled dependencies without a full license fail, NOTICE is retained when present', t => {
  const root = mkdtempSync(join(tmpdir(), 'menupilot-licenses-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ['new-package', 'tailwindcss']) {
    const dir = join(root, 'node_modules', name); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', license: 'MIT' }));
  }
  mkdirSync(join(root, 'third_party')); mkdirSync(join(root, 'public/fonts'), { recursive: true });
  const ids = [join(root, 'node_modules/new-package/index.js')];
  assert.throws(() => collectLicenses(ids, root), /Missing full license for bundled package new-package@1.0.0/);
  for (const name of ['new-package', 'tailwindcss']) writeFileSync(join(root, 'node_modules', name, 'LICENSE'), 'Full license fixture');
  writeFileSync(join(root, 'node_modules/new-package/NOTICE.txt'), 'Required upstream notice <author>');
  const result = collectLicenses(ids, root);
  assert.match(result.text, /Required upstream notice <author>/);
  assert.match(result.html, /Required upstream notice &lt;author&gt;/);
});

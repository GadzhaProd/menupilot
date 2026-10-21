import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

export async function ensureBuild(root, signal) {
  const hash = createHash('sha256');
  function scan(path) {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (entry.isFile()) { hash.update(file.slice(root.length)); hash.update(readFileSync(file)); }
    }
  }
  for (const name of ['src', 'data', 'public']) if (existsSync(join(root, name))) scan(join(root, name));
  for (const name of ['package.json', 'package-lock.json', 'vite.config.js', 'index.html']) hash.update(readFileSync(join(root, name)));
  hash.update(process.versions.node);
  const fingerprint = hash.digest('hex'), marker = join(root, 'dist/.menupilot-build');
  if (existsSync(join(root, 'dist/index.html')) && existsSync(marker) && readFileSync(marker, 'utf8') === fingerprint) return;
  console.log('Building MenuPilot…');
  await new Promise((resolve, reject) => {
    // Use the same verified Node runtime, independent of npm/PATH configuration.
    const child = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root, stdio: 'inherit', signal });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('The UI build failed. Run npm ci, then npm start.')));
  });
  writeFileSync(marker, fingerprint);
}

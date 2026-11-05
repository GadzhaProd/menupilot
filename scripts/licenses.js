import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const legalFile = /^(licen[cs]e|copying|notice|copyright(?:notice)?)(?:[.-].*)?$/i;
const read = path => readFileSync(path, 'utf8').trim();
const escapeHtml = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Read the installed package owning a bundled module, including nested dependencies. */
function packageRoot(id) {
  if (!id.includes('/node_modules/') || id.startsWith('\0')) return null;
  let dir = dirname(id.split('?')[0]);
  while (dir !== dirname(dir)) {
    const path = join(dir, 'package.json');
    if (existsSync(path)) {
      const pkg = JSON.parse(read(path));
      if (pkg.name && pkg.version) return { dir, pkg };
    }
    dir = dirname(dir);
  }
  throw new Error(`Cannot identify license owner for bundled module: ${id}`);
}

function legalTexts(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && legalFile.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => ({ name: entry.name, text: read(join(dir, entry.name)) }));
}

export function collectLicenses(moduleIds, root) {
  const packages = new Map();
  for (const id of moduleIds) {
    const owner = packageRoot(id);
    if (owner) packages.set(owner.dir, owner);
  }
  // Tailwind emits CSS with its license banner, rather than a JavaScript module.
  const tailwind = packageRoot(join(root, 'node_modules/tailwindcss/index.css'));
  if (tailwind) packages.set(tailwind.dir, tailwind);
  const sections = ['MenuPilot — third-party licenses\nGenerated from the packages in this build and copied source notices.'];
  for (const { dir, pkg } of [...packages.values()].sort((a, b) => `${a.pkg.name}@${a.pkg.version}`.localeCompare(`${b.pkg.name}@${b.pkg.version}`))) {
    const files = legalTexts(dir);
    const fallback = join(root, 'third_party/npm', pkg.name, pkg.version);
    if (!files.some(file => /^(licen[cs]e|copying)/i.test(file.name)) && existsSync(fallback)) {
      files.push(...legalTexts(fallback));
    }
    if (!files.some(file => /^(licen[cs]e|copying)/i.test(file.name) && file.text)) throw new Error(`Missing full license for bundled package ${pkg.name}@${pkg.version}`);
    sections.push(`${pkg.name}@${pkg.version}\nLicense: ${pkg.license ?? 'See full text below'}\n${typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? pkg.homepage ?? ''}\n\n${files.map(file => `${file.name}\n${file.text}`).join('\n\n')}`);
  }
  function copied(dir, label = 'third_party') {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && label === 'third_party' && entry.name === 'npm') continue; // Used only for the matching bundled package/version above.
      if (entry.isDirectory()) copied(join(dir, entry.name), `${label}/${entry.name}`);
      else if (entry.isFile() && legalFile.test(entry.name)) sections.push(`${label}/${entry.name}\n\n${read(join(dir, entry.name))}`);
    }
  }
  copied(join(root, 'third_party'));
  for (const name of readdirSync(join(root, 'public/fonts')).filter(name => /OFL\.(txt|md)$/i.test(name)).sort()) sections.push(`Fonts: ${name}\n\n${read(join(root, 'public/fonts', name))}`);
  const text = sections.join('\n\n' + '='.repeat(72) + '\n\n') + '\n';
  const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MenuPilot — Third-party licenses</title></head><body><h1>Third-party licenses</h1><p><a href="./#/help">MenuPilot Help</a></p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(text)}</pre></body></html>\n`;
  return { text, html };
}

/** Emit portable text/HTML plus JSON for the Help route on the local server. */
export function thirdPartyLicenses() {
  let root;
  return {
    name: 'menupilot-third-party-licenses',
    apply: 'build',
    configResolved(config) { root = resolve(config.root); },
    generateBundle(_options, bundle) {
      const ids = new Set(Object.values(bundle).filter(output => output.type === 'chunk').flatMap(chunk => Object.keys(chunk.modules)));
      const { text, html } = collectLicenses(ids, root);
      this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_LICENSES.txt', source: text });
      this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_LICENSES.html', source: html });
      this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_LICENSES.json', source: JSON.stringify({ text }) });
    },
  };
}

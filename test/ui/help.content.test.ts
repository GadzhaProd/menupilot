import { describe, expect, it } from 'vitest';
import { HELP_CONTENT } from '@/ui/help/content';
import { HELP_IMAGES } from '@/ui/help/images';
import {
  HELP_SECTION_IDS, type HelpBlock, type HelpDocument, type HelpImage, type HelpImageId, type Rich,
} from '@/ui/help/types';

const en = HELP_CONTENT.en;
const ru = HELP_CONTENT.ru;

/** Every file in public/help as a data URL ("?inline"): enough to count bytes and read the first ones. */
const FILES = import.meta.glob<string>('/public/help/*', { query: '?inline', import: 'default', eager: true });
const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const base64Bytes = (dataUrl: string) => {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((payload.length * 3) / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
};
const FILE_SIZES = new Map(Object.entries(FILES).map(([path, url]) => [fileName(path), base64Bytes(url)]));

const blocksOf = (doc: HelpDocument) => doc.sections.flatMap((section) => section.blocks);

function imagesIn(block: HelpBlock): HelpImage[] {
  if (block.kind === 'image') return [block.image];
  if (block.kind === 'steps') return block.steps.flatMap((step) => (step.image ? [step.image] : []));
  return [];
}

/** Every piece of text of a document, to check that nothing is empty. */
function allStrings(doc: HelpDocument): string[] {
  const out: string[] = [doc.title, doc.subtitle, ...Object.values(doc.ui)];
  const rich = (text: Rich) => {
    if (typeof text === 'string') out.push(text);
    else for (const part of text) out.push(typeof part === 'string' ? part : 'b' in part ? part.b : part.text);
  };
  for (const section of doc.sections) {
    out.push(section.title);
    for (const block of section.blocks) {
      switch (block.kind) {
        case 'p': rich(block.text); break;
        case 'h3': out.push(block.text); break;
        case 'note': out.push(block.title); rich(block.text); break;
        case 'list': block.items.forEach(rich); break;
        case 'terms': block.items.forEach((item) => { out.push(item.term); rich(item.meaning); if (item.example) rich(item.example); }); break;
        case 'messages': block.items.forEach((item) => { out.push(item.message); rich(item.meaning); }); break;
        case 'steps':
          out.push(block.title);
          block.steps.forEach((step) => { rich(step.text); if (step.result) rich(step.result); });
          break;
        case 'image': break;
      }
      imagesIn(block).forEach((image) => { out.push(image.alt); if (image.caption !== undefined) out.push(image.caption); });
    }
  }
  return out;
}

function internalLinks(doc: HelpDocument): string[] {
  const links: string[] = [];
  const rich = (text: Rich) => { if (typeof text !== 'string') for (const part of text) if (typeof part !== 'string' && 'to' in part) links.push(part.to); };
  for (const block of blocksOf(doc)) {
    if (block.kind === 'p' || block.kind === 'note') rich(block.text);
    if (block.kind === 'list') block.items.forEach(rich);
    if (block.kind === 'steps') block.steps.forEach((step) => { rich(step.text); if (step.result) rich(step.result); });
    if (block.kind === 'messages') block.items.forEach((item) => rich(item.meaning));
  }
  return links;
}

describe('guide content: both languages', () => {
  it('have the same section ids in the same order, covering every id', () => {
    expect(en.sections.map((section) => section.id)).toEqual([...HELP_SECTION_IDS]);
    expect(ru.sections.map((section) => section.id)).toEqual([...HELP_SECTION_IDS]);
  });

  it('are marked with their own language', () => {
    expect(en.lang).toBe('en');
    expect(ru.lang).toBe('ru');
  });

  it.each(HELP_SECTION_IDS)('section %s has the same structure in both languages', (id) => {
    const a = en.sections.find((section) => section.id === id)?.blocks ?? [];
    const b = ru.sections.find((section) => section.id === id)?.blocks ?? [];
    expect(a.length).toBeGreaterThan(0);
    expect(b.map((block) => block.kind)).toEqual(a.map((block) => block.kind));
    a.forEach((block, index) => {
      const other = b[index] as HelpBlock;
      if (block.kind === 'steps' && other.kind === 'steps') {
        expect(other.steps.length, `steps of "${block.title}"`).toBe(block.steps.length);
        expect(other.steps.map((step) => step.image?.id), `images of "${block.title}"`).toEqual(block.steps.map((step) => step.image?.id));
        expect(other.steps.map((step) => step.result !== undefined), `results of "${block.title}"`).toEqual(block.steps.map((step) => step.result !== undefined));
      }
      if (block.kind === 'note' && other.kind === 'note') expect(other.tone).toBe(block.tone);
      if (block.kind === 'list' && other.kind === 'list') expect(other.items.length).toBe(block.items.length);
      if (block.kind === 'terms' && other.kind === 'terms') expect(other.items.length).toBe(block.items.length);
      if (block.kind === 'messages' && other.kind === 'messages') {
        // The messages are the English texts of the screen in both languages.
        expect(other.items.map((item) => item.message)).toEqual(block.items.map((item) => item.message));
      }
      if (block.kind === 'image' && other.kind === 'image') expect(other.image.id).toBe(block.image.id);
    });
  });

  it('have the same number of steps overall, and every section 4 to 10 has numbered steps', () => {
    const count = (doc: HelpDocument) => blocksOf(doc).reduce((sum, block) => sum + (block.kind === 'steps' ? block.steps.length : 0), 0);
    expect(count(ru)).toBe(count(en));
    for (const id of ['first-start', 'ingredients', 'preps', 'dishes', 'dashboard', 'simulator', 'data'] as const) {
      const steps = en.sections.find((section) => section.id === id)?.blocks.filter((block) => block.kind === 'steps') ?? [];
      expect(steps.length, id).toBeGreaterThan(0);
    }
  });

  it('have no empty texts, alt texts or captions', () => {
    for (const doc of [en, ru]) {
      const empty = allStrings(doc).filter((text) => text.trim() === '');
      expect(empty, doc.lang).toEqual([]);
    }
  });

  it('give every picture its own alt text in the language of the page', () => {
    for (const doc of [en, ru]) {
      for (const block of blocksOf(doc)) {
        for (const image of imagesIn(block)) {
          expect(image.alt.length, `${doc.lang} ${image.id}`).toBeGreaterThan(10);
        }
      }
    }
    const cyrillic = /[А-Яа-яЁё]/;
    for (const block of blocksOf(ru)) for (const image of imagesIn(block)) expect(image.alt, image.id).toMatch(cyrillic);
    for (const block of blocksOf(en)) for (const image of imagesIn(block)) expect(image.alt, image.id).not.toMatch(cyrillic);
  });

  it('link only to sections that exist', () => {
    for (const doc of [en, ru]) {
      for (const link of internalLinks(doc)) expect(HELP_SECTION_IDS as readonly string[]).toContain(link);
    }
  });

  it('never call contribution profit in the guide’s English or Russian text', () => {
    // The word may appear only to say what contribution is NOT.
    for (const text of allStrings(en)) {
      if (/profit/i.test(text)) expect(text, text).toMatch(/not (a )?profit|NOT profit|not.*profit/i);
    }
    for (const text of allStrings(ru)) {
      if (/прибыл/i.test(text)) expect(text, text).toMatch(/не прибыль|НЕ прибыль/i);
      expect(text).not.toMatch(/прогноз/i);
    }
  });
});

describe('guide pictures', () => {
  const used = new Set<HelpImageId>();
  for (const block of blocksOf(en)) for (const image of imagesIn(block)) used.add(image.id);

  it('every picture used by the guide exists in public/help', () => {
    expect(used.size).toBeGreaterThan(20);
    for (const id of used) {
      const file = HELP_IMAGES[id];
      expect(file, id).toBeTruthy();
      expect(FILE_SIZES.has(file.file), `${id}: ${file.file}`).toBe(true);
      expect(file.width).toBeGreaterThan(0);
      expect(file.height).toBeGreaterThan(0);
    }
  });

  it('every file in public/help is used, and is a real JPEG', () => {
    const files = [...FILE_SIZES.keys()];
    const referenced = new Set(Object.values(HELP_IMAGES).map((entry) => entry.file));
    expect([...referenced].sort()).toEqual(files.sort());
    expect(Object.keys(HELP_IMAGES).sort()).toEqual([...used].sort());
    for (const [path, url] of Object.entries(FILES)) {
      expect(fileName(path)).toMatch(/\.jpg$/);
      expect(url, path).toMatch(/^data:image\/jpeg;base64,\/9j\//); // 0xFF 0xD8 0xFF
    }
  });

  it('stay within the size budget: about 80 KB each, 2 MB in total', () => {
    const sizes = [...FILE_SIZES.values()];
    expect(sizes.length).toBeGreaterThan(20);
    for (const size of sizes) expect(size).toBeLessThanOrEqual(80 * 1024);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(2 * 1024 * 1024);
  });
});

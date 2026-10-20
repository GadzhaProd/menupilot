import { describe, expect, it } from 'vitest';
import demoEn from '../../data/demo.json';
import demoNl from '../../data/demo.nl.json';
import { dictionaries } from '@/ui/i18n/messages';
import { HELP_CONTENT } from '@/ui/help/content';
import { HELP_IMAGES } from '@/ui/help/images';
import {
  HELP_IMAGE_SET, HELP_SECTION_IDS, sectionNumber,
  type HelpBlock, type HelpDocument, type HelpImage, type HelpImageId, type HelpLang, type Rich,
} from '@/ui/help/types';

const en = HELP_CONTENT.en;
const nl = HELP_CONTENT.nl;
const ru = HELP_CONTENT.ru;
const LANGS: readonly HelpLang[] = ['en', 'nl', 'ru'];

/** Every file in public/help as a data URL ("?inline"): enough to count bytes and read the first ones. */
const FILES = import.meta.glob<string>('/public/help/**/*', { query: '?inline', import: 'default', eager: true });
const relativeName = (path: string) => path.slice('/public/help/'.length);
const base64Bytes = (dataUrl: string) => {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((payload.length * 3) / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
};
const FILE_SIZES = new Map(Object.entries(FILES).map(([path, url]) => [relativeName(path), base64Bytes(url)]));

const blocksOf = (doc: HelpDocument) => doc.sections.flatMap((section) => section.blocks);

function imagesIn(block: HelpBlock): HelpImage[] {
  if (block.kind === 'image') return [block.image];
  if (block.kind === 'steps') return block.steps.flatMap((step) => (step.image ? [step.image] : []));
  return [];
}

/** Every piece of rich text of a block, in reading order. */
function richIn(block: HelpBlock): Rich[] {
  switch (block.kind) {
    case 'p': return [block.text];
    case 'note': return [block.text];
    case 'list': return [...block.items];
    case 'terms': return block.items.flatMap((item) => (item.example ? [item.meaning, item.example] : [item.meaning]));
    case 'messages': return block.items.map((item) => item.meaning);
    case 'steps': return block.steps.flatMap((step) => (step.result ? [step.text, step.result] : [step.text]));
    default: return [];
  }
}

const richParts = (text: Rich) => (typeof text === 'string' ? [text] : [...text]);

/** Every piece of text of a document, to check that nothing is empty. */
function allStrings(doc: HelpDocument): string[] {
  const out: string[] = [doc.title, doc.subtitle, ...Object.values(doc.ui)];
  const rich = (text: Rich) => {
    // A single space between two bold names is a legitimate part of a text.
    for (const part of richParts(text)) if (part !== ' ') out.push(typeof part === 'string' ? part : 'b' in part ? part.b : part.text);
  };
  for (const section of doc.sections) {
    out.push(section.title);
    for (const block of section.blocks) {
      if (block.kind === 'h3') out.push(block.text);
      if (block.kind === 'note') out.push(block.title);
      if (block.kind === 'steps') out.push(block.title);
      if (block.kind === 'terms') block.items.forEach((item) => out.push(item.term));
      if (block.kind === 'messages') block.items.forEach((item) => out.push(item.message));
      richIn(block).forEach(rich);
      imagesIn(block).forEach((image) => { out.push(image.alt); if (image.caption !== undefined) out.push(image.caption); });
    }
  }
  return out;
}

const boldIn = (doc: HelpDocument): string[] =>
  blocksOf(doc).flatMap((block) => richIn(block).flatMap((text) => richParts(text).flatMap((part) => (typeof part !== 'string' && 'b' in part ? [part.b] : []))));

function internalLinks(doc: HelpDocument): string[] {
  return blocksOf(doc).flatMap((block) => richIn(block).flatMap((text) => richParts(text).flatMap((part) => (typeof part !== 'string' && 'to' in part ? [part.to] : []))));
}

const stepCount = (doc: HelpDocument) => blocksOf(doc).reduce((sum, block) => sum + (block.kind === 'steps' ? block.steps.length : 0), 0);

describe('guide content: three languages', () => {
  it('have the same section ids in the same order, covering every id', () => {
    for (const doc of [en, nl, ru]) expect(doc.sections.map((section) => section.id)).toEqual([...HELP_SECTION_IDS]);
  });

  it('are marked with their own language', () => {
    expect(en.lang).toBe('en');
    expect(nl.lang).toBe('nl');
    expect(ru.lang).toBe('ru');
    expect(Object.keys(HELP_CONTENT).sort()).toEqual([...LANGS].sort());
  });

  it.each(HELP_SECTION_IDS)('section %s has the same structure in all three languages', (id) => {
    const a = en.sections.find((section) => section.id === id)?.blocks ?? [];
    expect(a.length).toBeGreaterThan(0);
    for (const other of [nl, ru]) {
      const b = other.sections.find((section) => section.id === id)?.blocks ?? [];
      expect(b.map((block) => block.kind), other.lang).toEqual(a.map((block) => block.kind));
      a.forEach((block, index) => {
        const twin = b[index] as HelpBlock;
        if (block.kind === 'steps' && twin.kind === 'steps') {
          expect(twin.steps.length, `${other.lang} steps of "${block.title}"`).toBe(block.steps.length);
          expect(twin.steps.map((step) => step.image?.id), `${other.lang} images of "${block.title}"`).toEqual(block.steps.map((step) => step.image?.id));
          expect(twin.steps.map((step) => step.result !== undefined), `${other.lang} results of "${block.title}"`).toEqual(block.steps.map((step) => step.result !== undefined));
        }
        if (block.kind === 'note' && twin.kind === 'note') expect(twin.tone).toBe(block.tone);
        if (block.kind === 'list' && twin.kind === 'list') expect(twin.items.length).toBe(block.items.length);
        if (block.kind === 'terms' && twin.kind === 'terms') expect(twin.items.length).toBe(block.items.length);
        if (block.kind === 'messages' && twin.kind === 'messages') expect(twin.items.length).toBe(block.items.length);
        if (block.kind === 'image' && twin.kind === 'image') expect(twin.image.id).toBe(block.image.id);
      });
    }
  });

  it('show the English screen messages in the Russian guide, in the same order', () => {
    const messages = (doc: HelpDocument) => blocksOf(doc).flatMap((block) => (block.kind === 'messages' ? block.items.map((item) => item.message) : []));
    expect(messages(ru)).toEqual(messages(en));
    expect(messages(nl)).not.toEqual(messages(en));
  });

  it('have the same number of steps overall, and every practice section has numbered steps', () => {
    expect(stepCount(nl)).toBe(stepCount(en));
    expect(stepCount(ru)).toBe(stepCount(en));
    for (const id of ['first-start', 'appearance', 'ingredients', 'preps', 'dishes', 'dashboard', 'simulator', 'data'] as const) {
      for (const doc of [en, nl, ru]) {
        const steps = doc.sections.find((section) => section.id === id)?.blocks.filter((block) => block.kind === 'steps') ?? [];
        expect(steps.length, `${doc.lang} ${id}`).toBeGreaterThan(0);
      }
    }
  });

  it('have no empty texts, alt texts or captions', () => {
    for (const doc of [en, nl, ru]) {
      const empty = allStrings(doc).filter((text) => text.trim() === '');
      expect(empty, doc.lang).toEqual([]);
    }
  });

  it('give every picture its own alt text in the language of the page', () => {
    const cyrillic = /[А-Яа-яЁё]/;
    const altOf = (doc: HelpDocument) => new Map(blocksOf(doc).flatMap((block) => imagesIn(block).map((image) => [image.id, image.alt] as const)));
    const enAlt = altOf(en);
    for (const doc of [en, nl, ru]) {
      for (const [id, alt] of altOf(doc)) {
        expect(alt.length, `${doc.lang} ${id}`).toBeGreaterThan(10);
        // The name of the Russian language button is written in Russian in every language.
        if (doc.lang === 'ru') expect(alt, id).toMatch(cyrillic);
        else expect(alt.replace('Русский', ''), `${doc.lang} ${id}`).not.toMatch(cyrillic);
        if (doc.lang === 'nl') expect(alt, `nl alt of ${id} must not be the English text`).not.toBe(enAlt.get(id));
      }
    }
  });

  it('link only to sections that exist, and number sections from their order', () => {
    for (const doc of [en, nl, ru]) {
      for (const link of internalLinks(doc)) expect(HELP_SECTION_IDS as readonly string[]).toContain(link);
    }
    expect(sectionNumber('data')).toBe(HELP_SECTION_IDS.indexOf('data') + 1);
    const linkTexts = (doc: HelpDocument) => blocksOf(doc).flatMap((block) => richIn(block).flatMap((text) => richParts(text).flatMap((part) => (typeof part !== 'string' && 'to' in part ? [{ to: part.to, text: part.text }] : []))));
    for (const doc of [en, nl, ru]) {
      for (const link of linkTexts(doc)) expect(link.text, `${doc.lang} ${link.to}`).toContain(String(sectionNumber(link.to)));
    }
  });

  it('never call contribution profit, and never promise a forecast', () => {
    // The words may appear only to say what contribution is NOT.
    for (const text of allStrings(en)) {
      if (/profit/i.test(text)) expect(text, text).toMatch(/not (a )?profit|NOT profit|not.*profit/i);
    }
    for (const text of allStrings(ru)) {
      if (/прибыл/i.test(text)) expect(text, text).toMatch(/не прибыль|НЕ прибыль/i);
      if (/прогноз/i.test(text)) expect(text, text).toMatch(/не прогноз|а не прогноз/i);
    }
    for (const text of allStrings(nl)) {
      if (/winst/i.test(text)) expect(text, text).toMatch(/geen winst|GEEN winst/i);
    }
  });

  it('say each Dutch term the screen says: basisrecept, Huidige situatie, Verkocht per maand, Voorbeeldgegevens, btw', () => {
    const dutch = allStrings(nl).join(' ');
    for (const term of ['basisrecept', 'Huidige situatie', 'Verkocht per maand', 'voorbeeldgegevens', 'btw', 'Bijdrage vóór overige kosten', 'Ingrediëntkosten volgens recept']) {
      expect(dutch.toLowerCase(), term).toContain(term.toLowerCase());
    }
    expect(dutch).toContain('je ');
    expect(dutch).not.toMatch(/\bu kunt\b|\buw\b/i); // “je”, not “u”
    expect(dutch).not.toMatch(/Nederlandse handleiding volgt/i);
  });

  it('use the Russian guide only for the English screen: Russian terms stay in brackets next to English names', () => {
    expect(HELP_IMAGE_SET.ru).toBe('en');
    expect(HELP_IMAGE_SET.en).toBe('en');
    expect(HELP_IMAGE_SET.nl).toBe('nl');
  });
});

describe('guide wording matches the screen', () => {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** A dictionary message as a pattern: {name} stands for any text. */
  const messagePattern = (message: string) => new RegExp(`^${escape(message).replace(/\\\{\w+\\\}/g, '.+')}$`);
  const norm = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim();
  const screenLocale = (lang: HelpLang) => (lang === 'nl' ? 'nl' : 'en');
  const unitsOf = ['g', 'kg', 'ml', 'l', 'pc', 'st.'];

  it.each(LANGS)('every message quoted in the %s guide exists on the screen', (lang) => {
    const dictionary = Object.values(dictionaries[screenLocale(lang)]).map(norm);
    const patterns = dictionary.map(messagePattern);
    const quoted = blocksOf(HELP_CONTENT[lang]).flatMap((block) => (block.kind === 'messages' ? block.items.map((item) => norm(item.message)) : []));
    expect(quoted.length).toBeGreaterThan(10);
    const unknown = quoted.filter((message) => message !== '—' && !dictionary.includes(message) && !patterns.some((pattern) => pattern.test(message)));
    expect(unknown, `${lang}: messages that are not on the screen`).toEqual([]);
  });

  it.each(LANGS)('every button and field name written in bold in the %s guide is a real screen word', (lang) => {
    const screen = screenLocale(lang);
    const dictionary = new Set(Object.values(dictionaries[screen]).map(norm));
    const doc = HELP_CONTENT[lang];
    const known = new Set<string>(dictionary);
    for (const value of Object.values(doc.ui)) known.add(norm(value));
    for (const label of ['English', 'Nederlands', 'Русский', 'EN', 'NL', 'MenuPilot', '←', 'OK']) known.add(label);
    // The word “bold” itself, and the delete button of a recipe: “Delete” plus the kind in lower case.
    for (const label of ['bold', 'vet', 'жирным', 'Delete dish', 'Delete prep', 'gerecht verwijderen', 'basisrecept verwijderen']) known.add(label);
    const demo = screen === 'nl' ? demoNl : demoEn;
    for (const ingredient of demo.ingredients) { known.add(ingredient.name); known.add(`${ingredient.name} · ${ingredient.unit}`); }
    for (const recipe of demo.recipes) known.add(recipe.name);
    // Things the owner types in the examples.
    const typed = screen === 'nl'
      ? ['Olijfolie', 'Mosterdmayonaise', 'Kipbroodje', 'Prijs 13,83', 'Mayonaise · g', 'Dijonmosterd · g', 'Kipfilet · g', 'Briocheburgerbroodje · st.', 'Mosterdmayonaise · g']
      : ['Olive oil', 'Mustard mayo', 'Chicken Bun', 'Price 13.83', 'Mustard mayo · g'];
    typed.forEach((value) => known.add(value));
    const vatSuffixes = [dictionaries[screen]['common.exclVat'], dictionaries[screen]['common.inclVat']];
    const patterns = [...dictionary].map(messagePattern);
    const composed = (value: string) => {
      // “Pack size (l)”: a screen word plus the unit that is chosen; “Pack price (excl. VAT)”: plus the VAT note;
      // “New net quantity of Beef mince 80/20 (g)”: a message with a name in it, plus the unit.
      const match = /^(.+) \(([^()]+)\)$/.exec(value);
      if (match === null) return false;
      const [, head = '', tail = ''] = match;
      if (!unitsOf.includes(tail) && !vatSuffixes.includes(tail)) return false;
      return dictionary.has(norm(head)) || patterns.some((pattern) => pattern.test(norm(head)));
    };
    const quoted = (value: string) => /^[−+€\-\d]|^\[/.test(value);
    const unknown = [...new Set(boldIn(doc).map(norm))].filter((value) => !known.has(value) && !composed(value) && !quoted(value));
    // Words of the Russian guide that are Russian on purpose (the guide's own buttons, a word in the text).
    const allowedForRussian = ['жирным', 'Оглавление', 'К оглавлению', 'Наверх', 'Распечатать инструкцию'];
    expect(unknown.filter((value) => !(lang === 'ru' && allowedForRussian.includes(value))), `${lang}: bold words that are not on the screen`).toEqual([]);
  });
});

describe('guide pictures', () => {
  const usedBySet = (set: 'en' | 'nl') => {
    const used = new Set<HelpImageId>();
    const docs = LANGS.filter((lang) => HELP_IMAGE_SET[lang] === set).map((lang) => HELP_CONTENT[lang]);
    for (const doc of docs) for (const block of blocksOf(doc)) for (const image of imagesIn(block)) used.add(image.id);
    return used;
  };

  it('every picture used by a guide exists in its own set of screenshots', () => {
    for (const set of ['en', 'nl'] as const) {
      const used = usedBySet(set);
      expect(used.size, set).toBeGreaterThan(25);
      for (const id of used) {
        const file = HELP_IMAGES[set][id];
        expect(file, `${set} ${id}`).toBeTruthy();
        expect(FILE_SIZES.has(`${set}/${file.file}`), `${set}/${file.file}`).toBe(true);
        expect(file.width).toBeGreaterThan(0);
        expect(file.height).toBeGreaterThan(0);
      }
    }
  });

  it('the English and Dutch sets show the same pictures', () => {
    expect(Object.keys(HELP_IMAGES.nl).sort()).toEqual(Object.keys(HELP_IMAGES.en).sort());
    expect([...usedBySet('nl')].sort()).toEqual([...usedBySet('en')].sort());
  });

  it('every file in public/help is used, and is a real JPEG', () => {
    const files = [...FILE_SIZES.keys()].sort();
    const referenced = (['en', 'nl'] as const).flatMap((set) => Object.values(HELP_IMAGES[set]).map((entry) => `${set}/${entry.file}`)).sort();
    expect(referenced).toEqual(files);
    for (const [path, url] of Object.entries(FILES)) {
      expect(path).toMatch(/^\/public\/help\/(en|nl)\/[a-z-]+\.jpg$/);
      expect(url, path).toMatch(/^data:image\/jpeg;base64,\/9j\//); // 0xFF 0xD8 0xFF
    }
  });

  it('stay within the size budget: about 80 KB each, 3 MB in total', () => {
    const sizes = [...FILE_SIZES.values()];
    expect(sizes.length).toBeGreaterThan(50);
    for (const size of sizes) expect(size).toBeLessThanOrEqual(80 * 1024);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(3 * 1024 * 1024);
  });
});

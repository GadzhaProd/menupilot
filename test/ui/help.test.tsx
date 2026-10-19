import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HELP_CONTENT } from '@/ui/help/content';
import { HELP_LINK_LABEL } from '@/ui/help/HelpLink';
import { HELP_LANGUAGE_KEY, languageFromBrowser, readHelpLanguage, saveHelpLanguage } from '@/ui/help/language';
import { HELP_SECTION_IDS } from '@/ui/help/types';
import { demoCopy, go, memoryStorage, NOW, renderApp, STORAGE_KEY, storageWith } from './helpers';

const scrolled: Element[] = [];

/** The guide's language storage: a plain in-memory object, so no test touches a real browser storage. */
function memoryLocalStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => { data.clear(); },
  };
}

function browserLanguage(language: string) {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(language);
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: memoryLocalStorage(), configurable: true });
  scrolled.length = 0;
  browserLanguage('en-US');
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this); };
  window.scrollTo = () => {};
  window.print = vi.fn();
});
afterEach(() => { vi.restoreAllMocks(); });

const h1 = () => screen.findByRole('heading', { level: 1 });

describe('language of the guide', () => {
  it('follows the browser language: ru gives Russian, everything else English', () => {
    expect(languageFromBrowser('ru')).toBe('ru');
    expect(languageFromBrowser('ru-RU')).toBe('ru');
    expect(languageFromBrowser('RU_ru')).toBe('ru');
    expect(languageFromBrowser('en-GB')).toBe('en');
    expect(languageFromBrowser('uk-UA')).toBe('en');
    expect(languageFromBrowser('russian')).toBe('en');
    expect(languageFromBrowser(undefined)).toBe('en');
  });

  it('a remembered choice wins over the browser language, bad values are ignored', () => {
    browserLanguage('ru-RU');
    expect(readHelpLanguage()).toBe('ru');
    saveHelpLanguage('en');
    expect(readHelpLanguage()).toBe('en');
    window.localStorage.setItem(HELP_LANGUAGE_KEY, 'de');
    expect(readHelpLanguage()).toBe('ru');
  });

  it('works when browser storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    browserLanguage('ru');
    expect(readHelpLanguage(blocked)).toBe('ru');
    expect(() => saveHelpLanguage('en', blocked)).not.toThrow();
    expect(readHelpLanguage(null)).toBe('ru');
  });

  it('uses its own storage key, not the data document', () => {
    expect(HELP_LANGUAGE_KEY).not.toBe(STORAGE_KEY);
  });

  it('the page starts in the browser language', async () => {
    browserLanguage('ru-RU');
    renderApp();
    await go('#/help');
    expect((await h1()).textContent).toBe(HELP_CONTENT.ru.title);
    expect(document.querySelector('article')?.getAttribute('lang')).toBe('ru');
  });

  it('switching the language changes the page and is remembered, without touching the data', async () => {
    const storage = memoryStorage();
    renderApp(storage);
    await go('#/help');
    expect((await h1()).textContent).toBe(HELP_CONTENT.en.title);
    const group = screen.getByRole('group', { name: 'Language' });
    expect(within(group).getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe('true');

    await userEvent.click(within(group).getByRole('button', { name: 'Русский' }));
    expect((await h1()).textContent).toBe(HELP_CONTENT.ru.title);
    expect(screen.getByRole('button', { name: HELP_CONTENT.ru.ui.print })).toBeTruthy();
    expect(within(group).getByRole('button', { name: 'Русский' }).getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem(HELP_LANGUAGE_KEY)).toBe('ru');
    expect(storage.setCalls).toBe(0);
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
  });

  it('remembers the choice for the next visit', async () => {
    window.localStorage.setItem(HELP_LANGUAGE_KEY, 'ru');
    renderApp();
    await go('#/help');
    expect((await h1()).textContent).toBe(HELP_CONTENT.ru.title);
  });
});

describe('the guide page', () => {
  it('shows a contents list with one link per section, and every section with a heading', async () => {
    renderApp();
    await go('#/help');
    const contents = await screen.findByRole('navigation', { name: 'Contents' });
    const links = within(contents).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(HELP_SECTION_IDS.map((id) => `#/help/${id}`));
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBe(HELP_SECTION_IDS.length + 1);
    HELP_CONTENT.en.sections.forEach((section, index) => {
      expect(screen.getByRole('heading', { level: 2, name: `${index + 1}. ${section.title}` })).toBeTruthy();
    });
  });

  it('the main menu has a Help item that opens it', async () => {
    renderApp();
    await userEvent.click(screen.getByRole('link', { name: 'Help' }));
    expect(await h1()).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Help' }).getAttribute('aria-current')).toBe('page');
  });

  it('a section address scrolls to that section and focuses its heading', async () => {
    renderApp();
    await go('#/help/dishes');
    const heading = await screen.findByRole('heading', { level: 2, name: /Dishes: recipe, price and cost/ });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(scrolled.at(-1)).toBe(heading.closest('section'));
  });

  it('every section id works as an address', async () => {
    renderApp();
    for (const [index, id] of HELP_SECTION_IDS.entries()) {
      await go(`#/help/${id}`);
      const heading = await screen.findByRole('heading', { level: 2, name: new RegExp(`^${index + 1}\\. `) });
      await waitFor(() => expect(document.activeElement).toBe(heading));
    }
  });

  it('an unknown section shows the start of the guide instead of failing', async () => {
    renderApp();
    await go('#/help/no-such-section');
    const title = await h1();
    expect(title.textContent).toBe(HELP_CONTENT.en.title);
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('clicking the contents link of the section already in the address scrolls there again', async () => {
    renderApp();
    await go('#/help/glossary');
    await screen.findByRole('heading', { level: 2, name: /Words explained simply/ });
    scrolled.length = 0;
    const contents = screen.getByRole('navigation', { name: 'Contents' });
    await userEvent.click(within(contents).getByRole('link', { name: /Words explained simply/ }));
    expect(window.location.hash).toBe('#/help/glossary');
    expect(scrolled.length).toBe(1);
  });

  it('clicking a contents link moves to that section', async () => {
    renderApp();
    await go('#/help');
    const contents = await screen.findByRole('navigation', { name: 'Contents' });
    await userEvent.click(within(contents).getByRole('link', { name: /Your data and backups/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/help/data'));
    const heading = await screen.findByRole('heading', { level: 2, name: /Your data and backups/ });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('links inside the text go to other sections', async () => {
    renderApp();
    await go('#/help/about');
    const section = (await screen.findByRole('heading', { level: 2, name: /What MenuPilot is/ })).closest('section') as HTMLElement;
    const toData = within(section).getAllByRole('link', { name: /ection 10/ });
    expect(toData.length).toBeGreaterThan(0);
    for (const link of toData) expect(link.getAttribute('href')).toBe('#/help/data');
  });

  it('shows numbered steps, pictures with alt text that load lazily, and the print button works', async () => {
    renderApp();
    await go('#/help/ingredients');
    await screen.findByRole('heading', { level: 2, name: /Ingredients and their prices/ });
    const steps = screen.getAllByRole('list').filter((list) => list.tagName === 'OL');
    expect(steps.length).toBeGreaterThan(5);
    const pictures = screen.getAllByRole('img');
    expect(pictures.length).toBeGreaterThan(5);
    for (const picture of pictures) {
      expect(picture.getAttribute('loading')).toBe('lazy');
      expect(picture.getAttribute('alt')?.length).toBeGreaterThan(10);
      expect(picture.getAttribute('src')).toMatch(/^\/help\/.+\.jpg$/);
    }
    await userEvent.click(screen.getByRole('button', { name: 'Print this guide' }));
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it('shows the Back to top button only after scrolling, and it goes to the start', async () => {
    renderApp();
    await go('#/help/data');
    await screen.findByRole('heading', { level: 2, name: /Your data and backups/ });
    expect(screen.queryByRole('button', { name: 'Up to the top' })).toBeNull();
    Object.defineProperty(window, 'scrollY', { value: 2000, configurable: true });
    act(() => { fireEvent.scroll(window); });
    const up = await screen.findByRole('button', { name: 'Up to the top' });
    await userEvent.click(up);
    await waitFor(() => expect(window.location.hash).toBe('#/help'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })));
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('stays readable while the saved data cannot be opened', async () => {
    const storage = storageWith({ ...demoCopy(), version: 99 } as never);
    renderApp(storage);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your data could not be opened');
    await go('#/help/data');
    expect((await h1()).textContent).toBe(HELP_CONTENT.en.title);
    expect(screen.getByRole('heading', { level: 2, name: /Your data and backups/ })).toBeTruthy();
    expect(storage.setCalls).toBe(0);
  });
});

describe('guide layout and wording rules', () => {
  it('shows the words "What you will see:" before each result, in both languages', async () => {
    renderApp();
    await go('#/help/ingredients');
    const section = (await screen.findByRole('heading', { level: 2, name: /Ingredients and their prices/ })).closest('section') as HTMLElement;
    const results = within(section).getAllByText('What you will see:');
    expect(results.length).toBeGreaterThan(5);
    for (const label of results) expect(label.tagName).toBe('STRONG');
    await userEvent.click(screen.getByRole('button', { name: 'Русский' }));
    expect(within(section).getAllByText('Что вы увидите:').length).toBe(results.length);
  });

  it('empties the program only after the practice sections: the steps are in section 10, not 4', () => {
    const steps = (id: string) => HELP_CONTENT.en.sections.find((section) => section.id === id)?.blocks
      .filter((block) => block.kind === 'steps').map((block) => (block.kind === 'steps' ? block.title : '')) ?? [];
    expect(steps('first-start').join('|')).not.toMatch(/empty/i);
    expect(steps('data').join('|')).toMatch(/Start with your own data/);
    expect(HELP_SECTION_IDS.indexOf('data')).toBeGreaterThan(HELP_SECTION_IDS.indexOf('simulator'));
  });

  it('every section ends with a Back to contents link that goes to the start', async () => {
    renderApp();
    await go('#/help/about');
    await screen.findByRole('heading', { level: 2, name: /What MenuPilot is/ });
    const links = screen.getAllByRole('link', { name: 'Back to contents' });
    expect(links.length).toBe(HELP_SECTION_IDS.length);
    scrolled.length = 0;
    await userEvent.click(links[2] as HTMLElement);
    await waitFor(() => expect(window.location.hash).toBe('#/help'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })));
  });

  it('every picture has an Open larger link to the full file, in a new tab, reachable by keyboard', async () => {
    renderApp();
    await go('#/help/data');
    await screen.findByRole('heading', { level: 2, name: /Your data and backups/ });
    const pictures = screen.getAllByRole('img');
    const larger = screen.getAllByRole('link', { name: /^Open larger \(in a new tab\)/ });
    expect(larger.length).toBe(pictures.length);
    pictures.forEach((picture, index) => {
      const link = larger[index] as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe(picture.getAttribute('src'));
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noreferrer');
      expect(link.tabIndex).toBe(0);
      expect(link.textContent).toContain(picture.getAttribute('alt'));
    });
    await userEvent.click(screen.getByRole('button', { name: 'Русский' }));
    expect(screen.getAllByRole('link', { name: /^Открыть крупно \(в новой вкладке\)/ }).length).toBe(pictures.length);
  });
});

describe('unsaved simulator drafts and the guide', () => {
  it('a draft survives a visit to the guide through "Help for this page" and back', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    try {
      renderApp();
      await go('#/simulator/dish_classic_burger');
      await userEvent.click(await screen.findByRole('button', { name: /Add scenario/ }));
      const menuPrice = await screen.findByLabelText('Menu price (incl. VAT)');
      await userEvent.type(menuPrice, '13.83');
      expect(screen.getByRole('region', { name: 'Scenario A' })).toBeTruthy();

      await userEvent.click(screen.getByRole('link', { name: 'Help for this page' }));
      await screen.findByRole('heading', { level: 2, name: /Simulator: try/ });
      window.history.back();
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });

      const scenario = await screen.findByRole('region', { name: 'Scenario A' });
      expect((within(scenario).getByLabelText('Menu price (incl. VAT)') as HTMLInputElement).value).toBe('13.83');
      expect(within(scenario).getByText('Not saved yet.')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('"Help for this page" links', () => {
  async function linkOn(hash: string, expected: string, heading: string | RegExp) {
    renderApp();
    await go(hash);
    await screen.findByRole('heading', { level: 1, name: heading });
    expect(screen.getByRole('link', { name: 'Help for this page' }).getAttribute('href')).toBe(expected);
  }

  it('Dashboard', () => linkOn('#/', '#/help/dashboard', 'What has changed on your menu?'));
  it('Ingredients', () => linkOn('#/ingredients', '#/help/ingredients', 'Ingredients'));
  it('Recipes list', () => linkOn('#/recipes', '#/help/dishes', 'Recipes'));
  it('a dish', () => linkOn('#/recipe/dish_classic_burger', '#/help/dishes', 'Classic Burger'));
  it('a prep', () => linkOn('#/recipe/prep_burger_sauce', '#/help/preps', 'Burger sauce'));
  it('a new dish', () => linkOn('#/recipe/new?kind=dish', '#/help/dishes', 'New dish'));
  it('a new prep', () => linkOn('#/recipe/new?kind=prep', '#/help/preps', 'New prep'));
  it('Simulator: choosing a dish', () => linkOn('#/simulator', '#/help/simulator', 'Simulator'));
  it('Simulator: one dish', () => linkOn('#/simulator/dish_classic_burger', '#/help/simulator', /Simulator: Classic Burger/));
  it('Simulator: a prep', () => linkOn('#/simulator/prep_burger_sauce', '#/help/simulator', /is a prep/));
  it('Data', () => linkOn('#/data', '#/help/data', 'Data'));

  it('the link texts are the ones in the guide text', () => {
    expect(HELP_LINK_LABEL.en).toBe(HELP_CONTENT.en.ui.contextLink);
    expect(HELP_LINK_LABEL.ru).toBe(HELP_CONTENT.ru.ui.contextLink);
  });

  it('every target section exists in the guide', () => {
    for (const id of ['dashboard', 'ingredients', 'dishes', 'preps', 'simulator', 'data']) {
      expect(HELP_SECTION_IDS as readonly string[]).toContain(id);
    }
  });

  it('is shown in the language of the guide', async () => {
    window.localStorage.setItem(HELP_LANGUAGE_KEY, 'ru');
    renderApp();
    await go('#/ingredients');
    await screen.findByRole('heading', { level: 1, name: 'Ingredients' });
    expect(screen.getByRole('link', { name: HELP_LINK_LABEL.ru }).getAttribute('href')).toBe('#/help/ingredients');
  });

  it('opens the right section when clicked', async () => {
    renderApp();
    await go('#/ingredients');
    await userEvent.click(await screen.findByRole('link', { name: 'Help for this page' }));
    const heading = await screen.findByRole('heading', { level: 2, name: /Ingredients and their prices/ });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });
});

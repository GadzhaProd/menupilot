import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { HelpPage } from '@/ui/pages/HelpPage';
import { LocalModeContext } from '@/ui/data/localMode';

beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });

const languages = [
  { button: 'English', storage: 'database on this computer', old: 'Your saved data stays only in that browser', apply: 'Apply', boundary: 'malicious software' },
  { button: 'Nederlands', storage: 'database op deze computer', old: 'Je opgeslagen gegevens blijven alleen in die browser', apply: 'Toepassen', boundary: 'kwaadaardige software' },
  { button: 'Русский', storage: 'базе на этом компьютере', old: 'Они остаются только в этом браузере', apply: 'Применить', boundary: 'вредоносных программ' },
];
describe('help matches the storage mode', () => {
  for (const language of languages) {
    it(`explains local storage and confirmation in ${language.button}`, async () => {
      render(<LocalModeContext.Provider value={{ dataDir: '/tmp/restaurant-data', connection: null }}><HelpPage section={null} /></LocalModeContext.Provider>);
      await userEvent.click(screen.getByRole('button', { name: language.button }));
      const article = screen.getByRole('article');
      expect(article.textContent).toContain(language.storage);
      expect(article.textContent).not.toContain(language.old);
      expect(article.textContent).toContain('/tmp/restaurant-data');
      for (const text of ['npm start', 'Ctrl+C', 'npm run menupilot -- stop', 'npm run menupilot -- open-url', '24', language.apply, language.boundary]) expect(article.textContent).toContain(text);
      expect(within(article).getByRole('link', { name: /licen|лиценз/i }).getAttribute('href')).toBe('#/help/licenses');
    });
    it(`keeps browser help free of local-only commands in ${language.button}`, async () => {
      render(<HelpPage section={null} />);
      await userEvent.click(screen.getByRole('button', { name: language.button }));
      const article = screen.getByRole('article');
      expect(article.textContent).not.toContain('npm start');
      expect(article.textContent).not.toContain(language.storage);
    });
  }
});

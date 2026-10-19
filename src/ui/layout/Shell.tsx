import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MenuIcon } from 'lucide-react';
import { animate } from 'motion/mini';
import { Button } from '@/components/ui/button';
import { useCommands, useDataState } from '@/ui/data/DataProvider';
import { hrefFor, type Route } from '@/ui/router/routes';
import { useLocale } from '@/ui/i18n';
import { LocaleSelect } from '@/ui/i18n/LocaleSelect';
import { ThemeSelect } from '@/ui/theme/ThemeSelect';
import { useTheme } from '@/ui/theme/ThemeProvider';

const NAV = [
  { key: 'nav.dashboard', route: { name: 'dashboard' }, active: ['dashboard'] },
  { key: 'nav.simulator', route: { name: 'simulator', id: null }, active: ['simulator'] },
  { key: 'nav.recipes', route: { name: 'recipes' }, active: ['recipes', 'recipe', 'recipe-new'] },
  { key: 'nav.ingredients', route: { name: 'ingredients' }, active: ['ingredients'] },
  { key: 'nav.data', route: { name: 'data' }, active: ['data'] },
  { key: 'nav.help', route: { name: 'help', section: null }, active: ['help'] },
] as const;

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { commandError } = useDataState();
  const { dismissError } = useCommands();
  const { t, storageError: localeError } = useLocale();
  const { storageError: themeError } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const currentLink = useRef<HTMLAnchorElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setMenuOpen(false);
    // Help owns focus/scroll for its stable section anchors.
    if (route.name !== 'help') mainRef.current?.focus();
    // One small selection emphasis; theme colours and all numbers change immediately.
    if (!currentLink.current || typeof currentLink.current.animate !== 'function' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const animation = animate(currentLink.current, { textUnderlineOffset: ['8px', '5px'] }, { duration: 0.16, ease: [0.16, 1, 0.3, 1] });
    return () => animation.stop();
  }, [route]);

  return (
    <div className="min-h-svh">
      <a href="#main" onClick={(event) => { event.preventDefault(); mainRef.current?.focus(); }} className="skip-link">{t('nav.skip')}</a>
      <header className="shell-header print:hidden">
        <div className="shell-top">
          <a href={hrefFor({ name: 'dashboard' })} className="shell-brand">MenuPilot</a>
          <Button ref={menuButton} variant="outline" className="shell-menu-button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            <MenuIcon aria-hidden="true" />{t('nav.menu')}
          </Button>
          <nav id="main-navigation" aria-label={t('nav.main')} className="shell-nav" data-open={menuOpen} onKeyDown={(event) => {
            if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
          }}>
            <ul>
              {NAV.map((item, index) => {
                const current = (item.active as readonly string[]).includes(route.name);
                return <li key={item.key} className={index === 4 ? 'shell-utility-start' : undefined}>
                  <a ref={current ? currentLink : undefined} href={hrefFor(item.route)} aria-current={current ? 'page' : undefined}>{t(item.key)}</a>
                </li>;
              })}
            </ul>
          </nav>
          <div className="shell-preferences"><ThemeSelect /><LocaleSelect /></div>
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className="shell-main space-y-6">
        {(themeError || localeError) && <div role="status" className="text-sm text-muted-foreground print:hidden">
          {themeError && <p>{t('theme.storageError')}</p>}{localeError && <p>{t('locale.storageError')}</p>}
        </div>}
        {commandError && <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-destructive bg-card p-3 text-sm text-destructive">
          <p>{commandError}</p><Button variant="outline" size="xs" onClick={dismissError}>{t('common.dismiss')}</Button>
        </div>}
        {children}
      </main>
    </div>
  );
}

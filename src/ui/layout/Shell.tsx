import { LocalPlans } from '@/ui/data/LocalPlans';
import { LocalBackupStatus } from '@/ui/data/LocalBackupStatus';
import { useLocalMode } from '@/ui/data/localMode';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MenuIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCommands, useDataState } from '@/ui/data/DataProvider';
import { hrefFor, type Route } from '@/ui/router/routes';
import { useLocale } from '@/ui/i18n';
import { LocaleSelect } from '@/ui/i18n/LocaleSelect';
import { ThemeSelect } from '@/ui/theme/ThemeSelect';
import { useTheme } from '@/ui/theme/ThemeProvider';

const NAV = [
  { key: 'nav.dashboard', route: { name: 'dashboard' }, active: ['dashboard'], utility: false },
  { key: 'nav.simulator', route: { name: 'simulator', id: null }, active: ['simulator'], utility: false },
  { key: 'nav.recipes', route: { name: 'recipes' }, active: ['recipes', 'recipe', 'recipe-new'], utility: false },
  { key: 'nav.ingredients', route: { name: 'ingredients' }, active: ['ingredients'], utility: false },
  { key: 'nav.data', route: { name: 'data' }, active: ['data'], utility: true },
  { key: 'nav.help', route: { name: 'help', section: null }, active: ['help'], utility: true },
] as const;

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { commandError } = useDataState();
  const { dismissError } = useCommands();
  const local = useLocalMode();
  const { t, locale, storageError: localeError } = useLocale();
  const { storageError: themeError } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const previousRoute = useRef(route);

  useEffect(() => {
    if (previousRoute.current === route) return;
    previousRoute.current = route;
    setMenuOpen(false);
    // Help owns focus/scroll for its stable section anchors.
    if (route.name !== 'help') mainRef.current?.focus();
  }, [route]);

  return (
    <div className="min-h-svh">
      <a href="#main" onClick={(event) => { event.preventDefault(); mainRef.current?.focus(); }} className="skip-link">{t('nav.skip')}</a>
      <header className="shell-header print:hidden" onKeyDown={(event) => {
        if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
      }}>
        <div className="shell-top">
          <a href={hrefFor({ name: 'dashboard' })} className="shell-brand">MenuPilot</a>
          <Button ref={menuButton} variant="outline" className="shell-menu-button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            <MenuIcon aria-hidden="true" />{t('nav.menu')}
          </Button>
          <nav id="main-navigation" aria-label={t('nav.main')} className="shell-nav" data-open={menuOpen}>
            <ul>
              {NAV.map((item) => {
                const current = (item.active as readonly string[]).includes(route.name);
                return <li key={item.key} className={item.utility ? 'shell-utility' : undefined}>
                  <a href={hrefFor(item.route)} aria-current={current ? 'page' : undefined}>{t(item.key)}</a>
                </li>;
              })}
            </ul>
          </nav>
          <div className="shell-preferences"><ThemeSelect /><LocaleSelect /></div>
        </div>
        {local && <div className="mx-auto max-w-7xl px-4 pb-2 text-xs text-muted-foreground break-all" data-testid="local-mode">
          {locale === 'nl' ? 'Lokale modus · gegevens: ' : 'Local mode · data: '}{local.dataDir}
        </div>}
        {local && <LocalBackupStatus />}
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className="shell-main space-y-6">
        {local?.connection && <p role="status" className="rounded-md border p-3 text-sm">
          {local.connection === 'session-expired'
            ? (locale === 'nl' ? 'MenuPilot is opnieuw gestart. Kopieer niet-opgeslagen invoer en open MenuPilot opnieuw met npm run menupilot -- open-url.' : 'MenuPilot restarted. Copy any unsaved drafts, then open it again with npm run menupilot -- open-url.')
            : (locale === 'nl' ? 'De lokale server is niet bereikbaar. Houd deze pagina open en start npm start. Je invoer blijft hier bewaard.' : 'The local server is unavailable. Keep this page open and run npm start. Your drafts remain here.')}
        </p>}
        {(themeError || localeError) && <div role="status" className="text-sm text-muted-foreground print:hidden">
          {themeError && <p>{t('theme.storageError')}</p>}{localeError && <p>{t('locale.storageError')}</p>}
        </div>}
        {commandError && <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-destructive bg-card p-3 text-sm text-destructive">
          <p>{commandError}</p><Button variant="outline" size="xs" onClick={dismissError}>{t('common.dismiss')}</Button>
        </div>}
        {local && <LocalPlans />}
        {children}
      </main>
    </div>
  );
}

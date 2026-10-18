import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useCommands, useDataState } from '@/ui/data/DataProvider';
import { hrefFor, type Route } from '@/ui/router/routes';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Dashboard', route: { name: 'dashboard' }, active: ['dashboard'] },
  { label: 'Ingredients', route: { name: 'ingredients' }, active: ['ingredients'] },
  { label: 'Recipes', route: { name: 'recipes' }, active: ['recipes', 'recipe', 'recipe-new'] },
  { label: 'Simulator', route: { name: 'simulator', id: null }, active: ['simulator'] },
  { label: 'Data', route: { name: 'data' }, active: ['data'] },
] as const;

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { commandError } = useDataState();
  const { dismissError } = useCommands();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // After the user navigates, move focus to the new page (keyboard and screen-reader users).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [route]);

  return (
    <div className="min-h-svh">
      <a
        href="#main"
        onClick={(event) => { event.preventDefault(); mainRef.current?.focus(); }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <a href={hrefFor({ name: 'dashboard' })} className="rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            MenuPilot
          </a>
          <nav aria-label="Main">
            <ul className="flex flex-wrap gap-1">
              {NAV.map((item) => {
                const current = (item.active as readonly string[]).includes(route.name);
                return (
                  <li key={item.label}>
                    <Button asChild variant={current ? 'secondary' : 'ghost'} size="sm">
                      <a href={hrefFor(item.route)} aria-current={current ? 'page' : undefined}>{item.label}</a>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className={cn('mx-auto max-w-6xl space-y-4 px-4 py-6 outline-none')}>
        {commandError && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <p>{commandError}</p>
            <Button variant="outline" size="xs" onClick={dismissError}>Dismiss</Button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

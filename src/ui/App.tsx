import { useLocale, type TranslationKey } from '@/ui/i18n';
import { Component, type ErrorInfo, lazy, type ReactNode, Suspense, useEffect } from 'react';
import { useDataState } from '@/ui/data/DataProvider';
import { Shell } from '@/ui/layout/Shell';
import { DashboardPage } from '@/ui/pages/DashboardPage';
import { DataPage } from '@/ui/pages/DataPage';
import { IngredientsPage } from '@/ui/pages/IngredientsPage';
import { NotFoundPage } from '@/ui/pages/NotFoundPage';
import { RecipePage } from '@/ui/pages/RecipePage';
import { RecipesPage } from '@/ui/pages/RecipesPage';
import { SimulatorPage } from '@/ui/pages/SimulatorPage';
import type { Route } from '@/ui/router/routes';
import { SimulatorSessionProvider } from '@/ui/simulator/session';
import { useRoute } from '@/ui/router/useRoute';

// The guide is large (text and its Russian twin), so it is downloaded only when somebody opens it.
const HelpPage = lazy(() => import('@/ui/pages/HelpPage').then((module) => ({ default: module.HelpPage })));

const TITLES = {
  dashboard: 'nav.dashboard',
  ingredients: 'nav.ingredients',
  data: 'nav.data',
  recipes: 'nav.recipes',
  'recipe-new': 'page.newRecipe',
  recipe: 'page.recipe',
  simulator: 'nav.simulator',
  help: 'nav.help',
  'not-found': 'page.notFound',
} as const satisfies Record<Route['name'], TranslationKey>;

interface ErrorBoundaryProps {
  children: ReactNode;
  onReload?: () => void;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render failed.', error, info.componentStack);
  }

  private reload = () => {
    if (this.props.onReload) this.props.onReload();
    else window.location.reload();
  };

  render() {
    if (this.state.failed) {
      return (
        <ErrorFallback reload={this.reload} />
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({ reload }: { reload(): void }) {
  const { t } = useLocale();
  return <main className="mx-auto max-w-3xl space-y-4 p-6">
    <h1 className="text-2xl font-semibold">{t('error.title')}</h1>
    <p className="text-sm text-muted-foreground">{t('error.reloadHint')}</p>
    <button type="button" onClick={reload} className="min-h-12 rounded-md bg-primary px-4 py-2 text-primary-foreground">{t('error.reload')}</button>
  </main>;
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'dashboard': return <DashboardPage />;
    case 'ingredients': return <IngredientsPage />;
    case 'data': return <DataPage />;
    case 'recipes': return <RecipesPage />;
    case 'recipe-new': return <RecipePage id={null} kind={route.kind} />;
    case 'recipe': return <RecipePage id={route.id} />;
    case 'simulator': return <SimulatorPage id={route.id} />;
    case 'help': return <HelpPage section={route.section} />;
    case 'not-found': return <NotFoundPage />;
  }
}

function LoadError({ message }: { message: string }) {
  const { t } = useLocale();
  return (
    <section aria-labelledby="page-title" className="space-y-3">
      <h1 id="page-title" className="text-2xl font-semibold">
        {t('error.dataTitle')}
      </h1>
      <p
        role="alert"
        className={[
          'rounded-md border border-destructive/40 bg-destructive/5',
          'p-3 text-sm text-destructive',
        ].join(' ')}
      >
        {message}
      </p>
      <p className="text-sm text-muted-foreground">
        {t('error.dataKept')}
      </p>
    </section>
  );
}

export function App() {
  const { t } = useLocale();
  const route = useRoute();
  const { loadError } = useDataState();

  useEffect(() => {
    document.title = `${t(TITLES[route.name])} · MenuPilot`;
  }, [route, t]);

  return (
    <ErrorBoundary>
      {/* One provider above every route, so unsaved scenario drafts survive a visit to the guide. */}
      <SimulatorSessionProvider>
        <Shell route={route}>
          {route.name === 'help' ? (
            // The guide needs no saved data, so it stays readable when the data cannot be opened.
            <Suspense fallback={<p role="status" className="text-lg">{t('help.loading')}</p>}>
              <HelpPage section={route.section} />
            </Suspense>
          ) : loadError === null ? (
            <Page route={route} />
          ) : (
            <LoadError message={loadError} />
          )}
        </Shell>
      </SimulatorSessionProvider>
    </ErrorBoundary>
  );
}

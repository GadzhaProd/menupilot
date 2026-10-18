import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react';
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

const TITLES: Record<Route['name'], string> = {
  dashboard: 'Dashboard',
  ingredients: 'Ingredients',
  data: 'Data',
  recipes: 'Recipes',
  'recipe-new': 'New recipe',
  recipe: 'Recipe',
  simulator: 'Simulator',
  'not-found': 'Not found',
};

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
        <main className="mx-auto max-w-3xl space-y-4 p-6">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            Reload the app to try again. Your saved data was not changed.
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            Reload
          </button>
        </main>
      );
    }

    return this.props.children;
  }
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
    case 'not-found': return <NotFoundPage />;
  }
}

function LoadError({ message }: { message: string }) {
  return (
    <section aria-labelledby="page-title" className="space-y-3">
      <h1 id="page-title" className="text-2xl font-semibold">
        Your data could not be opened
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
        Nothing was changed or deleted. Your saved data is still in the browser.
      </p>
    </section>
  );
}

export function App() {
  const route = useRoute();
  const { loadError } = useDataState();

  useEffect(() => {
    document.title = `${TITLES[route.name]} · MenuPilot`;
  }, [route]);

  return (
    <ErrorBoundary>
      <Shell route={route}>
        {loadError === null ? (
          <SimulatorSessionProvider>
            <Page route={route} />
          </SimulatorSessionProvider>
        ) : (
          <LoadError message={loadError} />
        )}
      </Shell>
    </ErrorBoundary>
  );
}

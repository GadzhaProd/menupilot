import { useEffect } from 'react';
import { useDataState } from '@/ui/data/DataProvider';
import { Shell } from '@/ui/layout/Shell';
import { DashboardPage } from '@/ui/pages/DashboardPage';
import { IngredientsPage } from '@/ui/pages/IngredientsPage';
import { NotFoundPage } from '@/ui/pages/NotFoundPage';
import { RecipePage } from '@/ui/pages/RecipePage';
import { RecipesPage } from '@/ui/pages/RecipesPage';
import { SimulatorPage } from '@/ui/pages/SimulatorPage';
import type { Route } from '@/ui/router/routes';
import { useRoute } from '@/ui/router/useRoute';

const TITLES: Record<Route['name'], string> = {
  dashboard: 'Dashboard',
  ingredients: 'Ingredients',
  recipes: 'Recipes',
  'recipe-new': 'New recipe',
  recipe: 'Recipe',
  simulator: 'Simulator',
  'not-found': 'Not found',
};

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'dashboard': return <DashboardPage />;
    case 'ingredients': return <IngredientsPage />;
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
      <h1 id="page-title" className="text-2xl font-semibold">Your data could not be opened</h1>
      <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{message}</p>
      <p className="text-sm text-muted-foreground">Nothing was changed or deleted. Your saved data is still in the browser.</p>
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
    <Shell route={route}>
      {loadError === null ? <Page route={route} /> : <LoadError message={loadError} />}
    </Shell>
  );
}

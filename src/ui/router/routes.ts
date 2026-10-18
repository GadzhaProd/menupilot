/** The whole route table, addressed by the URL hash (works on GitHub Pages). */
export type Route =
  | { name: 'dashboard' }
  | { name: 'ingredients' }
  /** The list of dishes and preps, with "New dish" / "New prep". */
  | { name: 'recipes' }
  /** `#/recipe/new?kind=dish|prep`: the empty form for a new recipe. */
  | { name: 'recipe-new'; kind: 'dish' | 'prep' }
  | { name: 'recipe'; id: string }
  /** `id: null` is the bare "Simulator" menu entry: pick a dish first. */
  | { name: 'simulator'; id: string | null }
  | { name: 'not-found'; path: string };

export function parseHash(hash: string): Route {
  const [location = '', query = ''] = hash.replace(/^#/, '').split('?', 2);
  const path = location.replace(/^\/+/, '').replace(/\/+$/, '');
  if (path === '') return { name: 'dashboard' };
  const parts = path.split('/');
  const [head, id] = parts;
  if (parts.length === 1 && head === 'ingredients') return { name: 'ingredients' };
  if (parts.length === 1 && head === 'recipes') return { name: 'recipes' };
  if (parts.length === 2 && head === 'recipe' && id === 'new') {
    const kind = new URLSearchParams(query).get('kind') ?? 'dish';
    return kind === 'dish' || kind === 'prep' ? { name: 'recipe-new', kind } : { name: 'not-found', path };
  }
  if (parts.length === 1 && head === 'simulator') return { name: 'simulator', id: null };
  if (parts.length === 2 && id && (head === 'recipe' || head === 'simulator')) {
    try {
      return { name: head, id: decodeURIComponent(id) };
    } catch {
      return { name: 'not-found', path };
    }
  }
  return { name: 'not-found', path };
}

export function hrefFor(route: Exclude<Route, { name: 'not-found' }>): string {
  switch (route.name) {
    case 'dashboard': return '#/';
    case 'ingredients': return '#/ingredients';
    case 'recipes': return '#/recipes';
    case 'recipe-new': return `#/recipe/new?kind=${route.kind}`;
    case 'recipe': return `#/recipe/${encodeURIComponent(route.id)}`;
    case 'simulator': return route.id === null ? '#/simulator' : `#/simulator/${encodeURIComponent(route.id)}`;
  }
}

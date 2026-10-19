import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash } from '@/ui/router/routes';
import { renderApp } from './helpers';

describe('parseHash', () => {
  it.each([
    ['', { name: 'dashboard' }],
    ['#', { name: 'dashboard' }],
    ['#/', { name: 'dashboard' }],
    ['#/ingredients', { name: 'ingredients' }],
    ['#/ingredients/', { name: 'ingredients' }],
    ['#/recipe/dish_classic_burger', { name: 'recipe', id: 'dish_classic_burger' }],
    ['#/simulator/dish_classic_burger', { name: 'simulator', id: 'dish_classic_burger' }],
    ['#/simulator', { name: 'simulator', id: null }],
    ['#/recipe/a%20b', { name: 'recipe', id: 'a b' }],
    ['#/data', { name: 'data' }],
    ['#/recipes', { name: 'recipes' }],
    ['#/recipe/new', { name: 'recipe-new', kind: 'dish' }],
    ['#/recipe/new?kind=dish', { name: 'recipe-new', kind: 'dish' }],
    ['#/recipe/new?kind=prep', { name: 'recipe-new', kind: 'prep' }],
    ['#/help', { name: 'help', section: null }],
    ['#/help/', { name: 'help', section: null }],
    ['#/help/dishes', { name: 'help', section: 'dishes' }],
    ['#/help/no-such-section', { name: 'help', section: 'no-such-section' }],
    ['#/help/%E0%A4%A', { name: 'help', section: null }],
  ])('%s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it.each(['#/nope', '#/recipe', '#/recipe/new?kind=soup', '#/recipes/x', '#/data/x', '#/recipe/a/b', '#/ingredients/x', '#/recipe/%E0%A4%A', '#//recipe//', '#/help/a/b', '#/helps'])(
    '%s is not found',
    (hash) => {
      expect(parseHash(hash).name).toBe('not-found');
    },
  );

  it('hrefFor round-trips with parseHash', () => {
    for (const route of [
      { name: 'dashboard' }, { name: 'ingredients' }, { name: 'recipe', id: 'a b/c' },
      { name: 'simulator', id: 'x' }, { name: 'simulator', id: null },
      { name: 'recipes' }, { name: 'recipe-new', kind: 'dish' }, { name: 'recipe-new', kind: 'prep' },
      { name: 'data' }, { name: 'help', section: null }, { name: 'help', section: 'simulator' },
    ] as const) {
      expect(parseHash(hrefFor(route))).toEqual(route);
    }
  });
});

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });

async function go(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('routing in the app', () => {
  it('shows each screen', async () => {
    renderApp();
    expect(await heading('Dashboard')).toBeTruthy();
    await go('#/ingredients');
    expect(await heading('Ingredients')).toBeTruthy();
    await go('#/recipe/dish_classic_burger');
    expect(await heading('Classic Burger')).toBeTruthy();
    await go('#/simulator/dish_classic_burger');
    expect(await heading(/Simulator: Classic Burger/)).toBeTruthy();
    await go('#/recipes');
    expect(await heading('Recipes')).toBeTruthy();
    await go('#/data');
    expect(await heading('Data')).toBeTruthy();
    await go('#/recipe/new?kind=prep');
    expect(await heading('New prep')).toBeTruthy();
    await go('#/recipe/new?kind=dish');
    expect(await heading('New dish')).toBeTruthy();
  });

  it('an unknown route or id shows a clear "not found" page', async () => {
    renderApp();
    await go('#/nope');
    expect(await heading('Not found')).toBeTruthy();
    await go('#/recipe/does_not_exist');
    expect(await heading('Not found')).toBeTruthy();
    expect(screen.getByText(/this recipe does not exist/i)).toBeTruthy();
    await go('#/simulator/does_not_exist');
    expect(screen.getByText(/this dish does not exist/i)).toBeTruthy();
    // A prep is not a dish, so it cannot be simulated: the page says so instead of "not found".
    await go('#/simulator/prep_burger_sauce');
    expect(await heading(/is a prep/)).toBeTruthy();
  });

  it('follows Back and Forward', async () => {
    renderApp();
    await go('#/ingredients');
    await go('#/simulator');
    expect(await heading('Simulator')).toBeTruthy();

    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(await heading('Ingredients')).toBeTruthy();

    await act(async () => {
      window.history.forward();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(await heading('Simulator')).toBeTruthy();
  });

  it('menu links navigate and mark the current page', async () => {
    renderApp();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await userEvent.click(nav.querySelector('a[href="#/ingredients"]') as HTMLElement);
    expect(await heading('Ingredients')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ingredients' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBeNull();
  });
});

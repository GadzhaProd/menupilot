import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { demoCopy, go, renderApp, storageWith } from './helpers';

beforeEach(() => { window.location.hash = ''; });

function emptyStorage() {
  const doc = demoCopy();
  doc.ingredients = [];
  doc.recipes = [];
  doc.scenarios = [];
  return storageWith(doc);
}

describe('empty states offer the next step', () => {
  it('Dashboard links to a new dish', async () => {
    (await renderApp(emptyStorage()));
    const link = screen.getByRole('link', { name: 'Add your first dish' });
    expect(link.getAttribute('href')).toBe('#/recipe/new?kind=dish');
  });

  it('Ingredients has an add button', async () => {
    (await renderApp(emptyStorage()));
    await go('#/ingredients');
    expect(await screen.findByText('No ingredients yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add your first ingredient' })).toBeTruthy();
  });

  it('Recipes and Simulator link to a new dish', async () => {
    (await renderApp(emptyStorage()));
    await go('#/recipes');
    expect(await screen.findByRole('heading', { name: 'No dishes yet' })).toBeTruthy();
    expect(screen.getByText('Add your first dish to start checking recipe-based ingredient costs.')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /New dish/ })).toHaveLength(2);
    await go('#/simulator');
    expect(await screen.findByText('No dishes to simulate yet')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /New dish/ })).toHaveLength(1);
  });
});

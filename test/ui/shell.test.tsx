import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from './helpers';

describe('Shell', () => {
  it('has landmarks, a skip link and a labelled main navigation', () => {
    renderApp();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
  });

  it('moves focus to the page content after navigating, and updates the title', async () => {
    renderApp();
    expect(document.activeElement).toBe(document.body);
    await userEvent.click(screen.getByRole('link', { name: 'Ingredients' }));
    await screen.findByRole('heading', { level: 1, name: 'Ingredients' });
    expect(document.activeElement).toBe(screen.getByRole('main'));
    expect(document.title).toBe('Ingredients · MenuPilot');
  });

  it('the skip link focuses the main content', async () => {
    renderApp();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Skip to content' }));
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

it.each(['Theme', 'EN – English', 'Menu', 'Ingredients'])('Escape closes the menu from %s and restores its trigger', async (name) => {
  renderApp();
  const menu = screen.getByRole('button', { name: 'Menu' });
  await userEvent.click(menu);
  expect(menu.getAttribute('aria-expanded')).toBe('true');
  const target = name === 'Theme' ? screen.getByRole('combobox', { name })
    : name === 'Ingredients' ? screen.getByRole('link', { name }) : screen.getByRole('button', { name });
  target.focus();
  await userEvent.keyboard('{Escape}');
  expect(menu.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(menu);
});

const animation = vi.hoisted(() => vi.fn(() => ({ stop: vi.fn() })));
vi.mock('motion/mini', () => ({ animate: animation }));
it('does not steal initial focus in StrictMode and stops selection motion on navigation/unmount', async () => {
  const original = HTMLElement.prototype.animate;
  HTMLElement.prototype.animate = vi.fn();
  animation.mockClear();
  try {
    const view = renderApp(undefined, { strict: true });
    expect(document.activeElement).toBe(document.body);
    await userEvent.click(screen.getByRole('link', { name: 'Recipes' }));
    expect(animation).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('link', { name: 'Ingredients' }));
    expect(animation.mock.results[0]!.value.stop).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(animation.mock.results[1]!.value.stop).toHaveBeenCalledTimes(1);
  } finally {
    if (original) HTMLElement.prototype.animate = original;
    else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  }
});

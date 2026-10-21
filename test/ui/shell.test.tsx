import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { go, renderApp } from './helpers';

describe('Shell', () => {
  it('has landmarks, a skip link and a labelled main navigation', async () => {
    (await renderApp());
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'What has changed on your menu?' })).toBeTruthy();
  });

  it('moves focus to the page content after navigating, and updates the title', async () => {
    (await renderApp());
    expect(document.activeElement).toBe(document.body);
    await userEvent.click(screen.getByRole('link', { name: 'Ingredients' }));
    await screen.findByRole('heading', { level: 1, name: 'Ingredients' });
    expect(document.activeElement).toBe(screen.getByRole('main'));
    expect(document.title).toBe('Ingredients · MenuPilot');
  });

  it('the skip link focuses the main content', async () => {
    (await renderApp());
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Skip to content' }));
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });
});

it.each(['Theme', 'EN – English', 'Menu', 'Ingredients'])('Escape closes the menu from %s and restores its trigger', async (name) => {
  (await renderApp());
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

// Reproduce the browser's WAAPI failure when Motion commits a hidden/detached target.
const animation = vi.hoisted(() => vi.fn((target: HTMLElement) => ({ stop: vi.fn(() => {
  if (!target.isConnected || target.closest('nav')?.style.display === 'none') {
    throw new DOMException("Failed to execute 'commitStyles': Target element is not rendered", 'InvalidStateError');
  }
}) })));
vi.mock('motion/mini', () => ({ animate: animation }));
it('keeps navigation alive when resize hides an animated link, and when Shell unmounts', async () => {
  const original = HTMLElement.prototype.animate;
  HTMLElement.prototype.animate = vi.fn();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  try {
    const view = (await renderApp(undefined, { strict: true }));
    expect(document.activeElement).toBe(document.body);
    await go('#/recipes');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    // jsdom has no layout: emulate the display:none applied by the 375px breakpoint.
    nav.style.display = 'none';
    window.dispatchEvent(new Event('resize'));
    await go('#/');
    await go('#/simulator');
    expect(screen.getByRole('main')).toBeTruthy();
    expect(document.title).toBe('Simulator · MenuPilot');
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Simulator' })).toBeTruthy();
    nav.style.display = '';
    window.dispatchEvent(new Event('resize'));
    await userEvent.click(screen.getByRole('button', { name: 'NL – Nederlands' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Thema' }), 'dark');
    expect(document.documentElement.lang).toBe('nl');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await go('#/');
    expect(screen.getByRole('main')).toBeTruthy();
    expect(() => view.unmount()).not.toThrow();
  } finally {
    if (original) HTMLElement.prototype.animate = original;
    else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    vi.unstubAllGlobals();
  }
});

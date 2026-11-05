import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { HelpPage } from '@/ui/pages/HelpPage';
afterEach(() => vi.unstubAllGlobals());
it('opens the complete license text inside Help, with heading focus and a return link', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: 'MIT License\nCopyright shadcn\nApache License\n<license text>' }))));
  render(<HelpPage section="licenses" />);
  const text = await screen.findByText(/Copyright shadcn/);
  expect(text.tagName).toBe('PRE');
  expect(text.textContent).toContain('<license text>');
  expect(screen.getByRole('link', { name: 'Back to contents' }).getAttribute('href')).toBe('#/help');
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Third-party licenses' })));
  expect(fetch).toHaveBeenCalledWith('/THIRD_PARTY_LICENSES.json', expect.objectContaining({ signal: expect.any(AbortSignal) }));
});
it('reports a failed license request and lets the owner retry', async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(new Response(JSON.stringify({ text: 'MIT License recovered' })));
  vi.stubGlobal('fetch', request);
  render(<HelpPage section="licenses" />);
  expect((await screen.findByRole('alert')).textContent).toMatch(/Could not load/);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('MIT License recovered')).toBeTruthy();
});
it('returns focus to the guide heading after leaving licenses', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: 'MIT License' }))));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const view = render(<HelpPage section="licenses" />);
  await screen.findByText('MIT License');
  view.rerender(<HelpPage section={null} />);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })));
});

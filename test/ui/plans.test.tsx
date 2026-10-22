import { test, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalPlans } from '@/ui/data/LocalPlans';
import { LocalModeContext } from '@/ui/data/localMode';
import { LocaleProvider } from '@/ui/i18n/LocaleProvider';
import { memoryStorage } from './helpers';
const plan = { id: 'plan1', status: 'pending', ingredient: { id: 'i1', name: 'Flour', unit: 'g' }, source: 'cli', expiresAt: '2099-01-01T12:00:00Z',
  price: { packPriceCents: '1800', packSizeMilli: 1000000 }, previousPrice: null,
  proposedPrice: { packPriceCents: '1800', packSizeMilli: 1000000, unitPrice: { cents: '1800', per: 'kg' } },
  effects: { dishes: [], preps: [], totalMonthlyImpactCents: null, excludedWithoutVolume: 0, excludedWithVolume: 0 } };
afterEach(() => vi.unstubAllGlobals());
function mount() { return render(<LocaleProvider storage={memoryStorage()}><LocalModeContext.Provider value={{ dataDir: '/tmp', token: 'a'.repeat(64), connection: null }}><LocalPlans /></LocalModeContext.Provider></LocaleProvider>); }
test('plans panel requires focused confirmation before applying and reports success', async () => {
  const user = userEvent.setup();
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url); return new Response(JSON.stringify(url.endsWith('/apply') ? { receipt: {} } : [plan]), { status: 200 });
  }));
  mount(); await screen.findByRole('heading', { name: 'Awaiting your confirmation' });
  expect(screen.getByText(/€18.00\/kg/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /^Apply$/ }));
  expect(calls.some(url => url.endsWith('/apply'))).toBe(false);
  const dialog = screen.getByRole('alertdialog'); expect(dialog.contains(document.activeElement)).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Confirm apply' }));
  await waitFor(() => expect(calls.some(url => url.endsWith('/apply'))).toBe(true));
  await screen.findByText('Price applied.');
});
test('plans panel shows stale/expired advice and does not enable apply', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ ...plan, status: 'stale' }, { ...plan, id: 'p2', status: 'expired' }]), { status: 200 })));
  mount(); await screen.findByText('Data changed. Ask the agent to propose again.');
  expect(screen.getByText('This plan expired. Ask the agent to propose again.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
});

test('plans rejection has its own confirmation and stale apply failure stays visible', async () => {
  const user = userEvent.setup(); const actions: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/apply')) return new Response(JSON.stringify({ code: 'plan-stale', message: 'stale' }), { status: 400 });
    if (url.endsWith('/reject')) actions.push('reject');
    return new Response(JSON.stringify(url.endsWith('/reject') ? { ...plan, status: 'rejected' } : [plan]), { status: 200 });
  }));
  mount(); await screen.findByRole('button', { name: /^Apply$/ });
  await user.click(screen.getByRole('button', { name: /^Apply$/ }));
  await user.click(screen.getByRole('button', { name: 'Confirm apply' }));
  await screen.findByText('Data changed. Ask the agent to propose again.');
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: /^Reject$/ }));
  expect(actions).toEqual([]);
  await user.click(screen.getByRole('button', { name: 'Confirm rejection' }));
  await screen.findByText('Proposal rejected.'); expect(actions).toEqual(['reject']);
});

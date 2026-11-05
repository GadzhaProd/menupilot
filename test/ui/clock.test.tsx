import { useRef, useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { useNow } from '@/ui/data/DataProvider';
import { renderApp } from './helpers';

function ClockProbe() {
  const now = useNow();
  const prior = useRef(now);
  const [renders, setRenders] = useState(0);
  const stable = prior.current === now;
  prior.current = now;
  return <button onClick={() => setRenders(value => value + 1)}>{stable ? `stable ${renders}` : `changed ${renders}`}</button>;
}

it('keeps the injected Date stable within a day and updates when its day changes', async () => {
  let instant = new Date('2027-01-31T12:00:00.000Z');
  await renderApp(undefined, { children: <ClockProbe />, now: () => instant });
  const user = userEvent.setup();
  const button = screen.getByRole('button', { name: 'stable 0' });
  await user.click(button);
  expect(button.textContent).toBe('stable 1');
  instant = new Date('2027-02-01T00:00:00.000Z');
  await user.click(button);
  expect(button.textContent).toBe('changed 2');
});

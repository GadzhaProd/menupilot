import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/ui/App';

function BrokenPage(): never {
  throw new Error('unexpected rendering problem');
}

describe('application error boundary', () => {
  it('shows a clear fallback and offers a reload action', () => {
    const reload = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary onReload={reload}>
        <BrokenPage />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledOnce();

    reload.mockRestore();
    consoleError.mockRestore();
  });
});

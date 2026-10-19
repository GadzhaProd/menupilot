import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
/** Persistent feedback. Critical errors use alert; success/info use a polite status. */
export function InlineStatus({ children, tone = 'info', className }: { children: ReactNode; tone?: 'info' | 'success' | 'error'; className?: string }) {
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-lg border bg-surface p-4 text-sm', tone === 'error' ? 'border-negative text-negative' : tone === 'success' ? 'border-positive text-positive' : 'border-line text-foreground', className)}>{children}</div>;
}

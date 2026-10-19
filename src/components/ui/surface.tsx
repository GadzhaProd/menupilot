import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
/** A shared work surface; compose sections on it instead of nesting cards. */
export function Surface({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('border-y border-line bg-surface p-6', className)} {...props} />;
}

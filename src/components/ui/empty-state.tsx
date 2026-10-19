import { useId, type ReactNode } from 'react';
export function EmptyState({ title, description, action }: { title: string; description: ReactNode; action?: ReactNode }) {
  const id = useId();
  return <section aria-labelledby={id} className="space-y-3 border-y border-line py-8">
    <h2 id={id} className="text-xl font-semibold">{title}</h2><p className="max-w-prose text-muted-foreground">{description}</p>{action}
  </section>;
}

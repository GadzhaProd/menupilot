import { Button } from '@/components/ui/button';
import { hrefFor } from '@/ui/router/routes';

export function NotFoundPage({ what = 'page' }: { what?: string }) {
  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <h1 id="page-title" className="text-2xl font-semibold">Not found</h1>
      <p className="text-muted-foreground">This {what} does not exist. It may have been deleted, or the link is wrong.</p>
      <Button asChild>
        <a href={hrefFor({ name: 'dashboard' })}>Back to Dashboard</a>
      </Button>
    </section>
  );
}

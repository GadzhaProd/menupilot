import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { DashboardPrepRow } from '@/ui/domain/dashboard';
import { hrefFor } from '@/ui/router/routes';

interface PrepCostListProps {
  rows: readonly DashboardPrepRow[];
}

export function PrepCostList({ rows }: PrepCostListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preps</CardTitle>
        <CardDescription>
          Recipe-based ingredient cost per kg, l or pc.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p>No preps yet.</p>
        ) : (
          <div className="divide-y">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid gap-2 py-3 sm:grid-cols-3"
              >
                <a
                  href={hrefFor({ name: 'recipe', id: row.id })}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {row.name}
                </a>
                <span>
                  Current cost (excl. VAT): {row.current ?? 'cost unknown'}
                </span>
                <span>
                  Cost on comparison date (excl. VAT):{' '}
                  {row.noPriceOnDate
                    ? 'no price on this date'
                    : row.comparison ?? 'cost unknown'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

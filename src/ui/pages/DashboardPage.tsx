import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useDocument } from '@/ui/data/DataProvider';
import { dashboardData } from '@/ui/domain/dashboard';
import { ComparisonPicker } from '@/ui/dashboard/ComparisonPicker';
import { DishImpactCards } from '@/ui/dashboard/DishImpactCards';
import { DishImpactTable } from '@/ui/dashboard/DishImpactTable';
import { PrepCostList } from '@/ui/dashboard/PrepCostList';
import { SummaryCards } from '@/ui/dashboard/SummaryCards';
import { formatCents } from '@/ui/dashboard/format';
import { HelpLink } from '@/ui/help/HelpLink';
import { hrefFor } from '@/ui/router/routes';

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setTime(date.getTime() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function isSelectableDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const year = Number(date.slice(0, 4));
  if (year < 1000 || year > 9999) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return parsed.toISOString().slice(0, 10) === date
    && date <= new Date().toISOString().slice(0, 10);
}

export function DashboardPage() {
  const document = useDocument();
  const [comparisonDate, setComparisonDate] = useState(() => dateDaysAgo(30));
  const [quickDays, setQuickDays] = useState('30');
  const comparisonInstant = `${comparisonDate}T23:59:59.999Z`;
  const data = useMemo(
    () => dashboardData(document, comparisonInstant),
    [document, comparisonInstant],
  );

  function selectPreset(days: number) {
    setQuickDays(String(days));
    setComparisonDate(dateDaysAgo(days));
  }

  function selectDate(date: string) {
    if (!isSelectableDate(date)) return;
    setQuickDays('');
    setComparisonDate(date);
  }

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="space-y-1">
        <h1 id="page-title" className="text-2xl font-semibold">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Recipe composition is current; only prices differ
        </p>
        <p className="text-sm text-muted-foreground">
          Recipe-based ingredient cost is theoretical, based on your recipes.
          Prices are excl. VAT unless marked incl. VAT.
        </p>
        <HelpLink section="dashboard" />
      </div>

      <ComparisonPicker
        comparisonDate={comparisonDate}
        quickDays={quickDays}
        onPreset={selectPreset}
        onDateChange={selectDate}
      />
      <SummaryCards data={data} />

      <Card>
        <CardHeader>
          <CardTitle>Dishes</CardTitle>
          <CardDescription>
            Contribution is before other costs. Monthly impact uses your volume
            estimate and is not a forecast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.dishes.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No dishes yet. Add a dish to see how supplier prices change its cost.
              </p>
              <Button asChild size="sm">
                <a href={hrefFor({ name: 'recipe-new', kind: 'dish' })}>Add your first dish</a>
              </Button>
            </div>
          ) : (
            <>
              <DishImpactTable
                rows={data.dishes}
                comparisonDate={comparisonDate}
              />
              <DishImpactCards rows={data.dishes} />
            </>
          )}
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t pt-4 text-sm">
            <span>Menu monthly impact (dishes with a volume estimate)</span>
            <strong>
              {formatCents(data.totalMonthlyImpactCents)}
              {data.excludedWithVolume > 0 && ' (incomplete)'}
            </strong>
            <span>{data.excludedWithoutVolume} {data.excludedWithoutVolume === 1 ? 'dish' : 'dishes'} without volume excluded</span>
            {data.excludedWithVolume > 0 && (
              <span>
                {data.excludedWithVolume} {data.excludedWithVolume === 1 ? 'dish' : 'dishes'} excluded: {' '}
                {data.excludedReasons.join(', ')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <PrepCostList rows={data.preps} />

      <p className="text-xs text-muted-foreground">
        Food cost is an operational reference. NL horeca average ≈ 30% (Sligro,
        2025); this is not a target or rule.{' '}
        <a
          className="underline"
          href="https://www.sligro.nl/inspiratie/rendement-kosten/kengetallen.html"
          target="_blank"
          rel="noreferrer"
        >
          Sligro reference
        </a>
      </p>
    </section>
  );
}

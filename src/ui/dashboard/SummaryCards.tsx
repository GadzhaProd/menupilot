import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { DashboardData } from '@/ui/domain/dashboard';
import { formatCents, formatPercentTenths } from './format';

interface SummaryCardsProps {
  data: DashboardData;
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const cards = [
    ['Dishes that got more expensive', String(data.gotMoreExpensive)],
    ['Monthly impact at your volume', formatCents(data.totalMonthlyImpactCents)],
    [
      'Average food cost % (simple average of dishes, now)',
      formatPercentTenths(data.averageFoodCostTenthsPct),
    ],
    ['Dishes without volume', String(data.excludedWithoutVolume)],
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([title, value]) => (
        <Card key={title} className="gap-3 py-4">
          <CardHeader className="px-4 pb-0">
            <CardDescription>{title}</CardDescription>
            <CardTitle className="text-2xl">{value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

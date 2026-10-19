import type { DashboardDishRow } from '@/ui/domain/dashboard';
import { hrefFor } from '@/ui/router/routes';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFormatters, useLocale } from '@/ui/i18n';
import { contributionTone, costTone, useDishFigures } from './useDishFigures';

export function DishImpactTable({ rows, comparisonDate }: { rows: readonly DashboardDishRow[]; comparisonDate: string }) {
  const { t } = useLocale();
  const f = useFormatters();
  const figures = useDishFigures();
  return <div className="hidden md:block print:block">
    <Table aria-label={t('dashboard.table')} className="dashboard-table">
      <TableHeader><TableRow>
        {[t('dashboard.dish'), f.date(comparisonDate), t('dashboard.now'), t('dashboard.change'), t('dashboard.contribution'), t('dashboard.monthly')].map((label, i) =>
          <TableHead key={label} className={`h-auto whitespace-normal py-4 align-bottom ${i ? 'text-right' : 'w-[27%]'}`}>{label}</TableHead>)}
      </TableRow></TableHeader>
      <TableBody>{rows.map((row) => {
        const v = figures(row);
        return <TableRow key={row.id} className="break-inside-avoid">
          <TableCell className="whitespace-normal align-top">
            <a className="font-semibold underline-offset-4 hover:underline" href={hrefFor({ name: 'recipe', id: row.id })}>{row.name}</a>
            <span className="mt-1 block text-xs text-muted-foreground">{v.menu} {t('common.inclVat')} · {v.net} {t('common.exclVat')}</span>
            <a className="mt-2 inline-flex min-h-12 items-center text-sm underline underline-offset-4 no-print" href={hrefFor({ name: 'simulator', id: row.id })}>{t('dashboard.simulate')}</a>
          </TableCell>
          <TableCell className="text-right align-top whitespace-normal">{v.before}</TableCell>
          <TableCell className="text-right align-top whitespace-normal font-semibold">{v.now}</TableCell>
          <TableCell className={`text-right align-top whitespace-normal ${costTone(row.costDeltaCents)}`}>
            <span>{v.change}</span><span className="mt-1 block text-xs">{v.points}</span>
          </TableCell>
          <TableCell className="text-right align-top whitespace-normal">{v.contribution}</TableCell>
          <TableCell className={`text-right align-top whitespace-normal font-semibold ${contributionTone(row.monthlyImpactCents)}`}>{v.monthly}</TableCell>
        </TableRow>;
      })}</TableBody>
    </Table>
  </div>;
}

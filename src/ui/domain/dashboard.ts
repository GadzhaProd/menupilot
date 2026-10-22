import { dashboardData as calculateDashboardData } from '@/calc/dashboard.js';
import type { MenuDocument, Prep } from './types';

type Catalog = Pick<MenuDocument, 'ingredients' | 'recipes'>;

export type DashboardStatus =
  | 'ready'
  | 'cost-unknown'
  | 'no-price-on-date'
  | 'error';

export interface DashboardDishRow {
  id: string;
  name: string;
  menuPriceInclVatCents: number;
  priceExclVatMicro: bigint | null;
  currentCostMicro: bigint | null;
  comparisonCostMicro: bigint | null;
  currentContributionMicro: bigint | null;
  currentFoodCostTenthsPct: bigint | null;
  costDeltaCents: bigint | null;
  foodCostDeltaTenthsPct: bigint | null;
  monthlyImpactCents: bigint | null;
  status: DashboardStatus;
  monthlyVolume: number | null;
}

export interface DashboardPrepRow {
  id: string;
  name: string;
  current: string | null;
  currentBatchMicro: bigint | null;
  comparisonBatchMicro: bigint | null;
  outputMilli: number;
  outputUnit: Prep['outputUnit'];
  comparison: string | null;
  noPriceOnDate: boolean;
  costUnknown: boolean;
}

export interface DashboardData {
  dishes: DashboardDishRow[];
  preps: DashboardPrepRow[];
  totalMonthlyImpactCents: bigint | null;
  excludedWithoutVolume: number;
  excludedWithVolume: number;
  gotMoreExpensive: number;
  averageFoodCostTenthsPct: bigint | null;
}

export function dashboardData(data: Catalog, asOf: string): DashboardData {
  return calculateDashboardData(data, asOf) as DashboardData;
}

/** Rank comparable, positive per-portion cost changes; document order breaks ties. No new arithmetic. */
export function largestCostIncrease(rows: readonly DashboardDishRow[]) {
  let dish: DashboardDishRow | null = null;
  let tied = false;
  for (const row of rows) {
    if (row.status !== 'ready' || row.costDeltaCents === null || row.costDeltaCents <= 0n) continue;
    if (dish === null || row.costDeltaCents > dish.costDeltaCents!) { dish = row; tied = false; }
    else if (row.costDeltaCents === dish.costDeltaCents) tied = true;
  }
  return dish === null ? null : { dish, tied };
}

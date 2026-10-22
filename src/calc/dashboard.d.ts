export interface DashboardDishRow {
  id: string; name: string; menuPriceInclVatCents: number; priceExclVatMicro: bigint | null;
  currentCostMicro: bigint | null; comparisonCostMicro: bigint | null; currentContributionMicro: bigint | null;
  currentFoodCostTenthsPct: bigint | null; costDeltaCents: bigint | null; foodCostDeltaTenthsPct: bigint | null;
  monthlyImpactCents: bigint | null; status: 'ready' | 'cost-unknown' | 'no-price-on-date' | 'error'; monthlyVolume: number | null;
}
export interface DashboardPrepRow {
  id: string; name: string; current: string | null; currentBatchMicro: bigint | null; comparisonBatchMicro: bigint | null;
  outputMilli: number; outputUnit: 'g' | 'ml' | 'pc'; comparison: string | null; noPriceOnDate: boolean; costUnknown: boolean;
}
export interface DashboardData {
  dishes: DashboardDishRow[]; preps: DashboardPrepRow[]; totalMonthlyImpactCents: bigint | null;
  excludedWithoutVolume: number; excludedWithVolume: number; gotMoreExpensive: number; averageFoodCostTenthsPct: bigint | null;
}
export function dashboardData(data: { ingredients: readonly unknown[]; recipes: readonly unknown[] }, asOf: string): DashboardData;

import type { OperationReceipt, StoredDocument } from './storageAdapter';
export type PlanStatus = 'pending' | 'applied' | 'rejected' | 'expired' | 'stale' | 'superseded';
export interface PlanPrice {
  readonly seq: number;
  readonly recordedAt: string;
  readonly packPriceCents: string;
  readonly packSizeMilli: number;
}
export interface PlanPackaging extends PlanPrice {
  readonly unitPrice: { readonly cents: string; readonly per: 'kg' | 'l' | 'pc' };
}
export interface PricePlan {
  readonly id: string;
  readonly opId: string;
  readonly protocolVersion: 1;
  readonly documentId: string | null;
  readonly revision: number;
  readonly status: PlanStatus;
  readonly warnings?: readonly { readonly code: string; readonly message: string }[];
  readonly supersedes?: readonly string[];
  readonly source: 'cli' | 'agent';
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly ingredient: { readonly id: string; readonly name: string; readonly unit: 'g' | 'ml' | 'pc' };
  readonly price: PlanPrice;
  readonly previousPrice: PlanPackaging | null;
  readonly proposedPrice: PlanPackaging;
  readonly effects: {
    readonly dishes: readonly {
      readonly id: string; readonly name: string;
      readonly comparisonCostMicro: string | null; readonly currentCostMicro: string | null;
      readonly comparisonFoodCostTenthsPct: string | null; readonly currentFoodCostTenthsPct: string | null;
      readonly foodCostDeltaTenthsPct: string | null; readonly monthlyImpactCents: string | null;
      readonly excludedReason: 'no-volume' | 'cost-unknown' | null;
    }[];
    readonly preps: readonly { readonly id: string; readonly name: string; readonly comparisonBatchMicro: string | null; readonly currentBatchMicro: string | null }[];
    readonly totalMonthlyImpactCents: string | null;
    readonly excludedWithoutVolume: number;
    readonly excludedWithVolume: number;
  };
  readonly receipt?: OperationReceipt;
}
export interface PlanAdapter {
  list(): Promise<readonly PricePlan[]>;
  apply(id: string): Promise<StoredDocument & { receipt: OperationReceipt }>;
  reject(id: string): Promise<PricePlan>;
  subscribe(changed: (plans: readonly PricePlan[] | null) => void): () => void;
}

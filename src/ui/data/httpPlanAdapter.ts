import type { PlanAdapter, PricePlan } from '@/ui/domain/plans';
import { StoreError } from '@/ui/domain/store';

// A pending preview carries the exact review token required by the local server.
export type ReviewedPlan = PricePlan & { readonly consequencesFingerprint?: string };
export type ReviewedBatch = {
  readonly plans: readonly PricePlan[];
  readonly effects: PricePlan['effects'];
  readonly consequencesFingerprint: string;
};
type LocalPlanAdapter = Omit<PlanAdapter, 'apply'> & {
  get(id: string): Promise<ReviewedPlan>;
  reviewAll(planIds: readonly string[]): Promise<ReviewedBatch>;
  applyAll(planIds: readonly string[], consequencesFingerprint: string, opId: string): ReturnType<PlanAdapter['apply']>;
  apply(id: string, consequencesFingerprint: string): ReturnType<PlanAdapter['apply']>;
};

/** Separate queue notifications never pretend the document revision changed. */
export function createHttpPlanAdapter(token: string, pollMs = 2000): LocalPlanAdapter {
  async function request<T>(route: string, body?: Record<string, unknown>): Promise<T> {
    try {
      const response = await fetch('/api/plans' + route, {
        method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
      });
      const data = await response.json();
      if (!response.ok) throw new StoreError(data.code, data.message);
      return data as T;
    } catch (error) {
      if (error instanceof StoreError) throw error;
      throw new StoreError('connection-failed', 'Connection lost. Check the plan status before retrying.');
    }
  }
  const listeners = new Set<(plans: readonly PricePlan[] | null) => void>();
  let generation = 0;
  async function refresh() {
    const current = ++generation;
    try {
      const { plans } = await request<{ plans: readonly PricePlan[] }>('');
      if (!Array.isArray(plans)) throw new Error('Invalid plans response');
      if (current === generation) listeners.forEach(changed => changed(plans));
      return plans;
    } catch (error) {
      if (current === generation) listeners.forEach(changed => changed(null));
      throw error;
    }
  }
  async function action<T>(route: string, body: Record<string, unknown>): Promise<T> {
    ++generation; // An older poll cannot restore the pre-action panel.
    try { return await request<T>(route, body); }
    finally { await refresh().catch(() => {}); }
  }
  return {
    list: refresh,
    get: id => request('/status', { id }),
    reviewAll: planIds => request('/review-all', { planIds }),
    applyAll: (planIds, consequencesFingerprint, opId) => action('/apply-all', { planIds, consequencesFingerprint, opId }),
    apply: (id, consequencesFingerprint) => action('/apply', { id, consequencesFingerprint }),
    reject: id => action('/reject', { id }),
    subscribe(changed) {
      listeners.add(changed);
      let active = true, timer: ReturnType<typeof setTimeout>;
      async function poll() {
        await refresh().catch(() => {});
        if (active) timer = setTimeout(() => { void poll(); }, pollMs);
      }
      void poll();
      return () => { active = false; listeners.delete(changed); clearTimeout(timer); };
    },
  };
}

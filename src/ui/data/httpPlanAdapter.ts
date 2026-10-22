import type { PlanAdapter, PricePlan } from '@/ui/domain/plans';
import { StoreError } from '@/ui/domain/store';

/** Separate queue notifications never pretend the document revision changed. */
export function createHttpPlanAdapter(token: string, pollMs = 2000): PlanAdapter {
  async function request<T>(route: string, id?: string): Promise<T> {
    try {
      const response = await fetch('/api/plans' + route, {
        method: id === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, ...(id === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: id === undefined ? undefined : JSON.stringify({ id }), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
      });
      const data = await response.json();
      if (!response.ok) throw new StoreError(data.code, data.message);
      return data as T;
    } catch (error) {
      if (error instanceof StoreError) throw error;
      throw new StoreError('connection-failed', 'Connection lost. Check the plan status before retrying.');
    }
  }
  return {
    list: () => request(''), apply: id => request('/apply', id), reject: id => request('/reject', id),
    subscribe(changed) {
      let active = true, timer: ReturnType<typeof setTimeout>;
      let last = '';
      async function poll() {
        try {
          const plans = await request<readonly PricePlan[]>('');
          if (!Array.isArray(plans)) throw new Error('Invalid plans response');
          const signature = JSON.stringify(plans);
          if (active && signature !== last) { last = signature; changed(plans); }
        } catch { if (active) { last = ''; changed(null); } }
        if (active) timer = setTimeout(() => { void poll(); }, pollMs);
      }
      void poll();
      return () => { active = false; clearTimeout(timer); };
    },
  };
}

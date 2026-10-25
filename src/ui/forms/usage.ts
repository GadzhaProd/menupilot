/** "Where it is used" for delete errors and dialogs: at most 3 names, then "and N more". */
import type { Translate } from '@/ui/i18n';

export const MAX_SHOWN_USERS = 3;

export interface UsageSummary<T> {
  shown: T[];
  /** How many more users there are beyond the ones shown. */
  more: number;
}

export function summarizeUsers<T>(users: readonly T[]): UsageSummary<T> {
  return { shown: users.slice(0, MAX_SHOWN_USERS), more: Math.max(0, users.length - MAX_SHOWN_USERS) };
}

/** "A, B, C and 2 more" (no names: an empty string). */
export function usedByText(names: readonly string[], t: Translate): string {
  const { shown, more } = summarizeUsers(names);
  const list = shown.join(', ');
  return more > 0 ? `${list} ${t('prices.andMore', { count: more })}` : list;
}

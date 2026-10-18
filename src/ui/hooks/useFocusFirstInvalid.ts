import { useEffect, type RefObject } from 'react';

/**
 * After a failed Save (`attempt` goes up) move focus to the first field marked aria-invalid,
 * so keyboard and screen-reader users land on the problem.
 */
export function useFocusFirstInvalid(container: RefObject<HTMLElement | null>, attempt: number) {
  useEffect(() => {
    if (attempt === 0) return;
    container.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [container, attempt]);
}

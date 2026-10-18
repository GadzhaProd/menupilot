import { useCallback, useRef, useState } from 'react';

/**
 * Which dialog is open (null = none), plus keyboard-friendly focus return: when the dialog
 * closes, focus goes back to the button that opened it (Safari does not focus buttons on click,
 * so the opener is remembered explicitly). If that button is gone (a deleted row), focus
 * goes to the page content.
 */
export function useDialogState<T>() {
  const [state, setState] = useState<T | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const open = useCallback((value: T, event: { currentTarget: HTMLElement }) => {
    opener.current = event.currentTarget;
    setState(value);
  }, []);
  const close = useCallback(() => setState(null), []);
  const onCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    const target = opener.current;
    (target?.isConnected ? target : document.querySelector<HTMLElement>('main'))?.focus();
  }, []);

  return { state, open, close, onCloseAutoFocus };
}

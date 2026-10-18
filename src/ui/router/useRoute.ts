import { useMemo, useSyncExternalStore } from 'react';
import { parseHash, type Route } from './routes';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const getHash = () => window.location.hash;

/** The current route; follows links, Back and Forward through `hashchange`. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return useMemo(() => parseHash(hash), [hash]);
}

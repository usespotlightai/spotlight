import { useSyncExternalStore } from 'react';

const NARROW = '(width < 48rem)';

const query = () =>
  typeof window.matchMedia === 'function' ? window.matchMedia(NARROW) : null;

const subscribe = (changed: () => void) => {
  const media = query();
  media?.addEventListener('change', changed);

  return () => media?.removeEventListener('change', changed);
};

const narrow = () => query()?.matches ?? false;

export function useNarrowViewport() {
  return useSyncExternalStore(subscribe, narrow, () => false);
}

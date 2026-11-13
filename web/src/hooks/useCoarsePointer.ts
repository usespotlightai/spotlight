import { useSyncExternalStore } from 'react';

const COARSE = '(pointer: coarse)';

const query = () =>
  typeof window.matchMedia === 'function' ? window.matchMedia(COARSE) : null;

const subscribe = (changed: () => void) => {
  const media = query();
  media?.addEventListener('change', changed);

  return () => media?.removeEventListener('change', changed);
};

const coarse = () => query()?.matches ?? false;

export function useCoarsePointer() {
  return useSyncExternalStore(subscribe, coarse, () => false);
}

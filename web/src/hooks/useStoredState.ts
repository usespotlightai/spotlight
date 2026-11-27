import { useCallback, useSyncExternalStore } from 'react';

const unstored = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

export const readStored = (storageKey: string): string | null => {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return unstored.get(storageKey) ?? null;
  }
};

export const writeStored = (storageKey: string, value: string): void => {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    unstored.set(storageKey, value);
  }
  for (const listener of listeners.get(storageKey) ?? []) {
    listener();
  }
};

const subscribe = (storageKey: string, listener: () => void) => {
  const keyed = listeners.get(storageKey) ?? new Set();
  keyed.add(listener);
  listeners.set(storageKey, keyed);
  const fromOtherTab = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      listener();
    }
  };
  window.addEventListener('storage', fromOtherTab);

  return () => {
    keyed.delete(listener);
    window.removeEventListener('storage', fromOtherTab);
  };
};

export function useStoredState(
  storageKey: string,
  fallback: string,
): [string, (value: string) => void] {
  const stored = useSyncExternalStore(
    useCallback((listener) => subscribe(storageKey, listener), [storageKey]),
    () => readStored(storageKey),
  );

  const store = useCallback(
    (value: string) => writeStored(storageKey, value),
    [storageKey],
  );

  return [stored ?? fallback, store];
}

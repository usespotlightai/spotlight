import { useCallback, useState } from 'react';

const readStored = (storageKey: string): string[] => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(saved)
      ? saved.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
};

const remember = (storageKey: string, ids: readonly string[]) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // a browser that refuses storage still collapses, it just forgets
  }
};

/**
 * Tracks what is closed rather than what is open, so anything added later
 * shows its contents instead of being silently hidden by a stale record.
 */
export function useCollapsed(storageKey: string) {
  const [collapsed, setCollapsed] = useState<readonly string[]>(() =>
    readStored(storageKey),
  );

  const toggle = useCallback(
    (id: string) => {
      setCollapsed((current) => {
        const next = current.includes(id)
          ? current.filter((each) => each !== id)
          : [...current, id];
        remember(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  return {
    isExpanded: (id: string) => !collapsed.includes(id),
    toggle,
  };
}

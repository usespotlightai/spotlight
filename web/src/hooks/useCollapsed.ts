import { useCallback, useState } from 'react';

const readStored = (
  storageKey: string,
  collapsedByDefault: readonly string[],
): readonly string[] => {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === null) {
      return collapsedByDefault;
    }
    const saved: unknown = JSON.parse(stored);
    return Array.isArray(saved)
      ? saved.filter((id): id is string => typeof id === 'string')
      : collapsedByDefault;
  } catch {
    return collapsedByDefault;
  }
};

const store = (storageKey: string, ids: readonly string[]) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {}
};

export function useCollapsed(
  storageKey: string,
  collapsedByDefault: readonly string[] = [],
) {
  const [collapsed, setCollapsed] = useState<readonly string[]>(() =>
    readStored(storageKey, collapsedByDefault),
  );

  const toggle = useCallback(
    (id: string) => {
      const next = collapsed.includes(id)
        ? collapsed.filter((each) => each !== id)
        : [...collapsed, id];
      setCollapsed(next);
      store(storageKey, next);
    },
    [collapsed, storageKey],
  );

  return {
    isExpanded: (id: string) => !collapsed.includes(id),
    toggle,
  };
}

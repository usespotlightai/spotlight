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
  } catch {}
};

export function useCollapsed(storageKey: string) {
  const [collapsed, setCollapsed] = useState<readonly string[]>(() =>
    readStored(storageKey),
  );

  const toggle = useCallback(
    (id: string) => {
      const next = collapsed.includes(id)
        ? collapsed.filter((each) => each !== id)
        : [...collapsed, id];
      setCollapsed(next);
      remember(storageKey, next);
    },
    [collapsed, storageKey],
  );

  return {
    isExpanded: (id: string) => !collapsed.includes(id),
    toggle,
  };
}

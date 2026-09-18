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

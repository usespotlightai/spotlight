import { useCallback, useState } from 'react';

const STORAGE_KEY = 'spotlight.collapsed-teams';

const readStored = (): string[] => {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]',
    );
    return Array.isArray(saved)
      ? saved.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
};

const remember = (ids: readonly string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {}
};

export function useCollapsedTeams() {
  const [collapsed, setCollapsed] = useState<readonly string[]>(readStored);

  const toggle = useCallback((teamId: string) => {
    setCollapsed((current) => {
      const next = current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId];
      remember(next);
      return next;
    });
  }, []);

  return {
    isExpanded: (teamId: string) => !collapsed.includes(teamId),
    toggle,
  };
}

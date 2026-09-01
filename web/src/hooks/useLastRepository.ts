import { useCallback, useState } from 'react';

const STORAGE_KEY = 'spotlight.last-repository';

const readStored = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

export function useLastRepository(): [string, (repository: string) => void] {
  const [last, setLast] = useState(readStored);

  const remember = useCallback((repository: string) => {
    setLast(repository);
    try {
      localStorage.setItem(STORAGE_KEY, repository);
    } catch {
      // a browser that refuses storage still works, it just forgets
    }
  }, []);

  return [last, remember];
}

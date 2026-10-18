import { useCallback, useState } from 'react';

const readStored = (storageKey: string, fallback: string): string => {
  try {
    return localStorage.getItem(storageKey) ?? fallback;
  } catch {
    return fallback;
  }
};

export function useStoredState(
  storageKey: string,
  fallback: string,
): [string, (value: string) => void] {
  const [stored, setStored] = useState(() => readStored(storageKey, fallback));

  const store = useCallback(
    (value: string) => {
      setStored(value);
      try {
        localStorage.setItem(storageKey, value);
      } catch {}
    },
    [storageKey],
  );

  return [stored, store];
}

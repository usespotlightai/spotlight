import { useCallback, useState } from 'react';

const readStored = (storageKey: string, fallback: string): string => {
  try {
    return localStorage.getItem(storageKey) ?? fallback;
  } catch {
    return fallback;
  }
};

/** One value a browser keeps for the next visit, and forgets if it must. */
export function useRemembered(
  storageKey: string,
  fallback: string,
): [string, (value: string) => void] {
  const [held, setHeld] = useState(() => readStored(storageKey, fallback));

  const remember = useCallback(
    (value: string) => {
      setHeld(value);
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        // a browser that refuses storage still works, it just forgets
      }
    },
    [storageKey],
  );

  return [held, remember];
}

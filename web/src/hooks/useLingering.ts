import { useEffect, useState } from 'react';

export function useLingering<T>(current: T | null, ms: number): T | null {
  const [held, setHeld] = useState<T | null>(current);

  useEffect(() => {
    if (current !== null) {
      setHeld(current);
      return;
    }

    if (held === null) {
      return;
    }

    const timer = setTimeout(() => setHeld(null), ms);
    return () => clearTimeout(timer);
  }, [current, held, ms]);

  return current ?? held;
}

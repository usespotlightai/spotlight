import { useEffect, useState } from 'react';

export function useLingering<T>(current: T | null, ms: number): T | null {
  const [lingering, setLingering] = useState<T | null>(current);

  useEffect(() => {
    if (current !== null) {
      setLingering(current);
      return;
    }

    if (lingering === null) {
      return;
    }

    const timer = setTimeout(() => setLingering(null), ms);
    return () => clearTimeout(timer);
  }, [current, lingering, ms]);

  return current ?? lingering;
}

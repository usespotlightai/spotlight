import { useEffect, useState } from 'react';

export function useDelayedValue<T>(current: T | null, ms: number): T | null {
  const [delayed, setDelayed] = useState<T | null>(current);

  useEffect(() => {
    if (current !== null) {
      setDelayed(current);
      return;
    }

    if (delayed === null) {
      return;
    }

    const timer = setTimeout(() => setDelayed(null), ms);
    return () => clearTimeout(timer);
  }, [current, delayed, ms]);

  return current ?? delayed;
}

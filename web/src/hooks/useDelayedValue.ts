import { useEffect, useState } from 'react';

export function useDelayedValue<T>(current: T | null, ms: number): T | null {
  const [delayed, setDelayed] = useState<T | null>(current);

  if (current !== null && current !== delayed) {
    setDelayed(current);
  }

  useEffect(() => {
    if (current !== null || delayed === null) {
      return;
    }

    const timer = setTimeout(() => setDelayed(null), ms);
    return () => clearTimeout(timer);
  }, [current, delayed, ms]);

  return current ?? delayed;
}
